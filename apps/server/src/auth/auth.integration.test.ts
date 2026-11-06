import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { inArray } from "drizzle-orm";
import { createApp } from "../app.ts";
import { createDatabase } from "../db/client.ts";
import { runMigrations } from "../db/migrate.ts";
import { user } from "../db/schema.ts";
import { RateLimiter } from "../game/rate-limit.ts";
import { memoryManager, silentLogger } from "../test-helpers.ts";
import { createContextFactory } from "../trpc/context.ts";
import { createAppRouter } from "../trpc/router.ts";
import { createAuth } from "./auth.ts";

/**
 * Runs against the real Postgres from DATABASE_URL (docker compose).
 * Skipped when no database answers, so `bun run check` still works without Docker.
 */
const url = process.env.DATABASE_URL;
const database = url ? createDatabase(url) : null;
const reachable = database ? await database.ping() : false;
if (!reachable) console.warn("auth integration tests skipped: database unreachable");

const APP_URL = "http://localhost:3000";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const participantEmail = `lina-${stamp}@test.local`;
const organizerEmail = `boss-${stamp}@test.local`;

function setup() {
  if (!database) throw new Error("no database");
  const auth = createAuth(database.db, {
    NODE_ENV: "test",
    APP_URL,
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
  });
  return createApp({
    logger: silentLogger,
    pingDatabase: database.ping,
    authHandler: auth.handler,
    createContext: createContextFactory(auth, [organizerEmail]),
    router: createAppRouter({ manager: memoryManager().manager, limiter: new RateLimiter() }),
  });
}

function post(app: ReturnType<typeof setup>, path: string, body: unknown, cookie?: string) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_URL, ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function sessionCookie(res: Response): string {
  const raw = res.headers.getSetCookie().find((c) => c.includes("session_token"));
  if (!raw) throw new Error("no session cookie");
  return raw.split(";")[0] ?? "";
}

async function me(app: ReturnType<typeof setup>, cookie?: string) {
  const res = await app.request("/api/trpc/me", { headers: cookie ? { cookie } : {} });
  return { status: res.status, body: (await res.json()) as { result?: { data: unknown } } };
}

describe.skipIf(!reachable)("auth against Postgres", () => {
  let app: ReturnType<typeof setup>;

  beforeAll(async () => {
    if (url) await runMigrations(url);
    app = setup();
  });

  afterAll(async () => {
    if (!database) return;
    await database.db.delete(user).where(inArray(user.email, [participantEmail, organizerEmail]));
    await database.close();
  });

  test("sign-up signs the participant in and me returns the participant role", async () => {
    const res = await post(app, "/api/auth/sign-up/email", {
      name: "Lina",
      email: participantEmail,
      password: "correct-horse-1",
    });
    expect(res.status).toBe(200);
    const result = await me(app, sessionCookie(res));
    expect(result.status).toBe(200);
    expect(result.body.result?.data).toMatchObject({
      name: "Lina",
      email: participantEmail,
      role: "participant",
    });
  });

  test("passwords shorter than 8 characters are refused", async () => {
    const res = await post(app, "/api/auth/sign-up/email", {
      name: "Short",
      email: `short-${stamp}@test.local`,
      password: "1234567",
    });
    expect(res.status).toBe(400);
  });

  test("sign-in works and an organizer email gets the organizer role", async () => {
    await post(app, "/api/auth/sign-up/email", {
      name: "Boss",
      email: organizerEmail,
      password: "correct-horse-2",
    });
    const res = await post(app, "/api/auth/sign-in/email", {
      email: organizerEmail,
      password: "correct-horse-2",
    });
    expect(res.status).toBe(200);
    const result = await me(app, sessionCookie(res));
    expect(result.body.result?.data).toMatchObject({ role: "organizer" });
  });

  test("a wrong password is refused", async () => {
    const res = await post(app, "/api/auth/sign-in/email", {
      email: organizerEmail,
      password: "wrong-password",
    });
    expect(res.status).toBe(401);
  });

  test("me without a session is UNAUTHORIZED", async () => {
    expect((await me(app)).status).toBe(401);
  });

  test("the session cookie is httpOnly", async () => {
    const res = await post(app, "/api/auth/sign-in/email", {
      email: participantEmail,
      password: "correct-horse-1",
    });
    const raw = res.headers.getSetCookie().find((c) => c.includes("session_token")) ?? "";
    expect(raw.toLowerCase()).toContain("httponly");
  });
});
