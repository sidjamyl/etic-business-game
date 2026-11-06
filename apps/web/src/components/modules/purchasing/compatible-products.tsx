import type { MachineType } from "@etic/content";
import type { TeamState } from "@etic/engine";
import { Ban, Lock } from "lucide-react";
import { itemLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { compatibleProducts, lockLabel, type ProductLock, productLock } from "./purchase-math";

function LockTag({ lock }: { lock: ProductLock }) {
  const Icon = lock.kind === "branch" ? Ban : Lock;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        lock.kind === "branch" ? "text-muted-foreground" : "text-warning",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">Verrouillé :</span>
      {lockLabel(lock)}
    </span>
  );
}

/**
 * What a machine type makes, one product at a time, with its cycle settings (R5, story 35).
 * A lock marks products the company cannot make yet; buying ahead stays possible.
 */
export function CompatibleProducts({
  team,
  type,
  className,
}: {
  team: TeamState;
  type: MachineType;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="eyebrow text-muted-foreground">Produits compatibles · un à la fois</p>
      <ul className="mt-2 divide-y rounded-lg border">
        {compatibleProducts(type).map(({ productId, cycleDays, outputPerCycle }) => {
          const lock = productLock(team, productId);
          return (
            <li
              key={productId}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2 text-sm"
            >
              <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className={cn("font-medium", lock && "text-muted-foreground")}>
                  {itemLabel(productId)}
                </span>
                {lock ? <LockTag lock={lock} /> : null}
              </span>
              <span className="tabular text-xs text-muted-foreground">
                Cycle de {cycleDays} j · {outputPerCycle} unités
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
