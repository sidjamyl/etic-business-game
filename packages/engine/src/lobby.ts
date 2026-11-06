import { regionById, regionIds, startRules } from "@etic/content";
import { z } from "zod";
import { defineCommand } from "./commands.ts";
import { refuse } from "./errors.ts";
import { logTeam } from "./log.ts";
import type { GameState, TeamState } from "./types.ts";
import { isTeamReady, teamOfUser } from "./views.ts";

export function missingForStart(state: GameState): string[] {
  return Object.values(state.teams)
    .filter((team) => !isTeamReady(team))
    .map((team) => team.name);
}

function requireTeam(draft: GameState, teamId: string): TeamState {
  const team = draft.teams[teamId];
  if (!team) refuse("NOT_FOUND", "Équipe introuvable.");
  return team;
}

function addMember(draft: GameState, team: TeamState, userId: string, name: string) {
  if (Object.keys(team.members).length >= draft.memberCap) {
    refuse("TEAM_FULL", "Équipe complète.");
  }
  team.members[userId] = { userId, name };
  logTeam(draft, team.id, { kind: "system", message: `${name} rejoint l'équipe.` });
}

const companyName = z
  .string()
  .trim()
  .min(1, "Le nom de l'entreprise est obligatoire.")
  .max(startRules.companyNameMaxLength, "Nom d'entreprise trop long.");

/** Lobby and membership commands (P7, O4, N6, R21). */
export const lobbyCommands = [
  defineCommand({
    type: "lobby.join",
    actor: "player",
    // Joining stays open during the whole game (N6).
    allowedStatuses: ["lobby", "running", "paused"],
    schema: z.object({ teamId: z.string().min(1) }),
    apply: (draft, { teamId }, actor) => {
      const current = teamOfUser(draft, actor.userId);
      if (current === teamId) return;
      if (current) refuse("ALREADY_IN_TEAM", "Vous faites déjà partie d'une autre équipe.");
      addMember(draft, requireTeam(draft, teamId), actor.userId, actor.name);
    },
  }),
  defineCommand({
    type: "lobby.setCompanyName",
    actor: "team",
    allowedStatuses: ["lobby"],
    schema: z.object({ companyName }),
    apply: (draft, payload, actor) => {
      if (actor.kind !== "team") return;
      const team = requireTeam(draft, actor.teamId);
      team.companyName = payload.companyName;
      logTeam(draft, team.id, {
        kind: "decision",
        message: `Nom de l'entreprise : ${payload.companyName}`,
        actor: actor.name,
      });
    },
  }),
  defineCommand({
    type: "lobby.chooseRegion",
    actor: "team",
    allowedStatuses: ["lobby"],
    schema: z.object({ region: z.enum(regionIds) }),
    apply: (draft, { region }, actor) => {
      if (actor.kind !== "team") return;
      const team = requireTeam(draft, actor.teamId);
      team.region = region;
      logTeam(draft, team.id, {
        kind: "decision",
        message: `Région : ${regionById.get(region)?.name ?? region}`,
        actor: actor.name,
      });
    },
  }),
  defineCommand({
    type: "admin.moveMember",
    actor: "organizer",
    allowedStatuses: ["lobby", "running", "paused"],
    schema: z.object({ userId: z.string().min(1), toTeamId: z.string().min(1) }),
    apply: (draft, { userId, toTeamId }) => {
      const fromId = teamOfUser(draft, userId);
      if (!fromId) refuse("NOT_FOUND", "Participant introuvable.");
      if (fromId === toTeamId) return;
      const from = requireTeam(draft, fromId);
      const to = requireTeam(draft, toTeamId);
      const member = from.members[userId];
      if (!member) refuse("NOT_FOUND", "Participant introuvable.");
      delete from.members[userId];
      logTeam(draft, from.id, { kind: "system", message: `${member.name} quitte l'équipe.` });
      addMember(draft, to, userId, member.name);
    },
  }),
  defineCommand({
    type: "admin.removeMember",
    actor: "organizer",
    allowedStatuses: ["lobby", "running", "paused"],
    schema: z.object({ userId: z.string().min(1) }),
    apply: (draft, { userId }) => {
      const teamId = teamOfUser(draft, userId);
      if (!teamId) refuse("NOT_FOUND", "Participant introuvable.");
      const team = requireTeam(draft, teamId);
      const name = team.members[userId]?.name ?? "Un participant";
      delete team.members[userId];
      logTeam(draft, team.id, { kind: "system", message: `${name} a été retiré de l'équipe.` });
    },
  }),
  defineCommand({
    type: "admin.setMemberCap",
    actor: "organizer",
    allowedStatuses: ["lobby", "running", "paused"],
    schema: z.object({ memberCap: z.int().min(1).max(20) }),
    apply: (draft, { memberCap }) => {
      draft.memberCap = memberCap;
    },
  }),
];
