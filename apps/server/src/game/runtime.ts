import { EventEmitter, on } from "node:events";
import {
  type Actor,
  type AdminView,
  adminView,
  type Command,
  type CommandResult,
  diff,
  type Engine,
  type GameState,
  type PatchOp,
  type PublicView,
  publicView,
  type TeamView,
  teamView,
} from "@etic/engine";
import type { Logger } from "../logger.ts";
import type { GamePersistence, JournalRecord } from "./persistence.ts";

/** Message pushed on a stream: the full view once, then patches (S9). */
export type StreamMessage<V> =
  | { kind: "full"; version: number; view: V }
  | { kind: "patch"; version: number; ops: PatchOp[] };

export interface RuntimeMetrics {
  lastStepDurationMs: number;
  lastStepAt: Date | null;
  lastSavedAt: Date | null;
  subscribers: number;
}

/** Control-room view: the organizer projection plus server health (N22). */
export type AdminStreamView = AdminView & {
  game: { id: string; name: string; msPerDay: number };
  metrics: {
    lastStepDurationMs: number;
    lastStepAt: string | null;
    lastSavedAt: string | null;
    subscribers: number;
  };
};

export interface RuntimeOptions {
  engine: Engine;
  persistence: GamePersistence;
  logger: Logger;
  name: string;
  msPerDay: number;
  endsAt?: Date | null;
  /** Wall clock, injectable for tests. */
  now?: () => number;
  /** Delay before saving after a command (steps are saved immediately). */
  saveDebounceMs?: number;
}

/**
 * Runs one game in memory. Commands are applied synchronously, one at a time, in arrival order;
 * steps are driven by a timer while the game is running. Every change is journaled, saved and
 * pushed to subscribers as per-team deltas.
 */
export class GameRuntime {
  private state: GameState;
  private readonly engine: Engine;
  private readonly persistence: GamePersistence;
  private readonly logger: Logger;
  private readonly now: () => number;
  private readonly saveDebounceMs: number;
  private readonly events = new EventEmitter();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pending: JournalRecord[] = [];
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private saving: Promise<void> = Promise.resolve();
  private teamViews = new Map<string, TeamView>();
  private lastPublic: PublicView;
  /** Kept only while an organizer is listening. */
  private lastAdmin: AdminStreamView | null = null;
  private endsAt: Date | null;
  readonly name: string;
  readonly msPerDay: number;
  readonly metrics: RuntimeMetrics = {
    lastStepDurationMs: 0,
    lastStepAt: null,
    lastSavedAt: null,
    subscribers: 0,
  };

  constructor(state: GameState, options: RuntimeOptions) {
    this.state = state;
    this.engine = options.engine;
    this.persistence = options.persistence;
    this.logger = options.logger.child({ gameId: state.id });
    this.now = options.now ?? Date.now;
    this.saveDebounceMs = options.saveDebounceMs ?? 250;
    this.name = options.name;
    this.msPerDay = options.msPerDay;
    this.endsAt = options.endsAt ?? null;
    this.events.setMaxListeners(0);
    this.lastPublic = publicView(state);
    for (const teamId of Object.keys(state.teams)) {
      const view = teamView(state, teamId);
      if (view) this.teamViews.set(teamId, view);
    }
    this.syncTimer();
  }

  get id(): string {
    return this.state.id;
  }

  /** Join codes of this game's teams, normalized. */
  get joinCodes(): Map<string, string> {
    const codes = new Map<string, string>();
    for (const team of Object.values(this.state.teams)) codes.set(team.joinCode, team.id);
    return codes;
  }

  get snapshot(): GameState {
    return this.state;
  }

  get stepMs(): number {
    return this.msPerDay / this.state.config.stepsPerDay;
  }

  /** Applies a player or organizer command. Never throws for game-rule refusals. */
  submit(actor: Actor, command: Command): CommandResult {
    const before = this.state;
    const result = this.engine.applyCommand(before, actor, command);
    this.pending.push({
      seq: result.ok ? result.state.journalSeq : null,
      kind: "command",
      actor,
      command,
      ok: result.ok,
      ...(result.ok ? {} : { refusalCode: result.refusal.code }),
      day: before.time.day,
      step: before.time.step,
    });
    if (result.ok) {
      this.state = result.state;
      if (before.status !== this.state.status) this.onStatusChange(before.status);
      this.broadcast();
    }
    this.scheduleSave(result.ok && before.status !== this.state.status ? 0 : this.saveDebounceMs);
    return result;
  }

  /** Advances one sub-step (also used by tests to drive time without timers). */
  step(): void {
    if (this.state.status !== "running") return;
    const started = performance.now();
    const before = this.state;
    this.state = this.engine.step(before);
    this.pending.push({
      seq: this.state.journalSeq,
      kind: "step",
      ok: true,
      day: before.time.day,
      step: before.time.step,
    });
    this.metrics.lastStepDurationMs = performance.now() - started;
    this.metrics.lastStepAt = new Date(this.now());
    if (before.status !== this.state.status) this.onStatusChange(before.status);
    this.broadcast();
    this.scheduleSave(0);
  }

  /**
   * Sets the wall-clock end (P8). The end day is recomputed now and at every resume, so a
   * lunch pause shortens the simulated game instead of pushing the end time back.
   */
  setEndsAt(organizer: Actor, endsAt: Date | null): CommandResult {
    this.endsAt = endsAt;
    return this.submit(organizer, {
      type: "control.setEndDay",
      payload: { endDay: this.endDayFor(endsAt) },
    });
  }

  private endDayFor(endsAt: Date | null): number | null {
    if (!endsAt) return null;
    const remainingMs = Math.max(0, endsAt.getTime() - this.now());
    const remainingDays = Math.floor(remainingMs / this.msPerDay);
    return Math.max(this.state.time.day, this.state.time.day + remainingDays - 1);
  }

