import { type RegionId, regionById, startRules, timingRules } from "@etic/content";
import type { GameStatus } from "@etic/engine";
import { z } from "zod";

/** Limits enforced by the server (game.join, admin.createGame, admin.setMemberCap). */
export const LOBBY_LIMITS = {
  joinCode: 32,
  gameName: 80,
  teamName: 40,
  minTeams: 2,
  maxTeams: 12,
  minMemberCap: 1,
  maxMemberCap: 20,
  minSecondsPerDay: 1,
  maxSecondsPerDay: timingRules.msPerDay / 1000,
  maxDurationDays: 2000,
} as const;

export const OFFLINE_MESSAGE = "Le serveur ne répond pas. Vérifiez la connexion et réessayez.";
const GENERIC_MESSAGE = "Action impossible, réessayez.";

/** "0 membre", "1 membre", "3 membres" (French: 0 and 1 are singular). */
export function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count <= 1 ? singular : plural}`;
}

/** "un nom", "un nom et une région", "un membre, un nom et une région". */
export function joinFrench(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} et ${parts.at(-1)}`;
}

/** The name players see for a company: its chosen name, else the team name. */
export function companyLabel(team: { name: string; companyName: string | null }): string {
  return team.companyName ?? team.name;
}

/** Teams in their creation order (t1, t2 … t12), whatever the object key order. */
export function sortTeams<T extends { id: string }>(teams: readonly T[]): T[] {
  return [...teams].sort((a, b) => a.id.localeCompare(b.id, "fr", { numeric: true }));
}

// ---------------------------------------------------------------------------------------------
// Readiness (R21): a team can start once it has a member, a company name and a region.

export interface TeamSetup {
  memberCount: number;
  companyName: string | null;
  region: RegionId | null;
}

export type ReadinessKey = "member" | "name" | "region";

export interface ReadinessItem {
  key: ReadinessKey;
  label: string;
  done: boolean;
  /** What was chosen, or what is still expected. */
  detail: string;
}

export function readinessItems(team: TeamSetup): ReadinessItem[] {
  return [
    {
      key: "member",
      label: "Au moins un membre",
      done: team.memberCount > 0,
      detail:
        team.memberCount > 0
          ? countLabel(team.memberCount, "membre", "membres")
          : "Personne pour l'instant",
    },
    {
      key: "name",
      label: "Nom de l'entreprise",
      done: team.companyName !== null,
      detail: team.companyName ?? "À définir",
    },
    {
      key: "region",
      label: "Région d'implantation",
      done: team.region !== null,
      detail: team.region ? (regionById.get(team.region)?.name ?? team.region) : "À choisir",
    },
  ];
}

const MISSING: Record<ReadinessKey, string> = {
  member: "un membre",
  name: "un nom",
  region: "une région",
};

/** What a team still lacks before the start, in French ("" when it is ready). */
export function missingLabel(team: TeamSetup): string {
  return joinFrench(
    readinessItems(team)
      .filter((item) => !item.done)
      .map((item) => MISSING[item.key]),
  );
}

// ---------------------------------------------------------------------------------------------
// Errors

/** tRPC error code of a failed call (NOT_FOUND, TOO_MANY_REQUESTS…), when the server answered. */
export function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("data" in error)) return undefined;
  const data: unknown = error.data;
  if (typeof data !== "object" || data === null || !("code" in data)) return undefined;
  return typeof data.code === "string" ? data.code : undefined;
}

/** First validation message of a TanStack Form field (strings or Standard Schema issues). */
export function firstErrorMessage(errors: readonly unknown[]): string | undefined {
  for (const error of errors) {
    if (typeof error === "string" && error) return error;
    if (typeof error === "object" && error !== null && "message" in error) {
      if (typeof error.message === "string" && error.message) return error.message;
    }
  }
  return undefined;
}

/** French message for a failed call: the server's own message when it is meant for people. */
export function errorMessage(error: unknown): string {
  const code = errorCode(error);
  if (!code) return OFFLINE_MESSAGE;
  if (code === "BAD_REQUEST" || code === "INTERNAL_SERVER_ERROR") return GENERIC_MESSAGE;
  return error instanceof Error && error.message ? error.message : GENERIC_MESSAGE;
}

// ---------------------------------------------------------------------------------------------
// Joining a team (P7, O4)

