import { hrRules, type JobId, jobIds, regionById, regions } from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { allocateId, logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { Employee, GameState, TeamState } from "../types.ts";
import { publishNews } from "./scenario.ts";
import { actingTeam, availableCash, credits, recordCash, spend } from "./shared.ts";

/** Base wage for a job in the team's region, including event wage changes (R12). */
export function baseWage(state: GameState, team: TeamState, job: JobId): number {
  const region = team.region ? regionById.get(team.region) : undefined;
  const eventFactor = team.region ? (state.market.wageFactor[team.region] ?? 1) : 1;
  return Math.round((region?.baseWage ?? 0) * eventFactor * hrRules.jobs[job].wageFactor);
}

export function activeEmployees(team: TeamState, day: number): Employee[] {
  return Object.values(team.employees).filter((e) => e.arrivesOnDay <= day);
}

export function isOnStrike(team: TeamState): boolean {
  return team.hr.unpaidWages > 0;
}

/** Wages due at the next payday, for employees already at work. */
export function payroll(team: TeamState, day: number): number {
  return activeEmployees(team, day).reduce((sum, e) => sum + e.wage, 0);
}

/** Target efficiency given the days since the last raise (R6). */
export function targetEfficiency(daysSinceRaise: number): number {
  if (daysSinceRaise < hrRules.raiseGraceDays) return 1;
  const drops = Math.floor((daysSinceRaise - hrRules.raiseGraceDays) / hrRules.decayEveryDays);
  return Math.max(hrRules.minEfficiency, round(1 - drops * hrRules.decayStep));
}

const round = (value: number) => Math.round(value * 1000) / 1000;

function findEmployees(team: TeamState, ids: readonly string[]): Employee[] {
  const unique = [...new Set(ids)];
  return unique.map((id) => {
    const employee = team.employees[id];
    if (!employee) refuse("NOT_FOUND", "Employé introuvable.");
    return employee;
  });
}

const employeeIds = z.array(z.string().min(1)).min(1, "Choisissez au moins un employé.").max(200);

export const hrCommands = [
  defineCommand({
    type: "hr.hire",
    actor: "team",
    schema: z.object({
      job: z.enum(jobIds),
      count: z
        .int("Le nombre doit être entier.")
        .min(1, "Recrutez au moins une personne.")
        .max(hrRules.maxHiresPerDecision),
    }),
    apply: (draft, { job, count }, actor) => {
      const team = actingTeam(draft, actor);
      if (!team.region) refuse("INVALID_STATE", "Choisissez d'abord une région.");
      const region = team.region;
      const available = draft.market.laborPool[region] ?? 0;
      if (available < count) {
        const name = regionById.get(region)?.name ?? region;
        refuse(
          "POOL_EXHAUSTED",
          available === 0
            ? `Le bassin d'emploi de ${name} est épuisé.`
            : `Le bassin d'emploi de ${name} ne compte plus que ${available} personne(s).`,
        );
      }
      draft.market.laborPool[region] = available - count;
      const wage = baseWage(draft, team, job);
      const arrivesOnDay = draft.time.day + hrRules.hiringDelayDays;
      for (let i = 0; i < count; i++) {
        const id = `e-${allocateId(draft)}`;
        team.employees[id] = {
          id,
          job,
          wage,
          efficiency: 1,
          hiredOnDay: draft.time.day,
          arrivesOnDay,
          lastRaiseDay: draft.time.day,
          machineId: null,
        };
      }
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Recrutement de ${count} ${hrRules.jobs[job].name.toLowerCase()}(s) à ${credits(wage)} par mois, arrivée jour ${arrivesOnDay}.`,
      });
    },
  }),

  defineCommand({
    type: "hr.raise",
    actor: "team",
    schema: z.object({
      employeeIds,
      percent: z
        .number()
        .min(
          hrRules.minRaisePercent,
          `Une augmentation doit être d'au moins ${hrRules.minRaisePercent} %.`,
        )
        .max(
          hrRules.maxRaisePercent,
          `Une augmentation ne peut pas dépasser ${hrRules.maxRaisePercent} %.`,
        ),
    }),
    apply: (draft, { employeeIds: ids, percent }, actor) => {
      const team = actingTeam(draft, actor);
      const employees = findEmployees(team, ids);
      for (const employee of employees) {
        employee.wage = Math.round(employee.wage * (1 + percent / 100));
        employee.lastRaiseDay = draft.time.day;
      }
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Augmentation de ${percent} % pour ${employees.length} employé(s).`,
      });
    },
  }),

  defineCommand({
    type: "hr.layoff",
    actor: "team",
    schema: z.object({ employeeIds }),
    apply: (draft, { employeeIds: ids }, actor) => {
      const team = actingTeam(draft, actor);
      const employees = findEmployees(team, ids);
      const severance = Math.round(
        employees.reduce((sum, e) => sum + e.wage * hrRules.severanceMonths, 0),
      );
      spend(draft, team, severance, "severance", `Indemnités de ${employees.length} employé(s)`);
      // Operators leave their machine with them (the assignment lives on the employee).
      for (const employee of employees) delete team.employees[employee.id];
      if (team.region) {
        draft.market.laborPool[team.region] =
          (draft.market.laborPool[team.region] ?? 0) + employees.length;
      }
      team.hr.layoffs += employees.length;
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Licenciement de ${employees.length} employé(s), indemnités ${credits(severance)}.`,
      });
    },
  }),
];

