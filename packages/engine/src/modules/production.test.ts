import { describe, expect, test } from "bun:test";
import { productionRules } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { advanceDays, memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { newMachine } from "./shared.ts";

const t1 = memberOf("t1");
const MACHINE = "m-oven";

/** A running Azura company with an oven, 2 present operators and the given materials. */
function factory(options: { operators?: number; flour?: number; water?: number } = {}) {
  let state = startedGame(engine, ["azura"]);
  state = mustApply(engine, state, t1, {
    type: "hr.hire",
    payload: { job: "operator", count: options.operators ?? 2 },
  });
  state = advanceDays(engine, state, 2); // operators arrive on day 3
  const team = state.teams.t1 as TeamState;
  team.machines[MACHINE] = newMachine(MACHINE, "oven");
  team.inventory = { flour: options.flour ?? 200, water: options.water ?? 100 };
  state = mustApply(engine, state, t1, {
    type: "production.assignOperators",
    payload: { machineId: MACHINE, employeeIds: Object.keys(team.employees) },
  });
  return state;
}

function setJob(state: GameState, cycles = 1, productId = "bread") {
  return mustApply(engine, state, t1, {
    type: "production.setJob",
    payload: { machineId: MACHINE, productId, cycles },
  });
}

const machine = (state: GameState) => state.teams.t1?.machines[MACHINE];

describe("cycles", () => {
  test("materials are consumed and the output fixed at the start; it lands after the cycle", () => {
    let state = setJob(factory());
    state = engine.step(state);
    expect(machine(state)?.status).toBe("running");
    expect(state.teams.t1?.inventory).toEqual({ flour: 120, water: 60 }); // 40 bread × (2 + 1)
    state = advanceDays(engine, state, 1);
    expect(state.teams.t1?.inventory.bread).toBe(40);
    expect(state.teams.t1?.stats.produced.bread).toBe(40);
    expect(machine(state)).toMatchObject({ status: "idle", job: null, cycle: null });
  });

  test("a queue runs its cycles back to back", () => {
    let state = setJob(factory(), 2);
    state = advanceDays(engine, state, 2);
    state = engine.step(state);
    // The second cycle starts after one day of wear: floor(40 × 0.99) = 39.
    expect(state.teams.t1?.inventory.bread).toBe(79);
  });

  test("without enough operators the machine waits and consumes nothing", () => {
    let state = setJob(factory({ operators: 1 }));
    state = engine.step(state);
    expect(machine(state)?.status).toBe("waiting-operators");
    expect(state.teams.t1?.inventory.flour).toBe(200);
  });

  test("without materials the machine waits", () => {
    let state = setJob(factory({ flour: 10 }));
    state = engine.step(state);
    expect(machine(state)?.status).toBe("waiting-materials");
  });

  test("output = per-cycle output × machine efficiency × operators' efficiency", () => {
    let state = setJob(factory());
    const team = state.teams.t1 as TeamState;
    const oven = team.machines[MACHINE];
    if (oven) oven.efficiency = 0.9;
    for (const employee of Object.values(team.employees)) employee.efficiency = 0.9;
    state = advanceDays(engine, state, 1);
    state = engine.step(state);
    expect(state.teams.t1?.inventory.bread).toBe(32); // floor(40 × 0.9 × 0.9)
  });

  test("a strike freezes the cycle", () => {
    let state = setJob(factory());
    state = engine.step(state);
    const team = state.teams.t1 as TeamState;
    team.hr.unpaidWages = 1;
    const progress = machine(state)?.cycle?.stepsDone;
    state = engine.step(state);
    expect(machine(state)).toMatchObject({ status: "strike", cycle: { stepsDone: progress } });
  });

  test("stopping the queue lets the current cycle finish", () => {
    let state = setJob(factory(), 3);
    state = engine.step(state);
    state = mustApply(engine, state, t1, {
      type: "production.stop",
      payload: { machineId: MACHINE },
    });
    state = advanceDays(engine, state, 2);
    expect(state.teams.t1?.inventory.bread).toBe(40);
  });

  test("a full warehouse holds the output on the machine until space frees up", () => {
    let state = setJob(factory());
    const team = state.teams.t1 as TeamState;
    team.warehouse.capacity = 200; // 300 materials - 120 consumed = 180 left, no room for 40
    state = advanceDays(engine, state, 1);
    state = engine.step(state);
    expect(machine(state)).toMatchObject({
      status: "waiting-space",
      pendingOutput: { productId: "bread", quantity: 40 },
    });
    (state.teams.t1 as TeamState).warehouse.capacity = 500;
    state = engine.step(state);
    expect(state.teams.t1?.inventory.bread).toBe(40);
  });
});

describe("wear and maintenance", () => {
  test("each day of operation costs 1% efficiency, idle days cost nothing", () => {
    let state = setJob(factory({ flour: 2000, water: 1000 }), 3);
    (state.teams.t1 as TeamState).warehouse.capacity = 5_000;
    state = advanceDays(engine, state, 3);
    expect(machine(state)?.efficiency).toBe(0.97);
    state = advanceDays(engine, state, 3);
    expect(machine(state)?.efficiency).toBeCloseTo(0.96, 5);
  });

  test("wear stops at the floor", () => {
    const state = setJob(factory());
    const oven = machine(state);
    if (oven) oven.efficiency = productionRules.minEfficiency;
    expect(machine(advanceDays(engine, state, 2))?.efficiency).toBe(productionRules.minEfficiency);
  });

  test("maintenance costs 10% of the price, stops the machine 3 days and restores 95%", () => {
    let state = factory();
    const oven = machine(state);
    if (oven) oven.efficiency = 0.6;
    const cash = state.teams.t1?.cash ?? 0;
    state = mustApply(engine, state, t1, {
      type: "production.maintain",
      payload: { machineId: MACHINE },
    });
    expect(state.teams.t1?.cash).toBe(cash - 800);
    state = advanceDays(engine, state, 2);
    expect(machine(state)?.status).toBe("maintenance");
    state = advanceDays(engine, state, 1);
    expect(machine(state)).toMatchObject({ efficiency: 0.95, maintenanceUntilDay: null });
  });

  test("maintenance is refused during a cycle", () => {
    const state = engine.step(setJob(factory()));
    expect(
      refusalOf(engine, state, t1, {
        type: "production.maintain",
        payload: { machineId: MACHINE },
      }),
    ).toEqual({
      code: "INVALID_STATE",
      message: "Impossible de lancer une maintenance pendant un cycle : attendez sa fin.",
    });
  });
});

describe("operators and machines", () => {
  test("operators cannot change during a cycle", () => {
    const state = engine.step(setJob(factory()));
    expect(
      refusalOf(engine, state, t1, {
        type: "production.assignOperators",
        payload: { machineId: MACHINE, employeeIds: [] },
      })?.code,
    ).toBe("INVALID_STATE");
  });

  test("only operators can be assigned", () => {
    let state = factory();
    state = mustApply(engine, state, t1, {
      type: "hr.hire",
      payload: { job: "logistician", count: 1 },
    });
    const logistician = Object.values(state.teams.t1?.employees ?? {}).find(
      (e) => e.job === "logistician",
    );
    expect(
      refusalOf(engine, state, t1, {
        type: "production.assignOperators",
        payload: { machineId: MACHINE, employeeIds: [logistician?.id ?? ""] },
      })?.message,
    ).toBe("Seuls les opérateurs peuvent travailler sur une machine.");
  });

  test("incompatible products are refused", () => {
    expect(
      refusalOf(engine, factory(), t1, {
        type: "production.setJob",
        payload: { machineId: MACHINE, productId: "soap", cycles: 1 },
      })?.message,
    ).toBe("« Four industriel » ne fabrique pas Savon.");
  });

  test("scrapping frees the operators", () => {
    const state = mustApply(engine, factory(), t1, {
      type: "production.scrap",
      payload: { machineId: MACHINE },
    });
    expect(state.teams.t1?.machines[MACHINE]).toBeUndefined();
    expect(Object.values(state.teams.t1?.employees ?? {}).every((e) => e.machineId === null)).toBe(
      true,
    );
  });
});
