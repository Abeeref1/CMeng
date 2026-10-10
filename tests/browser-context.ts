import {runInNewContext as runVm} from 'node:vm';
import {createSourceFile,ScriptTarget,isFunctionDeclaration} from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
const source=createSourceFile('assembled-browser.js',cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!,ScriptTarget.Latest,true);
const helpers=['managementValueState','managementNumber','managementDate','managementValue','pmcRoleOwner','humanizeIsoText','planningShortDate'];
const declarations=source.statements.filter(isFunctionDeclaration).filter(n=>n.name&&helpers.includes(n.name.text));
/** Isolated renderer tests use the same dependencies as the assembled browser.
 * Explicit test doubles are preserved. No assertion or expected value is bypassed. */
export const runInNewContext:typeof runVm=(code:any,context:any={},options:any)=>{
 const prelude=declarations.filter(n=>!Object.prototype.hasOwnProperty.call(context,n.name!.text)).map(n=>n.getText(source)).join('\n');
 return runVm(prelude+'\n'+code,context,options);
};
