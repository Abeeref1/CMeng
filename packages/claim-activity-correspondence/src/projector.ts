import type {
  DelayActivityCorrespondenceCandidate,
  DelayActivityCorrespondenceSignal,
} from "../../delay-analysis-core/src";
import type {
  CanonicalScheduleActivity,
  CanonicalScheduleModel,
  CanonicalWbsNode,
} from "../../schedule-analysis-core/src";
import type {
  ClaimActivityAiScore,
  ClaimActivityCorrespondenceInput,
  ClaimActivityCorrespondenceResolution,
} from "./types";

const STOP = new Set([
  "the","and","for","with","from","into","onto","over","under","between",
  "work","works","project","programme","schedule","claim","event","delay",
  "notice","eot","extension","time","days","day","impact","affected",
  "due","caused","because","during","through","this","that","these","those",
  "of","to","in","on","at","by","or","a","an","as","per","item","package",
  "late","early","issue","issued","failure","pending","additional","change",
]);

const DISCIPLINES = new Set([
  "civil","structural","architectural","architecture","mechanical","electrical",
  "mep","hvac","plumbing","fire","firefighting","elv","bms","ict","telecom",
  "instrumentation","controls","landscape","geotechnical","marine","rail",
  "utilities","utility","commissioning","procurement","design","facade","façade",
]);

const TRADES = new Set([
  "concrete","rebar","formwork","excavation","backfill","piling","steel",
  "steelwork","masonry","blockwork","drywall","partition","partitions",
  "ceiling","ceilings","flooring","painting","joinery","doors","duct",
  "ductwork","pipe","piping","cable","cabling","switchgear","transformer",
  "generator","chiller","pump","pumps","lighting","containment","testing",
  "commissioning","energisation","energization","waterproofing","roofing",
  "cladding","facade","façade","road","roads","drainage","sewer","stormwater",
]);

const LOCATION_WORDS = new Set([
  "tower","podium","basement","roof","level","floor","zone","area","building",
  "warehouse","plantroom","substation","yard","berth","quay","gate","corridor",
  "room","rooms","block","sector","section","pier","deck","terminal","station",
]);

interface IndexedActivity {
  activity: CanonicalScheduleActivity;
  wbs: string;
  corpus: string;
  tokens: Set<string>;
  codes: Set<string>;
}

interface ClaimActivityScheduleIndex {
  scheduleRevisionId: string;
  wbsById: Map<string, CanonicalWbsNode>;
  activityById: Map<string, CanonicalScheduleActivity>;
  indexed: IndexedActivity[];
  byToken: Map<string, Set<number>>;
  byCode: Map<string, Set<number>>;
}

const scheduleIndexCache =
  new WeakMap<CanonicalScheduleModel, ClaimActivityScheduleIndex>();


function norm(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(value: string | null | undefined): string[] {
  return norm(value)
    .split(" ")
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length >= 2 &&
        !STOP.has(token),
    );
}

