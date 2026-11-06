import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCanAct } from "@/lib/game";
import { useClaimSecret } from "./use-claim-secret";

/** A discreet, keyboard-accessible discovery at the bottom of the guide. */
export function AcrosticEgg() {
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const claim = useClaimSecret();
  const canAct = useCanAct();
  const id = useId();
  return (
    <details className="mt-10 max-w-md text-sm text-muted-foreground">
      <summary
        className="w-fit cursor-pointer rounded px-2 py-1 focus-visible:outline-2"
        aria-label="Ouvrir une note en marge"
      >
        ···
      </summary>
      <form
        className="mt-3 space-y-2"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!canAct || pending || !answer.trim()) return;
          setPending(true);
          try {
            if (await claim("acrostic", answer)) setAnswer("");
          } finally {
            setPending(false);
          }
        }}
      >
        <Label htmlFor={id}>Ce qui se lit entre les lignes</Label>
        <div className="flex gap-2">
          <Input
            id={id}
            value={answer}
            maxLength={100}
            onChange={(event) => setAnswer(event.target.value)}
            autoComplete="off"
          />
          <Button disabled={!canAct || pending || !answer.trim()} type="submit" variant="outline">
            Essayer
          </Button>
        </div>
      </form>
    </details>
  );
}
