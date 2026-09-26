import type {StoredScheduleRevision} from './project-state-types';
export function normalizeProjectCode(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

export function isProgrammeScheduleRevision(
  item: StoredScheduleRevision,
): boolean {
  if (
    item.revision.model
      .activities.length === 0
  ) {
    return false;
  }

  const filename =
    (
      item.sourceFilename ??
      ""
    ).toLowerCase();

  if (
    /^(?:rel\d*|res\d*|sch\d*|wbs\d*|obs\d*|pdb\d*)[_-]/i.test(
      filename,
    ) ||
    /(?:longest[_ -]?path|baseline[_ -]?to[_ -]?current|schedule[_ -]?comparison|resource[_ -]?register|wbs[_ -]?dictionary)/i.test(
      filename,
    )
  ) {
    return false;
  }

  if (
    item.role === "baseline" ||
    item.role === "update" ||
    item.role ===
      "revised_baseline" ||
    item.role === "recovery"
  ) {
    return true;
  }

  return (
    item.format === "xer" ||
    item.format ===
      "primavera_xml" ||
    item.revision.model
      .dataDateIso !== null ||
    item.revision.model
      .relationships.length > 0
  );
}
