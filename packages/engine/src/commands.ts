import type { z } from "zod";
import type { Actor, GameState } from "./types.ts";

/** Services a command handler may use besides the draft state. */
export interface CommandContext {
  /** Ends the game: runs every system's `onEnd`, then marks the game as ended. */
  finishGame: (draft: GameState) => void;
}

/**
 * A command handler mutates a private copy of the state (`draft`). It refuses by throwing
 * CommandRefused (see `refuse`). applyCommand guarantees purity from the outside.
 */
export interface CommandDefinition<S extends z.ZodType = z.ZodType> {
  type: string;
  /** Who may send it. */
  actor: Actor["kind"];
  /**
   * Game statuses in which the command is allowed. Team decisions default to "running" only,
   * which blocks them while paused (O1) and after the end.
   */
  allowedStatuses?: readonly GameState["status"][];
  schema: S;
  apply: (draft: GameState, payload: z.output<S>, actor: Actor, ctx: CommandContext) => void;
}

export type CommandRegistry = Record<string, CommandDefinition>;

export function defineCommand<S extends z.ZodType>(def: CommandDefinition<S>): CommandDefinition {
  return def as unknown as CommandDefinition;
}

export function buildRegistry(...groups: CommandDefinition[][]): CommandRegistry {
  const registry: CommandRegistry = {};
  for (const def of groups.flat()) {
    if (registry[def.type]) throw new Error(`Duplicate command type: ${def.type}`);
    registry[def.type] = def;
  }
  return registry;
}
