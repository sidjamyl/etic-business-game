import { Circle, CircleCheck, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ReadinessItem, ReadinessKey } from "./lobby-helpers";

const SHORT_LABEL: Record<ReadinessKey, string> = {
  member: "Membre",
  name: "Nom",
  region: "Région",
};

function StatusIcon({ done, className }: { done: boolean; className?: string }) {
  const Icon = done ? CircleCheck : Circle;
  return (
    <Icon
      className={cn("shrink-0", done ? "text-success" : "text-muted-foreground", className)}
      aria-hidden
    />
  );
}

const srStatus = (done: boolean) => (
  <span className="sr-only">{done ? " : fait" : " : à faire"}</span>
);

/** The start conditions (R21): an icon and words for each, never colour alone. */
export function ReadinessList({ items }: { items: ReadinessItem[] }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item.key} className="flex items-start gap-3">
          <StatusIcon done={item.done} className="mt-0.5 size-5" />
          <div className="min-w-0">
            <p className="text-sm font-medium">
              {item.label}
              {srStatus(item.done)}
            </p>
            <p
              className={cn(
                "truncate text-sm",
                item.done ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {item.detail}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Compact version for the organizer's team cards. */
export function ReadinessChips({ items }: { items: ReadinessItem[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <li
          key={item.key}
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
            item.done ? "bg-success/12 text-success" : "bg-muted text-muted-foreground",
          )}
        >
          <StatusIcon done={item.done} className="size-3 text-current" />
          {SHORT_LABEL[item.key]}
          {srStatus(item.done)}
        </li>
      ))}
    </ul>
  );
}

/** Whether a team can start: "Prête" or "En préparation", with an icon. */
export function ReadyBadge({ ready, className }: { ready: boolean; className?: string }) {
  const Icon = ready ? CircleCheck : Clock;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        ready ? "bg-success/12 text-success" : "bg-warning/12 text-warning",
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {ready ? "Prête" : "En préparation"}
    </span>
  );
}
