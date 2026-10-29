import type {CanonicalScheduleModel} from '../../schedule-analysis-core/src';

// P0-C (C11, was M8.1): CMeng links register records to programme activities
// itself. Real projects do not share IDs across registers and the programme, so
// an exact "linked activity" column is rare. Deterministic rules, in order of
// strength; no AI and no guessing between equal candidates:
//   1. the record cites an activity ID in any of its cells;
//   2. the record states a WBS code that the programme holds;
//   3. the record's description matches one activity's name clearly better
//      than any other (rare shared words weigh more).
// A proposal is used as the record's link with its basis stated, so the pages
// can answer now; the user confirms or corrects it in one place. Equal or weak
// candidates give no link and are listed for a choice.

export type ActivityLinkBasis='stated_activity'|'cited_activity_id'|'wbs_code'|'name_match';
export interface ActivityLinkPosition{
  state:'stated'|'proposed'|'ambiguous'|'none';
  basis:ActivityLinkBasis|null;
  activityIds:string[];
  score:number|null;
  candidates:Array<{activityId:string;name:string|null;score:number}>;
  reason:string;
}
type RecordLike={reference:string|null;description:string|null;fields:Record<string,unknown>};

const STOP=new Set(['the','and','for','with','from','into','onto','over','under','all','any','per','via','of','to','in','at','on','by','or','an','a',
  'works','work','package','packages','item','items','supply','scope','phase','stage','general','misc','miscellaneous','various','other','project','level','area','zone',
  'rfi','ncr','submittal','permit','test','record','register','request','issue','status','open','closed','approved','pending']);
const ID_FIELDS=/(?:^|\s)(?:id|ref|reference|no|number|code)$/;
const TEXT_FIELDS=['description','package name','name','subject','title','scope','work description','activity description','activity','item description','location description','system','element'];
const norm=(v:unknown)=>String(v??'').normalize('NFKC').toLowerCase();
function words(text:string){return norm(text).split(/[^\p{L}\p{N}]+/u).filter(w=>w.length>=3&&!STOP.has(w)&&!/^\d+$/.test(w));}

const linkers=new WeakMap<object,(r:RecordLike)=>ActivityLinkPosition>();
/** One linker per programme model (built once; the indexes are reused for every record). */
export function registerActivityLinker(model:CanonicalScheduleModel|null|undefined){
  if(!model)return buildLinker(model);
  let linker=linkers.get(model);if(!linker){linker=buildLinker(model);linkers.set(model,linker);}
  return linker;
}

// Text split into letter-or-digit segments, keeping the exact characters between them.
function segments(text:string){const out:{start:number;end:number}[]=[];const re=/[\p{L}\p{N}]+/gu;let m:RegExpExecArray|null;while((m=re.exec(text)))out.push({start:m.index,end:m.index+m[0].length});return out;}

