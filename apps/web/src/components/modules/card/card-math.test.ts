import { describe, expect, test } from "bun:test";
import { type CardId, cardRules, hrRules, materials } from "@etic/content";
import {
  type ActivityEntry,
  type Actor,
  type CompanySummary,
  type Employee,
  type GameState,
  gameEngine,
  newMachine,
  type SupplierOffer,
  type TeamState,
  teamView,
} from "@etic/engine";
import {
  amnestyShield,
  blockedReason,
  CONTINENT,
  cardAttacks,
  companyLabel,
  counterLabel,
  emptyFakeNews,
  fakeNewsChecks,
  fakeNewsHint,
  fakeNewsPayload,
  fakeNewsReady,
  findPlay,
  freezeNote,
  freezeUntil,
  lengthCheck,
  materialLabel,
  nearLimit,
  overLabel,
  parseRegionChoice,
  plural,
  relativeDay,
  sabotageNote,
  sabotageResumeDay,
  shieldUntil,
  spyMachines,
  spyPrices,
  spyStock,
  supplierGroups,
  targetOptions,
  tierLabel,
  workforceSummary,
} from "./card-math.ts";

const ORGANIZER: Actor = { kind: "organizer", userId: "org", name: "Org" };
const TEAMS = ["t1", "t2", "t3"] as const;

function member(teamId: string): Actor {
  return { kind: "team", teamId, userId: `u-${teamId}`, name: `Joueur ${teamId}` };
}

function apply(state: GameState, actor: Actor, type: string, payload?: unknown): GameState {
  const result = gameEngine.applyCommand(state, actor, { type, payload });
  if (!result.ok) throw new Error(`${type} refused: ${result.refusal.message}`);
  return result.state;
}

/** A running game with three companies in Azura; t1 holds `card`. */
function gameWith(card: CardId): GameState {
  let state = gameEngine.createGame({
    id: "g-cards",
    seed: "cards",
    config: { stepsPerDay: 4, countdownDays: 30 },
    teams: TEAMS.map((id, index) => ({
      id,
      name: `Équipe ${index + 1}`,
      members: [{ userId: `u-${id}`, name: `Joueur ${id}` }],
    })),
  });
  for (const id of TEAMS) {
    state = apply(state, member(id), "lobby.setCompanyName", { companyName: `Société ${id}` });
    state = apply(state, member(id), "lobby.chooseRegion", { region: "azura" });
  }
  state = apply(state, ORGANIZER, "control.start");
  team(state, "t1").card = { id: card, used: false };
  team(state, "t2").card = { id: card === "spying" ? "sabotage" : "spying", used: false };
  return state;
}

function team(state: GameState, id: string): TeamState {
  const found = state.teams[id];
  if (!found) throw new Error(`no team ${id}`);
  return found;
}

function days(state: GameState, count: number): GameState {
  let current = state;
  for (let i = 0; i < count * current.config.stepsPerDay; i++) current = gameEngine.step(current);
  return current;
}

function entry(overrides: Partial<ActivityEntry>): ActivityEntry {
  return { id: 1, day: 3, step: 0, kind: "event", message: "", ...overrides };
}

describe("labels", () => {
  test("relative days", () => {
    expect(relativeDay(10, 10)).toBe("aujourd'hui");
    expect(relativeDay(11, 10)).toBe("demain");
    expect(relativeDay(14, 10)).toBe("dans 4 jours");
    expect(relativeDay(9, 10)).toBe("hier");
    expect(relativeDay(6, 10)).toBe("il y a 4 jours");
  });

  test("French plural: zero and one are singular", () => {
    expect(plural(0, "trace", "traces")).toBe("0 trace");
    expect(plural(1, "trace", "traces")).toBe("1 trace");
    expect(plural(2, "trace", "traces")).toBe("2 traces");
  });

  test("the card can only be played while the game runs", () => {
    expect(blockedReason("running")).toBeNull();
    expect(blockedReason("paused")).toContain("pause");
    expect(blockedReason("ended")).toContain("terminée");
  });

  test("public progress of a company", () => {
    expect(tierLabel(1, null)).toBe("Palier 1");
    expect(tierLabel(3, "tech")).toBe("Palier 3 · Tech");
    expect(tierLabel(3, "leisure")).toBe("Palier 3 · Loisirs");
  });

  test("company and material names", () => {
    expect(companyLabel({ name: "Équipe 2", companyName: "Zénith" }, "?")).toBe("Zénith");
    expect(companyLabel({ name: "Équipe 2", companyName: null }, "?")).toBe("Équipe 2");
    expect(companyLabel(undefined, "Entreprise retirée")).toBe("Entreprise retirée");
    expect(materialLabel("flour")).toBe("Farine");
    expect(materialLabel("unobtainium")).toBe("unobtainium");
  });
});

