import type { ReactNode } from "react";
import { InfoTip } from "@/components/game/info-tip";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";

/** A key figure inside a `<dl>`: small label, tabular value, optional hint and tooltip. */
export function Fact({
  label,
  value,
  hint,
  info,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  info?: GlossaryKey;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg bg-muted/50 px-4 py-3", className)}>
      <dt className="eyebrow flex items-center gap-1.5 text-muted-foreground">
        {label}
        {info ? <InfoTip term={info} /> : null}
      </dt>
      <dd className="tabular mt-1 text-lg leading-snug font-semibold">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-pretty text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}
