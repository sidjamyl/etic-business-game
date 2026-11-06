import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "./control-room-helpers";

export type PillTone = Tone | "neutral";

const pillTone: Record<PillTone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  // Milk on Power red, as the pause banner: the strongest alert of the charter (DESIGN.md §3).
  danger: "bg-power-red text-milk",
  neutral: "bg-foreground/10 text-foreground",
};

/** A short status with its icon: the meaning never rests on colour alone (D1). */
export function Pill({
  tone,
  icon: Icon,
  title,
  className,
  children,
}: {
  tone: PillTone;
  icon: LucideIcon;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        pillTone[tone],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

/** Card title of the control room: a real heading styled as the charter's eyebrow. */
export function SectionTitle({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <h2 id={id} className={cn("eyebrow font-sans text-muted-foreground", className)}>
      {children}
    </h2>
  );
}

/** Sub-heading inside a card ("En cours", "À venir"…). */
export function SubTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h3 id={id} className="eyebrow font-sans text-muted-foreground">
      {children}
    </h3>
  );
}

/** Muted line shown when a list is empty. */
export function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
