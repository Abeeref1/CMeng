import test from "node:test";
import assert from "node:assert/strict";

import { assessClaimPopulationIntegrity } from "../packages/runtime-api/src/canonical-time-claims";
import type {
  CanonicalClaimRecord,
  CanonicalDelayEvent,
} from "../packages/delay-analysis-core/src";

function population(count:number, options:{genericTitles?:boolean;linkedActivities?:boolean;arithmeticDays?:boolean}={}) {
  const genericTitles=options.genericTitles??true;
  const linkedActivities=options.linkedActivities??false;
  const arithmeticDays=options.arithmeticDays??true;
  const claims:CanonicalClaimRecord[]=[];
  const events:CanonicalDelayEvent[]=[];
  const letters=new Map<string,string>();
  for(let index=1;index<=count;index+=1){
    const serial=String(index).padStart(4,"0");
    const claimId="CLM-"+serial;
    const eventId="EVT-"+serial;
    claims.push({
      claimId,
      title:genericTitles?"Delay event "+serial:"Access restriction at Zone "+index,
      state:"submitted",
      eventIds:[eventId],
      submittedAt:"2026-06-01",
      claimedDays:arithmeticDays?12+(index-1)*7:12+((index*index)%17),
      claimedAmount:null,
      assessedDays:null,
      assessedDaysState:"missing",
      assessedAmount:null,
      assessedAmountState:"missing",
      clauseIdentifiers:[],
      evidenceRefs:[],
      diagnostics:[],
    });
    events.push({
      eventId,
      title:genericTitles?"Delay event "+serial:"Access restriction at Zone "+index,
      category:"other",
      startIso:"2026-05-01",
      endIso:null,
      responsibility:"unknown",
      responsibilityState:"missing",
      describedImpactDays:arithmeticDays?12+(index-1)*7:12+((index*index)%17),
      describedImpactState:"candidate",
      relatedActivityIds:linkedActivities?["A-"+serial]:[],
      relatedClauseIdentifiers:[],
      evidenceRefs:[],
      diagnostics:[],
    });
    letters.set(claimId,"LTR-C-"+serial);
  }
  return {claims,events,letters};
}

test("quarantines the proven generated-looking claims signature without deleting source evidence",()=>{
  const data=population(180);
  const result=assessClaimPopulationIntegrity(
    data.claims,
    data.events,
    data.letters,
    ["CL01_Claims_Register_180.csv"],
  );
  assert.equal(result.state,"quarantined");
  assert.equal(result.sourceClaimCount,180);
  assert.equal(result.quarantinedClaimCount,180);
  assert.equal(result.linkedActivityEventCount,0);
  assert.equal(result.genericClaimEventPairCount,180);
  assert.equal(result.genericNoticePairCount,180);
  assert.equal(result.arithmeticClaimedDaysPrefixLength,180);
  assert.deepEqual(result.sourceFilenames,["CL01_Claims_Register_180.csv"]);
  assert.ok(result.reasons.includes("GENERATED_ARITHMETIC_CLAIM_DAY_PATTERN"));
});

test("does not quarantine a real linked population merely because IDs and notices are sequential",()=>{
  const data=population(180,{linkedActivities:true});
  const result=assessClaimPopulationIntegrity(data.claims,data.events,data.letters);
  assert.equal(result.state,"accepted");
  assert.equal(result.quarantinedClaimCount,0);
  assert.equal(result.linkedActivityEventCount,180);
});

test("does not quarantine meaningful non-generic claim narratives",()=>{
  const data=population(60,{genericTitles:false});
  const result=assessClaimPopulationIntegrity(data.claims,data.events,data.letters);
  assert.equal(result.state,"accepted");
  assert.equal(result.genericClaimEventPairCount,0);
});

test("does not quarantine a small population even when it happens to follow the same numbering pattern",()=>{
  const data=population(8);
  const result=assessClaimPopulationIntegrity(data.claims,data.events,data.letters);
  assert.equal(result.state,"accepted");
});
