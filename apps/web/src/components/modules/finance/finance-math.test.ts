import { describe, expect, test } from "bun:test";
import { financeRules, regionIds } from "@etic/content";
import {
  type Actor,
  borrowingCapacity,
  type Command,
  type GameState,
  gameEngine,
  type LedgerEntry,
} from "@etic/engine";
import {
  afterBorrow,
  afterRepay,
  availableOf,
  type Balance,
  balanceOf,
  blockedReason,
  borrowError,
  canBorrow,
  capacityWith,
  categoryTotals,
  dayNet,
  daysUntil,
  filterLedger,
  inDaysLabel,
  interestOn,
  interestOutlook,
  isDirection,
  isLedgerCategory,
  isValidAmount,
  ledgerCategoryCounts,
  maxRepayment,
  netCashOf,
  plural,
  readAmount,
  repayError,
  roundCents,
  totalsDomain,
  unpaidInterest,
} from "./finance-math.ts";

const clean = (text: string | null) => (text ?? "").replace(/\s/g, " ");

function balance(overrides: Partial<Balance> = {}): Balance {
  return { cash: 20_000, reservedCash: 0, debt: 0, principal: 0, ...overrides };
}

function entry(id: number, day: number, amount: number, category: LedgerEntry["category"]) {
  return { id, day, amount, category, label: `Mouvement ${id}` } satisfies LedgerEntry;
}

// A real game, to check the previews against the engine itself.
const ORGANIZER: Actor = { kind: "organizer", userId: "org", name: "Org" };
const PLAYER: Actor = { kind: "team", teamId: "t1", userId: "u1", name: "Joueur" };

function apply(state: GameState, actor: Actor, command: Command): GameState {
  const result = gameEngine.applyCommand(state, actor, command);
  if (!result.ok) throw new Error(`${command.type} refused: ${result.refusal.message}`);
  return result.state;
}

function startedGame(): GameState {
  let state = gameEngine.createGame({
    id: "g-finance",
    seed: "finance",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: [
      {
        id: "t1",
        name: "Équipe 1",
        joinCode: "FIN-1",
        members: [{ userId: "u1", name: "Joueur" }],
      },
    ],
  });
  state = apply(state, PLAYER, {
    type: "lobby.setCompanyName",
    payload: { companyName: "Société" },
  });
  state = apply(state, PLAYER, { type: "lobby.chooseRegion", payload: { region: regionIds[0] } });
  return apply(state, ORGANIZER, { type: "control.start" });
}

function team(state: GameState) {
  const found = state.teams.t1;
  if (!found) throw new Error("team t1 missing");
  return found;
}

describe("balance", () => {
  test("available and net cash", () => {
    const current = balance({ cash: 10_000, reservedCash: 2_500, debt: 4_000 });
    expect(availableOf(current)).toBe(7_500);
    expect(netCashOf(current)).toBe(6_000);
  });

  test("unpaid interest is the debt above the principal", () => {
    expect(unpaidInterest(balance({ debt: 10_300, principal: 10_000 }))).toBe(300);
    expect(unpaidInterest(balance({ debt: 5_000, principal: 5_000 }))).toBe(0);
  });

  test("interest is rounded to whole crédits", () => {
    expect(interestOn(10_000)).toBe(300);
    expect(interestOn(16)).toBe(0);
    expect(interestOn(17)).toBe(1);
  });

  test("a loan adds the same amount to cash, debt and principal", () => {
    const after = afterBorrow(balance({ debt: 2_000, principal: 2_000 }), 5_000);
    expect(after).toEqual({ cash: 25_000, reservedCash: 0, debt: 7_000, principal: 7_000 });
    expect(netCashOf(after)).toBe(netCashOf(balance({ debt: 2_000, principal: 2_000 })));
  });

  test("a repayment settles unpaid interest before the principal", () => {
    const owed = balance({ debt: 10_300, principal: 10_000 });
    expect(afterRepay(owed, 300)).toMatchObject({ debt: 10_000, principal: 10_000 });
    expect(afterRepay(owed, 1_300)).toMatchObject({ cash: 18_700, debt: 9_000, principal: 9_000 });
  });

  test("largest repayment: the debt, within the available cash", () => {
    expect(maxRepayment(balance({ cash: 9_000, debt: 2_000 }))).toBe(2_000);
    expect(maxRepayment(balance({ cash: 3_000.7, debt: 5_000 }))).toBe(3_000);
    expect(maxRepayment(balance({ cash: 1_000, reservedCash: 1_500, debt: 5_000 }))).toBe(0);
  });
});