describe("fake news draft", () => {
  test("spaces at both ends do not count, as on the server", () => {
    const check = lengthCheck("  Pénurie  ", 80);
    expect(check).toEqual({ length: 7, max: 80, over: 0, empty: false });
    expect(counterLabel(check)).toBe("7 / 80");
    expect(lengthCheck("   ", 80).empty).toBe(true);
  });

  test("characters over the limit are counted and named", () => {
    const check = lengthCheck("x".repeat(83), 80);
    expect(check.over).toBe(3);
    expect(overLabel(check)).toBe("3 caractères en trop");
    expect(overLabel(lengthCheck("x".repeat(81), 80))).toBe("1 caractère en trop");
    expect(overLabel(lengthCheck("x".repeat(80), 80))).toBeNull();
  });

  test("the counter warns from 90 % of the limit, not beyond it", () => {
    expect(nearLimit(lengthCheck("x".repeat(71), 80))).toBe(false);
    expect(nearLimit(lengthCheck("x".repeat(72), 80))).toBe(true);
    expect(nearLimit(lengthCheck("x".repeat(80), 80))).toBe(true);
    expect(nearLimit(lengthCheck("x".repeat(81), 80))).toBe(false);
  });

  test("limits come from the game rules", () => {
    const checks = fakeNewsChecks(emptyFakeNews);
    expect(checks.title.max).toBe(cardRules.fakeNewsTitleMax);
    expect(checks.body.max).toBe(cardRules.fakeNewsBodyMax);
  });

  test("ready once both texts are written and within their limits", () => {
    expect(fakeNewsReady(emptyFakeNews)).toBe(false);
    expect(fakeNewsReady({ ...emptyFakeNews, title: "Titre", body: " " })).toBe(false);
    expect(fakeNewsReady({ ...emptyFakeNews, title: "Titre", body: "Texte" })).toBe(true);
    expect(
      fakeNewsReady({
        ...emptyFakeNews,
        title: "x".repeat(cardRules.fakeNewsTitleMax + 1),
        body: "Texte",
      }),
    ).toBe(false);
  });

  test("the hint says what is missing, then reminds that it is final", () => {
    expect(fakeNewsHint(emptyFakeNews)).toContain("titre et un texte");
    expect(fakeNewsHint({ ...emptyFakeNews, title: "Titre" })).toContain("titre et un texte");
    expect(
      fakeNewsHint({
        ...emptyFakeNews,
        title: "",
        body: "x".repeat(cardRules.fakeNewsBodyMax + 1),
      }),
    ).toContain("Raccourcissez");
    expect(fakeNewsHint({ ...emptyFakeNews, title: "Titre", body: "Texte" })).toContain(
      "ne pourra plus être modifiée",
    );
  });

  test("the payload is trimmed and keeps the source and the region", () => {
    expect(
      fakeNewsPayload({ source: "tabloid", region: "azura", title: " Scoop ", body: " Texte. " }),
    ).toEqual({
      kind: "fake-news",
      source: "tabloid",
      region: "azura",
      title: "Scoop",
      body: "Texte.",
    });
  });

  test("region choice: the whole continent or a known region", () => {
    expect(parseRegionChoice(CONTINENT)).toBeNull();
    expect(parseRegionChoice("azura")).toBe("azura");
    expect(parseRegionChoice("atlantis")).toBeUndefined();
  });

  test("an accepted draft is published as is, without its origin", () => {
    const draft = {
      source: "serious" as const,
      region: null,
      title: " Rappel massif de bouilloires ",
      body: "Selon nos sources, un défaut toucherait toute la production.",
    };
    let state = gameWith("fake-news");
    state = apply(state, member("t1"), "card.play", fakeNewsPayload(draft));
    const published = teamView(state, "t2")?.news.at(-1);
    expect(published).toMatchObject({
      source: "serious",
      region: null,
      title: "Rappel massif de bouilloires",
    });
    expect(published && "origin" in published).toBe(false);
  });
});

