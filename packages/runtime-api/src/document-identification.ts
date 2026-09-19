import { mkdirSync } from "node:fs";
import { join } from "node:path";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFParse } from "pdf-parse";

import {
  TesseractOcrProvider,
  type OcrProvider,
} from "../../pdf-document-parser/src";
import type {
  EvidenceCategory,
  EvidenceIdentification,
} from "./project-state-types";
import {
  inferDocumentType,
  inferEvidenceCategory,
} from "./evidence";

const SAMPLE_LIMIT = 120_000;

export interface EvidenceIdentificationResult {
  identification: EvidenceIdentification;
  textSample: string;
}

interface ClassificationRule {
  category: EvidenceCategory;
  documentType: string;
  signals: Array<{
    label: string;
    pattern: RegExp;
    weight: number;
  }>;
}

function bytePrefix(
  bytes: Uint8Array,
  signature: readonly number[],
): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every(
    (value, index) =>
      bytes[index] === value,
  );
}

function textPrefix(
  bytes: Uint8Array,
  length = 8192,
): string {
  return Buffer.from(
    bytes.slice(
      0,
      Math.min(bytes.length, length),
    ),
  )
    .toString("utf8")
    .replace(/^\uFEFF/, "");
}

function normalizeText(
  value: string,
): string {
  return value
    .normalize("NFKC")
    .replace(/\u0000/g, " ")
    .replace(/[\t\r]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function meaningfulCharacters(
  text: string,
): number {
  return [...text].filter(
    (char) =>
      /[\p{L}\p{N}]/u.test(char),
  ).length;
}

function unique<T>(
  values: readonly T[],
): T[] {
  return [...new Set(values)];
}

function decodeXmlText(
  value: string,
): string {
  return value
    .replace(/<w:tab\s*\/>/g, "\t")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function ocrLanguages(): string[] {
  const raw =
    process.env
      .CMENG_OCR_LANGUAGES
      ?.trim() ||
    "eng,ara";
  return raw
    .split(/[,+]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function ocrCachePath(): string {
  const root =
    process.env
      .RAILWAY_VOLUME_MOUNT_PATH
      ?.trim() ||
    process.env
      .CMENG_DATA_DIR
      ?.trim() ||
    join(
      process.cwd(),
      ".cmeng-runtime",
    );
  const path =
    join(root, "ocr-cache");
  mkdirSync(path, {
    recursive: true,
  });
  return path;
}

function ocrProvider():
  TesseractOcrProvider {
  return new TesseractOcrProvider({
    languages:
      ocrLanguages(),
    cachePath:
      ocrCachePath(),
    ...(process.env
      .CMENG_OCR_LANG_PATH
      ?.trim()
      ? {
          langPath:
            process.env
              .CMENG_OCR_LANG_PATH!
              .trim(),
        }
      : {}),
  });
}

async function verifiedMediaType(
  bytes: Uint8Array,
  filename: string,
  declared:
    | string
    | null
    | undefined,
): Promise<string> {
  if (
    bytePrefix(
      bytes,
      [0x25, 0x50, 0x44, 0x46, 0x2d],
    )
  ) {
    return "application/pdf";
  }

  if (
    bytePrefix(
      bytes,
      [
        0x89, 0x50, 0x4e, 0x47,
        0x0d, 0x0a, 0x1a, 0x0a,
      ],
    )
  ) {
    return "image/png";
  }

  if (
    bytePrefix(
      bytes,
      [0xff, 0xd8, 0xff],
    )
  ) {
    return "image/jpeg";
  }

  if (
    bytePrefix(
      bytes,
      [0x49, 0x49, 0x2a, 0x00],
    ) ||
    bytePrefix(
      bytes,
      [0x4d, 0x4d, 0x00, 0x2a],
    )
  ) {
    return "image/tiff";
  }

  if (
    bytePrefix(
      bytes,
      [0x42, 0x4d],
    )
  ) {
    return "image/bmp";
  }

  if (
    bytes.length >= 12 &&
    Buffer.from(
      bytes.slice(0, 4),
    ).toString("ascii") === "RIFF" &&
    Buffer.from(
      bytes.slice(8, 12),
    ).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }

  if (
    bytePrefix(
      bytes,
      [0x50, 0x4b],
    )
  ) {
    try {
      const zip =
        await JSZip.loadAsync(
          Buffer.from(bytes),
        );
      const names =
        Object.keys(zip.files);
      if (
        names.includes(
          "word/document.xml",
        )
      ) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
      if (
        names.includes(
          "xl/workbook.xml",
        )
      ) {
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      }
      return "application/zip";
    } catch {
      return (
        declared?.trim() ||
        "application/octet-stream"
      );
    }
  }

  const prefix =
    textPrefix(bytes);
  const trimmed =
    prefix.trimStart();

  if (
    trimmed.startsWith(
      "ERMHDR",
    ) ||
    /(?:^|\n)%T\tPROJECT(?:\r?$|\t)/m.test(
      prefix,
    )
  ) {
    return "text/x-primavera-xer";
  }

  if (
    trimmed.startsWith("<") &&
    /<\?xml|<Project|<Activity|<APIBusinessObjects/i.test(
      trimmed,
    )
  ) {
    return "application/xml";
  }

  const lines =
    prefix.split(/\r?\n/);
  if (
    lines.length >= 2 &&
    (
      lines[0]!.includes(",") ||
      lines[0]!.includes("\t")
    )
  ) {
    return "text/csv";
  }

  if (
    meaningfulCharacters(prefix) > 0
  ) {
    const declaredType =
      declared?.trim().toLowerCase();
    return (
      declaredType &&
      (
        declaredType.startsWith(
          "text/",
        ) ||
        declaredType.includes(
          "json",
        )
      )
        ? declared!.trim()
        : "text/plain"
    );
  }

  const lower =
    filename.toLowerCase();
  if (
    lower.endsWith(".png")
  ) return "image/png";
  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg")
  ) return "image/jpeg";
  if (
    lower.endsWith(".tif") ||
    lower.endsWith(".tiff")
  ) return "image/tiff";

  return (
    declared?.trim() ||
    "application/octet-stream"
  );
}

async function extractPdfSample(
  bytes: Uint8Array,
  suppliedOcrProvider?:
    OcrProvider,
): Promise<{
  text: string;
  method:
    | "native_text"
    | "ocr_sample"
    | "unreadable";
  ocrUsed: boolean;
  ocrConfidence: number | null;
  pageCount: number | null;
  diagnostics: string[];
}> {
  const parser =
    new PDFParse({
      data:
        Buffer.from(bytes) as any,
    });
  const diagnostics: string[] = [];

  try {
    const firstPages =
      await parser.getText({
        first: 3,
      });
    const pageCount =
      Number.isFinite(
        firstPages.total,
      )
        ? firstPages.total
        : (
            firstPages.pages ??
            []
          ).length;

    const pageNumbers =
      unique([
        1,
        2,
        3,
        Math.ceil(
          Math.max(
            pageCount,
            1,
          ) / 2,
        ),
        pageCount,
      ]).filter(
        (page) =>
          page >= 1 &&
          page <= pageCount,
      );

    const sampled =
      pageNumbers.some(
        (page) => page > 3,
      )
        ? await parser.getText({
            partial:
              pageNumbers,
          })
        : firstPages;
    const pages =
      sampled.pages ?? [];

    const nativeText =
      pageNumbers
        .map(
          (number) =>
            pages.find(
              (page) =>
                page.num ===
                number,
            )?.text ?? "",
        )
        .join("\n")
        .slice(
          0,
          SAMPLE_LIMIT,
        );

    if (
      meaningfulCharacters(
        nativeText,
      ) >= 80
    ) {
      return {
        text: nativeText,
        method:
          "native_text",
        ocrUsed: false,
        ocrConfidence: null,
        pageCount,
        diagnostics,
      };
    }

    if (
      !suppliedOcrProvider &&
      process.env
        .CMENG_OCR_ENABLED
        ?.trim() === "0"
    ) {
      diagnostics.push(
        "DOCUMENT_OCR_REQUIRED_BUT_DISABLED",
      );
      return {
        text: nativeText,
        method:
          nativeText
            ? "native_text"
            : "unreadable",
        ocrUsed: false,
        ocrConfidence: null,
        pageCount,
        diagnostics,
      };
    }

    const maxOcrPages =
      Math.max(
        1,
        Number.parseInt(
          process.env
            .CMENG_OCR_CLASSIFICATION_MAX_PAGES ??
            "3",
          10,
        ) || 3,
      );
    const chosen =
      unique([
        1,
        Math.ceil(
          Math.max(
            pageCount,
            1,
          ) / 2,
        ),
        pageCount,
        2,
        3,
      ])
        .filter(
          (page) =>
            page >= 1 &&
            page <= pageCount,
        )
        .slice(
          0,
          maxOcrPages,
        );

    const screenshots: any =
      await parser.getScreenshot({
        partial: chosen,
        scale: 1.5,
        imageBuffer: true,
        imageDataUrl: false,
      });

    const provider =
      suppliedOcrProvider ??
      ocrProvider();
    const texts: string[] = [];
    const confidences: number[] = [];

    try {
      for (
        let index = 0;
        index <
        (screenshots.pages ?? [])
          .length;
        index += 1
      ) {
        const page =
          screenshots.pages[index];
        const image =
          page?.data;
        if (!image) continue;

        const ocr =
          await provider.recognize(
            image instanceof Uint8Array
              ? image
              : Buffer.from(image),
            chosen[index] ??
              index + 1,
          );
        if (ocr.text?.trim()) {
          texts.push(
            ocr.text,
          );
        }
        if (
          ocr.confidence !== null
        ) {
          confidences.push(
            ocr.confidence,
          );
        }
        diagnostics.push(
          ...ocr.diagnostics,
        );
      }
    } finally {
      if (provider.close) {
        await provider.close();
      }
    }

    const ocrText =
      texts
        .join("\n")
        .slice(
          0,
          SAMPLE_LIMIT,
        );
    const confidence =
      confidences.length === 0
        ? null
        : confidences.reduce(
            (sum, value) =>
              sum + value,
            0,
          ) /
          confidences.length;

    if (
      meaningfulCharacters(
        ocrText,
      ) === 0
    ) {
      diagnostics.push(
        "DOCUMENT_OCR_SAMPLE_EMPTY",
      );
      return {
        text: nativeText,
        method:
          "unreadable",
        ocrUsed: true,
        ocrConfidence:
          confidence,
        pageCount,
        diagnostics,
      };
    }

    return {
      text: ocrText,
      method:
        "ocr_sample",
      ocrUsed: true,
      ocrConfidence:
        confidence,
      pageCount,
      diagnostics,
    };
  } catch (error) {
    diagnostics.push(
      "DOCUMENT_PDF_INSPECTION_ERROR:" +
        (
          error instanceof Error
            ? error.message
            : String(error)
        ),
    );
    return {
      text: "",
      method: "unreadable",
      ocrUsed: false,
      ocrConfidence: null,
      pageCount: null,
      diagnostics,
    };
  } finally {
    await parser.destroy();
  }
}

async function extractImageSample(
  bytes: Uint8Array,
  suppliedOcrProvider?:
    OcrProvider,
): Promise<{
  text: string;
  ocrConfidence: number | null;
  diagnostics: string[];
}> {
  if (
    !suppliedOcrProvider &&
    process.env
      .CMENG_OCR_ENABLED
      ?.trim() === "0"
  ) {
    return {
      text: "",
      ocrConfidence: null,
      diagnostics: [
        "DOCUMENT_IMAGE_OCR_DISABLED",
      ],
    };
  }

  const provider =
    suppliedOcrProvider ??
    ocrProvider();
  try {
    const result =
      await provider.recognize(
        bytes,
        1,
      );
    return {
      text:
        result.text.slice(
          0,
          SAMPLE_LIMIT,
        ),
      ocrConfidence:
        result.confidence,
      diagnostics: [
        ...result.diagnostics,
      ],
    };
  } catch (error) {
    return {
      text: "",
      ocrConfidence: null,
      diagnostics: [
        "DOCUMENT_IMAGE_OCR_ERROR:" +
          (
            error instanceof Error
              ? error.message
              : String(error)
          ),
      ],
    };
  } finally {
    if (provider.close) {
      await provider.close();
    }
  }
}

async function extractDocxSample(
  bytes: Uint8Array,
): Promise<string> {
  const zip =
    await JSZip.loadAsync(
      Buffer.from(bytes),
    );
  const document =
    zip.file(
      "word/document.xml",
    );
  if (!document) return "";
  return decodeXmlText(
    await document.async(
      "string",
    ),
  ).slice(
    0,
    SAMPLE_LIMIT,
  );
}

async function extractXlsxSample(
  bytes: Uint8Array,
): Promise<string> {
  const workbook =
    new ExcelJS.Workbook();
  await workbook.xlsx.load(
    Buffer.from(bytes) as any,
  );

  const values: string[] = [];
  for (
    const sheet of
      workbook.worksheets.slice(
        0,
        4,
      )
  ) {
    values.push(
      "SHEET " +
        sheet.name,
    );
    const maxRows =
      Math.min(
        sheet.rowCount,
        120,
      );
    for (
      let rowNumber = 1;
      rowNumber <= maxRows;
      rowNumber += 1
    ) {
      const row =
        sheet.getRow(
          rowNumber,
        );
      const cells: string[] = [];
      row.eachCell(
        {
          includeEmpty: false,
        },
        (cell) => {
          const value =
            cell.text?.trim();
          if (value) {
            cells.push(value);
          }
        },
      );
      if (cells.length) {
        values.push(
          cells.join(" | "),
        );
      }
      if (
        values.join("\n")
          .length >=
        SAMPLE_LIMIT
      ) {
        break;
      }
    }
    if (
      values.join("\n")
        .length >=
      SAMPLE_LIMIT
    ) {
      break;
    }
  }

  return values
    .join("\n")
    .slice(
      0,
      SAMPLE_LIMIT,
    );
}

const rules:
  ClassificationRule[] = [
  {
    category: "contract",
    documentType:
      "contract_replacement",
    signals: [
      {
        label:
          "amended and restated agreement",
        pattern:
          /\bamended\s+and\s+restated\b/i,
        weight: 8,
      },
      {
        label:
          "restated agreement",
        pattern:
          /\brestated\s+(?:contract|agreement)\b/i,
        weight: 7,
      },
      {
        label:
          "consolidated contract",
        pattern:
          /\bconsolidated\s+contract\b/i,
        weight: 7,
      },
      {
        label:
          "supersedes prior contract",
        pattern:
          /\bsupersedes?\s+(?:the\s+)?(?:previous|prior|original)\s+(?:contract|agreement)\b/i,
        weight: 8,
      },
    ],
  },
  {
    category: "boq_cost",
    documentType:
      "variation_order",
    signals: [
      {
        label:
          "variation order",
        pattern:
          /\bvariation\s+order\b/i,
        weight: 8,
      },
      {
        label:
          "change order",
        pattern:
          /\bchange\s+order\b/i,
        weight: 8,
      },
      {
        label:
          "VO number",
        pattern:
          /\bvo\s*(?:no\.?|number|#)\s*[A-Z0-9-]+/i,
        weight: 6,
      },
      {
        label:
          "additional or omitted quantities",
        pattern:
          /\b(?:additional|omitted|deleted)\s+quantit/i,
        weight: 5,
      },
      {
        label:
          "variation amount",
        pattern:
          /\bvariation\s+amount\b/i,
        weight: 4,
      },
    ],
  },
  {
    category: "contract",
    documentType:
      "contract_amendment",
    signals: [
      {
        label:
          "contract amendment",
        pattern:
          /\bcontract\s+amendment\b/i,
        weight: 6,
      },
      {
        label:
          "amendment number",
        pattern:
          /\bamendment\s+(?:no\.?|number)\s*\d+/i,
        weight: 4,
      },
      {
        label:
          "revised contract value",
        pattern:
          /\brevised\s+contract\s+value\b/i,
        weight: 3,
      },
      {
        label:
          "clause amended",
        pattern:
          /\bclause\s+[\d.]+\s+(?:is|shall be|has been)\s+amend/i,
        weight: 4,
      },
    ],
  },
  {
    category: "contract",
    documentType:
      "main_contract",
    signals: [
      {
        label:
          "main works contract",
        pattern:
          /\bmain\s+works\s+contract\b/i,
        weight: 6,
      },
      {
        label:
          "contract agreement",
        pattern:
          /\bcontract\s+agreement\b/i,
        weight: 5,
      },
      {
        label:
          "conditions of contract",
        pattern:
          /\bconditions\s+of\s+contract\b/i,
        weight: 4,
      },
      {
        label: "FIDIC",
        pattern:
          /\bfidic\b/i,
        weight: 3,
      },
      {
        label:
          "accepted contract amount",
        pattern:
          /\baccepted\s+contract\s+amount\b/i,
        weight: 4,
      },
      {
        label:
          "time for completion",
        pattern:
          /\btime\s+for\s+completion\b/i,
        weight: 3,
      },
      {
        label:
          "liquidated damages",
        pattern:
          /\bliquidated\s+damages\b/i,
        weight: 3,
      },
    ],
  },
  {
    category: "contract",
    documentType:
      "contract_appendix",
    signals: [
      {
        label:
          "technical appendix",
        pattern:
          /\btechnical\s+appendix\b/i,
        weight: 6,
      },
      {
        label:
          "technical specification",
        pattern:
          /\btechnical\s+(?:specification|requirements?)\b/i,
        weight: 4,
      },
      {
        label:
          "rail systems requirements",
        pattern:
          /\brail\s+systems?\b/i,
        weight: 2,
      },
      {
        label:
          "appendix heading",
        pattern:
          /\bappendix\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "tender_commissioning",
    documentType:
      "tender_employer_requirements",
    signals: [
      {
        label:
          "employer requirements",
        pattern:
          /\bemployer\s+requirements?\b/i,
        weight: 6,
      },
      {
        label:
          "tenderer shall",
        pattern:
          /\btenderer\s+shall\b/i,
        weight: 5,
      },
      {
        label:
          "tender submission",
        pattern:
          /\btender\s+submissions?\b/i,
        weight: 4,
      },
      {
        label: "ORAT",
        pattern:
          /\borat\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "schedule_control",
    documentType:
      "contractor_manpower_plan",
    signals: [
      {
        label:
          "manpower plan",
        pattern:
          /\bmanpower\s+plan\b/i,
        weight: 8,
      },
      {
        label:
          "planned manpower",
        pattern:
          /\bplanned\s+manpower\b/i,
        weight: 6,
      },
      {
        label:
          "planned headcount",
        pattern:
          /\bplanned\s+headcount\b/i,
        weight: 6,
      },
      {
        label:
          "headcount",
        pattern:
          /\bheadcount\b/i,
        weight: 3,
      },
      {
        label:
          "work front",
        pattern:
          /\bwork\s*front\b/i,
        weight: 2,
      },
      {
        label: "trade",
        pattern:
          /\btrade\b/i,
        weight: 1,
      },
    ],
  },
  {
    category:
      "hse_quality_fm",
    documentType:
      "hse_report",
    signals: [
      {
        label:
          "monthly HSE report",
        pattern:
          /\bmonthly\s+hse\s+report\b/i,
        weight: 7,
      },
      {
        label: "LTIFR",
        pattern:
          /\bltifr\b/i,
        weight: 4,
      },
      {
        label: "TRIR",
        pattern:
          /\btrir\b/i,
        weight: 4,
      },
      {
        label:
          "lost time injuries",
        pattern:
          /\blost\s+time\s+injur/i,
        weight: 3,
      },
    ],
  },
  {
    category:
      "correspondence",
    documentType:
      "meeting_minutes",
    signals: [
      {
        label:
          "minutes of meeting",
        pattern:
          /\bminutes\s+of\s+meeting\b/i,
        weight: 8,
      },
      {
        label:
          "meeting minutes",
        pattern:
          /\bmeeting\s+minutes\b/i,
        weight: 8,
      },
      {
        label:
          "MOM reference",
        pattern:
          /\bmom\s*(?:no\.?|number|#|ref(?:erence)?)?/i,
        weight: 5,
      },
      {
        label:
          "attendees",
        pattern:
          /\battendees?\b/i,
        weight: 2,
      },
      {
        label:
          "action items",
        pattern:
          /\baction\s+items?\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "correspondence",
    documentType:
      "letters_notices",
    signals: [
      {
        label:
          "project correspondence",
        pattern:
          /\bproject\s+correspondence\b/i,
        weight: 6,
      },
      {
        label:
          "letter reference",
        pattern:
          /\breference\s*:\s*[A-Z0-9-]+/i,
        weight: 3,
      },
      {
        label:
          "letter subject",
        pattern:
          /\bsubject\s*:/i,
        weight: 2,
      },
      {
        label:
          "contractual notice",
        pattern:
          /\bnotice\s+of\s+(?:claim|delay|extension|variation)\b/i,
        weight: 4,
      },
    ],
  },
  {
    category:
      "schedule_control",
    documentType:
      "project_data_book",
    signals: [
      {
        label:
          "project data book",
        pattern:
          /\bproject\s+data\s+book\b/i,
        weight: 7,
      },
      {
        label:
          "latest data date",
        pattern:
          /\blatest\s+data\s+date\b/i,
        weight: 3,
      },
      {
        label:
          "latest forecast",
        pattern:
          /\blatest\s+forecast\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "schedule_control",
    documentType:
      "schedule_control_basis",
    signals: [
      {
        label:
          "schedule control basis",
        pattern:
          /\bschedule\s+control\s+basis\b/i,
        weight: 7,
      },
      {
        label:
          "critical definition",
        pattern:
          /\bcritical\s+definition\b/i,
        weight: 3,
      },
      {
        label:
          "near critical definition",
        pattern:
          /\bnear[- ]critical\s+definition\b/i,
        weight: 3,
      },
      {
        label:
          "data date",
        pattern:
          /\bdata\s+date\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "schedule_control",
    documentType:
      "obs_responsibility_matrix",
    signals: [
      {
        label: "OBS code",
        pattern:
          /\bobs\s+code\b/i,
        weight: 5,
      },
      {
        label:
          "responsible manager",
        pattern:
          /\bresponsible\s+manager\b/i,
        weight: 3,
      },
      {
        label:
          "primary WBS",
        pattern:
          /\bprimary\s+wbs\b/i,
        weight: 3,
      },
    ],
  },
  {
    category:
      "schedule_control",
    documentType:
      "wbs_dictionary",
    signals: [
      {
        label: "WBS code",
        pattern:
          /\bwbs\s+code\b/i,
        weight: 5,
      },
      {
        label: "WBS name",
        pattern:
          /\bwbs\s+name\b/i,
        weight: 3,
      },
      {
        label:
          "parent WBS",
        pattern:
          /\bparent\s+wbs\b/i,
        weight: 3,
      },
    ],
  },
  {
    category:
      "schedule_control",
    documentType:
      "longest_path_register",
    signals: [
      {
        label:
          "driving path",
        pattern:
          /\bdriving\s+path\b/i,
        weight: 5,
      },
      {
        label:
          "float path",
        pattern:
          /\bfloat\s+path\b/i,
        weight: 4,
      },
      {
        label:
          "total float",
        pattern:
          /\btotal\s+float\b/i,
        weight: 3,
      },
      {
        label:
          "activity ID",
        pattern:
          /\bactivity\s+id\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "schedule_control",
    documentType:
      "resource_register",
    signals: [
      {
        label:
          "resource unique ID",
        pattern:
          /\bresource\s+unique\s+id\b/i,
        weight: 5,
      },
      {
        label:
          "resource name",
        pattern:
          /\bresource\s+name\b/i,
        weight: 3,
      },
      {
        label:
          "resource type",
        pattern:
          /\b(?:resource\s+)?type\b/i,
        weight: 1,
      },
      {
        label:
          "calendar",
        pattern:
          /\bcalendar\b/i,
        weight: 1,
      },
    ],
  },
  {
    category:
      "boq_cost",
    documentType: "boq",
    signals: [
      {
        label:
          "item number",
        pattern:
          /\bitem\s+(?:no\.?|number)\b/i,
        weight: 3,
      },
      {
        label: "quantity",
        pattern:
          /\b(?:quantity|qty)\b/i,
        weight: 2,
      },
      {
        label: "rate",
        pattern:
          /\brate(?:\s+[A-Z]{3})?\b/i,
        weight: 2,
      },
      {
        label: "amount",
        pattern:
          /\bamount(?:\s+[A-Z]{3})?\b/i,
        weight: 2,
      },
      {
        label:
          "cost code",
        pattern:
          /\bcost\s+code\b/i,
        weight: 3,
      },
      {
        label: "unit",
        pattern:
          /\bunit\b/i,
        weight: 1,
      },
    ],
  },
  {
    category:
      "boq_cost",
    documentType:
      "cost_evm_report",
    signals: [
      {
        label: "EVM",
        pattern:
          /\bevm\b/i,
        weight: 5,
      },
      {
        label:
          "original contract value",
        pattern:
          /\boriginal\s+contract\s+value\b/i,
        weight: 3,
      },
      {
        label: "CPI",
        pattern:
          /\bcpi\b/i,
        weight: 3,
      },
      {
        label: "SPI",
        pattern:
          /\bspi\b/i,
        weight: 3,
      },
      {
        label: "EAC",
        pattern:
          /\beac\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "boq_cost",
    documentType:
      "payment_certificates",
    signals: [
      {
        label:
          "certificate number",
        pattern:
          /\bcertificate\s+(?:no\.?|number)\b/i,
        weight: 5,
      },
      {
        label:
          "net certified",
        pattern:
          /\bnet\s+certified\b/i,
        weight: 4,
      },
      {
        label:
          "advance recovery",
        pattern:
          /\badvance\s+recovery\b/i,
        weight: 3,
      },
      {
        label:
          "retention",
        pattern:
          /\bretention\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "boq_cost",
    documentType:
      "variation_register",
    signals: [
      {
        label:
          "variation ID",
        pattern:
          /\bvariation\s+id\b/i,
        weight: 5,
      },
      {
        label:
          "approved amount",
        pattern:
          /\bapproved\s+amount\b/i,
        weight: 4,
      },
      {
        label:
          "approval date",
        pattern:
          /\bapproval\s+date\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "risk_claims_procurement",
    documentType:
      "delay_eot_claims_register",
    signals: [
      {
        label: "claim ID",
        pattern:
          /\bclaim\s+id\b/i,
        weight: 5,
      },
      {
        label:
          "days claimed",
        pattern:
          /\bdays\s+claimed\b/i,
        weight: 4,
      },
      {
        label:
          "days granted",
        pattern:
          /\bdays\s+granted\b/i,
        weight: 3,
      },
      {
        label:
          "notice date",
        pattern:
          /\bnotice\s+date\b/i,
        weight: 2,
      },
      {
        label:
          "linked letter",
        pattern:
          /\blinked\s+letter\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "risk_claims_procurement",
    documentType:
      "procurement_register",
    signals: [
      {
        label:
          "package ID",
        pattern:
          /\bpackage\s+id\b/i,
        weight: 5,
      },
      {
        label:
          "required on site",
        pattern:
          /\brequired\s+on\s+site\b/i,
        weight: 4,
      },
      {
        label:
          "forecast delivery",
        pattern:
          /\bforecast\s+delivery\b/i,
        weight: 3,
      },
      {
        label:
          "long lead",
        pattern:
          /\blong\s+lead\b/i,
        weight: 2,
      },
      {
        label:
          "linked activity",
        pattern:
          /\blinked\s+activity\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "risk_claims_procurement",
    documentType:
      "risk_register",
    signals: [
      {
        label: "risk ID",
        pattern:
          /\brisk\s+id\b/i,
        weight: 5,
      },
      {
        label:
          "probability",
        pattern:
          /\bprobability\b/i,
        weight: 3,
      },
      {
        label:
          "impact",
        pattern:
          /\bimpact\b/i,
        weight: 2,
      },
      {
        label:
          "rating",
        pattern:
          /\brating\b/i,
        weight: 2,
      },
      {
        label:
          "mitigation",
        pattern:
          /\bmitigat/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "engineering",
    documentType:
      "design_deliverables",
    signals: [
      {
        label:
          "deliverable ID",
        pattern:
          /\bdeliverable\s+id\b/i,
        weight: 5,
      },
      {
        label:
          "planned issue",
        pattern:
          /\bplanned\s+issue\b/i,
        weight: 3,
      },
      {
        label:
          "actual issue",
        pattern:
          /\bactual\s+issue\b/i,
        weight: 3,
      },
      {
        label:
          "linked activity",
        pattern:
          /\blinked\s+activity\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "engineering",
    documentType:
      "rfi_register",
    signals: [
      {
        label: "RFI ID",
        pattern:
          /\brfi\s+id\b/i,
        weight: 6,
      },
      {
        label:
          "raised date",
        pattern:
          /\braised\s+date\b/i,
        weight: 2,
      },
      {
        label:
          "required response",
        pattern:
          /\brequired\s+response\b/i,
        weight: 3,
      },
      {
        label:
          "response date",
        pattern:
          /\bresponse\s+date\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "engineering",
    documentType:
      "submittal_register",
    signals: [
      {
        label:
          "submittal ID",
        pattern:
          /\bsubmittal\s+id\b/i,
        weight: 6,
      },
      {
        label:
          "submitted date",
        pattern:
          /\bsubmitted\s+date\b/i,
        weight: 3,
      },
      {
        label:
          "approval date",
        pattern:
          /\bapproval\s+date\b/i,
        weight: 2,
      },
      {
        label:
          "procurement package",
        pattern:
          /\bprocurement\s+package\b/i,
        weight: 3,
      },
    ],
  },
  {
    category:
      "hse_quality_fm",
    documentType:
      "quality_ncr_register",
    signals: [
      {
        label: "NCR ID",
        pattern:
          /\bncr\s+id\b/i,
        weight: 6,
      },
      {
        label: "severity",
        pattern:
          /\bseverity\b/i,
        weight: 2,
      },
      {
        label:
          "close date",
        pattern:
          /\bclose\s+date\b/i,
        weight: 2,
      },
      {
        label:
          "linked activity",
        pattern:
          /\blinked\s+activity\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "hse_quality_fm",
    documentType:
      "asset_register",
    signals: [
      {
        label:
          "asset ID",
        pattern:
          /\basset\s+id\b/i,
        weight: 6,
      },
      {
        label:
          "tag installed",
        pattern:
          /\btag\s+installed\b/i,
        weight: 3,
      },
      {
        label:
          "O&M manual",
        pattern:
          /\bo\s*&\s*m\s+manual\b/i,
        weight: 3,
      },
      {
        label:
          "warranty",
        pattern:
          /\bwarranty\b/i,
        weight: 2,
      },
    ],
  },
  {
    category:
      "tender_commissioning",
    documentType:
      "testing_commissioning_register",
    signals: [
      {
        label: "test ID",
        pattern:
          /\btest\s+id\b/i,
        weight: 5,
      },
      {
        label:
          "trial activity",
        pattern:
          /\btest\s*\/\s*trial\s+activity\b/i,
        weight: 4,
      },
      {
        label:
          "authority witness",
        pattern:
          /\bauthority\s+witness\b/i,
        weight: 3,
      },
      {
        label:
          "linked schedule activity",
        pattern:
          /\blinked\s+schedule\s+activity\b/i,
        weight: 3,
      },
    ],
  },
];

function classifyText(
  text: string,
  mediaType: string,
): {
  category:
    EvidenceCategory;
  documentType: string;
  confidence: number;
  signals: string[];
} | null {
  const normalized =
    normalizeText(text);

  if (
    mediaType ===
      "text/x-primavera-xer" ||
    (
      /\bERMHDR\b/.test(
        text,
      ) &&
      /%T\s+TASK/.test(
        text,
      )
    )
  ) {
    return {
      category: "schedule",
      documentType:
        "schedule_file",
      confidence: 0.995,
      signals: [
        "Primavera XER signature",
      ],
    };
  }

  if (
    mediaType ===
      "application/xml" &&
    (
      /<Activity\b/i.test(
        text,
      ) ||
      /<Relationship\b/i.test(
        text,
      ) ||
      /Primavera/i.test(text)
    )
  ) {
    return {
      category: "schedule",
      documentType:
        "schedule_file",
      confidence: 0.96,
      signals: [
        "Primavera/XML schedule structure",
      ],
    };
  }

  if (
    /\bactivity\s+id\b/i.test(
      normalized,
    ) &&
    /\b(?:activity\s+name|wbs|predecessor|successor|total\s+float)\b/i.test(
      normalized,
    ) &&
    /\b(?:start|finish|duration|status)\b/i.test(
      normalized,
    )
  ) {
    return {
      category: "schedule",
      documentType:
        "schedule_file",
      confidence: 0.9,
      signals: [
        "schedule activity columns",
      ],
    };
  }

  const scored =
    rules.map(
      (rule) => {
        const matched =
          rule.signals.filter(
            (signal) =>
              signal.pattern.test(
                normalized,
              ),
          );
        return {
          rule,
          score:
            matched.reduce(
              (sum, signal) =>
                sum +
                signal.weight,
              0,
            ),
          matched,
        };
      },
    )
      .filter(
        (entry) =>
          entry.score > 0,
      )
      .sort(
        (a, b) =>
          b.score -
          a.score,
      );

  const top =
    scored[0];
  if (
    !top ||
    top.score < 4
  ) {
    return null;
  }

  const secondScore =
    scored[1]?.score ?? 0;
  const margin =
    Math.max(
      0,
      top.score -
        secondScore,
    );
  const confidence =
    Math.min(
      0.99,
      Math.max(
        0.5,
        0.45 +
          Math.min(
            0.38,
            top.score *
              0.035,
          ) +
          Math.min(
            0.16,
            margin *
              0.02,
          ),
      ),
    );

  return {
    category:
      top.rule.category,
    documentType:
      top.rule
        .documentType,
    confidence,
    signals:
      top.matched.map(
        (signal) =>
          signal.label,
      ),
  };
}

function firstTitle(
  text: string,
): string | null {
  const lines =
    text
      .split(/\r?\n/)
      .map(
        (line) =>
          normalizeText(line),
      )
      .filter(
        (line) =>
          line.length >= 5,
      );

  const first =
    lines[0] ?? null;
  return first
    ? first.slice(0, 240)
    : null;
}

export async function identifyEvidenceDocument(
  input: {
    bytes: Uint8Array;
    sourceFilename: string;
    sourceRelativePath:
      | string
      | null;
    declaredMediaType?:
      | string
      | null
      | undefined;
    declaredCategory?:
      | string
      | null
      | undefined;
    declaredDocumentType?:
      | string
      | null
      | undefined;
    ocrProvider?:
      OcrProvider;
  },
): Promise<
  EvidenceIdentificationResult
> {
  const path =
    input.sourceRelativePath ??
    input.sourceFilename;
  const filenameHintCategory =
    inferEvidenceCategory(
      path,
      null,
    );
  const filenameHintDocumentType =
    inferDocumentType(
      path,
      null,
    );
  const mediaType =
    await verifiedMediaType(
      input.bytes,
      input.sourceFilename,
      input.declaredMediaType,
    );

  let text = "";
  let method:
    EvidenceIdentification["method"] =
    "signature";
  let ocrUsed = false;
  let ocrConfidence:
    number | null = null;
  let pageCount:
    number | null = null;
  const diagnostics: string[] = [];

  try {
    if (
      mediaType ===
      "application/pdf"
    ) {
      const extracted =
        await extractPdfSample(
          input.bytes,
          input.ocrProvider,
        );
      text = extracted.text;
      method =
        extracted.method;
      ocrUsed =
        extracted.ocrUsed;
      ocrConfidence =
        extracted.ocrConfidence;
      pageCount =
        extracted.pageCount;
      diagnostics.push(
        ...extracted.diagnostics,
      );
    } else if (
      mediaType.startsWith(
        "image/",
      )
    ) {
      const extracted =
        await extractImageSample(
          input.bytes,
          input.ocrProvider,
        );
      text = extracted.text;
      method =
        text
          ? "ocr_sample"
          : "unreadable";
      ocrUsed = true;
      ocrConfidence =
        extracted.ocrConfidence;
      pageCount = 1;
      diagnostics.push(
        ...extracted.diagnostics,
      );
    } else if (
      mediaType.includes(
        "wordprocessingml",
      )
    ) {
      text =
        await extractDocxSample(
          input.bytes,
        );
      method = "office_xml";
    } else if (
      mediaType.includes(
        "spreadsheetml",
      )
    ) {
      text =
        await extractXlsxSample(
          input.bytes,
        );
      method =
        "tabular_content";
    } else if (
      mediaType.startsWith(
        "text/",
      ) ||
      mediaType.includes("xml")
    ) {
      text =
        Buffer.from(
          input.bytes,
        )
          .toString("utf8")
          .replace(
            /^\uFEFF/,
            "",
          )
          .slice(
            0,
            SAMPLE_LIMIT,
          );
      method =
        mediaType ===
          "text/csv"
          ? "tabular_content"
          : "native_text";
    }
  } catch (error) {
    diagnostics.push(
      "DOCUMENT_CONTENT_EXTRACTION_ERROR:" +
        (
          error instanceof Error
            ? error.message
            : String(error)
        ),
    );
    method = "unreadable";
  }

  const classification =
    classifyText(
      text,
      mediaType,
    );

  let detectedCategory:
    EvidenceCategory;
  let detectedDocumentType:
    string;
  let confidence: number;
  let signals: string[];

  if (classification) {
    detectedCategory =
      classification.category;
    detectedDocumentType =
      classification.documentType;
    confidence =
      classification.confidence;
    signals = [
      ...classification.signals,
    ];
  } else {
    detectedCategory =
      filenameHintCategory;
    detectedDocumentType =
      filenameHintDocumentType;
    confidence =
      detectedCategory === "other"
        ? 0.2
        : 0.38;
    signals = [
      "filename/path fallback",
    ];
    if (
      method !==
      "unreadable"
    ) {
      method =
        "metadata_fallback";
    }
  }

  const declaredCategory =
    input.declaredCategory
      ?.trim() || null;
  const declaredDocumentType =
    input.declaredDocumentType
      ?.trim() || null;

  const declaredConflict =
    declaredCategory !== null &&
    declaredCategory !==
      "other" &&
    declaredCategory !==
      detectedCategory;

  const filenameConflict =
    filenameHintCategory !==
      "other" &&
    filenameHintCategory !==
      detectedCategory;

  const typeConflict =
    filenameHintDocumentType !==
      "supporting_document" &&
    filenameHintDocumentType !==
      detectedDocumentType;

  const classificationConflict =
    declaredConflict ||
    filenameConflict ||
    typeConflict;

  if (
    classificationConflict
  ) {
    diagnostics.push(
      "DOCUMENT_METADATA_CONTENT_CONFLICT",
    );
  }

  if (
    ocrUsed &&
    ocrConfidence !== null &&
    ocrConfidence < 0.65
  ) {
    diagnostics.push(
      "DOCUMENT_OCR_LOW_CONFIDENCE",
    );
  }

  const needsReview =
    method === "unreadable" ||
    confidence < 0.62 ||
    (
      classificationConflict &&
      confidence < 0.82
    ) ||
    (
      ocrUsed &&
      (
        ocrConfidence === null ||
        ocrConfidence < 0.65
      )
    );

  return {
    identification: {
      verifiedMediaType:
        mediaType,
      detectedCategory,
      detectedDocumentType,
      confidence:
        Number(
          confidence.toFixed(
            4,
          ),
        ),
      method,
      ocrUsed,
      ocrConfidence:
        ocrConfidence === null
          ? null
          : Number(
              ocrConfidence.toFixed(
                4,
              ),
            ),
      pageCount,
      extractedCharacterCount:
        meaningfulCharacters(
          text,
        ),
      detectedTitle:
        firstTitle(text),
      filenameHintCategory,
      filenameHintDocumentType,
      declaredCategory,
      declaredDocumentType,
      classificationConflict,
      needsReview,
      signals,
      diagnostics: [
        ...diagnostics,
      ],
    },
    textSample:
      text.slice(
        0,
        SAMPLE_LIMIT,
      ),
  };
}
