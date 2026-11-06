import { describe, expect, test } from "bun:test";
import { type Employee, gameEngine, newMachine, type TeamState } from "@etic/engine";
import {
  autoFill,
  canProgram,
  count,
  cycleLock,
  cycleProgress,
  cyclesCovered,
  efficiencyTone,
  incomingMachines,
  lockNote,
  machineCrew,
  machineNames,
  machineSituation,
  maintenancePlan,
  materialLines,
  namedMachines,
  ofItem,
  operatorChoices,
  outputForecast,
  productionSummary,
  productLock,
  productOptions,
  transfers,
  unassignedOperators,
  withOperators,
} from "./machines.ts";

const clean = (text: string) => text.replace(/\s/g, " ");
const DAY = 10;

/** A fresh company from the engine, ready to be shaped by each test. */
function company(): TeamState {
  const state = gameEngine.createGame({
    id: "g-test",
    seed: "seed",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: [{ id: "t1", name: "Équipe 1" }],
  });
  const team = structuredClone(state.teams.t1);
  if (!team) throw new Error("missing team");
  team.region = "azura";
  team.cash = 50_000;
  return team;
}

function operator(id: string, overrides: Partial<Employee> = {}): Employee {
  return {
    id,
    job: "operator",
    wage: 2_000,
    efficiency: 1,
    hiredOnDay: 1,
    arrivesOnDay: 3,
    lastRaiseDay: 1,
    machineId: null,
    ...overrides,
  };
}

/** A company with one oven ("m-1") and two present operators on it. */
function ovenCompany() {
  const team = company();
  const oven = newMachine("m-1", "oven");
  team.machines[oven.id] = oven;
  team.employees["e-2"] = operator("e-2", { machineId: "m-1" });
  team.employees["e-3"] = operator("e-3", { machineId: "m-1" });
  return { team, oven };
}

describe("labels", () => {
  test("French elision before a vowel", () => {
    expect(ofItem("bread")).toBe("de Pain");
    expect(ofItem("bottled-water")).toBe("d'Eau en bouteille");
    expect(ofItem("oil")).toBe("d'Huile végétale");
  });

  test("count keeps the singular for 0 and 1", () => {
    expect(count(0, "cycle")).toBe("0 cycle");
    expect(count(1, "cycle")).toBe("1 cycle");
    expect(count(3, "cycle")).toBe("3 cycles");
    expect(clean(count(1_200, "place libre", "places libres"))).toBe("1 200 places libres");
  });

  test("machines keep their acquisition order and are numbered when a type repeats", () => {
    const team = company();
    team.machines["m-12"] = newMachine("m-12", "oven");
    team.machines["m-3"] = newMachine("m-3", "oven");
    team.machines["m-7"] = newMachine("m-7", "bottling-line");
    expect(namedMachines(team).map(({ machine, name }) => [machine.id, clean(name)])).toEqual([
      ["m-3", "Four industriel n° 1"],
      ["m-7", "Ligne d'embouteillage"],
      ["m-12", "Four industriel n° 2"],
    ]);
    expect(machineNames(team).get("m-7")).toBe("Ligne d'embouteillage");
  });

  test("efficiency tones", () => {
    expect(efficiencyTone(1)).toBe("success");
    expect(efficiencyTone(0.7)).toBe("warning");
    expect(efficiencyTone(0.45)).toBe("danger");
  });
});

describe("crew", () => {
  test("present and en-route operators, average efficiency of those at work", () => {
    const { team, oven } = ovenCompany();
    const e2 = team.employees["e-2"];
    if (e2) e2.efficiency = 0.9;
    team.employees["e-9"] = operator("e-9", { machineId: "m-1", arrivesOnDay: DAY + 2 });
    const crew = machineCrew(team, oven, DAY);
    expect(crew.required).toBe(2);
    expect(crew.present.map((e) => e.id)).toEqual(["e-2", "e-3"]);
    expect(crew.enRoute.map((e) => e.id)).toEqual(["e-9"]);
    expect(crew.efficiency).toBeCloseTo(0.95);
    expect(crew.nextArrivalDay).toBe(DAY + 2);
  });

  test("changes are locked during a cycle or while its output waits for space", () => {
    const { oven } = ovenCompany();
    expect(cycleLock(oven)).toBeNull();
    oven.cycle = { productId: "bread", output: 40, stepsDone: 1, stepsTotal: 4 };
    expect(cycleLock(oven)).toContain("Cycle en cours");
    oven.cycle = null;
    oven.pendingOutput = { productId: "bread", quantity: 40 };
    expect(cycleLock(oven)).toContain("en attente de place");
  });

  test("the lock note tells how to free a machine whose queue chains cycles", () => {
    const { oven } = ovenCompany();
    expect(lockNote(oven)).toBeNull();
    oven.cycle = { productId: "bread", output: 40, stepsDone: 1, stepsTotal: 4 };
    expect(lockNote(oven)).toContain("à la fin du cycle en cours");
    oven.job = { productId: "bread", cyclesRemaining: 3 };
    expect(lockNote(oven)).toContain("arrêtez la file");
    oven.cycle = null;
    oven.pendingOutput = { productId: "bread", quantity: 40 };
    expect(lockNote(oven)).toContain("rangée dans l'entrepôt");
  });
});

