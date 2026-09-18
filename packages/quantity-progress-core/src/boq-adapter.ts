import type {
  BoqParseResult,
} from "../../boq-parser/src";
import type {
  BoqCsvResult,
} from "../../boq-csv-parser/src";
import type {
  BoqPdfResult,
} from "../../boq-pdf-parser/src";
import type {
  CanonicalQuantityItem,
  QuantitySourceRef,
} from "./types";

function id(
  sheet: string,
  itemNumber: string | null,
  row: number,
): string {
  return (
    sheet +
    "::" +
    (itemNumber ?? "row-" + row)
  );
}

function ref(
  source: QuantitySourceRef["source"],
  locator: string,
): QuantitySourceRef {
  return { source, locator };
}

function fromLineItem(
  source: QuantitySourceRef["source"],
  item: {
    sheet: string;
    row: number;
    rowKind: string;
    itemNumber: string | null;
    section?: string | null;
    description: string;
    unit: string | null;
    quantity: number | null;
    status: "verified" | "unresolved";
    diagnosticCodes: string[];
  },
): CanonicalQuantityItem[] {
  if (item.rowKind !== "line_item") {
    return [];
  }

  return [
    {
      quantityItemId: id(
        item.sheet,
        item.itemNumber,
        item.row,
      ),
      itemNumber: item.itemNumber,
      section: item.section ?? null,
      description: item.description,
      unit: item.unit,
      contractQuantity:
        item.quantity,
      sourceRefs: [
        ref(
          source,
          item.sheet + ":row:" + item.row,
        ),
      ],
      diagnostics: [
        ...item.diagnosticCodes,
        ...(item.status === "unresolved"
          ? ["QUANTITY_ITEM_SOURCE_UNRESOLVED"]
          : []),
      ],
    },
  ];
}

export function quantityItemsFromBoqXlsx(
  result: BoqParseResult,
): CanonicalQuantityItem[] {
  return result.sheets.flatMap((sheet) =>
    sheet.items.flatMap((item) =>
      fromLineItem(
        "boq_xlsx",
        item,
      ),
    ),
  );
}

export function quantityItemsFromBoqCsv(
  result: BoqCsvResult,
): CanonicalQuantityItem[] {
  return result.items.flatMap((item) =>
    fromLineItem(
      "boq_csv",
      item,
    ),
  );
}

export function quantityItemsFromBoqPdf(
  result: BoqPdfResult,
): CanonicalQuantityItem[] {
  return result.items.flatMap((item) => {
    if (item.rowKind !== "line_item") {
      return [];
    }

    const pdfSheet =
      "PDF:p" +
      item.page +
      ":t" +
      item.table;

    return [
      {
        quantityItemId: id(
          pdfSheet,
          item.itemNumber,
          item.row,
        ),
        itemNumber: item.itemNumber,
        section: item.section,
        description: item.description,
        unit: item.unit,
        contractQuantity:
          item.quantity,
        sourceRefs: [
          ref(
            "boq_pdf",
            "page:" +
              item.page +
              ":table:" +
              item.table +
              ":row:" +
              item.row,
          ),
        ],
        diagnostics: [
          ...item.diagnostics,
          ...(item.status === "unresolved"
            ? [
                "QUANTITY_ITEM_SOURCE_UNRESOLVED",
              ]
            : []),
        ],
      },
    ];
  });
}
