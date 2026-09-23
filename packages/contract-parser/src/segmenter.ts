import {
  detectContractHeading,
  type ContractHeading,
} from "./numbering";
import type {
  ContractAmendmentAction,
  ContractDocumentResult,
  ContractIgnoredSpan,
  ContractReference,
  ContractSection,
  ContractSourceSpan,
  ContractTextBlock,
  ContractUnclassifiedLine,
} from "./types";
import type { PdfDocumentResult } from "../../pdf-document-parser/src";

interface LineRecord {
  sourceKind: ContractSourceSpan["sourceKind"];
  sourceIndex: number;
  page: number | null;
  block: number | null;
  start: number;
  end: number;
  text: string;
}

interface SegmentOptions {
  sourceType: "pdf" | "docx";
  physicalComplete: boolean;
  sourceDiagnostics?: string[];
  headingOverrides?: Map<string, ContractHeading>;
}

interface ContextState {
  cycleOrdinal: number;
  lastTopLevel: number | null;
  explicitSection: string | null;
}

function lineKey(line: LineRecord): string {
  return [
    line.sourceKind,
    line.sourceIndex,
    line.start,
    line.end,
  ].join(":");
}

function blockLines(block: ContractTextBlock): LineRecord[] {
  const lines: LineRecord[] = [];
  let cursor = 0;

  for (const rawLine of block.text.split(/\r\n|\n|\r/)) {
    const start = cursor;
    const end = start + rawLine.length;
    lines.push({
      sourceKind: block.sourceKind,
      sourceIndex: block.sourceIndex,
      page: block.page,
      block: block.block,
      start,
      end,
      text: rawLine,
    });
    cursor = end + 1;
  }

  return lines;
}

function toSpan(line: LineRecord): ContractSourceSpan {
  return {
    sourceKind: line.sourceKind,
    sourceIndex: line.sourceIndex,
    page: line.page,
    block: line.block,
    start: line.start,
    end: line.end,
    text: line.text,
  };
}

function meaningfulCharacters(text: string): number {
  return [...text].filter((char) =>
    /[\p{L}\p{N}]/u.test(char),
  ).length;
}

