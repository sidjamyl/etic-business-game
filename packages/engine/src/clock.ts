import type { GameState } from "./types.ts";

/** True during the last `countdownDays` simulated days before a scheduled end (R19). */
export function isCountdown(state: GameState): boolean {
  if (state.endDay === null || state.status === "ended") return false;
  return state.endDay - state.time.day < state.config.countdownDays;
}

export function daysRemaining(state: GameState): number | null {
  if (state.endDay === null) return null;
  return Math.max(0, state.endDay - state.time.day + 1);
}
