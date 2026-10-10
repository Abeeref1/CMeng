// Read-only, fail-closed root acceptance over the entire visible project inventory.
// Never run against a production release being redeployed or modified.
// An absent independent source oracle or rendered-screen report is a FAILED gate.
import {createHash} from 'node:crypto';
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {moduleRegistry}=require('../dist/packages/runtime-api/src/registry.js');
const {projectFactConsumerMismatches}=require('../dist/packages/runtime-api/src/project-fact-consumers.js');
const base=String(process.env.CMENG_RAILWAY_URL||'').replace(/\/$/,'');
const expected=String(process.env.CMENG_EXPECTED_RELEASE||'');
const output=process.env.CMENG_ROOT_ACCEPTANCE_OUTPUT||'cmeng-all-project-root-acceptance.json';
const screensFile=process.env.CMENG_SCREEN_ACCEPTANCE_OUTPUT||'';
const oracleDir=process.env.CMENG_SOURCE_ORACLES_DIR||'tests/acceptance/source-oracles';
const maxBytes=2_000_000;
const rootIds=Array.from({length:9},(_,i)=>'R'+(i+1));
if(!base||!/^[0-9a-f]{40}$/.test(expected))throw Error('Set CMENG_RAILWAY_URL and exact CMENG_EXPECTED_RELEASE');
if(moduleRegistry.length<58)throw Error('58-module minimum inventory is missing');
const report={release:expected,scope:'all portfolio projects, every page and every root',projectCount:0,
  pageInventory:moduleRegistry.length,projects:[],roots:Object.fromEntries(rootIds.map(id=>[id,{status:'unverified',projectsPassed:0,projectsFailed:0}])),
  status:'running',errors:[]};
const record=(project,root,condition,reason)=>{
  if(!condition)project.roots[root].push(reason);
  return !!condition;
};
const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const dateOnly=x=>typeof x==='string'&&/^\d{4}-\d{2}-\d{2}/.test(x)?x.slice(0,10):null;
const addDays=(date,days)=>{
  const day=dateOnly(date);
  if(day===null||!Number.isInteger(days))return null;
  const v=new Date(day+'T00:00:00.000Z');
  v.setUTCDate(v.getUTCDate()+days);
  return v.toISOString().slice(0,10);
};
const daysBetween=(a,b)=>a&&b?(Date.parse(b.slice(0,10))-Date.parse(a.slice(0,10)))/86400000:null;
const path=(id,suffix)=>'/api/projects/'+encodeURIComponent(id)+suffix;
function jsonAt(obj,key){return key.split('.').reduce((a,k)=>a?.[k],obj);}
async function request(p){
  const res=await fetch(base+p,{signal:AbortSignal.timeout(90000),headers:{accept:'application/json'}});
  if(res.status!==200){await res.body?.cancel();throw Error('HTTP '+res.status+' at '+p);}
  const declared=Number(res.headers.get('content-length')??0);
  if(declared>maxBytes){await res.body?.cancel();throw Error('PAGE_OVER_2MB:'+declared+':'+p);}
  if(!res.body)throw Error('EMPTY_BODY:'+p);
  const chunks=[];let bytes=0;
  const reader=res.body.getReader();
  while(true){
    const {value,done}=await reader.read();
    if(done)break;
    bytes+=value.byteLength;
    if(bytes>maxBytes){await reader.cancel();throw Error('PAGE_OVER_2MB:'+bytes+':'+p);}
    chunks.push(value);
  }
  return {bytes,body:JSON.parse(Buffer.concat(chunks.map(x=>Buffer.from(x))).toString('utf8'))};
}
function getScreenManifest(){
  if(!screensFile||!existsSync(screensFile))return null;
  return JSON.parse(readFileSync(screensFile,'utf8'));
}
function getSourceOracle(id){
  const filename=oracleDir+'/'+encodeURIComponent(id)+'.json';
  if(!existsSync(filename))return null;
  return JSON.parse(readFileSync(filename,'utf8'));
}
const modulePath=(id,entry)=>path(id,entry.area==='management'?'/management/'+entry.key:
  '/'+entry.area+'/modules/'+entry.key);

