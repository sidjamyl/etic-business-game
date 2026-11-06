import { describe, expect, test } from "bun:test";
import { type Actor, applyPatch, gameEngine } from "@etic/engine";
import { TRPCError } from "@trpc/server";
import { silentLogger } from "../test-helpers.ts";
import { createAppRouter } from "../trpc/router.ts";
import { createCallerFactory, type SessionUser } from "../trpc/trpc.ts";
import { GameManager } from "./manager.ts";
import { createMemoryPersistence } from "./persistence.ts";
import { RateLimiter } from "./rate-limit.ts";
import type { AdminStreamView, StreamMessage } from "./runtime.ts";
import { makeReady } from "./test-engine.ts";

const organizer: Actor = { kind: "organizer", userId: "org", name: "Org" };
const boss: SessionUser = { id: "org", name: "Org", email: "o@x", role: "organizer" };
const player: SessionUser = { id: "u-a", name: "Lina", email: "l@x", role: "participant" };

async function setup() {
  const manager = new GameManager({
    engine: gameEngine,
    persistence: createMemoryPersistence().persistence,
    logger: silentLogger,
    saveDebounceMs: 0,
  });
  const runtime = await manager.create({
    name: "Contrôle",
    teams: [
      { id: "a", name: "Alpha", members: [{ userId: "u-a", name: "Lina" }] },
      { id: "b", name: "Bravo", members: [{ userId: "u-b", name: "Sami" }] },
    ],
  });
  makeReady(runtime.snapshot);
  runtime.submit(organizer, { type: "control.start" });
  const call = createCallerFactory(createAppRouter({ manager, limiter: new RateLimiter() }));
  return { runtime, call };
}

describe("control room stream (N22)", () => {
  test("streams every company, the ranking and metrics, then deltas", async () => {
    const { runtime } = await setup();
    const controller = new AbortController();
    const stream = runtime.streamAdmin(controller.signal);
    const first = (await stream.next()).value as StreamMessage<AdminStreamView>;
    if (first.kind !== "full") throw new Error("expected a full view");
    let view = first.view;
    expect(Object.keys(view.companies)).toEqual(["a", "b"]);
    expect(view.ranking).toHaveLength(2);
    expect(view.events.upcoming[0]).toMatchObject({ title: "Sécheresse à Azura", day: 25 });
    expect(view.game.name).toBe("Contrôle");

    runtime.submit(
      { kind: "team", teamId: "a", userId: "u-a", name: "Lina" },
      { type: "finance.borrow", payload: { amount: 5_000 } },
    );
    const next = (await stream.next()).value as StreamMessage<AdminStreamView>;
    controller.abort();
    if (next.kind !== "patch") throw new Error("expected a patch");
    view = applyPatch(view, next.ops);
    expect(view.companies.a).toMatchObject({ cash: 55_000, debt: 5_000 });
  });

  test("the end time set by the organizer is in the view, so a reload still shows it", async () => {
    const { runtime } = await setup();
    const endsAt = new Date(Date.now() + 3_600_000);
    runtime.setEndsAt(organizer, endsAt);
    const controller = new AbortController();
    const first = (await runtime.streamAdmin(controller.signal).next())
      .value as StreamMessage<AdminStreamView>;
    controller.abort();
    if (first.kind !== "full") throw new Error("expected a full view");
    expect(first.view.game.endsAt).toBe(endsAt.toISOString());
  });

  test("the stream is organizer-only", async () => {
    const { runtime, call } = await setup();
    const denied = (await call({ user: player })
      .admin.stream({ gameId: runtime.id })
      .catch((error) => error)) as unknown;
    if (denied instanceof TRPCError) {
      expect(denied.code).toBe("FORBIDDEN");
      return;
    }
    const iterator = (denied as AsyncIterable<unknown>)[Symbol.asyncIterator]();
    expect(await iterator.next().catch((error: TRPCError) => error.code)).toBe("FORBIDDEN");
    const allowed = (await call({ user: boss }).admin.stream({
      gameId: runtime.id,
    })) as AsyncIterable<StreamMessage<AdminStreamView>>;
    expect((await allowed[Symbol.asyncIterator]().next()).value?.kind).toBe("full");
  });

  test("fake news from cards are flagged for moderation", async () => {
    const { runtime } = await setup();
    const card = runtime.snapshot.teams.a?.card;
    if (card) card.id = "fake-news";
    runtime.submit(
      { kind: "team", teamId: "a", userId: "u-a", name: "Lina" },
      {
        type: "card.play",
        payload: { kind: "fake-news", source: "tabloid", region: null, title: "Rumeur", body: "…" },
      },
    );
    const [message] = [(await runtime.streamAdmin().next()).value];
    if (message?.kind !== "full") throw new Error("expected a full view");
    expect(message.view.cardNews).toEqual([
      expect.objectContaining({ title: "Rumeur", teamId: "a" }),
    ]);
  });
});
