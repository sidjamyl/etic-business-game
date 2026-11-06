import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Database = ReturnType<typeof createDatabase>["db"];

export function createDatabase(url: string) {
  const client = postgres(url, { max: 10, onnotice: () => {} });
  const db = drizzle(client, { schema });
  return {
    db,
    /** Resolves to false if the database does not answer within `timeoutMs`. */
    async ping(timeoutMs = 2_000): Promise<boolean> {
      const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), timeoutMs));
      const query = db.execute(sql`select 1`).then(
        () => true as const,
        () => false as const,
      );
      return Promise.race([query, timeout]);
    },
    close: () => client.end({ timeout: 5 }),
  };
}
