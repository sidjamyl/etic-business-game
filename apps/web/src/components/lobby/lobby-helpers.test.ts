import { describe, expect, test } from "bun:test";
import {
  companyLabel,
  companyNameSchema,
  countLabel,
  createGameSchema,
  defaultCreateGameValues,
  describeJoinFailure,
  endTimeToday,
  errorCode,
  errorMessage,
  firstErrorMessage,
  isRehearsal,
  joinCodeSchema,
  joinCodesText,
  joinFrench,
  missingLabel,
  nextTeamName,
  OFFLINE_MESSAGE,
  parseWholeNumber,
  readinessItems,
  sortGames,
  sortTeams,
  speedLabel,
  teamDraft,
  toCreateGameInput,
} from "./lobby-helpers.ts";

/** Field names that received an error, as TanStack Form maps them ("teams[1].name"). */
function errorPaths(values: unknown): string[] {
  const result = createGameSchema.safeParse(values);
  if (result.success) return [];
  return result.error.issues.map((issue) =>
    issue.path
      .map((part) => (typeof part === "number" ? `[${part}]` : `.${String(part)}`))
      .join(""),
  );
}

describe("wording", () => {
  test("French counts are singular for 0 and 1", () => {
    expect(countLabel(0, "membre", "membres")).toBe("0 membre");
    expect(countLabel(1, "membre", "membres")).toBe("1 membre");
    expect(countLabel(3, "membre", "membres")).toBe("3 membres");
  });

  test("lists end with « et »", () => {
    expect(joinFrench([])).toBe("");
    expect(joinFrench(["un nom"])).toBe("un nom");
    expect(joinFrench(["un nom", "une région"])).toBe("un nom et une région");
    expect(joinFrench(["un membre", "un nom", "une région"])).toBe(
      "un membre, un nom et une région",
    );
  });

  test("a company is shown by its name, else by its team name", () => {
    expect(companyLabel({ name: "Équipe 2", companyName: null })).toBe("Équipe 2");
    expect(companyLabel({ name: "Équipe 2", companyName: "Lynx & Co" })).toBe("Lynx & Co");
  });

  test("teams keep their creation order, t10 after t9", () => {
    const ids = sortTeams([{ id: "t10" }, { id: "t2" }, { id: "t1" }, { id: "t9" }]).map(
      (team) => team.id,
    );
    expect(ids).toEqual(["t1", "t2", "t9", "t10"]);
  });
});

describe("readiness", () => {
  test("lists the three conditions with what was chosen", () => {
    const items = readinessItems({ memberCount: 2, companyName: "Lynx & Co", region: "azura" });
    expect(items.map((item) => [item.key, item.done, item.detail])).toEqual([
      ["member", true, "2 membres"],
      ["name", true, "Lynx & Co"],
      ["region", true, "Azura"],
    ]);
  });

  test("says what is missing", () => {
    expect(missingLabel({ memberCount: 1, companyName: "X", region: "ferronia" })).toBe("");
    expect(missingLabel({ memberCount: 1, companyName: null, region: null })).toBe(
      "un nom et une région",
    );
    expect(missingLabel({ memberCount: 0, companyName: null, region: null })).toBe(
      "un membre, un nom et une région",
    );
  });
});

