import {
  financeRules,
  type ItemId,
  itemName,
  type LedgerCategory,
  type ProductId,
} from "@etic/content";
import { refuse } from "../errors.ts";
import { allocateId } from "../log.ts";
import type { Actor, GameState, MachineState, TeamState } from "../types.ts";

/** Resolves the acting team inside a handler (team commands only). */
export function actingTeam(draft: GameState, actor: Actor): TeamState {
  if (actor.kind !== "team") refuse("FORBIDDEN", "Action réservée aux équipes.");
  const team = draft.teams[actor.teamId];
  if (!team) refuse("NOT_FOUND", "Équipe introuvable.");
  return team;
}

/** Formats an amount of crédits for messages: "₢12 500". */
export function credits(amount: number): string {
  return `₢${Math.round(amount).toLocaleString("fr-FR")}`;
}

/** Moves cash and records it in the ledger (N12). Positive = income, negative = expense. */
export function recordCash(
  state: GameState,
  team: TeamState,
  amount: number,
  category: LedgerCategory,
  label: string,
): void {
  if (amount === 0) return;
  team.cash += amount;
  const finance = team.finance;
  finance.totals[category] = (finance.totals[category] ?? 0) + amount;
  finance.ledger.push({ id: allocateId(state), day: state.time.day, category, amount, label });
  if (finance.ledger.length > financeRules.ledgerLimit + 50) {
    finance.ledger.splice(0, finance.ledger.length - financeRules.ledgerLimit);
  }
}

/** Cash that can be spent: bids lock the rest (N16). */
export function availableCash(team: TeamState): number {
  return team.cash - team.reservedCash;
}

/** Pays a voluntary expense, or refuses when cash is short (R16: cash never goes negative). */
export function spend(
  state: GameState,
  team: TeamState,
  amount: number,
  category: LedgerCategory,
  label: string,
): void {
  if (amount > availableCash(team)) {
    refuse(
      "INSUFFICIENT_FUNDS",
      team.reservedCash > 0
        ? `Trésorerie disponible insuffisante : il faut ${credits(amount)} (${credits(team.reservedCash)} bloqués par vos enchères).`
        : `Trésorerie insuffisante : il faut ${credits(amount)}.`,
    );
  }
  recordCash(state, team, -amount, category, label);
}

/** Records income. */
export function earn(
  state: GameState,
  team: TeamState,
  amount: number,
  category: LedgerCategory,
  label: string,
): void {
  recordCash(state, team, amount, category, label);
}

export function warehouseUsage(team: TeamState): number {
  let total = 0;
  for (const quantity of Object.values(team.inventory)) total += quantity ?? 0;
  return total;
}

export function freeSpace(team: TeamState): number {
  return team.warehouse.capacity - warehouseUsage(team);
}

export function addItem(team: TeamState, item: ItemId, quantity: number): void {
  team.inventory[item] = (team.inventory[item] ?? 0) + quantity;
}

export function describeQuantity(item: ItemId, quantity: number): string {
  return `${quantity.toLocaleString("fr-FR")} × ${itemName(item)}`;
}

export function newMachine(id: string, typeId: string): MachineState {
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

/** Finished products in stock and not reserved by accepted orders (O2). */
export function availableStock(team: TeamState, productId: ProductId): number {
  return (team.inventory[productId] ?? 0) - (team.reserved[productId] ?? 0);
}
