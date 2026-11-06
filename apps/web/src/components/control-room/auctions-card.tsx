import type { ClockView } from "@etic/engine";
import { CalendarClock, CircleSlash, Crown, Gavel, type LucideIcon, Trophy } from "lucide-react";
import { useId } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { credits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyLine, Pill, type PillTone, SectionTitle, SubTitle } from "./bits";
import {
  type AdminAuction,
  type AdminCompanies,
  type AuctionOutcome,
  auctionOutcome,
  companyNameOf,
  rankedBids,
  sortAuctions,
  startingPrice,
  upcomingAuctions,
} from "./control-room-helpers";

const outcomeDisplay: Record<AuctionOutcome, { label: string; tone: PillTone; icon: LucideIcon }> =
  {
    open: { label: "Ouverte", tone: "success", icon: Gavel },
    won: { label: "Remportée", tone: "neutral", icon: Trophy },
    unsold: { label: "Sans preneur", tone: "neutral", icon: CircleSlash },
    cancelled: { label: "Annulée par la fin", tone: "neutral", icon: CircleSlash },
  };

/** One lot with every sealed bid, highest first (R12, N16). */
function AuctionBlock({
  auction,
  companies,
}: {
  auction: AdminAuction;
  companies: AdminCompanies;
}) {
  const titleId = useId();
  const outcome = auctionOutcome(auction);
  const display = outcomeDisplay[outcome];
  const bids = rankedBids(auction.bids);
  const price = startingPrice(auction.id);
  const winner = outcome === "won" ? auction.winnerTeamId : null;

  return (
    <article aria-labelledby={titleId} className="space-y-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 id={titleId} className="font-sans font-semibold text-pretty">
          {auction.title}
        </h3>
        <Pill tone={display.tone} icon={display.icon}>
          {display.label}
        </Pill>
      </div>
      <p className="tabular text-xs text-muted-foreground">
        {outcome === "open"
          ? `Offres jusqu'à la fin du jour ${auction.closesDay}`
          : `Jours ${auction.opensDay} à ${auction.closesDay}`}
        {price !== null ? ` · mise à prix ${credits(price)}` : ""}
        {outcome === "cancelled" ? " · offres rendues" : ""}
      </p>
      {bids.length === 0 ? (
        <EmptyLine>Aucune offre.</EmptyLine>
      ) : (
        <ol className="divide-y text-sm">
          {bids.map((bid, index) => {
            const leading = outcome === "open" && index === 0;
            const won = bid.teamId === winner;
            return (
              <li key={bid.teamId} className="flex items-center justify-between gap-3 py-1.5">
                <span className={cn("min-w-0 truncate", (leading || won) && "font-semibold")}>
                  {companyNameOf(companies, bid.teamId)}
                </span>
                <span className="inline-flex shrink-0 items-center gap-2">
                  {leading ? (
                    <Pill tone="success" icon={Crown}>
                      En tête
                    </Pill>
                  ) : null}
                  {won ? (
                    <Pill tone="success" icon={Trophy}>
                      Gagnante
                    </Pill>
                  ) : null}
                  <span className="tabular font-medium">{credits(bid.amount)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}

/** Auctions with all bids, for the organizer only: the teams only see their own (R12). */
export function AuctionsCard({
  auctions,
  companies,
  clock,
}: {
  auctions: readonly AdminAuction[];
  companies: AdminCompanies;
  clock: ClockView;
}) {
  const upcomingId = useId();
  const sorted = sortAuctions(auctions);
  const upcoming =
    clock.status === "ended" ? [] : upcomingAuctions(auctions.map((auction) => auction.id));

  return (
    <Card className="gap-4 py-5">
      <CardHeader className="px-5">
        <SectionTitle>Enchères</SectionTitle>
        <CardDescription>
          Toutes les offres scellées : chaque équipe ne voit que la sienne. Le gagnant est annoncé
          sans le montant.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-5">
        {sorted.length === 0 ? (
          <EmptyLine>Aucune enchère ouverte pour l'instant.</EmptyLine>
        ) : (
          sorted.map((auction) => (
            <AuctionBlock key={auction.id} auction={auction} companies={companies} />
          ))
        )}
        {upcoming.length > 0 ? (
          <section aria-labelledby={upcomingId} className="space-y-2">
            <SubTitle id={upcomingId}>À venir</SubTitle>
            <ul className="space-y-2">
              {upcoming.map((auction) => (
                <li key={auction.id} className="flex gap-2.5 text-sm">
                  <CalendarClock
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-pretty">{auction.title}</p>
                    <p className="tabular text-xs text-muted-foreground">
                      Ouverture au jour {auction.openDay} · mise à prix{" "}
                      {credits(auction.startingPrice)}
                      {clock.endDay !== null && auction.openDay > clock.endDay
                        ? " · après la fin prévue"
                        : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
