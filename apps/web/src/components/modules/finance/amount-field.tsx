import { useId } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** An amount in crédits, with its rule or error underneath and an optional quick fill. */
export function AmountField({
  label,
  value,
  onChange,
  disabled,
  error,
  hint,
  min,
  max,
  quickFill,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  error: string | null;
  hint: string;
  min: number;
  max: number;
  /** A button that fills the field, e.g. with the largest amount allowed. */
  quickFill?: { label: string; amount: number };
}) {
  const id = useId();
  const hintId = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>
        {label}
        <span className="sr-only"> (en crédits)</span>
      </Label>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-44">
          <span
            className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground"
            aria-hidden
          >
            ₢
          </span>
          <Input
            id={id}
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={1}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            disabled={disabled}
            aria-invalid={error !== null}
            aria-describedby={hintId}
            className="tabular pl-7"
          />
        </div>
        {quickFill ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || quickFill.amount <= 0}
            onClick={() => onChange(String(quickFill.amount))}
          >
            {quickFill.label}
          </Button>
        ) : null}
      </div>
      <p
        id={hintId}
        className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}
      >
        {error ?? hint}
      </p>
    </div>
  );
}