describe("products", () => {
  test("tier and branch locks explain themselves", () => {
    const team = company();
    expect(productLock(team, "bread")).toBeNull();
    expect(productLock(team, "packaged-meal")?.short).toBe("palier 2");
    team.progression.project = { tier: 2, branch: null, completesOnDay: 42 };
    expect(productLock(team, "packaged-meal")?.reason).toContain("jour 42");
    team.progression = { unlockedTier: 3, branch: "tech", project: null };
    expect(productLock(team, "laptop")).toBeNull();
    expect(productLock(team, "console")?.reason).toBe(
      "Réservé à la branche Loisirs : votre entreprise a choisi Tech.",
    );
  });

  test("a machine lists its compatible products with cycle settings and recipe", () => {
    const options = productOptions(company(), "oven");
    expect(options.map((o) => [o.productId, o.cycleDays, o.outputPerCycle, o.lock?.short])).toEqual(
      [
        ["bread", 1, 40, undefined],
        ["packaged-meal", 2, 30, "palier 2"],
      ],
    );
    expect(options[0]?.recipe).toBe("2 × Farine, 1 × Eau");
    expect(productOptions(company(), "unknown-type")).toEqual([]);
  });
});

describe("materials and output", () => {
  test("materials per cycle against the stock, with the next delivery", () => {
    const { team, oven } = ovenCompany();
    team.inventory = { flour: 200, water: 50 };
    team.inbound["in-5"] = {
      id: "in-5",
      supplierId: "s",
      arrivesOnDay: DAY + 3,
      status: "in-transit",
      kind: "material",
      item: "water",
      quantity: 300,
    };
    const lines = materialLines(team, oven, "bread");
    expect(lines).toEqual([
      { item: "flour", perCycle: 80, inStock: 200, incoming: null },
      {
        item: "water",
        perCycle: 40,
        inStock: 50,
        incoming: { quantity: 300, arrivesOnDay: DAY + 3, waitingSpace: false },
      },
    ]);
    expect(cyclesCovered(lines)).toBe(1);
    expect(cyclesCovered([])).toBe(0);
  });

  test("forecast = output per cycle × machine × operators, ready with a full crew", () => {
    const { team, oven } = ovenCompany();
    oven.efficiency = 0.9;
    const e2 = team.employees["e-2"];
    if (e2) e2.efficiency = 0.9;
    const forecast = outputForecast(team, oven, "bread", DAY);
    expect(forecast).toMatchObject({ nominal: 40, perCycle: 34, ready: true, present: 2 });
    delete team.employees["e-3"];
    expect(outputForecast(team, oven, "bread", DAY)).toMatchObject({ ready: false, present: 1 });
  });

  test("cycle progress and time left", () => {
    const { oven } = ovenCompany();
    expect(cycleProgress(oven, 4)).toBeNull();
    oven.cycle = { productId: "bread", output: 38, stepsDone: 3, stepsTotal: 8 };
    oven.status = "running";
    expect(cycleProgress(oven, 4)).toEqual({
      productId: "bread",
      output: 38,
      ratio: 3 / 8,
      daysLeft: 1.25,
      paused: false,
    });
    oven.status = "strike";
    expect(cycleProgress(oven, 4)?.paused).toBe(true);
  });
});