export const joinCodeSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Saisissez le code de votre équipe.")
    .max(LOBBY_LIMITS.joinCode, "Ce code est trop long."),
});

export interface JoinFailure {
  message: string;
  hint: string | null;
}

const JOIN_HINTS: Record<string, string> = {
  NOT_FOUND:
    "Vérifiez le code auprès de l'organisateur : un mot et deux chiffres, par exemple LYNX-42.",
  TEAM_FULL: "L'organisateur peut agrandir l'équipe ou vous placer dans une autre.",
  ALREADY_IN_TEAM: "Une seule équipe par partie : seul l'organisateur peut vous changer d'équipe.",
  TOO_MANY_REQUESTS: "Patientez quelques secondes avant de réessayer.",
  UNAUTHORIZED: "Votre session a expiré : reconnectez-vous.",
};

/** What to show when joining fails, from the refusal (or error) code and the server message. */
export function describeJoinFailure(code: string | undefined, message: string): JoinFailure {
  if (!code) return { message: OFFLINE_MESSAGE, hint: null };
  if (code === "BAD_REQUEST" || code === "INTERNAL_SERVER_ERROR") {
    return { message: GENERIC_MESSAGE, hint: null };
  }
  return { message, hint: JOIN_HINTS[code] ?? null };
}

// ---------------------------------------------------------------------------------------------
// Company name (R21): same rule as the engine's lobby.setCompanyName.

export const companyNameSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, "Le nom de l'entreprise est obligatoire.")
    .max(startRules.companyNameMaxLength, "Nom d'entreprise trop long."),
});

// ---------------------------------------------------------------------------------------------
// Game creation (P3, P10, O4)

export interface TeamDraft {
  /** Stable React key: rows keep their state when another one is removed. */
  key: string;
  name: string;
}

/** Number fields are kept as typed text, then checked and converted on submit. */
export interface CreateGameValues {
  name: string;
  teams: TeamDraft[];
  memberCap: string;
  rehearsal: boolean;
  secondsPerDay: string;
  durationDays: string;
}

/** Input of admin.createGame. */
export interface CreateGameInput {
  name: string;
  teamNames: string[];
  memberCap: number;
  msPerDay?: number;
  durationDays?: number;
}

export const DEFAULT_TEAM_COUNT = 4;

let teamKeySeq = 0;

export function teamDraft(name: string): TeamDraft {
  teamKeySeq += 1;
  return { key: `team-${teamKeySeq}`, name };
}

export function defaultCreateGameValues(): CreateGameValues {
  return {
    name: "",
    teams: Array.from({ length: DEFAULT_TEAM_COUNT }, (_, index) =>
      teamDraft(`Équipe ${index + 1}`),
    ),
    memberCap: String(startRules.defaultMemberCap),
    rehearsal: false,
    secondsPerDay: "10",
    durationDays: "360",
  };
}

const normalizeName = (name: string) => name.trim().toLocaleLowerCase("fr");

/** "Équipe N" with the smallest N not used yet. */
export function nextTeamName(names: readonly string[]): string {
  const taken = new Set(names.map(normalizeName));
  for (let n = 1; ; n += 1) {
    const candidate = `Équipe ${n}`;
    if (!taken.has(normalizeName(candidate))) return candidate;
  }
}

