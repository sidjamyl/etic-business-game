import {
  itemName,
  type MachineType,
  machineTypeById,
  type ProductId,
  productById,
  productIds,
  productionRules,
} from "@etic/content";
import { z } from "zod";
import { defineCommand } from "../commands.ts";
import { refuse } from "../errors.ts";
import { logTeam } from "../log.ts";
import type { GameSystem } from "../systems.ts";
import type { Employee, GameState, MachineState, TeamState } from "../types.ts";
import { activeEmployees, isOnStrike } from "./hr.ts";
import { recordProduction } from "./impact.ts";
import { canProduce } from "./progression.ts";
import { actingTeam, addItem, credits, freeSpace, spend } from "./shared.ts";

const round = (value: number) => Math.round(value * 1000) / 1000;

function machineType(machine: MachineState): MachineType {
  const type = machineTypeById.get(machine.typeId);
  if (!type) throw new Error(`Unknown machine type ${machine.typeId}`);
  return type;
}

function requireMachine(team: TeamState, machineId: string): MachineState {
  const machine = team.machines[machineId];
  if (!machine) refuse("NOT_FOUND", "Machine introuvable.");
  return machine;
}

function refuseDuringCycle(machine: MachineState, action: string): void {
  if (machine.cycle || machine.pendingOutput) {
    refuse("INVALID_STATE", `Impossible ${action} pendant un cycle : attendez sa fin.`);
  }
}

/** Operators assigned to a machine and already at work. */
export function presentOperators(team: TeamState, machineId: string, day: number): Employee[] {
  return activeEmployees(team, day).filter((e) => e.machineId === machineId);
}

/** Average efficiency of the machine's present operators (N9). */
export function workforceEfficiency(operators: readonly Employee[]): number {
  if (operators.length === 0) return 0;
  return operators.reduce((sum, e) => sum + e.efficiency, 0) / operators.length;
}

/** Units one cycle would produce right now. */
export function cycleOutput(
  team: TeamState,
  machine: MachineState,
  productId: ProductId,
  day: number,
): number {
  const settings = machineType(machine).products[productId];
  if (!settings) return 0;
  const operators = presentOperators(team, machine.id, day);
  return Math.floor(
    settings.outputPerCycle *
      machine.efficiency *
      workforceEfficiency(operators) *
      team.perks.outputFactor,
  );
}

/** Materials consumed when a cycle starts: recipe × nominal output (wear wastes materials). */
export function cycleMaterials(machine: MachineState, productId: ProductId) {
  const settings = machineType(machine).products[productId];
  const recipe = productById.get(productId)?.recipe ?? {};
  return Object.entries(recipe).map(([item, perUnit]) => ({
    item: item as keyof typeof recipe,
    quantity: (perUnit ?? 0) * (settings?.outputPerCycle ?? 0),
  }));
}

