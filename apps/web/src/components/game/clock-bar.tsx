import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { credits, dayLabel, stepLabel, timeLeft } from "@/lib/format";
import { useConnection, useGame, useTeamView } from "@/lib/game";
import { cn } from "@/lib/utils";

const connectionLabel = {
  live: "Connecté en temps réel",
  connecting: "Reconnexion…",
  error: "Connexion perdue, nouvelle tentative…",
} as const;

/** Shared clock, always visible (story 18): day, part of the day, real time left, cash. */
export function ClockBar() {
  const game = useGame();
  const view = useTeamView();
  const connection = useConnection();
  if (!view) return <span className="text-sm text-muted-foreground">Connexion à la partie…</span>;
  const { clock, team } = view;
  const progress = ((clock.time.step + 1) / clock.stepsPerDay) * 100;
  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 xl:gap-6">
      <div className="flex shrink-0 items-center gap-2 xl:gap-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              role="status"
              aria-label={connectionLabel[connection]}
              className={cn(
                "size-2.5 rounded-full",
                connection === "live"
                  ? "bg-success"
                  : connection === "error"
                    ? "bg-destructive"
                    : "animate-pulse bg-warning",
              )}
            />
          </TooltipTrigger>
          <TooltipContent>{connectionLabel[connection]}</TooltipContent>
        </Tooltip>
        <span className="tabular whitespace-nowrap font-display text-xl font-bold uppercase">
          {dayLabel(clock.time.day)}
        </span>
        <div className="w-20 shrink-0 xl:w-28">
          <Progress value={progress} aria-label="Avancement de la journée" className="h-1.5" />
          <span className="text-xs text-muted-foreground">
            {stepLabel(clock.time.step, clock.stepsPerDay)}
          </span>
        </div>
      </div>
      {clock.daysRemaining !== null && clock.status !== "ended" ? (
        <span
          className={cn(
            "tabular shrink-0 whitespace-nowrap text-sm",
            clock.countdown ? "font-semibold text-destructive" : "text-muted-foreground",
          )}
        >
          {clock.daysRemaining} j · {timeLeft(clock.daysRemaining, game.msPerDay)}
        </span>
      ) : null}
      <div className="ml-auto flex min-w-0 items-center gap-3 text-sm">
        <span className="max-w-24 truncate font-medium xl:max-w-48">
          {team.companyName ?? team.name}
        </span>
        <span className="tabular shrink-0 whitespace-nowrap font-semibold">
          {credits(team.cash)}
        </span>
      </div>
    </div>
  );
}
