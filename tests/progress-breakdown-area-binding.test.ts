import test from 'node:test';
import assert from 'node:assert/strict';
import {bindMeasuredAreasToWbs} from '../packages/runtime-api/src/progress-breakdown-source-area';

const area=(overrides:Record<string,unknown>={})=>({
  area:'Villa Type B (Medium)',currency:'QAR',itemCount:64,measuredItemCount:64,
  physicalProgressPercent:70.94307130027428,certifiedProgressPercent:null,
  physicalBasis:'Installed value / priced BOQ scope value.',
  certificationBasis:'Certification allocated only when source explicitly identifies the area.',
  ...overrides,
});
const projection=()=>({
  rows:[{wbsId:'15',wbsName:'Villa Type B (Medium)',physicalMeasuredPercent:null,certifiedPhysicalPercent:null}],
  dimensionViews:[{dimension:'wbs',rows:[{groupKey:'15',groupLabel:'Villa Type B (Medium)',classified:true,physicalMeasuredPercent:null,certifiedPhysicalPercent:null}]}],
});

test('S-19: exact sole BOQ area populates primary WBS progress with original source percentage',()=>{
  const before=projection();
  const result=bindMeasuredAreasToWbs(before,{kind:'area_progress',areas:[area()]});
  assert.equal(result.rows[0]!.physicalMeasuredPercent,70.94307130027428);
  assert.equal(result.dimensionViews[0]!.rows[0]!.physicalMeasuredPercent,70.94307130027428);
  assert.equal((result.dimensionViews[0]!.rows[0] as any).areaProgressAuthority,'unique_exact_source_area_to_wbs_name');
  assert.equal(before.rows[0]!.physicalMeasuredPercent,null,'underlying schedule projection unchanged');
  assert.equal(result.rows[0]!.certifiedPhysicalPercent,null,'missing certified value does not turn to zero');
});

test('S-19: mismatched area or ambiguous multi-currency area never receives invented progress',()=>{
  const base=projection();
  assert.equal(bindMeasuredAreasToWbs(base,{kind:'area_progress',areas:[area({area:'Different zone'})]}).rows[0]!.physicalMeasuredPercent,null);
  assert.equal(bindMeasuredAreasToWbs(base,{kind:'area_progress',areas:[area(),area({currency:'SAR'})]}).rows[0]!.physicalMeasuredPercent,null);
  const duplicate=projection();
  duplicate.dimensionViews[0]!.rows.push({...duplicate.dimensionViews[0]!.rows[0]!,groupKey:'X'});
  assert.equal(bindMeasuredAreasToWbs(duplicate,{kind:'area_progress',areas:[area()]}).dimensionViews[0]!.rows[0]!.physicalMeasuredPercent,null);
});

test('S-19: same explicit area supports certified percentage only when sourced',()=>{
  const result=bindMeasuredAreasToWbs(projection(),{kind:'area_progress',areas:[area({physicalProgressPercent:null,certifiedProgressPercent:38.75})]});
  assert.equal(result.rows[0]!.physicalMeasuredPercent,null);
  assert.equal(result.rows[0]!.certifiedPhysicalPercent,38.75);
  assert.equal(result.dimensionViews[0]!.rows[0]!.certifiedPhysicalPercent,38.75);
});
