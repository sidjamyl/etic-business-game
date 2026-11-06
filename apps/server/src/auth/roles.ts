export type Role = "organizer" | "participant";

/** The role is derived from configuration at every request, never stored (S4). */
export function roleForEmail(email: string, organizerEmails: readonly string[]): Role {
  return organizerEmails.includes(email.trim().toLowerCase()) ? "organizer" : "participant";
}
