import { useRef } from "react";
import { useClaimSecret } from "./use-claim-secret";

const sequence = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
];

/** React's ref cleanup scopes the keyboard listener to the mounted player layout. */
export function EasterEggs() {
  const claim = useClaimSecret();
  const progress = useRef(0);
  return (
    <span
      hidden
      ref={() => {
        const handle = (event: KeyboardEvent) => {
          if (
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            (event.target instanceof HTMLElement &&
              event.target.closest("input, textarea, select, [contenteditable=true]"))
          )
            return;
          const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
          progress.current =
            key === sequence[progress.current] ? progress.current + 1 : key === sequence[0] ? 1 : 0;
          if (progress.current === sequence.length) {
            progress.current = 0;
            void claim("konami");
          }
        };
        document.addEventListener("keydown", handle);
        return () => document.removeEventListener("keydown", handle);
      }}
    />
  );
}