function normalizedHeading(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedNoise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikePageNumber(value: string): boolean {
  const text = value.trim();
  return (
    /\bpage\s+\d+\s+of\s+\d+\b/i.test(text) ||
    /^\d+\s*\/\s*\d+$/.test(text)
  );
}

function detectIgnoredSpans(
  blocks: readonly ContractTextBlock[],
): {
  keys: Set<string>;
  spans: ContractIgnoredSpan[];
} {
  const lines = blocks.flatMap(blockLines);
  const pageLines=new Map<number,LineRecord[]>();
  for(const line of lines)if(line.page!==null&&line.text.trim()){
    const page=pageLines.get(line.page)??[];page.push(line);pageLines.set(line.page,page);
  }
  const boundary=(line:LineRecord)=>{
    const page=line.page===null?[]:pageLines.get(line.page)??[];
    return line===page[0]||line===page.at(-1);
  };
  const substantive=(text:string)=>/[.!?]\s*$/.test(text)||/\b(shall|must|required|entitled|entitlement|notice|claim|insurance|contractor\s+to|employer\s+to)\b/i.test(text);
  const pdfPages = new Set(
    blocks
      .map((block) => block.page)
      .filter((page): page is number => page !== null),
  );
  const pageCount = pdfPages.size;
  const occurrencePages = new Map<string, Set<number>>();
  const examples = new Map<string, LineRecord>();

  for (const line of lines) {
    const text = line.text.trim();
    if (
      line.page === null ||
      !text ||
      text.length > 180 ||
      !boundary(line) || substantive(text) ||
      detectContractHeading(text)
    ) {
      continue;
    }

    const normalized = normalizedNoise(text);
    if (!normalized) continue;
    const pages =
      occurrencePages.get(normalized) ?? new Set<number>();
    pages.add(line.page);
    occurrencePages.set(normalized, pages);
    if (!examples.has(normalized)) {
      examples.set(normalized, line);
    }
  }

  const repeatedThreshold =
    pageCount >= 10
      ? Math.max(3, Math.ceil(pageCount * 0.2))
      : Number.POSITIVE_INFINITY;

  const repeated = new Set(
    [...occurrencePages.entries()]
      .filter(([, pages]) => pages.size >= repeatedThreshold)
      .map(([text]) => text),
  );

  const keys = new Set<string>();
  const spans: ContractIgnoredSpan[] = [];

  for (const line of lines) {
    const text = line.text.trim();
    if (!text || line.page === null) continue;

    let reason: ContractIgnoredSpan["reason"] | null = null;
    if (boundary(line)&&looksLikePageNumber(text)&&!substantive(text)) {
      reason = "page_number";
    } else if (boundary(line)&&!substantive(text)&&repeated.has(normalizedNoise(text))) {
      reason =
        /controlled|distribution|watermark/i.test(text)
          ? "watermark"
          : "running_header";
    }

    if (!reason) continue;
    keys.add(lineKey(line));
    spans.push({
      sourceSpan: toSpan(line),
      reason,
    });
  }

  return { keys, spans };
}

function makePreamble(): ContractSection {
  return {
    sectionKey: "preamble",
    kind: "preamble",
    identifier: null,
    contextKey: "document",
    parentIdentifier: null,
    instanceOrdinal: 1,
    heading: null,
    text: "",
    startPage: null,
    endPage: null,
    startBlock: null,
    endBlock: null,
    sourceSpans: [],
    sourceMode: "deterministic",
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
    section.startBlock = line.block;
  }
  section.endPage = line.page ?? section.endPage;
  section.endBlock = line.block ?? section.endBlock;

  section.sourceSpans.push(toSpan(line));
  section.text +=
    (section.text ? "\n" : "") + line.text;
}

function topLevel(identifier: string): number | null {
  const match = identifier.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function parentIdentifier(identifier: string): string | null {
  const index = identifier.lastIndexOf(".");
  return index > 0 ? identifier.slice(0, index) : null;
}

function contextForHeading(
  heading: ContractHeading,
  state: ContextState,
): string {
  if (heading.kind !== "clause") {
    return "document";
  }

  if (heading.contextIdentifier) {
    if (/^\d+$/.test(heading.contextIdentifier)) {
      state.explicitSection = String(
        Number(heading.contextIdentifier),
      );
      state.lastTopLevel = Number(
        heading.contextIdentifier,
      );
      return "section:" + state.explicitSection;
    }

    // Named/meta contexts apply only to their own heading.
    return "context:" + heading.contextIdentifier;
  }

  const top = topLevel(heading.identifier);

  if (
    state.explicitSection !== null &&
    top !== null &&
    String(top) === state.explicitSection
  ) {
    state.lastTopLevel = top;
    return "section:" + state.explicitSection;
  }

  if (
    state.explicitSection !== null &&
    top !== null &&
    String(top) !== state.explicitSection
  ) {
    state.explicitSection = null;
  }

  const depth = heading.identifier.split(".").length;
  if (
    depth === 1 &&
    top !== null &&
    state.lastTopLevel !== null &&
    top < state.lastTopLevel
  ) {
    state.cycleOrdinal += 1;
  }

  if (top !== null) state.lastTopLevel = top;
  return "cycle:" + state.cycleOrdinal;
}

function baseSectionKey(
  heading: ContractHeading,
  contextKey: string,
): string {
  return (
    heading.kind +
    ":" +
    contextKey +
    ":" +
    heading.identifier.toLowerCase()
  );
}

function rawIdentifierKey(section: ContractSection): string | null {
  if (!section.identifier) return null;
  return (
    section.kind +
    ":" +
    section.identifier.toLowerCase()
  );
}

function looksHeadingCandidate(value: string): boolean {
  const line = value.trim();
  if (!line || line.length > 220) return false;
  if(/^clause\s+[\d.]+\s+(?:is|shall\s+be)\s+(?:amended|deleted|replaced|supplemented)/i.test(line)||/^amendment\s+(?:value|date|amount)\b/i.test(line))return false;
  return /^(?:clause|article|section|appendix|annex|schedule|amendment|المادة|البند|القسم|ملحق|المرفق|جدول)\b/i.test(
    line,
  );
}

function subSpan(
  span: ContractSourceSpan,
  relativeStart: number,
  relativeEnd: number,
): ContractSourceSpan {
  return {
    ...span,
    start: span.start + relativeStart,
    end: span.start + relativeEnd,
    text: span.text.slice(relativeStart, relativeEnd),
  };
}

function resolveTarget(
  targetIdentifier: string,
  from: ContractSection,
  clauses: readonly ContractSection[],
  amendmentDocument: boolean,
): {
  keys: string[];
  status: ContractReference["status"];
} {
  const sameContext = clauses.filter(
    (section) =>
      section.identifier === targetIdentifier &&
      section.contextKey === from.contextKey,
  );

  if (sameContext.length === 1) {
    return {
      keys: [sameContext[0]!.sectionKey],
      status: "resolved",
    };
  }
  if (sameContext.length > 1) {
    return {
      keys: sameContext.map((section) => section.sectionKey),
      status: "ambiguous",
    };
  }

  const global = clauses.filter(
    (section) => section.identifier === targetIdentifier,
  );

  if (global.length === 1) {
    return {
      keys: [global[0]!.sectionKey],
      status: "resolved",
    };
  }
  if (global.length > 1) {
    return {
      keys: global.map((section) => section.sectionKey),
      status: "ambiguous",
    };
  }

  return {
    keys: [],
    status: amendmentDocument ? "external" : "unresolved",
  };
}

function extractReferences(
  sections: readonly ContractSection[],
  amendmentDocument: boolean,
): ContractReference[] {
  const clauses = sections.filter(
    (section) => section.kind === "clause",
  );
  const references: ContractReference[] = [];
  const english =
    /\b(?:clause|article)\s+([0-9]+(?:\.[0-9]+){0,8})\b/gi;
  const arabic =
    /(?:المادة|البند)\s*([0-9]+(?:\.[0-9]+){0,8})\b/g;

  for (const section of sections) {
    for (const span of section.sourceSpans) {
      if (
        section.sourceSpans[0] === span &&
        detectContractHeading(span.text)
      ) {
        continue;
      }

      for (const regex of [english, arabic]) {
        regex.lastIndex = 0;
        let match: RegExpExecArray | null;

        while ((match = regex.exec(span.text)) !== null) {
          const target = match[1]!;
          if (
            section.identifier === target &&
            section.sourceSpans[0] === span &&
            match.index === 0
          ) {
            continue;
          }

          const resolved = resolveTarget(
            target,
            section,
            clauses,
            amendmentDocument,
          );

          references.push({
            fromSectionKey: section.sectionKey,
            targetIdentifier: target,
            resolvedSectionKeys: resolved.keys,
            status: resolved.status,
            sourceSpan: subSpan(
              span,
              match.index,
              match.index + match[0].length,
            ),
          });
        }
      }
    }
  }

  return references;
}

function amendmentAction(
  value: string,
): ContractAmendmentAction["action"] {
  const normalized = value.toLowerCase();
  if (/amend/.test(normalized)) return "amend";
  if (/replac/.test(normalized)) return "replace";
  if (/delet|omit/.test(normalized)) return "delete";
  if (/supplement|add/.test(normalized)) return "supplement";
  if (/confirm|remain unchanged/.test(normalized)) return "confirm";
  return "unknown";
}

function extractAmendments(
  sections: readonly ContractSection[],
): ContractAmendmentAction[] {
  const actions: ContractAmendmentAction[] = [];
  const regex =
    /\bclause\s+([0-9]+(?:\.[0-9]+){0,8})\s+(?:is|shall be|has been)\s+(amended|replaced|deleted|omitted|supplemented|added|confirmed)\b/gi;

  for (const section of sections) {
    for (const span of section.sourceSpans) {
      regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = regex.exec(span.text)) !== null) {
        actions.push({
          fromSectionKey: section.sectionKey,
          targetIdentifier: match[1]!,
          action: amendmentAction(match[2]!),
          resolvedSectionKeys: [],
          status: "external",
          sourceSpan: subSpan(
            span,
            match.index,
            match.index + match[0].length,
          ),
        });
      }
    }
  }

  return actions;
}