function tokenSet(value: string | null | undefined): Set<string> {
  return new Set(tokens(value));
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

function coverageOf(
  wanted: ReadonlySet<string>,
  available: ReadonlySet<string>,
): number {
  if (wanted.size === 0) return 0;
  let matched = 0;
  for (const token of wanted) {
    if (available.has(token)) matched += 1;
  }
  return matched / wanted.size;
}

function codeTokens(value: string): Set<string> {
  return new Set(
    value
      .toUpperCase()
      .match(/[A-Z]{1,10}[-_.]?[A-Z0-9]{0,8}[-_.]?\d{1,8}|\d{2,}/g) ??
      [],
  );
}

function wbsPath(
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

function addIndexValue(
  map: Map<string, Set<number>>,
  key: string,
  index: number,
): void {
  if (!key) return;
  const bucket = map.get(key) ?? new Set<number>();
  bucket.add(index);
  map.set(key, bucket);
}

function scheduleIndex(
  schedule: CanonicalScheduleModel,
): ClaimActivityScheduleIndex {
  const cached = scheduleIndexCache.get(schedule);
  if (cached) return cached;

  const wbsById = new Map(
    (schedule.wbs ?? []).map((node) => [node.wbsId, node]),
  );
  const activityById = new Map(
    (schedule.activities ?? []).map((activity) => [activity.activityId, activity]),
  );
  const byToken = new Map<string, Set<number>>();
  const byCode = new Map<string, Set<number>>();
  const indexed = (schedule.activities ?? [])
    .filter(
      (activity) =>
        activity.activityType !== "wbs_summary" &&
        activity.name !== null,
    )
    .map((activity) => {
      const wbs = wbsPath(activity, wbsById);
      const corpus = [
        activity.activityId,
        activity.nativeId ?? "",
        activity.name ?? "",
        activity.wbsId ?? "",
        wbs,
      ].join(" ");
      return {
        activity,
        wbs,
        corpus,
        tokens: tokenSet(corpus),
        codes: codeTokens(corpus),
      };
    });

  indexed.forEach((item, index) => {
    for (const token of item.tokens) {
      addIndexValue(byToken, token, index);
    }
    for (const code of item.codes) {
      addIndexValue(byCode, code, index);
    }
  });

  const value = {
    scheduleRevisionId: schedule.sourceRevisionId,
    wbsById,
    activityById,
    indexed,
    byToken,
    byCode,
  };
  scheduleIndexCache.set(schedule, value);
  return value;
}

function prefilterIndexedActivities(
  index: ClaimActivityScheduleIndex,
  narrative: string,
  extraction: ClaimActivityCorrespondenceResolution["extraction"],
): IndexedActivity[] {
  const queryTokens = new Set([
    ...tokens(narrative),
    ...extraction.nouns,
    ...extraction.locations.flatMap((value) => tokens(value)),
    ...extraction.disciplines,
    ...extraction.trades,
  ]);
  const queryCodes = new Set(
    extraction.codes.map((value) => value.toUpperCase()),
  );

  const candidateIndexes = new Set<number>();
  for (const token of queryTokens) {
    for (const activityIndex of index.byToken.get(token) ?? []) {
      candidateIndexes.add(activityIndex);
    }
  }
  for (const code of queryCodes) {
    for (const activityIndex of index.byCode.get(code) ?? []) {
      candidateIndexes.add(activityIndex);
    }
  }

  if (candidateIndexes.size === 0) {
    return [];
  }

  return [...candidateIndexes]
    .map((activityIndex) => index.indexed[activityIndex]!)
    .map((item) => {
      let overlap = 0;
      for (const token of queryTokens) {
        if (item.tokens.has(token)) overlap += 1;
      }
      let codeOverlap = 0;
      for (const code of queryCodes) {
        if (item.codes.has(code)) codeOverlap += 1;
      }
      return {
        item,
        cheapScore:
          overlap +
          codeOverlap * 4,
      };
    })
    .sort(
      (a, b) =>
        b.cheapScore - a.cheapScore ||
        a.item.activity.activityId.localeCompare(
          b.item.activity.activityId,
          undefined,
          { numeric: true },
        ),
    )
    .slice(0, 96)
    .map((entry) => entry.item);
}

function scheduleRefs(
  schedule: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
): string[] {
  return [
    "schedule-revision:" + schedule.sourceRevisionId,
    ...(activity.sourceRefs ?? []).map(
      (ref) => ref.source + ":" + ref.locator,
    ),
  ];
}

function extract(
  narrative: string,
): ClaimActivityCorrespondenceResolution["extraction"] {
  const all = tokens(narrative);
  const rawTokens = norm(narrative)
    .split(" ")
    .filter(Boolean);
  const disciplines = all.filter((token) => DISCIPLINES.has(token));
  const trades = all.filter((token) => TRADES.has(token));

  const locations: string[] = [];
  for (let index = 0; index < rawTokens.length; index += 1) {
    const token = rawTokens[index]!;
    if (!LOCATION_WORDS.has(token)) continue;
    locations.push(token);
    const next = rawTokens[index + 1];
    if (next && /^(?:[a-z]?\d+[a-z]?|[a-z])$/i.test(next)) {
      locations.push(token + " " + next);
    }
  }

  const codes = [...codeTokens(narrative)].map((value) => value.toLowerCase());
  const nouns = all.filter(
    (token) =>
      !DISCIPLINES.has(token) &&
      !TRADES.has(token) &&
      !LOCATION_WORDS.has(token) &&
      !codes.includes(token) &&
      token.length >= 3,
  );

  return {
    nouns: [...new Set(nouns)].slice(0, 40),
    locations: [...new Set(locations)].slice(0, 20),
    disciplines: [...new Set(disciplines)].slice(0, 20),
    trades: [...new Set(trades)].slice(0, 20),
    codes: [...new Set(codes)].slice(0, 20),
  };
}

function exactIdInNarrative(
  narrative: string,
  activityId: string,
): boolean {
  const escaped = activityId.replace(/[.*+?^$()|[\]\\]/g, "\\$&");
  return new RegExp(
    "(^|[^A-Za-z0-9_.-])" + escaped + "([^A-Za-z0-9_.-]|$)",
    "i",
  ).test(narrative);
}

function activitySignals(
  narrative: string,
  extraction: ClaimActivityCorrespondenceResolution["extraction"],
  activity: CanonicalScheduleActivity,
  wbs: string,
): {
  score: number;
  signals: DelayActivityCorrespondenceSignal[];
} {
  const signals: DelayActivityCorrespondenceSignal[] = [];
  const narrativeNorm = norm(narrative);
  const activityNameNorm = norm(activity.name);
  const activityCorpus = [
    activity.activityId,
    activity.nativeId ?? "",
    activity.name ?? "",
    activity.wbsId ?? "",
    wbs,
  ].join(" ");
  const activityTokens = tokenSet(activityCorpus);
  const narrativeTokens = tokenSet(narrative);

  if (exactIdInNarrative(narrative, activity.activityId)) {
    signals.push({
      key: "explicit_activity_id",
      score: 1,
      detail: "Claim/event narrative contains the exact schedule Activity ID.",
    });
    return { score: 1, signals };
  }

  if (
    activityNameNorm.length >= 6 &&
    narrativeNorm &&
    (
      narrativeNorm === activityNameNorm ||
      narrativeNorm.includes(activityNameNorm)
    )
  ) {
    signals.push({
      key: "exact_activity_name",
      score: 0.86,
      detail: "Normalized claim/event narrative contains the full activity name.",
    });
  }

  const nameSimilarity =
    jaccard(
      narrativeTokens,
      tokenSet(activity.name),
    );
  if (nameSimilarity > 0) {
    signals.push({
      key: "name_similarity",
      score: Math.min(0.36, nameSimilarity * 0.42),
      detail: "Narrative/activity-name token similarity=" + nameSimilarity.toFixed(4),
    });
  }

  const activityNameTokens =
    tokenSet(activity.name);
  const nameCoverage =
    coverageOf(
      activityNameTokens,
      narrativeTokens,
    );
  if (nameCoverage > 0) {
    // Full or near-full coverage of the activity's own name is strong
    // deterministic evidence even when a correspondence letter wraps the
    // activity wording in additional prose. This strengthens evidence
    // measurement; the downstream 0.78 score, multi-family and margin gates
    // remain unchanged.
    const coverageScore =
      nameCoverage >= 0.8
        ? Math.min(
            0.46,
            nameCoverage * 0.46,
          )
        : nameCoverage >= 0.6
          ? Math.min(
              0.28,
              nameCoverage * 0.34,
            )
          : 0;
    signals.push({
      key: "name_coverage",
      score: coverageScore,
      detail:
        "Activity-name token coverage in governed narrative=" +
        nameCoverage.toFixed(4),
    });
  }

  const narrativeNouns = new Set(extraction.nouns);
  const nounCoverage = coverageOf(narrativeNouns, activityTokens);
  if (nounCoverage > 0) {
    signals.push({
      key: "narrative_token",
      score: Math.min(0.14, nounCoverage * 0.16),
      detail: "Extracted narrative noun coverage=" + nounCoverage.toFixed(4),
    });
  }

  const wbsSimilarity =
    jaccard(
      new Set([
        ...extraction.locations,
        ...extraction.disciplines,
        ...extraction.trades,
        ...extraction.nouns,
      ]),
      tokenSet(wbs),
    );
  if (wbsSimilarity > 0) {
    signals.push({
      key: "wbs_similarity",
      score: Math.min(0.14, wbsSimilarity * 0.16),
      detail: "Extracted claim features overlap the WBS hierarchy=" + wbsSimilarity.toFixed(4),
    });
  }

  const corpusNorm = norm(activityCorpus);
  const specificLocations = extraction.locations.filter(
    (value) => norm(value).includes(" "),
  );
  const genericLocations = extraction.locations.filter(
    (value) => !norm(value).includes(" "),
  );
  if (specificLocations.length > 0 || genericLocations.length > 0) {
    const specificMatched = specificLocations.filter(
      (value) => corpusNorm.includes(norm(value)),
    );
    const genericMatched = genericLocations.filter(
      (value) => corpusNorm.includes(norm(value)),
    );
    const specificCoverage =
      specificLocations.length === 0
        ? 0
        : specificMatched.length / specificLocations.length;
    const genericCoverage =
      genericLocations.length === 0
        ? 0
        : genericMatched.length / genericLocations.length;
    const locationScore =
      Math.min(
        0.22,
        specificCoverage * 0.20 +
          genericCoverage * 0.04,
      );
    if (locationScore > 0) {
      signals.push({
        key: "location",
        score: locationScore,
        detail:
          "Specific location coverage=" +
          specificCoverage.toFixed(4) +
          "; generic location coverage=" +
          genericCoverage.toFixed(4),
      });
    }

    const conflictingSpecific = specificLocations.filter((value) => {
      const normalized = norm(value);
      const [kind] = normalized.split(" ");
      return (
        kind &&
        corpusNorm.includes(kind + " ") &&
        !corpusNorm.includes(normalized)
      );
    });
    if (conflictingSpecific.length > 0) {
      signals.push({
        key: "location",
        score: -0.18,
        detail:
          "Specific location conflict: " +
          conflictingSpecific.join(", "),
      });
    }
  }

  for (const [key, values, weight] of [
    ["discipline", extraction.disciplines, 0.08],
    ["trade", extraction.trades, 0.08],
  ] as const) {
    const valueSet = new Set(values.flatMap((value) => tokens(value)));
    const matched = coverageOf(valueSet, activityTokens);
    if (matched > 0) {
      signals.push({
        key,
        score: Math.min(weight, matched * weight),
        detail: key + " feature coverage=" + matched.toFixed(4),
      });
    }
  }

  const claimCodes = new Set(extraction.codes.map((value) => value.toUpperCase()));
  const activityCodes = codeTokens(activityCorpus);
  const codeSimilarity = jaccard(claimCodes, activityCodes);
  if (codeSimilarity > 0) {
    signals.push({
      key: "code_token",
      score: Math.min(0.25, codeSimilarity * 0.30),
      detail: "Claim/activity code token overlap=" + codeSimilarity.toFixed(4),
    });
  }

  const raw = signals.reduce((sum, signal) => sum + signal.score, 0);
  return {
    score: Math.min(0.98, raw),
    signals,
  };
}

function validateAiScores(
  candidates: readonly {
    activityId: string;
  }[],
  scores: readonly ClaimActivityAiScore[] | null | undefined,
): {
  stage: ClaimActivityCorrespondenceResolution["aiStage"];
  byActivity: Map<string, ClaimActivityAiScore>;
  diagnostics: string[];
} {
  if (scores === undefined || scores === null) {
    return {
      stage: "not_configured",
      byActivity: new Map(),
      diagnostics: [
        "BOUNDED_AI_SCORER_NOT_CONFIGURED_DETERMINISTIC_GATES_REMAIN_ACTIVE",
      ],
    };
  }

  const allowed = new Set(candidates.map((candidate) => candidate.activityId));
  const byActivity = new Map<string, ClaimActivityAiScore>();
  const diagnostics: string[] = [];

  for (const score of scores) {
    if (
      !allowed.has(score.activityId) ||
      !Number.isFinite(score.score) ||
      score.score < 0 ||
      score.score > 1
    ) {
      diagnostics.push(
        "INVALID_AI_ACTIVITY_SCORE:" + score.activityId,
      );
      continue;
    }
    if (byActivity.has(score.activityId)) {
      diagnostics.push(
        "DUPLICATE_AI_ACTIVITY_SCORE:" + score.activityId,
      );
      continue;
    }
    byActivity.set(score.activityId, score);
  }

  return {
    stage:
      diagnostics.length > 0
        ? "invalid_scores"
        : byActivity.size > 0
          ? "scored"
          : "not_required",
    byActivity,
    diagnostics,
  };
}

function signalFamilyCount(
  signals: readonly DelayActivityCorrespondenceSignal[],
): number {
  const families = new Set(
    signals
      .filter((signal) => signal.score > 0)
      .map((signal) => signal.key),
  );
  return families.size;
}

export function resolveClaimActivityCorrespondence(
  input: ClaimActivityCorrespondenceInput,
): ClaimActivityCorrespondenceResolution {
  const maxCandidates = Math.min(
    12,
    Math.max(1, input.maxCandidates ?? 8),
  );
  const extraction = extract(input.narrative);
  const index = scheduleIndex(input.schedule);
  const claimSignalCount =
    new Set([
      ...tokens(input.narrative),
      ...extraction.codes,
    ]).size;
  const explicit = new Set(input.explicitActivityIds ?? []);

  const validExplicit = [...explicit].filter(
    (activityId) => index.activityById.has(activityId),
  );
  if (validExplicit.length > 0) {
    const candidates = validExplicit
      .sort()
      .map((activityId) => {
        const activity = index.activityById.get(activityId)!;
        return {
          activityId,
          activityName: activity.name,
          wbsId: activity.wbsId,
          prefilterScore: 1,
          aiScore: null,
          finalScore: 1,
          marginToNext: null,
          classification: "accepted" as const,
          authority: "governed_explicit" as const,
          signals: [{
            key: "explicit_activity_id" as const,
            score: 1,
            detail: "Activity link was explicitly established by governed source evidence.",
          }],
          activitySourceRefs: scheduleRefs(input.schedule, activity),
          diagnostics: [],
        };
      });

    return {
      resolverVersion: "claim-activity-correspondence-v1",
      extraction,
      activityPoolCount: index.indexed.length,
      claimSignalCount,
      retrievedCandidateCount: candidates.length,
      preFilterCandidateCount: candidates.length,
      boundedCandidateCount: candidates.length,
      aiStage: "not_required",
      classification: "accepted_explicit",
      acceptedActivityIds: validExplicit.sort(),
      candidateActivityIds: [],
      candidates,
      scheduleRevisionId: input.schedule.sourceRevisionId,
      claimEvidenceRefs: [...input.claimEvidenceRefs],
      diagnostics: [],
    };
  }

  // Retrieval is scored-OR: any shared Unicode token or code may admit an
  // activity to the cheap candidate stage. Confidence/ambiguity gates below
  // are unchanged and continue to fail closed.
  const retrieved = prefilterIndexedActivities(
    index,
    input.narrative,
    extraction,
  );
  const ranked = retrieved
    .map((indexedActivity) => {
      const scored = activitySignals(
        input.narrative,
        extraction,
        indexedActivity.activity,
        indexedActivity.wbs,
      );
      return {
        activity: indexedActivity.activity,
        prefilterScore: Number(scored.score.toFixed(4)),
        signals: scored.signals,
      };
    })
    .filter((item) => item.prefilterScore >= 0.18)
    .sort(
      (a, b) =>
        b.prefilterScore - a.prefilterScore ||
        a.activity.activityId.localeCompare(
          b.activity.activityId,
          undefined,
          { numeric: true },
        ),
    );

  const bounded = ranked.slice(0, maxCandidates);
  const ai = validateAiScores(
    bounded.map((item) => ({ activityId: item.activity.activityId })),
    input.aiScores,
  );

  const scoredCandidates = bounded
    .map((item) => {
      const aiScore = ai.byActivity.get(item.activity.activityId)?.score ?? null;
      const finalScore =
        aiScore === null
          ? item.prefilterScore
          : Number(
              (
                item.prefilterScore * 0.62 +
                aiScore * 0.38
              ).toFixed(4),
            );
      return {
        activity: item.activity,
        prefilterScore: item.prefilterScore,
        aiScore,
        finalScore,
        signals: item.signals,
      };
    })
    .sort(
      (a, b) =>
        b.finalScore - a.finalScore ||
        b.prefilterScore - a.prefilterScore ||
        a.activity.activityId.localeCompare(
          b.activity.activityId,
          undefined,
          { numeric: true },
        ),
    );

  const top = scoredCandidates[0] ?? null;
  const second = scoredCandidates[1] ?? null;
  const margin =
    top
      ? Number(
          (
            top.finalScore -
            (second?.finalScore ?? 0)
          ).toFixed(4),
        )
      : null;
  const deterministicFamilies =
    top ? signalFamilyCount(top.signals) : 0;

  const exactName =
    top?.signals.some((signal) => signal.key === "exact_activity_name") ?? false;
  const exactNarrativeActivityId =
    top?.signals.some((signal) => signal.key === "explicit_activity_id") ?? false;
  const deterministicStrong =
    top !== null &&
    (
      exactNarrativeActivityId
    ||
      (
        exactName &&
        top.prefilterScore >= 0.82 &&
        (margin ?? 0) >= 0.12
      )
    ||
      (
        top.prefilterScore >= 0.78 &&
        deterministicFamilies >= 4 &&
        (margin ?? 0) >= 0.16
      )
    );
  const aiCorroborated =
    top !== null &&
    top.aiScore !== null &&
    top.aiScore >= 0.80 &&
    top.prefilterScore >= 0.45 &&
    top.finalScore >= 0.72 &&
    deterministicFamilies >= 3 &&
    (margin ?? 0) >= 0.12 &&
    ai.stage === "scored";

  const ambiguous =
    top !== null &&
    second !== null &&
    (
      (margin ?? 0) < 0.10 ||
      (
        top.finalScore >= 0.65 &&
        second.finalScore >= 0.65 &&
        (margin ?? 0) < 0.16
      )
    );

  const accepted =
    !ambiguous && (deterministicStrong || aiCorroborated);

  const candidates: DelayActivityCorrespondenceCandidate[] =
    scoredCandidates.map((candidate, index) => {
      const isTop = index === 0;
      const candidateMargin =
        isTop
          ? margin
          : Number(
              (
                candidate.finalScore -
                (scoredCandidates[index + 1]?.finalScore ?? 0)
              ).toFixed(4),
            );
      const classification:
        DelayActivityCorrespondenceCandidate["classification"] =
        isTop && accepted
          ? "accepted"
          : ambiguous && candidate.finalScore >= 0.65
            ? "ambiguous"
            : candidate.finalScore >= 0.55
              ? "candidate"
              : "rejected";

      return {
        activityId: candidate.activity.activityId,
        activityName: candidate.activity.name,
        wbsId: candidate.activity.wbsId,
        prefilterScore: candidate.prefilterScore,
        aiScore: candidate.aiScore,
        finalScore: candidate.finalScore,
        marginToNext: candidateMargin,
        classification,
        authority:
          isTop && deterministicStrong
            ? "deterministically_confirmed"
            : isTop && aiCorroborated
              ? "ai_corroborated_candidate"
              : classification === "rejected"
                ? "unresolved"
                : "candidate_only",
        signals: candidate.signals,
        activitySourceRefs: scheduleRefs(input.schedule, candidate.activity),
        diagnostics: [
          ...(candidate.aiScore !== null
            ? [
                "BOUNDED_AI_SCORE_USED_WITH_DETERMINISTIC_PREFILTER",
              ]
            : []),
          ...(classification === "ambiguous"
            ? [
                "ACTIVITY_CORRESPONDENCE_FAIL_CLOSED_AMBIGUOUS",
              ]
            : []),
        ],
      };
    });

  const classification:
    ClaimActivityCorrespondenceResolution["classification"] =
    accepted
      ? deterministicStrong
        ? "accepted_deterministic"
        : "accepted_ai_corroborated"
      : ambiguous
        ? "ambiguous"
        : top && top.finalScore >= 0.55
          ? "candidate"
          : "unresolved";

  return {
    resolverVersion: "claim-activity-correspondence-v1",
    extraction,
    activityPoolCount: index.indexed.length,
    claimSignalCount,
    retrievedCandidateCount: retrieved.length,
    preFilterCandidateCount: ranked.length,
    boundedCandidateCount: bounded.length,
    aiStage: ai.stage,
    classification,
    acceptedActivityIds:
      accepted && top
        ? [top.activity.activityId]
        : [],
    candidateActivityIds:
      candidates
        .filter((candidate) =>
          candidate.classification === "candidate" ||
          candidate.classification === "ambiguous"
        )
        .map((candidate) => candidate.activityId),
    candidates,
    scheduleRevisionId: input.schedule.sourceRevisionId,
    claimEvidenceRefs: [...input.claimEvidenceRefs],
    diagnostics: [
      ...ai.diagnostics,
      ...(ranked.length > maxCandidates
        ? [
            "ACTIVITY_CORRESPONDENCE_PREFILTER_BOUNDED_TO_" +
              maxCandidates,
          ]
        : []),
      ...(accepted
        ? [
            "ACTIVITY_CORRESPONDENCE_ESTABLISHED_NOT_CAUSATION_OR_ENTITLEMENT",
          ]
        : [
            "ACTIVITY_CORRESPONDENCE_NOT_ESTABLISHED_FAIL_CLOSED",
          ]),
    ],
  };
}
