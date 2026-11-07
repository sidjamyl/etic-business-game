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

/**
 * Better Auth limits requests per IP in production, and by default allows only 3 sign-ins
 * or sign-ups per 10 s. On game day the whole room shares the venue's public IP, so the
 * limits are sized for a crowd arriving at once (about one attempt per second per IP).
 */
export const AUTH_RATE_LIMIT = {
  window: 10,
  max: 300,
  customRules: {
    "/sign-in/*": { window: 60, max: 60 },
    "/sign-up/*": { window: 60, max: 60 },
  },
};

export function usesHttps(appUrl: string): boolean {
  return new URL(appUrl).protocol === "https:";
}

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
    rateLimit: AUTH_RATE_LIMIT,
    // Secure cookies follow the public URL: the local fallback is served over plain HTTP
    // on the LAN, where browsers would drop `Secure` cookies and nobody could sign in.
    advanced: { useSecureCookies: usesHttps(env.APP_URL) },
    telemetry: { enabled: false },
  });
}

export type Auth = ReturnType<typeof createAuth>;
