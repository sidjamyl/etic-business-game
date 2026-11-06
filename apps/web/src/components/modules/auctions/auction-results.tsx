import { Link } from "@tanstack/react-router";
import { ArrowRight, CircleMinus, CircleSlash, type LucideIcon, Trophy, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  type AuctionOutcome,
  type AuctionView,
  auctionOutcome,
  rewardFollowUp,
} from "./auction-math";

type PillTone = "success" | "muted";

const toneClass: Record<PillTone, string> = {
  success: "bg-success/12 text-success",
  muted: "bg-muted text-muted-foreground",
};

/** A short result with its icon: the meaning never rests on colour alone (D1). */
function OutcomePill({
  tone,
  icon: Icon,
  children,
}: {
  tone: PillTone;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

const outcomes: Record<
  AuctionOutcome,
  { tone: PillTone; icon: LucideIcon; label: string; note: (auction: AuctionView) => string | null }
> = {
  won: {
    tone: "success",
    icon: Trophy,
    label: "Remportée !",
    note: (auction) => (auction.myBid === null ? null : `${credits(auction.myBid)} payés`),
  },
  lost: {
    tone: "muted",
    icon: Undo2,
    label: "Perdue",
    note: () => "Offre rendue à la clôture",
  },
  cancelled: {
    tone: "muted",
    icon: CircleSlash,
    label: "Annulée",
    note: (auction) =>
      auction.myBid === null
        ? "Partie terminée avant la clôture"
        : "Partie terminée avant la clôture : offre rendue",
  },
  unsold: {
    tone: "muted",
    icon: CircleSlash,
    label: "Sans preneur",
    note: () => "Aucune offre : lot retiré",
  },
  "no-bid": {
    tone: "muted",
    icon: CircleMinus,
    label: "Pas d'offre",
    note: () => null,
  },
};

function ResultRow({ auction, outcome }: { auction: AuctionView; outcome: AuctionOutcome }) {
  const { tone, icon, label, note } = outcomes[outcome];
  const detail = note(auction);
  const followUp = outcome === "won" ? rewardFollowUp(auction.id) : null;
  return (
    <TableRow className={cn(outcome === "won" && "bg-success/5 hover:bg-success/10")}>
      <TableCell className="py-3 whitespace-normal">
        <div className="max-w-sm">
          <p className="font-medium">{auction.title}</p>
          {auction.description ? (
            <p className="text-xs text-pretty text-muted-foreground">{auction.description}</p>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="tabular">Fin du jour {auction.closesDay}</TableCell>
      <TableCell>
        {auction.winner === null ? (
          <span className="text-muted-foreground">Aucun</span>
        ) : (
          <>
            <span className="font-medium">{auction.winner}</span>
            {auction.wonByMe ? <span className="text-muted-foreground"> (vous)</span> : null}
          </>
        )}
      </TableCell>
      <TableCell className="tabular text-right">
        {auction.myBid === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          credits(auction.myBid)
        )}
      </TableCell>
      <TableCell className="py-3 whitespace-normal">
        <div className="grid gap-1">
          <OutcomePill tone={tone} icon={icon}>
            {label}
          </OutcomePill>
          {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
          {followUp ? (
            <p className="text-xs">
              {followUp.text}{" "}
              <Link
                to={followUp.to}
                className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2"
              >
                {followUp.label}
                <ArrowRight className="size-3" aria-hidden />
              </Link>
            </p>
          ) : null}
        </div>
      </TableCell>
    </TableRow>
  );
}

/**
 * Closed auctions (stories 79–81): the winner's name only, never the other companies'
 * amounts; the team's own bid, paid when won and returned otherwise.
 */
export function AuctionResults({ auctions }: { auctions: readonly AuctionView[] }) {
  const { clock } = useView();
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Résultats</CardTitle>
        <CardDescription>
          Le nom du gagnant est annoncé, jamais le montant de son offre. Les offres perdantes sont
          rendues à la clôture.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Lot</TableHead>
              <TableHead>Clôture</TableHead>
              <TableHead>Gagnant</TableHead>
              <TableHead className="text-right">Votre offre</TableHead>
              <TableHead>Résultat</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auctions.map((auction) => (
              <ResultRow
                key={auction.id}
                auction={auction}
                outcome={auctionOutcome(auction, clock)}
              />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
