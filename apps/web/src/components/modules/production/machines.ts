import {
  hrRules,
  type ItemId,
  type MachineType,
  machineTypeById,
  type ProductId,
  productById,
  productIds,
  productionRules,
  progressionRules,
} from "@etic/content";
import {
  availableCash,
  canProduce,
  cycleMaterials,
  cycleOutput,
  type Employee,
  freeSpace,
  type InboundShipment,
  type MachineState,
  type MachineStatus,
  presentOperators,
  type TeamState,
  type TeamView,
  workforceEfficiency,
} from "@etic/engine";
import { credits, formatNumber, itemLabel, percent } from "@/lib/format";

/**
 * Pure helpers of the Production module (#30): what each machine is doing, what blocks it and
 * what a decision would change. Everything is derived from the live team view; the engine
 * formulas are reused so previews match what the server will do.
 */

export type Tone = "success" | "warning" | "danger" | "neutral";

/** "1 cycle", "3 cycles": French keeps the singular for 0 and 1. */
export function count(n: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(n)} ${Math.abs(n) >= 2 ? plural : singular}`;
}

/** "de Pain", "d'Eau en bouteille": French elision before a vowel or a mute h. */
export function ofItem(id: ItemId): string {
  const name = itemLabel(id);
  return /^[aeiouyàâéèêëîïôöùûh]/i.test(name) ? `d'${name}` : `de ${name}`;
}

const idNumber = (id: string) => Number.parseInt(id.replace(/^\D+/, ""), 10) || 0;
const byId = (a: { id: string }, b: { id: string }) =>
  idNumber(a.id) - idNumber(b.id) || a.id.localeCompare(b.id);

/** Content of a machine type; a placeholder keeps the screen usable if the type is unknown. */
export function machineTypeOf(typeId: string): MachineType {
  return (
    machineTypeById.get(typeId) ?? {
      id: typeId,
      name: typeId,
      price: 0,
      operatorsRequired: 1,
      auctionOnly: false,
      products: {},
    }
  );
}

export interface NamedMachine {
  machine: MachineState;
  name: string;
}

/** Machines in acquisition order, named after their type and numbered when a type repeats. */
export function namedMachines(team: TeamState): NamedMachine[] {
  const machines = Object.values(team.machines).sort(byId);
  const totals = new Map<string, number>();
  for (const machine of machines) {
    totals.set(machine.typeId, (totals.get(machine.typeId) ?? 0) + 1);
  }
  const ranks = new Map<string, number>();
  return machines.map((machine) => {
    const name = machineTypeOf(machine.typeId).name;
    if ((totals.get(machine.typeId) ?? 0) < 2) return { machine, name };
    const rank = (ranks.get(machine.typeId) ?? 0) + 1;
    ranks.set(machine.typeId, rank);
    return { machine, name: `${name} n° ${rank}` };
  });
}

export function machineNames(team: TeamState): Map<string, string> {
  return new Map(namedMachines(team).map(({ machine, name }) => [machine.id, name]));
}

/** The company's operators in hiring order, numbered for display ("Opérateur 3"). */
export function namedOperators(team: TeamState): { employee: Employee; name: string }[] {
  return Object.values(team.employees)
    .filter((employee) => employee.job === "operator")
    .sort((a, b) => a.hiredOnDay - b.hiredOnDay || byId(a, b))
    .map((employee, index) => ({ employee, name: `Opérateur ${index + 1}` }));
}

export interface Crew {
  required: number;
  /** Assigned and already at work. */
  present: Employee[];
  /** Assigned but not arrived yet (hiring delay). */
  enRoute: Employee[];
  /** Average efficiency of the present operators, 0 without any (N9). */
  efficiency: number;
  nextArrivalDay: number | null;
}

export function machineCrew(team: TeamState, machine: MachineState, day: number): Crew {
  const present = presentOperators(team, machine.id, day);
  const enRoute = Object.values(team.employees).filter(
    (employee) => employee.machineId === machine.id && employee.arrivesOnDay > day,
  );
  return {
    required: machineTypeOf(machine.typeId).operatorsRequired,
    present,
    enRoute,
    efficiency: workforceEfficiency(present),
    nextArrivalDay:
      enRoute.length > 0 ? Math.min(...enRoute.map((employee) => employee.arrivesOnDay)) : null,
  };
}

