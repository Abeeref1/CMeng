import {
  stableFingerprint,
} from "../../analysis-runtime/src";
import type {
  AssertionValueType,
  DocumentAssertion,
} from "./types";

interface AssertionRule {
  metric: string;
  label: string;
  valueType: AssertionValueType;
  unit: string | null;
  patterns: RegExp[];
  parse: (raw: string) =>
    number | string | null;
  confidence: number;
}

function numberValue(
  raw: string,
): number | null {
  const cleaned =
    raw
      .replace(/,/g, "")
      .replace(/%/g, "")
      .trim();
  const value =
    Number(cleaned);
  return Number.isFinite(value)
    ? value
    : null;
}

function dateValue(
  raw: string,
): string | null {
  const value =
    raw.trim();
  const parsed =
    Date.parse(value);
  return Number.isFinite(parsed)
    ? new Date(parsed)
        .toISOString()
        .slice(0, 10)
    : null;
}

const RULES: AssertionRule[] = [
  {
    metric: "activity_count",
    label: "Activity count",
    valueType: "count",
    unit: "activities",
    patterns: [
      /(?:^|\n)\s*(?:total\s+)?activit(?:y|ies)\s*(?:count)?\s*[:=]?\s*([\d,]+)/gi,
      /(?:^|\n)\s*([\d,]+)\s+activities\b/gi,
    ],
    parse: numberValue,
    confidence: 0.92,
  },
  {
    metric: "relationship_count",
    label: "Relationship count",
    valueType: "count",
    unit: "relationships",
    patterns: [
      /(?:^|\n)\s*(?:total\s+)?relationships?\s*(?:count)?\s*[:=]?\s*([\d,]+)/gi,
      /(?:^|\n)\s*([\d,]+)\s+relationships\b/gi,
    ],
    parse: numberValue,
    confidence: 0.9,
  },
  {
    metric: "critical_count",
    label: "Critical activity count",
    valueType: "count",
    unit: "activities",
    patterns: [
      /(?:^|\n)\s*critical\s+activit(?:y|ies)\s*(?:count)?\s*[:=]?\s*([\d,]+)/gi,
      /(?:^|\n)\s*([\d,]+)\s+critical\s+activities\b/gi,
    ],
    parse: numberValue,
    confidence: 0.92,
  },
  {
    metric: "near_critical_count",
    label: "Near-critical activity count",
    valueType: "count",
    unit: "activities",
    patterns: [
      /(?:^|\n)\s*near[- ]critical\s+activit(?:y|ies)\s*(?:count)?\s*[:=]?\s*([\d,]+)/gi,
      /(?:^|\n)\s*([\d,]+)\s+near[- ]critical\s+activities\b/gi,
    ],
    parse: numberValue,
    confidence: 0.92,
  },
  {
    metric: "negative_float_count",
    label: "Negative-float activity count",
    valueType: "count",
    unit: "activities",
    patterns: [
      /(?:^|\n)\s*negative\s+float\s*(?:activities|count)?\s*[:=]?\s*([\d,]+)/gi,
      /(?:^|\n)\s*([\d,]+)\s+activities\s+with\s+negative\s+float\b/gi,
    ],
    parse: numberValue,
    confidence: 0.9,
  },
  {
    metric: "progress_percent",
    label: "Reported progress",
    valueType: "percent",
    unit: "%",
    patterns: [
      /(?:^|\n)\s*(?:(?:overall|actual|project|reported|physical)\s+)?progress\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/gi,
      /(?:^|\n)\s*progress\s+achieved\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/gi,
    ],
    parse: numberValue,
    confidence: 0.9,
  },
  {
    metric: "certified_progress_percent",
    label: "Certified progress",
    valueType: "percent",
    unit: "%",
    patterns: [
      /certified\s+progress\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/gi,
    ],
    parse: numberValue,
    confidence: 0.96,
  },
  {
    metric: "planned_progress_percent",
    label: "Planned progress",
    valueType: "percent",
    unit: "%",
    patterns: [
      /planned\s+progress\s*[:=]?\s*(\d+(?:\.\d+)?)\s*%/gi,
    ],
    parse: numberValue,
    confidence: 0.92,
  },
  {
    metric: "completion_date",
    label: "Completion date",
    valueType: "date",
    unit: null,
    patterns: [
      /(?:project\s+)?completion(?:\s+date)?\s*[:=]?\s*([0-9]{1,2}[\/-][A-Za-z]{3,9}[\/-][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/gi,
      /forecast\s+completion\s*[:=]?\s*([0-9]{1,2}[\/-][A-Za-z]{3,9}[\/-][0-9]{2,4}|[0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}[\/-][0-9]{1,2}[\/-][0-9]{2,4})/gi,
    ],
    parse: dateValue,
    confidence: 0.94,
  },
  {
    metric: "manpower_average",
    label: "Average manpower",
    valueType: "number",
    unit: "people",
    patterns: [
      /(?:average|avg\.?|planned)\s+(?:manpower|headcount|workforce)\s*[:=]?\s*([\d,]+)/gi,
      /(?:manpower|headcount|workforce)\s+(?:average|avg\.?)\s*[:=]?\s*([\d,]+)/gi,
    ],
    parse: numberValue,
    confidence: 0.9,
  },
  {
    metric: "manpower_peak",
    label: "Peak manpower",
    valueType: "number",
    unit: "people",
    patterns: [
      /peak\s+(?:manpower|headcount|workforce)\s*[:=]?\s*([\d,]+)/gi,
      /(?:manpower|headcount|workforce)\s+peak\s*[:=]?\s*([\d,]+)/gi,
    ],
    parse: numberValue,
    confidence: 0.92,
  },
  {
    metric: "planned_manhours",
    label: "Planned man-hours",
    valueType: "number",
    unit: "hours",
    patterns: [
      /planned\s+(?:man[- ]?hours?|labor\s+hours?)\s*[:=]?\s*([\d,.]+)/gi,
    ],
    parse: numberValue,
    confidence: 0.92,
  },
  {
    metric: "actual_manhours",
    label: "Actual man-hours",
    valueType: "number",
    unit: "hours",
    patterns: [
      /actual\s+(?:man[- ]?hours?|labor\s+hours?)\s*[:=]?\s*([\d,.]+)/gi,
    ],
    parse: numberValue,
    confidence: 0.92,
  },
  {
    metric: "productivity",
    label: "Productivity",
    valueType: "number",
    unit: null,
    patterns: [
      /productivity\s*[:=]?\s*([\d,.]+)/gi,
      /production\s+rate\s*[:=]?\s*([\d,.]+)/gi,
    ],
    parse: numberValue,
    confidence: 0.82,
  },
  {
    metric: "claimed_eot_days",
    label: "Claimed EOT",
    valueType: "days",
    unit: "days",
    patterns: [
      /(?:claimed|requested|submitted)\s+(?:eot|extension\s+of\s+time)\s*[:=]?\s*([\d,.]+)\s*(?:days?)?/gi,
      /(?:eot|extension\s+of\s+time)\s+(?:claimed|requested)\s*[:=]?\s*([\d,.]+)\s*(?:days?)?/gi,
    ],
    parse: numberValue,
    confidence: 0.94,
  },
  {
    metric: "claimed_delay_days",
    label: "Claimed delay",
    valueType: "days",
    unit: "days",
    patterns: [
      /(?:claimed|reported)\s+delay\s*[:=]?\s*([\d,.]+)\s*(?:days?)?/gi,
      /delay\s+(?:claimed|reported)\s*[:=]?\s*([\d,.]+)\s*(?:days?)?/gi,
    ],
    parse: numberValue,
    confidence: 0.9,
  },
  {
    metric: "milestone_count",
    label: "Milestone count",
    valueType: "count",
    unit: "milestones",
    patterns: [
      /(?:total\s+)?milestones?\s*(?:count)?\s*[:=]?\s*([\d,]+)/gi,
    ],
    parse: numberValue,
    confidence: 0.88,
  },
  {
    metric: "late_milestone_count",
    label: "Late milestone count",
    valueType: "count",
    unit: "milestones",
    patterns: [
      /late\s+milestones?\s*(?:count)?\s*[:=]?\s*([\d,]+)/gi,
      /([\d,]+)\s+late\s+milestones\b/gi,
    ],
    parse: numberValue,
    confidence: 0.9,
  },
  {
    metric: "lookahead_activity_count",
    label: "Look-ahead activity count",
    valueType: "count",
    unit: "activities",
    patterns: [
      /look[- ]?ahead\s+(?:activities|activity\s+count)\s*[:=]?\s*([\d,]+)/gi,
    ],
    parse: numberValue,
    confidence: 0.88,
  },
];

function snippet(
  text: string,
  start: number,
  end: number,
): string {
  return text
    .slice(
      Math.max(0, start - 80),
      Math.min(
        text.length,
        end + 120,
      ),
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 360);
}

export function extractDocumentAssertions(
  text: string,
  sourceRef: string,
): DocumentAssertion[] {
  const assertions:
    DocumentAssertion[] = [];

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      pattern.lastIndex = 0;
      let match:
        RegExpExecArray | null;

      while (
        (
          match =
            pattern.exec(text)
        ) !== null
      ) {
        const parsed =
          rule.parse(
            match[1] ?? "",
          );
        if (
          parsed === null
        ) {
          continue;
        }

        assertions.push({
          assertionId:
            "assert-" +
            stableFingerprint({
              sourceRef,
              metric:
                rule.metric,
              value: parsed,
              offset:
                match.index,
            }).slice(0, 20),
          metric:
            rule.metric,
          label:
            rule.label,
          value: parsed,
          valueType:
            rule.valueType,
          unit:
            rule.unit,
          sourceRef,
          sourceText:
            snippet(
              text,
              match.index,
              match.index +
                match[0].length,
            ),
          confidence:
            rule.confidence,
        });
      }
    }
  }

  return assertions;
}
