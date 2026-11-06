import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

test('generic evidence schedule upload does not run unrelated refresh families before returning',()=>{
  const source=readFileSync(join(process.cwd(),'packages/runtime-api/src/server.ts'),'utf8');
  const routeStart=source.indexOf('const result =\n      await runtimeProjects\n        .ingestEvidenceFile({');
  assert.notEqual(routeStart,-1,'generic evidence upload route must exist');
  const route=source.slice(routeStart,routeStart+4200);
  assert.match(route,/if\(result\.category!==["']schedule["']\)/,'schedule evidence must bypass unrelated refresh stack');
  const guarded=route.slice(route.indexOf('if(result.category'));
  assert.match(guarded,/refreshDeferredPdfReads\(projectId\)/);
  assert.match(guarded,/refreshSpreadsheetRegisters\(projectId\)/);
  assert.match(guarded,/refreshHseReports\(projectId\)/);
  assert.match(guarded,/refreshCorrespondenceNarratives/);
  assert.ok(route.indexOf('if(result.category') < route.indexOf('refreshDeferredPdfReads(projectId)'),
    'refresh stack must be inside the non-schedule guard');
});
