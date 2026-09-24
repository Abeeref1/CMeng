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

function containsExplicitActivityId(
  item: CanonicalQuantityItem,
  activity: CanonicalScheduleActivity,
): boolean {
  const id = activity.activityId.trim();
  if (!id) return false;
  const corpus = [
    item.itemNumber ?? "",
    item.section ?? "",
    item.description,
  ].join(" ");
  const escaped =
    id.replace(
      /[.*+?^$()|[\]\\]/g,
      "\\$&",
    );
  return new RegExp(
    "(^|[^A-Za-z0-9_.-])" +
      escaped +
      "([^A-Za-z0-9_.-]|$)",
    "i",
  ).test(corpus);
}

function score(
  item: CanonicalQuantityItem,
  activity: CanonicalScheduleActivity,
  wbs: string,
): {
  value: number;
  signals: QuantityActivityMappingSignal[];
} {
  const signals: QuantityActivityMappingSignal[] = [];

  if (containsExplicitActivityId(item, activity)) {
    signals.push({
      key: "explicit_activity_id",
      score: 0.99,
      detail: "BOQ evidence contains the exact schedule Activity ID.",
    });
    return { value: 0.99, signals };
  }

  const itemDescription = tokens(item.description);
  const activityName = tokens(activity.name);
  const descriptionSimilarity =
    jaccard(itemDescription, activityName);

  if (descriptionSimilarity > 0) {
    const component = Math.min(
      0.62,
      descriptionSimilarity * 0.72,
    );
    signals.push({
      key: "description",
      score: component,
      detail:
        "BOQ description and activity name token similarity=" +
        descriptionSimilarity.toFixed(4),
    });
  }

  const ni = norm(item.description);
  const na = norm(activity.name);
  if (
    ni.length >= 5 &&
    na.length >= 5 &&
    (ni.includes(na) || na.includes(ni))
  ) {
    signals.push({
      key: "activity_name",
      score: 0.23,
      detail: "One normalized description contains the other.",
    });
  }

  const sectionSimilarity =
    jaccard(
      tokens(item.section),
      tokens(wbs),
    );
  if (sectionSimilarity > 0) {
    const component =
      Math.min(
        0.24,
        sectionSimilarity * 0.30,
      );
    signals.push({
      key: "section",
      score: component,
      detail:
        "BOQ section and WBS hierarchy similarity=" +
        sectionSimilarity.toFixed(4),
    });
  }

  const itemCodes =
    codeTokens(
      [
        item.itemNumber ?? "",
        item.section ?? "",
        item.description,
      ].join(" "),
    );
  const activityCodes =
    codeTokens(
      [
        activity.activityId,
        activity.wbsId ?? "",
        wbs,
      ].join(" "),
    );
  const codeSimilarity =
    jaccard(itemCodes, activityCodes);
  if (codeSimilarity > 0) {
    const component =
      Math.min(
        0.18,
        codeSimilarity * 0.22,
      );
    signals.push({
      key: "code_token",
      score: component,
      detail:
        "Code/location token overlap=" +
        codeSimilarity.toFixed(4),
    });
  }

  const raw =
    signals.reduce(
      (sum, signal) =>
        sum + signal.score,
      0,
    );
  return {
    value: Math.min(0.97, raw),
    signals,
  };
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
  const wbsByActivity=new Map(eligible.map(a=>[a,wbsText(a,wbsById)]));
  type Posting=Map<string,Set<CanonicalScheduleActivity>>;
  const descriptions:Posting=new Map(),sections:Posting=new Map(),codes:Posting=new Map(),nameGrams:Posting=new Map(),namePrefixes:Posting=new Map();
  const explicit=new Map(eligible.filter(a=>/^[A-Za-z0-9_.-]+$/.test(a.activityId)).map(a=>[a.activityId.toUpperCase(),a]));
  const unusualIds=eligible.filter(a=>!/^[A-Za-z0-9_.-]+$/.test(a.activityId));
  const index=(map:Posting,key:string,a:CanonicalScheduleActivity)=>{const list=map.get(key)??new Set();list.add(a);map.set(key,list);};
  const grams=(s:string)=>Array.from({length:Math.max(0,s.length-4)},(_,i)=>s.slice(i,i+5));
  for(const a of eligible){
    for(const token of tokens(a.name))index(descriptions,token,a);
    const wbs=wbsByActivity.get(a)!;
    for(const token of tokens(wbs))index(sections,token,a);
    for(const token of codeTokens([a.activityId,a.wbsId??'',wbs].join(' ')))index(codes,token,a);
    const name=norm(a.name);if(name.length>=5){index(namePrefixes,name.slice(0,5),a);for(const gram of grams(name))index(nameGrams,gram,a);}
  }
  const sectionMatchCache=new Map<string,Set<CanonicalScheduleActivity>>();
  const candidatesFor=(item:CanonicalQuantityItem)=>{
    const found=new Set<CanonicalScheduleActivity>();
    const collect=(map:Posting,keys:Iterable<string>,target=found)=>{for(const key of keys)for(const a of map.get(key)??[])target.add(a);};
    collect(descriptions,tokens(item.description));
    const description=norm(item.description);
    if(description.length>=5){collect(nameGrams,[description.slice(0,5)]);collect(namePrefixes,grams(description));}
    const codeMatches=new Set<CanonicalScheduleActivity>();
    const corpus=[item.itemNumber??'',item.section??'',item.description].join(' ');
    collect(codes,codeTokens(corpus),codeMatches);
    // Section or code evidence alone cannot reach the 0.34 candidate threshold.
    if(codeMatches.size){
      const sectionKey=item.section??'';
      let sectionMatches=sectionMatchCache.get(sectionKey);
      if(!sectionMatches){sectionMatches=new Set();collect(sections,tokens(item.section),sectionMatches);sectionMatchCache.set(sectionKey,sectionMatches);}
      for(const a of codeMatches)if(sectionMatches.has(a))found.add(a);
    }
    for(const token of corpus.toUpperCase().match(/[A-Z0-9_.-]+/g)??[]){const a=explicit.get(token);if(a)found.add(a);}
    for(const a of unusualIds)if(containsExplicitActivityId(item,a))found.add(a);
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

    const ranked =
      candidatesFor(item)
        .flatMap((activity) => {
          const resolved =
            score(
              item,
              activity,
              wbsByActivity.get(activity)!,
            );
          if(Number(resolved.value.toFixed(4))<0.34)return [];
          return [{
            candidateId:
              candidateId(
                item.quantityItemId,
                activity.activityId,
                "candidate",
              ),
            quantityItemId:
              item.quantityItemId,
            activityId:
              activity.activityId,
            confidence:
              Number(
                resolved.value.toFixed(4),
              ),
            method:
              "composite_similarity" as const,
            authority:
              "candidate_scenario" as const,
            ambiguous: false,
            allocatedQuantity: null,
            allocationShare: null,
            signals:
              resolved.signals,
            sourceRefs: [
              ...item.sourceRefs,
            ],
            diagnostics: [],
          }];
        })
        .filter(
          (candidate) =>
            candidate.confidence >= 0.34,
        )
        .sort(
          (a, b) =>
            b.confidence -
            a.confidence ||
            a.activityId.localeCompare(
              b.activityId,
            ),
        )
        .slice(0, 5);

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
