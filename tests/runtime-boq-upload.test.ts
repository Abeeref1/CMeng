import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import ExcelJS from "exceljs";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";

async function xlsxBytes(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("BOQ");
  sheet.addRow([
    "Item",
    "Description",
    "Unit",
    "Qty",
    "Rate",
    "Amount",
    "Currency",
  ]);
  sheet.addRow([
    "1",
    "Excavation",
    "m3",
    100,
    20,
    2000,
    "AED",
  ]);
  return Buffer.from(
    await workbook.xlsx.writeBuffer(),
  );
}

test("runtime API accepts Excel BOQ upload and returns retrievable governed status", async () => {
  const server = createCmengServer();

  await new Promise<void>((resolve) => {
    server.listen(
      0,
      "127.0.0.1",
      () => resolve(),
    );
  });

  try {
    const address =
      server.address() as AddressInfo;
    const base =
      "http://127.0.0.1:" +
      address.port;

    const uploadBytes =
      new Uint8Array(await xlsxBytes());

    const upload = await fetch(
      base +
        "/api/projects/P-HTTP/boq/uploads",
      {
        method: "POST",
        headers: {
          "content-type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "x-source-filename":
            "priced-boq.xlsx",
        },
        body: uploadBytes,
      },
    );

    assert.equal(upload.status, 201);

    const created =
      await upload.json() as {
        ingestionId: string;
        sourceFormat: string;
        authority: string;
        persistence: string;
        state: string;
        candidateRows: number;
        verifiedRows: number;
        canonicalItemCount: number;
        evidenceReceiptId: string;
      };

    assert.equal(
      created.sourceFormat,
      "excel_ooxml",
    );
    assert.equal(
      created.authority,
      "candidate_only",
    );
    const expectedPersistence =
      process.env
        .CMENG_TEST_MODE
        ?.trim() === "1"
        ? "runtime_local"
        : process.env
            .RAILWAY_VOLUME_MOUNT_PATH
            ?.trim()
          ? "railway_volume"
          : "runtime_local";

    assert.equal(
      created.persistence,
      expectedPersistence,
    );
    assert.equal(
      created.state,
      "verified_candidate",
    );
    assert.equal(created.candidateRows, 1);
    assert.equal(created.verifiedRows, 1);
    assert.equal(
      created.canonicalItemCount,
      1,
    );
    assert.match(
      created.evidenceReceiptId,
      /^receipt_/,
    );

    const status = await fetch(
      base +
        "/api/projects/P-HTTP/boq/uploads/" +
        encodeURIComponent(
          created.ingestionId,
        ) +
        "?includeItems=true",
    );

    assert.equal(status.status, 200);

    const stored =
      await status.json() as {
        canonicalItems: Array<{
          amount: number | null;
          currency: string | null;
          sourceRefs: string[];
        }>;
      };

    assert.equal(
      stored.canonicalItems[0]!.amount,
      2000,
    );
    assert.equal(
      stored.canonicalItems[0]!.currency,
      "AED",
    );
    assert.ok(
      stored.canonicalItems[0]!.sourceRefs
        .some((ref) =>
          ref.startsWith(
            "evidence-receipt:",
          ),
        ),
    );
  } finally {
    await new Promise<void>(
      (resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      },
    );
  }
});
