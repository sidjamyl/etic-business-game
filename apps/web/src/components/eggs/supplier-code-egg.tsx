import { easterEggById, secretHash } from "@etic/content";
import { useClaimSecret } from "./use-claim-secret";

/** Called from the supplier search change handler, never as a render side effect. */
export function useSupplierCodeEgg() {
  const claim = useClaimSecret();
  return (search: string) => {
    if (secretHash(search) === easterEggById.get("secret-supplier")?.answerHash)
      void claim("secret-supplier", search);
  };
}
