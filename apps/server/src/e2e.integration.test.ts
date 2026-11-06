import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { startRules } from "@etic/content";
import {
  gameEngine,
  localPrice,
  type TeamCommandMap,
  type TeamCommandType,
  type TeamState,
  type TeamView,
} from "@etic/engine";
import type { inferRouterOutputs } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { createApp } from "./app.ts";
import { createAuth } from "./auth/auth.ts";
import { createDatabase } from "./db/client.ts";
import { runMigrations } from "./db/migrate.ts";
import { game, user } from "./db/schema.ts";
import { GameManager } from "./game/manager.ts";
import { createPgPersistence } from "./game/persistence.ts";
import { RateLimiter } from "./game/rate-limit.ts";
import type { GameRuntime, StreamMessage } from "./game/runtime.ts";
import { silentLogger } from "./test-helpers.ts";
import { createContextFactory } from "./trpc/context.ts";
import { type AppRouter, createAppRouter } from "./trpc/router.ts";

/**
 * End-to-end test of the main path over the real server API (N32, replaces the Playwright test
 * of S7): sign-up → join code → start → purchase → hiring → production → sale → delivery.
 * Requests go through the Hono app in-process (no port is opened); simulated time is driven
 * with `runtime.step()` instead of the clock. Runs against the real Postgres from DATABASE_URL
 * (docker compose) and is skipped when no database answers.
 */
const url = process.env.DATABASE_URL;
const database = url ? createDatabase(url) : null;
const reachable = database ? await database.ping() : false;
if (!reachable) console.warn("end-to-end test skipped: database unreachable");

const APP_URL = "http://localhost:3000";
const PASSWORD = "correct-horse-e2e";
const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const emails = {
  organizer: `org-e2e-${stamp}@test.local`,
  baker: `baker-e2e-${stamp}@test.local`,
  rival: `rival-e2e-${stamp}@test.local`,
};

type Outputs = inferRouterOutputs<AppRouter>;
type App = ReturnType<typeof createApp>;

let app: App;
let manager: GameManager;
const cookies = { organizer: "", baker: "", rival: "" };
let gameId = "";
let bakerTeamId = "";

function setup() {
  if (!database) throw new Error("no database");
  const auth = createAuth(database.db, {
    NODE_ENV: "test",
    APP_URL,
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-123",
    GOOGLE_CLIENT_ID: undefined,
    GOOGLE_CLIENT_SECRET: undefined,
  });
  manager = new GameManager({
    engine: gameEngine,
    persistence: createPgPersistence(database.db),
    logger: silentLogger,
    saveDebounceMs: 0,
  });
  return createApp({
    logger: silentLogger,
    pingDatabase: database.ping,
    authHandler: auth.handler,
    createContext: createContextFactory(auth, [emails.organizer]),
    // The test sends decisions faster than a player would (S9 limits about 10 per second).
    router: createAppRouter({ manager, limiter: new RateLimiter(1_000, 1_000) }),
  });
}

async function signUp(name: string, email: string): Promise<string> {
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json", origin: APP_URL },
    body: JSON.stringify({ name, email, password: PASSWORD }),
  });
  expect(res.status).toBe(200);
  const raw = res.headers.getSetCookie().find((cookie) => cookie.includes("session_token"));
  if (!raw) throw new Error(`no session cookie for ${email}`);
  return raw.split(";")[0] ?? "";
}

async function unwrap<T>(path: string, res: Response): Promise<T> {
  const body = (await res.json()) as { result?: { data: T }; error?: unknown };
  if (res.status !== 200 || !body.result) {
    throw new Error(`${path} failed (${res.status}): ${JSON.stringify(body.error ?? body)}`);
  }
  return body.result.data;
}

/** A tRPC query over HTTP, as the web client sends it. */
async function query<T>(cookie: string, path: string, input?: unknown): Promise<T> {
  const search = input === undefined ? "" : `?input=${encodeURIComponent(JSON.stringify(input))}`;
  return unwrap<T>(path, await app.request(`/api/trpc/${path}${search}`, { headers: { cookie } }));
}

