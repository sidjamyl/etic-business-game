import {
  type Branch,
  type CardId,
  cardById,
  cardRules,
  hrRules,
  type ItemId,
  machineTypeById,
  materialIds,
  materials,
  type NewsSource,
  type ProductId,
  productIds,
  progressionRules,
  type RegionId,
  regionIds,
} from "@etic/content";
import type {
  ActivityEntry,
  CardEffects,
  CompanySummary,
  Employee,
  GameStatus,
  SecretCard,
  SpyReport,
  SupplierOffer,
  TeamCommandMap,
} from "@etic/engine";

/**
 * Pure helpers of the Secret card module (#39, R14, N18): fake-news drafts, targets, suppliers,
 * what the activity log tells about the card, and the spying report. The server stays the
 * single source of truth: these only prepare and explain decisions.
 */

export type CardPlay = TeamCommandMap["card.play"];

export function cardName(id: CardId): string {
  return cardById.get(id)?.name ?? id;
}

export function cardDescription(id: CardId): string {
  return cardById.get(id)?.description ?? "";
}

/** Why the card cannot be played right now, or null while the game runs. */
export function blockedReason(status: GameStatus): string | null {
  if (status === "paused") return "Jeu en pause : vous pourrez jouer votre carte à la reprise.";
  if (status === "ended") return "Partie terminée : la carte ne peut plus être jouée.";
  if (status === "lobby") return "La partie n'a pas encore commencé.";
  return null;
}

