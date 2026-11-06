import { hrRules } from "@etic/content";
import {
  Ban,
  Banknote,
  Gavel,
  type LucideIcon,
  ShieldAlert,
  ShoppingCart,
  UserMinus,
  UserRoundX,
  Users,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatNumber, percent, regionName } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  averageWageRatio,
  countedScores,
  countPhrase,
  ofPlace,
  purchasesSentence,
  socialBase,
  socialEquation,
  totalPenalties,
} from "./impact-math";
import { IndicatorTotal, Lever, ModuleLink, RowTitle, SubScoreRow } from "./sub-score-row";

interface Penalty {
  key: string;
  icon: LucideIcon;
  label: string;
  points: number;
  /** Shown while the cause is still going on (a strike in progress). */
  ongoing?: string;
}

/** Points taken off the indicator: a sign and a word, never colour alone. */
function PenaltyPoints({ points }: { points: number }) {
  if (points === 0) {
    return (
      <span className="text-muted-foreground">
        <span aria-hidden>—</span>
        <span className="sr-only">aucune pénalité</span>
      </span>
    );
  }
  return (
    <span className="tabular font-medium whitespace-nowrap text-destructive">
      −{formatNumber(points)} {points > 1 ? "pts" : "pt"}
    </span>
  );
}

/** Strikes, layoffs, collective resignations and black-market convictions (N20, N25). */
function PenaltiesRow() {
  const { team, impact } = useView();
  const { penalties } = impact.breakdown.social;
  const total = totalPenalties(penalties);
  const items: Penalty[] = [
    {
      key: "strikes",
      icon: Ban,
      label: countPhrase(
        team.hr.strikeDays,
        "Aucun jour de grève",
        "jour de grève",
        "jours de grève",
      ),
      points: penalties.strikes,
      ongoing: team.hr.unpaidWages > 0 ? "Grève en cours" : undefined,
    },
    {
      key: "layoffs",
      icon: UserMinus,
      label: countPhrase(team.hr.layoffs, "Aucun licenciement", "licenciement", "licenciements"),
      points: penalties.layoffs,
    },
    {
      key: "resignations",
      icon: UserRoundX,
      label: countPhrase(
        team.hr.massResignations,
        "Aucune démission collective",
        "démission collective",
        "démissions collectives",
      ),
      points: penalties.resignations,
    },
    {
      key: "convictions",
      icon: Gavel,
      label: countPhrase(
        team.blackMarket.convictions,
        "Aucune condamnation pour marché noir",
        "condamnation pour marché noir",
        "condamnations pour marché noir",
      ),
      points: penalties.convictions,
    },
  ];

  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <RowTitle icon={ShieldAlert}>Pénalités</RowTitle>
        {total > 0 ? (
          <PenaltyPoints points={total} />
        ) : (
          <span className="text-xs text-muted-foreground">Aucune</span>
        )}
      </div>
      <ul className="grid gap-1.5 text-sm">
        {items.map(({ key, icon: Icon, label, points, ongoing }) => (
          <li key={key} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <Icon
                className={cn(
                  "size-4 shrink-0",
                  points > 0 ? "text-destructive" : "text-muted-foreground",
                )}
                aria-hidden
              />
              <span className={points > 0 ? undefined : "text-muted-foreground"}>{label}</span>
              {ongoing ? (
                <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                  {ongoing}
                </span>
              ) : null}
            </span>
            <PenaltyPoints points={points} />
          </li>
        ))}
      </ul>
      <Lever>
        Payez les salaires à temps : une grève bloque production et expéditions et, au bout de{" "}
        {hrRules.strikeResignationDays} jours, vos employés démissionnent ensemble. Licenciez le
        moins possible et restez loin du marché noir.{" "}
        <ModuleLink to="/play/equipe">Équipe</ModuleLink>
      </Lever>
    </li>
  );
}

/**
 * Social indicator (R17, N20): wage and supplier sub-scores, then the penalties taken off,
 * with the facts behind each one and the levers to improve them.
 */
export function SocialDetail() {
  const { team, impact } = useView();
  const { wages, suppliers, penalties } = impact.breakdown.social;
  const wageRatio = averageWageRatio(team.hr);
  const purchases = team.impact.purchases;
  const region = team.region ? ofPlace(regionName(team.region)) : "de votre région";

  return (
    <Card>
      <CardHeader>
        <CardTitle
          className="eyebrow flex items-center gap-2 text-muted-foreground"
          role="heading"
          aria-level={2}
        >
          <Users className="size-4" aria-hidden />
          Détail social
        </CardTitle>
        <CardDescription>
          Deux sous-notes sur 100, pondérées par vos volumes depuis le début de la partie, moins des
          pénalités pour chaque incident.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y">
          <SubScoreRow
            icon={Banknote}
            label="Salaires"
            value={wages}
            empty="Aucun employé au travail pour l'instant."
            lever={
              <>
                Payez au-dessus du salaire de base : vos augmentations améliorent cette note et
                entretiennent le rendement de vos employés.{" "}
                <ModuleLink to="/play/equipe">Équipe</ModuleLink>
              </>
            }
          >
            {wageRatio === null ? null : (
              <p>
                Depuis le début, vous payez en moyenne{" "}
                <span className="tabular font-medium text-foreground">{percent(wageRatio)}</span> du
                salaire de base {region}.
              </p>
            )}
          </SubScoreRow>

          <SubScoreRow
            icon={ShoppingCart}
            label="Fournisseurs"
            value={suppliers}
            empty="Aucune matière achetée pour l'instant."
            lever={
              <>
                Comparez la note sociale (
                <Users className="inline size-3.5 align-[-2px]" aria-hidden />) des fournisseurs
                avant d'acheter : le marché noir est le pire de tous.{" "}
                <ModuleLink to="/play/achats">Achats</ModuleLink>
              </>
            }
          >
            <p>
              {purchasesSentence(
                purchases.units,
                purchases.lowRatedUnits,
                team.blackMarket.purchasedUnits,
              )}
            </p>
          </SubScoreRow>

          <PenaltiesRow />
        </ul>
        <IndicatorTotal value={impact.social}>
          {socialEquation(
            socialBase(impact),
            totalPenalties(penalties),
            countedScores([wages, suppliers]),
          )}
        </IndicatorTotal>
      </CardContent>
    </Card>
  );
}
