import type { Campaign, SimTime } from "@etic/engine";
import { Hourglass, Megaphone, TriangleAlert } from "lucide-react";
import { EmptyState } from "@/components/game/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { credits, percent, timeLeft } from "@/lib/format";
import { useGame, useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  activeCampaigns,
  campaignProgress,
  daysLeft,
  daysLeftLabel,
  daysUntilEnd,
  offersLabel,
  offersOf,
  type Pair,
  reaches,
  targetLabel,
} from "./marketing-math";

/** Campaigns in progress with their end day, the soonest to end first (story 72). */
export function ActiveCampaigns() {
  const { team, clock } = useView();
  const { msPerDay } = useGame();
  const campaigns = activeCampaigns(team.campaigns, clock.time.day);
  const offers = offersOf(team.prices);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Campagnes en cours
        </CardTitle>
        <CardDescription>
          La plus proche de sa fin en premier. Une cible peut être relancée dès le lendemain du
          dernier jour de sa campagne.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {campaigns.length === 0 ? (
          <EmptyState icon={Megaphone} title="Aucune campagne en cours">
            Choisissez une cible et une durée : la campagne agit dès son lancement.
          </EmptyState>
        ) : (
          <ul className="divide-y">
            {campaigns.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                time={clock.time}
                stepsPerDay={clock.stepsPerDay}
                msPerDay={msPerDay}
                offers={offers}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CampaignRow({
  campaign,
  time,
  stepsPerDay,
  msPerDay,
  offers,
}: {
  campaign: Campaign;
  time: SimTime;
  stepsPerDay: number;
  msPerDay: number;
  offers: readonly Pair[];
}) {
  const target = targetLabel(campaign);
  const lastDay = daysLeft(campaign.endDay, time.day) <= 1;
  const progress = campaignProgress(campaign, time, stepsPerDay);
  const reached = offers.filter((pair) => reaches(campaign, pair));
  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-start justify-between gap-3">
        <p className="font-medium text-pretty">{target}</p>
        <span
          className={cn(
            "tabular inline-flex shrink-0 items-center gap-1 text-sm",
            lastDay ? "font-medium text-warning" : "text-muted-foreground",
          )}
        >
          {lastDay ? <Hourglass className="size-3.5" aria-hidden /> : null}
          {daysLeftLabel(campaign.endDay, time.day)}
        </span>
      </div>
      <Progress
        value={progress * 100}
        aria-label={`Avancement de la campagne ${target}`}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${percent(progress)} écoulés`}
        className="h-1.5"
      />
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular">
          Fin : <span className="font-semibold text-foreground">jour {campaign.endDay}</span> ·{" "}
          {timeLeft(daysUntilEnd(campaign.endDay, time, stepsPerDay), msPerDay)}
        </span>
        <span className="tabular">
          Lancée le jour {campaign.startDay} · {credits(campaign.cost)}
        </span>
      </div>
      {reached.length > 0 ? (
        <p className="text-xs text-pretty text-muted-foreground">Soutient {offersLabel(reached)}</p>
      ) : (
        <p className="flex items-start gap-1.5 text-xs text-pretty text-warning">
          <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
          Rien en vente sur cette cible : fixez un prix dans Ventes pour en profiter.
        </p>
      )}
    </li>
  );
}
