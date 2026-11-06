import { type AnyFieldApi, revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { AlertTriangle, Plus, Sparkles, X } from "lucide-react";
import { type ComponentProps, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { timeLeft } from "@/lib/format";
import { useTRPC } from "@/lib/trpc";
import {
  createGameSchema,
  defaultCreateGameValues,
  errorMessage,
  firstErrorMessage,
  LOBBY_LIMITS,
  nextTeamName,
  parseWholeNumber,
  teamDraft,
  toCreateGameInput,
} from "./lobby-helpers";

/** A validation message. On the dark organizer theme the text stays light (DESIGN.md §3). */
function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={id} className="flex items-start gap-1.5 text-xs text-destructive dark:text-foreground">
        <AlertTriangle className="mt-px size-3.5 shrink-0 text-destructive" aria-hidden />
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="text-xs text-muted-foreground">
      {hint}
    </p>
  ) : null;
}

/** A labelled text or number input bound to a TanStack Form field (values kept as text). */
function TextField({
  field,
  label,
  hint,
  labelClassName,
  ...inputProps
}: {
  field: AnyFieldApi;
  label: string;
  hint?: string;
  labelClassName?: string;
} & Omit<ComponentProps<typeof Input>, "id" | "name" | "value" | "onChange" | "onBlur">) {
  const id = useId();
  const error = firstErrorMessage(field.state.meta.errors);
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className={labelClassName}>
        {label}
      </Label>
      <Input
        id={id}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        {...inputProps}
      />
      <FieldMessage id={`${id}-message`} error={error} hint={hint} />
    </div>
  );
}

