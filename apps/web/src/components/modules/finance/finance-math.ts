import { financeRules, type LedgerCategory, ledgerCategories } from "@etic/content";
import {
  borrowingCapacity,
  type FinanceState,
  type GameStatus,
  type LedgerEntry,
  type SimTime,
  type TeamState,
} from "@etic/engine";
import { credits, formatNumber } from "@/lib/format";

/**
 * Pure helpers of the Finance module (#33, R16, N12): loan and repayment previews, interest
 * outlook, ledger filters and totals per category. Display only: the server stays the source
 * of truth and refuses anything these previews miss.
 */

/** The figures a loan or a repayment changes. */
export interface Balance {
  cash: number;
  /** Cash locked by auction bids: not spendable (N16). */
  reservedCash: number;
  /** Everything owed to the bank: principal + unpaid interest added to it. */
  debt: number;
  /** Borrowed principal still owed: what the loan ceiling applies to. */
  principal: number;
}

export function balanceOf(team: {
  cash: number;
  reservedCash: number;
  finance: Pick<FinanceState, "debt" | "principal">;
}): Balance {
  return {
    cash: team.cash,
    reservedCash: team.reservedCash,
    debt: team.finance.debt,
    principal: team.finance.principal,
  };
}

/** Cash that can be spent now (engine: availableCash). */
export function availableOf(balance: Balance): number {
  return balance.cash - balance.reservedCash;
}

/** Net cash = cash − debt: the only money that counts at the end (R18). */
export function netCashOf(balance: Balance): number {
  return balance.cash - balance.debt;
}

/** Interest still owed because it could not be paid on time (added to the debt, R16). */
export function unpaidInterest(balance: Balance): number {
  return Math.max(0, balance.debt - balance.principal);
}

/** Interest charged on a debt at the next due day (finance system: rounded crédits). */
export function interestOn(debt: number): number {
  return Math.round(debt * financeRules.interestRate);
}

/** The balance after a loan, as `finance.borrow` applies it. */
export function afterBorrow(balance: Balance, amount: number): Balance {
  return {
    ...balance,
    cash: balance.cash + amount,
    debt: balance.debt + amount,
    principal: balance.principal + amount,
  };
}

/**
 * The balance after a repayment, as `finance.repay` applies it: unpaid interest is repaid
 * first, then the principal (which frees borrowing capacity).
 */
export function afterRepay(balance: Balance, amount: number): Balance {
  const debt = balance.debt - amount;
  return {
    ...balance,
    cash: balance.cash - amount,
    debt,
    principal: Math.min(balance.principal, debt),
  };
}

/** Borrowing capacity once the principal has changed, by the engine's own rule (N12). */
export function capacityWith(team: TeamState, principal: number): number {
  return borrowingCapacity({ ...team, finance: { ...team.finance, principal } });
}

/** Largest repayment possible now: the whole debt, within the available cash. */
export function maxRepayment(balance: Balance): number {
  return Math.max(0, Math.min(balance.debt, Math.floor(availableOf(balance))));
}

/** An amount typed by the player: the whole number read, and why it is refused (or null). */
export interface AmountInput {
  amount: number | null;
  error: string | null;
}

/** Reads a whole number of crédits; an empty field is neither an amount nor an error. */
export function readAmount(raw: string, rule: (amount: number) => string | null): AmountInput {
  const text = raw.trim();
  if (text === "") return { amount: null, error: null };
  const amount = Number(text);
  if (!Number.isSafeInteger(amount)) {
    return { amount: null, error: "Entrez un nombre entier de crédits." };
  }
  return { amount, error: rule(amount) };
}

export function isValidAmount(input: AmountInput): input is { amount: number; error: null } {
  return input.amount !== null && input.error === null;
}

/** A loan can be taken while at least the minimum loan fits under the ceiling. */
export function canBorrow(capacity: number): boolean {
  return capacity >= financeRules.minLoan;
}

/** Why `finance.borrow` would refuse this amount, or null (R16: minimum loan, ceiling). */
export function borrowError(amount: number, capacity: number): string | null {
  if (!canBorrow(capacity)) return "Plafond d'emprunt atteint.";
  if (amount < financeRules.minLoan) {
    return `Empruntez au moins ${credits(financeRules.minLoan)}.`;
  }
  if (amount > capacity) return `Vous pouvez emprunter ${credits(capacity)} au plus.`;
  return null;
}

/** Why `finance.repay` would refuse this amount, or null (any amount up to debt and cash). */
export function repayError(amount: number, balance: Balance): string | null {
  if (balance.debt <= 0) return "Vous n'avez aucune dette.";
  if (amount <= 0) return "Le montant doit être positif.";
  if (amount > balance.debt) return `Vous ne devez que ${credits(balance.debt)}.`;
  const available = availableOf(balance);
  if (amount > available) {
    return balance.reservedCash > 0
      ? `Trésorerie disponible insuffisante : ${credits(available)}, le reste est bloqué par vos enchères.`
      : `Trésorerie insuffisante : vous disposez de ${credits(available)}.`;
  }
  return null;
}

