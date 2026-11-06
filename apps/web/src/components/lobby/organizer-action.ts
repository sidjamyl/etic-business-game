import { toast } from "sonner";
import { errorMessage } from "./lobby-helpers";

/** What organizer mutations return: accepted, or refused with a French message. */
export type OrganizerResult = { ok: true } | { ok: false; refusal: { message: string } };

/**
 * Runs an organizer mutation (move, remove, member cap, end time, start). A refusal or an
 * error is shown as a red toast; resolves to true when the server accepted.
 */
export async function runOrganizerAction(
  action: () => Promise<OrganizerResult>,
  success?: string,
): Promise<boolean> {
  try {
    const result = await action();
    if (!result.ok) {
      toast.error(result.refusal.message);
      return false;
    }
    if (success) toast.success(success);
    return true;
  } catch (error) {
    toast.error(errorMessage(error));
    return false;
  }
}