/**
 * Why operators, maintenance and scrapping are refused right now: the engine forbids them
 * while a cycle runs or its output waits for space.
 */
export function cycleLock(machine: MachineState): string | null {
  if (machine.cycle) return "Cycle en cours : attendez sa fin.";
  if (machine.pendingOutput) return "Production en attente de place dans l'entrepôt.";
  return null;
}

/**
 * Footnote under a locked machine's actions. With a queue, the next cycle starts right after
 * the previous one: stopping the queue is the way to get the machine free.
 */
export function lockNote(machine: MachineState): string | null {
  if (machine.cycle) {
    return machine.job
      ? "Le retrait d'opérateurs, la maintenance et la mise au rebut sont bloqués pendant un cycle, et le suivant démarre aussitôt : arrêtez la file pour libérer la machine à la fin du cycle en cours."
      : "Vous pouvez ajouter des opérateurs ; leur retrait, la maintenance et la mise au rebut seront possibles à la fin du cycle en cours.";
  }
  if (machine.pendingOutput) {
    return "Opérateurs, maintenance et mise au rebut seront possibles une fois la production rangée dans l'entrepôt.";
  }
  return null;
}

export interface ProductLock {
  /** A few words for compact lists ("palier 2"). */
  short: string;
  /** Full sentence for the queue editor. */
  reason: string;
}

const branchName = (branch: keyof typeof progressionRules.branches) =>
  progressionRules.branches[branch];

/** Why the company may not produce a product yet (R1, R2), or null when it may. */
export function productLock(team: TeamState, productId: ProductId): ProductLock | null {
  if (canProduce(team, productId)) return null;
  const product = productById.get(productId);
  if (!product) return { short: "indisponible", reason: "Produit inconnu." };
  const { branch, project } = team.progression;
  const chosen = branch ?? project?.branch ?? null;
  if (product.branch && chosen && chosen !== product.branch) {
    return {
      short: `branche ${branchName(product.branch)}`,
      reason: `Réservé à la branche ${branchName(product.branch)} : votre entreprise a choisi ${branchName(chosen)}.`,
    };
  }
  if (project && project.tier === product.tier) {
    return {
      short: `palier ${product.tier} en cours`,
      reason: `Palier ${product.tier} en développement : disponible le jour ${project.completesOnDay}.`,
    };
  }
  return {
    short: `palier ${product.tier}`,
    reason: `Palier ${product.tier} à débloquer dans Progression.`,
  };
}

export interface ProductOption {
  productId: ProductId;
  name: string;
  tier: 1 | 2 | 3;
  cycleDays: number;
  /** Nominal output, before machine and operator efficiency. */
  outputPerCycle: number;
  /** Materials per unit produced, e.g. "2 × Farine, 1 × Eau". */
  recipe: string;
  lock: ProductLock | null;
}

/** Products a machine type can make, in catalogue order, with their cycle settings (R5). */
export function productOptions(team: TeamState, typeId: string): ProductOption[] {
  const type = machineTypeOf(typeId);
  return productIds.flatMap((productId) => {
    const settings = type.products[productId];
    const product = productById.get(productId);
    if (!settings || !product) return [];
    const recipe = Object.entries(product.recipe)
      .map(([item, quantity]) => `${quantity} × ${itemLabel(item as ItemId)}`)
      .join(", ");
    return [
      {
        productId,
        name: product.name,
        tier: product.tier,
        cycleDays: settings.cycleDays,
        outputPerCycle: settings.outputPerCycle,
        recipe,
        lock: productLock(team, productId),
      },
    ];
  });
}

export interface MaterialLine {
  item: ItemId;
  perCycle: number;
  inStock: number;
  /** Earliest supplier delivery of this material not yet in the warehouse. */
  incoming: { quantity: number; arrivesOnDay: number; waitingSpace: boolean } | null;
}

type MaterialShipment = Extract<InboundShipment, { kind: "material" }>;

/** Materials one cycle consumes at its start, against the warehouse (R5). */
export function materialLines(
  team: TeamState,
  machine: MachineState,
  productId: ProductId,
): MaterialLine[] {
  const shipments = Object.values(team.inbound)
    .filter((shipment): shipment is MaterialShipment => shipment.kind === "material")
    .sort((a, b) => a.arrivesOnDay - b.arrivesOnDay);
  return cycleMaterials(machine, productId).map(({ item, quantity }) => {
    const next = shipments.find((shipment) => shipment.item === item);
    return {
      item,
      perCycle: quantity,
      inStock: team.inventory[item] ?? 0,
      incoming: next
        ? {
            quantity: next.quantity,
            arrivesOnDay: next.arrivesOnDay,
            waitingSpace: next.status === "waiting-space",
          }
        : null,
    };
  });
}