describe("targets and suppliers", () => {
  const company = (overrides: Partial<CompanySummary>): CompanySummary => ({
    id: "t2",
    name: "Équipe 2",
    companyName: null,
    region: "azura",
    memberCount: 1,
    ready: true,
    tier: 1,
    branch: null,
    ...overrides,
  });

  test("competitors are listed by company name, the team name as a fallback", () => {
    const options = targetOptions({
      t2: company({ id: "t2", companyName: "Zénith" }),
      t3: company({ id: "t3", companyName: null, name: "Équipe 3" }),
      t4: company({ id: "t4", companyName: "azur & co", tier: 2 }),
    });
    expect(options.map((option) => option.name)).toEqual(["azur & co", "Équipe 3", "Zénith"]);
    expect(options[0]).toMatchObject({ id: "t4", tier: 2, region: "azura" });
  });

  test("a team's own view offers every other company and none of its own", () => {
    const view = teamView(gameWith("sabotage"), "t1");
    expect(targetOptions(view?.competitors ?? {}).map((option) => option.id)).toEqual(["t2", "t3"]);
  });

  test("suppliers are grouped by material in catalog order, then by name", () => {
    const view = teamView(gameWith("supplier-priority"), "t1");
    const suppliers: Record<string, SupplierOffer> = view?.market.suppliers ?? {};
    const groups = supplierGroups(suppliers);
    expect(groups.map((group) => group.material)).toEqual(
      materials
        .map((material) => material.id)
        .filter((id) => Object.values(suppliers).some((offer) => offer.material === id)),
    );
    expect(groups.flatMap((group) => group.suppliers).length).toBe(Object.keys(suppliers).length);
    for (const group of groups) {
      const names = group.suppliers.map((offer) => offer.name);
      expect(names).toEqual(names.toSorted((a, b) => a.localeCompare(b, "fr")));
      expect(group.suppliers.every((offer) => offer.material === group.material)).toBe(true);
    }
  });
});

describe("what the log tells", () => {
  test("the play line gives the day and the member who played", () => {
    let state = days(gameWith("social-peace"), 2);
    state = apply(state, member("t1"), "card.play", { kind: "social-peace" });
    const play = findPlay(team(state, "t1").log, "social-peace");
    expect(play).toMatchObject({ day: 3, actor: "Joueur t1", kind: "decision" });
    expect(findPlay(team(state, "t1").log, "amnesty")).toBeNull();
    expect(freezeUntil(3)).toBe(3 + hrRules.raiseGraceDays);
  });

  test("outcome notes follow the clock", () => {
    const resume = sabotageResumeDay(10);
    expect(resume).toBe(10 + cardRules.sabotageDays);
    expect(sabotageNote(10, resume - 1)).toBe(
      `Elle ne pourra pas redémarrer avant le jour ${resume}.`,
    );
    expect(sabotageNote(10, resume)).toBe(`Elle a pu redémarrer le jour ${resume}.`);
    const until = freezeUntil(10);
    expect(freezeNote(10, until)).toContain(`ne baissera pas avant le jour ${until}`);
    expect(freezeNote(10, until + 1)).toContain(`a pris fin le jour ${until}`);
  });

  test("sabotage is reported to the target, never by whom", () => {
    let state = gameWith("sabotage");
    team(state, "t2").machines.m1 = newMachine("m1", "oven");
    state = apply(state, member("t1"), "card.play", { kind: "sabotage", targetTeamId: "t2" });
    const attacks = cardAttacks(team(state, "t2").log);
    expect(attacks).toHaveLength(1);
    expect(attacks[0]?.message).toContain("sabotage");
    expect(attacks[0]?.message).not.toContain("Société t1");
    expect(attacks[0]?.message).not.toContain("Joueur t1");
    expect(attacks[0]?.actor).toBeUndefined();
    // The player's own decision is not an attack, and third parties hear nothing.
    expect(cardAttacks(team(state, "t1").log)).toEqual([]);
    expect(cardAttacks(team(state, "t3").log)).toEqual([]);
    expect(team(state, "t2").machines.m1?.stoppedUntilDay).toBe(sabotageResumeDay(1));
  });

  test("spying leaves no trace on the target", () => {
    let state = gameWith("spying");
    state = apply(state, member("t1"), "card.play", { kind: "spying", targetTeamId: "t2" });
    expect(cardAttacks(team(state, "t2").log)).toEqual([]);
  });

  test("notices come latest first and only from events about a card", () => {
    const log = [
      entry({ id: 1, message: "Votre entreprise a été la cible d'une carte secrète (sabotage)." }),
      entry({ id: 2, kind: "decision", message: "Carte secrète « Espionnage » jouée." }),
      entry({ id: 3, message: "Grève : salaires impayés." }),
      entry({ id: 4, message: "Votre entreprise a été la cible d'une carte secrète (sabotage)." }),
    ];
    expect(cardAttacks(log).map((item) => item.id)).toEqual([4, 1]);
  });
});