function amendmentDocumentFromBlocks(
  blocks: readonly ContractTextBlock[],
): boolean {
  return blocks
    .slice(0, 10)
    .some((block) =>
      /contract\s+amendment|amendment\s+no\.?/i.test(
        block.text,
      ),
    );
}

export function contractBlocksFromPdf(
  pdf: PdfDocumentResult,
): ContractTextBlock[] {
  return pdf.pages
    .filter((page) => page.method !== "failed")
    .map((page) => ({
      sourceKind: "pdf_page" as const,
      sourceIndex: page.pageNumber,
      page: page.pageNumber,
      block: null,
      text: page.text,
    }));
}

export function segmentContractTextBlocks(
  blocks: readonly ContractTextBlock[],
  options: SegmentOptions,
): ContractDocumentResult {
  const sections: ContractSection[] = [];
  const diagnostics = [
    ...(options.sourceDiagnostics ?? []),
  ];
  const unclassifiedLines: ContractUnclassifiedLine[] = [];
  const ignored = detectIgnoredSpans(blocks);
  const instanceCounts = new Map<string, number>();
  const priorSectionByBaseKey = new Map<string, ContractSection>();
  const duplicateBases = new Set<string>();
  const rawContexts = new Map<string, Set<string>>();
  const contextState: ContextState = {
    cycleOrdinal: 1,
    lastTopLevel: null,
    explicitSection: null,
  };

  let current = makePreamble();
  sections.push(current);

  for (const block of blocks) {
    let firstMeaningfulSeen = false;

    for (const line of blockLines(block)) {
      if (ignored.keys.has(lineKey(line))) {
        continue;
      }

      if (!line.text.trim()) {
        appendLine(current, line);
        continue;
      }

      const isFirstMeaningfulLine = !firstMeaningfulSeen;
      firstMeaningfulSeen = true;
      const deterministic = detectContractHeading(line.text);
      const heading =
        deterministic ??
        options.headingOverrides?.get(lineKey(line)) ??
        null;

      if (
        heading &&
        isFirstMeaningfulLine &&
        current.identifier !== null &&
        current.kind === heading.kind
      ) {
        const candidateContext =
          heading.contextIdentifier &&
          /^\d+$/.test(heading.contextIdentifier)
            ? "section:" +
              String(Number(heading.contextIdentifier))
            : current.contextKey;

        if (
          current.identifier.toLowerCase() ===
            heading.identifier.toLowerCase() &&
          current.contextKey === candidateContext &&
          normalizedHeading(current.heading) ===
            normalizedHeading(heading.heading)
        ) {
          ignored.spans.push({
            sourceSpan: toSpan(line),
            reason: "running_header",
          });
          continue;
        }
      }

      if (heading) {
        const contextKey = contextForHeading(
          heading,
          contextState,
        );
        const baseKey = baseSectionKey(
          heading,
          contextKey,
        );

        const prior = priorSectionByBaseKey.get(baseKey);
        if (
          prior &&
          normalizedHeading(prior.heading) ===
            normalizedHeading(heading.heading) &&
          normalizedHeading(
            prior.sourceSpans[0]?.text ?? "",
          ) === normalizedHeading(line.text)
        ) {
          ignored.spans.push({
            sourceSpan: toSpan(line),
            reason: "repeated_source_overlap",
          });
          current = prior;
          continue;
        }

        const instanceOrdinal =
          (instanceCounts.get(baseKey) ?? 0) + 1;
        instanceCounts.set(baseKey, instanceOrdinal);
        if (instanceOrdinal > 1) {
          duplicateBases.add(baseKey);
        }

        const rawKey =
          heading.kind +
          ":" +
          heading.identifier.toLowerCase();
        const contexts =
          rawContexts.get(rawKey) ?? new Set<string>();
        contexts.add(contextKey);
        rawContexts.set(rawKey, contexts);

        current = {
          sectionKey:
            instanceOrdinal === 1
              ? baseKey
              : baseKey + "#" + instanceOrdinal,
          kind: heading.kind,
          identifier: heading.identifier,
          contextKey,
          parentIdentifier: parentIdentifier(
            heading.identifier,
          ),
          instanceOrdinal,
          heading: heading.heading,
          text: "",
          startPage: line.page,
          endPage: line.page,
          startBlock: line.block,
          endBlock: line.block,
          sourceSpans: [],
          sourceMode: deterministic
            ? "deterministic"
            : "ai_grounded",
          status:
            instanceOrdinal === 1
              ? "verified"
              : "unresolved",
          diagnostics:
            instanceOrdinal === 1
              ? []
              : [
                  "CONTRACT_DUPLICATE_SECTION_INSTANCE",
                ],
        };
        sections.push(current);
        priorSectionByBaseKey.set(baseKey, current);
        appendLine(current, line);
        continue;
      }

      if (looksHeadingCandidate(line.text)) {
        unclassifiedLines.push({
          sourceSpan: toSpan(line),
          reason: "CONTRACT_HEADING_UNRESOLVED",
        });
      }

      appendLine(current, line);
    }
  }

  const duplicateIdentifiers = [...duplicateBases].sort();
  for (const duplicate of duplicateIdentifiers) {
    diagnostics.push(
      "CONTRACT_DUPLICATE_SECTION_INSTANCE:" + duplicate,
    );
  }

  const repeatedRawIdentifiers = [...rawContexts.entries()]
    .filter(([, contexts]) => contexts.size > 1)
    .map(([key]) => key)
    .sort();

  const sourceMeaningful = blocks.reduce(
    (sum, block) =>
      sum + meaningfulCharacters(block.text),
    0,
  );
  const ignoredMeaningful = ignored.spans.reduce(
    (sum, ignoredSpan) =>
      sum +
      meaningfulCharacters(ignoredSpan.sourceSpan.text),
    0,
  );
  const representedMeaningful = sections.reduce(
    (sum, section) =>
      sum + meaningfulCharacters(section.text),
    0,
  );
  const semanticDenominator =
    sourceMeaningful - ignoredMeaningful;

  if (
    semanticDenominator !== representedMeaningful
  ) {
    diagnostics.push(
      "CONTRACT_TEXT_COVERAGE_MISMATCH:" +
        representedMeaningful +
        "/" +
        semanticDenominator,
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

  const amendmentDocument =
    amendmentDocumentFromBlocks(blocks);
  const references = extractReferences(
    sections,
    amendmentDocument,
  );
  const amendmentActions =
    extractAmendments(sections);

  const ambiguousReferences = references.filter(
    (reference) =>
      reference.status === "ambiguous" ||
      reference.status === "unresolved",
  ).length;

  if (ambiguousReferences > 0) {
    diagnostics.push(
      "CONTRACT_REFERENCES_UNRESOLVED:" +
        ambiguousReferences,
    );
  }

  const semanticCoveragePercent =
    semanticDenominator <= 0
      ? null
      : Number(
          (
            (representedMeaningful /
              semanticDenominator) *
            100
          ).toFixed(4),
        );

  const semanticComplete =
    clauses.length > 0 &&
    duplicateIdentifiers.length === 0 &&
    unclassifiedLines.length === 0 &&
    ambiguousReferences === 0 &&
    semanticCoveragePercent === 100 &&
    sections.every(
      (section) => section.status === "verified",
    );

  return {
    segmentationVersion: 'boundary-noise-v3',
    sourceType: options.sourceType,
    pdf: null,
    docx: null,
    sections,
    clauses,
    appendices,
    duplicateIdentifiers,
    repeatedRawIdentifiers,
    references,
    amendmentActions,
    ignoredSpans: ignored.spans,
    unclassifiedLines,
    semanticCoveragePercent,
    physicalComplete: options.physicalComplete,
    semanticComplete,
    complete:
      options.physicalComplete && semanticComplete,
    diagnostics,
  };
}

export function segmentContractPages(
  pdf: PdfDocumentResult,
): ContractDocumentResult {
  const result = segmentContractTextBlocks(
    contractBlocksFromPdf(pdf),
    {
      sourceType: "pdf",
      physicalComplete: pdf.complete,
      sourceDiagnostics: [
        ...pdf.diagnostics,
        ...pdf.pages
          .filter((page) => page.method === "failed")
          .map(
            (page) =>
              "CONTRACT_PAGE_UNREADABLE:" +
              page.pageNumber,
          ),
      ],
    },
  );
  result.pdf = pdf;
  return result;
}
