import { productById, products, scenarioEvents, scenarioNews } from "@etic/content";
import { demoFilm } from "../../../../packages/content/src/demo-film.ts";
import {
  type Actor,
  type Command,
  computeRanking,
  availableStock,
  type GameState,
  gameEngine,
  seedRng,
  localPrice,
} from "@etic/engine";
import { botProfiles, botTurn } from "../../../../packages/engine/src/sim/bots.ts";

/** Apply the approved fictional incident only inside the dedicated film process. */
export function applyFilmContent() {
  for (const override of demoFilm.news) {
    const item = scenarioNews.find((news) => news.id === override.id);
    if (!item) throw new Error(`Actualité absente : ${override.id}`);
    Object.assign(item, { title: override.title, body: override.body });
  }
  const event = scenarioEvents.find((item) => item.id === demoFilm.event.id);
  if (!event) throw new Error("Événement absent.");
  event.title = demoFilm.event.title;
}

export const filmOrganizer: Actor = {
  kind: "organizer",
  userId: "film-organizer",
  name: "Organisation ETIC",
};

export function prepareFilm() {
  applyFilmContent();
  const profiles = demoFilm.profiles.map(({base, region}) => ({...botProfiles[base]!, region}));
  let state = gameEngine.createGame({
    id: "etic-demo-film",
    seed: demoFilm.seed,
    config: { stepsPerDay: 4, countdownDays: 30 },
    endDay: demoFilm.endDay,
    teams: profiles.map((_, index) => ({
      id: `t${index + 1}`,
      name: demoFilm.companyNames[index] ?? "Entreprise",
      members: [{ userId: `film-player-${index + 1}`, name: index === 0 ? "Stonks" : "Équipe" }],
    })),
  });
  const actors: Actor[] = profiles.map((_, index) => ({
    kind: "team",
    teamId: `t${index + 1}`,
    userId: `film-player-${index + 1}`,
    name: index === 0 ? "Stonks" : "Équipe",
  }));
  const apply = (actor: Actor, command: Command) => {
    const result = gameEngine.applyCommand(state, actor, command);
    if (!result.ok) throw new Error(`${command.type} : ${result.refusal.message}`);
    state = result.state;
  };
  profiles.forEach((profile, index) => {
    const actor = actors[index];
    if (!actor) throw new Error("Équipe absente.");
    apply(actor, {
      type: "lobby.setCompanyName",
      payload: { companyName: demoFilm.companyNames[index] },
    });
    apply(actor, { type: "lobby.chooseRegion", payload: { region: profile.region } });
  });
  apply(filmOrganizer, { type: "control.start" });
  const rng = seedRng(demoFilm.seed);
  while (state.time.day < demoFilm.startDay) {
    if (state.time.step === 0) {
      profiles.forEach((profile, index) => {
        const actor = actors[index];
        if (!actor) return;
        for (const command of botTurn(state, `t${index + 1}`, profile, rng)) {
          if (command.type.startsWith("card.")) continue;
          const result = gameEngine.applyCommand(state, actor, command);
          if (result.ok) state = result.state;
        }
      });
    }
    state = gameEngine.step(state);
  }
  return { state, actors, apply, current: () => state, replace: (next: GameState) => { state = next; } };
}

export function createFilmScenes() {
  const film = prepareFilm();
  const scenes: Record<string, GameState> = {};
  const save = (name: string) => { scenes[name] = structuredClone(film.current()); };
  const hero = film.actors[0]!;
  const rival = film.actors[1]!;
  const step = () => film.replace(gameEngine.step(film.current()));
  const until = (day: number, substep = 0) => {
    while (film.current().status === "running" &&
      (film.current().time.day < day || film.current().time.step < substep)) step();
  };
  save("overview");
  film.apply(hero, { type: "marketing.launch", payload: {region: null, productId: null, days: demoFilm.marketingDays} });
  for (const product of products) {
    for (const actor of [hero,rival]) film.apply(actor, { type: "sales.setAutoAccept", payload: {productId: product.id, enabled: false} });
  }
  save("incident");
  until(200,3);
  const buyer = film.current().teams.t1!;
  const seller = film.current().teams.t2!;
  const order = Object.values(buyer.orders).find((candidate) =>
    candidate.status === "pending" && candidate.region === buyer.region &&
    candidate.expiresOnDay >= 201 && availableStock(buyer,candidate.productId) < candidate.quantity &&
    availableStock(seller,candidate.productId) >= candidate.quantity);
  if (!order) throw new Error("Aucune commande locale compatible avec le dépannage.");
  const price = Math.round(localPrice(buyer.region!,order.productId) * order.quantity * demoFilm.tradePriceFactor);
  film.apply({...rival, name:"Alliance"}, {type:"trade.offer",payload:{
    buyerTeamId:"t1",good:{kind:"item",item:order.productId,quantity:order.quantity},
    price,option:"express",shippingPaidBy:"buyer",
  }});
  const offer = Object.values(film.current().trades.offers).at(-1)!;
  save("offer");
  film.apply({...hero,name:"Trade Offer"},{type:"trade.accept",payload:{offerId:offer.id}});
  save("agreement");
  until(201);
  save("received");
  film.apply({...hero,name:"Trade Offer"},{type:"sales.acceptOrder",payload:{orderId:order.id}});
  save("accepted");
  film.apply({...hero,name:"Trade Offer"},{type:"delivery.ship",payload:{orderId:order.id,option:"standard"}});
  step();
  save("shipment");
  const employeeIds = Object.values(film.current().teams.t1!.employees).filter((employee)=>employee.arrivesOnDay<=201).map((employee)=>employee.id);
  film.apply({...hero,name:"GigaChad"},{type:"hr.raise",payload:{employeeIds,percent:demoFilm.raisePercent}});
  save("salary");
  until(202);
  save("paid");
  until(202,3);
  save("recovery");
  step();
  if (film.current().status !== "ended") throw new Error("La partie devrait être terminée.");
  save("ended");
  for (let place=4;place>=1;place--) {
    film.apply(filmOrganizer,{type:"control.revealNext"});
    save(`rank-${place}`);
  }
  film.apply(filmOrganizer,{type:"control.showBreakdown"});
  save("results");
  const ranking = computeRanking(film.current());
  const report = {seed:demoFilm.seed,orderId:order.id,product:productById.get(order.productId)?.name,
    quantity:order.quantity,tradePrice:price,customerPayment:order.quantity*order.unitPrice,
    initialCash:scenes.overview!.teams.t1!.cash,finalCash:film.current().teams.t1!.cash,
    ranking,scenes:Object.keys(scenes)};
  return { scenes, report };
}

if (import.meta.main) {
  console.log(JSON.stringify(createFilmScenes().report,null,2));
}