function buildLinker(model:CanonicalScheduleModel|null|undefined){
  const activities=(model?.activities??[]).filter(a=>a.activityType!=='wbs_summary'&&a.activityType!=='level_of_effort');
  if(!activities.length)return (_r:RecordLike):ActivityLinkPosition=>({state:'none',basis:null,activityIds:[],score:null,candidates:[],reason:'No current programme is adopted.'});
  // 1. Activity IDs a cell can cite: at least three characters with a digit. An ID is
  // found where it stands between non-letter, non-digit characters (leftmost, longest).
  const byId=new Map<string,string>();let maxSegments=1;
  for(const a of activities){const id=norm(a.activityId).trim();if(id.length>=3&&/\d/.test(id)){byId.set(id,a.activityId);maxSegments=Math.max(maxSegments,segments(id).length);}}
  const citedIn=(text:string,into:Set<string>)=>{
    const seg=segments(text);
    for(let i=0;i<seg.length;){
      let found=-1;
      for(let j=Math.min(seg.length-1,i+maxSegments-1);j>=i;j--){const id=byId.get(text.slice(seg[i]!.start,seg[j]!.end));if(id){into.add(id);found=j;break;}}
      i=found>=0?found+1:i+1;
    }
  };
  // 2. WBS codes and the activities under each (descendants included).
  const children=new Map<string,string[]>();for(const w of model?.wbs??[])if(w.parentWbsId){const list=children.get(w.parentWbsId)??[];list.push(w.wbsId);children.set(w.parentWbsId,list);}
  const wbsByCode=new Map<string,string>();for(const w of model?.wbs??[]){for(const key of [w.code,w.wbsId])if(key&&norm(key).trim().length>=2)wbsByCode.set(norm(key).trim(),w.wbsId);}
  const byWbs=new Map<string,string[]>();for(const a of activities)if(a.wbsId){const list=byWbs.get(a.wbsId)??[];list.push(a.activityId);byWbs.set(a.wbsId,list);}
  const activitiesUnder=(wbsId:string)=>{const ids:string[]=[];const seen=new Set<string>();const stack=[wbsId];while(stack.length){const id=stack.pop()!;if(seen.has(id))continue;seen.add(id);ids.push(...(byWbs.get(id)??[]));stack.push(...(children.get(id)??[]));}return ids;};
  // 3. Name words, weighted by how rare they are among activity names; an inverted
  // index so a record is compared only with activities that share a word.
  // Activities are numbered in ID order (the tie-break), and each word lists the
  // activities whose name holds it. Scores accumulate in flat arrays, so a record
  // costs the length of its words' lists and nothing else.
  const ordered=[...activities].sort((x,y)=>x.activityId.localeCompare(y.activityId));
  const lists=new Map<string,number[]>();
  ordered.forEach((a,i)=>{for(const w of new Set(words(a.name??''))){const list=lists.get(w)??[];list.push(i);lists.set(w,list);}});
  const index=new Map([...lists].map(([w,list])=>[w,Int32Array.from(list)]));
  const idf=(w:string)=>Math.log(1+ordered.length/(index.get(w)?.length??0.5));
  const nameTotal=new Float64Array(ordered.length);for(const [w,list] of index){const v=idf(w);for(const i of list)nameTotal[i]=nameTotal[i]!+v;}
  const weight=new Float64Array(ordered.length),count=new Uint16Array(ordered.length),touched=new Int32Array(ordered.length);

  return (record:RecordLike):ActivityLinkPosition=>{
    const own=norm(record.reference).trim();
    // Rule 1: cited activity IDs anywhere in the record (not its own reference).
    if(byId.size){
      const cited=new Set<string>();
      for(const [key,value] of Object.entries(record.fields)){
        const text=norm(value);if(!text||text.trim()===own)continue;
        citedIn(text,cited);
        if(ID_FIELDS.test(key)&&byId.has(text.trim()))cited.add(byId.get(text.trim())!);
      }
      if(cited.size)return {state:'proposed',basis:'cited_activity_id',activityIds:[...cited],score:1,candidates:[],
        reason:'The record cites '+(cited.size===1?'activity '+[...cited][0]:cited.size+' activity IDs')+'.'};
    }
    // Rule 2: a stated WBS code the programme holds.
    for(const [key,value] of Object.entries(record.fields)){
      if(!/wbs/.test(key))continue;
      const wbsId=wbsByCode.get(norm(value).trim());if(!wbsId)continue;
      const ids=activitiesUnder(wbsId);
      if(ids.length&&ids.length<=60)return {state:'proposed',basis:'wbs_code',activityIds:ids,score:1,candidates:[],
        reason:'The record states WBS '+String(value).trim()+', which holds '+ids.length+' programme '+(ids.length===1?'activity':'activities')+'.'};
    }
    // Rule 3: a clear best name match.
    const text=TEXT_FIELDS.map(f=>record.fields[f]).filter(Boolean).join(' ')||String(record.description??'');
    const mine=[...new Set(words(text))];
    if(!mine.length)return {state:'none',basis:null,activityIds:[],score:null,candidates:[],reason:'The record has no description to match.'};
    // Overlap measured against the shorter of the two texts: a record usually says
    // more than the activity name, and an activity name more than a short record.
    const total=mine.reduce((s,w)=>s+idf(w),0);
    let n=0;
    for(const w of mine){const list=index.get(w);if(!list)continue;const v=idf(w);for(let k=0;k<list.length;k++){const i=list[k]!;if(count[i]===0)touched[n++]=i;count[i]=count[i]!+1;weight[i]=weight[i]!+v;}}
    // Keep the best three (score, then activity ID); clear the arrays for the next record.
    const top:{i:number;shared:number;score:number}[]=[];
    for(let k=0;k<n;k++){const i=touched[k]!;const score=weight[i]!/Math.max(1e-9,Math.min(total,nameTotal[i]||total));
      if(top.length<3||score>top[top.length-1]!.score||(score===top[top.length-1]!.score&&i<top[top.length-1]!.i)){
        top.push({i,shared:count[i]!,score});top.sort((x,y)=>y.score-x.score||x.i-y.i);if(top.length>3)top.pop();}
      weight[i]=0;count[i]=0;}
    const scored=top.map(t=>({activityId:ordered[t.i]!.activityId,name:ordered[t.i]!.name??null,shared:t.shared,score:t.score}));
    const best=scored[0],second=scored[1];
    const candidates=scored.slice(0,3).map(c=>({activityId:c.activityId,name:c.name,score:Math.round(c.score*100)/100}));
    if(!best||best.score<0.3)return {state:'none',basis:null,activityIds:[],score:best?candidates[0]!.score:null,candidates,reason:'No activity name matches the record.'};
    const clear=best.score>=0.5&&(best.shared>=2||best.score>=0.8)&&(!second||second.score<=best.score*0.75);
    if(!clear)return {state:'ambiguous',basis:null,activityIds:[],score:candidates[0]!.score,candidates,reason:'Several activity names match the record equally well; choose the right one.'};
    return {state:'proposed',basis:'name_match',activityIds:[best.activityId],score:candidates[0]!.score,candidates,
      reason:'The record\'s description matches activity '+best.activityId+(best.name?' ('+best.name+')':'')+' better than any other.'};
  };
}
