const base =
  process.env.CMENG_RAILWAY_URL ??
  "https://cmeng-main-production.up.railway.app";
const expectedSha =
  process.env.EXPECTED_SHA ?? "";
const projectId =
  process.env.PERSISTENCE_PROJECT_ID ??
  "PERSISTENCE-SMOKE-VOLUME";
const mode =
  process.env.PERSISTENCE_MODE ??
  "verify";

function sleep(ms) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  );
}

async function json(
  path,
  options = {},
) {
  const response = await fetch(
    base + path,
    options,
  );
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  return {
    response,
    body,
  };
}

async function waitForRelease() {
  const deadline =
    Date.now() + 10 * 60_000;
  let last = null;

  while (Date.now() < deadline) {
    try {
      const {
        response,
        body,
      } = await json("/health");

      last = {
        status: response.status,
        body,
      };

      if (
        response.ok &&
        body?.status === "ok" &&
        body?.release === expectedSha &&
        body?.boqIngestion
          ?.persistence ===
          "railway_volume"
      ) {
        return body;
      }
    } catch (error) {
      last = {
        error:
          error instanceof Error
            ? error.message
            : String(error),
      };
    }

    await sleep(5_000);
  }

  throw new Error(
    "Timed out waiting for exact Railway release with volume persistence: " +
      JSON.stringify(last),
  );
}

async function seed() {
  const health =
    await waitForRelease();

  const {
    response,
    body,
  } = await json(
    "/api/projects/" +
      encodeURIComponent(
        projectId,
      ) +
      "/demo",
    {
      method: "POST",
    },
  );

  if (!response.ok) {
    throw new Error(
      "Demo seed failed: " +
        response.status +
        " " +
        JSON.stringify(body),
    );
  }

  const overview =
    await verifyOverview();

  console.log(
    JSON.stringify(
      {
        mode: "seed",
        release: health.release,
        persistence:
          health.boqIngestion
            .persistence,
        projectId,
        revisionCount:
          overview.revisionCount,
        demo: overview.demo,
      },
      null,
      2,
    ),
  );
}

async function verifyOverview() {
  const deadline =
    Date.now() + 5 * 60_000;
  let last = null;

  while (Date.now() < deadline) {
    const {
      response,
      body,
    } = await json(
      "/api/projects/" +
        encodeURIComponent(
          projectId,
        ) +
        "/overview",
    );

    last = {
      status: response.status,
      body,
    };

    if (
      response.ok &&
      body?.projectId ===
        projectId &&
      body?.demo === true &&
      body?.revisionCount >= 2 &&
      Array.isArray(
        body?.moduleStates,
      ) &&
      body.moduleStates.length === 22
    ) {
      return body;
    }

    await sleep(5_000);
  }

  throw new Error(
    "Persisted project was not found or incomplete: " +
      JSON.stringify(last),
  );
}

async function verify() {
  const health =
    await waitForRelease();
  const overview =
    await verifyOverview();

  console.log(
    JSON.stringify(
      {
        mode: "verify",
        release: health.release,
        persistence:
          health.boqIngestion
            .persistence,
        projectId,
        revisionCount:
          overview.revisionCount,
        demo: overview.demo,
        moduleCount:
          overview.moduleStates.length,
      },
      null,
      2,
    ),
  );
}

if (
  mode === "seed"
) {
  await seed();
} else if (
  mode === "verify"
) {
  await verify();
} else {
  throw new Error(
    "Unsupported PERSISTENCE_MODE: " +
      mode,
  );
}
