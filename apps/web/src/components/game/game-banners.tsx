import { Link } from "@tanstack/react-router";
import { Flag, Hourglass, PauseCircle } from "lucide-react";
import { SettlementRulesDialog } from "@/components/end/settlement-rules";
import { useTeamView } from "@/lib/game";

/** Full-width banners under the clock: pause (O1), final countdown (R19), end of game. */
export function GameBanners() {
  const view = useTeamView();
  if (!view) return null;
  const { clock } = view;
  if (clock.status === "paused") {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 bg-power-red px-6 py-2 text-milk"
      >
        <PauseCircle className="size-4" aria-hidden />
        <span className="font-display font-bold uppercase">Jeu en pause</span>
        <span className="text-sm opacity-90">
          — consultation seulement, les décisions reprendront à la reprise.
        </span>
      </div>
    );
  }
  if (clock.status === "ended") {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-2 bg-night px-6 py-2 text-milk"
      >
        <Flag className="size-4" aria-hidden />
        <span className="font-display font-bold uppercase">Partie terminée</span>
        <span className="text-sm opacity-90">
          {view.results
            ? "— le classement final est sur le tableau de bord."
            : "— les résultats seront révélés sur l'écran de la salle."}
        </span>
        {/* A finished game stays current: players join the next one (e.g. after the rehearsal). */}
        <Link to="/join" className="ml-4 text-sm underline underline-offset-4 hover:opacity-80">
          Rejoindre une autre partie
        </Link>
      </div>
    );
  }
  if (clock.countdown && clock.daysRemaining !== null) {
    return (
      <div
        role="status"
        className="flex items-center justify-center gap-3 bg-cacao px-6 py-2 text-milk"
      >
        <Hourglass className="size-4" aria-hidden />
        <span className="font-display font-bold uppercase">
          Compte à rebours final : {clock.daysRemaining} jours
        </span>
        <SettlementRulesDialog />
      </div>
    );
  }
  return null;
}
