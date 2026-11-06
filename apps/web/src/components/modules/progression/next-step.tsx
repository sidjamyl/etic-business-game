import { progressionRules } from "@etic/content";
import { availableCash, type ProgressionState, type TeamView } from "@etic/engine";
import { Link } from "@tanstack/react-router";
import { Ban, CheckCircle2, Hourglass, ShoppingCart } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { credits, dayLabel, formatNumber, percent, timeLeft } from "@/lib/format";
import { useGame, useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import { BranchInvest, TierTwoInvest } from "./invest-actions";
import {
  branchIds,
  branchName,
  daysUntil,
  developmentProgress,
  investBlocker,
  isUnlockableTier,
  milestoneRatio,
  otherBranch,
  productNames,
  relativeDay,
  salesLabel,
  tierNames,
  tierProducts,
  type UnlockableTier,
} from "./progression-math";

type NextMilestone = NonNullable<TeamView["nextMilestone"]>;
type Project = NonNullable<ProgressionState["project"]>;

/**
 * What the company can do next (R2, stories 51–53): finance the next tier once its milestone
 * is met, follow the project in progress, or nothing left once tier 3 is reached.
 */
export function NextStep() {
  const { team, nextMilestone } = useView();
  const project = team.progression.project;
  if (project) return <ProjectInProgress project={project} />;
  if (!nextMilestone || !isUnlockableTier(nextMilestone.tier)) return <ProgressionComplete />;
  return <InvestPanel milestone={nextMilestone} tier={nextMilestone.tier} />;
}

function PanelHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <CardHeader className="gap-1">
      <p className="eyebrow text-power-red">{eyebrow}</p>
      <h2 className="text-2xl font-bold uppercase">{title}</h2>
      {children ? <div className="text-sm text-muted-foreground">{children}</div> : null}
    </CardHeader>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular font-medium">{value}</dd>
    </div>
  );
}

