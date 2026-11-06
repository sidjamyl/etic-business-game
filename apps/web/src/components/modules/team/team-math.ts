import { hrRules, impactRules, type JobId, jobIds, machineTypeById } from "@etic/content";
import { type Employee, type HrState, type MachineState, targetEfficiency } from "@etic/engine";

/** Largest hire accepted by `hr.hire` in one decision (engine schema). */
export const MAX_HIRES = hrRules.maxHiresPerDecision;

/** The screen starts warning this many days before the raise grace period ends (R6). */
export const RAISE_WARNING_DAYS = 10;

/** Display names of the two jobs (R6); the singular comes from the rules. */
export const jobLabels: Record<JobId, { one: string; many: string; role: string }> = {
  operator: {
    one: hrRules.jobs.operator.name,
    many: "Opérateurs",
    role: "Font tourner les machines de production.",
  },
  logistician: {
    one: hrRules.jobs.logistician.name,
    many: "Logisticiens",
    role: `Préparent chacun ${hrRules.shipmentsPerLogisticianPerDay} expéditions par jour.`,
  },
};

export function isJobId(value: string): value is JobId {
  return (jobIds as readonly string[]).includes(value);
}

/** French plural: "0 employé", "1 employé", "2 employés". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count > 1 ? many : one}`;
}

/** "1 opérateur", "3 logisticiens". */
export function jobCount(job: JobId, count: number): string {
  return plural(count, jobLabels[job].one.toLowerCase(), jobLabels[job].many.toLowerCase());
}

/** "e-12" → "#12": a short, stable reference shown next to the job. */
export function employeeRef(id: string): string {
  return `#${id.startsWith("e-") ? id.slice(2) : id}`;
}

/** French elision before a place name: "d'Azura", "de Nordhaven". */
export function ofPlace(name: string): string {
  return /^[aeiouyàâäéèêëîïôöûü]/i.test(name) ? `d'${name}` : `de ${name}`;
}

