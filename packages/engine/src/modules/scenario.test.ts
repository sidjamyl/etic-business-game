import { describe, expect, test } from "bun:test";
import { materialSupplierById, scenarioEvents, scenarioNews } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { publicView, teamView } from "../views.ts";
import { baseWage } from "./hr.ts";
import { publishNews } from "./scenario.ts";
import { newMachine } from "./shared.ts";

const t1 = memberOf("t1");

/** Moves the clock to the last step of `day - 1`, so the next step starts `day`. */
function jumpTo(state: GameState, day: number): GameState {
  state.time = { day: day - 1, step: state.config.stepsPerDay - 1 };
  return state;
}

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

describe("news", () => {
  test("the first news comes out at the first step, without revealing its origin", () => {
    const state = engine.step(startedGame(engine, ["azura"]));
    expect(state.news.map((n) => n.title)).toContain("La reprise se fait attendre");
    const shown = publicView(state).news[0];
    expect(shown).toMatchObject({ source: "serious", day: 1 });
    expect(shown).not.toHaveProperty("origin");
    expect(JSON.stringify(teamView(state, "t1")?.news)).not.toContain("scenario");
  });

  test("news is published on its day and kept in the archive", () => {
    let state = jumpTo(startedGame(engine, ["azura"]), 21);
    state = engine.step(state);
    const titles = state.news.map((n) => n.title);
    expect(titles).toContain("Les meuniers d'Azura font grise mine");
    expect(titles).not.toContain("Sécheresse : les Moulins d'Azura à l'arrêt");
    expect(state.news).toHaveLength(scenarioNews.filter((n) => n.day <= 21).length);
  });

  test("a card's fake news looks exactly like a real one", () => {
    const state = startedGame(engine, ["azura"]);
    publishNews(
      state,
      { source: "serious", region: null, title: "Faux", body: "…" },
      { kind: "card", teamId: "t1" },
    );
    const shown = publicView(state).news.at(-1);
    expect(Object.keys(shown ?? {}).sort()).toEqual(
      ["body", "day", "id", "region", "source", "step", "title"].sort(),
    );
  });

  test("every event has at least one news item on or before its day", () => {
    for (const event of scenarioEvents) {
      expect(scenarioNews.some((n) => n.day <= event.day && n.day >= event.day - 15)).toBe(true);
    }
  });
});

describe("supplier events", () => {
  test("drought: Moulins d'Azura out for 10 days, flour +30% for 15 days, then back", () => {
    let state = engine.step(jumpTo(startedGame(engine, ["azura"]), 25));
    expect(state.market.suppliers["moulins-azura"]?.stock).toBe(0);
    expect(state.market.suppliers["farines-ferro"]?.priceFactor).toBe(1.3);
    expect(
      refusalOf(engine, state, t1, {
        type: "purchase.buyMaterial",
        payload: { supplierId: "moulins-azura", quantity: 1 },
      })?.message,
    ).toBe("Moulins d'Azura est en rupture de stock.");
    state = advanceDays(engine, state, 10); // day 35
    expect(state.market.suppliers["moulins-azura"]?.stock).toBe(
      materialSupplierById.get("moulins-azura")?.restock.level,
    );
    expect(state.market.suppliers["farines-ferro"]?.priceFactor).toBe(1.3);
    state = advanceDays(engine, state, 5); // day 40
    expect(state.market.suppliers["farines-ferro"]?.priceFactor).toBe(1);
    expect(state.scenario.active["e-drought"]).toBeUndefined();
  });

  test("components shortage halves the stock and the restock level", () => {
    let state = engine.step(jumpTo(startedGame(engine, ["azura"]), 260));
    const half = Math.floor((materialSupplierById.get("nordtech")?.restock.level ?? 0) * 0.5);
    expect(state.market.suppliers.nordtech).toMatchObject({ stock: half, priceFactor: 1.8 });
    state = advanceDays(engine, state, 8); // a weekly restock happens meanwhile
    expect(state.market.suppliers.nordtech?.stock).toBe(half);
  });
});

describe("demand events", () => {
  test("heat wave boosts bottled water for 12 days", () => {
    let state = engine.step(jumpTo(startedGame(engine, ["azura"]), 45));
    expect(Object.values(state.market.demandModifiers)).toEqual([
      expect.objectContaining({ productId: "bottled-water", factor: 1.6, untilDay: 56 }),
    ]);
    state = advanceDays(engine, state, 12);
    expect(state.market.demandModifiers).toEqual({});
  });
});

describe("other events", () => {
  test("dock strike delays shipments to and from Port-Libre", () => {
    const state = jumpTo(startedGame(engine, ["ferronia"]), 95);
    team(state).shipments.s1 = {
      id: "s1",
      orderId: "o1",
      productId: "bread",
      destination: "port-libre",
      quantity: 10,
      option: "standard",
      cost: 0,
      status: "in-transit",
      travelDays: 2,
      departedDay: 94,
      arrivesOnDay: 96,
    };
    const after = engine.step(state);
    expect(team(after).shipments.s1?.arrivesOnDay).toBe(99);
    // Shipping previews can add the delay to new routes as well.
    expect(teamView(after, "t1")?.market.transportDelays).toEqual([
      expect.objectContaining({ region: "port-libre", extraDays: 3 }),
    ]);
  });

  test("Nordhaven's wage rise applies to new hires", () => {
    const state = engine.step(jumpTo(startedGame(engine, ["nordhaven"]), 150));
    expect(baseWage(state, team(state), "operator")).toBe(2_760);
    const hired = mustApply(engine, state, t1, {
      type: "hr.hire",
      payload: { job: "operator", count: 1 },
    });
    expect(Object.values(team(hired).employees)[0]?.wage).toBe(2_760);
  });

  test("the Ferronia accident stops local machines for 2 days without repairing them", () => {
    const state = jumpTo(startedGame(engine, ["ferronia", "azura"]), 200);
    const machine = newMachine("m1", "oven");
    machine.efficiency = 0.7;
    team(state).machines.m1 = machine;
    team(state, "t2").machines.m2 = newMachine("m2", "oven");
    let after = engine.step(state);
    expect(team(after).machines.m1).toMatchObject({ status: "stopped", stoppedUntilDay: 202 });
    expect(team(after, "t2").machines.m2?.status).not.toBe("stopped");
    after = advanceDays(engine, after, 2);
    expect(team(after).machines.m1).toMatchObject({ stoppedUntilDay: null, efficiency: 0.7 });
  });
});
