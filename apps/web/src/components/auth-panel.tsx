import { useForm } from "@tanstack/react-form";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { FormField } from "@/components/form-field";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient, authErrorMessage } from "@/lib/auth-client";
import { homeFor, refreshSession } from "@/lib/session";
import { useTRPC } from "@/lib/trpc";

const email = z.email("Adresse e-mail invalide.");
const password = z.string().min(8, "Au moins 8 caractères.");
const signInSchema = z.object({ email, password: z.string().min(1, "Mot de passe requis.") });
const signUpSchema = z.object({
  name: z.string().trim().min(1, "Votre prénom est requis.").max(40, "Prénom trop long."),
  email,
  password,
});

/** Sign-in and sign-up (P6, N30): Google when configured, e-mail and password otherwise. */
export function AuthPanel() {
  const trpc = useTRPC();
  const config = useQuery(trpc.config.queryOptions());
  const router = useRouter();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const goHome = async () => {
    const user = await refreshSession(router.options.context);
    await navigate({ to: user ? homeFor(user.role) : "/" });
  };

  const signIn = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await authClient.signIn.email(value);
      if (result.error) return setError(authErrorMessage(result.error));
      await goHome();
    },
  });

  const signUp = useForm({
    defaultValues: { name: "", email: "", password: "" },
    validators: { onSubmit: signUpSchema },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await authClient.signUp.email({ ...value, name: value.name.trim() });
      if (result.error) return setError(authErrorMessage(result.error));
      await goHome();
    },
  });

  return (
    <div className="w-full max-w-sm">
      <p className="eyebrow text-power-red">Connexion</p>
      <h2 className="mt-2 text-2xl font-bold uppercase">Rejoindre la partie</h2>

      {config.data?.google ? (
        <>
          <Button
            type="button"
            variant="outline"
            className="mt-6 w-full"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: "/" })}
          >
            Continuer avec Google
          </Button>
          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <Separator className="flex-1" />
            ou
            <Separator className="flex-1" />
          </div>
        </>
      ) : (
        <div className="h-6" />
      )}

      <Tabs defaultValue="sign-in" onValueChange={() => setError(null)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sign-in">Se connecter</TabsTrigger>
          <TabsTrigger value="sign-up">Créer un compte</TabsTrigger>
        </TabsList>

        <TabsContent value="sign-in">
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void signIn.handleSubmit();
            }}
          >
            <signIn.Field name="email">
              {(field) => (
                <FormField field={field} label="E-mail" type="email" autoComplete="email" />
              )}
            </signIn.Field>
            <signIn.Field name="password">
              {(field) => (
                <FormField
                  field={field}
                  label="Mot de passe"
                  type="password"
                  autoComplete="current-password"
                />
              )}
            </signIn.Field>
            <signIn.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Connexion…" : "Se connecter"}
                </Button>
              )}
            </signIn.Subscribe>
          </form>
        </TabsContent>

        <TabsContent value="sign-up">
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              void signUp.handleSubmit();
            }}
          >
            <signUp.Field name="name">
              {(field) => (
                <FormField
                  field={field}
                  label="Prénom"
                  autoComplete="given-name"
                  placeholder="Affiché dans le jeu"
                />
              )}
            </signUp.Field>
            <signUp.Field name="email">
              {(field) => (
                <FormField field={field} label="E-mail" type="email" autoComplete="email" />
              )}
            </signUp.Field>
            <signUp.Field name="password">
              {(field) => (
                <FormField
                  field={field}
                  label="Mot de passe"
                  type="password"
                  autoComplete="new-password"
                  placeholder="8 caractères minimum"
                />
              )}
            </signUp.Field>
            <signUp.Subscribe selector={(state) => state.isSubmitting}>
              {(submitting) => (
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Création…" : "Créer mon compte"}
                </Button>
              )}
            </signUp.Subscribe>
          </form>
        </TabsContent>
      </Tabs>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
