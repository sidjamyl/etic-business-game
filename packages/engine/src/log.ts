import type { ActivityKind, GameState } from "./types.ts";

/** Activity log entries kept per team; older ones are dropped in chunks to keep deltas small. */
export const LOG_LIMIT = 400;
const LOG_TRIM = 100;

export function allocateId(state: GameState): number {
  const id = state.nextId;
  state.nextId += 1;
  return id;
}

export function logTeam(
  state: GameState,
  teamId: string,
  entry: { kind: ActivityKind; message: string; actor?: string },
): void {
  const team = state.teams[teamId];
  if (!team) return;
  team.log.push({ id: allocateId(state), day: state.time.day, step: state.time.step, ...entry });
  if (team.log.length > LOG_LIMIT) team.log.splice(0, LOG_TRIM);
}

export function logAllTeams(
  state: GameState,
  entry: { kind: ActivityKind; message: string },
): void {
  for (const teamId of Object.keys(state.teams)) logTeam(state, teamId, entry);
}

export function announce(state: GameState, message: string): void {
  state.announcements.push({
    id: allocateId(state),
    day: state.time.day,
    step: state.time.step,
    message,
  });
  if (state.announcements.length > LOG_LIMIT) state.announcements.splice(0, LOG_TRIM);
}
