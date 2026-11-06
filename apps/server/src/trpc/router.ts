import { createGameRouter, type GameRouterDeps } from "./routers/game.ts";
import { authedProcedure, router } from "./trpc.ts";

export type RouterDeps = GameRouterDeps;

export function createAppRouter(deps: RouterDeps) {
  return router({
    me: authedProcedure.query(({ ctx }) => ctx.user),
    ...createGameRouter(deps),
  });
}

/** Imported (type only) by the web app (S11). */
export type AppRouter = ReturnType<typeof createAppRouter>;
