import { describe, expect, test } from "bun:test";
import { parseEnv } from "./env.ts";

const base = {
  DATABASE_URL: "postgres://u:p@localhost:5433/db",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

describe("parseEnv", () => {
  test("applies defaults", () => {
    const env = parseEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.NODE_ENV).toBe("development");
    expect(env.APP_URL).toBe("http://localhost:3000");
    expect(env.ORGANIZER_EMAILS).toEqual([]);
    expect(env.GOOGLE_CLIENT_ID).toBeUndefined();
  });

  test("normalizes the organizer email list", () => {
    const env = parseEnv({ ...base, ORGANIZER_EMAILS: " Boss@Example.com, ,ops@etic.fr " });
    expect(env.ORGANIZER_EMAILS).toEqual(["boss@example.com", "ops@etic.fr"]);
  });

  test("rejects a missing database URL with a readable message", () => {
    expect(() => parseEnv({ BETTER_AUTH_SECRET: base.BETTER_AUTH_SECRET })).toThrow(/DATABASE_URL/);
  });

  test("rejects a non-postgres URL", () => {
    expect(() => parseEnv({ ...base, DATABASE_URL: "mysql://localhost/db" })).toThrow(
      /DATABASE_URL/,
    );
  });

  test("rejects a short auth secret", () => {
    expect(() => parseEnv({ ...base, BETTER_AUTH_SECRET: "short" })).toThrow(/BETTER_AUTH_SECRET/);
  });
});
