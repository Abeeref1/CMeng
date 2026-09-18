import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";

test("final Railway Schedule surface exposes 22-module certificate and management endpoint guards", async () => {
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

    const certificate = await fetch(
      base +
        "/api/schedule/certification",
    );
    assert.equal(
      certificate.status,
      200,
    );
    const body =
      await certificate.json() as {
        scope: string;
        moduleCount: number;
        modules: Array<{
          key: string;
        }>;
        invariants: Record<
          string,
          boolean
        >;
      };

    assert.equal(
      body.scope,
      "schedule-22-final",
    );
    assert.equal(
      body.moduleCount,
      22,
    );
    assert.equal(
      new Set(
        body.modules.map(
          (module) => module.key,
        ),
      ).size,
      22,
    );
    assert.equal(
      body.invariants
        .missingEvidenceIsNotZero,
      true,
    );
    assert.equal(
      body.invariants
        .currenciesAreNotCrossSummed,
      true,
    );

    const missingDirector =
      await fetch(
        base +
          "/api/projects/P1/director-position",
      );
    assert.equal(
      missingDirector.status,
      404,
    );

    const boardWithoutDirector =
      await fetch(
        base +
          "/api/projects/P1/board-report",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            sourceManifestId:
              "manifest-1",
            evidenceReceiptIds: [
              "receipt-1",
            ],
            finalizedAt:
              "2026-09-19T00:00:00.000Z",
          }),
        },
      );
    assert.equal(
      boardWithoutDirector.status,
      409,
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
