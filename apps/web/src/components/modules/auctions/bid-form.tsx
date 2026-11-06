import { availableCash } from "@etic/engine";
import { CircleAlert, Gavel, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGameCommand } from "@/lib/commands";
import { credits } from "@/lib/format";
import { useView } from "@/lib/game";
import {
  type AuctionView,
  bidBlockedReason,
  canAffordMinimum,
  checkBid,
  minimumBid,
} from "./auction-math";

/** Under the amount: why it is refused, a funds warning before typing, or the rule to follow. */
function BidHint({
  id,
  error,
  short,
  raising,
  minimum,
}: {
  id: string;
  error: string | null;
  /** Nothing typed yet and the available cash cannot even cover the smallest bid. */
  short: boolean;
  raising: boolean;
  minimum: string;
}) {
  if (error) {
    return (
      <p id={id} className="flex items-start gap-1.5 text-xs text-pretty text-destructive">
        <CircleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
        {error}
      </p>
    );
  }
  if (short) {
    return (
      <p id={id} className="flex items-start gap-1.5 text-xs text-pretty text-warning">
        <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
        {raising
          ? "Plus de trésorerie disponible pour augmenter votre offre."
          : `Trésorerie disponible insuffisante pour la mise à prix (${minimum}).`}
      </p>
    );
  }
  return (
    <p id={id} className="text-xs text-pretty text-muted-foreground">
      {raising
        ? `Au moins ${minimum}. Saisissez le nouveau total : seule la différence est bloquée en plus.`
        : `Au moins ${minimum} (mise à prix).`}
    </p>
  );
}

/**
 * Sealed bid on an open auction (R12, stories 78–79): a first bid or a raise. The amount is
 * the new total; only the difference with the current bid is locked. Binding, so confirmed.
 */
export function BidForm({ auction }: { auction: AuctionView }) {
  const view = useView();
  const { send, pending, canAct } = useGameCommand();
  const [raw, setRaw] = useState("");
  const { team, clock } = view;
  const available = availableCash(team);
  const check = checkBid(raw, auction, available);
  const amount = check.amount ?? 0;
  const valid = check.amount !== null && check.error === null;
  const raising = auction.myBid !== null;
  const locked = !canAct || pending;
  const blocked = bidBlockedReason(clock.status);
  const minimum = credits(minimumBid(auction));
  const closing = `fin du jour ${auction.closesDay}`;
  const inputId = `bid-${auction.id}`;
  const hintId = `${inputId}-hint`;

  async function placeBid() {
    // The view may have changed while the dialog was open (a teammate raised the bid).
    if (!valid) return false;
    const result = await send(
      "auction.bid",
      { auctionId: auction.id, amount },
      {
        success: raising
          ? `Offre portée à ${credits(amount)} : ${credits(check.extra)} de plus bloqués.`
          : `Offre de ${credits(amount)} déposée : montant bloqué jusqu'à la clôture.`,
      },
    );
    if (result.ok) setRaw("");
    return result.ok;
  }

  return (
    // Enter in the field clicks the submit button, which opens the confirmation.
    <form
      onSubmit={(event) => event.preventDefault()}
      noValidate
      className="grid gap-x-8 gap-y-4 border-t pt-5 sm:grid-cols-[1fr_auto]"
    >
      <div className="space-y-2">
        <Label htmlFor={inputId}>
          {raising ? "Nouveau montant total" : "Montant de votre offre"}
        </Label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
            >
              ₢
            </span>
            <Input
              id={inputId}
              inputMode="numeric"
              autoComplete="off"
              value={raw}
              onChange={(event) => setRaw(event.target.value)}
              disabled={locked}
              aria-invalid={check.error !== null}
              aria-describedby={hintId}
              className="tabular w-40 pl-7"
            />
          </div>
          <ConfirmDialog
            trigger={
              <Button type="submit" disabled={locked || !valid}>
                <Gavel aria-hidden />
                {raising ? "Augmenter l'offre" : "Déposer l'offre"}
              </Button>
            }
            title={raising ? "Augmenter votre offre ?" : "Déposer votre offre ?"}
            description={`Offre scellée sur « ${auction.title} » : les autres entreprises ne la verront pas. Elle vous engage : impossible de la retirer ou de la baisser.`}
            consequences={[
              raising
                ? `${credits(check.extra)} de plus bloqués dès maintenant (${credits(amount)} au total), jusqu'à la clôture (${closing}).`
                : `${credits(amount)} bloqués dès maintenant, jusqu'à la clôture (${closing}).`,
              `Si vous l'emportez, vous payez ${credits(amount)} et recevez le lot.`,
              "Sinon, la somme bloquée vous est rendue à la clôture.",
              `Trésorerie disponible après l'offre : ${credits(available - check.extra)}.`,
            ]}
            confirmLabel={raising ? `Porter à ${credits(amount)}` : `Offrir ${credits(amount)}`}
            onConfirm={placeBid}
          >
            {check.error ? (
              <p className="flex items-start gap-1.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                {check.error}
              </p>
            ) : null}
          </ConfirmDialog>
        </div>
        <BidHint
          id={hintId}
          error={check.error}
          short={check.amount === null && !canAffordMinimum(auction, available)}
          raising={raising}
          minimum={minimum}
        />
        {blocked ? <p className="text-xs text-muted-foreground">{blocked}</p> : null}
      </div>
      <dl className="grid grid-cols-[auto_auto] content-start gap-x-6 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">{raising ? "Bloqué en plus" : "Montant bloqué"}</dt>
        <dd className="tabular text-right font-medium">{valid ? credits(check.extra) : "—"}</dd>
        <dt className="text-muted-foreground">Disponible ensuite</dt>
        <dd className="tabular text-right font-medium">
          {valid ? credits(available - check.extra) : "—"}
        </dd>
      </dl>
    </form>
  );
}
