import type { GameState } from "./types.ts";

/**
 * A game system runs inside `step`. Module issues (purchases, production, HR…) add systems.
 * `onStep` runs on every sub-step; `onDay` runs once at the start of each new simulated day;
 * `onEnd` runs when the game ends, before the status becomes "ended" (settlement, R19);
 * `onCreate` initializes the system's part of a new game.
 */
export interface GameSystem {
  name: string;
  onCreate?: (draft: GameState) => void;
  onStep?: (draft: GameState) => void;
  onDay?: (draft: GameState) => void;
  onEnd?: (draft: GameState) => void;
}
