import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  CanonicalQuantityItem,
  CanonicalQuantityProgressModel,
  QuantityScheduleAllocation,
} from "../../quantity-progress-core/src";
import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
  CanonicalWbsNode,
} from "../../schedule-analysis-core/src";
import type {
  QuantityActivityMappingCandidate,
  QuantityActivityMappingSignal,
  QuantityScheduleMappingResult,
} from "./types";

const STOP = new Set([
  "the","and","for","with","from","into","work","works","system","systems",
  "supply","installation","install","provide","including","complete","all",
  "of","to","in","on","at","by","or","a","an","as","per","item","package",
]);

function norm(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string | null | undefined): Set<string> {
  return new Set(
    norm(value)
      .split(" ")
      .map((token) => token.trim())
      .filter(
        (token) =>
          token.length >= 2 &&
          !STOP.has(token),
      ),
  );
}

function jaccard(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union <= 0 ? 0 : intersection / union;
}

function pct(value: number, total: number): number | null {
  if (total <= 0) return null;
  return Number(((value / total) * 100).toFixed(4));
}

function wbsText(
  activity: CanonicalScheduleActivity,
  byId: ReadonlyMap<string, CanonicalWbsNode>,
): string {
  const parts: string[] = [];
  let current =
    activity.wbsId
      ? byId.get(activity.wbsId) ?? null
      : null;
  const visited = new Set<string>();

  while (current && !visited.has(current.wbsId)) {
    visited.add(current.wbsId);
    parts.push(current.wbsId);
    if (current.name) parts.push(current.name);
    current =
      current.parentWbsId
        ? byId.get(current.parentWbsId) ?? null
        : null;
  }
  return parts.join(" ");
}

function codeTokens(value: string): Set<string> {
  return new Set(
    value
      .toUpperCase()
      .match(/[A-Z]{1,8}-?\d{1,8}|\d{2,}/g) ??
      [],
  );
}

interface ItemFeatures {
  corpus: string;
  description: string;
  descriptionTokens: ReadonlySet<string>;
  sectionTokens: ReadonlySet<string>;
  codes: ReadonlySet<string>;
}

interface ActivityFeatures {
  name: string;
  nameTokens: ReadonlySet<string>;
  wbsTokens: ReadonlySet<string>;
  codes: ReadonlySet<string>;
  explicitId: RegExp | null;
}

function itemFeatures(item: CanonicalQuantityItem): ItemFeatures {
  const corpus = [item.itemNumber ?? "", item.section ?? "", item.description].join(" ");
  return {corpus, description: norm(item.description), descriptionTokens: tokens(item.description),
    sectionTokens: tokens(item.section), codes: codeTokens(corpus)};
}

function activityFeatures(activity: CanonicalScheduleActivity, wbs: string): ActivityFeatures {
  const id = activity.activityId.trim();
  const escaped = id.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return {name: norm(activity.name), nameTokens: tokens(activity.name), wbsTokens: tokens(wbs),
    codes: codeTokens([activity.activityId, activity.wbsId ?? "", wbs].join(" ")),
    explicitId: id ? new RegExp("(^|[^A-Za-z0-9_.-])" + escaped + "([^A-Za-z0-9_.-]|$)", "i") : null};
}