/** Cycles the current stock can start, the scarcest material deciding. */
export function cyclesCovered(lines: readonly MaterialLine[]): number {
  let covered = Number.POSITIVE_INFINITY;
  for (const line of lines) {
    if (line.perCycle > 0) covered = Math.min(covered, Math.floor(line.inStock / line.perCycle));
  }
  return Number.isFinite(covered) ? covered : 0;
}

export interface OutputForecast {
  nominal: number;
  machineEfficiency: number;
  workforceEfficiency: number;
  /** Permanent output multiplier won at an auction (1 without). */
  bonus: number;
  /** Units the next cycle would produce now; fixed when the cycle starts. */
  perCycle: number;
  present: number;
  required: number;
  /** Enough operators at work for the machine to start a cycle. */
  ready: boolean;
}

/** Production = output per cycle × machine efficiency × operators' efficiency (R5). */
export function outputForecast(
  team: TeamState,
  machine: MachineState,
  productId: ProductId,
  day: number,
): OutputForecast {
  const crew = machineCrew(team, machine, day);
  const nominal = machineTypeOf(machine.typeId).products[productId]?.outputPerCycle ?? 0;
  return {
    nominal,
    machineEfficiency: machine.efficiency,
    workforceEfficiency: crew.efficiency,
    bonus: team.perks.outputFactor,
    perCycle: nominal > 0 ? cycleOutput(team, machine, productId, day) : 0,
    present: crew.present.length,
    required: crew.required,
    ready: crew.present.length >= crew.required,
  };
}

export interface CycleProgress {
  productId: ProductId;
  output: number;
  ratio: number;
  daysLeft: number;
  /** The cycle only advances while the machine runs. */
  paused: boolean;
}

export function cycleProgress(machine: MachineState, stepsPerDay: number): CycleProgress | null {
  const cycle = machine.cycle;
  if (!cycle) return null;
  return {
    productId: cycle.productId,
    output: cycle.output,
    ratio: cycle.stepsTotal > 0 ? cycle.stepsDone / cycle.stepsTotal : 0,
    daysLeft: Math.max(0, cycle.stepsTotal - cycle.stepsDone) / stepsPerDay,
    paused: machine.status !== "running",
  };
}

export interface MaintenanceBlocker {
  reason: "in-progress" | "cycle" | "no-gain" | "funds";
  message: string;
}

export interface MaintenancePlan {
  cost: number;
  days: number;
  returnDay: number;
  efficiencyAfter: number;
  /** Why it cannot be launched now, or null. */
  blocker: MaintenanceBlocker | null;
}

function maintenanceBlocker(
  team: TeamState,
  machine: MachineState,
  cost: number,
  efficiencyAfter: number,
): MaintenanceBlocker | null {
  if (machine.maintenanceUntilDay !== null) {
    return {
      reason: "in-progress",
      message: `Maintenance déjà en cours, reprise le jour ${machine.maintenanceUntilDay}.`,
    };
  }
  const lock = cycleLock(machine);
  if (lock) return { reason: "cycle", message: lock };
  if (efficiencyAfter <= machine.efficiency) {
    return {
      reason: "no-gain",
      message: `Rendement déjà de ${percent(machine.efficiency)} : une maintenance ne l'améliorerait pas.`,
    };
  }
  if (availableCash(team) < cost) {
    return {
      reason: "funds",
      message: `Trésorerie disponible insuffisante pour la maintenance : il faut ${credits(cost)}.`,
    };
  }
  return null;
}

/** Paid maintenance: the machine stops a few days and gets back to about 95 % (R5, N9). */
export function maintenancePlan(
  team: TeamState,
  machine: MachineState,
  day: number,
): MaintenancePlan {
  const cost = Math.round(
    machineTypeOf(machine.typeId).price * productionRules.maintenanceCostShare,
  );
  const efficiencyAfter = Math.max(machine.efficiency, productionRules.efficiencyAfterMaintenance);
  return {
    cost,
    days: productionRules.maintenanceDays,
    returnDay: day + productionRules.maintenanceDays,
    efficiencyAfter,
    blocker: maintenanceBlocker(team, machine, cost, efficiencyAfter),
  };
}

