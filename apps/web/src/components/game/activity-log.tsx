import type { ActivityEntry } from "@etic/engine";
import { AlertTriangle, Cog, UserRound } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { stepLabel } from "@/lib/format";
import { useView } from "@/lib/game";
import { cn } from "@/lib/utils";

const kindIcon = { system: Cog, decision: UserRound, event: AlertTriangle } as const;

/** What happened to the company, latest first, with who decided (stories 116–117). */
export function ActivityLog({ limit = 60, className }: { limit?: number; className?: string }) {
  const view = useView();
  const entries: ActivityEntry[] = view.team.log.slice(-limit).reverse();
  return (
    <ScrollArea className={cn("h-96 pr-3", className)}>
      <ol className="space-y-2">
        {entries.map((entry) => {
          const Icon = kindIcon[entry.kind];
          return (
            <li key={entry.id} className="flex gap-3 text-sm">
              <Icon
                className={cn(
                  "mt-0.5 size-4 shrink-0",
                  entry.kind === "event" ? "text-warning" : "text-muted-foreground",
                )}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-pretty">{entry.message}</p>
                <p className="tabular text-xs text-muted-foreground">
                  Jour {entry.day} · {stepLabel(entry.step, view.clock.stepsPerDay)}
                  {entry.actor ? ` · ${entry.actor}` : ""}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </ScrollArea>
  );
}
