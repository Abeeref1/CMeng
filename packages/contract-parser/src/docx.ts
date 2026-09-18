import JSZip from "jszip";
import type {
  ContractDocxBlock,
  ContractDocxSource,
  ContractTextBlock,
} from "./types";

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function textFromParagraphXml(xml: string): string {
  const normalized = xml
    .replace(/<w:tab\b[^>]*\/>/g, "\t")
    .replace(/<w:br\b[^>]*\/>/g, "\n")
    .replace(/<w:cr\b[^>]*\/>/g, "\n");

  const parts: string[] = [];
  const regex = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(normalized)) !== null) {
    parts.push(decodeXml(match[1] ?? ""));
  }

  return parts.join("");
}

function styleFromParagraphXml(xml: string): string | null {
  const match = xml.match(
    /<w:pStyle\b[^>]*w:val="([^"]+)"[^>]*\/>/,
  );
  return match ? decodeXml(match[1]!) : null;
}

interface XmlRange {
  start: number;
  end: number;
  xml: string;
}

function ranges(
  xml: string,
  regex: RegExp,
): XmlRange[] {
  const out: XmlRange[] = [];
  let match: RegExpExecArray | null;

  while ((match = regex.exec(xml)) !== null) {
    out.push({
      start: match.index,
      end: match.index + match[0].length,
      xml: match[0],
    });
  }

  return out;
}

function containingTable(
  tables: readonly XmlRange[],
  paragraphStart: number,
  paragraphEnd: number,
): { tableNumber: number; range: XmlRange } | null {
  const index = tables.findIndex(
    (table) =>
      paragraphStart >= table.start &&
      paragraphEnd <= table.end,
  );
  return index < 0
    ? null
    : {
        tableNumber: index + 1,
        range: tables[index]!,
      };
}

function tableCoordinates(
  table: XmlRange,
  paragraphStart: number,
): { rowNumber: number; columnNumber: number } {
  const relative = paragraphStart - table.start;
  const before = table.xml.slice(0, relative);

  const rowStarts = [...before.matchAll(/<w:tr\b/g)];
  const rowNumber = Math.max(1, rowStarts.length);
  const lastRowStart =
    rowStarts.length > 0
      ? rowStarts[rowStarts.length - 1]!.index ?? 0
      : 0;
  const inRow = before.slice(lastRowStart);
  const columnNumber = Math.max(
    1,
    [...inRow.matchAll(/<w:tc\b/g)].length,
  );

  return { rowNumber, columnNumber };
}

export async function parseContractDocxSource(
  bytes: Uint8Array,
): Promise<ContractDocxSource> {
  const diagnostics: string[] = [];
  let xml: string;

  try {
    const zip = await JSZip.loadAsync(Buffer.from(bytes));
    const documentXml = zip.file("word/document.xml");
    if (!documentXml) {
      return {
        blocks: [],
        totalBlocks: 0,
        paragraphBlocks: 0,
        tableCellBlocks: 0,
        complete: false,
        diagnostics: ["DOCX_DOCUMENT_XML_MISSING"],
      };
    }
    xml = await documentXml.async("string");
  } catch (error) {
    return {
      blocks: [],
      totalBlocks: 0,
      paragraphBlocks: 0,
      tableCellBlocks: 0,
      complete: false,
      diagnostics: [
        "DOCX_CONTAINER_PARSE_ERROR:" +
          (error instanceof Error
            ? error.message
            : String(error)),
      ],
    };
  }

  const tableRanges = ranges(
    xml,
    /<w:tbl\b[\s\S]*?<\/w:tbl>/g,
  );
  const paragraphRegex = /<w:p\b[\s\S]*?<\/w:p>/g;
  const blocks: ContractDocxBlock[] = [];
  let match: RegExpExecArray | null;
  let blockNumber = 0;

  while ((match = paragraphRegex.exec(xml)) !== null) {
    const text = textFromParagraphXml(match[0]);
    if (!text.trim()) continue;

    blockNumber += 1;
    const table = containingTable(
      tableRanges,
      match.index,
      match.index + match[0].length,
    );
    const coordinates = table
      ? tableCoordinates(table.range, match.index)
      : null;

    blocks.push({
      blockNumber,
      kind: table ? "table_cell" : "paragraph",
      tableNumber: table?.tableNumber ?? null,
      rowNumber: coordinates?.rowNumber ?? null,
      columnNumber: coordinates?.columnNumber ?? null,
      style: styleFromParagraphXml(match[0]),
      text,
    });
  }

  if (blocks.length === 0) {
    diagnostics.push("DOCX_NO_TEXT_BLOCKS_FOUND");
  }

  return {
    blocks,
    totalBlocks: blocks.length,
    paragraphBlocks: blocks.filter(
      (block) => block.kind === "paragraph",
    ).length,
    tableCellBlocks: blocks.filter(
      (block) => block.kind === "table_cell",
    ).length,
    complete:
      blocks.length > 0 && diagnostics.length === 0,
    diagnostics,
  };
}

export function contractBlocksFromDocx(
  docx: ContractDocxSource,
): ContractTextBlock[] {
  return docx.blocks.map((block) => ({
    sourceKind:
      block.kind === "table_cell"
        ? "docx_table_cell"
        : "docx_paragraph",
    sourceIndex: block.blockNumber,
    page: null,
    block: block.blockNumber,
    text: block.text,
  }));
}
