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

/**
 * A definition that also carries its type name, payload input type and actor as phantom types
 * (erased at runtime). Typed clients derive their command map from these (see TeamCommandMap).
 */
export type TypedCommand<
  T extends string,
  S extends z.ZodType,
  A extends Actor["kind"],
> = CommandDefinition & {
  readonly __types?: { readonly type: T; readonly input: z.input<S>; readonly actor: A };
};

export function defineCommand<
  const T extends string,
  S extends z.ZodType,
  const A extends Actor["kind"],
>(def: CommandDefinition<S> & { type: T; actor: A }): TypedCommand<T, S, A> {
  return def as unknown as TypedCommand<T, S, A>;
}

type PhantomOf<C> = C extends { readonly __types?: infer P } ? NonNullable<P> : never;
type InputOf<C> = PhantomOf<C> extends { readonly input: infer I } ? I : never;

/** Maps each command type of a definition list to its payload input, for one kind of actor. */
export type CommandMapOf<C, A extends Actor["kind"]> = {
  [D in C as PhantomOf<D> extends { actor: A; type: infer T extends string }
    ? T
    : never]: InputOf<D>;
};

export function buildRegistry(...groups: CommandDefinition[][]): CommandRegistry {
  const registry: CommandRegistry = {};
  for (const def of groups.flat()) {
    if (registry[def.type]) throw new Error(`Duplicate command type: ${def.type}`);
    registry[def.type] = def;
  }
  return registry;
}