describe("amount input", () => {
  const accept = () => null;

  test("an empty field is neither an amount nor an error", () => {
    expect(readAmount("  ", accept)).toEqual({ amount: null, error: null });
  });

  test("only whole numbers are read", () => {
    expect(readAmount("12.5", accept).error).toBe("Entrez un nombre entier de crédits.");
    expect(readAmount("abc", accept).amount).toBeNull();
    expect(readAmount(" 5000 ", accept)).toEqual({ amount: 5_000, error: null });
    expect(isValidAmount(readAmount("5000", accept))).toBe(true);
    expect(isValidAmount(readAmount("5000", () => "non"))).toBe(false);
  });

  test("loans: minimum, ceiling", () => {
    expect(canBorrow(financeRules.minLoan)).toBe(true);
    expect(canBorrow(financeRules.minLoan - 1)).toBe(false);
    expect(clean(borrowError(500, 30_000))).toBe("Empruntez au moins ₢1 000.");
    expect(clean(borrowError(20_000, 18_000))).toBe("Vous pouvez emprunter ₢18 000 au plus.");
    expect(borrowError(2_000, 500)).toBe("Plafond d'emprunt atteint.");
    expect(borrowError(18_000, 18_000)).toBeNull();
  });

  test("repayments: up to the debt and the available cash", () => {
    const owed = balance({ cash: 3_000, debt: 5_000, principal: 5_000 });
    expect(repayError(100, balance())).toBe("Vous n'avez aucune dette.");
    expect(repayError(0, owed)).toBe("Le montant doit être positif.");
    expect(clean(repayError(6_000, balance({ cash: 9_000, debt: 5_000 })))).toBe(
      "Vous ne devez que ₢5 000.",
    );
    expect(clean(repayError(4_000, owed))).toBe(
      "Trésorerie insuffisante : vous disposez de ₢3 000.",
    );
    expect(clean(repayError(2_500, { ...owed, reservedCash: 1_000 }))).toBe(
      "Trésorerie disponible insuffisante : ₢2 000, le reste est bloqué par vos enchères.",
    );
    expect(repayError(3_000, owed)).toBeNull();
  });
});

describe("interest outlook", () => {
  test("covered by the available cash, or added to the debt", () => {
    const covered = interestOutlook(balance({ debt: 10_000, principal: 10_000 }), 31, 19, null);
    expect(covered).toEqual({ day: 31, inDays: 12, amount: 300, covered: true, afterEnd: false });
    const short = interestOutlook(
      balance({ cash: 400, reservedCash: 200, debt: 10_000 }),
      31,
      19,
      null,
    );
    expect(short.covered).toBe(false);
  });

  test("no interest day after the end of the game", () => {
    expect(interestOutlook(balance(), 61, 50, 60).afterEnd).toBe(true);
    expect(interestOutlook(balance(), 60, 50, 60).afterEnd).toBe(false);
  });

  test("time left counts the part of today already gone", () => {
    expect(daysUntil(31, { day: 30, step: 2 }, 4)).toBe(0.5);
    expect(daysUntil(31, { day: 19, step: 0 }, 4)).toBe(12);
    expect(daysUntil(31, { day: 31, step: 1 }, 4)).toBe(0);
  });

  test("labels", () => {
    expect(inDaysLabel(1)).toBe("demain");
    expect(inDaysLabel(12)).toBe("dans 12 jours");
    expect(plural(1, "mouvement")).toBe("1 mouvement");
    expect(plural(12, "mouvement")).toBe("12 mouvements");
    expect(blockedReason("running")).toBeNull();
    expect(blockedReason("paused")).toContain("pause");
  });
});

