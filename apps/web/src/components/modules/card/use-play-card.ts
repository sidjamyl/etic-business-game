import { useGameCommand } from "@/lib/commands";
import type { CardPlay } from "./card-math";

/**
 * Plays the team's secret card (card.play, N18). Resolves to true once the server accepted:
 * a refusal (wrong moment, target without machines…) keeps the card and shows its reason.
 * Each form keeps its own instance, so `pending` belongs to the form that sends.
 */
export function usePlayCard() {
  const { send, pending, canAct } = useGameCommand();

  async function play(payload: CardPlay, success: string): Promise<boolean> {
    const result = await send("card.play", payload, { success });
    return result.ok;
  }

  return { play, pending, canAct, locked: !canAct || pending };
}