function score(
  item: ItemFeatures,
  activity: ActivityFeatures,
  includeSignals = true,
): {value: number; signals: QuantityActivityMappingSignal[]} {
  const signals: QuantityActivityMappingSignal[] = [];
  if (activity.explicitId?.test(item.corpus)) {
    if (includeSignals) signals.push({key: "explicit_activity_id", score: 0.99,
      detail: "BOQ evidence contains the exact schedule Activity ID."});
    return {value: 0.99, signals};
  }

  // Features are prepared once per source row, not for every item/activity pair.
  // Keep the original component order, thresholds and rounding unchanged.
  let value = 0;
  const descriptionSimilarity = jaccard(item.descriptionTokens, activity.nameTokens);
  if (descriptionSimilarity > 0) {
    const component = Math.min(0.62, descriptionSimilarity * 0.72);
    value += component;
    if (includeSignals) signals.push({key: "description", score: component,
      detail: "BOQ description and activity name token similarity=" + descriptionSimilarity.toFixed(4)});
  }
  if (item.description.length >= 5 && activity.name.length >= 5 &&
    (item.description.includes(activity.name) || activity.name.includes(item.description))) {
    value += 0.23;
    if (includeSignals) signals.push({key: "activity_name", score: 0.23,
      detail: "One normalized description contains the other."});
  }
  const sectionSimilarity = jaccard(item.sectionTokens, activity.wbsTokens);
  if (sectionSimilarity > 0) {
    const component = Math.min(0.24, sectionSimilarity * 0.30);
    value += component;
    if (includeSignals) signals.push({key: "section", score: component,
      detail: "BOQ section and WBS hierarchy similarity=" + sectionSimilarity.toFixed(4)});
  }
  const codeSimilarity = jaccard(item.codes, activity.codes);
  if (codeSimilarity > 0) {
    const component = Math.min(0.18, codeSimilarity * 0.22);
    value += component;
    if (includeSignals) signals.push({key: "code_token", score: component,
      detail: "Code/location token overlap=" + codeSimilarity.toFixed(4)});
  }
  return {value: Math.min(0.97, value), signals};
}

function candidateId(
  itemId: string,
  activityId: string,
  method: string,
): string {
  return (
    "qty-map-" +
    stableFingerprint({
      itemId,
      activityId,
      method,
    }).slice(0, 20)
  );
}

function governedCandidate(
  allocation: QuantityScheduleAllocation,
): QuantityActivityMappingCandidate {
  return {
    candidateId:
      candidateId(
        allocation.quantityItemId,
        allocation.activityId,
        "governed",
      ),
    quantityItemId:
      allocation.quantityItemId,
    activityId:
      allocation.activityId,
    confidence: 1,
    method:
      "governed_allocation",
    authority: "governed",
    ambiguous: false,
    allocatedQuantity:
      allocation.allocatedQuantity,
    allocationShare: null,
    signals: [{
      key: "explicit_activity_id",
      score: 1,
      detail:
        "Governed quantity-to-schedule allocation.",
    }],
    sourceRefs: [
      ...allocation.sourceRefs,
    ],
    diagnostics: [],
  };
}

function selectedScenarioForItem(
  item: CanonicalQuantityItem,
  ranked: QuantityActivityMappingCandidate[],
  activityById:
    ReadonlyMap<string, CanonicalScheduleActivity>,
): QuantityActivityMappingCandidate[] {
  if (ranked.length === 0) return [];

  const top = ranked[0]!;
  const second =
    ranked[1] ?? null;
  const margin =
    second
      ? top.confidence -
        second.confidence
      : top.confidence;

  if (
    top.confidence >= 0.70 &&
    (
      second === null ||
      margin >= 0.10
    )
  ) {
    return [{
      ...top,
      method:
        top.signals.some(
          (signal) =>
            signal.key ===
            "explicit_activity_id",
        )
          ? "explicit_activity_id"
          : "composite_similarity",
      ambiguous: false,
      allocatedQuantity:
        item.contractQuantity,
      allocationShare:
        item.contractQuantity === null
          ? null
          : 1,
    }];
  }

  const group =
    ranked
      .filter(
        (candidate) =>
          candidate.confidence >= 0.62 &&
          top.confidence -
            candidate.confidence <=
            0.08,
      )
      .slice(0, 3);

  if (
    group.length < 2 ||
    item.contractQuantity === null
  ) {
    return [];
  }

  const weights =
    group.map((candidate) => {
      const activity =
        activityById.get(
          candidate.activityId,
        );
      const hours =
        activity
          ?.remainingDurationHours;
      return (
        hours !== null &&
        hours !== undefined &&
        hours > 0
      )
        ? hours
        : 1;
    });
  const weightTotal =
    weights.reduce(
      (sum, value) => sum + value,
      0,
    );

  return group.map(
    (candidate, index) => {
      const share =
        weights[index]! /
        weightTotal;
      return {
        ...candidate,
        confidence:
          Number(
            Math.max(
              0,
              candidate.confidence -
                0.08,
            ).toFixed(4),
          ),
        method:
          "multi_activity_scenario",
        authority:
          "candidate_scenario",
        ambiguous: true,
        allocatedQuantity:
          Number(
            (
              item.contractQuantity! *
              share
            ).toFixed(6),
          ),
        allocationShare:
          Number(
            share.toFixed(6),
          ),
        diagnostics: [
          ...candidate.diagnostics,
          "SCENARIO_ALLOCATION_DISTRIBUTED_BY_REMAINING_DURATION",
          "MAPPING_REQUIRES_GOVERNED_REVIEW",
        ],
      };
    },
  );
}

