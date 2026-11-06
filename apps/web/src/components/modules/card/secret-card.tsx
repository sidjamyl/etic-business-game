import type { ActivityEntry, SecretCard } from "@etic/engine";
import { Check, Spade, Sparkles } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/utils";
import { cardIcon } from "./card-icons";
import { cardDescription, cardName } from "./card-math";

function StatusPill({ used }: { used: boolean }) {
  const Icon = used ? Check : Sparkles;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        used ? "bg-muted text-muted-foreground" : "bg-power-red text-milk",
      )}
    >
      <Icon className="size-3" aria-hidden />
      {used ? "Utilisée" : "Disponible"}
    </span>
  );
}

/**
 * The team's secret card (R14, story 90), drawn like a playing card with the charter's dotted
 * shadow (DESIGN.md §5). Night while it is still in hand; once played it turns pale and gets
 * a stamp with the day it was played.
 */
export function SecretCardFace({
  card,
  play,
}: {
  card: SecretCard;
  /** Log line of the play, when still in the log. */
  play: ActivityEntry | null;
}) {
  const titleId = useId();
  const Icon = cardIcon[card.id];
  const used = card.used;
  const pip = cn("size-4 shrink-0", used ? "text-muted-foreground" : "text-power-red");

  return (
    <section aria-labelledby={titleId} className="rounded-xl shadow-dotted">
      <div
        className={cn(
          "relative flex aspect-[5/7] flex-col gap-4 rounded-xl p-5",
          used ? "border bg-card text-card-foreground" : "bg-night text-milk",
        )}
      >
        {/* Playing-card frame: decorative. */}
        <div
          aria-hidden
          className={cn(
            "pointer-events-none absolute inset-2 rounded-lg border",
            used ? "border-border" : "border-milk/15",
          )}
        />
        <div className="relative flex items-center justify-between gap-2">
          <p className="eyebrow flex items-center gap-1.5">
            <Spade className={pip} aria-hidden />
            Carte secrète
          </p>
          <StatusPill used={used} />
        </div>

        <div className="relative my-auto grid justify-items-center gap-3 text-center">
          <span
            className={cn(
              "grid size-16 place-items-center rounded-full",
              used ? "bg-muted text-muted-foreground" : "bg-power-red text-milk",
            )}
          >
            <Icon className="size-8" aria-hidden />
          </span>
          <h2 id={titleId} className="text-3xl leading-none font-bold text-balance uppercase">
            {cardName(card.id)}
          </h2>
          <p className={cn("text-sm text-pretty", used ? "text-muted-foreground" : "text-milk/85")}>
            {cardDescription(card.id)}
          </p>
        </div>

        {used ? (
          <p className="relative mx-auto -rotate-6 rounded-md border-2 border-power-red px-3 py-1 font-display text-lg font-bold tracking-wide text-power-red uppercase">
            {play ? `Jouée le jour ${play.day}` : "Carte jouée"}
          </p>
        ) : null}

        <div className="relative flex items-center justify-between gap-2">
          <p className={cn("eyebrow", used ? "text-muted-foreground" : "text-milk/70")}>
            Usage unique · anonyme
          </p>
          <Spade className={cn(pip, "rotate-180")} aria-hidden />
        </div>
      </div>
    </section>
  );
}
