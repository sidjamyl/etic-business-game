import { applyPatch, type PatchOp } from "@etic/engine";
import type { StreamMessage } from "@etic/server/router";
import { type QueryClient, type QueryKey, skipToken, useQuery } from "@tanstack/react-query";

/**
 * Live views (S9): a stream sends the full view once, then patches. Each message is applied
 * to the TanStack Query cache, and screens read the cache — no polling, no extra request.
 */
export function applyStreamMessage<V>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  message: SerializedStreamMessage,
): void {
  if (message.kind === "full") {
    queryClient.setQueryData<V>(queryKey, message.view as V);
    return;
  }
  const ops = message.ops as PatchOp[];
  queryClient.setQueryData<V>(queryKey, (previous) =>
    previous === undefined ? previous : applyPatch(previous, ops),
  );
}

/**
 * A stream message as tRPC types it after JSON serialization (optional `value` in patches);
 * the runtime data is exactly StreamMessage<V>.
 */
export type SerializedStreamMessage =
  | { kind: "full"; version: number; view: unknown }
  | { kind: "patch"; version: number; ops: readonly unknown[] };

/** Patch operations of a serialized message, typed back for inspection. */
export function patchOps(message: SerializedStreamMessage): PatchOp[] {
  return message.kind === "patch" ? (message.ops as PatchOp[]) : [];
}

/** For typing only: what the server streams. */
export type { StreamMessage };

/** Reads a live view from the cache (undefined until the first full message). */
export function useLiveView<V>(queryKey: QueryKey): V | undefined {
  return useQuery<V>({ queryKey, queryFn: skipToken }).data;
}

export const teamViewKey = (gameId: string) => ["live", "team", gameId] as const;
export const adminViewKey = (gameId: string) => ["live", "admin", gameId] as const;
export const publicViewKey = (gameId: string) => ["live", "public", gameId] as const;
