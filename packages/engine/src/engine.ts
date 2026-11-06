import { financeRules, hrRules, salesRules, startRules, warehouseRules } from "@etic/content";
import { z } from "zod";
import type { CommandContext, CommandRegistry } from "./commands.ts";
import { CommandRefused } from "./errors.ts";
import { announce, logAllTeams } from "./log.ts";
import { seedRng } from "./rng.ts";
import type { GameSystem } from "./systems.ts";
import type {
  Actor,
  Command,
  CommandResult,
  GameConfig,
  GameState,
  Member,
  Refusal,
} from "./types.ts";

export interface NewTeam {
  id: string;
  name: string;
  joinCode?: string;
  members?: Member[];
}

export interface NewGame {
  id: string;
  seed: string;
  config: GameConfig;
  teams: NewTeam[];
  endDay?: number | null;
  memberCap?: number;
}

/** A journal entry: everything that changed the state, in order (S13). */
export type JournalEntry = { kind: "command"; actor: Actor; command: Command } | { kind: "step" };

const STATUS_REFUSALS: Record<GameState["status"], Refusal> = {
  lobby: { code: "GAME_NOT_STARTED", message: "La partie n'a pas encore commencé." },
  running: { code: "INVALID_STATE", message: "Action impossible pendant la partie." },
  paused: {
    code: "GAME_PAUSED",
    message: "Le jeu est en pause : les décisions reprendront à la reprise.",
  },
  ended: { code: "GAME_ENDED", message: "La partie est terminée." },
};

export interface Engine {
  createGame(input: NewGame): GameState;
  applyCommand(state: GameState, actor: Actor, command: Command): CommandResult;
  /** Advances one sub-step. No-op unless the game is running. */
  step(state: GameState): GameState;
  /** Re-applies journal entries; refused commands stay refused, so replay is exact. */
  replay(state: GameState, entries: readonly JournalEntry[]): GameState;
}

