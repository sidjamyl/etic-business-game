import type { TeamCommandMap, TeamCommandType } from "@etic/engine";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCanAct, useGame } from "@/lib/game";
import { useTRPC } from "@/lib/trpc";

export interface SendOptions {
  /** Toast shown when the command is accepted; silent by default. */
  success?: string;
}

export interface SendResult {
  ok: boolean;
  /** Refusal code from the engine (INSUFFICIENT_FUNDS, OUT_OF_STOCK…), when refused. */
  code?: string;
}

/**
 * Sends team decisions (#26). Payloads are type-checked against the engine's command
 * schemas (TeamCommandMap). Refusals come back with a French message, shown as a toast;
 * the server stays the single source of truth.
 *
 * @example
 * const { send, pending, canAct } = useGameCommand();
 * await send("purchase.buyMaterial", { supplierId, quantity }, { success: "Commande passée" });
 */
export function useGameCommand() {
  const trpc = useTRPC();
  const { gameId } = useGame();
  const canAct = useCanAct();
  const mutation = useMutation(trpc.game.command.mutationOptions());

  async function send<K extends TeamCommandType>(
    type: K,
    payload: TeamCommandMap[K],
    options: SendOptions = {},
  ): Promise<SendResult> {
    try {
      const result = await mutation.mutateAsync({ gameId, command: { type, payload } });
      if (!result.ok) {
        toast.error(result.refusal.message);
        return { ok: false, code: result.refusal.code };
      }
      if (options.success) toast.success(options.success);
      return { ok: true };
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Action impossible, réessayez.");
      return { ok: false };
    }
  }

  return { send, pending: mutation.isPending, canAct };
}