/** Colour of an efficiency, always shown next to its percentage (D1). */
export function efficiencyTone(efficiency: number): Tone {
  if (efficiency >= 0.8) return "success";
  if (efficiency >= 0.6) return "warning";
  return "danger";
}

const BLOCKED = new Set<MachineStatus>([
  "waiting-materials",
  "waiting-operators",
  "waiting-space",
  "strike",
  "stopped",
]);

/** The machine has work but something outside it holds it back. */
export function isBlocked(status: MachineStatus): boolean {
  return BLOCKED.has(status);
}

/** The engine status, plus "starting": a queue was just set and the next step starts it. */
export type SituationKind = MachineStatus | "starting";

export interface Situation {
  kind: SituationKind;
  label: string;
  tone: Tone;
  /** What the machine is doing or what blocks it, in plain words (story 38). */
  detail: string;
}

function missingMaterials(team: TeamState, machine: MachineState): string {
  const productId = machine.job?.productId;
  if (!productId) return "Matières insuffisantes pour lancer un cycle.";
  const short = materialLines(team, machine, productId).filter(
    (line) => line.inStock < line.perCycle,
  );
  if (short.length === 0) return "Matières reçues : le cycle démarre dans un instant.";
  const list = short
    .map(
      (line) =>
        `${itemLabel(line.item)} ${formatNumber(line.inStock)} sur ${formatNumber(line.perCycle)}`,
    )
    .join(", ");
  const delivery = short.find((line) => line.incoming);
  let next = " Commandez-en dans Achats.";
  if (delivery?.incoming) {
    next = delivery.incoming.waitingSpace
      ? ` Une livraison ${ofItem(delivery.item)} attend de la place dans l'entrepôt.`
      : ` Livraison ${ofItem(delivery.item)} prévue le jour ${delivery.incoming.arrivesOnDay}.`;
  }
  return `Il manque des matières pour un cycle ${ofItem(productId)} : ${list}.${next}`;
}

function missingOperators(team: TeamState, machine: MachineState, day: number): string {
  const crew = machineCrew(team, machine, day);
  if (crew.present.length >= crew.required) {
    return "Opérateurs au complet : la machine repart dans un instant.";
  }
  const parts = [
    `${count(crew.present.length, "opérateur présent", "opérateurs présents")} sur ${crew.required} requis.`,
  ];
  if (crew.enRoute.length > 0) {
    parts.push(
      `${count(crew.enRoute.length, "autre arrive", "autres arrivent")} le jour ${crew.nextArrivalDay}.`,
    );
  }
  if (machine.cycle) parts.push("Le cycle en cours est suspendu.");
  return parts.join(" ");
}

function waitingSpace(team: TeamState, machine: MachineState): string {
  const output = machine.pendingOutput;
  if (!output) return "Entrepôt plein : la production attend de la place.";
  const free = Math.max(0, freeSpace(team));
  return `${formatNumber(output.quantity)} × ${itemLabel(output.productId)} attendent de la place (${count(free, "place libre", "places libres")}). Rien n'est perdu : vendez, livrez ou agrandissez l'entrepôt.`;
}

/** Whether the company may program at least one product on this machine type. */
export function canProgram(team: TeamState, typeId: string): boolean {
  return productOptions(team, typeId).some((option) => !option.lock);
}

function idleDetail(team: TeamState, machine: MachineState): string {
  const lock = productOptions(team, machine.typeId)[0]?.lock;
  if (lock && !canProgram(team, machine.typeId)) {
    return `Aucun produit débloqué pour cette machine. ${lock.reason}`;
  }
  return "Aucune production programmée : choisissez un produit et un nombre de cycles.";
}