export function createEngine({
  commands,
  systems = [],
}: {
  commands: CommandRegistry;
  systems?: readonly GameSystem[];
}): Engine {
  const finishGame = (draft: GameState) => {
    for (const system of systems) system.onEnd?.(draft);
    draft.status = "ended";
    announce(draft, "Fin de la partie.");
    logAllTeams(draft, { kind: "system", message: "Fin de la partie." });
  };
  const ctx: CommandContext = { finishGame };

  function applyCommand(state: GameState, actor: Actor, command: Command): CommandResult {
    const def = commands[command.type];
    if (!def) {
      return { ok: false, refusal: { code: "UNKNOWN_COMMAND", message: "Action inconnue." } };
    }
    if (def.actor !== actor.kind) {
      return {
        ok: false,
        refusal: { code: "FORBIDDEN", message: "Vous n'avez pas le droit de faire cette action." },
      };
    }
    if (actor.kind === "team" && !state.teams[actor.teamId]?.members[actor.userId]) {
      return {
        ok: false,
        refusal: { code: "FORBIDDEN", message: "Vous ne faites pas partie de cette équipe." },
      };
    }
    const allowed = def.allowedStatuses ?? ["running"];
    if (!allowed.includes(state.status)) {
      return { ok: false, refusal: STATUS_REFUSALS[state.status] };
    }
    const parsed = def.schema.safeParse(command.payload);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Données invalides.";
      return { ok: false, refusal: { code: "INVALID_PAYLOAD", message } };
    }
    const draft = structuredClone(state);
    try {
      def.apply(draft, parsed.data, actor, ctx);
    } catch (error) {
      if (error instanceof CommandRefused) return { ok: false, refusal: error.toRefusal() };
      throw error;
    }
    draft.journalSeq += 1;
    return { ok: true, state: draft };
  }

  function step(state: GameState): GameState {
    if (state.status !== "running") return state;
    const draft = structuredClone(state);
    draft.time.step += 1;
    if (draft.time.step >= draft.config.stepsPerDay) {
      draft.time.step = 0;
      draft.time.day += 1;
      if (draft.endDay !== null && draft.time.day > draft.endDay) {
        // The last scheduled day is over: freeze before any new-day processing.
        draft.time.day = draft.endDay;
        draft.time.step = draft.config.stepsPerDay - 1;
        finishGame(draft);
        draft.journalSeq += 1;
        return draft;
      }
      for (const system of systems) system.onDay?.(draft);
    }
    for (const system of systems) system.onStep?.(draft);
    draft.journalSeq += 1;
    return draft;
  }

  function replay(state: GameState, entries: readonly JournalEntry[]): GameState {
    let current = state;
    for (const entry of entries) {
      if (entry.kind === "step") {
        current = step(current);
      } else {
        const result = applyCommand(current, entry.actor, entry.command);
        if (result.ok) current = result.state;
      }
    }
    return current;
  }

  function createGame(input: NewGame): GameState {
    const config = gameConfigSchema.parse(input.config);
    const teams: GameState["teams"] = {};
    for (const team of input.teams) {
      const members: Record<string, Member> = {};
      for (const member of team.members ?? []) members[member.userId] = member;
      teams[team.id] = {
        id: team.id,
        name: team.name,
        joinCode: team.joinCode ?? team.id,
        companyName: null,
        region: null,
        members,
        cash: 0,
        reservedCash: 0,
        perks: { outputFactor: 1, shippingFactor: 1 },
        finance: {
          debt: 0,
          principal: 0,
          nextInterestDay: 1 + financeRules.interestEveryDays,
          ledger: [],
          totals: {},
        },
        card: null,
        cardEffects: { spyReport: null, amnestyUntilDay: null },
        inventory: {},
        inbound: {},
        machines: {},
        warehouse: { capacity: warehouseRules.initialCapacity, expansion: null },
        employees: {},
        hr: {
          nextPayrollDay: 1 + hrRules.payrollEveryDays,
          unpaidWages: 0,
          strikeStartDay: null,
          strikeDays: 0,
          massResignations: 0,
          layoffs: 0,
          wageRatioSum: 0,
          employeeDays: 0,
        },
        prices: {},
        orders: {},
        reserved: {},
        autoAccept: {},
        reputation: salesRules.reputation.initial,
        demandCarry: {},
        shipments: {},
        progression: { unlockedTier: 1, branch: null, project: null },
        campaigns: {},
        impact: {
          purchases: { units: 0, environmentalSum: 0, socialSum: 0, lowRatedUnits: 0 },
          production: { units: 0, environmentalSum: 0, ferroniaUnits: 0 },
          transport: { units: 0, environmentalSum: 0, expressUnits: 0 },
        },
        badges: [],
        blackMarket: {
          traces: [],
          bannedUntilDay: null,
          soldToday: {},
          lastAccusations: {},
          investigations: [],
          purchasedUnits: 0,
          soldUnits: 0,
          convictions: 0,
        },
        preparedToday: 0,
        stats: {
          produced: {},
          orderHistory: {},
          sold: {},
          revenue: 0,
          lateDeliveries: 0,
          failedOrders: 0,
          shippedUnits: {},
        },
        log: [],
      };
    }
    const state: GameState = {
      schemaVersion: 1,
      id: input.id,
      config,
      status: "lobby",
      time: { day: 1, step: 0 },
      endDay: input.endDay ?? null,
      rng: seedRng(input.seed),
      nextId: 1,
      journalSeq: 0,
      memberCap: input.memberCap ?? startRules.defaultMemberCap,
      teams,
      market: {
        suppliers: {},
        equipment: {},
        laborPool: {},
        demandModifiers: {},
        recoveryShiftDays: { 2: 0, 3: 0 },
        supplierEffects: {},
        transportDelays: {},
        wageFactor: {},
        supplierPriority: {},
        blackMarket: { stock: {}, nextRestockDay: 1 },
      },
      news: [],
      scenario: { done: {}, active: {} },
      auctions: {},
      trades: { offers: {}, shipments: {} },
      easterEggs: {},
      results: null,
      announcements: [],
    };
    for (const system of systems) system.onCreate?.(state);
    return state;
  }

  return { createGame, applyCommand, step, replay };
}

export const gameConfigSchema = z.object({
  stepsPerDay: z.int().min(1).max(24),
  countdownDays: z.int().min(0),
});
