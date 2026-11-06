import type { Actor, Command, GameState, JournalEntry } from "@etic/engine";
import { and, asc, eq, gt, inArray, isNotNull } from "drizzle-orm";
import type { Database } from "../db/client.ts";
import { game, gameJournal } from "../db/schema.ts";

export interface JournalRecord {
  seq: number | null;
  kind: "command" | "step";
  actor?: Actor;
  command?: Command;
  ok: boolean;
  refusalCode?: string;
  day: number;
  step: number;
}

export interface StoredGame {
  id: string;
  name: string;
  msPerDay: number;
  endsAt: Date | null;
  state: GameState;
  /** Accepted journal entries recorded after the snapshot, to replay on load. */
  pending: JournalEntry[];
}

export interface GameMeta {
  id: string;
  name: string;
  msPerDay: number;
  endsAt: Date | null;
  createdBy: string | null;
}

/** Storage port of the game runtime: Postgres in production, memory in tests. */
export interface GamePersistence {
  insertGame(meta: GameMeta, state: GameState): Promise<void>;
  /** Appends journal records and replaces the snapshot, atomically. */
  save(
    gameId: string,
    records: JournalRecord[],
    state: GameState,
    endsAt: Date | null,
  ): Promise<void>;
  loadActive(): Promise<StoredGame[]>;
}

function toEntry(row: {
  kind: "command" | "step";
  actor: unknown;
  commandType: string | null;
  payload: unknown;
}): JournalEntry {
  if (row.kind === "step") return { kind: "step" };
  return {
    kind: "command",
    actor: row.actor as Actor,
    command: { type: row.commandType ?? "", payload: row.payload ?? undefined },
  };
}

export function createPgPersistence(db: Database): GamePersistence {
  return {
    async insertGame(meta, state) {
      await db.insert(game).values({ ...meta, status: state.status, state });
    },

    async save(gameId, records, state, endsAt) {
      await db.transaction(async (tx) => {
        if (records.length > 0) {
          await tx.insert(gameJournal).values(
            records.map((r) => ({
              gameId,
              seq: r.seq,
              kind: r.kind,
              actor: r.actor ?? null,
              userId: r.actor?.userId ?? null,
              teamId: r.actor?.kind === "team" ? r.actor.teamId : null,
              commandType: r.command?.type ?? null,
              payload: r.command?.payload ?? null,
              ok: r.ok,
              refusalCode: r.refusalCode ?? null,
              day: r.day,
              step: r.step,
            })),
          );
        }
        await tx
          .update(game)
          .set({ state, status: state.status, endsAt })
          .where(eq(game.id, gameId));
      });
    },

    async loadActive() {
      const rows = await db
        .select()
        .from(game)
        .where(inArray(game.status, ["lobby", "running", "paused"]));
      const result: StoredGame[] = [];
      for (const row of rows) {
        const pending = await db
          .select()
          .from(gameJournal)
          .where(
            and(
              eq(gameJournal.gameId, row.id),
              isNotNull(gameJournal.seq),
              gt(gameJournal.seq, row.state.journalSeq),
            ),
          )
          .orderBy(asc(gameJournal.seq));
        result.push({
          id: row.id,
          name: row.name,
          msPerDay: row.msPerDay,
          endsAt: row.endsAt,
          state: row.state,
          pending: pending.map(toEntry),
        });
      }
      return result;
    },
  };
}

/** In-memory implementation for tests. */
export function createMemoryPersistence() {
  const games = new Map<string, { meta: GameMeta; state: GameState; journal: JournalRecord[] }>();
  const persistence: GamePersistence = {
    async insertGame(meta, state) {
      games.set(meta.id, { meta, state: structuredClone(state), journal: [] });
    },
    async save(gameId, records, state, endsAt) {
      const stored = games.get(gameId);
      if (!stored) throw new Error(`unknown game ${gameId}`);
      stored.journal.push(...structuredClone(records));
      stored.state = structuredClone(state);
      stored.meta.endsAt = endsAt;
    },
    async loadActive() {
      return [...games.values()]
        .filter((g) => g.state.status !== "ended")
        .map((g) => ({
          ...g.meta,
          state: structuredClone(g.state),
          pending: g.journal
            .filter((r) => r.seq !== null && r.seq > g.state.journalSeq)
            .map((r) =>
              toEntry({
                kind: r.kind,
                actor: r.actor,
                commandType: r.command?.type ?? null,
                payload: r.command?.payload,
              }),
            ),
        }));
    },
  };
  return { persistence, games };
}
