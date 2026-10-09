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
import {admissibleBoqQuantity} from './boq-quantity';
import {BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED} from '../../boq-parser/src/numeric-evidence';

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
      contractQuantity: admissibleBoqQuantity(item.quantity,item.diagnosticCodes).contractQuantity,
      sourceRefs: [
        ref(
          source,
          item.sheet + ":row:" + item.row,
        ),
      ],
      diagnostics: [
        ...admissibleBoqQuantity(item.quantity,item.diagnosticCodes).diagnostics,
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
    const diagnostics=[...item.diagnostics,...(result.pageRead?.pages.some(page=>page.pageNumber===item.page&&page.method==='native')?[]:[BOQ_NUMERIC_SOURCE_CONFIRMATION_REQUIRED])];

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
        contractQuantity: admissibleBoqQuantity(item.quantity,diagnostics).contractQuantity,
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
          ...admissibleBoqQuantity(item.quantity,diagnostics).diagnostics,
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