function updateEfficiency(team: TeamState, day: number): void {
  for (const employee of activeEmployees(team, day)) {
    const target = targetEfficiency(day - employee.lastRaiseDay);
    employee.efficiency =
      employee.efficiency > target
        ? target
        : Math.min(target, round(employee.efficiency + hrRules.recoveryPerDay));
  }
}

function runPayroll(draft: GameState, team: TeamState): void {
  const day = draft.time.day;
  // Back pay is retried every day until it goes through (R6).
  if (team.hr.unpaidWages > 0 && availableCash(team) >= team.hr.unpaidWages) {
    const paid = team.hr.unpaidWages;
    recordCash(draft, team, -paid, "wages", "Salaires en retard");
    team.hr.unpaidWages = 0;
    team.hr.strikeStartDay = null;
    logTeam(draft, team.id, {
      kind: "system",
      message: `Salaires en retard payés (${credits(paid)}) : fin de la grève.`,
    });
  }
  if (day < team.hr.nextPayrollDay) return;
  team.hr.nextPayrollDay += hrRules.payrollEveryDays;
  const due = payroll(team, day);
  if (due === 0) return;
  if (team.hr.unpaidWages === 0 && availableCash(team) >= due) {
    recordCash(draft, team, -due, "wages", "Paie");
    logTeam(draft, team.id, { kind: "system", message: `Paie versée : ${credits(due)}.` });
    return;
  }
  const wasOnStrike = team.hr.unpaidWages > 0;
  team.hr.unpaidWages += due;
  if (!wasOnStrike) {
    team.hr.strikeStartDay = day;
    logTeam(draft, team.id, {
      kind: "event",
      message: `Paie impossible (${credits(due)}) : vos employés sont en grève jusqu'au paiement.`,
    });
  }
}

/**
 * After `strikeResignationDays` of strike, the unpaid employees resign together (N25): the
 * arrears are cancelled, they go back to the labor pool, and the company can rehire.
 */
function collectiveResignation(draft: GameState, team: TeamState): void {
  const start = team.hr.strikeStartDay;
  if (start === null || draft.time.day - start < hrRules.strikeResignationDays) return;
  const leaving = Object.values(team.employees).filter((e) => e.hiredOnDay <= start);
  for (const employee of leaving) delete team.employees[employee.id];
  if (team.region) {
    draft.market.laborPool[team.region] =
      (draft.market.laborPool[team.region] ?? 0) + leaving.length;
  }
  team.hr.unpaidWages = 0;
  team.hr.strikeStartDay = null;
  team.hr.massResignations += 1;
  logTeam(draft, team.id, {
    kind: "event",
    message: `Démission collective : ${leaving.length} employé(s) partent après ${hrRules.strikeResignationDays} jours de grève. Les arriérés sont annulés ; vous pouvez recruter à nouveau.`,
  });
  const company = team.companyName ?? team.name;
  publishNews(
    draft,
    {
      source: "tabloid",
      region: team.region,
      title: `Démission collective chez ${company} !`,
      body: `Sans salaire depuis des jours, les employés de ${company} ont claqué la porte. L'entreprise doit tout reconstruire.`,
    },
    { kind: "scenario", ref: `resignation:${team.id}:${draft.time.day}` },
  );
}

function recordSocialFacts(state: GameState, team: TeamState, day: number): void {
  const working = activeEmployees(team, day);
  if (isOnStrike(team)) team.hr.strikeDays += 1;
  for (const employee of working) {
    const reference = baseWage(state, team, employee.job);
    if (reference > 0) team.hr.wageRatioSum += employee.wage / reference;
    team.hr.employeeDays += 1;
  }
}

export const hrSystem: GameSystem = {
  name: "hr",
  onCreate: (draft) => {
    for (const region of regions) draft.market.laborPool[region.id] = region.laborPool;
  },
  onDay: (draft) => {
    for (const team of Object.values(draft.teams)) {
      for (const employee of Object.values(team.employees)) {
        if (employee.arrivesOnDay === draft.time.day) {
          logTeam(draft, team.id, {
            kind: "system",
            message: `${hrRules.jobs[employee.job].name} arrivé(e) dans l'entreprise.`,
          });
        }
      }
      updateEfficiency(team, draft.time.day);
      runPayroll(draft, team);
      collectiveResignation(draft, team);
      recordSocialFacts(draft, team, draft.time.day);
    }
  },
};
