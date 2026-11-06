import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import type { Database } from "../db/client.ts";
import * as schema from "../db/schema.ts";
import type { Env } from "../env.ts";

const DAY = 60 * 60 * 24;

export type AuthEnv = Pick<
  Env,
  "NODE_ENV" | "APP_URL" | "BETTER_AUTH_SECRET" | "GOOGLE_CLIENT_ID" | "GOOGLE_CLIENT_SECRET"
>;

/** Google sign-in is enabled only when both credentials are configured (N3). */
export function isGoogleEnabled(env: AuthEnv): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

export function createAuth(db: Database, env: AuthEnv) {
  return betterAuth({
    baseURL: env.APP_URL,
    basePath: "/api/auth",
    secret: env.BETTER_AUTH_SECRET,
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(db, { provider: "pg", schema }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      requireEmailVerification: false,
      autoSignIn: true,
    },
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
              // Players are known by their first name in the game.
              mapProfileToUser: (profile) => ({ name: profile.given_name || profile.name }),
            },
          }
        : {},
    session: { expiresIn: 7 * DAY, updateAge: DAY },
    advanced: { useSecureCookies: env.NODE_ENV === "production" },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
