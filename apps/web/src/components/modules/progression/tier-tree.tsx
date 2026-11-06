import type { Branch } from "@etic/content";
import type { TeamState } from "@etic/engine";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Ban, CheckCircle2, Flag, Hourglass, Lock } from "lucide-react";
import { Fragment, type ReactNode, useId } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { credits, formatNumber } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";
import {
  type BranchStatus,
  branchIds,
  branchName,
  branchStatus,
  milestoneRatio,
  productNames,
  relativeDay,
  salesLabel,
  type Tier,
  type TierMilestone,
  type TierStatus,
  tierMilestone,
  tierNames,
  tierProducts,
  tierStatus,
} from "./progression-math";

interface PillStyle {
  label: string;
  icon: LucideIcon;
  className: string;
}

const tierPill: Record<TierStatus["kind"], PillStyle> = {
  unlocked: { label: "Débloqué", icon: CheckCircle2, className: "bg-success/12 text-success" },
  developing: {
    label: "En développement",
    icon: Hourglass,
    className: "bg-warning/12 text-warning",
  },
  ready: { label: "Jalon atteint", icon: Flag, className: "bg-primary/10 text-primary" },
  locked: { label: "Verrouillé", icon: Lock, className: "bg-muted text-muted-foreground" },
  later: { label: "Verrouillé", icon: Lock, className: "bg-muted text-muted-foreground" },
};

const branchPill: Record<Exclude<BranchStatus, "open">, PillStyle> = {
  chosen: { label: "Votre branche", icon: CheckCircle2, className: "bg-success/12 text-success" },
  closed: { label: "Fermée", icon: Ban, className: "bg-muted text-muted-foreground" },
};

/** Status shown with an icon and a word, never by colour alone. */
function Pill({ style }: { style: PillStyle }) {
  const Icon = style.icon;
  return (
    <Badge variant="outline" className={cn("border-transparent", style.className)}>
      <Icon aria-hidden />
      {style.label}
    </Badge>
  );
}

/**
 * The tier tree (R1, R2, stories 51 and 53): the three tiers in order, the fork into the two
 * exclusive tier-3 branches, the products of each tier and the progress of each milestone.
 */
export function TierTree() {
  const { team } = useView();
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id={headingId} className="eyebrow font-sans text-muted-foreground">
          Arbre des paliers
        </h2>
        <p className="text-xs text-muted-foreground">
          Jalon : produits du palier précédent livrés à vos clients et payés.
        </p>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1.25fr)]">
        <TierOne />
        <Connector />
        <TierTwo team={team} />
        <Connector />
        <TierThree team={team} />
      </div>
    </section>
  );
}

function Connector() {
  return (
    <div aria-hidden className="flex items-center justify-center">
      <span className="grid size-8 place-items-center rounded-full border bg-card text-muted-foreground">
        <ArrowRight className="size-4 rotate-90 lg:rotate-0" />
      </span>
    </div>
  );
}

function TierCard({
  tier,
  status,
  children,
}: {
  tier: Tier;
  status: TierStatus;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="min-w-0">
      <Card className={cn("h-full gap-4 py-5", status.kind === "ready" && "border-primary/60")}>
        <CardHeader className="flex items-start justify-between gap-3 px-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className="tabular font-display text-3xl leading-none font-bold text-power-red"
            >
              {String(tier).padStart(2, "0")}
            </span>
            <div>
              <p className="eyebrow text-muted-foreground">Palier {tier}</p>
              <h3 id={titleId} className="text-lg leading-tight font-bold uppercase">
                {tierNames[tier]}
              </h3>
            </div>
          </div>
          <Pill style={tierPill[status.kind]} />
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4 px-5">{children}</CardContent>
      </Card>
    </section>
  );
}