/** Game creation (P3, O4, P10): name, teams, member cap and the optional rehearsal mode. */
export function CreateGameForm() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const createGame = useMutation(trpc.admin.createGame.mutationOptions());
  // Built once: new team keys on every render would reset the untouched form.
  const [defaultValues] = useState(defaultCreateGameValues);

  const form = useForm({
    defaultValues,
    validationLogic: revalidateLogic(),
    validators: { onDynamic: createGameSchema },
    onSubmit: async ({ value }) => {
      try {
        const { gameId } = await createGame.mutateAsync(toCreateGameInput(value));
        void queryClient.invalidateQueries(trpc.admin.games.queryFilter());
        toast.success(`Partie « ${value.name.trim()} » créée.`);
        await navigate({ to: "/admin/games/$gameId", params: { gameId } });
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
  });

  return (
    <form
      noValidate
      className="grid gap-6"
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="name">
        {(field) => (
          <TextField
            field={field}
            label="Nom de la partie"
            placeholder="Journée d'intégration ETIC"
            maxLength={LOBBY_LIMITS.gameName}
            autoComplete="off"
          />
        )}
      </form.Field>

      <fieldset className="grid gap-2" aria-describedby="teams-message">
        <legend className="mb-2 text-sm font-medium">Équipes</legend>
        <form.Field name="teams" mode="array">
          {(teamsField) => {
            const teams = teamsField.state.value;
            const listError = firstErrorMessage(teamsField.state.meta.errors);
            return (
              <>
                <ol className="grid gap-2">
                  {teams.map((team, index) => (
                    <li key={team.key} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="tabular mt-2 w-5 shrink-0 text-right text-sm text-muted-foreground"
                      >
                        {index + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <form.Field name={`teams[${index}].name`}>
                          {(field) => (
                            <TextField
                              field={field}
                              label={`Nom de l'équipe ${index + 1}`}
                              labelClassName="sr-only"
                              maxLength={LOBBY_LIMITS.teamName}
                              autoComplete="off"
                            />
                          )}
                        </form.Field>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Retirer l'équipe ${index + 1}${team.name.trim() ? ` (${team.name.trim()})` : ""}`}
                        disabled={teams.length <= LOBBY_LIMITS.minTeams}
                        onClick={() => teamsField.removeValue(index)}
                      >
                        <X aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ol>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={teams.length >= LOBBY_LIMITS.maxTeams}
                    onClick={() =>
                      teamsField.pushValue(teamDraft(nextTeamName(teams.map((t) => t.name))))
                    }
                  >
                    <Plus aria-hidden />
                    Ajouter une équipe
                  </Button>
                  <span className="tabular text-xs text-muted-foreground">
                    {teams.length} / {LOBBY_LIMITS.maxTeams}
                  </span>
                </div>
                <FieldMessage
                  id="teams-message"
                  error={listError}
                  hint="De 2 à 12 équipes. Chacune reçoit un code à distribuer."
                />
              </>
            );
          }}
        </form.Field>
      </fieldset>

      <form.Field name="memberCap">
        {(field) => (
          <TextField
            field={field}
            label="Membres par équipe, au maximum"
            hint="4 par défaut, modifiable ensuite depuis le lobby."
            type="number"
            inputMode="numeric"
            min={LOBBY_LIMITS.minMemberCap}
            max={LOBBY_LIMITS.maxMemberCap}
            className="w-24"
          />
        )}
      </form.Field>

      {/* Rehearsal mode (P10, P12): faster clock and fixed duration. */}
      <div className="grid gap-4 rounded-lg border p-4">
        <form.Field name="rehearsal">
          {(field) => (
            <div className="flex items-start gap-3">
              <Switch
                id="rehearsal-mode"
                checked={field.state.value}
                onCheckedChange={(checked) => field.handleChange(checked)}
                aria-describedby="rehearsal-mode-help"
                className="mt-0.5"
              />
              <div className="grid gap-1">
                <Label htmlFor="rehearsal-mode">Partie de répétition</Label>
                <p id="rehearsal-mode-help" className="text-xs text-muted-foreground">
                  Horloge accélérée et durée fixe, pour tester le jeu sans y passer la journée. La
                  vraie partie se joue à un jour simulé par minute.
                </p>
              </div>
            </div>
          )}
        </form.Field>
        <form.Subscribe selector={(state) => state.values.rehearsal}>
          {(rehearsal) =>
            rehearsal ? (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <form.Field name="secondsPerDay">
                    {(field) => (
                      <TextField
                        field={field}
                        label="Secondes par jour simulé"
                        type="number"
                        inputMode="numeric"
                        min={LOBBY_LIMITS.minSecondsPerDay}
                        max={LOBBY_LIMITS.maxSecondsPerDay}
                      />
                    )}
                  </form.Field>
                  <form.Field name="durationDays">
                    {(field) => (
                      <TextField
                        field={field}
                        label="Durée en jours simulés"
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={LOBBY_LIMITS.maxDurationDays}
                      />
                    )}
                  </form.Field>
                </div>
                <form.Subscribe
                  selector={(state) => [state.values.secondsPerDay, state.values.durationDays]}
                >
                  {([seconds = "", days = ""]) => (
                    <RehearsalPreview seconds={seconds} days={days} />
                  )}
                </form.Subscribe>
              </>
            ) : null
          }
        </form.Subscribe>
      </div>

      <form.Subscribe selector={(state) => state.isSubmitting}>
        {(submitting) => (
          <Button type="submit" size="lg" disabled={submitting}>
            <Sparkles aria-hidden />
            {submitting ? "Création…" : "Créer la partie"}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}

/** Real duration of a rehearsal, e.g. "≈ 1 h" for 360 days at 10 s per day. */
function RehearsalPreview({ seconds, days }: { seconds: string; days: string }) {
  const secondsPerDay = parseWholeNumber(seconds);
  const durationDays = parseWholeNumber(days);
  if (!secondsPerDay || !durationDays) return null;
  return (
    <p className="text-sm" aria-live="polite">
      Durée réelle :{" "}
      <span className="tabular font-semibold">{timeLeft(durationDays, secondsPerDay * 1000)}</span>{" "}
      de jeu, sans compter les pauses.
    </p>
  );
}
