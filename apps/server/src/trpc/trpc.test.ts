import { describe, expect, test } from "bun:test";
import { TRPCError } from "@trpc/server";
import { roleForEmail } from "../auth/roles.ts";
import { RateLimiter } from "../game/rate-limit.ts";
import { memoryManager } from "../test-helpers.ts";
import { createAppRouter } from "./router.ts";

const appRouter = createAppRouter({ manager: memoryManager().manager, limiter: new RateLimiter() });

import { createCallerFactory, organizerProcedure, router, type SessionUser } from "./trpc.ts";

const participant: SessionUser = {
  id: "u1",
  name: "Lina",
  email: "lina@example.com",
  role: "participant",
};
const organizer: SessionUser = { ...participant, id: "u2", role: "organizer" };

const testRouter = router({ ping: organizerProcedure.query(() => "pong"), app: appRouter });
const caller = createCallerFactory(testRouter);

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
    return "OK";
  } catch (error) {
    return error instanceof TRPCError ? error.code : "UNKNOWN";
  }
}

describe("roles", () => {
  test("organizer emails match case-insensitively", () => {
    expect(roleForEmail(" Boss@Example.com ", ["boss@example.com"])).toBe("organizer");
    expect(roleForEmail("lina@example.com", ["boss@example.com"])).toBe("participant");
  });

  test("anonymous users are rejected with UNAUTHORIZED", async () => {
    expect(await errorCode(caller({ user: null }).app.me())).toBe("UNAUTHORIZED");
    expect(await errorCode(caller({ user: null }).ping())).toBe("UNAUTHORIZED");
  });

  test("participants cannot call organizer procedures", async () => {
    expect(await errorCode(caller({ user: participant }).ping())).toBe("FORBIDDEN");
  });

  test("organizers can call organizer procedures", async () => {
    expect(await caller({ user: organizer }).ping()).toBe("pong");
  });

  test("me returns the session user", async () => {
    expect(await caller({ user: participant }).app.me()).toEqual(participant);
  });
});
