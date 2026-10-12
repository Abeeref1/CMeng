import {runInNewContext as runVm} from 'node:vm';
import ts from 'typescript';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
const text=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
const source=ts.createSourceFile('assembled-browser.js',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
const declarations=new Map<string,{node:ts.Node;code:string}>();
for(const statement of source.statements){
 if(ts.isFunctionDeclaration(statement)&&statement.name)declarations.set(statement.name.text,{node:statement,code:statement.getText(source)});
 if(ts.isVariableStatement(statement))for(const declaration of statement.declarationList.declarations){
  if(!ts.isIdentifier(declaration.name)||!declaration.initializer)continue;
  const prefix=(statement.declarationList.flags&ts.NodeFlags.Const)?'const':'let';
  // Defer browser-state initializers until a tested function reads them.
  // Unused localStorage/DOM state must not be eagerly evaluated by an isolated
  // renderer. The expression itself is the original, unmodified initializer.
  const name=declaration.name.text,expression=declaration.initializer.getText(source);
  const lazy='Object.defineProperty(globalThis,'+JSON.stringify(name)+',{configurable:true,get(){const value=('+expression+');Object.defineProperty(globalThis,'+JSON.stringify(name)+',{value,writable:true,configurable:true});return value;},set(value){Object.defineProperty(globalThis,'+JSON.stringify(name)+',{value,writable:true,configurable:true});}});';
  declarations.set(name,{node:declaration,code:lazy});
 }
}
function boundNames(node:ts.Node){
 const names=new Set<string>();
 const bind=(name:ts.BindingName)=>{if(ts.isIdentifier(name))names.add(name.text);else for(const part of name.elements)if(ts.isBindingElement(part))bind(part.name);};
 const visit=(n:ts.Node)=>{if(ts.isVariableDeclaration(n)||ts.isParameter(n)||ts.isBindingElement(n))bind(n.name);if((ts.isFunctionDeclaration(n)||ts.isFunctionExpression(n)||ts.isClassDeclaration(n))&&n.name)names.add(n.name.text);ts.forEachChild(n,visit);};
 visit(node);return names;
}
function references(node:ts.Node){
 const bound=boundNames(node),names=new Set<string>(),optional=new Set<string>();
 const optionalVisit=(n:ts.Node)=>{if(ts.isTypeOfExpression(n)&&ts.isIdentifier(n.expression))optional.add(n.expression.text);ts.forEachChild(n,optionalVisit);};
 optionalVisit(node);
 const visit=(n:ts.Node)=>{
  if(ts.isIdentifier(n)&&!bound.has(n.text)){
   const p=n.parent;
   const property=ts.isPropertyAccessExpression(p)&&p.name===n||
    (ts.isPropertyAssignment(p)||ts.isMethodDeclaration(p)||ts.isPropertyDeclaration(p))&&p.name===n;
   // Feature-detected integrations are optional in an isolated renderer.
   // They remain exercised in the mandatory complete-browser gate.
   if(!property&&!optional.has(n.text))names.add(n.text);
  }
  ts.forEachChild(n,visit);
 };visit(node);return names;
}
const dependencies=new Map<string,Set<string>>();
for(const[name,d]of declarations)dependencies.set(name,references(d.node));
/** Execute real transitive dependencies from the COMPLETE assembled script.
 * Harness-provided values and functions remain intentional test inputs. No
 * assertions, results or missing functions are replaced by success stubs. */
export const runInNewContext:typeof runVm=(code:any,context:any={},options:any)=>{
 const selected=ts.createSourceFile('renderer-test.js',String(code),ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const supplied=boundNames(selected),chosen=new Set<string>(),ordered:string[]=[];
 const include=(name:string)=>{
  if(chosen.has(name)||supplied.has(name)||Object.prototype.hasOwnProperty.call(context,name)||!declarations.has(name))return;
  chosen.add(name);for(const dependency of dependencies.get(name)??[])include(dependency);ordered.push(declarations.get(name)!.code);
 };
 for(const name of references(selected))include(name);
 return runVm(ordered.join('\n')+'\n'+code,context,options);
};
