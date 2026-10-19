import type * as FastXmlParser from 'fast-xml-parser';

let loaded:typeof FastXmlParser|undefined;
/** T11: fast-xml-parser is loaded on first XML use instead of at every
 * project-worker start. It returns the same module object a named import of
 * 'fast-xml-parser' reads from. */
export function fastXmlParser():typeof FastXmlParser{
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return loaded??=require('fast-xml-parser') as typeof FastXmlParser;
}