describe("errors", () => {
  const trpcError = (code: string, message: string) =>
    Object.assign(new Error(message), { data: { code } });

  test("reads the tRPC code when the server answered", () => {
    expect(errorCode(trpcError("NOT_FOUND", "Code invalide."))).toBe("NOT_FOUND");
    expect(errorCode(new Error("Failed to fetch"))).toBeUndefined();
    expect(errorCode("boom")).toBeUndefined();
  });

  test("keeps French server messages, replaces technical ones", () => {
    expect(errorMessage(trpcError("FORBIDDEN", "Réservé à l'organisateur."))).toBe(
      "Réservé à l'organisateur.",
    );
    expect(errorMessage(trpcError("BAD_REQUEST", '[{"code":"too_small"}]'))).toBe(
      "Action impossible, réessayez.",
    );
    expect(errorMessage(new Error("Failed to fetch"))).toBe(OFFLINE_MESSAGE);
  });

  test("first form error, whether a string or a schema issue", () => {
    expect(firstErrorMessage([])).toBeUndefined();
    expect(firstErrorMessage([undefined, "Requis."])).toBe("Requis.");
    expect(firstErrorMessage([{ message: "Trop long." }, "Requis."])).toBe("Trop long.");
  });

  test("join failures come with a hint", () => {
    expect(describeJoinFailure("NOT_FOUND", "Code invalide.")).toEqual({
      message: "Code invalide.",
      hint: "Vérifiez le code auprès de l'organisateur : un mot et deux chiffres, par exemple LYNX-42.",
    });
    expect(describeJoinFailure("TEAM_FULL", "Équipe complète.").message).toBe("Équipe complète.");
    expect(describeJoinFailure("TEAM_FULL", "Équipe complète.").hint).toContain("organisateur");
    expect(describeJoinFailure("SOMETHING", "Autre refus.")).toEqual({
      message: "Autre refus.",
      hint: null,
    });
    expect(describeJoinFailure("UNAUTHORIZED", "Connexion requise.").hint).toBe(
      "Votre session a expiré : reconnectez-vous.",
    );
    expect(describeJoinFailure(undefined, "Failed to fetch").message).toBe(OFFLINE_MESSAGE);
  });
});

describe("lobby forms", () => {
  test("join code: required, trimmed, at most 32 characters", () => {
    expect(joinCodeSchema.safeParse({ code: "  " }).success).toBe(false);
    expect(joinCodeSchema.safeParse({ code: " lynx-42 " }).data).toEqual({ code: "lynx-42" });
    expect(joinCodeSchema.safeParse({ code: "X".repeat(33) }).success).toBe(false);
  });

  test("company name: required, at most 40 characters", () => {
    expect(companyNameSchema.safeParse({ companyName: "   " }).success).toBe(false);
    expect(companyNameSchema.safeParse({ companyName: "Lynx & Co" }).success).toBe(true);
    expect(companyNameSchema.safeParse({ companyName: "A".repeat(41) }).success).toBe(false);
  });
});

