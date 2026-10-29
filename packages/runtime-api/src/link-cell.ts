// M8.2: one reader for a link cell. "A100; A200", "A100 | A200" and
// "A100, A200" are the same two IDs on every page. No imports: every reader
// can use it without a cycle.
export const LINKED_ACTIVITY_HEADERS=['linked activity','linked schedule activity','activity id','schedule activity'] as const;
export function splitLinkCell(value:unknown):string[]{return [...new Set(String(value??'').split(/[;|,]/).map(part=>part.trim()).filter(Boolean))];}
