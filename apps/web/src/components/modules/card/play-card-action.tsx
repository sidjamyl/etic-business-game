import { Spade } from "lucide-react";
import type { ReactNode } from "react";
import { ConfirmDialog } from "@/components/game/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useView } from "@/lib/game";
import { blockedReason } from "./card-math";

/**
 * Bottom of every activation form: why the card cannot be played yet, then the button that
 * opens the confirmation. A card is single use, so every activation is confirmed (N18).
 * Placed inside a `<form>`: Enter in a field opens the confirmation.
 */
export function PlayCardAction({
  locked,
  ready,
  hint,
  title,
  description,
  consequences,
  confirmLabel,
  onConfirm,
  children,
}: {
  /** The game is not running or a command is on its way. */
  locked: boolean;
  /** Every choice is made and valid. */
  ready: boolean;
  /** What is still missing, or a reminder once ready. */
  hint: string;
  title: string;
  description: ReactNode;
  consequences: string[];
  confirmLabel: string;
  onConfirm: () => Promise<boolean>;
  children?: ReactNode;
}) {
  const { clock } = useView();
  const blocked = blockedReason(clock.status);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t pt-5">
      <p className="max-w-md text-xs text-pretty text-muted-foreground">{blocked ?? hint}</p>
      <ConfirmDialog
        trigger={
          <Button type="submit" disabled={locked || !ready}>
            <Spade aria-hidden />
            Jouer la carte
          </Button>
        }
        title={title}
        description={description}
        consequences={[
          ...consequences,
          "Une fois l'activation acceptée, votre carte est consommée.",
        ]}
        confirmLabel={confirmLabel}
        onConfirm={onConfirm}
      >
        {children}
      </ConfirmDialog>
    </div>
  );
}
