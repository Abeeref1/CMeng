import test from "node:test";
import assert from "node:assert/strict";

/**
 * Test-only ORBIT golden contract.
 *
 * This is deliberately outside production code. It exists to prevent a future
 * release from redefining known source truth while still passing generic unit
 * tests. Runtime values must ultimately be compared with this contract by the
 * end-to-end ORBIT fixture runner; production code must never branch on these
 * values or the ORBIT project id.
 */
const ORBIT_ANSWERS: Array<[number, string]> = [
  [1,"ORBIT Jeddah Port Logistics & Automated Distribution Hub - EPC Package 3"],
  [2,"ORBIT-JED-PLH-P3"],
  [3,"Red Sea Logistics Infrastructure Company"],
  [4,"Meridian Port Programme Management"],
  [5,"Gulf Automated Logistics JV"],
  [6,"Jeddah Islamic Port Logistics Zone, Jeddah, Saudi Arabia"],
  [7,"SAR 7,800,000,000"],
  [8,"Exclusive of VAT"],
  [9,"SAR 450,000,000"],
  [10,"SAR 8,250,000,000"],
  [11,"1 April 2026"],
  [12,"31 December 2029"],
  [13,"15 August 2026"],
  [14,"90 calendar days"],
  [15,"31 March 2030"],
  [16,"28 days"],
  [17,"21 days"],
  [18,"84 days"],
  [19,"21 days"],
  [20,"C02 Amendment No. 1"],
  [21,"C01 Main EPC Contract and C02 Amendment No. 1"],
  [22,"C03 Automation Technical Appendix and C04 Port Authority Permit Conditions"],
  [23,"No"],
  [24,"L01 Letters / Notices Mixed PDF"],
  [25,"Yes"],
  [26,"Primavera XER"],
  [27,"S01 Baseline Rev0"],
  [28,"S03 Current U02"],
  [29,"31 August 2026"],
  [30,"S01 12,000; S02 12,400; S03 12,800"],
  [31,"121"],
  [32,"Yes, PROJWBS.parent_wbs_id"],
  [33,"6"],
  [34,"240"],
  [35,"22,049"],
  [36,"64,000"],
  [37,"ORB-PC-001"],
  [38,"31 December 2029"],
  [39,"30 June 2030"],
  [40,"+181 calendar days"],
  [41,"+91 calendar days"],
  [42,"No"],
  [43,"1,160"],
  [44,"203"],
  [45,"11,437"],
  [46,"99"],
  [47,"100"],
  [48,"101"],
  [49,"201"],
  [50,"503"],
  [51,"378"],
  [52,"125"],
  [53,"629"],
  [54,"128"],
  [55,"25"],
  [56,"12,700"],
  [57,"0.992 relationships/activity"],
  [58,"23.348 days"],
  [59,"Yes"],
  [60,"Yes"],
  [61,"Yes"],
  [62,"1,200 working days"],
  [63,"-72 working days"],
  [64,"CPLI = (Critical Path Length + Total Float) / Critical Path Length"],
  [65,"0.940"],
  [66,"Source-supported by S03, SCH01, SCH02 and REL01"],
  [67,"30 June 2030"],
  [68,"20 July 2030"],
  [69,"+20 calendar days"],
  [70,"+111 calendar days"],
  [71,"Remaining quantity / conservative achievable rate + interface allowance"],
  [72,"100 work packages"],
  [73,"WP-001"],
  [74,"No"],
  [75,"Labor 150; Equipment 60; Material 30"],
  [76,"210 resources, Labor + Equipment"],
  [77,"labor_hour"],
  [78,"equipment_hour"],
  [79,"Consumption only"],
  [80,"19,110 resource-week rows"],
  [81,"4,620 approved actual-usage resource-week rows"],
  [82,"96,918"],
  [83,"84.47%"],
  [84,"76.97%"],
  [85,"4,448"],
  [86,"462"],
  [87,"Planned Demand / Available Capacity x 100"],
  [88,"Actual Approved Usage / Available Capacity x 100"],
  [89,"Yes"],
  [90,"Yes, RES06"],
  [91,"30,000"],
  [92,"SAR 7,800,000,000"],
  [93,"Yes"],
  [94,"Yes"],
  [95,"225 variations totaling SAR 450,000,000"],
  [96,"Yes, SAR 8,250,000,000"],
  [97,"BAC SAR 8,250,000,000; PV SAR 2,000,000,000; EV SAR 1,850,000,000; AC SAR 1,950,000,000"],
  [98,"SPI 0.925; CPI 0.9487"],
  [99,"ETC SAR 6,600,000,000; EAC SAR 8,550,000,000"],
  [100,"VAC SAR -300,000,000"],
  [101,"Contract Value/BAC are approved control values; ETC/EAC/VAC are forecast-derived; PV/EV/AC are period control measures"],
  [102,"18"],
  [103,"350"],
  [104,"9,633 gross documentary claimed days"],
  [105,"2,456 days"],
  [106,"138 days"],
  [107,"-10 days"],
  [108,"-5 days"],
  [109,"42 days"],
  [110,"24 days"],
  [111,"24 days"],
  [112,"18 days"],
  [113,"Engineer Determination LTR-E-0077 and EOT03 determination register"],
  [114,"Meeting 046 closes ACT-EOT-077 and confirms 24 days awarded"],
  [115,"No; blank/unresolved is Not Determined, not zero"],
  [116,"800 risks: Extreme 80; High 240; Medium 320; Low 160"],
  [117,"2,400 procurement packages; 126 Overdue"],
  [118,"4,500 design deliverables (109 Overdue); 3,200 RFIs (74 Overdue); 4,200 submittals (113 Rejected)"],
  [119,"HSE: 12,800,000 manhours; 1 LTI; 5 MTC; 27 First Aid; 88 Near Misses; LTIFR 0.08; TRIR 0.34. Quality: 1,100 NCRs, 52 Open"],
  [120,"FM: 20,000 assets; 18,800 tagged; 17,600 commissioned; 16,900 O&M manuals; 18,100 valid warranties. Commissioning: 1,600 items, 400 Open Issue"],
];

