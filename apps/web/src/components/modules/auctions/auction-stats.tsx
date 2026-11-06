import { availableCash } from "@etic/engine";
import { StatCard } from "@/components/game/stat-card";
import { credits, formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import { auctionTotals, plural } from "./auction-math";

/** Cash the team can still bid with, cash locked by its bids, lots won (N16, story 79). */
export function AuctionStats() {
  const view = useView();
  const { team } = view;
  const available = availableCash(team);
  const totals = auctionTotals(view.auctions);
  const won = totals.won.length;

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <StatCard
        label="Trésorerie disponible"
        value={credits(available)}
        info="availableCash"
        tone={available < 0 ? "danger" : "default"}
        hint={`Sur ${credits(team.cash)} de trésorerie`}
      />
      <StatCard
        label="Bloqué par vos offres"
        value={credits(team.reservedCash)}
        info="availableCash"
        hint={
          totals.openBids > 0
            ? `${plural(totals.openBids, "offre en cours", "offres en cours")} · rendu si vous perdez`
            : "Aucune offre en cours"
        }
      />
      <StatCard
        label="Enchères remportées"
        value={formatNumber(won)}
        tone={won > 0 ? "success" : "default"}
        hint={
          won > 0
            ? totals.won.map((auction) => auction.title).join(" · ")
            : totals.closed > 0
              ? `Sur ${plural(totals.closed, "enchère close", "enchères closes")}`
              : "Aucune enchère close pour l'instant"
        }
      />
    </div>
  );
}
