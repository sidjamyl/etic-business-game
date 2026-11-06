import { describe, expect, test } from "bun:test";
import { scenarioNews } from "@etic/content";
import { gameEngine as engine } from "../index.ts";
import { memberOf, mustApply, refusalOf, startedGame } from "../testkit.ts";
import type { GameState, TeamState } from "../types.ts";
import { publicView } from "../views.ts";

const t1 = memberOf("t1");
const t2 = memberOf("t2");
const claim = (eggId: string, answer?: string) => ({
  type: "egg.claim",
  payload: answer === undefined ? { eggId } : { eggId, answer },
});

function team(state: GameState, id = "t1"): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error("no team");
  return found;
}

describe("easter eggs (R20, N23)", () => {
  test("the first finder gets ₢2 000 and a badge; the next only a badge", () => {
    let state = startedGame(engine, ["azura", "azura"]);
    state = mustApply(engine, state, t1, claim("konami"));
    state = mustApply(engine, state, t2, claim("konami"));
    expect(team(state)).toMatchObject({ cash: 52_000, badges: ["konami"] });
    expect(team(state, "t2")).toMatchObject({ cash: 50_000, badges: ["konami"] });
    expect(state.easterEggs.konami).toEqual(["t1", "t2"]);
  });

  test("the projector announces it anonymously", () => {
    const state = mustApply(engine, startedGame(engine, ["azura"]), t1, claim("logo"));
    const announcement = publicView(state).announcements.at(-1)?.message;
    expect(announcement).toBe("Une équipe a découvert un secret…");
  });

  test("a secret can be found once per company", () => {
    const state = mustApply(engine, startedGame(engine, ["azura"]), t1, claim("logo"));
    expect(refusalOf(engine, state, t1, claim("logo"))?.message).toBe(
      "Vous avez déjà découvert ce secret.",
    );
  });

  test("the acrostic needs the right word, accents and case ignored", () => {
    const state = startedGame(engine, ["azura"]);
    expect(refusalOf(engine, state, t1, claim("acrostic", "LICORNE"))?.message).toBe(
      "Ce n'est pas la bonne réponse.",
    );
    expect(refusalOf(engine, state, t1, claim("acrostic"))?.code).toBe("INVALID_PAYLOAD");
    expect(engine.applyCommand(state, t1, claim("acrostic", " trésor ")).ok).toBe(true);
  });

  test("the acrostic news really spells the word", () => {
    const news = scenarioNews.find((n) => n.id === "n-egg-acrostic");
    const initials = (news?.body ?? "")
      .split(/(?<=[.?!])\s+/)
      .map((sentence) => sentence.trim()[0])
      .join("");
    expect(initials).toBe("TRESOR");
  });

  test("the secret warehouse code delivers 30 components to the first finder", () => {
    let state = startedGame(engine, ["azura"]);
    state = mustApply(engine, state, t1, claim("secret-supplier", "entrepot-404"));
    state = engine.step(state);
    expect(team(state).inventory.components).toBe(30);
  });
});