/** Status badge and explanation of a machine (stories 38, 41). */
export function machineSituation(team: TeamState, machine: MachineState, day: number): Situation {
  const kind = machine.status;
  switch (kind) {
    case "running":
      return {
        kind,
        label: "En production",
        tone: "success",
        detail: machine.cycle
          ? `Cycle ${ofItem(machine.cycle.productId)} en cours : ${count(machine.cycle.output, "unité")} à la sortie.`
          : "La machine produit.",
      };
    case "idle":
      return machine.job
        ? {
            kind: "starting",
            label: "Démarrage",
            tone: "neutral",
            detail: "La file programmée démarre dans un instant.",
          }
        : {
            kind,
            label: "Inactive",
            tone: "neutral",
            detail: idleDetail(team, machine),
          };
    case "waiting-materials":
      return {
        kind,
        label: "Manque de matières",
        tone: "warning",
        detail: missingMaterials(team, machine),
      };
    case "waiting-operators":
      return {
        kind,
        label: "Manque d'opérateurs",
        tone: "warning",
        detail: missingOperators(team, machine, day),
      };
    case "waiting-space":
      return {
        kind,
        label: "Entrepôt plein",
        tone: "warning",
        detail: waitingSpace(team, machine),
      };
    case "maintenance":
      return {
        kind,
        label: "Maintenance",
        tone: "neutral",
        detail:
          machine.maintenanceUntilDay === null
            ? "Maintenance en cours."
            : `Maintenance en cours : reprise le jour ${machine.maintenanceUntilDay}, rendement remonté à ${percent(Math.max(machine.efficiency, productionRules.efficiencyAfterMaintenance))}.`,
      };
    case "strike": {
      const start = team.hr.strikeStartDay;
      const resignation =
        start === null
          ? ""
          : ` Sans paiement, démission collective le jour ${start + hrRules.strikeResignationDays}.`;
      return {
        kind,
        label: "Grève",
        tone: "danger",
        detail: `Vos employés sont en grève : ${credits(team.hr.unpaidWages)} de salaires impayés, versés automatiquement dès que la trésorerie disponible le permet.${resignation}`,
      };
    }
    case "stopped":
      return {
        kind,
        label: "Arrêt forcé",
        tone: "danger",
        detail:
          machine.stoppedUntilDay === null
            ? "Arrêt forcé (panne ou sabotage)."
            : `Arrêt forcé (panne ou sabotage) : reprise le jour ${machine.stoppedUntilDay}.`,
      };
  }
}

export interface ProductionSummary {
  machines: number;
  running: number;
  blocked: number;
  /** Operators at work and assigned to no machine. */
  freeOperators: number;
  assignedOperators: number;
  /** Operators hired and not arrived yet. */
  enRouteOperators: number;
  /** Seats still missing to reach every machine's minimum crew. */
  openSeats: number;
  produced: number;
}

export function productionSummary(team: TeamState, day: number): ProductionSummary {
  const machines = Object.values(team.machines);
  const operators = Object.values(team.employees).filter((employee) => employee.job === "operator");
  const isAssigned = (employee: Employee) =>
    employee.machineId !== null && team.machines[employee.machineId] !== undefined;
  const crewSize = (machineId: string) =>
    operators.filter((employee) => employee.machineId === machineId).length;
  return {
    machines: machines.length,
    running: machines.filter((machine) => machine.status === "running").length,
    blocked: machines.filter((machine) => isBlocked(machine.status)).length,
    freeOperators: operators.filter(
      (employee) => employee.arrivesOnDay <= day && !isAssigned(employee),
    ).length,
    assignedOperators: operators.filter(isAssigned).length,
    enRouteOperators: operators.filter((employee) => employee.arrivesOnDay > day).length,
    openSeats: machines.reduce(
      (sum, machine) =>
        sum + Math.max(0, machineTypeOf(machine.typeId).operatorsRequired - crewSize(machine.id)),
      0,
    ),
    produced: Object.values(team.stats.produced).reduce<number>(
      (sum, quantity) => sum + (quantity ?? 0),
      0,
    ),
  };
}

/** Operators (present or on their way) working on no machine. */
export function unassignedOperators(team: TeamState): number {
  return Object.values(team.employees).filter(
    (employee) =>
      employee.job === "operator" &&
      (employee.machineId === null || team.machines[employee.machineId] === undefined),
  ).length;
}

export interface IncomingMachine {
  id: string;
  name: string;
  arrivesOnDay: number;
  /** Bought from another company rather than from an equipment supplier. */
  viaTrade: boolean;
}

