import type { TradeGood } from "@etic/engine";
import { Factory, Info, OctagonAlert, Package, ShieldAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { goodLabel, type MessageTone, type TradeMessage } from "./trade-math";

/** A good with its icon: a box for raw materials and products, a factory for a machine. */
export function GoodName({ good, className }: { good: TradeGood; className?: string }) {
  const machine = good.kind === "machine";
  const Icon = machine ? Factory : Package;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="tabular min-w-0">
        {machine ? <span className="sr-only">Machine : </span> : null}
        {goodLabel(good)}
      </span>
    </span>
  );
}

const messageIcon = { error: OctagonAlert, warning: TriangleAlert, info: Info } as const;

const messageTone: Record<MessageTone, string> = {
  error: "text-destructive",
  warning: "text-warning",
  info: "text-muted-foreground",
};

/**
 * Blocking problems, warnings and notes, each with its icon (never colour alone). As a live
 * region it stays mounted, so changes are read aloud, and takes no room while empty.
 */
export function MessageList({
  messages,
  live = false,
  className,
}: {
  messages: readonly TradeMessage[];
  live?: boolean;
  className?: string;
}) {
  if (!live && messages.length === 0) return null;
  return (
    <ul aria-live={live ? "polite" : undefined} className={cn("space-y-1.5", className)}>
      {messages.map(({ tone, text }) => {
        const Icon = messageIcon[tone];
        return (
          <li key={text} className={cn("flex items-start gap-2 text-sm", messageTone[tone])}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="text-pretty">{text}</span>
          </li>
        );
      })}
    </ul>
  );
}

/** Key figures of a trade, as a two-column definition list. */
export function Summary({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl
      className={cn(
        "grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border",
        className,
      )}
    >
      {children}
    </dl>
  );
}

export function SummaryItem({
  label,
  value,
  hint,
  emphasis = false,
  danger = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="bg-card px-4 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "tabular mt-0.5 font-semibold",
          emphasis ? "text-xl" : "text-base",
          danger && "text-destructive",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="text-xs text-pretty text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

/** Free transfers carry no guarantee (R15): only an accepted offer is a guaranteed contract. */
export function TrustNotice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/5 px-4 py-3 text-sm">
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium text-warning">
          Sans garantie : un transfert repose sur la confiance
        </p>
        <p className="text-pretty text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

/** A card title that is a real heading, styled like the module titles of the other pages. */
export function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2 id={id} className="eyebrow font-sans leading-none text-muted-foreground">
      {children}
    </h2>
  );
}