function InvestPanel({ milestone, tier }: { milestone: NextMilestone; tier: UnlockableTier }) {
  const { team, clock } = useView();
  const salesTier = progressionRules.tiers[tier].milestoneTier;
  const met = milestone.sold >= milestone.required;
  const available = availableCash(team);
  const blocker = investBlocker({
    status: clock.status,
    sold: milestone.sold,
    required: milestone.required,
    salesTier,
    cost: milestone.cost,
    available,
  });
  const offer = {
    cost: milestone.cost,
    days: milestone.days,
    readyDay: clock.time.day + milestone.days,
  };
  const products =
    tier === 3
      ? branchIds
          .map((branch) => `${branchName(branch)} : ${productNames(tierProducts(3, branch))}`)
          .join(" · ")
      : productNames(tierProducts(tier));

  return (
    // The milestone met makes this the decision of the moment: dotted shadow (DESIGN.md §5).
    <div className={cn("rounded-xl", met && "shadow-dotted")}>
      <Card className={cn("h-full", met && "border-primary/60")}>
        <PanelHeader eyebrow="Prochaine étape" title={`Palier ${tier} · ${tierNames[tier]}`}>
          {products}
        </PanelHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <MilestoneGauge sold={milestone.sold} required={milestone.required} tier={salesTier} />
            <div className="space-y-2">
              <p className="eyebrow text-muted-foreground">Projet de développement</p>
              <p className="tabular text-3xl font-semibold">{credits(milestone.cost)}</p>
              <p className="text-sm text-muted-foreground">
                Payé au lancement, sans annulation possible.
              </p>
              <dl className="grid gap-1 text-sm">
                <Figure label="Durée" value={`${milestone.days} jours`} />
                <Figure label="Prêt, si lancé aujourd'hui" value={dayLabel(offer.readyDay)} />
                <Figure label="Trésorerie disponible" value={credits(available)} />
              </dl>
            </div>
          </div>
          {tier === 3 ? (
            <BranchInvest offer={offer} blocker={blocker} />
          ) : (
            <TierTwoInvest offer={offer} blocker={blocker} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Units of the previous tier delivered and paid, against the milestone (R2). */
function MilestoneGauge({
  sold,
  required,
  tier,
}: {
  sold: number;
  required: number;
  tier: number;
}) {
  const met = sold >= required;
  const label = `Jalon de ventes : produits du palier ${tier} livrés et payés`;
  return (
    <div className="space-y-2">
      <p className="eyebrow text-muted-foreground">Jalon de ventes</p>
      <p className="tabular text-3xl font-semibold">
        {formatNumber(sold)}{" "}
        <span className="text-lg font-normal text-muted-foreground">
          / {formatNumber(required)}
        </span>
      </p>
      <p className="text-sm text-muted-foreground">produits du palier {tier} livrés et payés</p>
      <Progress
        value={milestoneRatio(sold, required) * 100}
        aria-label={label}
        getValueLabel={() => `${formatNumber(sold)} sur ${formatNumber(required)}`}
        className={cn(
          "h-2.5",
          met && "bg-success/20 [&>[data-slot=progress-indicator]]:bg-success",
        )}
      />
      {met ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          Jalon atteint
        </p>
      ) : (
        <p className="text-sm">
          Encore <span className="tabular font-medium">{salesLabel(required - sold)}</span>
        </p>
      )}
    </div>
  );
}

/** A project financed and running: progress and completion day (R2, story 52). */
function ProjectInProgress({ project }: { project: Project }) {
  const { clock } = useView();
  const { msPerDay } = useGame();
  const { days } = progressionRules.tiers[project.tier];
  const progress = developmentProgress(project.completesOnDay, days, clock.time, clock.stepsPerDay);
  const remaining = daysUntil(project.completesOnDay, clock.time, clock.stepsPerDay);
  const when = `${relativeDay(project.completesOnDay, clock.time.day)} · ${timeLeft(remaining, msPerDay)}`;
  const { branch } = project;
  const coming = branch ? tierProducts(3, branch) : tierProducts(project.tier);

  return (
    <Card>
      <PanelHeader
        eyebrow="Projet de développement en cours"
        title={`Palier ${project.tier} · ${branch ? `branche ${branchName(branch)}` : tierNames[project.tier]}`}
      >
        Un seul projet à la fois : le palier ouvre automatiquement à la fin du délai.
      </PanelHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="flex items-center gap-1.5 font-medium">
              <Hourglass className="size-4 text-warning" aria-hidden />
              Développement
            </span>
            <span className="tabular text-muted-foreground">{percent(progress)}</span>
          </div>
          <Progress
            value={progress * 100}
            aria-label="Avancement du projet de développement"
            className="h-2.5"
          />
        </div>
        <p className="text-lg">
          Disponible le <span className="tabular font-semibold">jour {project.completesOnDay}</span>{" "}
          <span className="tabular text-base text-muted-foreground">({when})</span>
        </p>
        <p className="text-sm">
          Vous pourrez alors produire : <span className="font-medium">{productNames(coming)}</span>.
        </p>
        {branch ? (
          <p className="flex items-start gap-2 text-sm text-muted-foreground">
            <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
            Branche {branchName(otherBranch(branch))} fermée : votre choix est définitif.
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted/60 p-3 text-sm">
          <span>Seule la production attend : achetez dès maintenant matières et machines.</span>
          <Button asChild size="sm" variant="outline">
            <Link to="/play/achats">
              <ShoppingCart aria-hidden />
              Achats
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Tier 3 reached: every tier is open, within the chosen branch (R1). */
function ProgressionComplete() {
  const { team } = useView();
  const { branch } = team.progression;
  return (
    <Card>
      <PanelHeader
        eyebrow="Progression terminée"
        title={branch ? `Palier 3 · branche ${branchName(branch)}` : "Palier 3"}
      />
      <CardContent className="space-y-3 text-sm">
        <p className="flex items-center gap-2 font-medium text-success">
          <CheckCircle2 className="size-4" aria-hidden />
          Tous les paliers sont débloqués.
        </p>
        {branch ? (
          <>
            <p>
              Vous pouvez produire les essentiels, les produits courants et :{" "}
              <span className="font-medium">{productNames(tierProducts(3, branch))}</span>.
            </p>
            <p className="flex items-start gap-2 text-muted-foreground">
              <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
              Branche {branchName(otherBranch(branch))} fermée : votre choix est définitif.
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
