import { describe, expect, test } from "bun:test";
import type { CardId } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, ORGANIZER, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { publicView, teamView } from "../views.ts";
import { newMachine } from "./shared.ts";

const t1 = memberOf("t1");
const t2 = memberOf("t2");

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

function holding(card: CardId): GameState {
  const state = startedGame(engine, ["azura", "azura"]);
  team(state).card = { id: card, used: false };
  team(state, "t2").card = { id: "spying", used: false };
  return state;
}

const play = (payload: Record<string, unknown>) => ({ type: "card.play", payload });

describe("common rules", () => {
  test("a card is used once and only by its holder", () => {
    const state = holding("social-peace");
    expect(refusalOf(engine, state, t1, play({ kind: "amnesty" }))?.message).toBe(
      "Ce n'est pas votre carte.",
    );
    const used = mustApply(engine, state, t1, play({ kind: "social-peace" }));
    expect(team(used).card?.used).toBe(true);
    expect(refusalOf(engine, used, t1, play({ kind: "social-peace" }))?.message).toBe(
      "Votre carte secrète a déjà été utilisée.",
    );
  });
});

describe("fake news", () => {
  test("is published under the chosen source, indistinguishable from a real one", () => {
    const state = mustApply(
      engine,
      holding("fake-news"),
      t1,
      play({
        kind: "fake-news",
        source: "serious",
        region: "nordhaven",
        title: "Pénurie de laptops annoncée",
        body: "Les experts sont formels.",
      }),
    );
    const published = publicView(state).news.at(-1);
    expect(published).toMatchObject({
      source: "serious",
      region: "nordhaven",
      title: "Pénurie de laptops annoncée",
    });
    expect(JSON.stringify(teamView(state, "t2")?.news)).not.toContain('"origin"');
  });

  test("length limits are enforced", () => {
    expect(
      refusalOf(
        engine,
        holding("fake-news"),
        t1,
        play({
          kind: "fake-news",
          source: "tabloid",
          region: null,
          title: "x".repeat(81),
          body: "ok",
        }),
      )?.message,
    ).toBe("Titre limité à 80 caractères.");
  });

  test("the organizer can delete a fake news item, not a real one", () => {
    let state = engine.step(holding("fake-news"));
    state = mustApply(
      engine,
      state,
      t1,
      play({
        kind: "fake-news",
        source: "tabloid",
        region: null,
        title: "Inapproprié",
        body: "…",
      }),
    );
    const fake = state.news.at(-1);
    const real = state.news[0];
    expect(
      refusalOf(engine, state, ORGANIZER, {
        type: "admin.deleteNews",
        payload: { newsId: real?.id },
      })?.code,
    ).toBe("FORBIDDEN");
    state = mustApply(engine, state, ORGANIZER, {
      type: "admin.deleteNews",
      payload: { newsId: fake?.id },
    });
    expect(state.news.map((n) => n.title)).not.toContain("Inapproprié");
  });
});

describe("spying", () => {
  test("freezes a snapshot of the competitor; the target is not told", () => {
    const state = holding("spying");
    team(state, "t2").inventory.bread = 42;
    team(state, "t2").machines.m1 = newMachine("m1", "oven");
    const after = mustApply(engine, state, t1, play({ kind: "spying", targetTeamId: "t2" }));
    expect(team(after).cardEffects.spyReport).toMatchObject({
      targetTeamId: "t2",
      cash: 50_000,
      inventory: { bread: 42 },
      machines: [{ typeId: "oven" }],
    });
    expect(team(after, "t2").log.at(-1)?.message).not.toContain("carte");
    team(after, "t2").inventory.bread = 0;
    expect(team(after).cardEffects.spyReport?.inventory.bread).toBe(42);
  });
});

describe("sabotage", () => {
  test("stops a random machine of the target for 5 days and tells it anonymously", () => {
    const state = holding("sabotage");
    team(state, "t2").machines.m1 = newMachine("m1", "oven");
    const after = mustApply(engine, state, t1, play({ kind: "sabotage", targetTeamId: "t2" }));
    expect(team(after, "t2").machines.m1?.stoppedUntilDay).toBe(6);
    const message = team(after, "t2").log.at(-1)?.message ?? "";
    expect(message).toContain("sabotage");
    expect(message).not.toContain("Société 1");
  });

  test("a company without machines cannot be sabotaged (the card is kept)", () => {
    const state = holding("sabotage");
    expect(refusalOf(engine, state, t1, play({ kind: "sabotage", targetTeamId: "t2" }))?.code).toBe(
      "INVALID_STATE",
    );
    expect(team(state).card?.used).toBe(false);
  });
});

describe("supplier priority", () => {
  test("only the holder can buy from the supplier on its next restock day", () => {
    let state = mustApply(
      engine,
      holding("supplier-priority"),
      t1,
      play({
        kind: "supplier-priority",
        supplierId: "nordtech",
      }),
    );
    expect(state.market.supplierPriority.nordtech).toEqual({ teamId: "t1", day: 8 });
    state = advanceDays(engine, state, 7); // day 8
    const order = {
      type: "purchase.buyMaterial",
      payload: { supplierId: "nordtech", quantity: 5 },
    };
    expect(refusalOf(engine, state, t2, order)?.message).toBe(
      "Nordtech Composants réserve aujourd'hui son stock à un client prioritaire.",
    );
    expect(engine.applyCommand(state, t1, order).ok).toBe(true);
    state = advanceDays(engine, state, 1);
    expect(engine.applyCommand(state, t2, order).ok).toBe(true);
  });
});

describe("social peace", () => {
  test("puts every employee back to 100% and restarts the 60-day countdown", () => {
    let state = mustApply(engine, holding("social-peace"), t1, {
      type: "hr.hire",
      payload: { job: "operator", count: 2 },
    });
    state = advanceDays(engine, state, 80);
    expect(Object.values(team(state).employees)[0]?.efficiency).toBeLessThan(1);
    state = mustApply(engine, state, t1, play({ kind: "social-peace" }));
    for (const employee of Object.values(team(state).employees)) {
      expect(employee).toMatchObject({ efficiency: 1, lastRaiseDay: state.time.day });
    }
  });
});

describe("amnesty", () => {
  test("wipes traces and silently cancels the next accusation", () => {
    let state = mustApply(engine, holding("amnesty"), t1, {
      type: "blackMarket.buy",
      payload: { material: "flour", quantity: 10 },
    });
    state = mustApply(engine, state, t1, play({ kind: "amnesty" }));
    expect(team(state).blackMarket.traces).toEqual([]);
    state = mustApply(engine, state, t1, {
      type: "blackMarket.buy",
      payload: { material: "flour", quantity: 10 },
    });
    const newsBefore = state.news.length;
    state = mustApply(engine, state, t2, {
      type: "blackMarket.accuse",
      payload: { targetTeamId: "t1" },
    });
    expect(team(state).blackMarket.convictions).toBe(0);
    expect(team(state, "t2").cash).toBe(50_000);
    expect(state.news.length).toBe(newsBefore);
    expect(team(state, "t2").log.at(-1)?.message).toBe(
      "Accusation contre Société 1 classée sans suite.",
    );
    expect(team(state).cardEffects.amnestyUntilDay).toBeNull();
  });
});
