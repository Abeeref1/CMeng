import { reconcileByKey } from "./core";
import type {
  BoqCanonicalItem,
  ReconciliationResult,
} from "./types";

function boqKey(item: BoqCanonicalItem): string {
  return item.itemNumber.trim();
}

export function reconcileBoqs(
  left: readonly BoqCanonicalItem[],
  right: readonly BoqCanonicalItem[],
  leftSource: string,
  rightSource: string,
): ReconciliationResult {
  return reconcileByKey({
    leftSource,
    rightSource,
    left,
    right,
    key: boqKey,
    fields: [
      {
        name: "description",
        value: (item) => item.description,
        normalizeText: true,
      },
      {
        name: "unit",
        value: (item) => item.unit,
        normalizeText: true,
      },
      {
        name: "quantity",
        value: (item) => item.quantity,
        numericTolerance: 0.000001,
      },
      {
        name: "rate",
        value: (item) => item.rate,
        numericTolerance: 0.000001,
      },
      {
        name: "amount",
        value: (item) => item.amount,
        numericTolerance: 0.02,
      },
    ],
  });
}
