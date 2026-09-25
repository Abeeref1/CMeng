/** A predicate must explicitly distinguish false from an unresolved result.
 * Known matches remain available as a labelled subset; they are never the total
 * while any member is unresolved. An absent population is not an empty one.
 */
export function aggregateCount<T>(rows: readonly T[] | null | undefined, predicate: (row: T) => boolean | null | undefined) {
  if (rows == null) return {value: null, knownCount: null, unresolvedCount: null, populationCount: null};
  let knownCount = 0, unresolvedCount = 0;
  for (const row of rows) {
    const result = predicate(row);
    if (result === true) knownCount++;
    else if (result !== false) unresolvedCount++;
  }
  return {value: unresolvedCount ? null : knownCount, knownCount, unresolvedCount, populationCount: rows.length};
}

/** A complete measured sum. No observations, or one missing observation, cannot
 * establish a total. Explicit measured zeroes are retained.
 */
export function completeSum(values: readonly (number | null | undefined)[]): number | null {
  if (!values.length || values.some(value => typeof value !== 'number' || !Number.isFinite(value))) return null;
  return Number(values.reduce<number>((sum, value) => sum + value!, 0).toFixed(6));
}
