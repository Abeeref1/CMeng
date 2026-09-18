import type {
  ReconciliationMismatch,
  ReconciliationResult,
} from "./types";

export interface ReconcileOptions<T> {
  leftSource: string;
  rightSource: string;
  left: readonly T[];
  right: readonly T[];
  key: (item: T) => string;
  fields: Array<{
    name: string;
    value: (item: T) => string | number | null;
    numericTolerance?: number;
    normalizeText?: boolean;
  }>;
}

function duplicates<T>(
  items: readonly T[],
  keyOf: (item: T) => string,
): string[] {
  const seen = new Set<string>();
  const duplicate = new Set<string>();
  for (const item of items) {
    const key = keyOf(item);
    if (seen.has(key)) duplicate.add(key);
    else seen.add(key);
  }
  return [...duplicate].sort();
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function equalValue(
  left: string | number | null,
  right: string | number | null,
  numericTolerance: number | undefined,
  useTextNormalization: boolean | undefined,
): boolean {
  if (left === null || right === null) return left === right;

  if (typeof left === "number" && typeof right === "number") {
    const tolerance = numericTolerance ?? 0;
    return Math.abs(left - right) <= tolerance;
  }

  if (typeof left !== typeof right) return false;

  if (
    typeof left === "string" &&
    typeof right === "string" &&
    useTextNormalization
  ) {
    return normalizeText(left) === normalizeText(right);
  }

  return left === right;
}

export function reconcileByKey<T>(
  options: ReconcileOptions<T>,
): ReconciliationResult {
  const duplicateLeftKeys = duplicates(options.left, options.key);
  const duplicateRightKeys = duplicates(options.right, options.key);
  const diagnostics: string[] = [];

  if (duplicateLeftKeys.length > 0) {
    diagnostics.push(
      "LEFT_DUPLICATE_KEYS:" + duplicateLeftKeys.join(","),
    );
  }
  if (duplicateRightKeys.length > 0) {
    diagnostics.push(
      "RIGHT_DUPLICATE_KEYS:" + duplicateRightKeys.join(","),
    );
  }

  const leftMap = new Map<string, T>();
  const rightMap = new Map<string, T>();

  for (const item of options.left) {
    const key = options.key(item);
    if (!leftMap.has(key)) leftMap.set(key, item);
  }
  for (const item of options.right) {
    const key = options.key(item);
    if (!rightMap.has(key)) rightMap.set(key, item);
  }

  const leftOnlyKeys = [...leftMap.keys()]
    .filter((key) => !rightMap.has(key))
    .sort();
  const rightOnlyKeys = [...rightMap.keys()]
    .filter((key) => !leftMap.has(key))
    .sort();

  const sharedKeys = [...leftMap.keys()]
    .filter((key) => rightMap.has(key))
    .sort();

  const mismatches: ReconciliationMismatch[] = [];

  for (const key of sharedKeys) {
    const left = leftMap.get(key)!;
    const right = rightMap.get(key)!;

    for (const field of options.fields) {
      const leftValue = field.value(left);
      const rightValue = field.value(right);

      if (
        !equalValue(
          leftValue,
          rightValue,
          field.numericTolerance,
          field.normalizeText,
        )
      ) {
        mismatches.push({
          key,
          field: field.name,
          left: leftValue,
          right: rightValue,
        });
      }
    }
  }

  const authoritative =
    duplicateLeftKeys.length === 0 &&
    duplicateRightKeys.length === 0;

  return {
    leftSource: options.leftSource,
    rightSource: options.rightSource,
    leftCount: leftMap.size,
    rightCount: rightMap.size,
    matchedCount: sharedKeys.length,
    leftOnlyKeys,
    rightOnlyKeys,
    duplicateLeftKeys,
    duplicateRightKeys,
    mismatches,
    populationCoveragePercent:
      Math.max(leftMap.size, rightMap.size) === 0
        ? null
        : Number(
            (
              (sharedKeys.length /
                Math.max(leftMap.size, rightMap.size)) *
              100
            ).toFixed(4),
          ),
    completeMatch:
      authoritative &&
      leftOnlyKeys.length === 0 &&
      rightOnlyKeys.length === 0 &&
      mismatches.length === 0,
    authoritative,
    diagnostics,
  };
}
