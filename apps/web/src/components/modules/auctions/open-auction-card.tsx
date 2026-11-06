import { EyeOff, Gavel, Lock, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { credits, timeLeft } from "@/lib/format";
import { useGame, useView } from "@/lib/game";
import { type AuctionView, endsBeforeClose, stepsUntilClose, windowElapsed } from "./auction-math";
import { BidForm } from "./bid-form";

function Fact({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg bg-muted/50 px-4 py-3">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className="tabular mt-1 flex items-center gap-1.5 text-xl font-semibold">
        {icon}
        {value}
      </dd>
      <dd className="mt-0.5 text-xs text-muted-foreground">{hint}</dd>
    </div>
  );
}

/**
 * An open lot (stories 77–79): what is offered, the starting price, the team's own sealed
 * bid, the time left before the close, then the bid form.
 */
export function OpenAuctionCard({ auction }: { auction: AuctionView }) {
  const view = useView();
  const { msPerDay } = useGame();
  const { clock } = view;
  const left = stepsUntilClose(auction.closesDay, clock.time, clock.stepsPerDay);
  const elapsed = windowElapsed(auction.id, auction.closesDay, clock.time, clock.stepsPerDay);
  const titleId = `auction-${auction.id}-title`;

  return (
    // The charter's dotted shadow marks the bid as a binding, highlighted element (DESIGN.md §5).
    <section aria-labelledby={titleId} className="rounded-xl shadow-dotted">
      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 bg-cacao px-6 py-3 text-milk">
          <p className="eyebrow flex items-center gap-2">
            <Gavel className="size-4" aria-hidden />
            Enchère ouverte
          </p>
          <p className="flex items-center gap-1.5 text-xs">
            <EyeOff className="size-3.5" aria-hidden />
            Offres scellées
          </p>
        </div>
        {elapsed === null ? null : (
          // Decorative: the time left below carries the information.
          <div aria-hidden className="h-1 bg-cacao/15">
            <div
              className="h-full bg-power-red transition-[width]"
              style={{ width: `${elapsed * 100}%` }}
            />
          </div>
        )}

        <div className="space-y-5 p-6">
          <div className="space-y-1.5">
            <h2 id={titleId} className="text-2xl font-bold uppercase">
              {auction.title}
            </h2>
            {auction.description ? (
              <p className="text-pretty text-muted-foreground">{auction.description}</p>
            ) : null}
          </div>

          <dl className="grid gap-3 sm:grid-cols-3">
            <Fact
              label="Mise à prix"
              value={credits(auction.startingPrice)}
              hint="Offre minimale"
            />
            {auction.myBid === null ? (
              <Fact label="Votre offre" value="Aucune" hint="Rien n'est bloqué" />
            ) : (
              <Fact
                label="Votre offre"
                value={credits(auction.myBid)}
                icon={<Lock className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
                hint="Bloquée jusqu'à la clôture"
              />
            )}
            <Fact
              label="Temps restant"
              value={timeLeft(left / clock.stepsPerDay, msPerDay)}
              hint={
                clock.status === "paused"
                  ? `Fin du jour ${auction.closesDay} · horloge en pause`
                  : `Clôture à la fin du jour ${auction.closesDay}`
              }
            />
          </dl>

          {endsBeforeClose(auction.closesDay, clock.endDay) ? (
            <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
              <span>
                <span className="font-medium text-warning">Fin de partie avant la clôture.</span> Si
                l'heure de fin ne change pas, aucun gagnant ne sera désigné et toutes les offres
                seront rendues.
              </span>
            </p>
          ) : null}

          {auction.myBid !== null ? (
            <p className="text-sm text-muted-foreground">
              Vous ne saurez qu'à la clôture si votre offre l'emporte : les montants des autres
              entreprises restent secrets.
            </p>
          ) : null}

          <BidForm auction={auction} />
        </div>
      </Card>
    </section>
  );
}
