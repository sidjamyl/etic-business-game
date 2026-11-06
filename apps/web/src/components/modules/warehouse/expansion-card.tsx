import { warehouseRules } from "@etic/content";
import { availableCash } from "@etic/engine";
import { Construction, Hammer } from "lucide-react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { blockedReason } from "@/components/modules/purchasing/purchase-math";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useGameCommand } from "@/lib/commands";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import { expansionProgress, relativeDay, unitsLabel } from "./warehouse-math";

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}

/** Paid extension with a construction delay, one at a time (R9, story 34). */
export function WarehouseExpansion() {
  const view = useView();
  const { send, pending, canAct } = useGameCommand();
  const { team, clock } = view;
  const today = clock.time.day;
  const capacity = team.warehouse.capacity;
  const expansion = team.warehouse.expansion;
  const { expansionCapacity, expansionCost, expansionDays } = warehouseRules;

  if (expansion) {
    const progress = expansionProgress(
      expansion.completesOnDay,
      expansionDays,
      clock.time,
      clock.stepsPerDay,
    );
    return (
      <Card>
        <CardHeader>
          <CardTitle className="eyebrow text-muted-foreground">Extension</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="flex items-center gap-2 text-sm font-medium">
            <Construction className="size-4 text-warning" aria-hidden />
            Travaux en cours
          </p>
          <p className="tabular text-2xl font-semibold">+{unitsLabel(expansion.amount)}</p>
          <Progress value={progress * 100} aria-label="Avancement des travaux d'extension" />
          <p className="text-sm">
            {`Prête le jour ${expansion.completesOnDay} (${relativeDay(expansion.completesOnDay, today)}) : capacité portée à ${unitsLabel(capacity + expansion.amount)}.`}
          </p>
          <p className="text-xs text-muted-foreground">Une seule extension à la fois.</p>
        </CardContent>
      </Card>
    );
  }

  const cash = availableCash(team);
  const readyDay = today + expansionDays;
  const reason = !canAct
    ? blockedReason(clock.status)
    : cash < expansionCost
      ? `Trésorerie disponible insuffisante : il manque ${credits(expansionCost - cash)}.`
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground">Extension</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="tabular text-2xl font-semibold">+{unitsLabel(expansionCapacity)}</p>
        <dl className="space-y-1 text-sm">
          <Figure label="Coût" value={credits(expansionCost)} />
          <Figure label="Travaux" value={`${expansionDays} jours`} />
          <Figure label="Capacité après" value={unitsLabel(capacity + expansionCapacity)} />
        </dl>
        <ConfirmDialog
          trigger={
            <Button className="w-full" disabled={reason !== null || pending}>
              <Hammer aria-hidden />
              Agrandir l'entrepôt
            </Button>
          }
          title="Agrandir l'entrepôt ?"
          description="L'extension est payée tout de suite et ne peut pas être annulée."
          consequences={[
            `${credits(expansionCost)} payés immédiatement.`,
            `Capacité portée de ${unitsLabel(capacity)} à ${unitsLabel(capacity + expansionCapacity)}.`,
            `${expansionDays} jours de travaux : place disponible le jour ${readyDay}.`,
            "Une seule extension à la fois.",
          ]}
          confirmLabel={`Payer ${credits(expansionCost)}`}
          onConfirm={async () => {
            const result = await send("warehouse.expand", undefined, {
              success: `Extension lancée : +${unitsLabel(expansionCapacity)} le jour ${readyDay}.`,
            });
            return result.ok;
          }}
        />
        {reason ? <p className="text-xs text-muted-foreground">{reason}</p> : null}
      </CardContent>
    </Card>
  );
}
