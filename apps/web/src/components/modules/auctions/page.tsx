import { Link } from "@tanstack/react-router";
import { Gavel, Newspaper } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { PageHeader } from "@/components/game/page-header";
import { Button } from "@/components/ui/button";
import { useView } from "@/lib/game";
import { splitAuctions } from "./auction-math";
import { AuctionResults } from "./auction-results";
import { AuctionRules } from "./auction-rules";
import { AuctionStats } from "./auction-stats";
import { OpenAuctionCard } from "./open-auction-card";

/** Upcoming auctions are never listed: players learn about them from the news (R11, R12). */
function NoOpenAuction({ ended, anyBefore }: { ended: boolean; anyBefore: boolean }) {
  if (ended) {
    return (
      <EmptyState icon={Gavel} title="Partie terminée">
        Plus aucune enchère ne sera ouverte.
      </EmptyState>
    );
  }
  return (
    <EmptyState
      icon={Gavel}
      title={anyBefore ? "Aucune enchère ouverte" : "Aucune enchère pour l'instant"}
    >
      Les enchères ne sont pas connues à l'avance : leur ouverture est annoncée dans les{" "}
      <Link to="/play/news" className="font-medium text-foreground underline">
        news
      </Link>
      , avec le lot, la mise à prix et la date de clôture. Elles ne restent ouvertes que quelques
      jours de jeu : soyez réactifs.
    </EmptyState>
  );
}

/**
 * Auctions (#37, R12, N16): open lots with the team's own sealed bid, bids that lock cash
 * until the close, then results and refunds (stories 77–81).
 */
export function AuctionsPage() {
  const view = useView();
  const { open, closed } = splitAuctions(view.auctions);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Enchères"
        title="Lots et offres"
        description="Des objets rares, mis en vente quelques jours seulement. Les offres sont secrètes et bloquent votre trésorerie jusqu'à la clôture."
        actions={
          <Button asChild variant="outline">
            <Link to="/play/news">
              <Newspaper aria-hidden />
              Lire les news
            </Link>
          </Button>
        }
      />
      <AuctionStats />
      <div className="grid items-start gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          {open.length > 0 ? (
            open.map((auction) => <OpenAuctionCard key={auction.id} auction={auction} />)
          ) : (
            <NoOpenAuction ended={view.clock.status === "ended"} anyBefore={closed.length > 0} />
          )}
        </div>
        <AuctionRules />
      </div>
      {closed.length > 0 ? <AuctionResults auctions={closed} /> : null}
    </div>
  );
}
