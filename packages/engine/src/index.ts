/**
 * @etic/engine — pure game rules (no I/O, no wall clock, no Math.random).
 * State changes only through `applyCommand` (player and organizer decisions) and `step`
 * (one sub-step of simulated time). See product.md §18 (S13).
 */
export * from "./clock.ts";
export * from "./commands.ts";
export * from "./control.ts";
export * from "./diff.ts";
export * from "./engine.ts";
export * from "./errors.ts";
export * from "./lobby.ts";
export * from "./log.ts";
export * from "./modules/auctions.ts";
export * from "./modules/black-market.ts";
export * from "./modules/cards.ts";
export * from "./modules/delivery.ts";
export * from "./modules/easter-eggs.ts";
export * from "./modules/finance.ts";
export * from "./modules/hr.ts";
export * from "./modules/impact.ts";
export * from "./modules/marketing.ts";
export * from "./modules/organizer.ts";
export * from "./modules/production.ts";
export * from "./modules/progression.ts";
export * from "./modules/purchasing.ts";
export * from "./modules/sales.ts";
export * from "./modules/scenario.ts";
export * from "./modules/scoring.ts";
export * from "./modules/shared.ts";
export * from "./modules/trades.ts";
export * from "./rng.ts";
export * from "./systems.ts";
export * from "./types.ts";
export * from "./views.ts";

import { buildRegistry, type CommandMapOf } from "./commands.ts";
import { controlCommands } from "./control.ts";
import { createEngine } from "./engine.ts";
import { lobbyCommands } from "./lobby.ts";
import { auctionCommands, auctionSystem } from "./modules/auctions.ts";
import { blackMarketCommands, blackMarketSystem } from "./modules/black-market.ts";
import { cardCommands, cardSystem } from "./modules/cards.ts";
import { deliveryCommands, deliverySystem } from "./modules/delivery.ts";
import { easterEggCommands } from "./modules/easter-eggs.ts";
import { financeCommands, financeSystem } from "./modules/finance.ts";
import { hrCommands, hrSystem } from "./modules/hr.ts";
import { marketingCommands, marketingSystem } from "./modules/marketing.ts";
import { productionCommands, productionSystem } from "./modules/production.ts";
import { progressionCommands, progressionSystem } from "./modules/progression.ts";
import { purchasingCommands, purchasingSystem } from "./modules/purchasing.ts";
import { salesCommands, salesSystem } from "./modules/sales.ts";
import { scenarioSystem } from "./modules/scenario.ts";
import { scoringCommands, scoringSystem } from "./modules/scoring.ts";
import { tradeCommands, tradeSystem } from "./modules/trades.ts";

/** One simulated day lasts one real minute in a real game (product.md §5). */
export const DEFAULT_MS_PER_DAY = 60_000;

/** Every command group of the game, in registration order. */
const commandGroups = [
  controlCommands,
  lobbyCommands,
  purchasingCommands,
  hrCommands,
  productionCommands,
  salesCommands,
  deliveryCommands,
  financeCommands,
  progressionCommands,
  marketingCommands,
  auctionCommands,
  blackMarketCommands,
  cardCommands,
  tradeCommands,
  scoringCommands,
  easterEggCommands,
] as const;

/** The registry of every command known to the game. Module issues add their groups here. */
export const gameCommands = buildRegistry(...commandGroups);

type AnyCommand = (typeof commandGroups)[number][number];

/** Payload input of every team decision, by command type (typed web client, #26). */
export type TeamCommandMap = CommandMapOf<AnyCommand, "team">;
export type TeamCommandType = keyof TeamCommandMap;

/** The game engine with every module wired in. */
export const gameEngine = createEngine({
  commands: gameCommands,
  // The scenario runs first so every module sees the day's events.
  systems: [
    scenarioSystem,
    tradeSystem,
    purchasingSystem,
    hrSystem,
    productionSystem,
    salesSystem,
    deliverySystem,
    financeSystem,
    progressionSystem,
    marketingSystem,
    auctionSystem,
    blackMarketSystem,
    cardSystem,
    // Last: settles the game once auctions and trades have released their money (R19).
    scoringSystem,
  ],
});