export const productionCommands = [
  defineCommand({
    type: "production.assignOperators",
    actor: "team",
    schema: z.object({
      machineId: z.string().min(1),
      employeeIds: z.array(z.string().min(1)).max(50),
    }),
    apply: (draft, { machineId, employeeIds }, actor) => {
      const team = actingTeam(draft, actor);
      const machine = requireMachine(team, machineId);
      const wanted = new Set(employeeIds);
      // During a cycle operators may be added but not removed: after a layoff or a collective
      // resignation the suspended cycle must be able to restart (output is fixed at its start).
      const removesOperator = Object.values(team.employees).some(
        (employee) => employee.machineId === machineId && !wanted.has(employee.id),
      );
      if (removesOperator) refuseDuringCycle(machine, "de retirer un opérateur");
      for (const id of wanted) {
        const employee = team.employees[id];
        if (!employee) refuse("NOT_FOUND", "Employé introuvable.");
        if (employee.job !== "operator") {
          refuse("INVALID_STATE", "Seuls les opérateurs peuvent travailler sur une machine.");
        }
        const other = employee.machineId ? team.machines[employee.machineId] : undefined;
        if (other && other.id !== machineId) {
          refuseDuringCycle(other, "de retirer un opérateur d'une machine");
        }
      }
      for (const employee of Object.values(team.employees)) {
        if (employee.machineId === machineId && !wanted.has(employee.id)) employee.machineId = null;
      }
      for (const id of wanted) {
        const employee = team.employees[id];
        if (employee) employee.machineId = machineId;
      }
      const type = machineType(machine);
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `${wanted.size} opérateur(s) affecté(s) à « ${type.name} » (${type.operatorsRequired} requis).`,
      });
    },
  }),

  defineCommand({
    type: "production.setJob",
    actor: "team",
    schema: z.object({
      machineId: z.string().min(1),
      productId: z.enum(productIds),
      cycles: z
        .int("Le nombre de cycles doit être entier.")
        .min(1, "Programmez au moins un cycle.")
        .max(productionRules.maxCyclesPerJob),
    }),
    apply: (draft, { machineId, productId, cycles }, actor) => {
      const team = actingTeam(draft, actor);
      const machine = requireMachine(team, machineId);
      const type = machineType(machine);
      if (!type.products[productId]) {
        refuse("INVALID_STATE", `« ${type.name} » ne fabrique pas ${itemName(productId)}.`);
      }
      if (!canProduce(team, productId)) {
        refuse(
          "INVALID_STATE",
          `${itemName(productId)} n'est pas débloqué pour votre entreprise (voir Progression).`,
        );
      }
      machine.job = { productId, cyclesRemaining: cycles };
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `« ${type.name} » : ${cycles} cycle(s) de ${itemName(productId)} programmé(s).`,
      });
    },
  }),

  defineCommand({
    type: "production.stop",
    actor: "team",
    schema: z.object({ machineId: z.string().min(1) }),
    apply: (draft, { machineId }, actor) => {
      const team = actingTeam(draft, actor);
      const machine = requireMachine(team, machineId);
      machine.job = null;
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `File de « ${machineType(machine).name} » arrêtée${machine.cycle ? " (le cycle en cours se termine)" : ""}.`,
      });
    },
  }),

  defineCommand({
    type: "production.maintain",
    actor: "team",
    schema: z.object({ machineId: z.string().min(1) }),
    apply: (draft, { machineId }, actor) => {
      const team = actingTeam(draft, actor);
      const machine = requireMachine(team, machineId);
      if (machine.maintenanceUntilDay !== null) {
        refuse("ALREADY_IN_PROGRESS", "Cette machine est déjà en maintenance.");
      }
      refuseDuringCycle(machine, "de lancer une maintenance");
      const type = machineType(machine);
      const cost = Math.round(type.price * productionRules.maintenanceCostShare);
      spend(draft, team, cost, "maintenance", `Maintenance de ${type.name}`);
      machine.maintenanceUntilDay = draft.time.day + productionRules.maintenanceDays;
      machine.status = "maintenance";
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `Maintenance de « ${type.name} » pour ${credits(cost)}, retour jour ${machine.maintenanceUntilDay}.`,
      });
    },
  }),

  defineCommand({
    type: "production.scrap",
    actor: "team",
    schema: z.object({ machineId: z.string().min(1) }),
    apply: (draft, { machineId }, actor) => {
      const team = actingTeam(draft, actor);
      const machine = requireMachine(team, machineId);
      refuseDuringCycle(machine, "de mettre la machine au rebut");
      for (const employee of Object.values(team.employees)) {
        if (employee.machineId === machineId) employee.machineId = null;
      }
      delete team.machines[machineId];
      logTeam(draft, team.id, {
        kind: "decision",
        actor: actor.name,
        message: `« ${machineType(machine).name} » mise au rebut.`,
      });
    },
  }),
];

