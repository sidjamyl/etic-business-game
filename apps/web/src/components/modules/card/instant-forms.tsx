import { cardRules, hrRules } from "@etic/content";
import { TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { dayLabel, formatNumber, percent } from "@/lib/format";
import { useView } from "@/lib/game";
import { freezeUntil, plural, shieldUntil, workforceSummary } from "./card-math";
import { Fact } from "./fact";
import { PlayCardAction } from "./play-card-action";
import { usePlayCard } from "./use-play-card";

/** A point to check before playing (icon + words, never colour alone). */
function Caution({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/5 p-3 text-sm text-pretty">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/**
 * Social peace (story 95): every employee back to 100 %, and no efficiency drop for the grace
 * period of a raise (R6), as if everyone had just been given one.
 */
export function SocialPeaceForm() {
  const view = useView();
  const { play, locked } = usePlayCard();
  const { team } = view;
  const today = view.clock.time.day;
  const staff = workforceSummary(team.employees, today);
  const until = freezeUntil(today);
  const onStrike = team.hr.unpaidWages > 0;
  const arriving = staff.total - staff.present;
  const cautions = [
    staff.total === 0
      ? "Vous n'avez encore aucun employé : la carte n'aurait aucun effet aujourd'hui."
      : null,
    onStrike
      ? "La paix sociale ne met pas fin à une grève : réglez d'abord les salaires dus."
      : null,
  ].filter((text): text is string => text !== null);

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-3">
        <Fact
          label="Employés"
          value={formatNumber(staff.total)}
          hint={arriving > 0 ? `dont ${arriving} en route` : "tous au travail"}
        />
        <Fact
          label="Rendement moyen"
          value={staff.average === null ? "—" : percent(staff.average)}
          info="workforceEfficiency"
          hint={
            staff.belowFull > 0
              ? `${plural(staff.belowFull, "employé", "employés")} sous 100 %`
              : "Personne sous 100 %"
          }
        />
        <Fact label="Baisse gelée jusqu'au" value={dayLabel(until)} hint="Après activation" />
      </dl>
      {cautions.map((text) => (
        <Caution key={text}>{text}</Caution>
      ))}
      <PlayCardAction
        locked={locked}
        ready
        hint={`Choisissez le bon moment : la baisse peut reprendre ${hrRules.raiseGraceDays} jours après l'activation.`}
        title="Jouer « Paix sociale » ?"
        description="Tous vos employés reviennent aussitôt à 100 % de rendement."
        consequences={[
          staff.total === 0
            ? "Aucun employé concerné pour l'instant."
            : `${plural(staff.total, "employé concerné", "employés concernés")}${arriving > 0 ? ", y compris ceux en route" : ""}.`,
          `Aucune baisse de rendement avant le ${dayLabel(until).toLowerCase()}, même sans augmentation.`,
        ]}
        confirmLabel="Jouer la carte"
        onConfirm={() =>
          play({ kind: "social-peace" }, "Paix sociale : tous vos employés sont à 100 %.")
        }
      >
        {cautions.map((text) => (
          <Caution key={text}>{text}</Caution>
        ))}
      </PlayCardAction>
    </form>
  );
}

/**
 * Amnesty (story 96): black-market traces wiped now, and the next accusation against the
 * company within the shield period is cancelled without a scandal (N18).
 */
export function AmnestyForm() {
  const view = useView();
  const { play, locked } = usePlayCard();
  const today = view.clock.time.day;
  const traces = view.blackMarket.recentTraces;
  const until = shieldUntil(today);

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate className="space-y-5">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Fact
          label="Traces récentes"
          value={formatNumber(traces)}
          info="traces"
          hint={traces > 0 ? "Effacées dès l'activation" : "Aucune pour l'instant"}
        />
        <Fact
          label="Bouclier jusqu'au"
          value={dayLabel(until)}
          hint={`${cardRules.amnestyShieldDays} jours après l'activation`}
        />
      </dl>
      <p className="text-sm text-pretty text-muted-foreground">
        Les affaires conclues au marché noir après l'activation laissent de nouvelles traces. Le
        bouclier n'annule qu'une seule accusation.
      </p>
      <PlayCardAction
        locked={locked}
        ready
        hint={`Le bouclier dure ${cardRules.amnestyShieldDays} jours à partir de l'activation : choisissez le bon moment.`}
        title="Jouer « Amnistie » ?"
        description="Vos traces de marché noir disparaissent et vous êtes protégés contre la prochaine accusation."
        consequences={[
          traces === 0
            ? "Aucune trace à effacer aujourd'hui : le bouclier vous protège d'avance."
            : `${plural(traces, "trace effacée", "traces effacées")} aujourd'hui.`,
          `Jusqu'au ${dayLabel(until).toLowerCase()}, la prochaine accusation contre vous est classée sans suite, sans scandale.`,
        ]}
        confirmLabel="Jouer la carte"
        onConfirm={() =>
          play({ kind: "amnesty" }, "Amnistie : vos traces sont effacées, le bouclier est actif.")
        }
      />
    </form>
  );
}
