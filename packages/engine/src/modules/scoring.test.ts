import { describe, expect, test } from "bun:test";
import { materialSupplierById } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { memberOf, mustApply, ORGANIZER, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { publicView, teamView } from "../views.ts";
import { computeRanking } from "./scoring.ts";

function team(state: GameState, id: string): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

function threeCompanies() {
  const state = startedGame(engine, ["azura", "azura", "azura"]);
  team(state, "t1").cash = 200_000; // A: rich, impact 40
  team(state, "t1").hr = { ...team(state, "t1").hr, layoffs: 2, strikeDays: 4 }; // social 40
  team(state, "t2").cash = 170_000; // B: impact 80 → wins (R18 example)
  team(state, "t2").hr = { ...team(state, "t2").hr, wageRatioSum: 1.15, employeeDays: 1 }; // wages 80
  team(state, "t2").impact.transport = { units: 10, environmentalSum: 800, expressUnits: 0 };
  team(state, "t2").impact.purchases = {
    units: 10,
    environmentalSum: 800,
    socialSum: 800,
    lowRatedUnits: 0,
  };
  team(state, "t3").cash = 10_000;
  team(state, "t3").finance.debt = 30_000; // negative net cash
  return state;
}

describe("ranking (R18)", () => {
  test("70% economic relative to the best net cash + 30% impact", () => {
    const ranking = computeRanking(threeCompanies());
    const byTeam = Object.fromEntries(ranking.map((e) => [e.teamId, e]));
    expect(byTeam.t1).toMatchObject({ netCash: 200_000, economic: 100, impact: 45, final: 83.5 });
    expect(byTeam.t2).toMatchObject({ netCash: 170_000, economic: 85, impact: 80, final: 83.5 });
    expect(byTeam.t3).toMatchObject({ netCash: -20_000, economic: 0 });
  });

  test("ties go to the higher net cash", () => {
    const ranking = computeRanking(threeCompanies());
    expect(ranking.map((e) => e.teamId)).toEqual(["t1", "t2", "t3"]);
    expect(ranking.map((e) => e.rank)).toEqual([1, 2, 3]);
  });
});

describe("end of game (R19)", () => {
  test("unpaid deliveries, undelivered supplier orders and reservations are dropped", () => {
    let state = startedGame(engine, ["azura", "azura"]);
    state = mustApply(engine, state, memberOf("t1"), {
      type: "purchase.buyMaterial",
      payload: { supplierId: "moulins-azura", quantity: 10 },
    });
    team(state, "t1").inventory.bread = 50;
    team(state, "t1").reserved.bread = 20;
    state = mustApply(engine, state, ORGANIZER, { type: "control.end" });
    expect(team(state, "t1")).toMatchObject({
      inbound: {},
      orders: {},
      reserved: {},
      shipments: {},
    });
    expect(team(state, "t1").cash).toBe(
      50_000 - 10 * (materialSupplierById.get("moulins-azura")?.price ?? 0),
    ); // lost, not refunded
    expect(state.results?.ranking).toHaveLength(2);
  });
});

describe("reveal (N21)", () => {
  function ended() {
    return mustApply(engine, threeCompanies(), ORGANIZER, { type: "control.end" });
  }
  const revealNext = { type: "control.revealNext" };
  const showBreakdown = { type: "control.showBreakdown" };

  test("nothing is public until the organizer reveals, then from last to first", () => {
    let state = ended();
    expect(publicView(state).results).toMatchObject({ revealedCount: 0, ranking: [] });
    state = mustApply(engine, state, ORGANIZER, revealNext);
    expect(publicView(state).results?.ranking).toEqual([
      { rank: 3, teamId: "t3", companyName: "Société 3" },
    ]);
    expect(state.announcements.at(-1)?.message).toBe("3e : Société 3");
    state = mustApply(engine, state, ORGANIZER, revealNext);
    state = mustApply(engine, state, ORGANIZER, revealNext);
    expect(state.announcements.at(-1)?.message).toBe("Victoire de Société 1 !");
    expect(refusalOf(engine, state, ORGANIZER, revealNext)?.message).toBe(
      "Tout le classement est déjà révélé.",
    );
  });

  test("the breakdown comes last; teams see results only then", () => {
    let state = ended();
    expect(refusalOf(engine, state, ORGANIZER, showBreakdown)?.message).toBe(
      "Révélez d'abord tout le classement.",
    );
    for (let i = 0; i < 3; i++) state = mustApply(engine, state, ORGANIZER, revealNext);
    expect(teamView(state, "t2")?.results).toBeNull();
    expect(JSON.stringify(publicView(state).results)).not.toContain("netCash");
    state = mustApply(engine, state, ORGANIZER, showBreakdown);
    expect(publicView(state).results?.ranking[0]).toMatchObject({
      rank: 1,
      netCash: 200_000,
      final: 83.5,
    });
    expect(teamView(state, "t2")?.results?.finished).toBe(true);
  });

  test("players cannot drive the reveal", () => {
    expect(refusalOf(engine, ended(), memberOf("t1"), revealNext)?.code).toBe("FORBIDDEN");
  });
});
