import { describe, expect, test } from "bun:test";
import { hrRules, impactRules } from "@etic/content";
import { type Employee, type HrState, type MachineState, targetEfficiency } from "@etic/engine";
import {
  averageEfficiency,
  efficiencyTrend,
  employeeRef,
  employeeStatus,
  groupWageChanges,
  inDays,
  jobCount,
  layoffPreview,
  machineNames,
  ofPlace,
  parseHireCount,
  parseRaisePercent,
  payrollOutlook,
  plural,
  raisedWage,
  raiseOutlook,
  raisePreview,
  severancePay,
  signedPercentValue,
  sortEmployees,
  strikeOutlook,
  wageGapPercent,
  wagesDueOn,
} from "./team-math.ts";

const clean = (text: string) => text.replace(/\s/g, " ");

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: "e-1",
    job: "operator",
    wage: 1_200,
    efficiency: 1,
    hiredOnDay: 1,
    arrivesOnDay: 3,
    lastRaiseDay: 1,
    machineId: null,
    ...overrides,
  };
}

function hr(overrides: Partial<HrState> = {}): HrState {
  return {
    nextPayrollDay: 31,
    unpaidWages: 0,
    strikeStartDay: null,
    strikeDays: 0,
    massResignations: 0,
    layoffs: 0,
    wageRatioSum: 0,
    employeeDays: 0,
    ...overrides,
  };
}

function machine(id: string, typeId: string): MachineState {
  return {
    id,
    typeId,
    efficiency: 1,
    status: "idle",
    job: null,
    cycle: null,
    pendingOutput: null,
    maintenanceUntilDay: null,
    stoppedUntilDay: null,
    ranToday: false,
  };
}

describe("labels", () => {
  test("French plurals and short references", () => {
    expect(plural(0, "employé")).toBe("0 employé");
    expect(plural(1, "employé")).toBe("1 employé");
    expect(plural(3, "employé sélectionné", "employés sélectionnés")).toBe(
      "3 employés sélectionnés",
    );
    expect(jobCount("operator", 1)).toBe("1 opérateur");
    expect(jobCount("logistician", 4)).toBe("4 logisticiens");
    expect(employeeRef("e-12")).toBe("#12");
    expect(ofPlace("Azura")).toBe("d'Azura");
    expect(ofPlace("Nordhaven")).toBe("de Nordhaven");
    expect(ofPlace("Port-Libre")).toBe("de Port-Libre");
    expect(inDays(1)).toBe("demain");
    expect(inDays(6)).toBe("dans 6 jours");
    expect(clean(signedPercentValue(10))).toBe("+10 %");
    expect(clean(signedPercentValue(-7.5))).toBe("−7,5 %");
  });

  test("operators first, then by hire day and numeric id", () => {
    const sorted = sortEmployees([
      employee({ id: "e-10", job: "logistician" }),
      employee({ id: "e-12", hiredOnDay: 4 }),
      employee({ id: "e-10" }),
      employee({ id: "e-9" }),
    ]);
    expect(sorted.map((e) => `${e.job}:${e.id}`)).toEqual([
      "operator:e-9",
      "operator:e-10",
      "operator:e-12",
      "logistician:e-10",
    ]);
  });

  test("machines are numbered only when the company owns several of a type", () => {
    const names = machineNames({
      "m-14": machine("m-14", "oven"),
      "m-3": machine("m-3", "oven"),
      "m-5": machine("m-5", "bottling-line"),
    });
    expect(names.get("m-3")).toBe("Four industriel 1");
    expect(names.get("m-14")).toBe("Four industriel 2");
    expect(names.get("m-5")).toBe("Ligne d'embouteillage");
  });
});

describe("raises and efficiency (R6)", () => {
  test("warns before the end of the grace period, then follows the drops", () => {
    expect(raiseOutlook(1, 41).level).toBe("ok");
    expect(raiseOutlook(1, 51)).toMatchObject({ level: "soon", graceLeft: 10 });
    expect(raiseOutlook(1, 61)).toMatchObject({ level: "due", graceLeft: 0, target: 1 });
    expect(raiseOutlook(1, 71)).toMatchObject({ level: "dropping", target: 0.95 });
    expect(raiseOutlook(1, 501)).toMatchObject({
      level: "floor",
      target: hrRules.minEfficiency,
      nextDropIn: null,
    });
  });

  test("the next drop is the first day the engine's target goes down", () => {
    for (let days = 0; days < 220; days++) {
      const { nextDropIn } = raiseOutlook(0, days);
      if (nextDropIn === null) {
        expect(targetEfficiency(days)).toBe(hrRules.minEfficiency);
        continue;
      }
      expect(targetEfficiency(days + nextDropIn)).toBeLessThan(targetEfficiency(days));
      expect(targetEfficiency(days + nextDropIn - 1)).toBe(targetEfficiency(days));
    }
  });

  test("efficiency recovers after a raise and follows the target down otherwise", () => {
    expect(efficiencyTrend(0.85, raiseOutlook(10, 10))).toBe("recovering");
    expect(efficiencyTrend(1, raiseOutlook(1, 30))).toBe("stable");
    expect(efficiencyTrend(0.9, raiseOutlook(1, 81))).toBe("dropping");
    expect(efficiencyTrend(0.5, raiseOutlook(1, 501))).toBe("floor");
  });

  test("raises are rounded like the engine and grouped by job and wage", () => {
    expect(raisedWage(1_200, 10)).toBe(1_320);
    expect(raisedWage(1_250, 7.5)).toBe(1_344);
    const staff = [
      employee({ id: "e-1" }),
      employee({ id: "e-2" }),
      employee({ id: "e-3", job: "logistician", wage: 1_320, arrivesOnDay: 40 }),
    ];
    expect(groupWageChanges(staff, (wage) => wage + 1)).toEqual([
      { job: "operator", count: 2, before: 1_200, after: 1_201 },
      { job: "logistician", count: 1, before: 1_320, after: 1_321 },
    ]);
    const preview = raisePreview(staff, 10, 31);
    expect(preview.monthlyIncrease).toBe(120 + 120 + 132);
    // The logistician arrives after the next payday: not paid on it.
    expect(preview.nextPayrollIncrease).toBe(240);
  });
});

