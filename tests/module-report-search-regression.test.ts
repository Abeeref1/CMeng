import test from "node:test";
import assert from "node:assert/strict";
import {preparedModuleResult} from "../packages/runtime-api/src/module-report";

const result:any={
  key:"report-search-regression",
  status:"ready",
  engineState:"ready",
  evidenceState:"established",
  professionalState:"defensible",
  reason:null,
  dependencies:[],
  data:{
    rows:[{activityId:"A-1",name:"Zone one work"},{activityId:"A-2",name:"Zone two work"}],
    activityIds:["A-1","A-2"],
    nested:{labels:["Zone one","Zone two"]},
  },
};

test("report global search removes both object and primitive table populations when nothing matches",()=>{
  const prepared:any=preparedModuleResult(result,{filters:{search:"__CMENG_NO_MATCH__"}});
  assert.deepEqual(prepared.data.rows,[]);
  assert.deepEqual(prepared.data.activityIds,[]);
  assert.deepEqual(prepared.data.nested.labels,[]);
});

test("report global search keeps only matching object and primitive entries",()=>{
  const prepared:any=preparedModuleResult(result,{filters:{search:"A-2"}});
  assert.deepEqual(prepared.data.rows,[{activityId:"A-2",name:"Zone two work"}]);
  assert.deepEqual(prepared.data.activityIds,["A-2"]);
  assert.deepEqual(prepared.data.nested.labels,[]);
});
