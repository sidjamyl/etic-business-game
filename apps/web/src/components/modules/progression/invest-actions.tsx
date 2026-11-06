import type { Branch } from "@etic/content";
import { Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, GitFork, Rocket } from "lucide-react";
import { useId, useState } from "react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useGameCommand } from "@/lib/commands";
import { credits } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  branchIds,
  branchName,
  type InvestBlocker,
  machinesFor,
  otherBranch,
  productNames,
  recipeMaterials,
  tierProducts,
} from "./progression-math";

/** The development project on offer, as quoted to the team today. */
export interface InvestOffer {
  cost: number;
  days: number;
  /** Day the tier opens if the project starts today. */
  readyDay: number;
}

const demandReminder =
  "Débloquer le palier ne crée pas ses clients : la demande revient avec la reprise économique.";

/** Why the project cannot be financed right now, with a way out when there is one. */
function BlockerNote({ blocker }: { blocker: InvestBlocker | null }) {
  if (!blocker) return null;
  return (
    <p className="text-sm text-muted-foreground">
      {blocker.message}
      {blocker.kind === "cash" ? (
        <>
          {" "}
          <Link
            to="/play/finance"
            className="font-medium text-foreground underline underline-offset-4 hover:opacity-80"
          >
            Emprunter dans Finance
          </Link>
        </>
      ) : null}
    </p>
  );
}

/** Tier 2 (R2, story 52): one confirmation, then the project starts. */
export function TierTwoInvest({
  offer,
  blocker,
}: {
  offer: InvestOffer;
  blocker: InvestBlocker | null;
}) {
  const { send, pending } = useGameCommand();
  const label = `Financer le projet · ${credits(offer.cost)}`;

  async function invest(): Promise<boolean> {
    const result = await send(
      "progression.invest",
      { tier: 2 },
      { success: `Projet lancé : palier 2 disponible le jour ${offer.readyDay}.` },
    );
    return result.ok;
  }

  return (
    <div className="space-y-2">
      {/* Unmounted while blocked: a pause closes an open confirmation. */}
      {blocker ? (
        <Button size="lg" disabled>
          <Rocket aria-hidden />
          {label}
        </Button>
      ) : (
        <ConfirmDialog
          trigger={
            <Button size="lg" disabled={pending}>
              <Rocket aria-hidden />
              {label}
            </Button>
          }
          title="Financer le palier 2 ?"
          description="Le projet de développement est payé tout de suite et ne peut pas être annulé."
          consequences={[
            `${credits(offer.cost)} payés immédiatement.`,
            `${offer.days} jours de développement : palier 2 débloqué le jour ${offer.readyDay}.`,
            `Vous pourrez alors produire : ${productNames(tierProducts(2))}.`,
            demandReminder,
          ]}
          confirmLabel={`Payer ${credits(offer.cost)}`}
          onConfirm={invest}
        />
      )}
      <BlockerNote blocker={blocker} />
    </div>
  );
}

/**
 * Tier 3 (R1, R2, story 53): the irreversible branch choice in two steps. The team first
 * picks Tech or Loisirs, then confirms in a dialog that spells out what closes for good.
 */
