import { marketingRules, type ProductId, type RegionId } from "@etic/content";
import { availableCash } from "@etic/engine";
import { Megaphone } from "lucide-react";
import { type ReactNode, useState } from "react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { InfoTip } from "@/components/game/info-tip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGameCommand } from "@/lib/commands";
import { credits, dayLabel, formatNumber, timeLeft } from "@/lib/format";
import { useGame, useView } from "@/lib/game";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { CampaignMessages } from "./campaign-messages";
import {
  activeCampaigns,
  blockedReason,
  boostLabel,
  campaignMessages,
  daysUntilEnd,
  offersLabel,
  offersOf,
  planCampaign,
  targetLabel,
} from "./marketing-math";
import { DurationField, type FieldContext, ProductField, RegionField } from "./target-fields";

/** A key figure of the campaign being prepared. */
function Figure({
  label,
  value,
  hint,
  info,
  emphasis = false,
  danger = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  info?: GlossaryKey;
  emphasis?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-2.5">
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {info ? <InfoTip term={info} /> : null}
      </dt>
      <dd
        className={cn(
          "tabular mt-0.5 font-semibold",
          emphasis ? "text-xl" : "text-base",
          danger && "text-destructive",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="text-xs text-pretty text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

/**
 * New campaign (R10, N14, stories 69–71): a region or all of them, a product or the whole
 * range, 7, 14 or 30 days, and its cost before paying. A target that already has its
 * campaign is blocked, as the engine would refuse it; overlaps are explained (no stacking).
 */
export function CampaignForm() {
  const view = useView();
  const { msPerDay } = useGame();
  const { send, pending, canAct } = useGameCommand();
  const { team, clock } = view;
  const [region, setRegion] = useState<RegionId | null>(team.region);
  const [productId, setProductId] = useState<ProductId | null>(null);
  const [days, setDays] = useState<number>(marketingRules.durations[0]);

  const today = clock.time.day;
  const target = { region, productId };
  const campaigns = activeCampaigns(team.campaigns, today);
  const available = availableCash(team);
  const plan = planCampaign({ target, days, today, campaigns, prices: team.prices, available });
  const messages = campaignMessages(plan, team.reservedCash);
  const blocked = messages.some((message) => message.tone === "error");
  const closed = canAct ? null : blockedReason(clock.status);
  const label = targetLabel(target);
  const after = available - plan.cost;
  const context: FieldContext = {
    target,
    days,
    today,
    campaigns,
    offers: offersOf(team.prices),
    available,
    home: team.region,
    disabled: pending,
  };

  async function launch() {
    const result = await send(
      "marketing.launch",
      { region, productId, days },
      { success: `Campagne lancée pour ${days} jours : ${label}.` },
    );
    return result.ok;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Nouvelle campagne
        </CardTitle>
        <CardDescription>
          Une région ou toutes, un produit ou toute la gamme, et une durée. Le coût dépend de la
          population visée, de l'étendue de la gamme et du nombre de jours ; il est payé au
          lancement.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RegionField context={context} onChange={setRegion} />
        <ProductField context={context} onChange={setProductId} />
        <DurationField context={context} onChange={setDays} />

        <div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
            <Figure
              label="Coût, payé au lancement"
              value={credits(plan.cost)}
              hint={`${days} jours × ${credits(plan.cost / days)}`}
              emphasis
            />
            <Figure
              label="Trésorerie disponible après"
              info="availableCash"
              value={credits(after)}
              hint={`Actuellement ${credits(available)}`}
              danger={after < 0}
            />
            <Figure
              label="Fin de la campagne"
              value={dayLabel(plan.endDay)}
              hint={`${timeLeft(daysUntilEnd(plan.endDay, clock.time, clock.stepsPerDay), msPerDay)} en temps réel`}
            />
            <Figure
              label="Vos offres concernées"
              value={formatNumber(plan.offers.length)}
              hint={
                plan.offers.length > 0 ? offersLabel(plan.offers) : "Rien en vente sur cette cible"
              }
            />
          </dl>
          <CampaignMessages messages={messages} live className="not-empty:mt-4" />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <ConfirmDialog
            trigger={
              <Button disabled={!canAct || pending || blocked}>
                <Megaphone aria-hidden />
                Lancer la campagne · {credits(plan.cost)}
              </Button>
            }
            title="Lancer cette campagne ?"
            description={`${label} · ${days} jours`}
            consequences={[
              `${credits(plan.cost)} payés tout de suite, sans remboursement possible.`,
              `${boostLabel()} d'attractivité sur la cible, du jour ${today} au jour ${plan.endDay} inclus.`,
              "Elle prend des clients à vos concurrents, sans en créer de nouveaux.",
            ]}
            confirmLabel={`Payer ${credits(plan.cost)}`}
            onConfirm={launch}
          >
            {messages.length > 0 ? <CampaignMessages messages={messages} /> : null}
          </ConfirmDialog>
          {closed ? <p className="text-sm text-muted-foreground">{closed}</p> : null}
        </div>
      </CardContent>
    </Card>
  );
}
