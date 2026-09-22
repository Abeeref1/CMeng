import test from 'node:test';
import assert from 'node:assert/strict';
import { runInNewContext } from 'node:vm';
import { createSourceFile, ScriptTarget, isFunctionDeclaration } from 'typescript';
import { cmengUatHtml } from '../packages/runtime-api/src/ui';

function functions(names: string[]) {
  const script=cmengUatHtml().match(/<script>([\s\S]*?)<\/script>/)![1]!;
  const source=createSourceFile('browser.js',script,ScriptTarget.Latest,true);
  const selected=source.statements.filter(isFunctionDeclaration).filter(node=>node.name && names.includes(node.name.text));
  assert.equal(selected.length,names.length);
  return selected.map(node=>node.getText(source)).join('\n');
}

test('S-Curve headline selects the exact Data Date observation in different browser timezones',()=>{
  const script=functions(['planningDateMs','renderProgressScurveVisual']);
  const data={projectionKey:'progress_scurve',dataDateIso:'2030-01-07T08:00:00',actualHistoryMode:'snapshot_history',points:[
    {dateIso:'2030-01-01T08:00:00Z',baselinePlannedPercent:12,currentForecastPercent:11,actualProgressPercent:10},
    {dateIso:'2030-01-07T08:00:00Z',baselinePlannedPercent:57.61,currentForecastPercent:56.21,actualProgressPercent:55.03},
    {dateIso:'2030-01-08T08:00:00Z',baselinePlannedPercent:80,currentForecastPercent:70,actualProgressPercent:null},
  ]};
  const previous=process.env.TZ;
  try {
    for(const zone of ['Asia/Dubai','America/Los_Angeles']) {
      process.env.TZ=zone;
      let kpis: any[]=[];
      runInNewContext(script+';renderProgressScurveVisual(data);',{
        data,projectionFor:(value: unknown)=>value,planningKpis:(rows:any[])=>{kpis=rows;return '';},
        fmt:String,escapeHtml:String,humanizeKey:String,renderLineChart:()=>'',
      });
      assert.equal(kpis[0][1],'57.61%',zone); assert.equal(kpis[1][1],'56.21%',zone); assert.equal(kpis[2][1],'55.03%',zone);
    }
  } finally { if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous; }
});

test('displayed progress variance reconciles rounded values without changing the source precision',()=>{
  const delta=runInNewContext(functions(['displayPercentDifference'])+';displayPercentDifference');
  assert.equal(delta(9.228,9.204),0.03); assert.equal(delta(null,9.204),null);
});
