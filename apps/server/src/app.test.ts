import { describe, expect, test } from "bun:test";
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
