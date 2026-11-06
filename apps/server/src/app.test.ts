import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { buildTestApp } from "./test-helpers.ts";

describe("GET /health", () => {
  test("returns 200 when the database answers", async () => {
    const res = await buildTestApp({ pingDatabase: async () => true }).request("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok", database: "up" });
  });

  test("returns 503 when the database is down", async () => {
    const res = await buildTestApp({ pingDatabase: async () => false }).request("/health");
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: "degraded", database: "down" });
  });
});

describe("web app serving", () => {
  const dist = new URL("../../web/dist", import.meta.url).pathname;
  const hasBuild = existsSync(`${dist}/index.html`);

  test.skipIf(!hasBuild)("serves index.html for client routes, never cached", async () => {
    const res = await buildTestApp({ webDist: dist }).request("/play/achats");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-cache");
    expect(await res.text()).toContain('<div id="root">');
  });

  test.skipIf(!hasBuild)("API routes are not swallowed by the web app", async () => {
    const res = await buildTestApp({ webDist: dist }).request("/api/trpc/me");
    expect(res.status).toBe(401);
  });

  test("without a build, the server still answers the API", async () => {
    const res = await buildTestApp({ webDist: "/nonexistent" }).request("/health");
    expect(res.status).toBe(200);
  });
});
