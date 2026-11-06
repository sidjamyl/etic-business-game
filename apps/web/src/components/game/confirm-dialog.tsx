import { type ReactNode, useState } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmation for binding or irreversible decisions (tier-3 branch, bid, accusation,
 * layoff, scrapping, accepting a trade…). Uses the charter's dotted shadow (DESIGN.md §5).
 * `onConfirm` returns false to keep the dialog open (e.g. when the server refused).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  consequences,
  confirmLabel,
  tone = "default",
  onConfirm,
  children,
}: {
  trigger: ReactNode;
  title: string;
  description?: ReactNode;
  consequences?: string[];
  confirmLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => Promise<boolean | undefined> | boolean | undefined;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent className="shadow-dotted">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display uppercase">{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {consequences && consequences.length > 0 ? (
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {consequences.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}
        {children}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Annuler</AlertDialogCancel>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            disabled={busy}
            className={cn(busy && "opacity-70")}
            onClick={async () => {
              setBusy(true);
              const keepOpen = (await onConfirm()) === false;
              setBusy(false);
              if (!keepOpen) setOpen(false);
            }}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