/** "aujourd'hui", "demain", "dans 3 jours". */
export function inDays(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${days} jours`;
}

const oneDecimal = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** 62.5 → "62,5": impact indicators keep one decimal. */
export function formatScore(value: number): string {
  return oneDecimal.format(value);
}

/** 7.5 → "7,5 %": a value already expressed in percent (raise, gap). */
export function percentValue(value: number): string {
  return `${oneDecimal.format(value)}\u00a0%`;
}

/** 10 → "+10 %", −5 → "−5 %", 0 → "0 %". */
export function signedPercentValue(value: number): string {
  if (value > 0) return `+${percentValue(value)}`;
  if (value < 0) return `−${percentValue(-value)}`;
  return percentValue(0);
}

/** Operators first, then logisticians; oldest hires first inside a job. */
export function sortEmployees(employees: readonly Employee[]): Employee[] {
  return [...employees].sort(
    (a, b) =>
      jobIds.indexOf(a.job) - jobIds.indexOf(b.job) ||
      a.hiredOnDay - b.hiredOnDay ||
      a.id.localeCompare(b.id, "fr", { numeric: true }),
  );
}

export type EmployeeStatus = "arriving" | "working" | "strike";

/** Hired staff arrive after a delay; once there, everybody stops during a strike (R6). */
export function employeeStatus(
  employee: Pick<Employee, "arrivesOnDay">,
  day: number,
  onStrike: boolean,
): EmployeeStatus {
  if (employee.arrivesOnDay > day) return "arriving";
  return onStrike ? "strike" : "working";
}

/**
 * - ok: nothing to do yet;
 * - soon: the grace period ends within RAISE_WARNING_DAYS;
 * - due: the grace period is over, efficiency is about to drop;
 * - dropping: efficiency is going down;
 * - floor: efficiency reached the HR floor.
 */
export type RaiseLevel = "ok" | "soon" | "due" | "dropping" | "floor";

export interface RaiseOutlook {
  daysSinceRaise: number;
  /** Efficiency the employee is heading to (engine `targetEfficiency`). */
  target: number;
  /** Days left before the end of the grace period (0 once over). */
  graceLeft: number;
  /** Days before the next drop of the target efficiency; null at the floor. */
  nextDropIn: number | null;
  level: RaiseLevel;
}

/** Days before the target efficiency goes down again, or null once at the floor. */
export function daysUntilDrop(daysSinceRaise: number): number | null {
  const current = targetEfficiency(daysSinceRaise);
  if (current <= hrRules.minEfficiency) return null;
  const horizon = hrRules.raiseGraceDays + hrRules.decayEveryDays;
  for (let ahead = 1; ahead <= horizon; ahead++) {
    if (targetEfficiency(daysSinceRaise + ahead) < current) return ahead;
  }
  return null;
}

/** Where an employee stands with regard to raises (R6: grace period, then drops). */
export function raiseOutlook(lastRaiseDay: number, day: number): RaiseOutlook {
  const daysSinceRaise = Math.max(0, day - lastRaiseDay);
  const target = targetEfficiency(daysSinceRaise);
  const graceLeft = Math.max(0, hrRules.raiseGraceDays - daysSinceRaise);
  let level: RaiseLevel = "ok";
  if (target <= hrRules.minEfficiency) level = "floor";
  else if (target < 1) level = "dropping";
  else if (graceLeft === 0) level = "due";
  else if (graceLeft <= RAISE_WARNING_DAYS) level = "soon";
  return { daysSinceRaise, target, graceLeft, nextDropIn: daysUntilDrop(daysSinceRaise), level };
}

export type EfficiencyTrend = "stable" | "recovering" | "dropping" | "floor";

const EPSILON = 1e-9;

/** After a raise, efficiency climbs back toward its target; without one, it follows it down. */
export function efficiencyTrend(efficiency: number, outlook: RaiseOutlook): EfficiencyTrend {
  if (efficiency < outlook.target - EPSILON) return "recovering";
  if (outlook.level === "floor") return "floor";
  if (outlook.target < 1) return "dropping";
  return "stable";
}

/** Wage against the regional base for the job, in whole percents (+10 = 10 % above). */
export function wageGapPercent(wage: number, base: number): number | null {
  if (base <= 0) return null;
  return Math.round((wage / base - 1) * 100);
}

export function averageEfficiency(
  employees: readonly Pick<Employee, "efficiency">[],
): number | null {
  if (employees.length === 0) return null;
  return employees.reduce((sum, employee) => sum + employee.efficiency, 0) / employees.length;
}

/** Every wage per 30 days, staff on the way included. */
export function totalWages(employees: readonly Pick<Employee, "wage">[]): number {
  return employees.reduce((sum, employee) => sum + employee.wage, 0);
}

/** Wages due on payday `day`: only employees already at work are paid (engine `payroll`). */
export function wagesDueOn(
  employees: readonly Pick<Employee, "wage" | "arrivesOnDay">[],
  day: number,
): number {
  return employees.reduce((sum, e) => (e.arrivesOnDay <= day ? sum + e.wage : sum), 0);
}

/** New wage after a raise, rounded like the engine (`hr.raise`). */
export function raisedWage(wage: number, percent: number): number {
  return Math.round(wage * (1 + percent / 100));
}

/** Severance for a layoff, rounded like the engine (`hr.layoff`). */
export function severancePay(employees: readonly Pick<Employee, "wage">[]): number {
  return Math.round(
    employees.reduce((sum, employee) => sum + employee.wage * hrRules.severanceMonths, 0),
  );
}

export interface WageChange {
  job: JobId;
  count: number;
  before: number;
  after: number;
}

/** Same job and same wage are listed once: "3 opérateurs : ₢1 200 → ₢1 320". */
export function groupWageChanges(
  employees: readonly Pick<Employee, "job" | "wage">[],
  newWage: (wage: number) => number,
): WageChange[] {
  const groups = new Map<string, WageChange>();
  for (const { job, wage } of employees) {
    const key = `${job}:${wage}`;
    const group = groups.get(key);
    if (group) group.count += 1;
    else groups.set(key, { job, count: 1, before: wage, after: newWage(wage) });
  }
  return [...groups.values()].sort(
    (a, b) => jobIds.indexOf(a.job) - jobIds.indexOf(b.job) || a.before - b.before,
  );
}

export interface RaisePreview {
  changes: WageChange[];
  /** Extra wages per 30 days. */
  monthlyIncrease: number;
  /** Extra wages due on the next payday. */
  nextPayrollIncrease: number;
}

export function raisePreview(
  employees: readonly Employee[],
  percent: number,
  payday: number,
): RaisePreview {
  const raised = employees.map((employee) => ({
    ...employee,
    wage: raisedWage(employee.wage, percent),
  }));
  return {
    changes: groupWageChanges(employees, (wage) => raisedWage(wage, percent)),
    monthlyIncrease: totalWages(raised) - totalWages(employees),
    nextPayrollIncrease: wagesDueOn(raised, payday) - wagesDueOn(employees, payday),
  };
}

export interface LayoffPreview {
  severance: number;
  /** Points taken off the social indicator (R17). */
  socialPenalty: number;
  socialAfter: number;
  /** Wages saved per 30 days. */
  monthlySaving: number;
  /** Wages no longer due on the next payday. */
  nextPayrollSaving: number;
  /** Machines that lose operators. */
  machineIds: string[];
}

export function layoffPreview(
  employees: readonly Employee[],
  payday: number,
  social: number,
): LayoffPreview {
  const socialPenalty = employees.length * impactRules.penalties.perLayoff;
  const machineIds = new Set<string>();
  for (const employee of employees) if (employee.machineId) machineIds.add(employee.machineId);
  return {
    severance: severancePay(employees),
    socialPenalty,
    socialAfter: Math.max(0, Math.round((social - socialPenalty) * 10) / 10),
    monthlySaving: totalWages(employees),
    nextPayrollSaving: wagesDueOn(employees, payday),
    machineIds: [...machineIds],
  };
}

export interface PayrollOutlook {
  /** Next payday. */
  day: number;
  daysLeft: number;
  /** Wages due that day (employees at work by then). */
  due: number;
  paidCount: number;
  /** Every wage per 30 days, staff on the way included. */
  monthly: number;
  /** Cash missing to pay the arrears and the next payroll (0 when covered). */
  shortfall: number;
}

export function payrollOutlook(
  employees: readonly Employee[],
  hr: HrState,
  available: number,
  day: number,
): PayrollOutlook {
  const payday = hr.nextPayrollDay;
  const due = wagesDueOn(employees, payday);
  return {
    day: payday,
    daysLeft: Math.max(0, payday - day),
    due,
    paidCount: employees.filter((employee) => employee.arrivesOnDay <= payday).length,
    monthly: totalWages(employees),
    shortfall: Math.max(0, due + hr.unpaidWages - available),
  };
}

export interface StrikeOutlook {
  arrears: number;
  startDay: number | null;
  /** Day the unpaid staff resign together (N25), unless the arrears are paid first. */
  resignationDay: number | null;
  daysLeft: number | null;
  /** Employees who would resign: hired on or before the first day of the strike. */
  leaving: number;
  /** Cash missing to pay the arrears (0 = paid at the start of the next day). */
  shortfall: number;
}

/** Strike state (R6, N25), or null while wages are paid. */
export function strikeOutlook(
  hr: HrState,
  employees: readonly Employee[],
  available: number,
  day: number,
): StrikeOutlook | null {
  if (hr.unpaidWages <= 0) return null;
  const start = hr.strikeStartDay;
  const resignationDay = start === null ? null : start + hrRules.strikeResignationDays;
  return {
    arrears: hr.unpaidWages,
    startDay: start,
    resignationDay,
    daysLeft: resignationDay === null ? null : Math.max(0, resignationDay - day),
    leaving:
      start === null ? 0 : employees.filter((employee) => employee.hiredOnDay <= start).length,
    shortfall: Math.max(0, hr.unpaidWages - available),
  };
}

/** Machine names for the assignment column, numbered when the company owns several of a type. */
export function machineNames(machines: Record<string, MachineState>): Map<string, string> {
  const byType = new Map<string, MachineState[]>();
  for (const machine of Object.values(machines)) {
    const list = byType.get(machine.typeId) ?? [];
    list.push(machine);
    byType.set(machine.typeId, list);
  }
  const names = new Map<string, string>();
  for (const [typeId, list] of byType) {
    const name = machineTypeById.get(typeId)?.name ?? typeId;
    list.sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }));
    for (const [index, machine] of list.entries()) {
      names.set(machine.id, list.length > 1 ? `${name} ${index + 1}` : name);
    }
  }
  return names;
}

export type Parsed = { value: number; error: null } | { value: null; error: string };

const invalid = (error: string): Parsed => ({ value: null, error });

/** Hire count typed by the player, checked like `hr.hire` and against the regional pool. */
export function parseHireCount(raw: string, pool: number): Parsed {
  const text = raw.trim();
  const value = Number(text);
  if (text === "" || !Number.isInteger(value)) return invalid("Entrez un nombre entier.");
  if (value < 1) return invalid("Recrutez au moins une personne.");
  if (pool <= 0) return invalid("Le bassin d'emploi est épuisé.");
  if (value > pool) return invalid(`Le bassin ne compte plus que ${plural(pool, "personne")}.`);
  if (value > MAX_HIRES) return invalid(`${MAX_HIRES} recrues au maximum par décision.`);
  return { value, error: null };
}

/** Raise typed by the player, between the minimum and maximum of the rules (R6). */
export function parseRaisePercent(raw: string): Parsed {
  const text = raw.trim().replace(",", ".");
  const value = Number(text);
  if (text === "" || !Number.isFinite(value)) return invalid("Entrez un pourcentage.");
  if (value < hrRules.minRaisePercent) {
    return invalid(`Au moins ${percentValue(hrRules.minRaisePercent)} pour relancer le délai.`);
  }
  if (value > hrRules.maxRaisePercent) {
    return invalid(`${percentValue(hrRules.maxRaisePercent)} au maximum.`);
  }
  return { value, error: null };
}
