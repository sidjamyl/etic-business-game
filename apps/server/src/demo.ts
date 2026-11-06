import { randomUUID } from "node:crypto";
import { materials } from "@etic/content";
import { type Actor, type Command, gameEngine, seedRng } from "@etic/engine";
import { eq } from "drizzle-orm";
import { botProfiles, botTurn } from "../../../packages/engine/src/sim/bots.ts";
import { createAuth } from "./auth/auth.ts";
import { createDatabase } from "./db/client.ts";
import { runMigrations } from "./db/migrate.ts";
import { game, user } from "./db/schema.ts";
import { parseEnv } from "./env.ts";
import { createPgPersistence } from "./game/persistence.ts";

/** Local demonstration only. Real games and real users are never reset. */
if (process.env.NODE_ENV === "production")
  throw new Error("La démo est réservée au développement local.");
const env = parseEnv(process.env);
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(new URL(env.DATABASE_URL).hostname)) {
  throw new Error("La démo nécessite une base PostgreSQL locale.");
}
const password = process.env.DEMO_PASSWORD ?? "DemoETIC2026!";
const organizerEmail = "demo.organisateur@etic.local";
process.env.ORGANIZER_EMAILS = [...env.ORGANIZER_EMAILS, organizerEmail].join(",");
process.env.APP_URL = "http://localhost:5173";
process.env.PORT = "3000";
await runMigrations(env.DATABASE_URL);
const database = createDatabase(env.DATABASE_URL);

try {
  const auth = createAuth(database.db, { ...env, APP_URL: process.env.APP_URL });
  async function account(email: string, name: string) {
    const [existing] = await database.db.select().from(user).where(eq(user.email, email));
    if (existing) {
      // Check the documented password without ever changing an existing credential.
      await auth.api.signInEmail({ body: { email, password } });
      return existing;
    }
    return (await auth.api.signUpEmail({ body: { email, password, name } })).user;
  }
  const organizer = await account(organizerEmail, "Organisation démo");
  const players = await Promise.all(
    botProfiles.map((_, index) =>
      account(`demo.equipe${index + 1}@etic.local`, `Équipe ${index + 1}`),
    ),
  );
  const organizerActor: Actor = { kind: "organizer", userId: organizer.id, name: organizer.name };
  // Finish previous runs owned by the dedicated demo account. Keep their history in the DB.
  const previous = await database.db.select().from(game).where(eq(game.createdBy, organizer.id));
  for (const row of previous) {
    if (!row.name.startsWith("Démo ETIC") || row.state.status === "ended") continue;
    const result = gameEngine.applyCommand(row.state, organizerActor, { type: "control.end" });
    if (!result.ok) throw new Error(result.refusal.message);
    await database.db
      .update(game)
      .set({ status: "ended", state: result.state })
      .where(eq(game.id, row.id));
  }
  const names = ["Les Fourneaux", "Azura Industries", "Port & Compagnie", "Nord Éthique"];
  const id = randomUUID();
  let state = gameEngine.createGame({
    id,
    seed: "etic-demo-v1",
    config: { stepsPerDay: 4, countdownDays: 30 },
    endDay: 161,
    teams: players.map((player, index) => ({
      id: `t${index + 1}`,
      name: `Équipe ${index + 1}`,
      joinCode: `DEMO-0${index + 1}`,
      members: [{ userId: player.id, name: player.name }],
    })),
  });
  const actors = players.map(
    (player, index): Actor => ({
      kind: "team",
      teamId: `t${index + 1}`,
      userId: player.id,
      name: player.name,
    }),
  );
  function apply(actor: Actor, command: Command) {
    const result = gameEngine.applyCommand(state, actor, command);
    if (!result.ok) throw new Error(`${command.type} : ${result.refusal.message}`);
    state = result.state;
  }
  botProfiles.forEach((profile, index) => {
    const actor = actors[index];
    if (!actor) throw new Error("Équipe de démo absente.");
    apply(actor, { type: "lobby.setCompanyName", payload: { companyName: names[index] } });
    apply(actor, { type: "lobby.chooseRegion", payload: { region: profile.region } });
  });
  apply(organizerActor, { type: "control.start" });
  const rng = seedRng("etic-demo-bots-v1");
  console.log("Préparation de quatre entreprises jusqu'au jour 131…");
  while (state.time.day < 131) {
    if (state.time.step === 0)
      botProfiles.forEach((profile, index) => {
        const actor = actors[index];
        if (!actor) return;
        for (const command of botTurn(state, `t${index + 1}`, profile, rng)) {
          // Keep the cards in hand so their activation can be demonstrated live.
          if (command.type.startsWith("card.")) continue;
          const result = gameEngine.applyCommand(state, actor, command);
          if (result.ok) state = result.state;
        }
      });
    state = gameEngine.step(state);
  }
  for (const index of [0, 1]) {
    const team = state.teams[`t${index + 1}`];
    const actor = actors[index];
    if (!team || !actor) continue;
    const material = materials.find((item) => (team.inventory[item.id] ?? 0) >= 5);
    if (material)
      apply(actor, {
        type: "trade.offer",
        payload: {
          buyerTeamId: index === 0 ? "t2" : "t1",
          good: { kind: "item", item: material.id, quantity: 5 },
          price: 50,
          option: "standard",
          shippingPaidBy: "buyer",
        },
      });
  }
  apply(organizerActor, { type: "control.pause" });
  await createPgPersistence(database.db).insertGame(
    {
      id,
      name: "Démo ETIC — quatre trajectoires",
      msPerDay: 10_000,
      endsAt: null,
      createdBy: organizer.id,
    },
    state,
  );
  console.log(`\nDémo prête, en pause au jour ${state.time.day}.\n`);
  console.log("Connexion : http://localhost:5173");
  console.log(`Organisation : ${organizerEmail}`);
  console.log("Participants : demo.equipe1@etic.local à demo.equipe4@etic.local");
  console.log(`Mot de passe des comptes de démo : ${password}`);
  console.log(`Projecteur : http://localhost:5173/screen/${id}`);
  console.log(
    "Depuis la salle de contrôle : Reprendre, puis Clôturer et Révéler pour montrer la fin.\n",
  );
} finally {
  await database.close();
}

// Reuse an existing Vite instance; otherwise start it beside the API on the documented port.
const viteRunning = await fetch("http://localhost:5173/@vite/client")
  .then((response) => response.ok)
  .catch(() => false);
const web = viteRunning
  ? null
  : Bun.spawn(["bun", "run", "--filter", "@etic/web", "dev", "--port", "5173", "--strictPort"], {
      stdout: "inherit",
      stderr: "inherit",
    });
if (web) {
  process.on("exit", () => web.kill());
  void web.exited.then((code) => {
    if (code !== 0) {
      console.error("Le serveur web s'est arrêté.");
      process.exit(code);
    }
  });
}
await import("./index.ts");