/** What the next interest day will bring (N12: every `interestEveryDays`). */
export interface InterestOutlook {
  /** Day the interest is charged, at the start of that day. */
  day: number;
  /** Whole simulated days before it. */
  inDays: number;
  /** Interest on the current debt. */
  amount: number;
  /** Paid from the available cash; otherwise added to the debt (R16). */
  covered: boolean;
  /** The game is over before that day: no more interest. */
  afterEnd: boolean;
}

export function interestOutlook(
  balance: Balance,
  nextInterestDay: number,
  today: number,
  endDay: number | null,
): InterestOutlook {
  const amount = interestOn(balance.debt);
  return {
    day: nextInterestDay,
    inDays: Math.max(0, nextInterestDay - today),
    amount,
    covered: availableOf(balance) >= amount,
    afterEnd: endDay !== null && nextInterestDay > endDay,
  };
}

/** Simulated days before `day` starts, counting the part of today already gone. */
export function daysUntil(day: number, time: SimTime, stepsPerDay: number): number {
  return Math.max(0, day - time.day - time.step / stepsPerDay);
}

/** "demain", "dans 12 jours". */
export function inDaysLabel(days: number): string {
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return "demain";
  return `dans ${formatNumber(days)} jours`;
}

/** Why decisions are blocked (pause, end of game, O1), or null while the game runs. */
export function blockedReason(status: GameStatus): string | null {
  if (status === "paused") return "Jeu en pause : vous pourrez décider à la reprise.";
  if (status === "ended") return "Partie terminée : plus aucune décision possible.";
  if (status === "lobby") return "La partie n'a pas encore commencé.";
  return null;
}

/** "1 mouvement", "12 mouvements". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${formatNumber(count)} ${count > 1 ? many : one}`;
}

/** Rounds away floating-point noise from sums of prices with cents. */
export function roundCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}

// —— Ledger ——

export const ledgerCategoryIds = Object.keys(ledgerCategories) as LedgerCategory[];

export function isLedgerCategory(value: string): value is LedgerCategory {
  return Object.hasOwn(ledgerCategories, value);
}

/** Money in, money out, or both. */
export type Direction = "all" | "in" | "out";

export function isDirection(value: string): value is Direction {
  return value === "all" || value === "in" || value === "out";
}

export interface LedgerFilter {
  category: LedgerCategory | "all";
  direction: Direction;
}

/** Movements matching the filter, latest first (the ledger is kept in time order). */
export function filterLedger(ledger: readonly LedgerEntry[], filter: LedgerFilter): LedgerEntry[] {
  return ledger
    .filter(
      (entry) =>
        (filter.category === "all" || entry.category === filter.category) &&
        (filter.direction === "all" ||
          (filter.direction === "in" ? entry.amount > 0 : entry.amount < 0)),
    )
    .reverse();
}

export interface CategoryCount {
  category: LedgerCategory;
  label: string;
  count: number;
}

/** Categories found in the ledger, in the content order, with their number of movements. */
export function ledgerCategoryCounts(ledger: readonly LedgerEntry[]): CategoryCount[] {
  const counts = new Map<LedgerCategory, number>();
  for (const entry of ledger) counts.set(entry.category, (counts.get(entry.category) ?? 0) + 1);
  return ledgerCategoryIds
    .filter((category) => counts.has(category))
    .map((category) => ({
      category,
      label: ledgerCategories[category],
      count: counts.get(category) ?? 0,
    }));
}

/** Net movement of one day (the ledger always holds the latest days in full). */
export function dayNet(ledger: readonly LedgerEntry[], day: number): number {
  let net = 0;
  for (let index = ledger.length - 1; index >= 0; index -= 1) {
    const entry = ledger[index];
    if (!entry || entry.day < day) break;
    if (entry.day === day) net += entry.amount;
  }
  return roundCents(net);
}

// —— Totals per category ——

export interface CategoryTotal {
  category: LedgerCategory;
  label: string;
  /** Net total over the whole game: positive = money in. */
  amount: number;
  /** Chart series: exactly one of the two is set, by sign. */
  income: number | null;
  expense: number | null;
}

/** Net total per category over the whole game, largest income first; empty totals left out. */
export function categoryTotals(totals: Partial<Record<LedgerCategory, number>>): CategoryTotal[] {
  return ledgerCategoryIds
    .map((category) => ({ category, amount: roundCents(totals[category] ?? 0) }))
    .filter((row) => row.amount !== 0)
    .sort((a, b) => b.amount - a.amount)
    .map(({ category, amount }) => ({
      category,
      label: ledgerCategories[category],
      amount,
      income: amount > 0 ? amount : null,
      expense: amount < 0 ? amount : null,
    }));
}

/**
 * Value range of the totals chart, around zero, with `room` (share of the span) left at each
 * end that has bars so the amount labels fit next to the longest bars.
 */
export function totalsDomain(amounts: readonly number[], room = 0.3): [number, number] {
  const max = Math.max(0, ...amounts);
  const min = Math.min(0, ...amounts);
  const pad = (max - min) * room;
  return [min < 0 ? min - pad : 0, max > 0 ? max + pad : 0];
}
