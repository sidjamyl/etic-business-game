import {
  buildRegistry,
  controlCommands,
  createEngine,
  defineCommand,
  type GameState,
  lobbyCommands,
  logTeam,
  type NewTeam,
  refuse,
} from "@etic/engine";
import { z } from "zod";

/** Engine with one fake team decision, for runtime and router tests. */
export const testEngine = createEngine({
  commands: buildRegistry(controlCommands, lobbyCommands, [
    defineCommand({
      type: "test.spend",
      actor: "team",
      schema: z.object({ amount: z.int().positive() }),
      apply: (draft, { amount }, actor) => {
        if (actor.kind !== "team") return;
        const team = draft.teams[actor.teamId];
        if (!team) return;
        if (team.cash < amount) refuse("INSUFFICIENT_FUNDS", "Trésorerie insuffisante.");
        team.cash -= amount;
        logTeam(draft, team.id, {
          kind: "decision",
          message: `Dépense ${amount}`,
          actor: actor.name,
        });
      },
    }),
  ]),
});

export const testTeams: NewTeam[] = [
  { id: "a", name: "Alpha", members: [{ userId: "u-a", name: "Lina" }] },
  { id: "b", name: "Bravo", members: [{ userId: "u-b", name: "Sami" }] },
];

/** Makes every team ready to start (company name and region), for tests. */
export function makeReady(state: GameState): void {
  for (const team of Object.values(state.teams)) {
    team.companyName ??= `${team.name} SA`;
    team.region ??= "azura";
  }
}
