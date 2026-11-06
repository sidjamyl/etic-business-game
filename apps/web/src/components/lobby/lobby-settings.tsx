import type { ClockView } from "@etic/engine";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, Minus, MonitorPlay, Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminGameId } from "@/lib/admin";
import { timeLeft } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";
import type { AdminTeam } from "./admin-team-card";
import { CopyButton } from "./copy-button";
import { endTimeToday, joinFrench, LOBBY_LIMITS } from "./lobby-helpers";
import { runOrganizerAction } from "./organizer-action";

/** Member cap per team (O4): adjustable at any time; a full team refuses its code. */
export function MemberCapCard({ memberCap, teams }: { memberCap: number; teams: AdminTeam[] }) {
  const gameId = useAdminGameId();
  const trpc = useTRPC();
  const setCap = useMutation(trpc.admin.setMemberCap.mutationOptions());
  const change = (next: number) =>
    void runOrganizerAction(() => setCap.mutateAsync({ gameId, memberCap: next }));
  const over = teams.filter((team) => team.members.length > memberCap);
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle id="member-cap-title" className="eyebrow text-muted-foreground">
          Membres par équipe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        <fieldset aria-labelledby="member-cap-title" className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            aria-label="Un membre de moins par équipe"
            disabled={setCap.isPending || memberCap <= LOBBY_LIMITS.minMemberCap}
            onClick={() => change(memberCap - 1)}
          >
            <Minus aria-hidden />
          </Button>
          <output
            aria-live="polite"
            className="tabular w-10 text-center font-display text-3xl font-bold"
          >
            {memberCap}
          </output>
          <Button
            variant="outline"
            size="icon"
            aria-label="Un membre de plus par équipe"
            disabled={setCap.isPending || memberCap >= LOBBY_LIMITS.maxMemberCap}
            onClick={() => change(memberCap + 1)}
          >
            <Plus aria-hidden />
          </Button>
          <span className="text-sm text-muted-foreground">au maximum</span>
        </fieldset>
        {over.length > 0 ? (
          <p className="flex items-start gap-2 text-xs text-warning">
            <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
            {over.length === 1
              ? `${joinFrench(over.map((team) => team.name))} dépasse déjà ce plafond : personne ne pourra la rejoindre.`
              : `${joinFrench(over.map((team) => team.name))} dépassent déjà ce plafond : personne ne pourra les rejoindre.`}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Une équipe complète refuse son code avec le message « Équipe complète ».
        </p>
      </CardContent>
    </Card>
  );
}

/** Optional wall-clock end of the game (P8, R19); otherwise the organizer ends it by hand. */
export function EndTimeCard({
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
  const [time, setTime] = useState(() =>
    endsAt
      ? new Date(endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
      : "18:00",
  );
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = endTimeToday(time, new Date());
    if (!result.ok) {
      setError(result.message);
      return;
    }
    await runOrganizerAction(
      () => setEndsAt.mutateAsync({ gameId, endsAt: result.endsAt.toISOString() }),
      `Fin de partie fixée à ${time.slice(0, 5)}.`,
    );
  };

  const clear = () =>
    void runOrganizerAction(
      () => setEndsAt.mutateAsync({ gameId, endsAt: null }),
      "Fin prévue retirée : vous clôturerez la partie à la main.",
    );

  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="eyebrow text-muted-foreground">Fin de partie</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        <p className="text-sm">
          {endsAt ? (
            <>
              Fin prévue à{" "}
              <strong>
                {new Date(endsAt).toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </strong>
              .
            </>
          ) : clock.endDay === null ? (
            "Aucune fin prévue : vous clôturerez la partie à la main."
          ) : (
            <>
              Fin prévue au <span className="tabular font-semibold">jour {clock.endDay}</span>
              {clock.daysRemaining !== null ? (
                <>
                  , soit <span className="tabular">{timeLeft(clock.daysRemaining, msPerDay)}</span>{" "}
                  de jeu
                </>
              ) : null}
              .
            </>
          )}
        </p>
        <form noValidate onSubmit={submit} className="grid gap-1.5">
          <Label htmlFor="ends-at">Terminer aujourd'hui à</Label>
          <div className="flex gap-2">
            <Input
              id="ends-at"
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
                setError(null);
              }}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "ends-at-error" : undefined}
              className="w-32 dark:[color-scheme:dark]"
            />
            <Button type="submit" variant="secondary" disabled={setEndsAt.isPending}>
              Fixer
            </Button>
          </div>
          {error ? (
            <p id="ends-at-error" className="flex items-start gap-1.5 text-xs">
              <AlertTriangle className="mt-px size-3.5 shrink-0 text-destructive" aria-hidden />
              {error}
            </p>
          ) : null}
        </form>
        {endsAt !== null ? (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2"
            disabled={setEndsAt.isPending}
            onClick={clear}
          >
            Retirer la fin prévue
          </Button>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Avec une heure de fin, la durée est recalculée au lancement et à chaque reprise : une
          pause raccourcit la partie au lieu de repousser la fin.
        </p>
      </CardContent>
    </Card>
  );
}

/** Link to the projector screen (P10): public, no sign-in. */
export function ProjectorCard({ gameId }: { gameId: string }) {
  const url = `${window.location.origin}/screen/${gameId}`;
  return (
    <Card className="gap-3 py-5">
      <CardHeader className="px-5">
        <CardTitle className="eyebrow text-muted-foreground">Écran de la salle</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-5">
        <p className="text-sm text-muted-foreground">
          À ouvrir sur l'ordinateur relié au projecteur, sans connexion : horloge, news et
          événements, puis le classement final.
        </p>
        <div className="flex items-center gap-2 rounded-md border bg-background/60 py-1 pr-1 pl-3">
          <code className="min-w-0 flex-1 truncate text-xs select-all" title={url}>
            {url}
          </code>
          <CopyButton
            text={url}
            label="Copier le lien de l'écran de la salle"
            copiedMessage="Lien de l'écran copié."
            variant="ghost"
          />
        </div>
        <Button asChild variant="outline" size="sm" className="w-full">
          <Link to="/screen/$gameId" params={{ gameId }} target="_blank" rel="noreferrer">
            <MonitorPlay aria-hidden />
            Ouvrir l'écran dans un nouvel onglet
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
