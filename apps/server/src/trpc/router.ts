import { createGameRouter, type GameRouterDeps } from "./routers/game.ts";
import { authedProcedure, publicProcedure, router } from "./trpc.ts";

export interface RouterDeps extends GameRouterDeps {
  /** What the sign-in page needs to know (N30); Google is off unless configured. */
  publicConfig?: { google: boolean };
}

export function createAppRouter(deps: RouterDeps) {
  const publicConfig = deps.publicConfig ?? { google: false };
  return router({
    /** Public settings for the sign-in page. */
    config: publicProcedure.query(() => publicConfig),
    /** The signed-in user, or null: used by route guards without raising errors. */
    session: publicProcedure.query(({ ctx }) => ctx.user),
    me: authedProcedure.query(({ ctx }) => ctx.user),
    ...createGameRouter(deps),
  });
}

/** Imported (type only) by the web app (S11). */
export type AppRouter = ReturnType<typeof createAppRouter>;
export type { AdminStreamView, StreamMessage } from "../game/runtime.ts";
