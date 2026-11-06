import { deliveryRules } from "@etic/content";
import {
  AlertTriangle,
  CircleCheck,
  CircleHelp,
  Clock,
  type LucideIcon,
  PackageX,
  Zap,
} from "lucide-react";
import type { ReactNode } from "react";
import { percent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type OrderOutlook, optionShortName } from "./logistics";

export type PillTone = "success" | "warning" | "danger" | "muted";

const toneClass: Record<PillTone, string> = {
  success: "bg-success/12 text-success",
  warning: "bg-warning/12 text-warning",
  danger: "bg-destructive/10 text-destructive",
  muted: "bg-muted text-muted-foreground",
};

/** A short status with its icon: the meaning never rests on colour alone (D1). */
export function StatusPill({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: PillTone;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        toneClass[tone],
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {children}
    </span>
  );
}

export const lateDiscountLabel = `−${percent(deliveryRules.lateDiscount)}`;

/** Whether a delivery should arrive before its deadline. */
export function ArrivalPill({ onTime }: { onTime: boolean | null }) {
  if (onTime === null) {
    return (
      <StatusPill tone="muted" icon={CircleHelp}>
        Arrivée inconnue
      </StatusPill>
    );
  }
  return onTime ? (
    <StatusPill tone="success" icon={CircleCheck}>
      À l'heure
    </StatusPill>
  ) : (
    <StatusPill tone="warning" icon={Clock}>
      En retard · {lateDiscountLabel}
    </StatusPill>
  );
}

/** What happens to an accepted order if it is shipped now. */
export function OutlookPill({ outlook }: { outlook: OrderOutlook }) {
  switch (outlook.kind) {
    case "on-time":
      return (
        <StatusPill tone="success" icon={CircleCheck}>
          Dans les temps
        </StatusPill>
      );
    case "faster-only":
      return (
        <StatusPill tone="warning" icon={Zap}>
          {outlook.options.map(optionShortName).join(" ou ")} nécessaire
        </StatusPill>
      );
    case "late":
      return (
        <StatusPill tone="warning" icon={Clock}>
          Retard inévitable · {outlook.daysLate} j
        </StatusPill>
      );
    case "overdue":
      return (
        <StatusPill tone="danger" icon={AlertTriangle}>
          Annulation jour {outlook.cancelDay}
        </StatusPill>
      );
    case "stuck":
      return (
        <StatusPill tone="danger" icon={PackageX}>
          Départ bloqué
        </StatusPill>
      );
  }
}