function deposit(draft: GameState, team: TeamState, machine: MachineState): boolean {
  const output = machine.pendingOutput;
  if (!output) return true;
  if (freeSpace(team) < output.quantity) {
    if (machine.status !== "waiting-space") {
      logTeam(draft, team.id, {
        kind: "system",
        message: `Entrepôt plein : « ${machineType(machine).name} » attend de la place pour ${output.quantity} × ${itemName(output.productId)}.`,
      });
    }
    machine.status = "waiting-space";
    return false;
  }
  addItem(team, output.productId, output.quantity);
  team.stats.produced[output.productId] =
    (team.stats.produced[output.productId] ?? 0) + output.quantity;
  machine.pendingOutput = null;
  recordProduction(team, output.productId, output.quantity);
  logTeam(draft, team.id, {
    kind: "system",
    message: `Production : ${output.quantity} × ${itemName(output.productId)}.`,
  });
  return true;
}

function hasMaterials(team: TeamState, machine: MachineState, productId: ProductId): boolean {
  return cycleMaterials(machine, productId).every(
    ({ item, quantity }) => (team.inventory[item] ?? 0) >= quantity,
  );
}

function runMachine(draft: GameState, team: TeamState, machine: MachineState): void {
  const day = draft.time.day;
  const type = machineType(machine);

  if (machine.stoppedUntilDay !== null) {
    if (day < machine.stoppedUntilDay) {
      machine.status = "stopped";
      return;
    }
    machine.stoppedUntilDay = null;
  }

  if (machine.maintenanceUntilDay !== null) {
    if (day < machine.maintenanceUntilDay) {
      machine.status = "maintenance";
      return;
    }
    machine.maintenanceUntilDay = null;
    machine.efficiency = Math.max(machine.efficiency, productionRules.efficiencyAfterMaintenance);
    logTeam(draft, team.id, {
      kind: "system",
      message: `Maintenance de « ${type.name} » terminée.`,
    });
  }

  if (!deposit(draft, team, machine)) return;

  const busy = machine.cycle !== null || (machine.job?.cyclesRemaining ?? 0) > 0;
  if (!busy) {
    machine.status = "idle";
    return;
  }
  if (isOnStrike(team)) {
    machine.status = "strike";
    return;
  }
  if (presentOperators(team, machine.id, day).length < type.operatorsRequired) {
    machine.status = "waiting-operators";
    return;
  }

  if (!machine.cycle && machine.job) {
    const { productId } = machine.job;
    if (!hasMaterials(team, machine, productId)) {
      machine.status = "waiting-materials";
      return;
    }
    for (const { item, quantity } of cycleMaterials(machine, productId)) {
      team.inventory[item] = (team.inventory[item] ?? 0) - quantity;
      if (team.inventory[item] === 0) delete team.inventory[item];
    }
    const settings = type.products[productId];
    machine.cycle = {
      productId,
      output: cycleOutput(team, machine, productId, day),
      stepsDone: 0,
      stepsTotal: (settings?.cycleDays ?? 1) * draft.config.stepsPerDay,
    };
    machine.job.cyclesRemaining -= 1;
    if (machine.job.cyclesRemaining === 0) machine.job = null;
  }

  const cycle = machine.cycle;
  if (!cycle) return;
  machine.status = "running";
  machine.ranToday = true;
  cycle.stepsDone += 1;
  if (cycle.stepsDone < cycle.stepsTotal) return;
  machine.cycle = null;
  machine.pendingOutput = { productId: cycle.productId, quantity: cycle.output };
  deposit(draft, team, machine);
}

export const productionSystem: GameSystem = {
  name: "production",
  onDay: (draft) => {
    // Wear: each day of operation costs efficiency, down to the floor (R5).
    for (const team of Object.values(draft.teams)) {
      for (const machine of Object.values(team.machines)) {
        if (machine.ranToday) {
          machine.efficiency = round(
            Math.max(
              productionRules.minEfficiency,
              machine.efficiency - productionRules.wearPerDay,
            ),
          );
        }
        machine.ranToday = false;
      }
    }
  },
  onStep: (draft) => {
    for (const team of Object.values(draft.teams)) {
      for (const machine of Object.values(team.machines)) runMachine(draft, team, machine);
    }
  },
};
