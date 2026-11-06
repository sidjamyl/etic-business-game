import type { ReactNode } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { GlossaryKey } from "@/lib/glossary";
import { cn } from "@/lib/utils";
import { InfoTip } from "./info-tip";

export type Tone = "default" | "success" | "warning" | "danger";

const toneClass: Record<Tone, string> = {
  default: "",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

/** A key figure: eyebrow label, large tabular value, optional hint and tooltip. */
export function StatCard({
  label,
  value,
  hint,
  tone = "default",
  info,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  info?: GlossaryKey;
  className?: string;
}) {
  return (
    <Card className={cn("gap-2 py-4", className)}>
      <CardHeader className="flex flex-row items-center gap-1.5 px-4">
        <span className="eyebrow text-muted-foreground">{label}</span>
        {info ? <InfoTip term={info} /> : null}
      </CardHeader>
      <CardContent className="px-4">
        <div className={cn("tabular text-2xl font-semibold", toneClass[tone])}>{value}</div>
        {hint ? <div className="mt-1 text-xs text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}
