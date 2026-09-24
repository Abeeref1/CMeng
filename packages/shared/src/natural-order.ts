/** Reuse the collator. Constructing it for every comparison made large tied
 * source populations spend seconds sorting, without changing any result. */
const naturalCollator = new Intl.Collator(undefined, { numeric: true });
export const naturalCompare = naturalCollator.compare;