describe("wages and layoffs", () => {
  test("wage gap against the regional base", () => {
    expect(wageGapPercent(1_320, 1_200)).toBe(10);
    expect(wageGapPercent(1_200, 1_200)).toBe(0);
    expect(wageGapPercent(1_140, 1_200)).toBe(-5);
    expect(wageGapPercent(1_200, 0)).toBeNull();
  });

  test("only employees at work by payday are paid", () => {
    const staff = [employee({ arrivesOnDay: 3 }), employee({ id: "e-2", arrivesOnDay: 33 })];
    expect(wagesDueOn(staff, 31)).toBe(1_200);
    expect(wagesDueOn(staff, 33)).toBe(2_400);
  });

  test("layoffs cost half a month each and social points", () => {
    expect(severancePay([employee(), employee({ id: "e-2" })])).toBe(1_200);
    const staff = [
      employee({ machineId: "m-3" }),
      employee({ id: "e-2", machineId: "m-3" }),
      employee({ id: "e-3", job: "logistician", wage: 1_320, arrivesOnDay: 40 }),
    ];
    const preview = layoffPreview(staff, 31, 62.5);
    expect(preview).toMatchObject({
      severance: Math.round(3_720 * hrRules.severanceMonths),
      socialPenalty: 3 * impactRules.penalties.perLayoff,
      socialAfter: 62.5 - 3 * impactRules.penalties.perLayoff,
      monthlySaving: 3_720,
      nextPayrollSaving: 2_400,
      machineIds: ["m-3"],
    });
    expect(layoffPreview(staff, 31, 4).socialAfter).toBe(0);
  });
});

describe("payroll and strike (R6, N25)", () => {
  test("next payroll against the available cash", () => {
    const staff = [employee(), employee({ id: "e-2", arrivesOnDay: 40, wage: 2_000 })];
    expect(payrollOutlook(staff, hr(), 500, 19)).toEqual({
      day: 31,
      daysLeft: 12,
      due: 1_200,
      paidCount: 1,
      monthly: 3_200,
      shortfall: 700,
    });
    expect(payrollOutlook(staff, hr(), 5_000, 19).shortfall).toBe(0);
    // During a strike, the arrears must be paid too.
    expect(payrollOutlook(staff, hr({ unpaidWages: 1_000 }), 1_500, 19).shortfall).toBe(700);
  });

  test("strike countdown and the employees who would resign", () => {
    expect(strikeOutlook(hr(), [], 0, 35)).toBeNull();
    const staff = [employee({ hiredOnDay: 1 }), employee({ id: "e-2", hiredOnDay: 33 })];
    const strike = strikeOutlook(
      hr({ unpaidWages: 6_000, strikeStartDay: 31, nextPayrollDay: 61 }),
      staff,
      1_000,
      35,
    );
    expect(strike).toEqual({
      arrears: 6_000,
      startDay: 31,
      resignationDay: 31 + hrRules.strikeResignationDays,
      daysLeft: 31 + hrRules.strikeResignationDays - 35,
      leaving: 1,
      shortfall: 5_000,
    });
  });

  test("employee status", () => {
    expect(employeeStatus(employee({ arrivesOnDay: 5 }), 4, false)).toBe("arriving");
    expect(employeeStatus(employee({ arrivesOnDay: 5 }), 5, false)).toBe("working");
    expect(employeeStatus(employee({ arrivesOnDay: 5 }), 5, true)).toBe("strike");
    expect(averageEfficiency([])).toBeNull();
    expect(averageEfficiency([{ efficiency: 1 }, { efficiency: 0.8 }])).toBeCloseTo(0.9);
  });
});

describe("inputs", () => {
  test("hire count", () => {
    expect(parseHireCount("3", 25)).toEqual({ value: 3, error: null });
    expect(parseHireCount("", 25).error).toBe("Entrez un nombre entier.");
    expect(parseHireCount("2.5", 25).error).toBe("Entrez un nombre entier.");
    expect(parseHireCount("0", 25).error).toBe("Recrutez au moins une personne.");
    expect(parseHireCount("3", 2).error).toBe("Le bassin ne compte plus que 2 personnes.");
    expect(parseHireCount("1", 0).error).toBe("Le bassin d'emploi est épuisé.");
    expect(parseHireCount("51", 80).error).toBe("50 recrues au maximum par décision.");
  });

  test("raise percent", () => {
    expect(parseRaisePercent("5")).toEqual({ value: 5, error: null });
    expect(parseRaisePercent("7,5")).toEqual({ value: 7.5, error: null });
    expect(clean(parseRaisePercent("4").error ?? "")).toBe("Au moins 5 % pour relancer le délai.");
    expect(clean(parseRaisePercent("51").error ?? "")).toBe("50 % au maximum.");
    expect(parseRaisePercent("abc").error).toBe("Entrez un pourcentage.");
  });
});
