import test from 'node:test';
import assert from 'node:assert/strict';
import {runInNewContext} from 'node:vm';
import type {AddressInfo} from 'node:net';
import ExcelJS from 'exceljs';
import {moduleRegistry, moduleGroups, moduleTitles, scheduleModules, commercialModules} from '../packages/runtime-api/src/registry';
import {cmengUatHtml} from '../packages/runtime-api/src/ui';
import {buildModuleWorkbook, buildModuleJsonDownload, moduleReportFilename} from '../packages/runtime-api/src/module-report';
import {createCmengServer} from '../packages/runtime-api/src/server';

test('all 33 page titles and groups come from one registry, with distinct specialist purposes', () => {
  assert.equal(moduleRegistry.length, 33);
  assert.equal(new Set(moduleRegistry.map(m => m.key)).size, 33);
  assert.equal(new Set(moduleRegistry.map(m => m.title)).size, 33);
  assert.equal(scheduleModules.length, 22);
  assert.equal(commercialModules.length, 7);
  for (const word of ['claims', 'notices', 'eot', 'position', 'forecast']) {
    assert.ok(moduleRegistry.filter(m => new RegExp('\\b' + word + '\\b', 'i').test(m.title)).length <= 1, word);
  }
  assert.deepEqual(moduleGroups['Forecast & Finish'], ['forecast-history', 'independent-forecast', 'challenge-contract']);
  assert.ok(!moduleGroups['Delay & Time Entitlement']!.includes('challenge-contract'));
  assert.equal(moduleTitles['challenge-contract'], 'Challenge the Contract');
  assert.equal(moduleTitles['commercial-claims-notices'], 'Financial Claims');
  const html = cmengUatHtml();
  const prelude = html.slice(html.indexOf('const moduleRegistry='), html.indexOf('const roleViews='));
  const browserValues = JSON.parse(runInNewContext(prelude + '\nJSON.stringify({names,groups,descriptions})'));
  assert.deepEqual(browserValues.names, moduleTitles);
  assert.deepEqual(browserValues.groups, moduleGroups);
  for (const m of moduleRegistry) assert.equal(browserValues.descriptions[m.key], m.description);
  for (const old of ['Delivery Challenge', 'Notices, EOT & Claims', 'Delay Events & Claims', 'Claims & Notices', '4/6/8']) assert.ok(!html.includes(old), old);
  for (const heading of ['1. Challenge manpower plan', '2. Challenge current schedule', '3. Combined delivery challenge']) assert.ok(html.includes(heading));
});

test('API catalogues, JSON, Excel headings and filenames retain the same registry titles', async () => {
  const server = createCmengServer();
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    for (const [area, expected] of [['schedule', scheduleModules], ['commercial', commercialModules]] as const) {
      const response = await fetch(base + '/api/' + area + '/modules');
      assert.equal(response.status, 200);
      assert.deepEqual((await response.json()).modules, expected);
    }
    for (const m of moduleRegistry) {
      const result = {key:m.key, status:'partial' as const, reason:'Unresolved: fixture has no project evidence.', dependencies:[], data:{}};
      const json = JSON.parse(buildModuleJsonDownload('TITLE-CHECK',m.key,result).toString());
      assert.equal(json.report.module, m.title);
      assert.equal(json.report.moduleKey, m.key);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(await buildModuleWorkbook('TITLE-CHECK', m.key, result) as any);
      assert.equal(book.title, 'TITLE-CHECK - ' + m.title);
      assert.equal(book.getWorksheet('Report')!.getCell('B3').value, m.title);
      assert.ok(moduleReportFilename('TITLE-CHECK', m.key, 'xlsx').includes(m.title.replace(/[^A-Za-z0-9._-]+/g,'_')));
    }
  } finally {
    await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