/** A whole number typed in a field ("12"), or null ("", "1,5", "-3", "abc"). */
export function parseWholeNumber(text: string): number | null {
  const trimmed = text.trim();
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

function inRange(text: string, min: number, max: number): boolean {
  const value = parseWholeNumber(text);
  return value !== null && value >= min && value <= max;
}

const { minMemberCap, maxMemberCap, minSecondsPerDay, maxSecondsPerDay, maxDurationDays } =
  LOBBY_LIMITS;

export const createGameSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, "Donnez un nom à la partie.")
      .max(LOBBY_LIMITS.gameName, `${LOBBY_LIMITS.gameName} caractères au maximum.`),
    teams: z
      .array(
        z.object({
          key: z.string(),
          name: z
            .string()
            .trim()
            .min(1, "Donnez un nom à l'équipe.")
            .max(LOBBY_LIMITS.teamName, `${LOBBY_LIMITS.teamName} caractères au maximum.`),
        }),
      )
      .min(LOBBY_LIMITS.minTeams, `Au moins ${LOBBY_LIMITS.minTeams} équipes.`)
      .max(LOBBY_LIMITS.maxTeams, `${LOBBY_LIMITS.maxTeams} équipes au maximum.`),
    memberCap: z
      .string()
      .refine(
        (text) => inRange(text, minMemberCap, maxMemberCap),
        `Entre ${minMemberCap} et ${maxMemberCap} membres.`,
      ),
    rehearsal: z.boolean(),
    secondsPerDay: z.string(),
    durationDays: z.string(),
  })
  .superRefine((values, ctx) => {
    const seen = new Set<string>();
    for (const [index, team] of values.teams.entries()) {
      const name = normalizeName(team.name);
      if (name === "") continue;
      if (seen.has(name)) {
        ctx.addIssue({
          code: "custom",
          message: "Une autre équipe porte déjà ce nom.",
          path: ["teams", index, "name"],
        });
      }
      seen.add(name);
    }
    // Rehearsal settings only count when the rehearsal mode is on (P10).
    if (!values.rehearsal) return;
    if (!inRange(values.secondsPerDay, minSecondsPerDay, maxSecondsPerDay)) {
      ctx.addIssue({
        code: "custom",
        message: `Entre ${minSecondsPerDay} et ${maxSecondsPerDay} secondes.`,
        path: ["secondsPerDay"],
      });
    }
    if (!inRange(values.durationDays, 1, maxDurationDays)) {
      ctx.addIssue({
        code: "custom",
        message: "Entre 1 et 2 000 jours.",
        path: ["durationDays"],
      });
    }
  });

/** Form values (already validated) → admin.createGame input. */
export function toCreateGameInput(values: CreateGameValues): CreateGameInput {
  const input: CreateGameInput = {
    name: values.name.trim(),
    teamNames: values.teams.map((team) => team.name.trim()),
    memberCap: Number(values.memberCap.trim()),
  };
  if (values.rehearsal) {
    input.msPerDay = Number(values.secondsPerDay.trim()) * 1000;
    input.durationDays = Number(values.durationDays.trim());
  }
  return input;
}

// ---------------------------------------------------------------------------------------------
// Games list and clock

const STATUS_ORDER: Record<GameStatus, number> = { running: 0, paused: 1, lobby: 2, ended: 3 };

/** Games in progress first, then those in the lobby, finished ones last (stable otherwise). */
export function sortGames<T extends { status: GameStatus }>(games: readonly T[]): T[] {
  return [...games].sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

export const STATUS_LABEL: Record<GameStatus, string> = {
  lobby: "Lobby",
  running: "En cours",
  paused: "En pause",
  ended: "Terminée",
};

/** A rehearsal runs faster than one simulated day per real minute (P10). */
export function isRehearsal(msPerDay: number): boolean {
  return msPerDay < timingRules.msPerDay;
}

/** "1 jour = 1 min", "1 jour = 5 s", "1 jour = 2,5 s". */
export function speedLabel(msPerDay: number): string {
  if (msPerDay % 60_000 === 0) return `1 jour = ${msPerDay / 60_000} min`;
  const seconds = Math.round(msPerDay / 100) / 10;
  return `1 jour = ${String(seconds).replace(".", ",")} s`;
}

// ---------------------------------------------------------------------------------------------
// End time (P8, R19)

export type EndTimeResult = { ok: true; endsAt: Date } | { ok: false; message: string };

/** The end of the game today at "HH:MM" (as typed in a time field); it must still be ahead. */
export function endTimeToday(time: string, now: Date): EndTimeResult {
  const match = /^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/.exec(time.trim());
  if (!match) return { ok: false, message: "Indiquez une heure, par exemple 18:00." };
  const endsAt = new Date(now);
  endsAt.setHours(Number(match[1]), Number(match[2]), 0, 0);
  if (endsAt.getTime() <= now.getTime()) {
    return { ok: false, message: "Cette heure est déjà passée : choisissez une heure à venir." };
  }
  return { ok: true, endsAt };
}

/** One line per team, to paste in a group chat: "Équipe 1 : LYNX-42". */
export function joinCodesText(teams: readonly { name: string; joinCode: string }[]): string {
  return teams.map((team) => `${team.name} : ${team.joinCode}`).join("\n");
}
