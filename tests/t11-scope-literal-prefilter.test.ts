import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyScheduleActivity,scopeLiteralPrefilterRulesForTest} from '../packages/runtime-api/src/schedule-scope-classification';
import type {CanonicalScheduleModel,CanonicalScheduleActivity} from '../packages/schedule-analysis-core/src';

// Representative construction programme activity names (P6 style, English and
// Arabic, mixed case, codes and separators). Written for this test; no customer
// document is copied.
const activityNames=[
  'Install Chilled Water Pipework - Level 03 Zone B','Pour Concrete Slab L2 Pour 3','Blockwork Partition Walls Floor 5',
  'Fire Alarm Cabling Tower A','Testing & Commissioning HVAC System 2','LV Switchgear Installation Building 3',
  'Excavation Plot 12','Curtain Wall Installation Façade North','FAÇADE cladding panels Block C','Ceiling Tiles Fixing Area 4',
  'Landscaping Works Phase 2','Roadworks CH 1+250 to 2+000','Submit Shop Drawings - Subcontractor ABC Trading',
  'Procurement Package PKG-07 Approval','Cost Code 3100 Structural Steel','CBS: 21.400 rebar','صب خرسانة الطابق الثالث',
  'تركيب أنظمة التكييف برج 2 منطقة أ','أعمال مبنى 4 مستوى 2','Work Front 3 Handover','WorkFront-7 release','ELV Containment CCTV',
  'Sprinkler Pipe Install Basement B2','Information and Communications Technology Room Fit-out','SCADA integration',
  'Process Piping Skid','process','Clean utilities loop','Utilities diversion','MEP coordination','Earthworks cut and fill',
  'Rebar fixing columns','Plastering internal walls','AHU installation roof RF','Story 4 finishes','Storey G finishes',
  'FLR B1 tiling','Installation Civil Zone 3','Installation Mechanical Zone 12','Installation Electrical Zone 88',
  'Main Contractor mobilisation','Section 2B drainage','Trade: Joinery works','Fire-fighting pump room','Fire pump test',
  'Water supply connection','Access Control doors','Structured Cabling backbone','Extra Low Voltage risers',
  'Programmable Logic Controller panel','Transformer energisation MV','HV cable pulling','FCU and ductwork level 7',
  'Infrastructure handover','Steel structure erection','Architectural mock-up','Plot 4A boundary wall','Bldg 2 lvl 3 duct',
];
const ids=['A1000','ACC-0-123','ZN-01','PLOT-9','L3-SLAB','MEP.200','CH-12','SYS-4','PKG7','E-100','Ü-1','K1','İ2'];
// Every listed literal, its long forms, and characters that stress the
// case-insensitive rules (dotted I, Kelvin sign, long s, ç, ß, Arabic).
const fragments=[...new Set(scopeLiteralPrefilterRulesForTest().flatMap(row=>row.literals))].concat([
  'communications technology','information & communication technology','process engineering','process systems','process equipment',
  'process activity','fire fighting','firefighting','duct','ductwork','finishes','tile','tiling','landscape','earthwork','roadworks',
  'structural','structure','façade','facade','storey','story','floor','chainage','cost code','subcontractor','contractor',
  'İ','ı','K','ſ','ç','Ç','ß','ﬁ','منطقة','طابق','دور','مستوى','برج','مبنى',' ','  ','-',':','#','|','>',' | ',' > ','/','+','.','_','&',
  '0','1','12','3+250','B2','G','GF','RF','ROOF','LG1','P2','a','b','x','7a',
]);

function rng(seed:number){let x=seed>>>0;return()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/0x100000000;};}
function randomCase(text:string,next:()=>number){
  let out='';for(const ch of text)out+=/[a-z]/i.test(ch)?(next()<0.5?ch.toUpperCase():ch.toLowerCase()):ch;return out;
}
function generatedTexts(count:number){
  const next=rng(20261019);const texts:string[]=[];
  for(let i=0;i<count;i++){
    const roll=next();let text:string;
    if(roll<0.35){
      // The exact activity text shape: name, then " | ", then the source Activity ID.
      const name=activityNames[Math.floor(next()*activityNames.length)]!;
      text=(next()<0.3?randomCase(name,next):name)+' | '+ids[Math.floor(next()*ids.length)]!;
    }else{
      const parts=1+Math.floor(next()*6);const pieces:string[]=[];
      for(let p=0;p<parts;p++){
        const fragment=fragments[Math.floor(next()*fragments.length)]!;
        pieces.push(next()<0.5?randomCase(fragment,next):fragment);
        const sep=next();pieces.push(sep<0.5?' ':sep<0.6?'':sep<0.75?' | ':sep<0.85?'-':' > ');
      }
      text=pieces.join('');
    }
    texts.push(text);
  }
  return texts;
}

