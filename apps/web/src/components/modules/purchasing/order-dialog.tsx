import { Lock, OctagonAlert, TriangleAlert } from "lucide-react";
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
} from "@/components/ui/dialog";
import type { useGameCommand } from "@/lib/commands";
import { cn } from "@/lib/utils";
import type { OrderMessage } from "./purchase-math";

export type GameCommand = ReturnType<typeof useGameCommand>;

/** Orders are paid at once, reserve the stock and cannot be cancelled (R4, story 31). */
export function FirmOrderNotice({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-cacao/25 bg-cacao/5 px-4 py-3 text-sm",
        className,
      )}
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-cacao" aria-hidden />
      <span>
        <strong className="font-semibold">Commande ferme.</strong> Elle est payée immédiatement, le
        stock vous est réservé et elle ne peut plus être annulée.
      </span>
    </p>
  );
}

/**
 * Dialog of a supplier order. Its content mounts on every opening, so the form starts fresh;
 * it cannot be dismissed while the order is being sent.
 */
export function OrderDialog({
  open,
  onOpenChange,
  locked,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locked: boolean;
  children: ReactNode;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!locked) onOpenChange(next);
      }}
    >
      {/* Binding decision: the charter's dotted shadow (DESIGN.md §5). */}
      <DialogContent showCloseButton={false} className="shadow-dotted sm:max-w-lg">
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Key figures of an order (total, arrival, cash, space…), as a two-column definition list. */
export function OrderSummary({ children }: { children: ReactNode }) {
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
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn("tabular mt-0.5 font-semibold", emphasis ? "text-xl" : "text-base")}>
        {value}
      </dd>
      {hint ? <dd className="tabular text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

/**
 * Blocking problems (errors) and points of attention (warnings), read aloud as they change.
 * The live region stays mounted (announcements need it) and takes no room when empty.
 */
export function OrderMessages({ messages }: { messages: OrderMessage[] }) {
  return (
    <div aria-live="polite" className="space-y-2 not-empty:mt-4">
      {messages.map(({ tone, text }) => {
        const Icon = tone === "error" ? OctagonAlert : TriangleAlert;
        return (
          <p
            key={text}
            className={cn(
              "flex items-start gap-2 text-sm",
              tone === "error" ? "text-destructive" : "text-warning",
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{text}</span>
          </p>
        );
      })}
    </div>
  );
}

/** Header, details, firm-order notice and actions of an order. Enter confirms. */
export function OrderForm({
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
        <DialogDescription asChild>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">{description}</div>
        </DialogDescription>
      </DialogHeader>
      <div>{children}</div>
      <FirmOrderNotice />
      {blocked ? <p className="text-sm text-muted-foreground">{blocked}</p> : null}
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
