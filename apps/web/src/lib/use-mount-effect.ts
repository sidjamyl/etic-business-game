import { type EffectCallback, useEffect } from "react";

/** One-time synchronization with a browser API; never for fetching or derived state. */
export function useMountEffect(effect: EffectCallback): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: this hook explicitly runs only on mount.
  useEffect(effect, []);
}
