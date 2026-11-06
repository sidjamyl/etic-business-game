import type { Auth } from "../auth/auth.ts";
import { roleForEmail } from "../auth/roles.ts";
import type { Context } from "./trpc.ts";

export function createContextFactory(auth: Auth, organizerEmails: readonly string[]) {
  return async (headers: Headers): Promise<Context> => {
    const session = await auth.api.getSession({ headers });
    if (!session) return { user: null };
    const { id, name, email } = session.user;
    return { user: { id, name, email, role: roleForEmail(email, organizerEmails) } };
  };
}
