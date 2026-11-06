import { blackMarketRules, cardById, impactRules, newsSources } from "@etic/content";
import { Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Footprints,
  Gavel,
  Leaf,
  type LucideIcon,
  Search,
  ShieldCheck,
  Ship,
  Spade,
} from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { credits, formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import type { GlossaryKey } from "@/lib/glossary";
import { formatDecimal, plural, traceSummary } from "./black-market-math";

const rules = blackMarketRules;

function RiskBlock({
  icon: Icon,
  title,
  info,
  children,
}: {
  icon: LucideIcon;
  title: string;
  info?: GlossaryKey;
  children: ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <h3 className="flex items-center gap-1.5 font-sans text-sm font-semibold">
        <Icon className="size-4 shrink-0 text-milk/70" aria-hidden />
        {title}
        {info ? <InfoTip term={info} /> : null}
      </h3>
      {children}
    </section>
  );
}

function PanelLink({ to, children }: { to: "/play/impact" | "/play/carte"; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 font-medium underline underline-offset-4 hover:opacity-80"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/**
 * What the company risks (R13, R17): its recent traces, the sanction if caught, who can catch
 * it (competitors, Port-Libre customs), the impact of its purchases and its amnesty. Hidden
 * odds stay undocumented (R22).
 */
export function RiskPanel() {
  const view = useView();
  const { team, impact } = view;
  const today = view.clock.time.day;
  const traces = traceSummary(team.blackMarket.traces, today);
  const portLibre = team.region === "port-libre";
  const shieldUntil = team.cardEffects.amnestyUntilDay;
  const shielded = shieldUntil !== null && today <= shieldUntil;
  const amnestyInHand = team.card?.id === "amnesty" && !team.card.used;
  const accusation = rules.accusation;
  return (
    // Cacao surface: the most ominous panel of the page (DESIGN.md §3, Milk on Cacao ≈ 14:1).
    <Card className="gap-5 border-cacao bg-cacao">
      <CardHeader>
        <CardTitle className="eyebrow text-muted-foreground" role="heading" aria-level={2}>
          Vos risques
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <RiskBlock icon={Footprints} title="Traces récentes" info="traces">
          <p className="tabular font-display text-3xl font-bold">
            {formatNumber(view.blackMarket.recentTraces)}
          </p>
          <p className="text-muted-foreground">
            {traces.count > 0
              ? `La plus ancienne s'efface le jour ${traces.nextFadeDay}, la dernière le jour ${traces.clearDay} si vous arrêtez là.`
              : "Aucune trace : une enquête ne trouverait rien sur vous."}
          </p>
        </RiskBlock>

        <RiskBlock icon={Gavel} title="Si vous êtes démasqué">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              {traces.count > 0 ? (
                <>
                  Amende de <strong className="tabular">{credits(traces.fine)}</strong> aujourd'hui
                  ({accusation.fineMultiplier} × votre gain illicite récent, au moins{" "}
                  {credits(accusation.minFine)}).
                </>
              ) : (
                `Amende de ${accusation.fineMultiplier} × votre gain illicite récent, au moins ${credits(accusation.minFine)}.`
              )}
            </li>
            <li>
              −{accusation.reputationPenalty} de réputation et −
              {impactRules.penalties.perConviction} sur l'indicateur social.
            </li>
            <li>Exclusion du marché noir pendant {accusation.banDays} jours.</li>
            <li>Scandale dans {newsSources.tabloid}.</li>
          </ul>
          <p className="text-muted-foreground">
            La part d'une amende que votre trésorerie disponible ne couvre pas s'ajoute à votre
            dette.
          </p>
        </RiskBlock>

        <RiskBlock icon={portLibre ? Ship : Search} title="Qui peut vous démasquer">
          <p>Vos concurrents, par une enquête privée puis une accusation publique.</p>
          <p className={portLibre ? undefined : "text-muted-foreground"}>
            {portLibre
              ? "La douane de Port-Libre : chaque affaire peut être contrôlée sur-le-champ, en contrepartie d'un accès élargi."
              : "Pas de douane hors de Port-Libre."}
          </p>
        </RiskBlock>

        <RiskBlock icon={Leaf} title="Impact" info="impact">
          <p>
            Chaque unité achetée ici compte 0/100 sur vos indicateurs environnemental et social ;
            les ventes n'y changent rien.
          </p>
          <p className="tabular text-muted-foreground">
            {plural(team.blackMarket.purchasedUnits, "unité achetée", "unités achetées")} depuis le
            début · environnement {formatDecimal(impact.environmental)} · social{" "}
            {formatDecimal(impact.social)}
          </p>
          <PanelLink to="/play/impact">Détail de votre impact</PanelLink>
        </RiskBlock>

        {shielded ? (
          <p className="flex items-start gap-2 rounded-lg border border-milk/20 px-3 py-2">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
            <span>
              Amnistie active jusqu'au jour {shieldUntil} : la prochaine accusation contre vous sera
              classée sans suite.
            </span>
          </p>
        ) : amnestyInHand ? (
          <div className="space-y-1.5 rounded-lg border border-milk/20 px-3 py-2">
            <p className="flex items-start gap-2">
              <Spade className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Votre carte secrète « {cardById.get("amnesty")?.name ?? "Amnistie"} » peut effacer
                vos traces et annuler une accusation qui vous vise.
              </span>
            </p>
            <PanelLink to="/play/carte">Voir votre carte</PanelLink>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
