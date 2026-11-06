import { randomUUID } from "node:crypto";
import { timingRules } from "@etic/content";
import type { Actor, Engine, NewTeam } from "@etic/engine";
import type { Logger } from "../logger.ts";
import { generateJoinCode, normalizeJoinCode } from "./join-code.ts";
import type { GamePersistence } from "./persistence.ts";
import { GameRuntime } from "./runtime.ts";

export interface CreateGameInput {
  name: string;
  teams: NewTeam[];
  memberCap?: number;
  /** Rehearsal speed (P10); defaults to one simulated day per real minute. */
  msPerDay?: number;
  /** Rehearsal duration in simulated days (P10). */
  durationDays?: number | null;
  createdBy?: string | null;
  seed?: string;
}

const SYSTEM: Actor = { kind: "organizer", userId: "system", name: "Système" };

/** Owns every game running on this server (rehearsals and the real game can coexist). */
export class GameManager {
  private readonly games = new Map<string, GameRuntime>();

  constructor(
    private readonly deps: {
      engine: Engine;
      persistence: GamePersistence;
      logger: Logger;
      now?: () => number;
      saveDebounceMs?: number;
    },
  ) {}

  get(gameId: string): GameRuntime | undefined {
    return this.games.get(gameId);
  }

  list(): GameRuntime[] {
    return [...this.games.values()];
  }

  /** Join codes in use by unfinished games. */
  takenJoinCodes(): Set<string> {
    const taken = new Set<string>();
    for (const runtime of this.games.values()) {
      if (runtime.snapshot.status === "ended") continue;
      for (const code of runtime.joinCodes.keys()) taken.add(code);
    }
    return taken;
  }

  /** Finds the unfinished game and team behind a join code. */
  findByJoinCode(code: string): { runtime: GameRuntime; teamId: string } | null {
    const wanted = normalizeJoinCode(code);
    for (const runtime of this.games.values()) {
      if (runtime.snapshot.status === "ended") continue;
      const teamId = runtime.joinCodes.get(wanted);
      if (teamId) return { runtime, teamId };
    }
    return null;
  }

  async create(input: CreateGameInput): Promise<GameRuntime> {
    const id = randomUUID();
    const taken = this.takenJoinCodes();
    const teams = input.teams.map((team) => {
      const joinCode = team.joinCode ?? generateJoinCode(taken);
      taken.add(joinCode);
      return { ...team, joinCode };
    });
    const state = this.deps.engine.createGame({
      id,
      seed: input.seed ?? randomUUID(),
      config: { stepsPerDay: timingRules.stepsPerDay, countdownDays: timingRules.countdownDays },
      teams,
      endDay: input.durationDays ?? null,
      ...(input.memberCap !== undefined ? { memberCap: input.memberCap } : {}),
    });
    const msPerDay = input.msPerDay ?? timingRules.msPerDay;
    await this.deps.persistence.insertGame(
      { id, name: input.name, msPerDay, endsAt: null, createdBy: input.createdBy ?? null },
      state,
    );
    const runtime = this.instantiate(state, input.name, msPerDay, null);
    this.deps.logger.info({ gameId: id, name: input.name }, "game created");
    return runtime;
  }

  /**
   * Reloads unfinished games after a restart: last snapshot + journal replay. Games that were
   * running come back paused (P5), so the organizer decides when to resume.
   */
  async restore(): Promise<GameRuntime[]> {
    const stored = await this.deps.persistence.loadActive();
    const restored: GameRuntime[] = [];
    for (const game of stored) {
      let state = this.deps.engine.replay(game.state, game.pending);
      if (state.status === "running") {
        const result = this.deps.engine.applyCommand(state, SYSTEM, { type: "control.pause" });
        if (result.ok) state = result.state;
      }
      const runtime = this.instantiate(state, game.name, game.msPerDay, game.endsAt);
      // Persist the replayed snapshot (and the pause) right away.
      await runtime.flush(true);
      restored.push(runtime);
      this.deps.logger.info(
        { gameId: game.id, replayed: game.pending.length, status: state.status },
        "game restored",
      );
    }
    return restored;
  }

  async stopAll(): Promise<void> {
    await Promise.all(this.list().map((runtime) => runtime.stop()));
  }

  private instantiate(
    state: GameRuntime["snapshot"],
    name: string,
    msPerDay: number,
    endsAt: Date | null,
  ) {
    const runtime = new GameRuntime(state, {
      engine: this.deps.engine,
      persistence: this.deps.persistence,
      logger: this.deps.logger,
      name,
      msPerDay,
      endsAt,
      ...(this.deps.now ? { now: this.deps.now } : {}),
      ...(this.deps.saveDebounceMs !== undefined
        ? { saveDebounceMs: this.deps.saveDebounceMs }
        : {}),
    });
    this.games.set(state.id, runtime);
    return runtime;
  }
}
