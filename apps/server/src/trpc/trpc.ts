import { initTRPC, TRPCError } from "@trpc/server";
import type { Role } from "../auth/roles.ts";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Context {
  user: SessionUser | null;
}

export const SSE_PING_INTERVAL_MS = 15_000;
/** Bun.serve idle timeout; must stay above the ping interval or Bun cuts idle streams. */
export const SSE_IDLE_TIMEOUT_SECONDS = 60;

const t = initTRPC.context<Context>().create({
  // Keep SSE connections alive through proxies; the client reconnects if pings stop (S9).
  sse: {
    ping: { enabled: true, intervalMs: SSE_PING_INTERVAL_MS },
    client: { reconnectAfterInactivityMs: 20_000 },
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

export const publicProcedure = t.procedure;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "Connexion requise." });
  return next({ ctx: { user: ctx.user } });
});

export const organizerProcedure = authedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "organizer") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Réservé à l'organisateur." });
  }
  return next({ ctx });
});
