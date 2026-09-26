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
  type Posting=Map<string,Set<CanonicalScheduleActivity>>;
  const descriptions:Posting=new Map(),sections:Posting=new Map(),codes:Posting=new Map(),nameGrams:Posting=new Map(),namePrefixes:Posting=new Map();
  const explicit=new Map(eligible.filter(a=>/^[A-Za-z0-9_.-]+$/.test(a.activityId)).map(a=>[a.activityId.toUpperCase(),a]));
  const unusualIds=eligible.filter(a=>!/^[A-Za-z0-9_.-]+$/.test(a.activityId));
  const index=(map:Posting,key:string,a:CanonicalScheduleActivity)=>{const list=map.get(key)??new Set();list.add(a);map.set(key,list);};
  const grams=(s:string)=>Array.from({length:Math.max(0,s.length-4)},(_,i)=>s.slice(i,i+5));
  for(const a of eligible){
    const features=featuresByActivity.get(a)!;
    for(const token of features.nameTokens)index(descriptions,token,a);
    for(const token of features.wbsTokens)index(sections,token,a);
    for(const token of features.codes)index(codes,token,a);
    const name=features.name;if(name.length>=5){index(namePrefixes,name.slice(0,5),a);for(const gram of grams(name))index(nameGrams,gram,a);}
  }
  const sectionMatchCache=new Map<string,Set<CanonicalScheduleActivity>>();
  const candidatesFor=(item:CanonicalQuantityItem,features:ItemFeatures)=>{
    const found=new Set<CanonicalScheduleActivity>();
    const collect=(map:Posting,keys:Iterable<string>,target=found)=>{for(const key of keys)for(const a of map.get(key)??[])target.add(a);};
    collect(descriptions,features.descriptionTokens);
    const description=features.description;
    if(description.length>=5){collect(nameGrams,[description.slice(0,5)]);collect(namePrefixes,grams(description));}
    const codeMatches=new Set<CanonicalScheduleActivity>();
    const corpus=features.corpus;
    collect(codes,features.codes,codeMatches);
    // Section or code evidence alone cannot reach the 0.34 candidate threshold.
    if(codeMatches.size){
      const sectionKey=item.section??'';
      let sectionMatches=sectionMatchCache.get(sectionKey);
      if(!sectionMatches){sectionMatches=new Set();collect(sections,features.sectionTokens,sectionMatches);sectionMatchCache.set(sectionKey,sectionMatches);}
      for(const a of codeMatches)if(sectionMatches.has(a))found.add(a);
    }
    for(const token of corpus.toUpperCase().match(/[A-Z0-9_.-]+/g)??[]){const a=explicit.get(token);if(a)found.add(a);}
    for(const a of unusualIds)if(featuresByActivity.get(a)!.explicitId?.test(corpus))found.add(a);
    return [...found];
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
    for (const activity of candidatesFor(item, features)) {
      scoredPairCount += 1;
      const confidence = Number(score(features, featuresByActivity.get(activity)!, false).value.toFixed(4));
      if (confidence < 0.34) continue;
      // This is the same stable confidence/Activity-ID sort and top five as
      // before. Do not fingerprint or copy source evidence for discarded rows.
      const index = top.findIndex(row => confidence > row.confidence ||
        (confidence === row.confidence && activity.activityId.localeCompare(row.activity.activityId) < 0));
      if (index < 0) {
        if (top.length < 5) top.push({activity, confidence});
      } else {
        top.splice(index, 0, {activity, confidence});
        if (top.length > 5) top.pop();
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