/** Machines bought or received and still on their way. */
export function incomingMachines(view: Pick<TeamView, "team" | "trades">): IncomingMachine[] {
  const incoming: IncomingMachine[] = [];
  for (const shipment of Object.values(view.team.inbound)) {
    if (shipment.kind !== "machine") continue;
    incoming.push({
      id: shipment.id,
      name: machineTypeOf(shipment.machineTypeId).name,
      arrivesOnDay: shipment.arrivesOnDay,
      viaTrade: false,
    });
  }
  for (const shipment of view.trades.shipments) {
    if (shipment.buyerId !== view.team.id || shipment.good.kind !== "machine") continue;
    incoming.push({
      id: shipment.id,
      name: machineTypeOf(shipment.good.typeId).name,
      arrivesOnDay: shipment.arrivesOnDay,
      viaTrade: true,
    });
  }
  return incoming.sort((a, b) => a.arrivesOnDay - b.arrivesOnDay);
}

export interface OperatorChoice {
  id: string;
  name: string;
  efficiency: number;
  arrivesOnDay: number;
  present: boolean;
  onThisMachine: boolean;
  /** Other machine the operator works on, if any. */
  elsewhere: { machineId: string; name: string } | null;
  /** Why the operator cannot be moved now (their machine is in a cycle). */
  locked: string | null;
}

/**
 * Operators that can be put on a machine: its own first, then free ones (present and most
 * efficient first), then those working elsewhere.
 */
export function operatorChoices(
  team: TeamState,
  machineId: string,
  day: number,
  names: ReadonlyMap<string, string>,
): OperatorChoice[] {
  const choices = namedOperators(team).map(({ employee, name }): OperatorChoice => {
    const other =
      employee.machineId && employee.machineId !== machineId
        ? team.machines[employee.machineId]
        : undefined;
    const otherName = other ? (names.get(other.id) ?? machineTypeOf(other.typeId).name) : "";
    return {
      id: employee.id,
      name,
      efficiency: employee.efficiency,
      arrivesOnDay: employee.arrivesOnDay,
      present: employee.arrivesOnDay <= day,
      onThisMachine: employee.machineId === machineId,
      elsewhere: other ? { machineId: other.id, name: otherName } : null,
      locked: other && cycleLock(other) ? `Sur « ${otherName} », en plein cycle` : null,
    };
  });
  const rank = (choice: OperatorChoice) => {
    if (choice.onThisMachine) return 0;
    if (!choice.elsewhere) return 1;
    return choice.locked ? 3 : 2;
  };
  return choices.sort(
    (a, b) =>
      rank(a) - rank(b) || Number(b.present) - Number(a.present) || b.efficiency - a.efficiency,
  );
}

/** Adds free operators (present and most efficient first) until the crew reaches `required`. */
export function autoFill(
  choices: readonly OperatorChoice[],
  selected: ReadonlySet<string>,
  required: number,
): Set<string> {
  const next = new Set(selected);
  for (const choice of choices) {
    if (next.size >= required) break;
    if (!choice.onThisMachine && !choice.elsewhere) next.add(choice.id);
  }
  return next;
}

/** The company as if exactly `employeeIds` worked on the machine (assignment preview). */
export function withOperators(
  team: TeamState,
  machineId: string,
  employeeIds: ReadonlySet<string>,
): TeamState {
  const employees: TeamState["employees"] = {};
  for (const employee of Object.values(team.employees)) {
    let target = employee.machineId;
    if (employeeIds.has(employee.id)) target = machineId;
    else if (employee.machineId === machineId) target = null;
    employees[employee.id] =
      target === employee.machineId ? employee : { ...employee, machineId: target };
  }
  return { ...team, employees };
}

export interface Transfer {
  machineId: string;
  name: string;
  moving: number;
  /** Present operators the other machine keeps. */
  remaining: number;
  required: number;
}

/** Other machines that would lose operators to this assignment. */
export function transfers(
  team: TeamState,
  machineId: string,
  selected: ReadonlySet<string>,
  day: number,
  names: ReadonlyMap<string, string>,
): Transfer[] {
  const result: Transfer[] = [];
  for (const other of Object.values(team.machines)) {
    if (other.id === machineId) continue;
    const crew = Object.values(team.employees).filter(
      (employee) => employee.machineId === other.id,
    );
    const moving = crew.filter((employee) => selected.has(employee.id)).length;
    if (moving === 0) continue;
    result.push({
      machineId: other.id,
      name: names.get(other.id) ?? machineTypeOf(other.typeId).name,
      moving,
      remaining: crew.filter(
        (employee) => !selected.has(employee.id) && employee.arrivesOnDay <= day,
      ).length,
      required: machineTypeOf(other.typeId).operatorsRequired,
    });
  }
  return result;
}