describe("amnesty shield", () => {
  test("nothing to show before the card is played or for another card", () => {
    const state = gameWith("amnesty");
    const t1 = team(state, "t1");
    expect(amnestyShield(t1.card, t1.cardEffects, 1)).toBeNull();
    const t2 = team(state, "t2");
    expect(amnestyShield({ id: "spying", used: true }, t2.cardEffects, 1)).toBeNull();
  });

  test("active until its last day, then expired", () => {
    let state = apply(gameWith("amnesty"), member("t1"), "card.play", { kind: "amnesty" });
    const t1 = team(state, "t1");
    expect(amnestyShield(t1.card, t1.cardEffects, 1)).toEqual({
      kind: "active",
      untilDay: shieldUntil(1),
      daysLeft: cardRules.amnestyShieldDays,
    });
    state = days(state, cardRules.amnestyShieldDays + 1);
    const later = team(state, "t1");
    expect(amnestyShield(later.card, later.cardEffects, state.time.day)).toEqual({
      kind: "expired",
      untilDay: shieldUntil(1),
    });
  });

  test("spent once it has cancelled an accusation", () => {
    let state = apply(gameWith("amnesty"), member("t1"), "card.play", { kind: "amnesty" });
    state = apply(state, member("t2"), "blackMarket.accuse", { targetTeamId: "t1" });
    const t1 = team(state, "t1");
    expect(amnestyShield(t1.card, t1.cardEffects, state.time.day)).toEqual({ kind: "spent" });
  });
});

describe("workforce", () => {
  const employee = (overrides: Partial<Employee>): Employee => ({
    id: "e",
    job: "operator",
    wage: 1_000,
    efficiency: 1,
    hiredOnDay: 1,
    arrivesOnDay: 1,
    lastRaiseDay: 1,
    machineId: null,
    ...overrides,
  });

  test("counts hires on their way, averages those at work", () => {
    expect(
      workforceSummary(
        {
          a: employee({ id: "a", efficiency: 0.8 }),
          b: employee({ id: "b", efficiency: 1 }),
          c: employee({ id: "c", arrivesOnDay: 12, efficiency: 1 }),
        },
        10,
      ),
    ).toEqual({ total: 3, present: 2, belowFull: 1, average: 0.9 });
  });

  test("no average without anyone at work", () => {
    expect(workforceSummary({}, 10)).toEqual({ total: 0, present: 0, belowFull: 0, average: null });
  });
});

describe("spying report", () => {
  test("is frozen when played and reads in catalog order", () => {
    let state = gameWith("spying");
    const spied = team(state, "t2");
    spied.inventory = { bread: 40, flour: 120, water: 0, soap: 5 };
    spied.machines.m1 = { ...newMachine("m1", "oven"), efficiency: 0.9 };
    spied.machines.m2 = newMachine("m2", "bottling-line");
    spied.machines.m3 = { ...newMachine("m3", "oven"), efficiency: 0.95, status: "running" };
    spied.prices = { azura: { bread: 30, soap: 28 }, ferronia: { bread: 34 } };
    state = apply(state, member("t1"), "card.play", { kind: "spying", targetTeamId: "t2" });
    team(state, "t2").inventory.bread = 0;
    const report = team(state, "t1").cardEffects.spyReport;
    if (!report) throw new Error("no report");

    expect(report).toMatchObject({ companyName: "Société t2", day: 1 });
    expect(spyStock(report.inventory)).toEqual({
      materials: [{ item: "flour", quantity: 120 }],
      products: [
        { item: "bread", quantity: 40 },
        { item: "soap", quantity: 5 },
      ],
    });
    expect(spyPrices(report.prices)).toEqual({
      regions: ["azura", "ferronia"],
      rows: [
        {
          product: "bread",
          cells: [
            { region: "azura", price: 30 },
            { region: "ferronia", price: 34 },
          ],
        },
        {
          product: "soap",
          cells: [
            { region: "azura", price: 28 },
            { region: "ferronia", price: null },
          ],
        },
      ],
    });
    const machines = spyMachines(report.machines);
    expect(machines.map(({ key: _key, ...line }) => line)).toEqual([
      { name: "Four industriel", efficiency: 0.95, status: "running" },
      { name: "Four industriel", efficiency: 0.9, status: "idle" },
      { name: "Ligne d'embouteillage", efficiency: 1, status: "idle" },
    ]);
    expect(new Set(machines.map((line) => line.key)).size).toBe(machines.length);
  });

  test("an empty company reads as empty", () => {
    expect(spyStock({})).toEqual({ materials: [], products: [] });
    expect(spyPrices({})).toEqual({ regions: [], rows: [] });
    expect(spyMachines([])).toEqual([]);
  });
});
