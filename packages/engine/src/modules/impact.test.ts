import { describe, expect, test } from "bun:test";
import { gameEngine as engine } from "../index.ts";
import { memberOf, mustApply, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { teamView } from "../views.ts";
import { impactScores, recordProduction, recordPurchase, recordTransport } from "./impact.ts";

const t1 = memberOf("t1");

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

describe("starting point", () => {
  test("both indicators start at 50 with no data", () => {
    expect(impactScores(team(startedGame(engine, ["azura"])))).toMatchObject({
      environmental: 50,
      social: 50,
      hints: [],
    });
  });
});

describe("environmental", () => {
  test("purchases are weighted by volume of the supplier's environmental rating", () => {
    let state = startedGame(engine, ["azura"]);
    state = mustApply(engine, state, t1, {
      type: "purchase.buyMaterial",
      payload: { supplierId: "bioplast-nordique", quantity: 100 }, // 85
    });
    state = mustApply(engine, state, t1, {
      type: "purchase.buyMaterial",
      payload: { supplierId: "polyferr", quantity: 300 }, // 15
    });
    const scores = impactScores(team(state));
    expect(scores.breakdown.environmental.purchases).toBe(32.5); // (8 500 + 4 500) / 400
    expect(scores.environmental).toBe(32.5); // the only sub-score with data
    expect(scores.hints).toContain("75 % de vos achats viennent de fournisseurs mal notés.");
  });

  test("the black market counts as 0 on both indicators", () => {
    const state = mustApply(engine, startedGame(engine, ["azura"]), t1, {
      type: "blackMarket.buy",
      payload: { material: "flour", quantity: 10 },
    });
    expect(impactScores(team(state))).toMatchObject({ environmental: 0, social: 0 });
  });

  test("production footprint depends on the tier, Ferronia pollutes more", () => {
    const azura = team(startedGame(engine, ["azura"]));
    recordProduction(azura, "bread", 10);
    recordProduction(azura, "laptop", 10);
    expect(impactScores(azura).breakdown.environmental.production).toBe(50);
    const ferronia = team(startedGame(engine, ["ferronia"]));
    recordProduction(ferronia, "bread", 10);
    expect(impactScores(ferronia).breakdown.environmental.production).toBe(50);
    expect(impactScores(ferronia).hints).toContain("Votre production à Ferronia pollue davantage.");
  });

  test("transport: green 90, standard 50, express 10, with an express hint", () => {
    const company = team(startedGame(engine, ["azura"]));
    recordTransport(company, "express", 60);
    recordTransport(company, "green", 40);
    const scores = impactScores(company);
    expect(scores.breakdown.environmental.transport).toBe(42);
    expect(scores.hints).toContain("60 % de vos expéditions partent en express.");
  });

  test("the indicator averages the sub-scores, so volume in one area cannot drown the others", () => {
    const company = team(startedGame(engine, ["azura"]));
    recordPurchase(company, 10_000, { social: 50, environmental: 20 });
    recordTransport(company, "green", 10);
    expect(impactScores(company).environmental).toBe(55); // (20 + 90) / 2
  });
});

describe("social", () => {
  test("wages at the regional base score 50; 25% above scores 100", () => {
    const company = team(startedGame(engine, ["azura"]));
    company.hr.wageRatioSum = 10;
    company.hr.employeeDays = 10;
    expect(impactScores(company).breakdown.social.wages).toBe(50);
    company.hr.wageRatioSum = 12.5;
    expect(impactScores(company).breakdown.social.wages).toBe(100);
    expect(impactScores(company).social).toBe(100);
  });

  test("strikes (capped at 20), layoffs and convictions are penalties", () => {
    const company = team(startedGame(engine, ["azura"]));
    company.hr.strikeDays = 50;
    company.hr.layoffs = 2;
    company.blackMarket.convictions = 1;
    const scores = impactScores(company);
    expect(scores.breakdown.social.penalties).toEqual({
      strikes: 20,
      layoffs: 6,
      convictions: 15,
      resignations: 0,
    });
    expect(scores.social).toBe(50 - 41);
  });

  test("the team view exposes both indicators and their breakdown", () => {
    const view = teamView(startedGame(engine, ["azura"]), "t1");
    expect(view?.impact).toMatchObject({ environmental: 50, social: 50 });
  });
});