export function buildQuantityScheduleMapping(
  quantities: CanonicalQuantityProgressModel,
  schedule: CanonicalScheduleModel,
): QuantityScheduleMappingResult {
  const startedAt = performance.now();
  let scoredPairCount = 0;
  const wbsById =
    new Map(
      schedule.wbs.map(
        (node) => [
          node.wbsId,
          node,
        ],
      ),
    );
  const activityById =
    new Map(
      schedule.activities.map(
        (activity) => [
          activity.activityId,
          activity,
        ],
      ),
    );
  const governedByItem =
    new Map<
      string,
      QuantityScheduleAllocation[]
    >();

  for (const allocation of quantities.allocations) {
    const list =
      governedByItem.get(
        allocation.quantityItemId,
      ) ?? [];
    list.push(allocation);
    governedByItem.set(
      allocation.quantityItemId,
      list,
    );
  }

  const candidates:
    QuantityActivityMappingCandidate[] = [];
  const selected:
    QuantityActivityMappingCandidate[] = [];
  const ambiguousItemIds: string[] = [];
  const unmappedItemIds: string[] = [];

  // Generate an exact candidate superset from the scoring features. Previously
  // every BOQ item re-tokenized every activity and created a fingerprint even
  // for a zero score, making real source registers block the whole resolver.
  const eligible=schedule.activities.filter(a=>a.activityType==='task'&&a.status!=='completed');
  const featuresByActivity=new Map(eligible.map(a=>[a,activityFeatures(a,wbsText(a,wbsById))]));
  type FeatureGroup={members:CanonicalScheduleActivity[];features:ActivityFeatures};
  const featureGroupsByKey=new Map<string,FeatureGroup>();
  const groupForActivity=new Map<CanonicalScheduleActivity,FeatureGroup>();
  for(const activity of eligible){
    const f=featuresByActivity.get(activity)!;
    // Scoring depends on name and WBS tokens, the count of code tokens,
    // and item-specific code intersections. Individual code hits below are
    // handled separately; the remaining members have identical scores.
    const key=JSON.stringify([f.name,[...f.wbsTokens].sort(),f.codes.size]);
    let group=featureGroupsByKey.get(key);
    if(!group){group={members:[],features:f};featureGroupsByKey.set(key,group);}
    group.members.push(activity);groupForActivity.set(activity,group);
  }
  type GroupPosting=Map<string,Set<FeatureGroup>>;
  type ActivityPosting=Map<string,Set<CanonicalScheduleActivity>>;
  const descriptions:GroupPosting=new Map(),sections:GroupPosting=new Map();
  const nameGrams:GroupPosting=new Map(),namePrefixes:GroupPosting=new Map();
  const codes:ActivityPosting=new Map();
  const indexGroup=(map:GroupPosting,key:string,group:FeatureGroup)=>{
    const rows=map.get(key)??new Set<FeatureGroup>();rows.add(group);map.set(key,rows);
  };
  const grams=(s:string)=>Array.from({length:Math.max(0,s.length-4)},(_,i)=>s.slice(i,i+5));
  for(const group of featureGroupsByKey.values()){
    group.members.sort((a,b)=>a.activityId.localeCompare(b.activityId));
    for(const token of group.features.nameTokens)indexGroup(descriptions,token,group);
    for(const token of group.features.wbsTokens)indexGroup(sections,token,group);
    const name=group.features.name;
    if(name.length>=5){
      indexGroup(namePrefixes,name.slice(0,5),group);
      for(const gram of grams(name))indexGroup(nameGrams,gram,group);
    }
  }
  for(const activity of eligible)for(const key of featuresByActivity.get(activity)!.codes){
    const rows=codes.get(key)??new Set<CanonicalScheduleActivity>();
    rows.add(activity);codes.set(key,rows);
  }
  const explicit=new Map(eligible.filter(a=>/^[A-Za-z0-9_.-]+$/.test(a.activityId)).map(a=>[a.activityId.toUpperCase(),a]));
  const unusualIds=eligible.filter(a=>!/^[A-Za-z0-9_.-]+$/.test(a.activityId));
  const candidatesFor=(features:ItemFeatures)=>{
    const nameGroups=new Set<FeatureGroup>();
    const collect=(posting:GroupPosting,keys:Iterable<string>,target:Set<FeatureGroup>)=>{
      for(const key of keys)for(const group of posting.get(key)??[])target.add(group);
    };
    collect(descriptions,features.descriptionTokens,nameGroups);
    if(features.description.length>=5){
      collect(nameGrams,[features.description.slice(0,5)],nameGroups);
      collect(namePrefixes,grams(features.description),nameGroups);
    }
    const sectionGroups=new Set<FeatureGroup>();
    collect(sections,features.sectionTokens,sectionGroups);
    const codeHits=new Map<CanonicalScheduleActivity,number>();
    for(const token of features.codes)for(const activity of codes.get(token)??[])
      codeHits.set(activity,(codeHits.get(activity)??0)+1);
    const specialsByGroup=new Map<FeatureGroup,Set<CanonicalScheduleActivity>>();
    const special=(activity:CanonicalScheduleActivity)=>{
      const group=groupForActivity.get(activity)!;
      const rows=specialsByGroup.get(group)??new Set<CanonicalScheduleActivity>();
      rows.add(activity);specialsByGroup.set(group,rows);
    };
    const candidateGroups=new Set(nameGroups);
    for(const activity of codeHits.keys()){
      const group=groupForActivity.get(activity)!;
      if(sectionGroups.has(group))candidateGroups.add(group);
      special(activity);
    }
    const explicitMatches=new Set<CanonicalScheduleActivity>();
    const raw=features.corpus;
    for(const token of raw.toUpperCase().match(/[A-Z0-9_.-]+/g)??[]){
      const activity=explicit.get(token);
      if(activity&&featuresByActivity.get(activity)!.explicitId?.test(raw)){
        explicitMatches.add(activity);special(activity);candidateGroups.add(groupForActivity.get(activity)!);
      }
    }
    for(const activity of unusualIds)if(featuresByActivity.get(activity)!.explicitId?.test(raw)){
      explicitMatches.add(activity);special(activity);candidateGroups.add(groupForActivity.get(activity)!);
    }
    return {candidateGroups,nameGroups,sectionGroups,codeHits,specialsByGroup,explicitMatches};
  };
  const overlaps=(keys:ReadonlySet<string>,other:ReadonlySet<string>):number=>{
    let count=0;
    for(const key of keys)if(other.has(key))count++;
    return count;
  };
  const fastScore=(item:ItemFeatures,activity:ActivityFeatures,
    descriptionHits:number,sectionHits:number,codeHits:number):number=>{
    const similarity=(n:number,a:number,b:number)=>n&&a&&b?n/(a+b-n):0;
    const description=similarity(descriptionHits,item.descriptionTokens.size,activity.nameTokens.size);
    let value=description>0?Math.min(0.62,description*0.72):0;
    if(item.description.length>=5&&activity.name.length>=5&&
      (item.description.includes(activity.name)||activity.name.includes(item.description)))value+=0.23;
    const section=similarity(sectionHits,item.sectionTokens.size,activity.wbsTokens.size);
    if(section>0)value+=Math.min(0.24,section*0.30);
    const code=similarity(codeHits,item.codes.size,activity.codes.size);
    if(code>0)value+=Math.min(0.18,code*0.22);
    return Math.min(0.97,value);
  };

  for (const item of quantities.items) {
    const governed =
      governedByItem.get(
        item.quantityItemId,
      ) ?? [];

    if (governed.length > 0) {
      const rows =
        governed.map(
          governedCandidate,
        );
      candidates.push(...rows);
      selected.push(...rows);
      continue;
    }

    const features = itemFeatures(item);
    const top: Array<{activity: CanonicalScheduleActivity; confidence: number}> = [];
    const {candidateGroups,nameGroups,sectionGroups,codeHits,specialsByGroup,explicitMatches}=candidatesFor(features);
    const offer=(activity:CanonicalScheduleActivity,rawConfidence:number)=>{
      // Preserve both the original four-decimal confidence rule and the
      // stable activity-ID tie break, including on ambiguous BOQ proposals.
      if(top.length===5&&rawConfidence<top[4]!.confidence-0.0001)return;
      if(rawConfidence<0.33994)return;
      const confidence=Number(rawConfidence.toFixed(4));
      if(confidence<0.34)return;
      const index=top.findIndex(row=>confidence>row.confidence||
        confidence===row.confidence&&activity.activityId.localeCompare(row.activity.activityId)<0);
      if(index<0){if(top.length<5)top.push({activity,confidence});}
      else {top.splice(index,0,{activity,confidence});if(top.length>5)top.pop();}
    };
    for(const group of candidateGroups){
      const normal=nameGroups.has(group);
      const specials=specialsByGroup.get(group)??new Set<CanonicalScheduleActivity>();
      const n=overlaps(features.descriptionTokens,group.features.nameTokens);
      const s=overlaps(features.sectionTokens,group.features.wbsTokens);
      if(normal){
        // Members have identical evidence except for their own unique codes.
        // Five lowest Activity IDs suffice for each same-score group: a sixth
        // cannot appear in any globally ranked top-five, even on a tie.
        scoredPairCount+=group.members.length;
        const baseConfidence=fastScore(features,group.features,n,s,0);
        let considered=0;
        for(const activity of group.members){
          if(specials.has(activity))continue;
          offer(activity,baseConfidence);
          if(++considered===5)break;
        }
      }
      for(const activity of specials){
        const codeHit=codeHits.get(activity)??0;
        if(!normal&&!(codeHit>0&&sectionGroups.has(group))&&!explicitMatches.has(activity))continue;
        if(!normal)scoredPairCount++;
        const rawConfidence=explicitMatches.has(activity)?0.99:fastScore(
          features,featuresByActivity.get(activity)!,n,s,codeHit);
        offer(activity,rawConfidence);
      }
    }
    const ranked: QuantityActivityMappingCandidate[] = top.map(({activity, confidence}) => ({
      candidateId: candidateId(item.quantityItemId, activity.activityId, "candidate"),
      quantityItemId: item.quantityItemId, activityId: activity.activityId, confidence,
      method: "composite_similarity", authority: "candidate_scenario", ambiguous: false,
      allocatedQuantity: null, allocationShare: null,
      signals: score(features, featuresByActivity.get(activity)!).signals,
      sourceRefs: [...item.sourceRefs], diagnostics: [],
    }));

    if (ranked.length === 0) {
      unmappedItemIds.push(
        item.quantityItemId,
      );
      continue;
    }

    const second =
      ranked[1] ?? null;
    const isAmbiguous =
      second !== null &&
      ranked[0]!.confidence -
        second.confidence <
        0.10;

    const marked =
      ranked.map(
        (candidate) => ({
          ...candidate,
          ambiguous:
            isAmbiguous,
          diagnostics:
            isAmbiguous
              ? [
                  "MAPPING_CANDIDATES_CLOSE_IN_SCORE",
                ]
              : [],
        }),
      );
    candidates.push(
      ...marked,
    );

    const scenario =
      selectedScenarioForItem(
        item,
        marked,
        activityById,
      );
    if (scenario.length === 0) {
      unmappedItemIds.push(
        item.quantityItemId,
      );
      if (isAmbiguous) {
        ambiguousItemIds.push(
          item.quantityItemId,
        );
      }
    } else {
      selected.push(
        ...scenario,
      );
      if (
        scenario.some(
          (row) =>
            row.ambiguous,
        )
      ) {
        ambiguousItemIds.push(
          item.quantityItemId,
        );
      }
    }
  }

  const selectedItems =
    new Set(
      selected.map(
        (row) =>
          row.quantityItemId,
      ),
    );

  let totalKnownQuantity = 0;
  let mappedQuantity = 0;
  let knownQuantityItemCount = 0;
  let mappedKnownQuantityItemCount = 0;

  for (const item of quantities.items) {
    if (
      item.contractQuantity === null ||
      item.contractQuantity < 0
    ) continue;
    totalKnownQuantity +=
      item.contractQuantity;
    knownQuantityItemCount += 1;
    if (
      selectedItems.has(
        item.quantityItemId,
      )
    ) {
      mappedQuantity +=
        item.contractQuantity;
      mappedKnownQuantityItemCount +=
        1;
    }
  }

  const knownUnits =
    new Set(
      quantities.items
        .filter(
          (item) =>
            item.contractQuantity !==
              null &&
            item.contractQuantity >= 0,
        )
        .map(
          (item) =>
            (
              item.unit ??
              "UNSPECIFIED"
            )
              .normalize("NFKC")
              .trim()
              .toUpperCase() ||
            "UNSPECIFIED",
        ),
    );
  const mixedQuantityUnits =
    knownUnits.size > 1;
  const itemCoveragePercent =
    knownQuantityItemCount === 0
      ? null
      : Number(
          (
            (
              mappedKnownQuantityItemCount /
              knownQuantityItemCount
            ) *
            100
          ).toFixed(4),
        );

  if (process.env.CMENG_PROFILE_PERF?.trim() === "1") {
    process.stdout.write(JSON.stringify({event: "quantity_mapping_profile", projectId: quantities.projectId ?? schedule.projectId,
      itemCount: quantities.items.length, activityCount: eligible.length, scoredPairCount,
      durationMs: performance.now() - startedAt}) + "\n");
  }

  return {
    schemaVersion: "1.0",
    projectId:
      quantities.projectId ??
      schedule.projectId,
    boqRevisionId:
      quantities.boqRevisionId,
    scheduleRevisionId:
      schedule.sourceRevisionId,
    candidateCount:
      candidates.length,
    governedLinkCount:
      selected.filter(
        (row) =>
          row.authority ===
          "governed",
      ).length,
    scenarioLinkCount:
      selected.filter(
        (row) =>
          row.authority ===
          "candidate_scenario",
      ).length,
    knownQuantityItemCount,
    mappedKnownQuantityItemCount,
    mappedQuantity:
      Number(
        mappedQuantity.toFixed(6),
      ),
    totalKnownQuantity:
      Number(
        totalKnownQuantity.toFixed(6),
      ),
    quantityCoveragePercent:
      mixedQuantityUnits
        ? null
        : pct(
            mappedQuantity,
            totalKnownQuantity,
          ),
    itemCoveragePercent,
    mixedQuantityUnits,
    ambiguousItemIds:
      [...new Set(
        ambiguousItemIds,
      )].sort(),
    unmappedItemIds:
      [...new Set(
        unmappedItemIds,
      )].sort(),
    candidates,
    selectedScenarioLinks:
      selected,
    diagnostics: [
      ...(selected.some(
        (row) =>
          row.authority ===
          "candidate_scenario",
      )
        ? [
            "INFERRED_QUANTITY_ACTIVITY_LINKS_ARE_SCENARIO_ONLY_UNTIL_GOVERNED",
          ]
        : []),
      ...(ambiguousItemIds.length
        ? [
            "AMBIGUOUS_QUANTITY_ACTIVITY_MAPPING_REQUIRES_REVIEW",
          ]
        : []),
      ...(mixedQuantityUnits
        ? [
            "MIXED_QUANTITY_UNITS_NOT_CROSS_SUMMED_FOR_COVERAGE",
          ]
        : []),
    ],
  };
}
