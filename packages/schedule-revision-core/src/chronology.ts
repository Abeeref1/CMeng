import type {
  ScheduleRevision,
} from "./types";

function dateKey(
  revision: ScheduleRevision,
): string | null {
  return (
    revision.model.dataDateIso ??
    revision.effectiveAt ??
    null
  );
}

export function compareScheduleRevisionChronology(
  a: ScheduleRevision,
  b: ScheduleRevision,
): number {
  const ad = dateKey(a);
  const bd = dateKey(b);

  if (ad !== null && bd !== null) {
    const byDate =
      ad.localeCompare(bd);
    if (byDate !== 0) {
      return byDate;
    }
  } else if (ad !== null) {
    return -1;
  } else if (bd !== null) {
    return 1;
  }

  return (
    a.sequence -
      b.sequence ||
    a.revisionId.localeCompare(
      b.revisionId,
    )
  );
}

export function orderScheduleRevisionsChronologically(
  revisions:
    readonly ScheduleRevision[],
): ScheduleRevision[] {
  return [...revisions].sort(
    compareScheduleRevisionChronology,
  );
}
