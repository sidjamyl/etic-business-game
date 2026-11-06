import { cardRules, hrRules } from "@etic/content";
import type { ActivityEntry, SecretCard } from "@etic/engine";
import { Link } from "@tanstack/react-router";
import { ShieldCheck, ShieldOff } from "lucide-react";
import type { ReactNode } from "react";
import { InfoTip } from "@/components/game/info-tip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatNumber, percent, stepLabel } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { cardIcon } from "./card-icons";
import {
  amnestyShield,
  freezeNote,
  relativeDay,
  sabotageNote,
  workforceSummary,
} from "./card-math";
import { SpyReportView } from "./spy-report";

/** "Jouée le jour 12 · Midi, par Alice." — from the log, while the line is still there. */
function PlayedLine({ play }: { play: ActivityEntry | null }) {
  const { clock } = useView();
  if (!play) return null;
  return (
    <p className="tabular text-xs text-muted-foreground">
      Jouée le jour {play.day} · {stepLabel(play.step, clock.stepsPerDay)}
      {play.actor ? `, par ${play.actor}` : ""}.
    </p>
  );
}

function OutcomeCard({
  card,
  play,
  title,
  icon,
  tone,
  action,
  children,
}: {
  card: SecretCard;
  play: ActivityEntry | null;
  title: string;
  /** Replaces the card's own icon (amnesty shield state). */
  icon?: typeof ShieldCheck;
  tone?: "success" | "muted";
  action?: ReactNode;
  children: ReactNode;
}) {
  const Icon = icon ?? cardIcon[card.id];
  return (
    <Card>
      <CardHeader>
        <p className="eyebrow text-muted-foreground">Carte jouée</p>
        <h2 className="flex items-center gap-2 text-xl font-bold uppercase">
          <Icon
            className={cn(
              "size-5 shrink-0",
              tone === "success" ? "text-success" : "text-muted-foreground",
            )}
            aria-hidden
          />
          {title}
        </h2>
        <PlayedLine play={play} />
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-pretty">
        {children}
        {action ? <div className="pt-1">{action}</div> : null}
      </CardContent>
    </Card>
  );
}

function GoTo({
  to,
  children,
}: {
  to: "/play/news" | "/play/achats" | "/play/equipe" | "/play/marche-noir";
  children: string;
}) {
  return (
    <Button asChild variant="outline" size="sm">
      <Link to={to}>{children}</Link>
    </Button>
  );
}

function TracesToday() {
  const { blackMarket } = useView();
  return (
    <p className="flex items-center gap-1.5 text-muted-foreground">
      Traces récentes aujourd'hui :{" "}
      <span className="tabular font-medium text-foreground">
        {formatNumber(blackMarket.recentTraces)}
      </span>
      <InfoTip term="traces" />
    </p>
  );
}

function AmnestyOutcome({ card, play }: { card: SecretCard; play: ActivityEntry | null }) {
  const { team, clock } = useView();
  const today = clock.time.day;
  const shield = amnestyShield(card, team.cardEffects, today);
  if (shield?.kind === "active") {
    return (
      <OutcomeCard card={card} play={play} title="Bouclier actif" icon={ShieldCheck} tone="success">
        <p>
          Jusqu'au <span className="tabular font-medium">jour {shield.untilDay}</span> (
          {shield.daysLeft === 0 ? "dernier jour" : relativeDay(shield.untilDay, today)}), la
          prochaine accusation contre vous sera classée sans suite, sans scandale.
        </p>
        <p className="text-muted-foreground">
          Vos traces de marché noir ont été effacées à l'activation ; les affaires conclues depuis
          en laissent de nouvelles.
        </p>
        <TracesToday />
      </OutcomeCard>
    );
  }
  if (shield?.kind === "spent") {
    return (
      <OutcomeCard card={card} play={play} title="Bouclier utilisé" icon={ShieldOff}>
        <p>
          Une accusation vous visait : votre amnistie l'a annulée, sans scandale. Vous n'êtes plus
          protégés.
        </p>
        <TracesToday />
      </OutcomeCard>
    );
  }
  return (
    <OutcomeCard card={card} play={play} title="Bouclier expiré" icon={ShieldOff}>
      <p>
        {shield?.kind === "expired"
          ? `Il a pris fin le jour ${shield.untilDay} sans avoir servi : aucune accusation ne vous a visés d'ici là.`
          : "Le bouclier ne vous protège plus."}
      </p>
      <TracesToday />
    </OutcomeCard>
  );
}

/** What the played card did (stories 90–96), kept on the page for the rest of the game. */
export function CardOutcome({ card, play }: { card: SecretCard; play: ActivityEntry | null }) {
  const { team, clock } = useView();
  const today = clock.time.day;
  switch (card.id) {
    case "spying": {
      const report = team.cardEffects.spyReport;
      if (report) return <SpyReportView report={report} />;
      return (
        <OutcomeCard card={card} play={play} title="Espionnage effectué">
          <p>Le rapport d'espionnage n'est plus disponible.</p>
        </OutcomeCard>
      );
    }
    case "fake-news":
      return (
        <OutcomeCard
          card={card}
          play={play}
          title="Fausse news publiée"
          action={<GoTo to="/play/news">Lire le fil d'actualité</GoTo>}
        >
          <p>
            Elle est parue dans le fil d'actualité, sous le journal choisi, comme n'importe quelle
            news. Personne ne sait qu'elle vient de vous.
          </p>
          <p className="text-muted-foreground">
            L'organisateur peut la retirer s'il la juge inappropriée.
          </p>
        </OutcomeCard>
      );
    case "sabotage":
      return (
        <OutcomeCard card={card} play={play} title="Sabotage effectué">
          <p>
            Une machine de l'entreprise ciblée, tirée au hasard, s'est arrêtée pour{" "}
            {cardRules.sabotageDays} jours.{play ? ` ${sabotageNote(play.day, today)}` : ""}
          </p>
          <p className="text-muted-foreground">
            L'entreprise a été prévenue qu'elle avait subi une carte, sans savoir qui l'a jouée.
          </p>
        </OutcomeCard>
      );
    case "supplier-priority":
      return (
        <OutcomeCard
          card={card}
          play={play}
          title="Priorité obtenue"
          action={<GoTo to="/play/achats">Passer commande</GoTo>}
        >
          <p>
            Le jour de son prochain réapprovisionnement, le fournisseur choisi ne vend qu'à vous :
            son stock tout juste reconstitué vous est réservé toute la journée.
          </p>
          <p className="text-muted-foreground">
            Les autres entreprises savent seulement qu'un client prioritaire est servi.
          </p>
        </OutcomeCard>
      );
    case "social-peace": {
      const staff = workforceSummary(team.employees, today);
      return (
        <OutcomeCard
          card={card}
          play={play}
          title="Paix sociale"
          action={<GoTo to="/play/equipe">Voir l'équipe</GoTo>}
        >
          <p>
            Vos employés sont revenus à 100 % de rendement.{" "}
            {play
              ? freezeNote(play.day, today)
              : `Leur rendement ne baisse pas pendant ${hrRules.raiseGraceDays} jours après l'activation.`}
          </p>
          {staff.average === null ? null : (
            <p className="flex items-center gap-1.5 text-muted-foreground">
              Rendement moyen aujourd'hui :{" "}
              <span className="tabular font-medium text-foreground">{percent(staff.average)}</span>
              <InfoTip term="workforceEfficiency" />
            </p>
          )}
        </OutcomeCard>
      );
    }
    case "amnesty":
      return <AmnestyOutcome card={card} play={play} />;
  }
}