/** A tRPC mutation over HTTP. */
async function mutate<T>(cookie: string, path: string, input: unknown): Promise<T> {
  const res = await app.request(`/api/trpc/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify(input),
  });
  return unwrap<T>(path, res);
}

/** A team decision through `game.command`; payloads are checked against the engine schemas. */
async function decide<K extends TeamCommandType>(
  cookie: string,
  type: K,
  payload: TeamCommandMap[K],
): Promise<void> {
  const result = await mutate<Outputs["game"]["command"]>(cookie, "game.command", {
    gameId,
    command: { type, payload },
  });
  if (!result.ok) {
    throw new Error(`${type} refused: ${result.refusal.code} — ${result.refusal.message}`);
  }
}

function runtime(): GameRuntime {
  const found = manager.get(gameId);
  if (!found) throw new Error(`game ${gameId} not running on this server`);
  return found;
}

/** The baker's company as the server holds it. */
function company(): TeamState {
  const team = runtime().snapshot.teams[bakerTeamId];
  if (!team) throw new Error(`team ${bakerTeamId} not found`);
  return team;
}

/** Advances simulated time one sub-step at a time until `done` holds. */
function stepUntil(what: string, done: () => boolean, maxSteps = 200): void {
  for (let steps = 0; !done(); steps++) {
    if (steps >= maxSteps) throw new Error(`still waiting after ${maxSteps} steps: ${what}`);
    runtime().step();
  }
}

/** Reads the first message of the player's live stream (SSE): the full team view. */
async function streamedTeamView(cookie: string): Promise<TeamView> {
  const controller = new AbortController();
  const input = encodeURIComponent(JSON.stringify({ gameId }));
  const res = await app.request(`/api/trpc/game.stream?input=${input}`, {
    headers: { cookie },
    signal: controller.signal,
  });
  expect(res.status).toBe(200);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("no stream body");
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) throw new Error("stream ended before the team view");
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";
      for (const event of events) {
        const lines = event.trim().split("\n");
        // Named events are tRPC's own (connected, ping…); data events carry our messages.
        if (lines.some((line) => line.startsWith("event:"))) continue;
        const data = lines.find((line) => line.startsWith("data:"));
        if (!data) continue;
        const message = JSON.parse(data.slice("data:".length)) as StreamMessage<TeamView>;
        if (message.kind === "full") return message.view;
      }
    }
  } finally {
    controller.abort();
    await reader.cancel().catch(() => undefined);
  }
}

describe.skipIf(!reachable)("main path over the server API (N32)", () => {
  beforeAll(async () => {
    if (url) await runMigrations(url);
    app = setup();
  });

  afterAll(async () => {
    if (!database) return;
    await manager?.stopAll();
    if (gameId) await database.db.delete(game).where(eq(game.id, gameId));
    await database.db.delete(user).where(inArray(user.email, Object.values(emails)));
    await database.close();
  });

  test("the organizer and two players sign up", async () => {
    cookies.organizer = await signUp("Orga", emails.organizer);
    cookies.baker = await signUp("Lina", emails.baker);
    cookies.rival = await signUp("Sami", emails.rival);
    expect(await query<Outputs["me"]>(cookies.organizer, "me")).toMatchObject({
      role: "organizer",
    });
    expect(await query<Outputs["me"]>(cookies.baker, "me")).toMatchObject({
      name: "Lina",
      role: "participant",
    });
  });

  test("the organizer creates a game and each player joins with a code", async () => {
    const created = await mutate<Outputs["admin"]["createGame"]>(
      cookies.organizer,
      "admin.createGame",
      { name: `Parcours E2E ${stamp}`, teamNames: ["Boulangers", "Rivaux"] },
    );
    gameId = created.gameId;
    const lobby = await query<Outputs["admin"]["game"]>(cookies.organizer, "admin.game", {
      gameId,
    });
    expect(lobby.status).toBe("lobby");
    const [bakers, rivals] = lobby.teams;
    if (!bakers || !rivals) throw new Error("two teams expected");

    // Codes are typed by hand: case does not matter (P7).
    const joined = await mutate<Outputs["game"]["join"]>(cookies.baker, "game.join", {
      code: bakers.joinCode.toLowerCase(),
    });
    expect(joined).toEqual({ ok: true, gameId, teamId: bakers.id });
    bakerTeamId = bakers.id;
    expect(
      await mutate<Outputs["game"]["join"]>(cookies.rival, "game.join", { code: rivals.joinCode }),
    ).toMatchObject({ ok: true, teamId: rivals.id });

    const current = await query<Outputs["game"]["current"]>(cookies.baker, "game.current");
    expect(current).toEqual([
      expect.objectContaining({ gameId, teamId: bakerTeamId, status: "lobby" }),
    ]);
  });

  test("companies are named and settled, then the organizer starts the game", async () => {
    await decide(cookies.baker, "lobby.setCompanyName", { companyName: "Pains d'Or" });
    await decide(cookies.baker, "lobby.chooseRegion", { region: "ferronia" });
    await decide(cookies.rival, "lobby.setCompanyName", { companyName: "Rival SA" });
    await decide(cookies.rival, "lobby.chooseRegion", { region: "nordhaven" });

    const started = await mutate<Outputs["admin"]["control"]>(cookies.organizer, "admin.control", {
      gameId,
      action: "start",
    });
    expect(started).toEqual({ ok: true });
    expect(runtime().snapshot.status).toBe("running");
    expect(company().cash).toBe(startRules.startingCash);
  });

  test("the baker buys an oven, hires staff and orders flour and water", async () => {
    await decide(cookies.baker, "purchase.buyMachine", {
      supplierId: "ferro-machines",
      machineTypeId: "oven",
    });
    await decide(cookies.baker, "hr.hire", { job: "operator", count: 2 });
    await decide(cookies.baker, "hr.hire", { job: "logistician", count: 1 });
    // Three bread cycles: 40 loaves each, 2 flour and 1 water per loaf.
    await decide(cookies.baker, "purchase.buyMaterial", {
      supplierId: "farines-ferro",
      quantity: 240,
    });
    await decide(cookies.baker, "purchase.buyMaterial", { supplierId: "aquaferr", quantity: 120 });

    const team = company();
    expect(Object.values(team.inbound)).toHaveLength(3);
    expect(Object.values(team.employees)).toHaveLength(3);
    expect(team.cash).toBeLessThan(startRules.startingCash);
  });

  test("once everything has arrived, the oven bakes bread", async () => {
    stepUntil("oven, materials and staff", () => {
      const team = company();
      const day = runtime().snapshot.time.day;
      return (
        Object.keys(team.machines).length === 1 &&
        (team.inventory.flour ?? 0) >= 240 &&
        (team.inventory.water ?? 0) >= 120 &&
        Object.values(team.employees).every((employee) => employee.arrivesOnDay <= day)
      );
    });
    const team = company();
    const [machineId] = Object.keys(team.machines);
    if (!machineId) throw new Error("no machine");
    const operators = Object.values(team.employees)
      .filter((employee) => employee.job === "operator")
      .map((employee) => employee.id);

    await decide(cookies.baker, "production.assignOperators", {
      machineId,
      employeeIds: operators,
    });
    await decide(cookies.baker, "production.setJob", { machineId, productId: "bread", cycles: 3 });

    stepUntil("first batch of bread", () => (company().stats.produced.bread ?? 0) > 0);
    expect(company().inventory.bread).toBeGreaterThan(0);
  });

  test("with a price and auto-accept, customer orders are accepted", async () => {
    await decide(cookies.baker, "sales.setPrice", {
      region: "ferronia",
      productId: "bread",
      price: localPrice("ferronia", "bread"),
    });
    await decide(cookies.baker, "sales.setAutoAccept", { productId: "bread", enabled: true });

    stepUntil("an accepted order", () =>
      Object.values(company().orders).some((order) => order.status === "accepted"),
    );
    expect(Object.values(company().reserved).some((units) => (units ?? 0) > 0)).toBe(true);
  });

  test("shipped orders are delivered and paid on delivery", async () => {
    const accepted = Object.values(company().orders).filter((order) => order.status === "accepted");
    for (const order of accepted) {
      await decide(cookies.baker, "delivery.ship", { orderId: order.id, option: "standard" });
    }
    const shippedIds = new Set(accepted.map((order) => order.id));
    expect(Object.values(company().shipments).map((shipment) => shipment.orderId)).toEqual(
      accepted.map((order) => order.id),
    );

    // Local deliveries with the standard option arrive well before their deadline.
    const expectedRevenue = accepted.reduce(
      (sum, order) => sum + Math.round(order.quantity * order.unitPrice),
      0,
    );
    const expectedUnits = accepted.reduce((sum, order) => sum + order.quantity, 0);
    const before = company();
    const cashBefore = before.cash;
    const revenueBefore = before.stats.revenue;
    expect(before.stats.sold.bread ?? 0).toBe(0);

    stepUntil("deliveries", () => {
      const team = company();
      return (
        Object.keys(team.orders).every((id) => !shippedIds.has(id)) &&
        Object.keys(team.shipments).length === 0
      );
    });

    const after = company();
    expect(after.stats.sold.bread).toBe(expectedUnits);
    expect(after.stats.sold.bread ?? 0).toBeGreaterThan(0);
    expect(after.stats.revenue - revenueBefore).toBe(expectedRevenue);
    expect(after.cash - cashBefore).toBe(expectedRevenue);
    expect(after.stats.lateDeliveries).toBe(0);
  });

  test("the player sees the sale in the live team view", async () => {
    const view = await streamedTeamView(cookies.baker);
    const team = company();
    expect(view.team.id).toBe(bakerTeamId);
    expect(view.team.stats.sold.bread).toBe(team.stats.sold.bread);
    expect(view.team.cash).toBe(team.cash);
    expect(view.team.finance.ledger.some((entry) => entry.category === "sales")).toBe(true);
  });
});