describe("maintenance", () => {
  test("cost, duration and efficiency after maintenance", () => {
    const { team, oven } = ovenCompany();
    oven.efficiency = 0.7;
    expect(maintenancePlan(team, oven, DAY)).toEqual({
      cost: 800,
      days: 3,
      returnDay: DAY + 3,
      efficiencyAfter: 0.95,
      blocker: null,
    });
  });

  test("refused during a cycle, when useless, when already running or too expensive", () => {
    const { team, oven } = ovenCompany();
    oven.efficiency = 0.7;
    oven.cycle = { productId: "bread", output: 28, stepsDone: 1, stepsTotal: 4 };
    expect(maintenancePlan(team, oven, DAY).blocker?.reason).toBe("cycle");
    oven.cycle = null;
    oven.maintenanceUntilDay = DAY + 1;
    expect(maintenancePlan(team, oven, DAY).blocker?.message).toContain("déjà en cours");
    oven.maintenanceUntilDay = null;
    team.cash = 1_000;
    team.reservedCash = 500;
    const funds = maintenancePlan(team, oven, DAY).blocker;
    expect(funds?.reason).toBe("funds");
    expect(clean(funds?.message ?? "")).toContain("il faut ₢800");
    oven.efficiency = 0.97;
    expect(maintenancePlan(team, oven, DAY).blocker).toMatchObject({ reason: "no-gain" });
  });
});

describe("situation", () => {
  test("waiting for materials names what is missing and what is coming", () => {
    const { team, oven } = ovenCompany();
    oven.status = "waiting-materials";
    oven.job = { productId: "bread", cyclesRemaining: 5 };
    team.inventory = { flour: 30, water: 100 };
    const situation = machineSituation(team, oven, DAY);
    expect(situation.label).toBe("Manque de matières");
    expect(situation.tone).toBe("warning");
    expect(situation.detail).toBe(
      "Il manque des matières pour un cycle de Pain : Farine 30 sur 80. Commandez-en dans Achats.",
    );
    team.inventory = { flour: 100, water: 100 };
    expect(machineSituation(team, oven, DAY).detail).toContain("démarre dans un instant");
  });

  test("waiting for operators counts who is there and who is coming", () => {
    const { team, oven } = ovenCompany();
    oven.status = "waiting-operators";
    delete team.employees["e-3"];
    team.employees["e-8"] = operator("e-8", { machineId: "m-1", arrivesOnDay: DAY + 1 });
    expect(machineSituation(team, oven, DAY).detail).toBe(
      `1 opérateur présent sur 2 requis. 1 autre arrive le jour ${DAY + 1}.`,
    );
  });

  test("strike, forced stop, maintenance and idle machines", () => {
    const { team, oven } = ovenCompany();
    oven.status = "strike";
    team.hr.unpaidWages = 4_000;
    team.hr.strikeStartDay = 8;
    expect(clean(machineSituation(team, oven, DAY).detail)).toContain("₢4 000");
    expect(machineSituation(team, oven, DAY).detail).toContain("démission collective le jour 18");
    oven.status = "stopped";
    oven.stoppedUntilDay = 14;
    expect(machineSituation(team, oven, DAY)).toMatchObject({
      label: "Arrêt forcé",
      tone: "danger",
    });
    expect(machineSituation(team, oven, DAY).detail).toContain("reprise le jour 14");
    oven.status = "maintenance";
    oven.maintenanceUntilDay = 12;
    expect(machineSituation(team, oven, DAY).detail).toContain("reprise le jour 12");
    oven.status = "idle";
    expect(machineSituation(team, oven, DAY)).toMatchObject({ kind: "idle", label: "Inactive" });
    const line = newMachine("m-9", "next-gen-line");
    expect(canProgram(team, line.typeId)).toBe(false);
    expect(machineSituation(team, line, DAY).detail).toBe(
      "Aucun produit débloqué pour cette machine. Palier 3 à débloquer dans Progression.",
    );
    oven.job = { productId: "bread", cyclesRemaining: 2 };
    expect(machineSituation(team, oven, DAY)).toMatchObject({
      kind: "starting",
      label: "Démarrage",
    });
  });

  test("a full warehouse keeps the output waiting without loss", () => {
    const { team, oven } = ovenCompany();
    oven.status = "waiting-space";
    oven.pendingOutput = { productId: "bread", quantity: 40 };
    team.warehouse.capacity = 100;
    team.inventory = { flour: 90 };
    expect(machineSituation(team, oven, DAY).detail).toContain(
      "40 × Pain attendent de la place (10 places libres)",
    );
  });
});

