import { createAuthClient } from "better-auth/react";

/** Better Auth client on the same origin (Vite proxy in development, the server in production). */
export const authClient = createAuthClient({
  baseURL: window.location.origin,
  basePath: "/api/auth",
});

/** French messages for Better Auth error codes (N30). */
export function authErrorMessage(error: { code?: string; message?: string } | null): string {
  switch (error?.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-mail ou mot de passe incorrect.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Cet e-mail est déjà utilisé : connectez-vous plutôt.";
    case "PASSWORD_TOO_SHORT":
      return "Le mot de passe doit contenir au moins 8 caractères.";
    case "INVALID_EMAIL":
      return "Adresse e-mail invalide.";
    default:
      return "Une erreur est survenue, réessayez.";
  }
}