describe("game creation", () => {
  test("defaults: four teams « Équipe 1 » to « Équipe 4 », four members, real speed", () => {
    const values = defaultCreateGameValues();
    expect(values.teams.map((team) => team.name)).toEqual([
      "Équipe 1",
      "Équipe 2",
      "Équipe 3",
      "Équipe 4",
    ]);
    expect(new Set(values.teams.map((team) => team.key)).size).toBe(4);
    expect(values.memberCap).toBe("4");
    expect(values.rehearsal).toBe(false);
    expect(errorPaths({ ...values, name: "Journée ETIC" })).toEqual([]);
  });

  test("a new team takes the first free « Équipe N »", () => {
    expect(nextTeamName(["Équipe 1", "Équipe 2"])).toBe("Équipe 3");
    expect(nextTeamName(["Équipe 1", "Équipe 3"])).toBe("Équipe 2");
    expect(nextTeamName(["équipe 1 ", "Les Lynx"])).toBe("Équipe 2");
  });

  test("whole numbers only", () => {
    expect(parseWholeNumber(" 12 ")).toBe(12);
    expect(parseWholeNumber("")).toBeNull();
    expect(parseWholeNumber("1,5")).toBeNull();
    expect(parseWholeNumber("-3")).toBeNull();
  });

  test("errors land on the field that caused them", () => {
    const values = { ...defaultCreateGameValues(), name: "Journée ETIC" };
    expect(errorPaths({ ...values, name: " " })).toEqual([".name"]);
    expect(errorPaths({ ...values, memberCap: "0" })).toEqual([".memberCap"]);
    expect(errorPaths({ ...values, memberCap: "21" })).toEqual([".memberCap"]);
    expect(errorPaths({ ...values, teams: [teamDraft("Seule")] })).toEqual([".teams"]);
    const blankTeam = values.teams.map((team, index) =>
      index === 1 ? { ...team, name: "" } : team,
    );
    expect(errorPaths({ ...values, teams: blankTeam })).toEqual([".teams[1].name"]);
  });

  test("team names must differ", () => {
    const values = { ...defaultCreateGameValues(), name: "Journée ETIC" };
    const teams = [teamDraft("Les Lynx"), teamDraft("Équipe 2"), teamDraft(" les lynx ")];
    expect(errorPaths({ ...values, teams })).toEqual([".teams[2].name"]);
  });

  test("rehearsal settings are only checked in rehearsal mode", () => {
    const values = {
      ...defaultCreateGameValues(),
      name: "Test",
      secondsPerDay: "",
      durationDays: "0",
    };
    expect(errorPaths(values)).toEqual([]);
    expect(errorPaths({ ...values, rehearsal: true })).toEqual([".secondsPerDay", ".durationDays"]);
    expect(
      errorPaths({ ...values, rehearsal: true, secondsPerDay: "61", durationDays: "60" }),
    ).toEqual([".secondsPerDay"]);
  });

  test("builds the server input: trimmed names, rehearsal speed in milliseconds", () => {
    const values = {
      ...defaultCreateGameValues(),
      name: "  Répétition  ",
      teams: [teamDraft(" A "), teamDraft("B")],
      memberCap: "5",
    };
    expect(toCreateGameInput(values)).toEqual({
      name: "Répétition",
      teamNames: ["A", "B"],
      memberCap: 5,
    });
    expect(
      toCreateGameInput({ ...values, rehearsal: true, secondsPerDay: "5", durationDays: "120" }),
    ).toEqual({
      name: "Répétition",
      teamNames: ["A", "B"],
      memberCap: 5,
      msPerDay: 5_000,
      durationDays: 120,
    });
  });
});

describe("games and clock", () => {
  test("games in progress first, finished last, stable otherwise", () => {
    const games = [
      { id: "a", status: "ended" as const },
      { id: "b", status: "lobby" as const },
      { id: "c", status: "running" as const },
      { id: "d", status: "lobby" as const },
      { id: "e", status: "paused" as const },
    ];
    expect(sortGames(games).map((game) => game.id)).toEqual(["c", "e", "b", "d", "a"]);
  });

  test("speed labels", () => {
    expect(speedLabel(60_000)).toBe("1 jour = 1 min");
    expect(speedLabel(5_000)).toBe("1 jour = 5 s");
    expect(speedLabel(2_500)).toBe("1 jour = 2,5 s");
    expect(isRehearsal(60_000)).toBe(false);
    expect(isRehearsal(10_000)).toBe(true);
  });

  test("end time: today at the given time, never in the past", () => {
    const now = new Date(2026, 10, 6, 9, 30);
    const result = endTimeToday("18:00", now);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.endsAt.getHours()).toBe(18);
      expect(result.endsAt.getMinutes()).toBe(0);
      expect(result.endsAt.getDate()).toBe(6);
    }
    expect(endTimeToday("09:00", now)).toEqual({
      ok: false,
      message: "Cette heure est déjà passée : choisissez une heure à venir.",
    });
    expect(endTimeToday("", now).ok).toBe(false);
    expect(endTimeToday("25:00", now).ok).toBe(false);
    expect(endTimeToday("17:45:00", now).ok).toBe(true);
  });

  test("join codes ready to paste", () => {
    expect(
      joinCodesText([
        { name: "Équipe 1", joinCode: "LYNX-42" },
        { name: "Équipe 2", joinCode: "ORCA-17" },
      ]),
    ).toBe("Équipe 1 : LYNX-42\nÉquipe 2 : ORCA-17");
  });
});