function ProductChips({ tier }: { tier: Tier }) {
  return (
    <div>
      <p className="eyebrow text-muted-foreground">Produits</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {tierProducts(tier).map((product) => (
          <li key={product.id}>
            <Badge variant="outline" className="bg-background px-2.5 py-1 text-sm font-normal">
              {product.name}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TierOne() {
  return (
    <TierCard tier={1} status={{ kind: "unlocked" }}>
      <ProductChips tier={1} />
      <div className="mt-auto flex items-baseline justify-between gap-3 border-t pt-3 text-sm">
        <span className="text-muted-foreground">Accès</span>
        <span className="font-medium">Dès le départ</span>
      </div>
    </TierCard>
  );
}

function TierTwo({ team }: { team: TeamState }) {
  const milestone = tierMilestone(team, 2);
  const status = tierStatus(team.progression, 2, milestone.sold >= milestone.required);
  return (
    <TierCard tier={2} status={status}>
      <ProductChips tier={2} />
      <UnlockConditions milestone={milestone} status={status} />
    </TierCard>
  );
}

function TierThree({ team }: { team: TeamState }) {
  const milestone = tierMilestone(team, 3);
  const status = tierStatus(team.progression, 3, milestone.sold >= milestone.required);
  return (
    <TierCard tier={3} status={status}>
      <div className="space-y-2">
        <p className="eyebrow text-muted-foreground">Deux branches, une seule au choix</p>
        {branchIds.map((branch, index) => (
          <Fragment key={branch}>
            {index > 0 ? <OrDivider /> : null}
            <BranchBox branch={branch} status={branchStatus(team.progression, branch)} />
          </Fragment>
        ))}
      </div>
      <UnlockConditions milestone={milestone} status={status} />
    </TierCard>
  );
}

function OrDivider() {
  return (
    <div aria-hidden className="flex items-center gap-2">
      <span className="h-px flex-1 bg-border" />
      <span className="eyebrow text-muted-foreground">ou</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function BranchBox({ branch, status }: { branch: Branch; status: BranchStatus }) {
  const closed = status === "closed";
  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        status === "chosen" && "border-success/50 bg-success/5",
        closed && "border-dashed bg-muted/50",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn("font-display font-bold uppercase", closed && "text-muted-foreground")}>
          {branchName(branch)}
        </span>
        {status === "open" ? null : <Pill style={branchPill[status]} />}
      </div>
      <p className={cn("mt-1 text-sm", closed && "text-muted-foreground line-through")}>
        {productNames(tierProducts(3, branch))}
      </p>
    </div>
  );
}

/** Milestone with its progress, development project, and what is left to do. */
function UnlockConditions({ milestone, status }: { milestone: TierMilestone; status: TierStatus }) {
  const { clock } = useView();
  const reached = status.kind === "unlocked" || status.kind === "developing";
  const label = `Jalon : ${salesLabel(milestone.required)} du palier ${milestone.salesTier}`;
  const progressText = `${formatNumber(milestone.sold)} / ${formatNumber(milestone.required)}`;
  return (
    <div className="mt-auto space-y-3 border-t pt-3 text-sm">
      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-muted-foreground">{label}</span>
          {reached ? (
            <span className="inline-flex items-center gap-1 font-medium text-success">
              <CheckCircle2 className="size-3.5" aria-hidden />
              Atteint
            </span>
          ) : (
            <span className="tabular font-medium">{progressText}</span>
          )}
        </div>
        {reached ? null : (
          <Progress
            value={milestoneRatio(milestone.sold, milestone.required) * 100}
            aria-label={label}
            getValueLabel={() =>
              `${formatNumber(milestone.sold)} sur ${formatNumber(milestone.required)}`
            }
            className="h-1.5"
          />
        )}
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-muted-foreground">Projet de développement</span>
        <span className="tabular font-medium">
          {credits(milestone.cost)} · {milestone.days} jours
        </span>
      </div>
      <StatusLine status={status} milestone={milestone} day={clock.time.day} />
    </div>
  );
}

function StatusLine({
  status,
  milestone,
  day,
}: {
  status: TierStatus;
  milestone: TierMilestone;
  day: number;
}) {
  switch (status.kind) {
    case "developing":
      return (
        <p className="tabular font-medium">
          Disponible le jour {status.completesOnDay} ({relativeDay(status.completesOnDay, day)})
        </p>
      );
    case "ready":
      return (
        <p className="font-medium text-primary">Vous pouvez financer le projet de développement.</p>
      );
    case "locked":
      return (
        <p className="text-muted-foreground">
          Encore {salesLabel(milestone.required - milestone.sold)} de produits du palier{" "}
          {milestone.salesTier}.
        </p>
      );
    case "later":
      return (
        <p className="text-muted-foreground">Débloquez d'abord le palier {milestone.salesTier}.</p>
      );
    default:
      return null;
  }
}
