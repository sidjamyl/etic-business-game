import type { ReactNode } from "react";
import { RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

/** A radio option shown as a small card (paper, target…), like the other modules' choices. */
export function ChoiceCard({
  id,
  value,
  selected,
  disabled,
  children,
}: {
  id: string;
  value: string;
  selected: boolean;
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-muted/40",
        selected && "border-primary bg-primary/5 hover:bg-primary/5",
        disabled && "cursor-not-allowed opacity-60",
      )}
    >
      <RadioGroupItem id={id} value={value} className="mt-0.5" />
      <span className="grid min-w-0 flex-1 gap-0.5">{children}</span>
    </label>
  );
}
