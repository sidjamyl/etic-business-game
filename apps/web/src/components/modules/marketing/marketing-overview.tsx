import { availableCash } from "@etic/engine";
import { StatCard } from "@/components/game/stat-card";
import { credits, formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import { activeCampaigns, boostLabel, offersOf, reaches } from "./marketing-math";

/** Key figures: campaigns in progress, offers they boost, cash to pay, money spent so far. */
export function MarketingOverview() {
  const { team, clock } = useView();
  const campaigns = activeCampaigns(team.campaigns, clock.time.day);
  const offers = offersOf(team.prices);
  const boosted = offers.filter((pair) => campaigns.some((campaign) => reaches(campaign, pair)));
  const next = campaigns[0];
  // Expenses are recorded as negative amounts (N12).
  const spent = -(team.finance.totals.marketing ?? 0);
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label="Campagnes en cours"
        value={formatNumber(campaigns.length)}
        hint={next ? `Prochaine fin : jour ${next.endDay}` : "Aucune pour l'instant"}
      />
      <StatCard
        label="Offres soutenues"
        info="attractiveness"
        value={offers.length === 0 ? "—" : `${boosted.length} / ${offers.length}`}
        hint={
          offers.length === 0
            ? "Aucun prix fixé dans Ventes"
            : `Produits en vente, région par région, à ${boostLabel()} d'attractivité`
        }
      />
      <StatCard
        label="Trésorerie disponible"
        info="availableCash"
        value={credits(availableCash(team))}
        hint={
          team.reservedCash > 0
            ? `${credits(team.reservedCash)} bloqués par vos enchères`
            : undefined
        }
      />
      <StatCard
        label="Dépensé en marketing"
        value={credits(spent)}
        hint="Depuis le début de la partie"
      />
    </div>
  );
}