describe("ledger", () => {
  const ledger = [
    entry(1, 1, 50_000, "other"),
    entry(2, 2, -1_200, "purchases"),
    entry(3, 2, 36.4, "sales"),
    entry(4, 3, -300, "shipping"),
    entry(5, 3, 72.8, "sales"),
  ];

  test("latest first, filtered by category and direction", () => {
    expect(filterLedger(ledger, { category: "all", direction: "all" }).map((e) => e.id)).toEqual([
      5, 4, 3, 2, 1,
    ]);
    expect(filterLedger(ledger, { category: "sales", direction: "all" }).map((e) => e.id)).toEqual([
      5, 3,
    ]);
    expect(filterLedger(ledger, { category: "all", direction: "out" }).map((e) => e.id)).toEqual([
      4, 2,
    ]);
    expect(filterLedger(ledger, { category: "shipping", direction: "in" })).toEqual([]);
    expect(ledger[0]?.id).toBe(1);
  });

  test("categories in the content order, with counts", () => {
    expect(ledgerCategoryCounts(ledger).map(({ category, count }) => [category, count])).toEqual([
      ["sales", 2],
      ["purchases", 1],
      ["shipping", 1],
      ["other", 1],
    ]);
  });

  test("net movement of a day", () => {
    expect(dayNet(ledger, 3)).toBe(-227.2);
    expect(dayNet(ledger, 4)).toBe(0);
  });

  test("guards", () => {
    expect(isLedgerCategory("sales")).toBe(true);
    expect(isLedgerCategory("toString")).toBe(false);
    expect(isDirection("in")).toBe(true);
    expect(isDirection("up")).toBe(false);
  });
});

describe("totals per category", () => {
  test("largest income first, zero totals left out, one series per sign", () => {
    const rows = categoryTotals({
      sales: 1_234.56,
      other: 50_000,
      wages: -8_000,
      purchases: -12_000,
      trades: 100.1 - 100.1 + 1e-12,
    });
    expect(rows.map((row) => row.category)).toEqual(["other", "sales", "wages", "purchases"]);
    expect(rows[1]).toEqual({
      category: "sales",
      label: "Ventes",
      amount: 1_234.56,
      income: 1_234.56,
      expense: null,
    });
    expect(rows[3]).toMatchObject({ income: null, expense: -12_000 });
  });

  test("chart range leaves room for the labels at each end with bars", () => {
    expect(totalsDomain([100, -100], 0.25)).toEqual([-150, 150]);
    expect(totalsDomain([200, 50])).toEqual([0, 260]);
    expect(totalsDomain([-100])).toEqual([-130, 0]);
  });

  test("cents", () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
  });
});

describe("previews match the engine", () => {
  test("loan", () => {
    const before = startedGame();
    const after = apply(before, PLAYER, { type: "finance.borrow", payload: { amount: 12_000 } });
    expect(balanceOf(team(after))).toEqual(afterBorrow(balanceOf(team(before)), 12_000));
    expect(borrowingCapacity(team(after))).toBe(financeRules.loanCap - 12_000);
    expect(capacityWith(team(before), 12_000)).toBe(borrowingCapacity(team(after)));
    expect(team(before).finance.principal).toBe(0);
  });

  test("repayment with unpaid interest in the debt", () => {
    const state = startedGame();
    const owing = team(state);
    owing.finance.debt = 10_300;
    owing.finance.principal = 10_000;
    const after = apply(state, PLAYER, { type: "finance.repay", payload: { amount: 1_300 } });
    expect(balanceOf(team(after))).toEqual(afterRepay(balanceOf(owing), 1_300));
    expect(repayError(1_300, balanceOf(owing))).toBeNull();
  });

  test("interest the team cannot pay is added to the debt", () => {
    const state = startedGame();
    const owing = team(state);
    owing.cash = 0;
    owing.finance.debt = 10_000;
    owing.finance.principal = 10_000;
    const outlook = interestOutlook(balanceOf(owing), owing.finance.nextInterestDay, 1, null);
    expect(outlook.covered).toBe(false);
    let current = state;
    while (team(current).finance.nextInterestDay === outlook.day) {
      current = gameEngine.step(current);
    }
    expect(team(current).finance.debt).toBe(10_000 + outlook.amount);
    expect(unpaidInterest(balanceOf(team(current)))).toBe(outlook.amount);
  });
});
