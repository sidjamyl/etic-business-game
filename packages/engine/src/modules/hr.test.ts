import { describe, expect, test } from "bun:test";
import { hrRules } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { GameState } from "../types.ts";
import { teamView } from "../views.ts";
import { payroll, targetEfficiency } from "./hr.ts";
import { credits } from "./shared.ts";

const t1 = memberOf("t1");
const t2 = memberOf("t2");
const hire = (job: "operator" | "logistician", count: number) => ({
  type: "hr.hire",
  payload: { job, count },
});

function employeeIds(state: GameState, teamId = "t1"): string[] {
  return Object.keys(state.teams[teamId]?.employees ?? {});
}

describe("hiring", () => {
  test("hires at the regional base wage; staff arrives after 2 days (R6)", () => {
    let state = mustApply(engine, startedGame(engine, ["nordhaven"]), t1, hire("logistician", 2));
    const employees = Object.values(state.teams.t1?.employees ?? {});
    expect(employees).toHaveLength(2);
    expect(employees[0]).toMatchObject({ job: "logistician", wage: 2_640, arrivesOnDay: 3 });
    expect(state.market.laborPool.nordhaven).toBe(13);
    expect(payroll(state.teams.t1 as never, state.time.day)).toBe(0);
    state = advanceDays(engine, state, 2);
    expect(payroll(state.teams.t1 as never, state.time.day)).toBe(5_280);
  });

  test("the regional pool is shared and can run out", () => {
    let state = startedGame(engine, ["nordhaven", "nordhaven"]);
    state = mustApply(engine, state, t1, hire("operator", 12));
    expect(refusalOf(engine, state, t2, hire("operator", 4))).toEqual({
      code: "POOL_EXHAUSTED",
      message: "Le bassin d'emploi de Nordhaven ne compte plus que 3 personne(s).",
    });
    state = mustApply(engine, state, t2, hire("operator", 3));
    expect(refusalOf(engine, state, t2, hire("operator", 1))?.message).toBe(
      "Le bassin d'emploi de Nordhaven est épuisé.",
    );
    expect(teamView(state, "t1")?.market.laborPool.nordhaven).toBe(0);
  });
});

describe("payroll and strikes", () => {
  test("wages are paid every 30 days", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, hire("operator", 5));
    state = advanceDays(engine, state, 29);
    expect(state.teams.t1?.cash).toBe(50_000);
    state = advanceDays(engine, state, 1); // day 31
    expect(state.teams.t1?.cash).toBe(50_000 - 5 * 1_200);
    expect(state.teams.t1?.log.at(-1)?.message).toBe(`Paie versée : ${credits(6_000)}.`);
  });

  test("an unpaid payroll starts a strike that ends once the back pay goes through", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, hire("operator", 5));
    const team = state.teams.t1;
    if (team) team.cash = 1_000;
    state = advanceDays(engine, state, 30);
    expect(state.teams.t1?.hr.unpaidWages).toBe(6_000);
    expect(state.teams.t1?.cash).toBe(1_000);
    state = advanceDays(engine, state, 2);
    expect(state.teams.t1?.hr.strikeDays).toBeGreaterThanOrEqual(2);
    const rich = state.teams.t1;
    if (rich) rich.cash = 10_000;
    state = advanceDays(engine, state, 1);
    expect(state.teams.t1?.hr.unpaidWages).toBe(0);
    expect(state.teams.t1?.cash).toBe(4_000);
  });
});

describe("efficiency and raises", () => {
  test("efficiency drops 5% every 10 days after 60 days without a raise, down to 50%", () => {
    expect(targetEfficiency(59)).toBe(1);
    expect(targetEfficiency(69)).toBe(1);
    expect(targetEfficiency(70)).toBe(0.95);
    expect(targetEfficiency(80)).toBe(0.9);
    expect(targetEfficiency(500)).toBe(hrRules.minEfficiency);
  });

  test("a raise of at least 5% resets the clock and efficiency recovers 5% per day", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, hire("operator", 1));
    state = advanceDays(engine, state, 90);
    const id = employeeIds(state)[0] ?? "";
    expect(state.teams.t1?.employees[id]?.efficiency).toBe(0.85);
    expect(
      refusalOf(engine, state, t1, {
        type: "hr.raise",
        payload: { employeeIds: [id], percent: 4 },
      })?.message,
    ).toBe("Une augmentation doit être d'au moins 5 %.");
    state = mustApply(engine, state, t1, {
      type: "hr.raise",
      payload: { employeeIds: [id], percent: 10 },
    });
    expect(state.teams.t1?.employees[id]?.wage).toBe(1_320);
    state = advanceDays(engine, state, 1);
    expect(state.teams.t1?.employees[id]?.efficiency).toBe(0.9);
    state = advanceDays(engine, state, 2);
    expect(state.teams.t1?.employees[id]?.efficiency).toBe(1);
  });
});

describe("layoffs", () => {
  test("layoffs pay half a month and give people back to the pool", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, hire("operator", 3));
    const [first, second] = employeeIds(state);
    state = mustApply(engine, state, t1, {
      type: "hr.layoff",
      payload: { employeeIds: [first, second] },
    });
    expect(state.teams.t1?.cash).toBe(50_000 - 1_200);
    expect(Object.keys(state.teams.t1?.employees ?? {})).toHaveLength(1);
    expect(state.market.laborPool.azura).toBe(39);
    expect(state.teams.t1?.hr.layoffs).toBe(2);
  });

  test("unknown employees are refused", () => {
    const state = startedGame(engine, ["azura"]);
    expect(
      refusalOf(engine, state, t1, {
        type: "hr.layoff",
        payload: { employeeIds: ["e-404"] },
      })?.code,
    ).toBe("NOT_FOUND");
  });
});

describe("social facts", () => {
  test("wage ratio and employee-days accumulate for the social indicator", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, hire("operator", 2));
    state = advanceDays(engine, state, 5);
    const hr = state.teams.t1?.hr;
    expect(hr?.employeeDays).toBe(2 * 4); // arrived on day 3, counted on days 3–6
    expect(hr?.wageRatioSum).toBe(8);
  });
});

describe("collective resignation (N25)", () => {
  test("after 10 days of strike, unpaid staff resign, arrears are cancelled, rehiring works", () => {
    let state = mustApply(engine, startedGame(engine, ["azura"]), t1, hire("operator", 5));
    const company = state.teams.t1;
    if (company) company.cash = 1_000;
    state = advanceDays(engine, state, 30); // payday fails on day 31
    expect(state.teams.t1?.hr.unpaidWages).toBe(6_000);
    state = advanceDays(engine, state, 9);
    expect(Object.keys(state.teams.t1?.employees ?? {})).toHaveLength(5);
    state = advanceDays(engine, state, 1);
    expect(state.teams.t1?.employees).toEqual({});
    expect(state.teams.t1?.hr).toMatchObject({
      unpaidWages: 0,
      strikeStartDay: null,
      massResignations: 1,
    });
    expect(state.market.laborPool.azura).toBe(40);
    expect(state.news.at(-1)?.title).toBe("Démission collective chez Société 1 !");
    expect(engine.applyCommand(state, t1, hire("operator", 2)).ok).toBe(true);
  });
});