  private onStatusChange(previous: GameState["status"]): void {
    this.logger.info({ from: previous, to: this.state.status }, "game status changed");
    const resumed = this.state.status === "running" && previous !== "running";
    if (resumed && this.endsAt) {
      const endDay = this.endDayFor(this.endsAt);
      if (endDay !== this.state.endDay) {
        const system: Actor = { kind: "organizer", userId: "system", name: "Système" };
        // Re-entrant on purpose: journaled like any organizer command.
        queueMicrotask(() =>
          this.submit(system, { type: "control.setEndDay", payload: { endDay } }),
        );
      }
    }
    this.syncTimer();
  }

  private syncTimer(): void {
    if (this.state.status === "running" && !this.timer) {
      const loop = () => {
        this.timer = setTimeout(() => {
          this.step();
          if (this.state.status === "running") loop();
          else this.timer = null;
        }, this.stepMs);
      };
      loop();
    } else if (this.state.status !== "running" && this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private broadcast(): void {
    const version = this.state.journalSeq;
    for (const teamId of Object.keys(this.state.teams)) {
      const next = teamView(this.state, teamId);
      if (!next) continue;
      const previous = this.teamViews.get(teamId);
      this.teamViews.set(teamId, next);
      const ops = previous ? diff(previous, next) : [];
      if (!previous) this.events.emit(`team:${teamId}`, { kind: "full", version, view: next });
      else if (ops.length > 0) this.events.emit(`team:${teamId}`, { kind: "patch", version, ops });
    }
    const nextPublic = publicView(this.state);
    const publicOps = diff(this.lastPublic, nextPublic);
    this.lastPublic = nextPublic;
    if (publicOps.length > 0)
      this.events.emit("public", { kind: "patch", version, ops: publicOps });
    // The control-room view is only computed when an organizer is watching.
    if (this.events.listenerCount("admin") === 0) {
      this.lastAdmin = null;
      return;
    }
    const nextAdmin = this.adminSnapshot();
    const adminOps = this.lastAdmin ? diff(this.lastAdmin, nextAdmin) : [];
    this.lastAdmin = nextAdmin;
    if (adminOps.length > 0) this.events.emit("admin", { kind: "patch", version, ops: adminOps });
  }

  private adminSnapshot(): AdminStreamView {
    return {
      ...adminView(this.state),
      game: { id: this.id, name: this.name, msPerDay: this.msPerDay },
      metrics: {
        lastStepDurationMs: Math.round(this.metrics.lastStepDurationMs * 100) / 100,
        lastStepAt: this.metrics.lastStepAt?.toISOString() ?? null,
        lastSavedAt: this.metrics.lastSavedAt?.toISOString() ?? null,
        subscribers: this.metrics.subscribers,
      },
    };
  }

  /** Control-room stream for the organizer (N22). */
  streamAdmin(signal?: AbortSignal): AsyncGenerator<StreamMessage<AdminStreamView>> {
    return this.stream(
      "admin",
      () => {
        this.lastAdmin ??= this.adminSnapshot();
        return this.lastAdmin;
      },
      signal,
    );
  }

  /**
   * Full view of the team, then its deltas until `signal` aborts. The stream ends as soon as
   * the user no longer belongs to the team (moved or removed), so no data leaks afterwards.
   */
  streamTeam(
    teamId: string,
    userId: string,
    signal?: AbortSignal,
  ): AsyncGenerator<StreamMessage<TeamView>> {
    return this.stream(
      `team:${teamId}`,
      () => this.teamViews.get(teamId) ?? null,
      signal,
      () => Boolean(this.state.teams[teamId]?.members[userId]),
    );
  }

  /** Public view for the projector screen (P10). */
  streamPublic(signal?: AbortSignal): AsyncGenerator<StreamMessage<PublicView>> {
    return this.stream("public", () => this.lastPublic, signal);
  }

  private async *stream<V>(
    channel: string,
    current: () => V | null,
    signal?: AbortSignal,
    stillAllowed: () => boolean = () => true,
  ): AsyncGenerator<StreamMessage<V>> {
    // Subscribe before reading the current view so no change can slip in between.
    const iterator = on(this.events, channel, signal ? { signal } : {});
    this.metrics.subscribers += 1;
    try {
      if (!stillAllowed()) return;
      const view = current();
      if (view) yield { kind: "full", version: this.state.journalSeq, view };
      for await (const [message] of iterator) {
        if (!stillAllowed()) return;
        yield message as StreamMessage<V>;
      }
    } catch (error) {
      if (!(error instanceof Error && error.name === "AbortError")) throw error;
    } finally {
      this.metrics.subscribers -= 1;
    }
  }

  private scheduleSave(delayMs: number): void {
    if (this.saveTimer) {
      if (delayMs > 0) return;
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flush();
    }, delayMs);
  }

  /**
   * Writes pending journal records and the latest snapshot. Saves never overlap.
   * `force` saves the snapshot even without new records (after a restore).
   */
  flush(force = false): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const records = this.pending;
    this.pending = [];
    const state = this.state;
    const endsAt = this.endsAt;
    this.saving = this.saving.then(async () => {
      if (records.length === 0 && !force) return;
      try {
        await this.persistence.save(state.id, records, state, endsAt);
        this.metrics.lastSavedAt = new Date(this.now());
      } catch (error) {
        // Keep the records so the next save retries them, in order.
        this.pending = [...records, ...this.pending];
        this.logger.error({ err: error }, "game save failed");
      }
    });
    return this.saving;
  }

  /** Stops the clock and saves; used on shutdown. */
  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    await this.flush();
  }
}
