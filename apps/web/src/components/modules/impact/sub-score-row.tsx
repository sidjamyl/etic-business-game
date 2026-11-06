import { Link } from "@tanstack/react-router";
import { ArrowRight, Lightbulb, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { formatScore } from "./impact-math";
import { RatingPill, ScoreBar } from "./rating";

type ModulePath = "/play/achats" | "/play/equipe" | "/play/livraisons";

/** Link to the module where a lever is pulled. */
export function ModuleLink({ to, children }: { to: ModulePath; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1 font-medium whitespace-nowrap text-foreground underline underline-offset-4 hover:text-power-red"
    >
      {children}
      <ArrowRight className="size-3.5" aria-hidden />
    </Link>
  );
}

/** How to improve a cause, in one or two sentences. */
export function Lever({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-sm">
      <Lightbulb className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="text-pretty">
        <span className="sr-only">Pour progresser : </span>
        {children}
      </span>
    </p>
  );
}

/** Row title inside a breakdown card (level 3, under the card title). */
export function RowTitle({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 font-sans text-sm font-semibold">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      {children}
    </h3>
  );
}

/**
 * One sub-score of an indicator (N20): value and level, meter, the team's facts behind it and
 * the lever to improve it. A null sub-score has no data yet and does not count.
 */
export function SubScoreRow({
  icon,
  label,
  value,
  empty,
  lever,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: number | null;
  /** Why there is no data yet. */
  empty: string;
  lever: ReactNode;
  children?: ReactNode;
}) {
  return (
    <li className="space-y-2 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <RowTitle icon={icon}>{label}</RowTitle>
        {value === null ? (
          <span className="text-xs text-muted-foreground">Pas encore de donnée</span>
        ) : (
          <span className="flex items-center gap-2">
            <RatingPill value={value} />
            <span className="tabular font-semibold">
              {formatScore(value)}
              <span className="text-xs font-normal text-muted-foreground"> / 100</span>
            </span>
          </span>
        )}
      </div>
      <ScoreBar value={value} />
      <div className="space-y-1 text-sm text-muted-foreground">
        {value === null ? <p>{empty} Cette sous-note ne compte pas encore.</p> : children}
      </div>
      <Lever>{lever}</Lever>
    </li>
  );
}

/** Bottom line of a breakdown card: how the sub-scores make the indicator. */
export function IndicatorTotal({ value, children }: { value: number; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-sm">
      <p className="text-muted-foreground">{children}</p>
      <p className="tabular font-semibold">= {formatScore(value)} / 100</p>
    </div>
  );
}
