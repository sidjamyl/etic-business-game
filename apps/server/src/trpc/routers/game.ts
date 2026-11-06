import { timingRules } from "@etic/content";
import {
  type Actor,
  type CommandResult,
  computeRanking,
  isTeamReady,
  teamOfUser,
} from "@etic/engine";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import type { GameManager } from "../../game/manager.ts";
import type { RateLimiter } from "../../game/rate-limit.ts";
import type { GameRuntime } from "../../game/runtime.ts";
import { authedProcedure, organizerProcedure, publicProcedure, router } from "../trpc.ts";

export interface GameRouterDeps {
  manager: GameManager;
  limiter: RateLimiter;
}

const gameInput = z.object({ gameId: z.string().min(1) });

const createGameInput = z.object({
  name: z.string().trim().min(1).max(80),
  teamNames: z.array(z.string().trim().min(1).max(40)).min(2).max(12),
  memberCap: z.int().min(1).max(20).optional(),
  /** Rehearsal mode (P10): faster clock and fixed duration. */
  msPerDay: z.int().min(1_000).max(timingRules.msPerDay).optional(),
  durationDays: z.int().min(1).max(2_000).optional(),
});

function toResponse(result: CommandResult) {
  return result.ok ? { ok: true as const } : { ok: false as const, refusal: result.refusal };
}
const commandInput = gameInput.extend({
  command: z.object({ type: z.string().min(1).max(64), payload: z.unknown().optional() }),
});

function requireGame(manager: GameManager, gameId: string): GameRuntime {
  const runtime = manager.get(gameId);
  if (!runtime) throw new TRPCError({ code: "NOT_FOUND", message: "Partie introuvable." });
  return runtime;
}

function requireTeam(runtime: GameRuntime, userId: string): string {
  const teamId = teamOfUser(runtime.snapshot, userId);
  if (!teamId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Vous ne faites pas partie de cette partie.",
    });
  }
  return teamId;
}

