import { gameEngine } from "@etic/engine";
import { type AppDeps, createApp } from "./app.ts";
import { GameManager } from "./game/manager.ts";
import { createMemoryPersistence } from "./game/persistence.ts";
import { RateLimiter } from "./game/rate-limit.ts";
import { createLogger } from "./logger.ts";
import { createAppRouter } from "./trpc/router.ts";

export const silentLogger = createLogger({ LOG_LEVEL: "silent" });

export function memoryManager() {
  const memory = createMemoryPersistence();
  const manager = new GameManager({
    engine: gameEngine,
    persistence: memory.persistence,
    logger: silentLogger,
    saveDebounceMs: 0,
  });
  return { manager, memory };
}

/** Builds the app with harmless defaults; override only what a test needs. */
export function buildTestApp(overrides: Partial<AppDeps> = {}) {
  return createApp({
    logger: silentLogger,
    pingDatabase: async () => true,
    authHandler: async () => new Response(null, { status: 404 }),
    createContext: async () => ({ user: null }),
    router: createAppRouter({ manager: memoryManager().manager, limiter: new RateLimiter() }),
    ...overrides,
  });
}
