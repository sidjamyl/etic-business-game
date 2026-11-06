import { fileURLToPath } from "node:url";
import { gameEngine } from "@etic/engine";
import { createApp } from "./app.ts";
import { createAuth, isGoogleEnabled } from "./auth/auth.ts";
import { createDatabase } from "./db/client.ts";
import { runMigrations } from "./db/migrate.ts";
import { parseEnv } from "./env.ts";
import { GameManager } from "./game/manager.ts";
import { createPgPersistence } from "./game/persistence.ts";
import { RateLimiter } from "./game/rate-limit.ts";
import { createLogger } from "./logger.ts";
import { createContextFactory } from "./trpc/context.ts";
import { createAppRouter } from "./trpc/router.ts";

let env: ReturnType<typeof parseEnv>;
try {
  env = parseEnv(process.env);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
const logger = createLogger(env);

await runMigrations(env.DATABASE_URL);
logger.info("database migrations applied");

const database = createDatabase(env.DATABASE_URL);
const auth = createAuth(database.db, env);
logger.info({ google: isGoogleEnabled(env) }, "auth configured");

const manager = new GameManager({
  engine: gameEngine,
  persistence: createPgPersistence(database.db),
  logger,
});
const restored = await manager.restore();
logger.info({ games: restored.length }, "games restored");

const app = createApp({
  logger,
  pingDatabase: database.ping,
  authHandler: auth.handler,
  createContext: createContextFactory(auth, env.ORGANIZER_EMAILS),
  router: createAppRouter({
    manager,
    limiter: new RateLimiter(),
    publicConfig: { google: isGoogleEnabled(env) },
  }),
  // Production serves the built web app; in development Vite serves it (port 5173).
  ...(env.WEB_DIST || env.NODE_ENV === "production"
    ? { webDist: env.WEB_DIST ?? fileURLToPath(new URL("../../web/dist", import.meta.url)) }
    : {}),
});

const server = Bun.serve({ port: env.PORT, fetch: app.fetch });
logger.info({ port: server.port }, "server listening");

async function shutdown(signal: string) {
  logger.info({ signal }, "shutting down");
  await server.stop();
  await manager.stopAll();
  await database.close();
  process.exit(0);
}
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
