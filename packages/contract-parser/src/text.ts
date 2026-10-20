import type {
  ContractTextBlock,
  ContractTextSource,
} from "./types";

/** Read a plain-text or Markdown contract from its exact source bytes.
 * The byte order mark names the encoding (UTF-8 otherwise). The text is
 * complete only when every byte decodes and no NUL character is present
 * (NUL means binary content or a wrong encoding). Nothing is inferred. */
export function parseContractTextSource(
  bytes: Uint8Array,
  format: ContractTextSource["format"] = "plain",
): ContractTextSource {
  let encoding: ContractTextSource["encoding"] = "utf-8";
  let offset = 0;
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) offset = 3;
  else if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = "utf-16le"; offset = 2; }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { encoding = "utf-16be"; offset = 2; }
  const body = bytes.subarray(offset);
  const diagnostics: string[] = [];
  let text: string;
  let unreadableCharacterCount = 0;
  try {
    text = new TextDecoder(encoding, { fatal: true }).decode(body);
  } catch {
    // Keep what decodes; count the replaced sequences as not read.
    text = new TextDecoder(encoding).decode(body);
    unreadableCharacterCount = Math.max(1, [...text.matchAll(/�/g)].length);
    diagnostics.push("CONTRACT_TEXT_UNDECODABLE_SEQUENCES:" + unreadableCharacterCount + ":" + encoding);
  }
  const nul = [...text.matchAll(/\u0000/g)].length;
  if (nul > 0) {
    unreadableCharacterCount += nul;
    diagnostics.push("CONTRACT_TEXT_NUL_CHARACTERS:" + nul);
  }
  const segments = text.split("\f");
  // A form feed that only ends the last page does not start another page.
  if (segments.length > 1 && segments.at(-1) === "") segments.pop();
  const paged = segments.length > 1;
  return {
    format,
    encoding,
    byteCount: bytes.length,
    characterCount: text.length,
    unreadableCharacterCount,
    pages: segments.map((segment, index) => ({
      pageNumber: paged ? index + 1 : null,
      text: segment,
    })),
    complete: unreadableCharacterCount === 0,
    diagnostics,
  };
}

/** The text blocks the shared contract reader segments. Markdown heading
 * markers are blanked with spaces of the same length, so a "## 1 Definitions"
 * heading is read like "1 Definitions" and every source offset still points at
 * the original text. The retained source pages are not changed. */
export function contractBlocksFromText(
  source: ContractTextSource,
): ContractTextBlock[] {
  return source.pages.map((page, index) => ({
    sourceKind: "text_page" as const,
    sourceIndex: page.pageNumber ?? index + 1,
    page: page.pageNumber,
    block: null,
    text:
      source.format === "markdown"
        ? page.text.replace(/^( {0,3})(#{1,6})(?=[ \t]|$)/gm, (_match, indent: string, marks: string) => indent + " ".repeat(marks.length))
        : page.text,
  }));
}
