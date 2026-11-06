import { VenetianMask } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { stepLabel } from "@/lib/format";
import { useView } from "@/lib/game";
import { cardAttacks } from "./card-math";

/**
 * Cards played against the company (story 97): the team learns that it was hit, never by whom.
 * Each notice also pops up as an alert when it happens (foundation, #26).
 */
export function CardAttacks() {
  const { team, clock } = useView();
  const attacks = cardAttacks(team.log);
  return (
    <Card>
      <CardHeader>
        <h2 className="eyebrow font-sans text-muted-foreground">Cartes jouées contre vous</h2>
        <CardDescription className="text-pretty">
          Vous êtes prévenus quand une carte vous frappe, jamais de qui elle vient.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {attacks.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune pour l'instant, à votre connaissance.
          </p>
        ) : (
          <ol
            className="space-y-3"
            aria-label="Cartes subies, des plus récentes aux plus anciennes"
          >
            {attacks.map((entry) => (
              <li key={entry.id} className="flex gap-3 text-sm">
                <VenetianMask className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                <div className="min-w-0">
                  <p className="text-pretty">{entry.message}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    Jour {entry.day} · {stepLabel(entry.step, clock.stepsPerDay)} · auteur inconnu
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
        <p className="border-t pt-3 text-xs text-pretty text-muted-foreground">
          Un espionnage ne laisse aucune trace, et une fausse news ressemble à toutes les autres :
          restez méfiants.
        </p>
      </CardContent>
    </Card>
  );
}
