import { blackMarketRules } from "@etic/content";
import { Anchor } from "lucide-react";
import { PageHeader } from "@/components/game/page-header";
import { Badge } from "@/components/ui/badge";
import { useView } from "@/lib/game";
import { BuyOffers } from "./buy-offers";
import { CompetitorDossiers } from "./dossiers";
import { BanBanner, BlackMarketStats } from "./overview";
import { RiskPanel } from "./risk-panel";
import { SanctionsCard } from "./sanctions-card";
import { SellOffers } from "./sell-offers";

/**
 * Black market (#38, R13, N17, stories 82–89): buying and selling off the books within visible
 * limits, the risks taken, the sanctions received, private investigations and public
 * accusations. The only module in a dark theme, to mark the change of universe (DESIGN.md §6).
 */
export function BlackMarketPage() {
  const view = useView();
  const bannedUntil = view.blackMarket.bannedUntilDay;
  const portLibre = view.team.region === "port-libre";
  return (
    // Full bleed over the main padding: the dark area fills the whole content column.
    <div className="dark -m-6 min-h-[calc(100%+3rem)] bg-background p-6 text-foreground">
      <div className="space-y-6">
        <PageHeader
          eyebrow="Marché noir"
          title="Sous le manteau"
          description={`Achetez moins cher, vendez plus cher, réglé comptant. Mais chaque affaire laisse une trace pendant ${blackMarketRules.traceDays} jours : vos concurrents peuvent enquêter… et vous accuser.`}
          actions={
            portLibre ? (
              <Badge variant="secondary" className="gap-1.5 px-3 py-1 text-sm">
                <Anchor aria-hidden />
                Port-Libre : accès élargi
              </Badge>
            ) : undefined
          }
        />
        {bannedUntil !== null ? (
          <BanBanner until={bannedUntil} today={view.clock.time.day} />
        ) : null}
        <BlackMarketStats />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-6">
            <BuyOffers />
            <SellOffers />
          </div>
          <div className="space-y-6">
            <RiskPanel />
            <SanctionsCard />
          </div>
        </div>
        <CompetitorDossiers />
      </div>
    </div>
  );
}
