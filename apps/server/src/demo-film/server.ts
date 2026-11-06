import { fileURLToPath } from "node:url";
import { type GameState, gameEngine } from "@etic/engine";
import { eq } from "drizzle-orm";
import { createApp } from "../app.ts";
import { createAuth } from "../auth/auth.ts";
import { createDatabase } from "../db/client.ts";
import { user } from "../db/schema.ts";
import { parseEnv } from "../env.ts";
import { GameManager } from "../game/manager.ts";
import { createMemoryPersistence } from "../game/persistence.ts";
import { GameRuntime } from "../game/runtime.ts";
import { RateLimiter } from "../game/rate-limit.ts";
import { createLogger } from "../logger.ts";
import { createContextFactory } from "../trpc/context.ts";
import { createAppRouter } from "../trpc/router.ts";
import { createFilmScenes } from "./fixture.ts";

/** Local capture server. Frozen engine checkpoints, real UI and real authentication. */
if (process.env.NODE_ENV === "production") throw new Error("Film réservé au développement local.");
const env = parseEnv({...process.env,PORT:"3002",APP_URL:"http://localhost:3002"});
if (!["localhost","127.0.0.1","::1","[::1]"].includes(new URL(env.DATABASE_URL).hostname)) throw new Error("Base locale requise.");
const database = createDatabase(env.DATABASE_URL);
const auth = createAuth(database.db,env);
const logger = createLogger(env);
const password = process.env.DEMO_PASSWORD ?? "DemoETIC2026!";
const organizerEmail = "film.organisateur@etic.local";
async function account(email:string,name:string) {
  const [existing] = await database.db.select().from(user).where(eq(user.email,email));
  if (existing) { await auth.api.signInEmail({body:{email,password}});return existing; }
  return (await auth.api.signUpEmail({body:{email,password,name}})).user;
}
const player = await account("film.equipe@etic.local","Équipe Collectif");
await account(organizerEmail,"Organisation ETIC");
const {scenes,report} = createFilmScenes();
if (report.ranking[0]?.teamId!=="t2" || report.ranking[1]?.teamId!=="t1") throw new Error("Le classement ne correspond pas au récit validé.");
for (const state of Object.values(scenes)) {
  const team = state.teams.t1!;
  team.members = Object.fromEntries([
    {userId:player.id,name:player.name},
    {userId:"film-roll-safe",name:"Roll Safe"},
    {userId:"film-trade-offer",name:"Trade Offer"},
    {userId:"film-gigachad",name:"GigaChad"},
  ].map(member=>[member.userId,member]));
}
const {persistence} = createMemoryPersistence();
class FilmManager extends GameManager {
  active: GameRuntime | undefined;
  override get(id:string) { return this.active?.id===id ? this.active : undefined; }
  override list() { return this.active ? [this.active] : []; }
  async select(state:GameState) {
    await this.active?.stop();
    await persistence.insertGame({id:state.id,name:"Business Game — Rien ne se passe comme prévu",msPerDay:60_000,endsAt:null,createdBy:null},state);
    this.active = new GameRuntime(structuredClone(state),{engine:gameEngine,persistence,logger,name:"Business Game — Rien ne se passe comme prévu",msPerDay:60_000});
    // Freeze capture without changing the true engine state or painting a pause banner.
    await this.active.stop();
  }
}
const manager = new FilmManager({engine:gameEngine,persistence,logger});
await manager.select(scenes.overview!);
const app = createApp({
  logger,pingDatabase:database.ping,authHandler:auth.handler,
  createContext:createContextFactory(auth,[organizerEmail]),
  router:createAppRouter({manager,limiter:new RateLimiter(),publicConfig:{google:false}}),
  webDist:fileURLToPath(new URL("../../../web/dist",import.meta.url)),
});
const server = Bun.serve({hostname:"127.0.0.1",port:3002,fetch:async(request)=>{
  const path = new URL(request.url).pathname;
  if(path==="/__film/report") return Response.json(report);
  if(request.method==="POST" && path.startsWith("/__film/scene/")) {
    const scene = decodeURIComponent(path.slice("/__film/scene/".length));
    if(!scenes[scene]) return new Response("Scène inconnue",{status:404});
    await manager.select(scenes[scene]);
    return Response.json({scene,time:scenes[scene].time});
  }
  return app.fetch(request);
}});
console.log("Film : http://localhost:3002 — film.equipe@etic.local / film.organisateur@etic.local");
console.log(JSON.stringify(report,null,2));
process.on("SIGINT",async()=>{await manager.active?.stop();await server.stop();await database.close();process.exit(0);});
