import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

import {
  createCmengServer,
} from "../packages/runtime-api/src/server";
import {
  runtimeProjects,
} from "../packages/runtime-api/src/project-state";

async function withServer(
  fn: (base: string) => Promise<void>,
) {
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
    await fn(
      "http://127.0.0.1:" +
        address.port,
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
}

test("portfolio, project creation and Ask CMeng remain project scoped", async () => {
  await withServer(async (base) => {
    const projectId =
      "PLATFORM-UAT-" +
      Date.now();

    const create =
      await fetch(
        base + "/api/projects",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            projectId,
          }),
        },
      );
    assert.equal(
      create.status,
      201,
    );
    const created =
      await create.json() as {
        projectId: string;
        created: boolean;
      };
    assert.equal(
      created.projectId,
      projectId,
    );
    assert.equal(
      created.created,
      true,
    );

    const legacyProjectId =
      projectId + "-LEGACY";
    const legacy =
      runtimeProjects.getOrCreate(
        legacyProjectId,
      );
    delete (
      legacy.controls as unknown as
        Record<string, unknown>
    ).risks;

    const sampleId =
      "DEMO-PORTFOLIO-" +
      Date.now();
    const sample =
      await fetch(
        base +
          "/api/projects/" +
          encodeURIComponent(
            sampleId,
          ) +
          "/demo",
        {
          method: "POST",
        },
      );
    assert.equal(
      sample.status,
      201,
    );

    const portfolio =
      await fetch(
        base + "/api/portfolio",
      );
    assert.equal(
      portfolio.status,
      200,
    );
    const portfolioBody =
      await portfolio.json() as {
        projects: Array<{
          projectId: string;
          positionState?: string;
          managementActionCount?: number;
          analysisError?: string | null;
        }>;
      };
    assert.ok(
      portfolioBody.projects.some(
        (project) =>
          project.projectId ===
          projectId,
      ),
    );
    assert.ok(
      portfolioBody.projects.some(
        (project) =>
          project.projectId ===
          legacyProjectId,
      ),
      "one malformed legacy project must not crash the portfolio endpoint",
    );
    assert.equal(
      portfolioBody.projects.some(
        (project) =>
          project.projectId ===
          sampleId,
      ),
      false,
      "demonstration projects must not appear in the live portfolio",
    );

    const intelligence =
      await fetch(
        base +
          "/api/projects/" +
          encodeURIComponent(
            projectId,
          ) +
          "/intelligence/ask",
        {
          method: "POST",
          headers: {
            "content-type":
              "application/json",
          },
          body: JSON.stringify({
            question:
              "What is the current project position?",
          }),
        },
      );
    assert.equal(
      intelligence.status,
      200,
    );
    const answer =
      await intelligence.json() as {
        projectId: string;
        authority: string;
        modelBacked: boolean;
        governance: string;
      };
    assert.equal(
      answer.projectId,
      projectId,
    );
    assert.equal(
      answer.authority,
      "advisory_only",
    );
    assert.equal(
      answer.modelBacked,
      false,
    );
    assert.match(
      answer.governance,
      /do not change the adopted project position/i,
    );
  });
});
