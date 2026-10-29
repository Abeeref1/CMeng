import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {RuntimeProjectStore} from '../packages/runtime-api/src/project-state';
import {operationalControlsAsOf} from '../packages/runtime-api/src/operational-reporting';
import {canonicalHeader} from '../packages/truth-kernel/src';

// M12.1 invariant: an NCR register's "Responsible Party" is the record owner on
// every reader; in a claims register it keeps its own meaning.
test('M12.1: the responsible party is the owner of an NCR, and keeps its meaning in a claims register',async t=>{
  assert.equal(canonicalHeader('Responsible Party','delay_eot_claims_register'),'responsible party');
  const dir=mkdtempSync(join(tmpdir(),'cmeng-m121-'));t.after(()=>rmSync(dir,{recursive:true,force:true}));
  const store=new RuntimeProjectStore({dataDir:dir,durable:false}),state=store.getOrCreate('M121');
  await store.ingestEvidenceFile({projectId:'M121',bytes:Buffer.from('NCR ID,Description,Responsible Party,Status,Date Raised\nN1,Weld defect,QA Manager,Open,2026-08-01\n'),mediaType:'text/csv',sourceFilename:'NCR.csv',uploadedAt:'2026-09-01'});
  const ncrs=(operationalControlsAsOf(state,'2026-09-01') as any).quality.current as any[];
  assert.equal(ncrs.length,1);assert.equal(ncrs[0].owner,'QA Manager');
});

// M12.1 (role tables): one PMC role table. The action owner fallback, the
// accountability groups and the browser review list give the same role for the
// same domain, HSE and quality included.
test('M12.1: every owner fallback reads the one PMC role table, server and browser alike',async()=>{
  const {pmcRoleFor,pmcRoleSource}=await import('../packages/runtime-api/src/pmc-roles');
  const {pmcRoleOwner}=await import('../packages/runtime-api/src/action-priority');
  const {runInNewContext}=await import('node:vm');
  const browser=runInNewContext(pmcRoleSource()+';pmcRoleFor',{});
  for(const domain of ['risk','rfi','design','ncr','quality','hse','permit','procurement','long-lead','claim','notice','bond','payment','schedule','forecast','delivery','other']){
    const role=pmcRoleFor(domain);
    assert.equal(pmcRoleOwner(domain),'PMC '+role+' — individual not designated',domain+': action owner');
    assert.equal(browser(domain),role,domain+': browser list');
  }
  assert.equal(pmcRoleFor('hse'),'HSE Manager','HSE is not the quality manager');
  assert.equal(pmcRoleFor('ncr'),'Quality Manager');
});

// Mechanism guard: the page script never references a server module (an
// injected function that imports would throw in the browser and blank a page),
// and the page's owner fallback equals the server's for every domain.
test('M12.1: the page script holds no server module reference; the browser owner fallback equals the server one',async()=>{
  const {cmengUatHtml}=await import('../packages/runtime-api/src/ui') as any;
  const html=typeof cmengUatHtml==='function'?cmengUatHtml():cmengUatHtml;
  assert.deepEqual([...new Set([...String(html).matchAll(/\(0, ([a-z_0-9]+_1)\.[A-Za-z]+\)/g)].map(m=>m[1]))],[],'no CommonJS module reference in the page');
  const {pmcRoleSource,pmcRoleOwnerSource}=await import('../packages/runtime-api/src/pmc-roles');
  const {pmcRoleOwner}=await import('../packages/runtime-api/src/action-priority');
  const {runInNewContext}=await import('node:vm');
  const browser=runInNewContext(pmcRoleSource()+pmcRoleOwnerSource()+';pmcRoleOwner',{});
  for(const domain of ['risk','ncr','hse','payment','schedule','other'])for(const owner of [null,'','TBD','Ahmed (QA)']){
    assert.equal(browser(domain,owner),pmcRoleOwner(domain,owner),domain+' / '+owner);
  }
});
