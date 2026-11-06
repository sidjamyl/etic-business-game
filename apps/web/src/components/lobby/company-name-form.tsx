import { startRules } from "@etic/content";
import { revalidateLogic, useForm } from "@tanstack/react-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGameCommand } from "@/lib/commands";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { companyNameSchema, firstErrorMessage } from "./lobby-helpers";

/** Company name, shared by the whole team and visible to everyone (R21). */
export function CompanyNameForm() {
  const current = useView().team.companyName;
  // Remounted when the name changes (saved here or by a teammate), so the field shows it.
  return <CompanyNameEditor key={current ?? ""} current={current} />;
}

function CompanyNameEditor({ current }: { current: string | null }) {
  const view = useView();
  const { send, pending } = useGameCommand();
  // Lobby commands are allowed while useCanAct() is false: gate them on the lobby itself.
  const editable = view.clock.status === "lobby";
  const maxLength = startRules.companyNameMaxLength;

  const form = useForm({
    defaultValues: { companyName: current ?? "" },
    validationLogic: revalidateLogic(),
    validators: { onDynamic: companyNameSchema },
    onSubmit: async ({ value }) => {
      await send(
        "lobby.setCompanyName",
        { companyName: value.companyName.trim() },
        { success: "Nom de l'entreprise enregistré." },
      );
    },
  });

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void form.handleSubmit();
      }}
    >
      <form.Field name="companyName">
        {(field) => {
          const error = firstErrorMessage(field.state.meta.errors);
          const unchanged = field.state.value.trim() === (current ?? "");
          return (
            <div className="grid gap-2">
              <Label htmlFor="company-name">Nom de votre entreprise</Label>
              <div className="flex gap-2">
                <Input
                  id="company-name"
                  name="companyName"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  maxLength={maxLength}
                  placeholder="Par exemple : Les Fourneaux du Nord"
                  autoComplete="off"
                  disabled={!editable}
                  aria-invalid={Boolean(error)}
                  aria-describedby="company-name-help"
                  className="bg-card"
                />
                <form.Subscribe selector={(state) => state.isSubmitting}>
                  {(submitting) => (
                    <Button
                      type="submit"
                      disabled={!editable || pending || submitting || unchanged}
                    >
                      {current ? "Renommer" : "Enregistrer"}
                    </Button>
                  )}
                </form.Subscribe>
              </div>
              <p id="company-name-help" className="flex justify-between gap-4 text-xs">
                <span className={cn(error ? "text-destructive" : "text-muted-foreground")}>
                  {error ??
                    "Visible par toutes les équipes et sur l'écran de la salle. Modifiable jusqu'au lancement."}
                </span>
                <span className="tabular shrink-0 text-muted-foreground">
                  {field.state.value.length}/{maxLength}
                </span>
              </p>
            </div>
          );
        }}
      </form.Field>
    </form>
  );
}
