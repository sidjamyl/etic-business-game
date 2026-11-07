import { describe, expect, test } from "bun:test";
import { SSE_IDLE_TIMEOUT_SECONDS, SSE_PING_INTERVAL_MS } from "../trpc/trpc.ts";
import { AUTH_RATE_LIMIT, usesHttps } from "./auth.ts";

describe("deployment settings", () => {
  test("secure cookies follow the public URL protocol", () => {
    expect(usesHttps("https://etic.example.org")).toBe(true);
    // Local fallback on the LAN: plain HTTP, cookies must not be `Secure`.
    expect(usesHttps("http://192.168.1.20")).toBe(false);
    expect(usesHttps("http://localhost:5173")).toBe(false);
  });

  test("sign-in limits allow a room sharing one public IP", () => {
    for (const rule of Object.values(AUTH_RATE_LIMIT.customRules)) {
      expect(rule.max / rule.window).toBeGreaterThanOrEqual(1);
    }
  });

  test("Bun keeps SSE streams open between two pings", () => {
    expect(SSE_IDLE_TIMEOUT_SECONDS * 1000).toBeGreaterThan(SSE_PING_INTERVAL_MS * 2);
    // Bun.serve rejects idle timeouts above 255 s.
    expect(SSE_IDLE_TIMEOUT_SECONDS).toBeLessThanOrEqual(255);
  });
});
