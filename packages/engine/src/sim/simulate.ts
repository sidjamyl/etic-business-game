import { type ProductId, productIds } from "@etic/content";
import { gameEngine } from "../index.ts";
import { impactScores } from "../modules/impact.ts";
import { seedRng } from "../rng.ts";
import type { Actor, GameState, RankingEntry } from "../types.ts";
import { type BotProfile, botProfiles, botTurn } from "./bots.ts";

const ORGANIZER: Actor = { kind: "organizer", userId: "sim", name: "Simulation" };

export interface BotResult {
  profile: BotProfile["id"];
  rank: number;
  netCash: number;
  final: number;
  environmental: number;
  social: number;
  tier2Day: number | null;
  tier3Day: number | null;
  minCash: number;
  convictions: number;
  refusals: number;
}

export interface GameResult {
  seed: string;
  days: number;
  bots: BotResult[];
  winner: BotProfile["id"];
  /** Units sold per product and day, all teams together. */
  dailySales: Record<ProductId, number[]>;
  /** Units ordered by customers per product and day, all teams together (demand). */
  dailyOrders: Record<ProductId, number[]>;
  invariantViolations: string[];
  ranking: RankingEntry[];
}

function must(state: GameState, actor: Actor, command: { type: string; payload?: unknown }) {
  const result = gameEngine.applyCommand(state, actor, command);
  if (!result.ok) throw new Error(`${command.type}: ${result.refusal.message}`);
  return result.state;
}

/** Plays a full game with the four bots (N24). */
export function simulateGame(seed: string, days = 420, profiles = botProfiles): GameResult {
  const rng = seedRng(`bots:${seed}`);
  let state = gameEngine.createGame({
    id: `sim-${seed}`,
    seed,
    config: { stepsPerDay: 4, countdownDays: 30 },
    endDay: days,
    teams: profiles.map((profile, index) => ({
      id: `t${index + 1}`,
      name: profile.name,
      members: [{ userId: `bot-${profile.id}`, name: profile.name }],
    })),
  });
  const actors = new Map<string, Actor>();
  profiles.forEach((profile, index) => {
    const teamId = `t${index + 1}`;
    const actor: Actor = { kind: "team", teamId, userId: `bot-${profile.id}`, name: profile.name };
    actors.set(teamId, actor);
    state = must(state, actor, {
      type: "lobby.setCompanyName",
      payload: { companyName: profile.name },
    });
    state = must(state, actor, { type: "lobby.chooseRegion", payload: { region: profile.region } });
  });
  state = must(state, ORGANIZER, { type: "control.start" });

  const refusals = new Map<string, number>();
  const tierDays = new Map<string, { 2: number | null; 3: number | null }>();
  const minCash = new Map<string, number>();
  const dailySales = Object.fromEntries(productIds.map((id) => [id, [] as number[]])) as Record<
    ProductId,
    number[]
  >;
  const dailyOrders = Object.fromEntries(productIds.map((id) => [id, [] as number[]])) as Record<
    ProductId,
    number[]
  >;
  const violations: string[] = [];
  let previousSold = new Map<ProductId, number>();

  while (state.status === "running") {
    if (state.time.step === 0) {
      profiles.forEach((profile, index) => {
        const teamId = `t${index + 1}`;
        const actor = actors.get(teamId);
        if (!actor) return;
        for (const command of botTurn(state, teamId, profile, rng)) {
          const result = gameEngine.applyCommand(state, actor, command);
          if (result.ok) state = result.state;
          else refusals.set(teamId, (refusals.get(teamId) ?? 0) + 1);
        }
      });
      // Daily bookkeeping.
      const sold = new Map<ProductId, number>();
      for (const team of Object.values(state.teams)) {
        for (const productId of productIds) {
          sold.set(productId, (sold.get(productId) ?? 0) + (team.stats.sold[productId] ?? 0));
        }
        const record = tierDays.get(team.id) ?? { 2: null, 3: null };
        if (team.progression.unlockedTier >= 2 && record[2] === null) record[2] = state.time.day;
        if (team.progression.unlockedTier >= 3 && record[3] === null) record[3] = state.time.day;
        tierDays.set(team.id, record);
        minCash.set(
          team.id,
          Math.min(minCash.get(team.id) ?? Infinity, team.cash - team.finance.debt),
        );
        // Invariants (N24 target 7).
        if (team.cash < 0) violations.push(`day ${state.time.day}: ${team.id} cash < 0`);
        if (team.reservedCash > team.cash)
          violations.push(`day ${state.time.day}: ${team.id} reserved > cash`);
        const ledger = Object.values(team.finance.totals).reduce((s, v) => s + (v ?? 0), 0);
        if (Math.round(ledger) !== Math.round(team.cash)) {
          violations.push(`day ${state.time.day}: ${team.id} ledger ${ledger} ≠ cash ${team.cash}`);
        }
        for (const [productId, reserved] of Object.entries(team.reserved)) {
          if ((reserved ?? 0) > (team.inventory[productId as ProductId] ?? 0)) {
            violations.push(`day ${state.time.day}: ${team.id} reserved ${productId} > stock`);
          }
        }
      }
      for (const productId of productIds) {
        dailySales[productId].push((sold.get(productId) ?? 0) - (previousSold.get(productId) ?? 0));
        let ordered = 0;
        for (const team of Object.values(state.teams)) {
          const history = team.stats.orderHistory[state.time.day - 1] ?? {};
          for (const [key, units] of Object.entries(history)) {
            if (key.endsWith(`:${productId}`)) ordered += units;
          }
        }
        dailyOrders[productId].push(ordered);
      }
      previousSold = sold;
    }
    state = gameEngine.step(state);
  }

  const ranking = state.results?.ranking ?? [];
  const bots = profiles.map((profile, index): BotResult => {
    const teamId = `t${index + 1}`;
    const team = state.teams[teamId];
    const entry = ranking.find((e) => e.teamId === teamId);
    const impact = team ? impactScores(team) : { environmental: 0, social: 0 };
    return {
      profile: profile.id,
      rank: entry?.rank ?? 0,
      netCash: entry?.netCash ?? 0,
      final: entry?.final ?? 0,
      environmental: impact.environmental,
      social: impact.social,
      tier2Day: tierDays.get(teamId)?.[2] ?? null,
      tier3Day: tierDays.get(teamId)?.[3] ?? null,
      minCash: Math.round(minCash.get(teamId) ?? 0),
      convictions: team?.blackMarket.convictions ?? 0,
      refusals: refusals.get(teamId) ?? 0,
    };
  });
  const winner = bots.find((b) => b.rank === 1)?.profile ?? "cautious";
  return {
    seed,
    days,
    bots,
    winner,
    dailySales,
    dailyOrders,
    invariantViolations: violations,
    ranking,
  };
}
