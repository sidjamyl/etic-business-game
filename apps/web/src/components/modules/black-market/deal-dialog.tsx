import { Footprints, OctagonAlert, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { useGameCommand } from "@/lib/commands";
import { cn } from "@/lib/utils";
import type { DealMessage } from "./black-market-math";

export type GameCommand = ReturnType<typeof useGameCommand>;

/**
 * Dialog of one deal (purchase or sale). Its content mounts on every opening, so the form
 * starts fresh; it cannot be dismissed while the deal is being sent.
 */
export function DealDialog({
  open,
  onOpenChange,
  locked,
  trigger,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locked: boolean;
  trigger: ReactNode;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!locked) onOpenChange(next);
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      {/* Binding decision: the charter's dotted shadow (DESIGN.md §5). */}
      <DialogContent showCloseButton={false} className="shadow-dotted sm:max-w-lg">
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Header, details, risk notice and actions of a deal. Enter confirms. */
export function DealForm({
  eyebrow,
  title,
  description,
  children,
  confirmLabel,
  canConfirm,
  busy,
  blocked,
  onConfirm,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
  confirmLabel: string;
  canConfirm: boolean;
  busy: boolean;
  blocked: string | null;
  onConfirm: () => void;
}) {
  return (
    <form
      // Checks are ours, in French; the browser's own bubbles would be in its language.
      noValidate
      // The opaque surface keeps the dotted shadow behind the dialog, not over its content;
      // the form scrolls on short laptop screens so the dialog (and its shadow) stays whole.
      className="-m-6 grid max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-lg bg-background p-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (canConfirm && !busy) onConfirm();
      }}
    >
      <DialogHeader>
        <p className="eyebrow text-power-red">{eyebrow}</p>
        <DialogTitle className="font-display text-2xl uppercase">{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      {children}
      {blocked ? (
        <p role="status" className="text-sm font-medium">
          {blocked}
        </p>
      ) : null}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" disabled={busy}>
            Annuler
          </Button>
        </DialogClose>
        <Button type="submit" disabled={!canConfirm || busy}>
          {busy ? "Envoi…" : confirmLabel}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Key figures of a deal (amount, cash, limits, risk…), as a two-column definition list. */
export function DealSummary({ children }: { children: ReactNode }) {
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border">
      {children}
    </dl>
  );
}

export function SummaryItem({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="bg-background px-4 py-2.5">
      <dt className="eyebrow text-muted-foreground">{label}</dt>
      <dd className={cn("tabular mt-0.5 font-semibold", emphasis ? "text-xl" : "text-base")}>
        {value}
      </dd>
      {hint ? <dd className="text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

/** Refusals (red, octagon) and warnings (ochre, triangle), announced to screen readers. */
export function DealMessages({ messages }: { messages: readonly DealMessage[] }) {
  return (
    <div aria-live="polite">
      {messages.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {messages.map((message) => {
            const Icon = message.tone === "error" ? OctagonAlert : TriangleAlert;
            return (
              <li
                key={message.text}
                className={cn(
                  "flex items-start gap-2 text-sm",
                  message.tone === "error" ? "text-destructive" : "text-warning",
                )}
              >
                <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>{message.text}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** Every deal leaves a trace; Port-Libre's customs may check it on the spot (R3, R13). */
export function TraceNotice({ portLibre, traceDays }: { portLibre: boolean; traceDays: number }) {
  return (
    <p className="flex items-start gap-2.5 rounded-lg border border-cacao/25 bg-cacao/5 px-4 py-3 text-sm">
      <Footprints className="mt-0.5 size-4 shrink-0 text-cacao" aria-hidden />
      <span>
        <strong className="font-semibold">
          Cette affaire laisse une trace pendant {traceDays} jours.
        </strong>{" "}
        {portLibre
          ? "La douane de Port-Libre peut aussi la contrôler sur-le-champ : un contrôle positif vaut condamnation."
          : "Une enquête puis une accusation d'un concurrent peuvent la révéler."}
      </span>
    </p>
  );
}
