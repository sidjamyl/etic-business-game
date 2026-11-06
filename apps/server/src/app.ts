import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import type { Logger } from "./logger.ts";
import { serveWebApp } from "./static.ts";
import type { AppRouter } from "./trpc/router.ts";
import type { Context } from "./trpc/trpc.ts";

export interface AppDeps {
  logger: Logger;
  /** Returns true when the database answers. */
  pingDatabase: () => Promise<boolean>;
  /** Better Auth request handler, mounted on /api/auth/*. */
  authHandler: (request: Request) => Promise<Response>;
  /** Builds the tRPC context (session and role) from the request headers. */
  createContext: (headers: Headers) => Promise<Context>;
  router: AppRouter;
  /** Built web app to serve (production); omitted in development and tests. */
  webDist?: string;
}

export function createApp({
  logger,
  pingDatabase,
  authHandler,
  createContext,
  router,
  webDist,
}: AppDeps) {
  const app = new Hono();

  app.get("/health", async (c) => {
    const database = (await pingDatabase()) ? "up" : "down";
    const status = database === "up" ? "ok" : "degraded";
    return c.json({ status, database }, database === "up" ? 200 : 503);
  });

  app.on(["GET", "POST"], "/api/auth/*", (c) => authHandler(c.req.raw));

  app.all("/api/trpc/*", (c) =>
    fetchRequestHandler({
      endpoint: "/api/trpc",
      req: c.req.raw,
      router,
      createContext: ({ req }) => createContext(req.headers),
      onError: ({ error, path }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error({ err: error, path }, "trpc error");
        }
      },
    }),
  );

  if (webDist && serveWebApp(app, webDist)) logger.info({ webDist }, "serving web app");

  app.onError((error, c) => {
    logger.error({ err: error, path: c.req.path }, "unhandled error");
    return c.json({ error: "internal_error" }, 500);
  });

  return app;
}