export function createGameRouter({ manager, limiter }: GameRouterDeps) {
  const limited = authedProcedure.use(({ ctx, next }) => {
    if (!limiter.take(ctx.user.id)) {
      throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Trop d'actions, ralentissez." });
    }
    return next();
  });

  const organizerActor = (user: { id: string; name: string }): Actor => ({
    kind: "organizer",
    userId: user.id,
    name: user.name,
  });

  return {
    game: router({
      /** The member's team view, then deltas (S9). */
      stream: authedProcedure.input(gameInput).subscription(async function* ({
        input,
        ctx,
        signal,
      }) {
        const runtime = requireGame(manager, input.gameId);
        const teamId = requireTeam(runtime, ctx.user.id);
        yield* runtime.streamTeam(teamId, ctx.user.id, signal);
      }),

      /** A team decision. Game-rule refusals come back as data, with a French message. */
      command: limited.input(commandInput).mutation(({ input, ctx }) => {
        const runtime = requireGame(manager, input.gameId);
        const teamId = requireTeam(runtime, ctx.user.id);
        const result = runtime.submit(
          { kind: "team", teamId, userId: ctx.user.id, name: ctx.user.name },
          input.command,
        );
        return toResponse(result);
      }),

      /** Joins a team with its code (P7). Open during the whole game (N6). */
      join: limited
        .input(z.object({ code: z.string().trim().min(1).max(32) }))
        .mutation(({ input, ctx }) => {
          const found = manager.findByJoinCode(input.code);
          if (!found) throw new TRPCError({ code: "NOT_FOUND", message: "Code invalide." });
          const result = found.runtime.submit(
            { kind: "player", userId: ctx.user.id, name: ctx.user.name },
            { type: "lobby.join", payload: { teamId: found.teamId } },
          );
          if (!result.ok) return { ok: false as const, refusal: result.refusal };
          return { ok: true as const, gameId: found.runtime.id, teamId: found.teamId };
        }),

      /** Unfinished games the user plays in, most recent activity first. */
      current: authedProcedure.query(({ ctx }) =>
        manager
          .list()
          .filter((runtime) => runtime.snapshot.status !== "ended")
          .flatMap((runtime) => {
            const teamId = teamOfUser(runtime.snapshot, ctx.user.id);
            return teamId
              ? [
                  {
                    gameId: runtime.id,
                    name: runtime.name,
                    teamId,
                    status: runtime.snapshot.status,
                  },
                ]
              : [];
          }),
      ),
    }),

    screen: router({
      /** Projector screen: public data only, no login (P10, story 126). */
      stream: publicProcedure.input(gameInput).subscription(async function* ({ input, signal }) {
        yield* requireGame(manager, input.gameId).streamPublic(signal);
      }),
    }),

    admin: router({
      games: organizerProcedure.query(() =>
        manager.list().map((runtime) => ({
          id: runtime.id,
          name: runtime.name,
          status: runtime.snapshot.status,
          time: runtime.snapshot.time,
          endDay: runtime.snapshot.endDay,
          msPerDay: runtime.msPerDay,
          metrics: runtime.metrics,
        })),
      ),

      control: organizerProcedure
        .input(
          gameInput.extend({
            action: z.enum(["start", "pause", "resume", "end", "revealNext", "showBreakdown"]),
          }),
        )
        .mutation(({ input, ctx }) => {
          const runtime = requireGame(manager, input.gameId);
          return toResponse(
            runtime.submit(organizerActor(ctx.user), { type: `control.${input.action}` }),
          );
        }),

      /** Control room: every company, ranking, events, auctions, trades, metrics (N22). */
      stream: organizerProcedure.input(gameInput).subscription(async function* ({ input, signal }) {
        yield* requireGame(manager, input.gameId).streamAdmin(signal);
      }),

      /** Live ranking, organizer only (P9); frozen results after the end. */
      ranking: organizerProcedure.input(gameInput).query(({ input }) => {
        const state = requireGame(manager, input.gameId).snapshot;
        return state.results?.ranking ?? computeRanking(state);
      }),

      /** Removes an inappropriate fake news item (R14). */
      deleteNews: organizerProcedure
        .input(gameInput.extend({ newsId: z.int() }))
        .mutation(({ input, ctx }) =>
          toResponse(
            requireGame(manager, input.gameId).submit(organizerActor(ctx.user), {
              type: "admin.deleteNews",
              payload: { newsId: input.newsId },
            }),
          ),
        ),

      setEndsAt: organizerProcedure
        .input(gameInput.extend({ endsAt: z.iso.datetime({ offset: true }).nullable() }))
        .mutation(({ input, ctx }) => {
          const runtime = requireGame(manager, input.gameId);
          const endsAt = input.endsAt ? new Date(input.endsAt) : null;
          return toResponse(runtime.setEndsAt(organizerActor(ctx.user), endsAt));
        }),

      createGame: organizerProcedure.input(createGameInput).mutation(async ({ input, ctx }) => {
        const runtime = await manager.create({
          name: input.name,
          teams: input.teamNames.map((name, index) => ({ id: `t${index + 1}`, name })),
          createdBy: ctx.user.id,
          ...(input.memberCap !== undefined ? { memberCap: input.memberCap } : {}),
          ...(input.msPerDay !== undefined ? { msPerDay: input.msPerDay } : {}),
          ...(input.durationDays !== undefined ? { durationDays: input.durationDays } : {}),
        });
        return { gameId: runtime.id };
      }),

      /** Lobby details for the organizer: codes, members, choices, readiness. */
      game: organizerProcedure.input(gameInput).query(({ input }) => {
        const runtime = requireGame(manager, input.gameId);
        const state = runtime.snapshot;
        return {
          id: runtime.id,
          name: runtime.name,
          status: state.status,
          memberCap: state.memberCap,
          msPerDay: runtime.msPerDay,
          endDay: state.endDay,
          time: state.time,
          teams: Object.values(state.teams).map((team) => ({
            id: team.id,
            name: team.name,
            joinCode: team.joinCode,
            companyName: team.companyName,
            region: team.region,
            members: Object.values(team.members),
            ready: isTeamReady(team),
          })),
        };
      }),

      moveMember: organizerProcedure
        .input(gameInput.extend({ userId: z.string().min(1), toTeamId: z.string().min(1) }))
        .mutation(({ input, ctx }) =>
          toResponse(
            requireGame(manager, input.gameId).submit(organizerActor(ctx.user), {
              type: "admin.moveMember",
              payload: { userId: input.userId, toTeamId: input.toTeamId },
            }),
          ),
        ),

      removeMember: organizerProcedure
        .input(gameInput.extend({ userId: z.string().min(1) }))
        .mutation(({ input, ctx }) =>
          toResponse(
            requireGame(manager, input.gameId).submit(organizerActor(ctx.user), {
              type: "admin.removeMember",
              payload: { userId: input.userId },
            }),
          ),
        ),

      setMemberCap: organizerProcedure
        .input(gameInput.extend({ memberCap: z.int().min(1).max(20) }))
        .mutation(({ input, ctx }) =>
          toResponse(
            requireGame(manager, input.gameId).submit(organizerActor(ctx.user), {
              type: "admin.setMemberCap",
              payload: { memberCap: input.memberCap },
            }),
          ),
        ),
    }),
  };
}
