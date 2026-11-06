import { parseEnv } from "../env.ts";
import { runMigrations } from "./migrate.ts";

const env = parseEnv(process.env);
await runMigrations(env.DATABASE_URL);
console.log("Migrations applied.");
