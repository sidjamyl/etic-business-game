import { cn } from "@/lib/utils";

/**
 * Placeholder mark until the charter's SVG logo is provided (DESIGN.md §8).
 * `inverted`: light mark on Power red, as in the charter's inverted version.
 */
export function Logo({ className, inverted = false }: { className?: string; inverted?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className={cn(
          "grid size-8 place-items-center rounded-lg font-display text-lg font-bold",
          inverted ? "bg-milk text-power-red" : "bg-power-red text-milk",
        )}
      >
        B
      </span>
      <span className="font-display text-sm font-bold tracking-wide uppercase">Business Game</span>
    </span>
  );
}
