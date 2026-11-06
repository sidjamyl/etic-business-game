import type { EasterEggId } from "@etic/content";
import { useRef } from "react";
import { useGameCommand } from "@/lib/commands";
import { useTeamView } from "@/lib/game";

/** A discovery is an explicit interaction; the server awards the badge and first reward. */
export function useClaimSecret() {
  const view = useTeamView();
  const { send, canAct } = useGameCommand();
  const sending = useRef(false);
  return async (eggId: EasterEggId, answer?: string) => {
    if (!view || !canAct || sending.current || view.team.badges.includes(eggId)) return false;
    sending.current = true;
    try {
      const result = await send(
        "egg.claim",
        { eggId, ...(answer === undefined ? {} : { answer }) },
        { success: "Secret découvert ! Votre badge et votre éventuelle récompense arrivent." },
      );
      return result.ok;
    } finally {
      sending.current = false;
    }
  };
}
