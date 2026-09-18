import { detectContractHeading } from "./numbering";
import type {
  ContractDocumentResult,
  ContractSection,
  ContractSourceSpan,
  ContractUnclassifiedLine,
} from "./types";
import type { PdfDocumentResult } from "../../pdf-document-parser/src";

interface LineRecord {
  page: number;
  start: number;
  end: number;
  text: string;
}

function pageLines(
  page: number,
  text: string,
): LineRecord[] {
  const lines: LineRecord[] = [];
  let cursor = 0;

  for (const rawLine of text.split(/\r\n|\n|\r/)) {
    const start = cursor;
    const end = start + rawLine.length;
    lines.push({
      page,
      start,
      end,
      text: rawLine,
    });
    cursor = end + 1;
  }

  return lines;
}

function normalizedHeading(
  value: string | null,
): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function makePreamble(): ContractSection {
  return {
    sectionKey: "preamble",
    kind: "preamble",
    identifier: null,
    heading: null,
    text: "",
    startPage: 1,
    endPage: 1,
    sourceSpans: [],
    status: "verified",
    diagnostics: [],
  };
}

function appendLine(
  section: ContractSection,
  line: LineRecord,
): void {
  if (section.sourceSpans.length === 0) {
    section.startPage = line.page;
  }
  section.endPage = line.page;

  const span: ContractSourceSpan = {
    page: line.page,
    start: line.start,
    end: line.end,
    text: line.text,
  };
  section.sourceSpans.push(span);
  section.text +=
    (section.text ? "\n" : "") + line.text;
}

function duplicateKeys(
  sections: readonly ContractSection[],
): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const section of sections) {
    if (!section.identifier) continue;
    const key =
      section.kind + ":" + section.identifier.toLowerCase();
    if (seen.has(key)) duplicates.add(key);
    else seen.add(key);
  }

  return [...duplicates].sort();
}

export function segmentContractPages(
  pdf: PdfDocumentResult,
): ContractDocumentResult {
  const sections: ContractSection[] = [];
  const diagnostics: string[] = [];
  const unclassifiedLines: ContractUnclassifiedLine[] = [];

  let current = makePreamble();
  sections.push(current);

  for (const page of pdf.pages) {
    if (page.method === "failed") {
      diagnostics.push(
        "CONTRACT_PAGE_UNREADABLE:" + page.pageNumber,
      );
      continue;
    }

    let firstMeaningfulSeen = false;

    for (const line of pageLines(page.pageNumber, page.text)) {
      if (!line.text.trim()) {
        appendLine(current, line);
        continue;
      }

      const isFirstMeaningfulLine = !firstMeaningfulSeen;
      firstMeaningfulSeen = true;
      const heading = detectContractHeading(line.text);

      if (
        heading &&
        isFirstMeaningfulLine &&
        current.identifier !== null &&
        current.kind === heading.kind &&
        current.identifier.toLowerCase() ===
          heading.identifier.toLowerCase() &&
        normalizedHeading(current.heading) ===
          normalizedHeading(heading.heading)
      ) {
        // A clause heading repeated as the first meaningful line of a
        // later page is treated as a running header, not a new clause.
        appendLine(current, line);
        if (
          !current.diagnostics.includes(
            "CONTRACT_REPEATED_RUNNING_HEADING",
          )
        ) {
          current.diagnostics.push(
            "CONTRACT_REPEATED_RUNNING_HEADING",
          );
        }
        continue;
      }

      if (heading) {
        current = {
          sectionKey:
            heading.kind + ":" + heading.identifier,
          kind: heading.kind,
          identifier: heading.identifier,
          heading: heading.heading,
          text: "",
          startPage: line.page,
          endPage: line.page,
          sourceSpans: [],
          status: "verified",
          diagnostics: [],
        };
        sections.push(current);
        appendLine(current, line);
        continue;
      }

      appendLine(current, line);
    }
  }

  const duplicateIdentifiers = duplicateKeys(sections);

  for (const duplicate of duplicateIdentifiers) {
    diagnostics.push(
      "CONTRACT_DUPLICATE_SECTION_IDENTIFIER:" + duplicate,
    );
    for (const section of sections) {
      const key =
        section.identifier === null
          ? ""
          : section.kind +
            ":" +
            section.identifier.toLowerCase();
      if (key === duplicate) {
        section.status = "unresolved";
        section.diagnostics.push(
          "CONTRACT_DUPLICATE_SECTION_IDENTIFIER",
        );
      }
    }
  }

  const meaningfulText = pdf.pages.reduce(
    (sum, page) =>
      sum +
      [...page.text].filter((char) =>
        /[\p{L}\p{N}]/u.test(char),
      ).length,
    0,
  );

  const representedText = sections.reduce(
    (sum, section) =>
      sum +
      [...section.text].filter((char) =>
        /[\p{L}\p{N}]/u.test(char),
      ).length,
    0,
  );

  if (meaningfulText !== representedText) {
    diagnostics.push(
      "CONTRACT_TEXT_COVERAGE_MISMATCH:" +
        representedText +
        "/" +
        meaningfulText,
    );
  }

  const clauses = sections.filter(
    (section) => section.kind === "clause",
  );
  const appendices = sections.filter(
    (section) =>
      section.kind === "appendix" ||
      section.kind === "annex" ||
      section.kind === "schedule",
  );

  if (clauses.length === 0) {
    diagnostics.push("CONTRACT_NO_CLAUSES_DETECTED");
  }

  const semanticCoveragePercent =
    meaningfulText === 0
      ? null
      : Number(
          (
            (representedText / meaningfulText) *
            100
          ).toFixed(4),
        );

  const semanticComplete =
    clauses.length > 0 &&
    duplicateIdentifiers.length === 0 &&
    unclassifiedLines.length === 0 &&
    semanticCoveragePercent === 100 &&
    sections.every(
      (section) => section.status === "verified",
    );

  return {
    pdf,
    sections,
    clauses,
    appendices,
    duplicateIdentifiers,
    unclassifiedLines,
    semanticCoveragePercent,
    physicalComplete: pdf.complete,
    semanticComplete,
    complete: pdf.complete && semanticComplete,
    diagnostics,
  };
}
