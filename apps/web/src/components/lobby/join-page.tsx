import { revalidateLogic, useForm } from "@tanstack/react-form";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { AlertTriangle, LogIn } from "lucide-react";
import { toast } from "sonner";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UserMenu } from "@/components/user-menu";
import { refreshCurrentGames } from "@/lib/session";
import { useTRPC } from "@/lib/trpc";
import {
  describeJoinFailure,
  errorCode,
  errorMessage,
  firstErrorMessage,
  joinCodeSchema,
  LOBBY_LIMITS,
} from "./lobby-helpers";

/** Team code entry (P7) for a signed-in player without a game, in the home page's style. */
export function JoinPage() {
  return (
    <main className="grid min-h-dvh bg-power-red text-milk md:grid-cols-[1.2fr_1fr]">
      <section className="flex flex-col justify-between p-10 md:p-16">
        <Logo inverted />
        <div>
          <p className="eyebrow opacity-80">Club ETIC · Journée d'intégration</p>
          <h1 className="mt-4 text-5xl leading-[0.95] font-bold uppercase md:text-6xl xl:text-7xl">
            Rejoignez
            <br />
            <span className="text-cacao">votre équipe</span>
          </h1>
          <p className="mt-6 max-w-md text-lg opacity-90">
            L'organisateur remet un code à chaque équipe. Saisissez le vôtre une seule fois : vous
            resterez dans cette équipe pendant toute la partie.
          </p>
        </div>
        <p className="text-sm opacity-70">Une équipe par participant et par partie.</p>
      </section>
      <section className="relative grid place-items-center bg-milk p-10 text-night">
        <div className="absolute top-6 right-6">
          <UserMenu />
        </div>
        <JoinForm />
      </section>
    </main>
  );
}

function JoinForm() {
  const trpc = useTRPC();
  const router = useRouter();
  const navigate = useNavigate();
  const join = useMutation(trpc.game.join.mutationOptions());

  const form = useForm({
    defaultValues: { code: "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: joinCodeSchema },
    onSubmit: async ({ value }) => {
      // A refusal or an error is shown under the field, from the mutation state.
      const joined = await join.mutateAsync({ code: value.code.trim() }).catch(() => null);
      if (!joined?.ok) return;
      try {
        await refreshCurrentGames(router.options.context);
        await navigate({ to: "/play" });
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
  });

  // "Code invalide." comes as a NOT_FOUND error, "Équipe complète." as a refusal (O4).
  const failure = join.error
    ? describeJoinFailure(errorCode(join.error), join.error.message)
    : join.data && !join.data.ok
      ? describeJoinFailure(join.data.refusal.code, join.data.refusal.message)
      : null;

  return (
    <div className="w-full max-w-sm">
      <p className="eyebrow text-power-red">Code d'équipe</p>
      <h2 className="mt-2 text-2xl font-bold uppercase">Entrez votre code</h2>

      <form
        className="mt-6 grid gap-4"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <form.Field name="code">
          {(field) => {
            const error = firstErrorMessage(field.state.meta.errors);
            return (
              <div className="grid gap-2">
                <Label htmlFor="join-code">Code de votre équipe</Label>
                <Input
                  id="join-code"
                  name="code"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => {
                    if (join.data || join.error) join.reset();
                    field.handleChange(event.target.value);
                  }}
                  placeholder="LYNX-42"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={LOBBY_LIMITS.joinCode}
                  aria-invalid={Boolean(error ?? failure)}
                  aria-describedby="join-code-help"
                  className="h-14 bg-white text-center font-display text-3xl tracking-[0.18em] uppercase placeholder:text-night/25 md:text-3xl"
                />
                <p
                  id="join-code-help"
                  className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
                >
                  {error ?? "Un mot et deux chiffres, majuscules ou minuscules."}
                </p>
              </div>
            );
          }}
        </form.Field>

        {failure ? (
          <div
            role="alert"
            className="flex gap-3 rounded-md bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">{failure.message}</p>
              {failure.hint ? <p className="mt-0.5 text-foreground/80">{failure.hint}</p> : null}
            </div>
          </div>
        ) : null}

        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(submitting) => (
            <Button type="submit" size="lg" disabled={submitting}>
              <LogIn aria-hidden />
              {submitting ? "Connexion à l'équipe…" : "Rejoindre l'équipe"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      <ul className="mt-8 space-y-2 text-sm text-muted-foreground">
        <li>
          Vous avez rejoint votre équipe avec un autre compte ? Déconnectez-vous, puis
          reconnectez-vous avec ce compte-là : votre équipe vous attend.
        </li>
        <li>Pour changer d'équipe, adressez-vous à l'organisateur.</li>
      </ul>
    </div>
  );
}