/** "1 employé", "3 employés": French puts zero and one in the singular. */
export function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count > 1 ? pluralForm : singular}`;
}

/** A day relative to today: "aujourd'hui", "demain", "dans 3 jours", "hier", "il y a 4 jours". */
export function relativeDay(day: number, today: number): string {
  const delta = day - today;
  if (delta === 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  if (delta === -1) return "hier";
  return delta > 0 ? `dans ${delta} jours` : `il y a ${-delta} jours`;
}

// ---------------------------------------------------------------------------------------------
// Fake news (N18): the server trims the title and the body, then checks their length.

export interface LengthCheck {
  /** Characters that count, spaces at both ends excluded (as on the server). */
  length: number;
  max: number;
  /** Characters over the limit; 0 within it. */
  over: number;
  empty: boolean;
}

export function lengthCheck(text: string, max: number): LengthCheck {
  const length = text.trim().length;
  return { length, max, over: Math.max(0, length - max), empty: length === 0 };
}

/** "12 / 80". */
export function counterLabel(check: LengthCheck): string {
  return `${check.length} / ${check.max}`;
}

/** "3 caractères en trop", or null within the limit. */
export function overLabel(check: LengthCheck): string | null {
  if (check.over === 0) return null;
  return `${plural(check.over, "caractère", "caractères")} en trop`;
}

/** Close to the limit (90 %), to warn before it is reached. */
export function nearLimit(check: LengthCheck): boolean {
  return check.over === 0 && check.length >= check.max * 0.9;
}

export interface FakeNewsDraft {
  source: NewsSource;
  /** null = the whole continent. */
  region: RegionId | null;
  title: string;
  body: string;
}

export const emptyFakeNews: FakeNewsDraft = {
  source: "serious",
  region: null,
  title: "",
  body: "",
};

export function fakeNewsChecks(draft: FakeNewsDraft): { title: LengthCheck; body: LengthCheck } {
  return {
    title: lengthCheck(draft.title, cardRules.fakeNewsTitleMax),
    body: lengthCheck(draft.body, cardRules.fakeNewsBodyMax),
  };
}

/** Both texts written and within their limits. */
export function fakeNewsReady(draft: FakeNewsDraft): boolean {
  const { title, body } = fakeNewsChecks(draft);
  return !title.empty && !body.empty && title.over === 0 && body.over === 0;
}

/** What still stops the publication, or a last reminder once the news can go out. */
export function fakeNewsHint(draft: FakeNewsDraft): string {
  const { title, body } = fakeNewsChecks(draft);
  if (title.over > 0 || body.over > 0) return "Raccourcissez votre news pour pouvoir la publier.";
  if (title.empty || body.empty) return "Écrivez un titre et un texte pour continuer.";
  return "Relisez l'aperçu : une fois publiée, la news ne pourra plus être modifiée.";
}

export function fakeNewsPayload(draft: FakeNewsDraft): CardPlay {
  return {
    kind: "fake-news",
    source: draft.source,
    region: draft.region,
    title: draft.title.trim(),
    body: draft.body.trim(),
  };
}

/** Value of the "whole continent" choice in the region select. */
export const CONTINENT = "continent";

/** Region chosen in the select: null for the whole continent, undefined when unknown. */
export function parseRegionChoice(value: string): RegionId | null | undefined {
  if (value === CONTINENT) return null;
  return regionIds.find((id) => id === value);
}

// ---------------------------------------------------------------------------------------------
// Targets and suppliers.

const collator = new Intl.Collator("fr", { sensitivity: "base", numeric: true });

export interface TargetOption {
  id: string;
  name: string;
  region: CompanySummary["region"];
  tier: CompanySummary["tier"];
  branch: CompanySummary["branch"];
}

/** Competitors a card can target, by name. Only public information (R21). */
export function targetOptions(competitors: Record<string, CompanySummary>): TargetOption[] {
  return Object.values(competitors)
    .map((company) => ({
      id: company.id,
      name: company.companyName ?? company.name,
      region: company.region,
      tier: company.tier,
      branch: company.branch,
    }))
    .sort((a, b) => collator.compare(a.name, b.name));
}

/** "Palier 2", "Palier 3 · Tech": public progress of a company (R2). */
export function tierLabel(tier: number, branch: string | null): string {
  if (branch === null) return `Palier ${tier}`;
  const name = progressionRules.branches[branch as Branch] ?? branch;
  return `Palier ${tier} · ${name}`;
}

/** Display name of a company: the name it chose, else the organizer's team name. */
export function companyLabel(
  company: { name: string; companyName: string | null } | undefined,
  fallback: string,
): string {
  if (!company) return fallback;
  return company.companyName ?? company.name;
}

/** Name of a raw material from its id ("flour" → "Farine"). */
export function materialLabel(material: string): string {
  return materials.find((item) => item.id === material)?.name ?? material;
}

export interface SupplierGroup {
  material: string;
  label: string;
  suppliers: SupplierOffer[];
}

/** Material suppliers grouped by material, in catalog order, then by name. */
export function supplierGroups(suppliers: Record<string, SupplierOffer>): SupplierGroup[] {
  const offers = Object.values(suppliers);
  return materials.flatMap((material) => {
    const list = offers
      .filter((offer) => offer.material === material.id)
      .sort((a, b) => collator.compare(a.name, b.name));
    return list.length > 0
      ? [{ material: material.id, label: material.name, suppliers: list }]
      : [];
  });
}

// ---------------------------------------------------------------------------------------------
// What the activity log tells. The engine writes these lines (modules/cards.ts); the tests run
// the real engine so a change of wording there is caught here.

/** The log line of the team playing its card: when and by whom (null once the log is trimmed). */
export function findPlay(log: readonly ActivityEntry[], id: CardId): ActivityEntry | null {
  const prefix = `Carte secrète « ${cardName(id)} » jouée`;
  return (
    log.findLast((entry) => entry.kind === "decision" && entry.message.startsWith(prefix)) ?? null
  );
}

/**
 * Anonymous notices of cards played against the company, latest first. Sabotage is reported,
 * never by whom; spying leaves no trace (N18).
 */
export function cardAttacks(log: readonly ActivityEntry[]): ActivityEntry[] {
  return log
    .filter((entry) => entry.kind === "event" && /carte secrète/i.test(entry.message))
    .toReversed();
}

// ---------------------------------------------------------------------------------------------
// Effects.

/** Last day of the amnesty shield if the card is played on `day`. */
export function shieldUntil(day: number): number {
  return day + cardRules.amnestyShieldDays;
}

/** Last day without any efficiency drop after social peace played on `day` (R6). */
export function freezeUntil(day: number): number {
  return day + hrRules.raiseGraceDays;
}

/** First day a machine sabotaged on `day` may run again (stopped while day < this one). */
export function sabotageResumeDay(day: number): number {
  return day + cardRules.sabotageDays;
}

/** Sabotage outcome: when the machine may run again, in the right tense. */
export function sabotageNote(playDay: number, today: number): string {
  const resume = sabotageResumeDay(playDay);
  return today < resume
    ? `Elle ne pourra pas redémarrer avant le jour ${resume}.`
    : `Elle a pu redémarrer le jour ${resume}.`;
}

/** Social peace outcome: until when efficiency holds, in the right tense. */
export function freezeNote(playDay: number, today: number): string {
  const until = freezeUntil(playDay);
  return today <= until
    ? `Leur rendement ne baissera pas avant le jour ${until}, même sans augmentation.`
    : `Le gel de la baisse a pris fin le jour ${until} : pensez aux augmentations.`;
}

export type ShieldState =
  | { kind: "active"; untilDay: number; daysLeft: number }
  /** An accusation came and was cancelled: the engine clears the shield. */
  | { kind: "spent" }
  | { kind: "expired"; untilDay: number };

/** The amnesty shield once the card is played; null for any other card or before it is played. */
export function amnestyShield(
  card: SecretCard | null,
  effects: CardEffects,
  today: number,
): ShieldState | null {
  if (card?.id !== "amnesty" || !card.used) return null;
  const until = effects.amnestyUntilDay;
  if (until === null) return { kind: "spent" };
  if (today <= until) return { kind: "active", untilDay: until, daysLeft: until - today };
  return { kind: "expired", untilDay: until };
}

export interface WorkforceSummary {
  /** Every hire, those still on their way included. */
  total: number;
  /** At work today. */
  present: number;
  /** At work below 100 %. */
  belowFull: number;
  /** Average efficiency of those at work (0–1); null when nobody is at work. */
  average: number | null;
}

export function workforceSummary(
  employees: Record<string, Employee>,
  today: number,
): WorkforceSummary {
  const all = Object.values(employees);
  const present = all.filter((employee) => employee.arrivesOnDay <= today);
  const sum = present.reduce((total, employee) => total + employee.efficiency, 0);
  return {
    total: all.length,
    present: present.length,
    belowFull: present.filter((employee) => employee.efficiency < 1).length,
    average: present.length === 0 ? null : sum / present.length,
  };
}

// ---------------------------------------------------------------------------------------------
// Spying report (N18), frozen on the day the card was played.

export interface StockLine {
  item: ItemId;
  quantity: number;
}

/** Goods in stock, raw materials then finished products, in catalog order. */
export function spyStock(inventory: SpyReport["inventory"]): {
  materials: StockLine[];
  products: StockLine[];
} {
  const lines = (ids: readonly ItemId[]) =>
    ids.flatMap((item) => {
      const quantity = inventory[item] ?? 0;
      return quantity > 0 ? [{ item, quantity }] : [];
    });
  return { materials: lines(materialIds), products: lines(productIds) };
}

export interface PriceGrid {
  regions: RegionId[];
  rows: { product: ProductId; cells: { region: RegionId; price: number | null }[] }[];
}

/** Selling prices: the regions and products where the company sells something. */
export function spyPrices(prices: SpyReport["prices"]): PriceGrid {
  const regions = regionIds.filter((region) =>
    productIds.some((product) => prices[region]?.[product] !== undefined),
  );
  const rows = productIds.flatMap((product) => {
    const cells = regions.map((region) => ({ region, price: prices[region]?.[product] ?? null }));
    return cells.some((cell) => cell.price !== null) ? [{ product, cells }] : [];
  });
  return { regions, rows };
}

export interface MachineLine {
  /** Stable within the frozen report: identical machines may share every other field. */
  key: string;
  name: string;
  efficiency: number;
  status: string;
}

/** Machines by type name, then from the most to the least efficient. */
export function spyMachines(machines: SpyReport["machines"]): MachineLine[] {
  return machines
    .map((machine) => ({
      name: machineTypeById.get(machine.typeId)?.name ?? machine.typeId,
      efficiency: machine.efficiency,
      status: machine.status,
    }))
    .sort((a, b) => collator.compare(a.name, b.name) || b.efficiency - a.efficiency)
    .map((line, position) => ({ key: `machine-${position}`, ...line }));
}