export function BranchInvest({
  offer,
  blocker,
}: {
  offer: InvestOffer;
  blocker: InvestBlocker | null;
}) {
  const { send, pending } = useGameCommand();
  const [branch, setBranch] = useState<Branch | null>(null);
  const groupId = useId();
  const locked = blocker !== null;

  async function invest(chosen: Branch): Promise<boolean> {
    const result = await send(
      "progression.invest",
      { tier: 3, branch: chosen },
      {
        success: `Branche ${branchName(chosen)} choisie : palier 3 disponible le jour ${offer.readyDay}.`,
      },
    );
    return result.ok;
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p id={`${groupId}-step-1`} className="eyebrow text-muted-foreground">
          Étape 1 · Choisissez votre branche
        </p>
        <RadioGroup
          value={branch ?? ""}
          onValueChange={(value) => {
            const picked = branchIds.find((id) => id === value);
            if (picked) setBranch(picked);
          }}
          disabled={locked}
          aria-labelledby={`${groupId}-step-1`}
          className="grid gap-3 md:grid-cols-2"
        >
          {branchIds.map((id) => (
            <BranchOption
              key={id}
              id={`${groupId}-${id}`}
              branch={id}
              selected={branch === id}
              disabled={locked}
            />
          ))}
        </RadioGroup>
        <p className="text-sm text-muted-foreground">
          Une seule branche par entreprise : l'autre vous sera fermée jusqu'à la fin de la partie.
        </p>
      </div>
      <div className="space-y-2">
        <p className="eyebrow text-muted-foreground">Étape 2 · Confirmez votre choix</p>
        {branch && !blocker ? (
          <ConfirmDialog
            trigger={
              <Button size="lg" disabled={pending}>
                <GitFork aria-hidden />
                Investir dans la branche {branchName(branch)}…
              </Button>
            }
            title={`Choisir la branche ${branchName(branch)} ?`}
            description="Choix définitif : il engage votre entreprise jusqu'à la fin de la partie."
            consequences={[
              `Définitif : la branche ${branchName(otherBranch(branch))} vous sera fermée. Vous ne pourrez jamais produire : ${productNames(tierProducts(3, otherBranch(branch)))}.`,
              `${credits(offer.cost)} payés immédiatement, sans annulation possible.`,
              `${offer.days} jours de développement : palier 3 débloqué le jour ${offer.readyDay}.`,
              demandReminder,
            ]}
            confirmLabel={`Choisir ${branchName(branch)} et payer ${credits(offer.cost)}`}
            onConfirm={() => invest(branch)}
          >
            <BranchVerdict branch={branch} />
          </ConfirmDialog>
        ) : (
          <Button size="lg" disabled>
            <GitFork aria-hidden />
            {branch ? `Investir dans la branche ${branchName(branch)}…` : "Choisissez une branche"}
          </Button>
        )}
        <BlockerNote blocker={blocker} />
      </div>
    </div>
  );
}

/** One branch as a selectable card: its product, materials and machine (R1, N7). */
function BranchOption({
  id,
  branch,
  selected,
  disabled,
}: {
  id: string;
  branch: Branch;
  selected: boolean;
  disabled: boolean;
}) {
  return (
    // The dotted shadow sits on a wrapper so the card's background hides it (DESIGN.md §5).
    <div className={cn("rounded-xl", selected && "shadow-dotted")}>
      <label
        htmlFor={id}
        className={cn(
          "flex h-full flex-col gap-3 rounded-xl border bg-card p-4 transition-colors",
          disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:border-foreground/40",
          selected && "border-primary ring-1 ring-primary hover:border-primary",
        )}
      >
        <span className="flex items-center gap-2">
          <RadioGroupItem id={id} value={branch} />
          <span className="font-display text-lg font-bold uppercase">{branchName(branch)}</span>
        </span>
        {tierProducts(3, branch).map((product) => (
          <span key={product.id} className="grid gap-1 pl-6 text-sm">
            <span className="font-medium">{product.name}</span>
            <span className="text-muted-foreground">
              Matières : {recipeMaterials(product).join(", ")}
            </span>
            <span className="text-muted-foreground">
              Machine : {machinesFor(product.id).join(", ")}
            </span>
          </span>
        ))}
      </label>
    </div>
  );
}

/** What the confirmation commits to: the chosen branch, and the one closed for good. */
function BranchVerdict({ branch }: { branch: Branch }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {branchIds.map((id) => {
        const chosen = id === branch;
        const Icon = chosen ? CheckCircle2 : Ban;
        return (
          <li
            key={id}
            className={cn(
              "rounded-lg border p-3 text-sm",
              chosen ? "border-success/50 bg-success/5" : "border-dashed bg-muted/50",
            )}
          >
            <span
              className={cn(
                "flex items-center gap-1.5 font-medium",
                chosen ? "text-success" : "text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden />
              {chosen ? "Votre branche" : "Fermée pour toujours"}
            </span>
            <span className="mt-1 block font-display font-bold uppercase">{branchName(id)}</span>
            <span className={cn("block", !chosen && "text-muted-foreground line-through")}>
              {productNames(tierProducts(3, id))}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