const PROJECT_CONTROL_MODULES = [
  "pmo-analysis",
  "schedule-analytics",
  "activity-analytics",
  "lookahead-schedule",
  "schedule-change-report",
  "revision-trend",
  "milestones",
  "near-critical",
  "resource-utilization",
  "progress-report",
  "variance-trends",
  "progress-scurve",
  "quantity-scurve",
  "progress-breakdown",
  "manhour-scurve",
  "forecast-history",
  "independent-forecast",
  "delay-claims",
  "notices-claims",
  "windows-analysis",
  "eot-assessment",
  "challenge-contract",
] as const;

const MODULE_GOLDEN_CONCERNS: Record<
  (typeof PROJECT_CONTROL_MODULES)[number],
  number[]
> = {
  "pmo-analysis":[29,39,40,41,50,51,53,65],
  "schedule-analytics":[29,30,43,44,45,50,51,52,53,56,57],
  "activity-analytics":[43,44,45,50,51,52,53,54,55],
  "lookahead-schedule":[29,60,117,118],
  "schedule-change-report":[27,28,30,61],
  "revision-trend":[27,28,30,38,39,40],
  "milestones":[37,38,39,40,47,48,49],
  "near-critical":[52,53],
  "resource-utilization":[34,35,75,76,77,78,79,80,81,82,83,84,85,86,87,88,89,90],
  "progress-report":[43,44,45,97,98],
  "variance-trends":[38,39,40,41,50,51,53],
  "progress-scurve":[29,43,44,45],
  "quantity-scurve":[71,72,74,91],
  "progress-breakdown":[31,32,43,44,45],
  "manhour-scurve":[75,76,77,80,81,82,84],
  "forecast-history":[27,28,38,39,67,68,69],
  "independent-forecast":[39,41,67,68,69,70,71,73],
  "delay-claims":[103,104,105,106,107,108,109,110,111,112,113,114,115],
  "notices-claims":[16,17,18,20,103,113,114,115],
  "windows-analysis":[40,103,105,107,108,109],
  "eot-assessment":[14,15,20,103,105,106,109,110,111,112,113,114,115],
  "challenge-contract":[7,9,10,15,17,18,40,41,68,83,84,95,97,98,99,100,103,105,106,115],
};

test("ORBIT golden contract contains all 120 controlled answers", () => {
  assert.equal(
    ORBIT_ANSWERS.length,
    120,
  );
  assert.deepEqual(
    ORBIT_ANSWERS.map(
      ([number]) => number,
    ),
    Array.from(
      {length:120},
      (_,index)=>index+1,
    ),
  );
  assert.ok(
    ORBIT_ANSWERS.every(
      ([,answer]) =>
        answer.trim().length>0,
    ),
  );
});

test("all 22 Project Controls modules are bound to ORBIT golden concerns", () => {
  assert.equal(
    PROJECT_CONTROL_MODULES.length,
    22,
  );
  for (const key of PROJECT_CONTROL_MODULES) {
    const questions =
      MODULE_GOLDEN_CONCERNS[key];
    assert.ok(
      questions.length>0,
      key,
    );
    for (const question of questions) {
      assert.ok(
        question>=1 &&
        question<=120,
        key+" -> Q"+question,
      );
    }
  }
});

test("ORBIT P0/P1 source truth cannot regress silently", () => {
  const answer =
    new Map(
      ORBIT_ANSWERS,
    );

  assert.equal(answer.get(29),"31 August 2026");
  assert.equal(answer.get(37),"ORB-PC-001");
  assert.equal(answer.get(39),"30 June 2030");
  assert.equal(answer.get(40),"+181 calendar days");
  assert.equal(answer.get(41),"+91 calendar days");
  assert.equal(answer.get(53),"629");

  assert.equal(answer.get(76),"210 resources, Labor + Equipment");
  assert.equal(answer.get(80),"19,110 resource-week rows");
  assert.equal(answer.get(81),"4,620 approved actual-usage resource-week rows");
  assert.equal(answer.get(83),"84.47%");
  assert.equal(answer.get(84),"76.97%");
  assert.equal(answer.get(85),"4,448");
  assert.equal(answer.get(86),"462");

  assert.equal(answer.get(15),"31 March 2030");
  assert.equal(answer.get(14),"90 calendar days");
  assert.equal(answer.get(103),"350");
  assert.equal(answer.get(106),"138 days");
  assert.match(answer.get(115)!,/Not Determined, not zero/);

  assert.equal(answer.get(97),"BAC SAR 8,250,000,000; PV SAR 2,000,000,000; EV SAR 1,850,000,000; AC SAR 1,950,000,000");
  assert.equal(answer.get(98),"SPI 0.925; CPI 0.9487");
  assert.equal(answer.get(99),"ETC SAR 6,600,000,000; EAC SAR 8,550,000,000");
  assert.equal(answer.get(100),"VAC SAR -300,000,000");
});