describe("overview", () => {
  test("summary of machines and operators", () => {
    const { team, oven } = ovenCompany();
    oven.status = "running";
    const line = newMachine("m-4", "bottling-line");
    line.status = "waiting-operators";
    team.machines[line.id] = line;
    team.employees["e-5"] = operator("e-5");
    team.employees["e-6"] = operator("e-6", { arrivesOnDay: DAY + 1 });
    team.employees["e-7"] = operator("e-7", { machineId: "m-gone" });
    team.employees["e-8"] = { ...operator("e-8"), job: "logistician" };
    team.stats.produced = { bread: 120, soap: 40 };
    expect(unassignedOperators(team)).toBe(3);
    expect(productionSummary(team, DAY)).toEqual({
      machines: 2,
      running: 1,
      blocked: 1,
      freeOperators: 2,
      assignedOperators: 2,
      enRouteOperators: 1,
      openSeats: 2,
      produced: 160,
    });
  });

  test("machines on their way from suppliers and other companies", () => {
    const team = company();
    team.inbound["in-1"] = {
      id: "in-1",
      supplierId: "s",
      arrivesOnDay: 9,
      status: "in-transit",
      kind: "machine",
      machineTypeId: "soap-vat",
    };
    const incoming = incomingMachines({
      team,
      trades: {
        offers: [],
        shipments: [
          {
            id: "t-2",
            kind: "contract",
            sellerId: "t2",
            buyerId: "t1",
            good: { kind: "machine", machineId: "m-40", typeId: "oven" },
            escrow: 5_000,
            arrivesOnDay: 7,
          },
        ],
      },
    });
    expect(incoming).toEqual([
      { id: "t-2", name: "Four industriel", arrivesOnDay: 7, viaTrade: true },
      { id: "in-1", name: "Cuve de saponification", arrivesOnDay: 9, viaTrade: false },
    ]);
  });
});

describe("assignment", () => {
  function plant() {
    const { team, oven } = ovenCompany();
    const vat = newMachine("m-20", "soap-vat");
    team.machines[vat.id] = vat;
    team.employees["e-4"] = operator("e-4", { machineId: "m-20" });
    team.employees["e-5"] = operator("e-5", { machineId: "m-20" });
    team.employees["e-6"] = operator("e-6", { efficiency: 0.8 });
    team.employees["e-7"] = operator("e-7", { efficiency: 0.95, hiredOnDay: 2 });
    team.employees["e-8"] = operator("e-8", { arrivesOnDay: DAY + 1, hiredOnDay: 9 });
    return { team, oven, vat, names: machineNames(team) };
  }

  test("own operators first, then free ones by efficiency, then those elsewhere", () => {
    const { team, oven, vat, names } = plant();
    vat.cycle = { productId: "soap", output: 40, stepsDone: 1, stepsTotal: 8 };
    const choices = operatorChoices(team, oven.id, DAY, names);
    expect(choices.map((c) => c.id)).toEqual(["e-2", "e-3", "e-7", "e-6", "e-8", "e-4", "e-5"]);
    expect(choices.find((c) => c.id === "e-7")?.name).toBe("Opérateur 6");
    expect(choices.find((c) => c.id === "e-4")).toMatchObject({
      elsewhere: { machineId: "m-20", name: "Cuve de saponification" },
      locked: "Sur « Cuve de saponification », en plein cycle",
    });
  });

  test("auto-fill takes the best free operators up to the minimum crew", () => {
    const { team, names } = plant();
    const vat = newMachine("m-30", "textile-workshop");
    team.machines[vat.id] = vat;
    const choices = operatorChoices(team, vat.id, DAY, names);
    expect([...autoFill(choices, new Set(), 3)]).toEqual(["e-7", "e-6", "e-8"]);
    expect([...autoFill(choices, new Set(["e-2", "e-3", "e-4"]), 3)]).toEqual([
      "e-2",
      "e-3",
      "e-4",
    ]);
  });

  test("preview of an assignment and of what other machines lose", () => {
    const { team, oven, names } = plant();
    const selected = new Set(["e-2", "e-4", "e-6"]);
    const preview = withOperators(team, oven.id, selected);
    expect(preview.employees["e-3"]?.machineId).toBeNull();
    expect(preview.employees["e-4"]?.machineId).toBe(oven.id);
    expect(team.employees["e-4"]?.machineId).toBe("m-20");
    // floor(40 × 1 × average(1, 1, 0.8))
    expect(outputForecast(preview, oven, "bread", DAY).perCycle).toBe(37);
    expect(transfers(team, oven.id, selected, DAY, names)).toEqual([
      { machineId: "m-20", name: "Cuve de saponification", moving: 1, remaining: 1, required: 2 },
    ]);
  });
});
