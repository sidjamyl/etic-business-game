import { timingRules } from "@etic/content";
import type { ClockView } from "@etic/engine";
import { useMutation } from "@tanstack/react-query";
import { AlarmClock, AlertTriangle } from "lucide-react";
import { type FormEvent, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdminGameId } from "@/lib/admin";
import { timeLeft } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";
import { endTimeToday } from "./control-room-helpers";
import { runOrganizerAction } from "./organizer-action";

/**
 * Wall-clock end of the game (P8, R19), set or removed during the game. The server turns it
 * into a last simulated day, recomputed at every resume.
 */
export function EndTimeControl({
  clock,
  msPerDay,
  endsAt,
}: {
  clock: ClockView;
  msPerDay: number;
  endsAt: string | null;
}) {
  const gameId = useAdminGameId();
  const trpc = useTRPC();
  const setEndsAt = useMutation(trpc.admin.setEndsAt.mutationOptions());
  const [open, setOpen] = useState(false);
  const [time, setTime] = useState(() =>
    endsAt
      ? new Date(endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : "18:00",
  );
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = endTimeToday(time, new Date());
    if (!result.ok) {
      setError(result.message);
      return;
    }
    const ok = await runOrganizerAction(
      () => setEndsAt.mutateAsync({ gameId, endsAt: result.endsAt.toISOString() }),
      `Fin de partie fixée à ${time.slice(0, 5)}.`,
    );
    if (ok) setOpen(false);
  };

  const clear = async () => {
    const ok = await runOrganizerAction(
      () => setEndsAt.mutateAsync({ gameId, endsAt: null }),
      "Heure de fin retirée : vous clôturerez la partie à la main.",
    );
    if (ok) setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline">
          <AlarmClock aria-hidden />
          Heure de fin
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-4">
        <div className="space-y-1">
          <p className="font-medium">Heure de fin</p>
          <p className="text-sm text-muted-foreground">
            {clock.endDay === null ? (
              "Aucune fin prévue : vous clôturerez la partie à la main."
            ) : (
              <>
                Fin prévue à la fin du <span className="tabular">jour {clock.endDay}</span>
                {clock.daysRemaining !== null ? (
                  <>
                    , soit{" "}
                    <span className="tabular">{timeLeft(clock.daysRemaining, msPerDay)}</span> de
                    jeu
                  </>
                ) : null}
                .
              </>
            )}
          </p>
        </div>
        <form noValidate onSubmit={submit} className="grid gap-1.5">
          <Label htmlFor={inputId}>Terminer aujourd'hui à</Label>
          <div className="flex gap-2">
            <Input
              id={inputId}
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? errorId : undefined}
              className="w-32 dark:[color-scheme:dark]"
            />
            <Button type="submit" disabled={setEndsAt.isPending}>
              Fixer
            </Button>
          </div>
          {error ? (
            <p id={errorId} role="alert" className="flex items-start gap-1.5 text-xs">
              <AlertTriangle className="mt-px size-3.5 shrink-0 text-destructive" aria-hidden />
              {error}
            </p>
          ) : null}
        </form>
        {clock.endDay !== null ? (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            disabled={setEndsAt.isPending}
            onClick={() => void clear()}
          >
            Retirer l'heure de fin
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          La durée est recalculée à chaque reprise : une pause raccourcit la partie au lieu de
          repousser l'heure de fin. Les {timingRules.countdownDays} derniers jours, un compte à
          rebours s'affiche pour les équipes et sur l'écran de la salle.
        </p>
      </PopoverContent>
    </Popover>
  );
}
