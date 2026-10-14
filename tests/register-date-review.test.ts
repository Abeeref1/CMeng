import test from "node:test";
import assert from "node:assert/strict";

import {
  prepareRegisterRows,
  registerDate,
  type SourceTable,
} from "../packages/truth-kernel/src";
import {
  reviewRegisterDates,
} from "../packages/runtime-api/src/register-date-review";

function table(
  documentType: string,
  input: string[][],
): SourceTable {
  const prepared =
    prepareRegisterRows(
      input,
      documentType,
    );
  return {
    headers:
      prepared.headers,
    recognition: {
      headerRow:
        prepared.headerRow,
      readRowCount:
        prepared.readRowCount,
      recognized:
        prepared.recognized,
      unknown:
        prepared.unknown,
    },
    document: {
      documentId:
        documentType,
      sourceHashSha256:
        "hash-" +
        documentType,
      storedPath: "/tmp/" +
        documentType +
        ".csv",
      sourceFilename:
        documentType +
        ".csv",
      mediaType: "text/csv",
      basisState: "active",
      linkedArtifactId: null,
      uploadedAt:
        "2026-09-25T00:00:00Z",
      documentType,
    },
    rows:
      prepared.rows.map(
        (row, index) => ({
          cells:
            Object.freeze(
              Object.fromEntries(
                prepared.headers.map(
                  (header, col) => [
                    header,
                    row[col] ?? "",
                  ],
                ),
              ),
            ),
          receipt: {
            documentId:
              documentType,
            sourceHash:
              "hash-" +
              documentType,
            revision:
              "hash-" +
              documentType,
            locator:
              "row:" +
              (
                index +
                prepared.headerRow +
                1
              ),
            basisState:
              "active",
            authority:
              "source_record",
          },
        }),
      ),
  } as SourceTable;
}

test("common lifecycle date headers normalize without project-specific mapping", () => {
  const rfi =
    prepareRegisterRows(
      [
        [
          "RFI ID",
          "Raised",
          "Due Date",
          "Status",
        ],
        [
          "R1",
          "31/08/2026",
          "05/09/2026",
          "Open",
        ],
      ],
      "rfi_register",
    );

  assert.deepEqual(
    rfi.headers,
    [
      "rfi id",
      "raised date",
      "due date",
      "status",
    ],
  );
  assert.equal(
    rfi.rows[0]?.[1],
    "2026-08-31",
  );
  assert.equal(
    rfi.rows[0]?.[2],
    "2026-09-05",
  );

  const procurement =
    prepareRegisterRows(
      [
        [
          "Package ID",
          "Required on Site",
          "Forecast Delivery",
          "Status",
        ],
        [
          "P1",
          "15/09/2026",
          "20/09/2026",
          "Ordered",
        ],
      ],
      "procurement_register",
    );

  assert.equal(
    procurement.rows[0]?.[1],
    "2026-09-15",
  );
  assert.equal(
    procurement.rows[0]?.[2],
    "2026-09-20",
  );
});

test("register date review separates readable alternate dates from genuine source gaps", () => {
  const result =
    reviewRegisterDates([
      table(
        "rfi_register",
        [
          [
            "RFI ID",
            "Raised",
            "Due Date",
            "Status",
          ],
          [
            "R1",
            "31/08/2026",
            "05/09/2026",
            "Open",
          ],
        ],
      ),
      table(
        "procurement_register",
        [
          [
            "Package ID",
            "Required on Site",
            "Forecast Delivery",
            "Status",
          ],
          [
            "P1",
            "15/09/2026",
            "20/09/2026",
            "Ordered",
          ],
        ],
      ),
      table(
        "payment_certificates",
        [
          [
            "Certificate No",
            "Period End",
            "Net Certified",
            "Status",
          ],
          [
            "IPC-1",
            "31/08/2026",
            "100",
            "Certified",
          ],
        ],
      ),
      table(
        "delay_eot_claims_register",
        [
          [
            "Claim ID",
            "Notice Date",
            "Days Claimed",
            "Status",
          ],
          [
            "C1",
            "30/08/2026",
            "7",
            "Submitted",
          ],
        ],
      ),
      table(
        "risk_register",
        [
          [
            "Risk ID",
            "Description",
            "Rating",
            "Status",
          ],
          [
            "R1",
            "Late access",
            "High",
            "Open",
          ],
        ],
      ),
    ]);

  assert.equal(
    result.likelyMappingFault,
    false,
    "one genuinely undated source family must not be called a CMeng mapping fault",
  );

  const byType =
    new Map(
      result.rows.map(
        (row) => [
          row.documentType,
          row,
        ],
      ),
    );

  for (
    const type of [
      "rfi_register",
      "procurement_register",
      "payment_certificates",
      "delay_eot_claims_register",
    ]
  ) {
    assert.equal(
      byType.get(type)?.valid,
      1,
      type,
    );
  }

  assert.equal(
    byType.get(
      "risk_register",
    )?.state,
    "column_not_found",
  );
});

