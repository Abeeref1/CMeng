import iconv from "iconv-lite";
import type {
  XerDecodedSource,
  XerDiagnostic,
  XerEncoding,
} from "./types";

function isValidUtf8(bytes: Uint8Array): boolean {
  try {
    new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return true;
  } catch {
    return false;
  }
}

function stripLeadingBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function detectUtf16WithoutBom(bytes: Uint8Array): "utf16le" | "utf16be" | null {
  const sampleLength = Math.min(bytes.length, 4096);
  if (sampleLength < 8) return null;

  let evenNulls = 0;
  let oddNulls = 0;
  let even = 0;
  let odd = 0;

  for (let i = 0; i < sampleLength; i += 1) {
    if (i % 2 === 0) {
      even += 1;
      if (bytes[i] === 0) evenNulls += 1;
    } else {
      odd += 1;
      if (bytes[i] === 0) oddNulls += 1;
    }
  }

  const evenRatio = evenNulls / Math.max(even, 1);
  const oddRatio = oddNulls / Math.max(odd, 1);

  if (oddRatio > 0.2 && evenRatio < 0.05) return "utf16le";
  if (evenRatio > 0.2 && oddRatio < 0.05) return "utf16be";
  return null;
}

function splitRawLines(bytes: Uint8Array): Uint8Array[] {
  const lines: Uint8Array[] = [];
  let start = 0;

  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0x0a) {
      let end = i;
      if (end > start && bytes[end - 1] === 0x0d) end -= 1;
      lines.push(bytes.slice(start, end));
      start = i + 1;
    }
  }

  if (start <= bytes.length) {
    lines.push(bytes.slice(start));
  }
  return lines;
}

function decodeSingleByteOrUtf8(bytes: Uint8Array): XerDecodedSource {
  const diagnostics: XerDiagnostic[] = [];
  const rawLines = splitRawLines(bytes);
  const decodedLines: string[] = [];
  const lineEncodings: XerEncoding[] = [];

  let sawUtf8 = false;
  let saw1256 = false;

  rawLines.forEach((line, index) => {
    if (isValidUtf8(line)) {
      const decoded = stripLeadingBom(new TextDecoder("utf-8").decode(line));
      decodedLines.push(decoded);
      lineEncodings.push("utf8");
      sawUtf8 = true;
    } else {
      const decoded = stripLeadingBom(iconv.decode(Buffer.from(line), "windows-1256"));
      decodedLines.push(decoded);
      lineEncodings.push("windows-1256");
      saw1256 = true;
      diagnostics.push({
        code: "XER_ENCODING_FALLBACK_1256",
        severity: "warning",
        message: "Line is not valid UTF-8 and was decoded as Windows-1256.",
        line: index + 1,
      });
    }
  });

  return {
    text: decodedLines.join("\n"),
    encoding:
      sawUtf8 && saw1256
        ? "mixed-utf8-windows1256"
        : saw1256
          ? "windows-1256"
          : "utf8",
    lineEncodings,
    diagnostics,
  };
}

export function decodeXerBytes(bytes: Uint8Array): XerDecodedSource {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes.slice(3));
    return {
      text,
      encoding: "utf8-bom",
      lineEncodings: text.split(/\r?\n/).map(() => "utf8-bom"),
      diagnostics: [],
    };
  }

  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    const text = iconv.decode(Buffer.from(bytes.slice(2)), "utf16-le");
    return {
      text: stripLeadingBom(text),
      encoding: "utf16le",
      lineEncodings: text.split(/\r?\n/).map(() => "utf16le"),
      diagnostics: [],
    };
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    const text = iconv.decode(Buffer.from(bytes.slice(2)), "utf16-be");
    return {
      text: stripLeadingBom(text),
      encoding: "utf16be",
      lineEncodings: text.split(/\r?\n/).map(() => "utf16be"),
      diagnostics: [],
    };
  }

  const utf16 = detectUtf16WithoutBom(bytes);
  if (utf16) {
    const text = iconv.decode(
      Buffer.from(bytes),
      utf16 === "utf16le" ? "utf16-le" : "utf16-be",
    );
    return {
      text: stripLeadingBom(text),
      encoding: utf16,
      lineEncodings: text.split(/\r?\n/).map(() => utf16),
      diagnostics: [
        {
          code: "XER_UTF16_INFERRED_WITHOUT_BOM",
          severity: "warning",
          message: `Detected ${utf16} from byte pattern because no BOM was present.`,
        },
      ],
    };
  }

  return decodeSingleByteOrUtf8(bytes);
}
