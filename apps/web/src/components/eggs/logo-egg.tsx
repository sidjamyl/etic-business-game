import { type ReactNode, useRef } from "react";
import { useClaimSecret } from "./use-claim-secret";

/** Wraps the sidebar logo (ten clicks secret). */
export function LogoEgg({ children }: { children: ReactNode }) {
  const clicks = useRef(0);
  const claim = useClaimSecret();
  return (
    <button
      type="button"
      className="rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4"
      aria-label="Logo Business Game"
      onClick={() => {
        clicks.current += 1;
        if (clicks.current === 10) {
          clicks.current = 0;
          void claim("logo");
        }
      }}
    >
      {children}
    </button>
  );
}
