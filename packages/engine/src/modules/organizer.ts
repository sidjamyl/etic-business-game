import { scenarioAuctions, scenarioEvents } from "@etic/content";
import type { GameState } from "../types.ts";
import { clockView } from "../views.ts";
import { recentTraces } from "./black-market.ts";
import { isOnStrike } from "./hr.ts";
import { impactScores } from "./impact.ts";
import { computeRanking } from "./scoring.ts";
import { availableCash } from "./shared.ts";

const auctionTitle = new Map(scenarioAuctions.map((a) => [a.id, a.title]));

/** Everything the organizer sees in the control room (P8, N22). Never sent to players. */
export function adminView(state: GameState) {
  const companies = Object.fromEntries(
    Object.values(state.teams).map((team) => {
      const employees = Object.values(team.employees).filter(
        (e) => e.arrivesOnDay <= state.time.day,
      );
      const impact = impactScores(team);
      return [
        team.id,
        {
          id: team.id,
          name: team.name,
          companyName: team.companyName,
          region: team.region,
          members: Object.values(team.members).map((m) => m.name),
          cash: team.cash,
          availableCash: availableCash(team),
          debt: team.finance.debt,
          reputation: team.reputation,
          environmental: impact.environmental,
          social: impact.social,
          tier: team.progression.unlockedTier,
          branch: team.progression.branch,
          inventory: team.inventory,
          machines: Object.values(team.machines).map((m) => ({
            id: m.id,
            typeId: m.typeId,
            status: m.status,
            efficiency: m.efficiency,
          })),
          employees: {
            count: employees.length,
            averageEfficiency:
              employees.length === 0
                ? 0
                : Math.round(
                    (employees.reduce((s, e) => s + e.efficiency, 0) / employees.length) * 100,
                  ) / 100,
            onStrike: isOnStrike(team),
          },
          orders: {
            pending: Object.values(team.orders).filter((o) => o.status === "pending").length,
            accepted: Object.values(team.orders).filter((o) => o.status !== "pending").length,
          },
          blackMarket: {
            recentTraces: recentTraces(state, team).length,
            purchasedUnits: team.blackMarket.purchasedUnits,
            soldUnits: team.blackMarket.soldUnits,
            convictions: team.blackMarket.convictions,
          },
          card: team.card,
          revenue: team.stats.revenue,
        },
      ];
    }),
  );
  const upcoming = scenarioEvents
    .filter((event) => !state.scenario.done[event.id])
    .slice(0, 3)
    .map((event) => ({ id: event.id, title: event.title, day: event.day }));
  return {
    clock: clockView(state),
    companies,
    ranking: state.results?.ranking ?? computeRanking(state),
    results: state.results,
    events: { active: state.scenario.active, upcoming },
    auctions: Object.values(state.auctions).map((auction) => ({
      ...auction,
      title: auctionTitle.get(auction.id) ?? auction.id,
    })),
    trades: {
      offers: Object.values(state.trades.offers),
      shipments: Object.values(state.trades.shipments).map(({ machine: _m, ...rest }) => rest),
    },
    /** Fake news from secret cards, so the organizer can moderate them (R14). */
    cardNews: state.news
      .filter((news) => news.origin.kind === "card")
      .map((news) => ({
        id: news.id,
        day: news.day,
        title: news.title,
        body: news.body,
        teamId: news.origin.kind === "card" ? news.origin.teamId : null,
      })),
  };
}

export type AdminView = ReturnType<typeof adminView>;
