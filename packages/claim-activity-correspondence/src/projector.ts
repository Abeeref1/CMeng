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

function scheduleRefs(
  schedule: CanonicalScheduleModel,
  activity: CanonicalScheduleActivity,
): string[] {
  return [
    "schedule-revision:" + schedule.sourceRevisionId,
    ...activity.sourceRefs.map(
      (ref) => ref.source + ":" + ref.locator,
    ),
  ];
}

function extract(
  narrative: string,
): ClaimActivityCorrespondenceResolution["extraction"] {
  const all = tokens(narrative);
  const set = new Set(all);
  const disciplines = all.filter((token) => DISCIPLINES.has(token));
  const trades = all.filter((token) => TRADES.has(token));

  const locations: string[] = [];
  for (let index = 0; index < all.length; index += 1) {
    const token = all[index]!;
    if (!LOCATION_WORDS.has(token)) continue;
    locations.push(token);
    const next = all[index + 1];
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
      score: Math.min(0.46, nameSimilarity * 0.62),
      detail: "Narrative/activity-name token similarity=" + nameSimilarity.toFixed(4),
    });
  }

  const narrativeNouns = new Set(extraction.nouns);
  const nounCoverage = coverageOf(narrativeNouns, activityTokens);
  if (nounCoverage > 0) {
    signals.push({
      key: "narrative_token",
      score: Math.min(0.22, nounCoverage * 0.28),
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
      score: Math.min(0.22, wbsSimilarity * 0.32),
      detail: "Extracted claim features overlap the WBS hierarchy=" + wbsSimilarity.toFixed(4),
    });
  }

  for (const [key, values, weight] of [
    ["location", extraction.locations, 0.18],
    ["discipline", extraction.disciplines, 0.14],
    ["trade", extraction.trades, 0.18],
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
      score: Math.min(0.30, codeSimilarity * 0.35),
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
  const wbsById = new Map(
    input.schedule.wbs.map((node) => [node.wbsId, node]),
  );
  const explicit = new Set(input.explicitActivityIds ?? []);
  const activityById = new Map(
    input.schedule.activities.map((activity) => [activity.activityId, activity]),
  );

  const validExplicit = [...explicit].filter((activityId) => activityById.has(activityId));
  if (validExplicit.length > 0) {
    const candidates = validExplicit
      .sort()
      .map((activityId) => {
        const activity = activityById.get(activityId)!;
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

  const ranked = input.schedule.activities
    .filter(
      (activity) =>
        activity.activityType !== "wbs_summary" &&
        activity.name !== null,
    )
    .map((activity) => {
      const scored = activitySignals(
        input.narrative,
        extraction,
        activity,
        wbsPath(activity, wbsById),
      );
      return {
        activity,
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
  const deterministicStrong =
    top !== null &&
    (
      exactName &&
      top.prefilterScore >= 0.82 &&
      (margin ?? 0) >= 0.12
    ||
      top.prefilterScore >= 0.90 &&
      deterministicFamilies >= 3 &&
      (margin ?? 0) >= 0.16
    );
  const aiCorroborated =
    top !== null &&
    top.aiScore !== null &&
    top.aiScore >= 0.80 &&
    top.prefilterScore >= 0.52 &&
    top.finalScore >= 0.82 &&
    deterministicFamilies >= 2 &&
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
