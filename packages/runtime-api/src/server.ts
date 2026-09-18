import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { scheduleModules, scheduleModuleSummary } from "./registry";

const port = Number.parseInt(process.env.PORT ?? "3000", 10);
const host = process.env.HOST ?? "0.0.0.0";

function json(res: ServerResponse, statusCode: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

function route(req: IncomingMessage, res: ServerResponse): void {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);

  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, {
      status: "ok",
      service: "cmeng",
      release: process.env.RAILWAY_GIT_COMMIT_SHA ?? process.env.GIT_COMMIT_SHA ?? null,
      scheduleModules: scheduleModuleSummary()
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/schedule/modules") {
    json(res, 200, {
      moduleCount: scheduleModules.length,
      modules: scheduleModules
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    json(res, 200, {
      name: "CMeng",
      description: "Controlled construction/project evidence and intelligence platform",
      health: "/health",
      scheduleModules: "/api/schedule/modules"
    });
    return;
  }

  json(res, 404, { error: "not_found", path: url.pathname });
}

const server = createServer(route);

server.listen(port, host, () => {
  process.stdout.write(`CMeng runtime listening on ${host}:${port}\n`);
});
