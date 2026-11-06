import type { GameState } from "@etic/engine";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { user } from "./auth-schema.ts";

/** One game. `state` is the latest snapshot; the journal holds everything applied since. */
export const game = pgTable("game", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  status: text("status").notNull(),
  msPerDay: integer("ms_per_day").notNull(),
  /** Wall-clock end chosen by the organizer; converted to an end day by the runtime. */
  endsAt: timestamp("ends_at", { withTimezone: true }),
  state: jsonb("state").$type<GameState>().notNull(),
  createdBy: text("created_by").references(() => user.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

/**
 * Command log and replay journal (S10, S13). Accepted commands and steps carry a `seq`
 * (the state's journalSeq after applying them); refused commands are kept for auditing with a
 * null `seq` and are never replayed.
 */
export const gameJournal = pgTable(
  "game_journal",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => game.id, { onDelete: "cascade" }),
    seq: integer("seq"),
    kind: text("kind").$type<"command" | "step">().notNull(),
    actor: jsonb("actor"),
    userId: text("user_id"),
    teamId: text("team_id"),
    commandType: text("command_type"),
    payload: jsonb("payload"),
    ok: boolean("ok").notNull(),
    refusalCode: text("refusal_code"),
    day: integer("day").notNull(),
    step: integer("step").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("game_journal_game_seq_idx").on(t.gameId, t.seq)],
);
