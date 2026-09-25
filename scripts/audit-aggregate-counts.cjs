// Review inventory, not a defect detector. Includes multiline expressions and
// the generated browser script; counts of known classifications can be valid.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const {cmengUatHtml} = require('../dist/packages/runtime-api/src/ui');
const findings = [];
function inspect(file, text) {
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  function visit(node) {
    if (ts.isPropertyAccessExpression(node) && node.name.text === 'length' && ts.isCallExpression(node.expression)
        && ts.isPropertyAccessExpression(node.expression.expression) && node.expression.expression.name.text === 'filter') {
      const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
      findings.push({file, line, expression: node.getText(source).replace(/\s+/g, ' ')});
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, {withFileTypes:true})) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file);
    else if (file.endsWith('.ts')) inspect(file, fs.readFileSync(file, 'utf8'));
  }
}
walk('packages');
const browser = cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)[1];
inspect('generated-browser.js', browser);
for (const row of findings) process.stdout.write(JSON.stringify(row)+'\n');
process.stderr.write(findings.length+' filtered count expressions. Inspect filtered-array aliases, reducers and source completeness too.\n');
