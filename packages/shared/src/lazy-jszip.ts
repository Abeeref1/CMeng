import type JSZipModule from 'jszip';

let loaded:typeof JSZipModule|undefined;
/** T11: JSZip is loaded on first archive use instead of at every
 * project-worker start. It returns the same constructor a default import of
 * 'jszip' gives. */
export function jsZip():typeof JSZipModule{
  if(!loaded){
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const module=require('jszip');
    loaded=(module&&module.__esModule?module.default:module) as typeof JSZipModule;
  }
  return loaded;
}