test("known project-control register schemas are read as schemas, not false unreadable files", () => {
  const cases: Array<
    [string, string[][]]
  > = [
    [
      "wbs_dictionary",
      [
        [
          "WBS ID",
          "WBS Code",
          "WBS Name",
          "Level",
          "Parent WBS ID",
        ],
        [
          "1",
          "CIV",
          "Civil",
          "1",
          "",
        ],
      ],
    ],
    [
      "resource_register",
      [
        [
          "Resource ID",
          "Resource UID",
          "Class",
          "Trade",
          "Unit",
          "Week Start",
          "Available Capacity",
          "Planned Demand",
          "Actual Approved Usage",
        ],
        [
          "R1",
          "U1",
          "Labor",
          "Civil",
          "labor_hour",
          "31/08/2026",
          "100",
          "80",
          "75",
        ],
      ],
    ],
    [
      "design_deliverables",
      [
        [
          "Deliverable ID",
          "Discipline",
          "Planned Issue",
          "Actual Issue",
          "Status",
          "Revision",
        ],
        [
          "D1",
          "Civil",
          "31/08/2026",
          "01/09/2026",
          "Issued",
          "A",
        ],
      ],
    ],
    [
      "testing_commissioning_register",
      [
        [
          "Test ID",
          "System",
          "Test",
          "Planned Date",
          "Status",
          "Authority Witness",
        ],
        [
          "T1",
          "Electrical",
          "IST",
          "31/08/2026",
          "Planned",
          "Engineer",
        ],
      ],
    ],
    [
      "asset_register",
      [
        [
          "Asset ID",
          "System",
          "Tag Installed",
          "Commissioned",
          "O&M Manual",
          "Warranty",
        ],
        [
          "A1",
          "HVAC",
          "Yes",
          "No",
          "Yes",
          "Yes",
        ],
      ],
    ],
  ];

  for (const [type, rows] of cases) {
    const prepared =
      prepareRegisterRows(
        rows,
        type,
      );
    assert.equal(
      prepared.recognized,
      true,
      type +
        ": " +
        prepared.unknown.join(
          ", ",
        ),
    );
  }
});


test("T02/SW-13 source date reading accepts both Arabic digit alphabets without changing evidence or unknowns",()=>{
  const fixtures:[string,string|null][]=[
    ["۳۱/۰۸/۲۰۳۴","2034-08-31"],
    ["٣١/٠٨/٢٠٣٤","2034-08-31"],
    ["۲۰۳۴-۰۸-۳۱","2034-08-31"],
    ["2034-08-31","2034-08-31"],
    ["31 Aug 2034","2034-08-31"],
    ["۲۰۳۴-۰۲-۳۱",null],
    ["۳۱/۱۳/۲۰۳۴",null],
    ["UNKNOWN",null],
    ["",null],
  ];
  for(const [source,expected] of fixtures){
    for(let i=0;i<5;i++)assert.equal(registerDate(source),expected,"date evidence "+JSON.stringify(source));
  }
  // Source table controls retain the supplied cell separately from its dated
  // projection. Both matched and withheld dates must remain distinguishable.
  const prepared=prepareRegisterRows([
    ["Package ID","Required on Site","Forecast Delivery","Status"],
    ["P-EASTERN","۳۱/۰۸/۲۰۳۴","۲۰۳۴-۰۹-۰۵","Ordered"],
    ["P-INVALID","۳۱/۱۳/۲۰۳۴","","Unknown"],
  ],"procurement_register");
  assert.equal(prepared.recognized,true);
  assert.deepEqual(prepared.rows.map(row=>row.slice(1,3)),[
    ["2034-08-31","2034-09-05"],
    ["۳۱/۱۳/۲۰۳۴",""],
  ]);
  for(let i=0;i<5000;i++)assert.equal(registerDate("unreadable-"+i),null);
  assert.equal(registerDate("۳۱/۰۸/۲۰۳۴"),"2034-08-31","bounded cache eviction must not change date meaning");
});
