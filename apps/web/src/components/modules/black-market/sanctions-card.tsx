import { Gavel, type LucideIcon, Scale, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { credits, formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { relativeDay, type SanctionKind, sanctionEvents } from "./black-market-math";

const kindIcon: Record<SanctionKind, LucideIcon> = {
  conviction: Gavel,
  unfounded: Scale,
  shielded: ShieldCheck,
};

function Fact({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular text-right font-semibold">
        {value}
        {hint ? (
          <span className="block text-xs font-normal text-muted-foreground">{hint}</span>
        ) : null}
      </dd>
    </div>
  );
}

/**
 * Sanctions the company received (story 87–88): exclusion, convictions and their social
 * penalty, fines paid, and the history of what happened, latest first.
 */
export function SanctionsCard() {
  const view = useView();
  const { team, impact } = view;
  const today = view.clock.time.day;
  const bannedUntil = view.blackMarket.bannedUntilDay;
  const events = sanctionEvents(team.log);
  const convictions = team.blackMarket.convictions;
  const finesPaid = Math.max(0, -(team.finance.totals.fines ?? 0));
  const socialPenalty = impact.breakdown.social.penalties.convictions;
  const spotless =
    bannedUntil === null && convictions === 0 && finesPaid === 0 && events.length === 0;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Sanctions reçues
        </CardTitle>
        <CardDescription>
          Amendes, condamnations et exclusions infligées à votre entreprise.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        {spotless ? (
          <p className="flex items-start gap-2 text-muted-foreground">
            <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
            Aucune sanction : ni la douane ni vos concurrents ne vous ont pris… pour l'instant.
          </p>
        ) : (
          <>
            <dl className="divide-y">
              <Fact
                label="Exclusion"
                value={bannedUntil === null ? "Aucune" : `Jusqu'au jour ${bannedUntil}`}
                hint={bannedUntil === null ? undefined : `retour le jour ${bannedUntil + 1}`}
              />
              <Fact
                label="Condamnations"
                value={formatNumber(convictions)}
                hint={socialPenalty > 0 ? `indicateur social −${socialPenalty}` : undefined}
              />
              <Fact label="Amendes payées" value={credits(finesPaid)} />
            </dl>
            {events.length > 0 ? (
              <ol className="space-y-3">
                {events.map((event) => {
                  const Icon = kindIcon[event.kind];
                  return (
                    <li key={event.id} className="flex gap-2.5">
                      <Icon
                        className={cn(
                          "mt-0.5 size-4 shrink-0",
                          event.kind === "shielded" ? "text-success" : "text-warning",
                        )}
                        aria-hidden
                      />
                      <div className="min-w-0">
                        <p className="text-pretty">{event.message}</p>
                        <p className="tabular text-xs text-muted-foreground">
                          Jour {event.day} · {relativeDay(event.day, today)}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