try{
  const health=(await request('/health')).body;
  if(health.status!=='ok'||health.release!==expected)throw Error('Wrong release at start: '+health.release);
  const portfolio=(await request('/api/portfolio')).body;
  if(!Array.isArray(portfolio.projects)||portfolio.projects.length===0)throw Error('Project inventory empty or inaccessible');
  const projects=portfolio.projects;
  if(portfolio.projectCount!==projects.length)throw Error('Portfolio inventory count disagrees');
  const ids=new Set(projects.map(x=>x.projectId));
  if(ids.size!==projects.length)throw Error('Duplicate project IDs in inventory');
  report.projectCount=projects.length;
  report.inventoryFingerprint=hash([...ids].sort());
  const manifest=getScreenManifest();

  for(const card of projects){
    const id=card.projectId;
    const p={projectId:id,version:card.version,roots:Object.fromEntries(rootIds.map(root=>[root,[]])),
      pagesChecked:0,pagesTooLarge:[],pageErrors:[],sourcesChecked:0};
    report.projects.push(p);
    const modules=new Map();
    let actions=null,docs=null,overview=null;
    try{overview=(await request(path(id,'/overview'))).body;}
    catch(err){record(p,'R9',false,'Overview could not be verified: '+String(err));}
    try{actions=(await request(path(id,'/actions'))).body;}
    catch(err){record(p,'R3',false,'Action route inventory unavailable: '+String(err));}
    try{docs=(await request(path(id,'/evidence/documents'))).body;}
    catch(err){record(p,'R4',false,'Source-column inventory unavailable: '+String(err));}

    for(const entry of moduleRegistry){
      const url=modulePath(id,entry);
      try{
        const result=await request(url);
        p.pagesChecked++;
        modules.set(entry.key,result.body);
      }catch(err){
        const msg=String(err);
        p.pageErrors.push({page:entry.key,error:msg.slice(0,220)});
        if(msg.includes('PAGE_OVER_2MB'))p.pagesTooLarge.push(entry.key);
        record(p,'R8',false,entry.key+': '+msg.slice(0,180));
        record(p,'R1',false,entry.key+' could not be compared against the shared facts');
      }
    }
    record(p,'R8',p.pagesChecked===moduleRegistry.length,
      'Only '+p.pagesChecked+'/'+moduleRegistry.length+' modules loaded under 2 MB with HTTP 200');

    let canonical=null,canonicalHash=null;
    for(const [key,answer] of modules){
      const facts=answer?.data?.projectFacts;
      record(p,'R1',!!facts&&facts.projectId===id&&facts.projectVersion===card.version,
        key+': canonical facts missing or wrong project/version');
      if(!facts)continue;
      const value=hash(facts);
      if(canonicalHash===null){canonical=facts;canonicalHash=value;}
      else record(p,'R1',value===canonicalHash,key+': project facts differ from another page');
      const differences=projectFactConsumerMismatches(answer.data);
      record(p,'R1',differences.length===0,key+': consumer values differ: '+differences.slice(0,5).map(x=>x.path).join(', '));
    }
    record(p,'R1',canonical!==null,'No canonical project facts observed');
    if(canonical){
      const same=(left,right)=>left===right||left==null&&right==null;
      record(p,'R1',same(card.submittedProgrammeCompletionIso,canonical.schedule.submittedProgrammeCompletionIso.value),
        'Portfolio submitted completion differs from canonical facts');
      record(p,'R1',same(card.submittedDaysAfterCurrentContract,canonical.time.submittedDaysAfterCurrentContract?.value),
        'Portfolio submitted variance differs from canonical facts');
      record(p,'R1',same(card.managementActionCount,canonical.actions.openCount.value),
        'Portfolio action count differs from canonical facts');

      // R5: verify official EOT without double counting an amendment.
      const time=canonical.time;const eot=time.awardedEotDays.value;
      const original=dateOnly(time.contractualCompletionIso.value);
      const adjusted=dateOnly(time.extendedContractCompletionIso.value);
      if(eot!==null&&eot>0){
        record(p,'R5',!!original&&!!adjusted,'Approved EOT exists but adjusted contract date missing');
        const chain=modules.get('eot-assessment')?.data?.timeBasisReconciliation;
        if(chain?.overlapResolution==='unresolved')
          record(p,'R5',false,'Determination/amendment overlap unresolved; no double-count proof');
        else if(original&&adjusted){
          const additional=chain?.additionalApprovedEotDays??(chain?.overlapResolution?null:eot);
          record(p,'R5',additional!==null&&addDays(original,additional)===adjusted,
            'Adjusted date does not reconcile with supported additional EOT days');
        }
        record(p,'R5',time.submittedDaysAfterCurrentContract?.value===null||
          same(time.submittedDaysAfterCurrentContract.value,daysBetween(adjusted,timeSourceFinish(canonical))),
          'Reported contract lateness was not calculated against adjusted finish');
      }
      const submitted=dateOnly(canonical.schedule.submittedProgrammeCompletionIso.value);
      const liveIndependent=modules.get('independent-forecast')?.data;
      const independent=dateOnly(liveIndependent?.independentForecastCompletionIso);
      const anomaly=(liveIndependent?.assumptions??[]).concat(liveIndependent?.diagnostics??[])
        .some(x=>/CALENDAR_SEMANTICS_UNRESOLVED|CALENDAR_WORK_PATTERN_NOT_ESTABLISHED|SOURCE_DURATION_ELAPSED_DAY_PATTERN_REQUIRES_CALENDAR_RECONCILIATION/.test(x));
      const shown=canonical.time.independentDaysAfterCurrentContract?.value!==null&&
        canonical.time.independentDaysAfterCurrentContract?.value!==undefined;
      record(p,'R5',!shown||!anomaly,
        'Calendar recalculation visible in canonical management values although semantics are unresolved');
      record(p,'R5',!shown||!submitted||!independent||Math.abs(daysBetween(submitted,independent))<=1,
        'Calendar recalculation differs >1 day from submitted schedule but appears in management facts');

      for(const money of canonical.commercial.currencies){
        const portfolioMoney=card.commercialSummary?.find(row=>row.currency===money.currency);
        record(p,'R1',!!portfolioMoney&&same(portfolioMoney.currentContractValue,money.currentContractValue.value)&&
          same(portfolioMoney.certifiedUnpaidAmount,money.certifiedUnpaidAmount.value),
          money.currency+': portfolio commercial totals differ from canonical');
      }
    }

    // R2: independent source rows must be retained as values (not blocked).
    const sourceOracle=getSourceOracle(id);
    record(p,'R2',sourceOracle!==null&&sourceOracle.projectId===id,
      'Independent source-file answer key missing for '+id);
    if(sourceOracle){
      record(p,'R2',sourceOracle.basis==='independent_original_source'&&
        !!sourceOracle.reviewedBy&&!!sourceOracle.dataDateIso,
        'Answer key must identify original-source method, independent reviewer and data date');
      const oracleDocs=new Map((sourceOracle.documents??[]).map(d=>[d.sourceHash,d]));
      for(const d of docs?.documents??[]){
        if(d.basisState==='superseded'||d.basisState==='scenario')continue;
        const proof=oracleDocs.get(d.sourceHashSha256);
        record(p,'R2',!!proof&&proof.sourceFilename===d.sourceFilename&&proof.reviewed===true,
          'Document has no independent source check '+d.sourceFilename);
        for(const table of d.columnUsage??[]){
          const observedColumns=[...(table.mappedColumns??[]),...(table.ignoredColumns??[])];
          for(const header of observedColumns){
            if(!header)continue;
            const checked=proof?.columns?.find(c=>c.name===header&&
              (c.disposition==='mapped'||c.disposition==='unused_with_reason'));
            record(p,'R4',!!checked,
              d.sourceFilename+': missing checked column disposition for '+header);
            if((table.ignoredColumns??[]).includes(header)){
              record(p,'R4',!!checked&&checked.disposition==='unused_with_reason'&&
                typeof checked.reason==='string'&&checked.reason.trim().length>0,
                d.sourceFilename+': ignored column has no accepted reason '+header);
              record(p,'R4',!!checked&&checked.containsSourceDatesNumbersDays!==true,
                d.sourceFilename+': ignored source column contains date/number/day values '+header);
            }
          }
        }
      }
      for(const x of sourceOracle.values??[]){
        p.sourcesChecked++;
        const actual=jsonAt(canonical,x.canonicalFactPath||'');
        record(p,'R2',!!x.sourceFilename&&!!x.sourceLocator&&!!x.sourceHash,
          'Missing independent source receipt for '+(x.canonicalFactPath||'field'));
        if(x.sourceValue!==null&&x.sourceValue!==undefined)
          record(p,'R2',actual&&actual.value!==null&&actual.value!==undefined,
            'Readable source value withheld at '+x.canonicalFactPath);
        if(actual?.state==='missing'&&x.sourceValue!==null)
          record(p,'R2',false,x.canonicalFactPath+' marked missing despite source data');
        if(actual?.state==='from_register_not_confirmed')
          record(p,'R2',!!actual.basis&&x.sourceValue!==null,
            'Qualified source value needs an explanatory basis at '+x.canonicalFactPath);
      }
      record(p,'R2',(sourceOracle.values??[]).length>0,'Source oracle has no field comparisons');
    }

    // R3: actions are never anonymous or impossible to resolve.
    const work=actions?.actions??[];
    record(p,'R3',actions!==null&&Array.isArray(actions.actions),'Action register missing');
    const seen=new Set();
    for(const a of work){
      const owner=String(a.owner??'').trim(),target=a.target||{},resolution=a.resolution||{};
      record(p,'R3',owner.length>0&&!/^(not assigned|unknown|unresolved)$/i.test(owner),
        'Unassigned action '+a.id);
      record(p,'R3',!!target.label&&!!target.type&&!!resolution.instruction&&resolution.requiresUserAction!==false,
        'No declared working resolution route for '+a.id);
      record(p,'R3',target.type!=='module'||!!target.moduleKey,
        'Unlinked module action '+a.id);
      record(p,'R6',!seen.has(a.id),'Duplicate action identity '+a.id);
      seen.add(a.id);
    }
    const top=work.slice(0,10);
    record(p,'R6',top.every(a=>a.priorityBasis?.linkedFloatHours!==null&&
      a.priorityBasis?.linkedFloatHours!==undefined||a.priorityBasis?.drivingPath===true),
      'One of the first ten actions is not linked to open programme work');

    // R4: every numeric/date/day-bearing source column must be mapped or explained.
    record(p,'R4',docs!==null&&docs.documentCount===docs.documents?.length,'Source document inventory incomplete');
    for(const d of docs?.documents??[]){
      for(const t of d.columnUsage??[]){
        record(p,'R4',t.recognitionState==='recognized',
          d.sourceFilename+' table '+t.table+' header not recognized');
        const skipped=(t.ignoredColumns??[]).filter(h=>/date|day|time|amount|value|money|quantity|qty|rate|percent|%|cost|paid|certif|claim|eot|duration|تاريخ|مبلغ|قيمة|يوم|مدة|كمية|سعر/i.test(h));
        record(p,'R4',skipped.length===0,d.sourceFilename+' unaccounted numerical/date columns: '+skipped.join(', '));
      }
      if(d.schemaHeaders?.length&&!d.columnUsage?.length)
        record(p,'R4',false,d.sourceFilename+': structured columns not assigned to a recognized table');
    }

    // R7: actual rendered texts, not JSON, must be checked on every surface.
    const screen=manifest?.projects?.find(row=>row.projectId===id);
    record(p,'R7',!!screen&&screen.release===expected,'No rendered-page proof for exact SHA and '+id);
    record(p,'R7',!!screen&&screen.surfaces?.length>=62,'Fewer than 62 screen surfaces inspected');
    for(const surface of screen?.surfaces??[]){
      const content=String(surface.text??'');
      const banned=[/\bnot established\b/i,/\bnot assigned\b/i,/\b(?:evidence-document|schedrev_|boqingest_|data\.position|data\.reportingContract)\b/i,
        /\b-?\d+\.\d{5,}\b/];
      const bannedHits=Array.isArray(surface.bannedTokens)?surface.bannedTokens:
        banned.filter(pattern=>pattern.test(content)).map(pattern=>({code:String(pattern)}));
      record(p,'R7',bannedHits.length===0&&Number(surface.renderedLength)>10&&!surface.error,
        surface.key+': banned text, missing rendered content or failed browser navigation');
      record(p,'R8',Number(surface.bytes)>0&&Number(surface.bytes)<=maxBytes,
        surface.key+': browser-page response over 2 MB or unmeasured');
      record(p,'R8',!surface.error,surface.key+': browser error '+surface.error);
    }

    // R9: every root must have positive page/source/screen coverage.
    record(p,'R9',p.pagesChecked===moduleRegistry.length,'Incomplete module/API coverage');
    record(p,'R9',p.sourcesChecked>0,'Independent source-column proof absent');
    record(p,'R9',!!screen&&screen.surfaces?.length>=62,'Rendered 62-surface audit missing');
    report.projects[report.projects.length-1]=p;
    writeFileSync(output,JSON.stringify(report,null,2));
    console.log(JSON.stringify({project:id,checked:p.pagesChecked,total:moduleRegistry.length,
      failures:Object.fromEntries(rootIds.map(root=>[root,p.roots[root].length]))}));
  }

  const after=(await request('/health')).body;
  if(after.release!==expected)report.errors.push('Release changed during acceptance');
  for(const root of rootIds){
    const failures=report.projects.filter(p=>p.roots[root].length);
    report.roots[root]={status:failures.length===0&&report.projects.length===report.projectCount&&report.errors.length===0?'pass':'fail',
      projectsPassed:report.projects.length-failures.length,projectsFailed:failures.length};
  }
  report.roots.R9.status=rootIds.every(root=>report.roots[root].status==='pass')?'pass':'fail';
  report.status=rootIds.every(root=>report.roots[root].status==='pass')?'pass':'fail';
}catch(error){
  report.errors.push(error instanceof Error?error.message:String(error));
  report.status='fail';
}finally{
  writeFileSync(output,JSON.stringify(report,null,2));
  console.log(JSON.stringify({release:report.release,scope:report.scope,status:report.status,projects:report.projectCount,
    roots:report.roots,errors:report.errors}));
  if(report.status!=='pass')process.exitCode=1;
}
function timeSourceFinish(facts){return facts.schedule.submittedProgrammeCompletionIso.value;}
