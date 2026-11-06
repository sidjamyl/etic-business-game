import { type ComponentProps, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";
import { scoreValue } from "./end-math";

/**
 * A numbered section of the end screen (DESIGN.md §4–5): the section number in Power red in
 * a narrow column, a thin vertical rule, then the content under a small-caps label.
 */
export function EndSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid grid-cols-[4rem_1fr] gap-x-6">
      <div className="border-r pr-4 text-right">
        <span
          aria-hidden
          className="tabular font-display text-4xl leading-none font-bold text-power-red"
        >
          {String(number).padStart(2, "0")}
        </span>
      </div>
      <div className="min-w-0 space-y-4">
        <h2 id={titleId} className="eyebrow pt-1 font-sans text-muted-foreground">
          {title}
        </h2>
        {children}
      </div>
    </section>
  );
}

const spotlightTone = {
  cacao: "bg-cacao",
  red: "bg-power-red",
} as const;

/**
 * A strong moment in flat Cacao or Power red, Milk text (DESIGN.md §3, §6), with the charter's
 * dotted shadow. The shadow sits on a wrapper without background so the dots show around the
 * panel, never over it. `reveal` makes it appear with a short zoom (skipped on reduced motion).
 */
export function Spotlight({
  tone = "cacao",
  reveal = false,
  className,
  children,
  ...props
}: ComponentProps<"section"> & { tone?: keyof typeof spotlightTone; reveal?: boolean }) {
  return (
    <div
      className={cn(
        "shadow-dotted rounded-xl",
        reveal &&
          "motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-700",
      )}
    >
      <section
        className={cn("relative rounded-xl px-10 py-12 text-milk", spotlightTone[tone], className)}
        {...props}
      >
        {children}
      </section>
    </div>
  );
}

/** "62,3 / 100" on a light background, the "/ 100" in a quieter tone. */
export function ScoreOutOf100({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("tabular whitespace-nowrap", className)}>
      {scoreValue(value)}
      <span className="text-[0.6em] font-normal text-muted-foreground"> / 100</span>
    </span>
  );
}