test('T11 scope prefilter: every skipped expression provably cannot match (per pattern, 200k texts)',()=>{
  const rows=scopeLiteralPrefilterRulesForTest().filter(row=>row.literals.length>0);
  // 26 spatial readers less 5 always-run Arabic readers, 16 joined discipline rules, 52 discipline parts.
  assert.equal(rows.length,21+16+52);
  for(const row of rows){
    // The proof needs case-insensitive matching without the u flag, and no lastIndex state.
    assert.ok(row.pattern.flags.includes('i'),row.source);
    for(const flag of ['u','v','g','y'])assert.ok(!row.pattern.flags.includes(flag),row.source+' must not use '+flag);
    for(const literal of row.literals)assert.match(literal,/^[a-z ]+$/,row.source+' literal must be lowercase ASCII');
  }
  const matched=new Map<string,number>();
  for(const text of generatedTexts(200_000)){
    const lowered=text.toLowerCase();
    for(const row of rows){
      if(!row.pattern.test(text))continue;
      matched.set(row.source+'|'+row.pattern.source,(matched.get(row.source+'|'+row.pattern.source)??0)+1);
      assert.ok(row.literals.some(literal=>lowered.includes(literal)),
        row.source+' matched '+JSON.stringify(text)+' without any of '+JSON.stringify(row.literals));
    }
  }
  // Not vacuous: every prefiltered expression matched generated text at least once.
  for(const row of rows)assert.ok((matched.get(row.source+'|'+row.pattern.source)??0)>0,'no generated text matched '+row.source+' '+row.pattern.source);
});

// Expected values were produced by v/int2 (before the prefilter) for the same inputs.
test('T11 scope prefilter keeps the exact classification of real-shape activity names',()=>{
  const projectId='TEST-SCOPE-PREFILTER';
  const model:CanonicalScheduleModel={projectId,source:'xer',sourceRevisionId:'R1',dataDateIso:'2031-01-01',
    activities:[],relationships:[],wbs:[],calendars:[],diagnostics:[]} as unknown as CanonicalScheduleModel;
  const activity=(name:string,activityId:string):CanonicalScheduleActivity=>({projectId,activityId,nativeId:activityId,name,wbsId:null,
    calendarId:'C',activityType:'task',status:'not_started',baselineStartIso:null,baselineFinishIso:null,currentStartIso:null,
    currentFinishIso:null,actualStartIso:null,actualFinishIso:null,forecastStartIso:null,forecastFinishIso:null,originalDurationHours:8,
    remainingDurationHours:8,totalFloatHours:0,freeFloatHours:null,percentComplete:0,sourceRefs:[],diagnostics:[]}) as CanonicalScheduleActivity;
  const pick=(name:string,id:string)=>{const row=classifyScheduleActivity(model,activity(name,id),new Map());
    return {zone:row.zone,floor:row.floor,level:row.level,tower:row.tower,building:row.building,area:row.area,plot:row.plot,
      workFront:row.workFront,section:row.section,chainage:row.chainage,discipline:row.discipline,trade:row.trade,system:row.system,
      package:row.package,cbs:row.cbs,contractor:row.contractor,subcontractor:row.subcontractor,location:row.location};};
  assert.deepEqual(pick('Install Chilled Water Pipework - Level 03 Zone B','A1000'),{zone:'Zone B',floor:null,level:'Level 03',tower:null,
    building:null,area:null,plot:null,workFront:null,section:null,chainage:null,discipline:null,trade:null,system:null,package:null,cbs:null,
    contractor:null,subcontractor:null,location:'Zone B / Level 03'});
  assert.equal(pick('LV Switchgear Installation Building 3','E-100').discipline,'Electrical');
  assert.equal(pick('LV Switchgear Installation Building 3','E-100').building,'Building 3');
  assert.equal(pick('MEP coordination','X1').discipline,'MEP');
  assert.equal(pick('FCU and ductwork level 7','M1').discipline,'Mechanical');
  assert.equal(pick('Mechanical Electrical coordination','M2').discipline,null);
  assert.equal(pick('FAÇADE cladding panels Block C','F1').discipline,'Facade');
  assert.equal(pick('Roadworks CH 1+250 to 2+000','R1').chainage,'Chainage 1+250');
  // The source Activity ID is part of the classified text and still counts.
  assert.equal(pick('General works','ZONE-4').zone,'Zone 4');
  assert.equal(pick('General works','PLOT-9').plot,'Plot 9');
});
