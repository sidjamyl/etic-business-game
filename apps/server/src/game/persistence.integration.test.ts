import { afterAll, describe, expect, test } from "bun:test";
import type { Actor } from "@etic/engine";
import { eq } from "drizzle-orm";
import { createDatabase } from "../db/client.ts";
import { runMigrations } from "../db/migrate.ts";
import { game, gameJournal } from "../db/schema.ts";
import { silentLogger } from "../test-helpers.ts";
import { GameManager } from "./manager.ts";
import { createPgPersistence } from "./persistence.ts";
import { makeReady, testEngine, testTeams } from "./test-engine.ts";

const url = process.env.DATABASE_URL;
const database = url ? createDatabase(url) : null;
const reachable = database ? await database.ping() : false;
const organizer: Actor = { kind: "organizer", userId: "org", name: "Org" };
const created: string[] = [];

function manager() {
  if (!database) throw new Error("no database");
  return new GameManager({
    engine: testEngine,
    persistence: createPgPersistence(database.db),
    logger: silentLogger,
    saveDebounceMs: 0,
  });
}

describe.skipIf(!reachable)("Postgres persistence", () => {
  afterAll(async () => {
    if (!database) return;
    for (const id of created) await database.db.delete(game).where(eq(game.id, id));
    await database.close();
  });

  test("snapshot and journal survive a restart; the game resumes paused", async () => {
    if (url) await runMigrations(url);
    const first = manager();
    const runtime = await first.create({ name: "PG test", teams: testTeams });
    created.push(runtime.id);
    makeReady(runtime.snapshot);
    runtime.submit(organizer, { type: "control.start" });
    runtime.step();
    runtime.submit(
      { kind: "team", teamId: "a", userId: "u-a", name: "Lina" },
      { type: "test.spend", payload: { amount: 999_999 } },
    ); // refused: more than the starting cash, but audited
    runtime.step();
    await runtime.flush();

    const rows = await database?.db
      .select()
      .from(gameJournal)
      .where(eq(gameJournal.gameId, runtime.id));
    expect(rows?.filter((r) => r.kind === "step")).toHaveLength(2);
    expect(rows?.find((r) => r.commandType === "test.spend")).toMatchObject({
      ok: false,
      seq: null,
      refusalCode: "INSUFFICIENT_FUNDS",
      teamId: "a",
      userId: "u-a",
    });

    const restored = (await manager().restore()).find((r) => r.id === runtime.id);
    expect(restored?.snapshot.status).toBe("paused");
    expect(restored?.snapshot.time).toEqual({ day: 1, step: 2 });
  });
});
