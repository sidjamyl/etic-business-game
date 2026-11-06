import {
  Ban,
  CirclePause,
  type LucideIcon,
  OctagonX,
  PackageX,
  Play,
  Timer,
  UserX,
  Warehouse,
  Wrench,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Situation, SituationKind, Tone } from "./machines";

/** Tinted surfaces and texts of the functional colours (D1), shared by the module. */
export const toneSurface: Record<Tone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

export const toneText: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  neutral: "text-muted-foreground",
};

export const toneBar: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
  neutral: "bg-muted-foreground",
};

const noteSurface: Record<Tone, string> = {
  success: "border-success bg-success/8",
  warning: "border-warning bg-warning/8",
  danger: "border-destructive bg-destructive/6",
  neutral: "border-cloud bg-muted/60",
};

const situationIcon: Record<SituationKind, LucideIcon> = {
  running: Play,
  starting: Timer,
  idle: CirclePause,
  "waiting-materials": PackageX,
  "waiting-operators": UserX,
  "waiting-space": Warehouse,
  maintenance: Wrench,
  strike: Ban,
  stopped: OctagonX,
};

/** Machine status in French with its icon: the meaning never rests on colour alone. */
export function StatusBadge({ situation }: { situation: Situation }) {
  const Icon = situationIcon[situation.kind];
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        toneSurface[situation.tone],
      )}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      {situation.label}
    </span>
  );
}

/** What the machine waits for and how to unblock it (story 38). */
export function SituationNote({
  situation,
  children,
}: {
  situation: Situation;
  children?: ReactNode;
}) {
  const Icon = situationIcon[situation.kind];
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border-l-4 px-3 py-2.5 text-sm",
        noteSurface[situation.tone],
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", toneText[situation.tone])} aria-hidden />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-pretty">{situation.detail}</p>
        {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
      </div>
    </div>
  );
}
