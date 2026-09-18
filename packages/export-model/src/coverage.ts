import type {
  ExportCoverageReceipt,
  InteractiveSliceMetadata,
} from "./types";

export function validateExportCoverage(
  receipt: ExportCoverageReceipt,
): void {
  for (const [name, value] of Object.entries({
    sourcePopulationCount:
      receipt.sourcePopulationCount,
    eligiblePopulationCount:
      receipt.eligiblePopulationCount,
    exportedPopulationCount:
      receipt.exportedPopulationCount,
    omittedPopulationCount:
      receipt.omittedPopulationCount,
    unresolvedPopulationCount:
      receipt.unresolvedPopulationCount,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(
        name + " must be a non-negative safe integer",
      );
    }
  }

  if (
    receipt.exportedPopulationCount +
      receipt.omittedPopulationCount !==
    receipt.eligiblePopulationCount
  ) {
    throw new Error(
      "Exported + omitted must equal eligible population",
    );
  }
}

export function exportCoveragePercent(
  receipt: ExportCoverageReceipt,
): number | null {
  validateExportCoverage(receipt);
  if (receipt.eligiblePopulationCount === 0) {
    return null;
  }
  return Number(
    (
      (receipt.exportedPopulationCount /
        receipt.eligiblePopulationCount) *
      100
    ).toFixed(4),
  );
}

export function interactiveSliceCannotDescribeExport(
  _slice: InteractiveSliceMetadata,
): false {
  return false;
}
