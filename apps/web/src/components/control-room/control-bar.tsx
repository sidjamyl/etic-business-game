import type { ClockView, GameStatus } from "@etic/engine";
import { useMutation } from "@tanstack/react-query";
import { Activity, Clock, Flag, Hourglass, type LucideIcon, Pause, Play } from "lucide-react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useAdminGameId } from "@/lib/admin";
import { dayLabel, stepLabel, timeLeft } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";
import { Pill, type PillTone } from "./bits";
import { EndTimeControl } from "./end-time-control";
import { runOrganizerAction } from "./organizer-action";

const statusDisplay: Record<GameStatus, { label: string; tone: PillTone; icon: LucideIcon }> = {
  lobby: { label: "Lobby", tone: "neutral", icon: Clock },
  running: { label: "En cours", tone: "success", icon: Activity },
  // Same Milk-on-red as the players' pause banner: the organizer must not forget to resume.
  paused: { label: "En pause", tone: "danger", icon: Pause },
  ended: { label: "Terminée", tone: "neutral", icon: Flag },
};

/** End-of-game settlement (R19), recalled before closing for good. */
const SETTLEMENT = [
  "Les décisions sont bloquées pour toutes les équipes et l'écran de la salle annonce la fin.",
  "Livraisons clients en route : non payées. Commandes fournisseurs non reçues : perdues.",
  "Contrats entre entreprises en transit : annulés, paiement rendu à l'acheteur. Enchères ouvertes : offres remboursées.",
  "Stocks, machines et production en cours ne valent plus rien ; la dette est déduite de la trésorerie nette.",
  "Vous révélerez ensuite le classement sur l'écran de la salle, de la dernière à la première place.",
];

/**
 * Shared clock and game controls, grouped and always visible while scrolling (DESIGN.md §6,
 * P8): pause, resume, end time and closing the game.
 */
export function ControlBar({
  clock,
  msPerDay,
  endsAt,
}: {
  clock: ClockView;
  msPerDay: number;
  endsAt: string | null;
}) {
  const status = statusDisplay[clock.status];
  const dayProgress = ((clock.time.step + 1) / clock.stepsPerDay) * 100;
  return (
    <section
      aria-label="Horloge et commandes de la partie"
      className="sticky top-0 z-20 -mx-6 border-y bg-background/95 px-6 py-3 backdrop-blur"
    >
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
        <div className="flex items-center gap-4">
          <Pill tone={status.tone} icon={status.icon} className="px-3 py-1 text-sm">
            {status.label}
          </Pill>
          <div>
            <p className="tabular font-display text-3xl leading-none font-bold uppercase">
              {dayLabel(clock.time.day)}
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <Progress
                value={dayProgress}
                aria-label="Avancement de la journée"
                className="h-1 w-24"
              />
              <span className="text-xs text-muted-foreground">
                {stepLabel(clock.time.step, clock.stepsPerDay)}
              </span>
            </div>
          </div>
        </div>
        <EndReadout clock={clock} msPerDay={msPerDay} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {clock.status === "running" || clock.status === "paused" ? (
            <GameControls status={clock.status} clock={clock} msPerDay={msPerDay} endsAt={endsAt} />
          ) : null}
          {clock.status === "ended" ? (
            <p className="text-sm text-muted-foreground">
              Horloge arrêtée : révélez le classement sur l'écran de la salle.
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Last simulated day, days and real time left, final countdown (R19). */
function EndReadout({ clock, msPerDay }: { clock: ClockView; msPerDay: number }) {
  return (
    <div className="space-y-1 text-sm">
      <p className="eyebrow text-muted-foreground">Fin de partie</p>
      {clock.status === "ended" ? (
        <p>
          Close au <span className="tabular font-semibold">jour {clock.time.day}</span>
        </p>
      ) : clock.endDay === null ? (
        <p>Pas d'heure de fin : clôture à la main</p>
      ) : (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="tabular font-semibold">Jour {clock.endDay}</span>
          {clock.daysRemaining !== null ? (
            <span className="tabular text-muted-foreground">
              · {clock.daysRemaining} j restants · {timeLeft(clock.daysRemaining, msPerDay)}
            </span>
          ) : null}
          {clock.countdown ? (
            <Pill tone="warning" icon={Hourglass}>
              Compte à rebours final
            </Pill>
          ) : null}
        </div>
      )}
    </div>
  );
}

/** Pause or resume (O1), end time, closing the game (P8). */
function GameControls({
  status,
  clock,
  msPerDay,
  endsAt,
}: {
  status: "running" | "paused";
  clock: ClockView;
  msPerDay: number;
  endsAt: string | null;
}) {
  const gameId = useAdminGameId();
  const trpc = useTRPC();
  const control = useMutation(trpc.admin.control.mutationOptions());
  const running = status === "running";

  const toggle = () =>
    void runOrganizerAction(
      () => control.mutateAsync({ gameId, action: running ? "pause" : "resume" }),
      running ? "Jeu en pause pour toutes les équipes." : "La partie reprend.",
    );

  const end = async () => {
    const ok = await runOrganizerAction(
      () => control.mutateAsync({ gameId, action: "end" }),
      "Partie clôturée : place à la révélation du classement.",
    );
    // Refused: keep the confirmation open next to the message.
    return ok ? undefined : false;
  };

  return (
    <>
      <Button onClick={toggle} disabled={control.isPending}>
        {running ? <Pause aria-hidden /> : <Play aria-hidden />}
        {running ? "Mettre en pause" : "Reprendre"}
      </Button>
      <EndTimeControl key={endsAt} clock={clock} msPerDay={msPerDay} endsAt={endsAt} />
      <ConfirmDialog
        trigger={
          <Button variant="destructive" disabled={control.isPending}>
            <Flag aria-hidden />
            Clôturer
          </Button>
        }
        title="Clôturer la partie ?"
        description={
          clock.endDay === null
            ? "L'horloge s'arrête pour de bon et le classement final est figé."
            : `La partie se clôturera déjà seule à la fin du jour ${clock.endDay}. Clôturer maintenant arrête l'horloge pour de bon et fige le classement final.`
        }
        consequences={SETTLEMENT}
        confirmLabel="Clôturer la partie"
        tone="danger"
        onConfirm={end}
      />
    </>
  );
}
