import {
  blackMarketRules,
  type MaterialId,
  materialSuppliers,
  materials,
  newsSources,
  type ProductId,
  products,
  type RegionId,
} from "@etic/content";
import {
  type ActivityEntry,
  type BlackMarketTrace,
  type GameStatus,
  type InboundShipment,
  impactScores,
  localPrice,
  recordPurchase,
  type SupplierOffer,
  type TeamState,
} from "@etic/engine";
import { credits, formatNumber } from "@/lib/format";

/**
 * Pure helpers of the black-market module (#38, R13, N17). Every amount is computed like the
 * engine (packages/engine/src/modules/black-market.ts); the server stays the source of truth.
 */
const rules = blackMarketRules;
const accusation = rules.accusation;

/** "0 unité", "1 unité", "12 unités": French singular below 2. */
export function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return `${formatNumber(count)} ${Math.abs(count) >= 2 ? pluralForm : singular}`;
}

/** "1 unité", "1 200 unités". */
export function unitsLabel(count: number): string {
  return plural(count, "unité");
}

/** "1 jour", "30 jours". */
export function daysLabel(count: number): string {
  return plural(count, "jour");
}

/** "aujourd'hui", "hier", "il y a 3 jours", "demain", "dans 3 jours". */
export function relativeDay(day: number, today: number): string {
  const delta = day - today;
  if (delta === 0) return "aujourd'hui";
  if (delta === 1) return "demain";
  if (delta === -1) return "hier";
  return delta > 0 ? `dans ${daysLabel(delta)}` : `il y a ${daysLabel(-delta)}`;
}

/** Why decisions are blocked (pause or end of game, O1), or null while the game runs. */
export function blockedReason(status: GameStatus): string | null {
  if (status === "paused") return "Jeu en pause : vous pourrez conclure à la reprise.";
  if (status === "ended") return "Partie terminée : le marché noir a fermé ses portes.";
  if (status === "lobby") return "La partie n'a pas encore commencé.";
  return null;
}

export type QuantityInput =
  | { kind: "empty" }
  | { kind: "invalid"; message: string }
  | { kind: "valid"; quantity: number };

/** A typed quantity: a positive whole number of units (engine schema: positive integer). */
export function parseQuantity(text: string): QuantityInput {
  const trimmed = text.trim();
  if (trimmed === "") return { kind: "empty" };
  if (!/^\d+$/.test(trimmed)) {
    return { kind: "invalid", message: "Indiquez un nombre entier d'unités." };
  }
  const quantity = Number(trimmed);
  if (quantity === 0) return { kind: "invalid", message: "La quantité doit être positive." };
  if (!Number.isSafeInteger(quantity)) return { kind: "invalid", message: "Quantité trop grande." };
  return { kind: "valid", quantity };
}

/** Amount paid or received for a deal, rounded to the crédit like the engine. */
export function dealAmount(unitPrice: number, quantity: number): number {
  return Math.round(unitPrice * quantity);
}

/** Largest quantity whose rounded cost fits in the available cash. */
export function affordableUnits(unitPrice: number, cash: number): number {
  if (cash < 0) return 0;
  if (unitPrice <= 0) return Number.POSITIVE_INFINITY;
  let units = Math.floor(cash / unitPrice);
  while (units > 0 && dealAmount(unitPrice, units) > cash) units -= 1;
  while (dealAmount(unitPrice, units + 1) <= cash) units += 1;
  return units;
}

export interface BuyLimit {
  max: number;
  limitedBy: "stock" | "cash";
}

/** Most units a team can buy now: the shared stock, then its available cash. */
export function buyLimit(stock: number, unitPrice: number, cash: number): BuyLimit {
  const inStock = Math.max(0, stock);
  const affordable = affordableUnits(unitPrice, cash);
  return affordable < inStock
    ? { max: affordable, limitedBy: "cash" }
    : { max: inStock, limitedBy: "stock" };
}

export interface SellLimit {
  /** Units buyers still take today (daily cap, R13). */
  left: number;
  /** Finished products in stock and not reserved by accepted orders (O2). */
  available: number;
  max: number;
  limitedBy: "cap" | "stock";
}

export function sellLimit(cap: number, soldToday: number, available: number): SellLimit {
  const left = Math.max(0, cap - soldToday);
  const stock = Math.max(0, available);
  return stock < left
    ? { left, available: stock, max: stock, limitedBy: "stock" }
    : { left, available: stock, max: left, limitedBy: "cap" };
}

export interface DealMessage {
  tone: "error" | "warning";
  text: string;
}

export function hasError(messages: readonly DealMessage[]): boolean {
  return messages.some((message) => message.tone === "error");
}

/** Refusals the engine would give, said before sending, plus the warehouse warning (R9). */
export function buyMessages({
  input,
  stock,
  nextRestockDay,
  cost,
  cash,
  room,
}: {
  input: QuantityInput;
  stock: number;
  nextRestockDay: number;
  cost: number;
  cash: number;
  room: number;
}): DealMessage[] {
  if (input.kind === "invalid") return [{ tone: "error", text: input.message }];
  if (input.kind === "empty") return [];
  const { quantity } = input;
  const messages: DealMessage[] = [];
  if (quantity > stock) {
    messages.push({
      tone: "error",
      text:
        stock <= 0
          ? `Plus rien en stock : réassort le jour ${nextRestockDay}.`
          : `Il ne reste que ${unitsLabel(stock)} : réassort le jour ${nextRestockDay}.`,
    });
  }
  if (cost > cash) {
    messages.push({
      tone: "error",
      text: `Trésorerie disponible insuffisante : il faut ${credits(cost)}, vous disposez de ${credits(Math.max(0, cash))}.`,
    });
  }
  if (quantity > room) {
    messages.push({
      tone: "warning",
      text:
        room <= 0
          ? "Entrepôt plein à l'arrivée : la livraison attendra qu'une place se libère."
          : `Seulement ${unitsLabel(room)} de place à l'arrivée : la livraison attendra de pouvoir tout ranger.`,
    });
  }
  return messages;
}

export function sellMessages({
  input,
  limit,
}: {
  input: QuantityInput;
  limit: SellLimit;
}): DealMessage[] {
  if (input.kind === "invalid") return [{ tone: "error", text: input.message }];
  if (input.kind === "empty") return [];
  const messages: DealMessage[] = [];
  if (input.quantity > limit.left) {
    messages.push({
      tone: "error",
      text:
        limit.left === 0
          ? "Plafond du jour atteint : les acheteurs reviennent demain."
          : `Les acheteurs n'en prendront plus que ${unitsLabel(limit.left)} aujourd'hui.`,
    });
  }
  if (input.quantity > limit.available) {
    messages.push({
      tone: "error",
      text:
        limit.available === 0
          ? "Aucun stock disponible : le stock réservé à vos commandes ne se vend pas ici."
          : `Stock disponible insuffisant : ${unitsLabel(limit.available)}, hors stock réservé à vos commandes.`,
    });
  }
  return messages;
}

/** Materials sold off the books, in catalog order. */
export function blackMarketMaterialIds(buy: Partial<Record<MaterialId, unknown>>): MaterialId[] {
  return materials.map((material) => material.id).filter((id) => buy[id] !== undefined);
}

/** Weekly stock level of a material, restored at each restock. */
export function weeklyStock(material: MaterialId): number | null {
  return (rules.stock as Partial<Record<MaterialId, number>>)[material] ?? null;
}

/**
 * Products worth listing: those the team can make (tier and branch reached) and any product
 * it holds, e.g. received through a trade.
 */
export function sellableProducts(team: TeamState): ProductId[] {
  const { unlockedTier, branch } = team.progression;
  return products
    .filter((product) => {
      if ((team.inventory[product.id] ?? 0) > 0) return true;
      if ((team.blackMarket.soldToday[product.id] ?? 0) > 0) return true;
      if (product.tier > unlockedTier) return false;
      return product.tier < 3 || product.branch === branch;
    })
    .map((product) => product.id);
}

/** Cheapest regular offer of a material as the team sees it (region and events included). */
export function cheapestLegalPrice(
  suppliers: Readonly<Record<string, SupplierOffer>>,
  material: MaterialId,
): number | null {
  let best: number | null = null;
  for (const offer of Object.values(suppliers)) {
    if (offer.material !== material) continue;
    if (best === null || offer.unitPrice < best) best = offer.unitPrice;
  }
  return best;
}

/** Relative gap to a reference price: −0.35 = 35 % cheaper, 0.3 = 30 % dearer. */
export function priceGap(price: number, reference: number): number {
  return reference > 0 ? price / reference - 1 : 0;
}

/** Average catalog price of a material's suppliers: the engine's reference for the gain. */
export function regularMaterialPrice(material: MaterialId): number {
  const prices = materialSuppliers
    .filter((supplier) => supplier.material === material)
    .map((supplier) => supplier.price);
  return prices.reduce((sum, price) => sum + price, 0) / Math.max(1, prices.length);
}

/** Illicit gain recorded by a purchase (trace of the deal, R13). */
export function buyGain(material: MaterialId, unitPrice: number, quantity: number): number {
  return Math.round((regularMaterialPrice(material) - unitPrice) * quantity);
}

/** Illicit gain recorded by a sale: above the local price of the home region. */
export function sellGain(
  region: RegionId | null,
  productId: ProductId,
  unitPrice: number,
  quantity: number,
): number {
  const regular = region ? localPrice(region, productId) : unitPrice;
  return Math.round((unitPrice - regular) * quantity);
}

/** Fine of a conviction: a multiple of the recent illicit gain, with a minimum (N17). */
export function convictionFine(gain: number): number {
  return Math.max(accusation.minFine, Math.round(gain * accusation.fineMultiplier));
}

export interface TraceSummary {
  count: number;
  /** Illicit gain of the recent deals. */
  gain: number;
  /** Fine if the company were convicted today; 0 without recent traces (nothing to find). */
  fine: number;
  /** Day the oldest recent trace disappears. */
  nextFadeDay: number | null;
  /** Day the last trace disappears, without any new deal. */
  clearDay: number | null;
}

/** Traces of the last days (they fade after `traceDays`, like the engine's recentTraces). */
export function traceSummary(traces: readonly BlackMarketTrace[], today: number): TraceSummary {
  const recent = traces.filter((trace) => trace.day > today - rules.traceDays);
  if (recent.length === 0) {
    return { count: 0, gain: 0, fine: 0, nextFadeDay: null, clearDay: null };
  }
  const gain = recent.reduce((sum, trace) => sum + trace.gain, 0);
  const days = recent.map((trace) => trace.day);
  return {
    count: recent.length,
    gain,
    fine: convictionFine(gain),
    nextFadeDay: Math.min(...days) + rules.traceDays,
    clearDay: Math.max(...days) + rules.traceDays,
  };
}

/**
 * Free warehouse room when a delivery due on `day` is received: goods already due by then
 * come first, a finished expansion adds room (R9). An estimate: production also fills it.
 */
export function roomOnArrival(team: TeamState, used: number, day: number): number {
  let incoming = 0;
  for (const shipment of Object.values(team.inbound)) {
    if (shipment.kind === "material" && shipment.arrivesOnDay <= day) incoming += shipment.quantity;
  }
  const expansion = team.warehouse.expansion;
  const extra = expansion !== null && expansion.completesOnDay <= day ? expansion.amount : 0;
  return team.warehouse.capacity + extra - used - incoming;
}

export type MaterialDelivery = Extract<InboundShipment, { kind: "material" }>;

/** Black-market purchases on their way, earliest first. */
export function blackMarketDeliveries(team: TeamState): MaterialDelivery[] {
  return Object.values(team.inbound)
    .filter(
      (shipment): shipment is MaterialDelivery =>
        shipment.kind === "material" && shipment.supplierId === "black-market",
    )
    .sort((a, b) => a.arrivesOnDay - b.arrivesOnDay);
}

export interface ImpactPair {
  environmental: number;
  social: number;
}

/** Indicators after buying `units` off the books: rated 0/100 on both (R17), engine formula. */
export function impactAfterPurchase(team: TeamState, units: number): ImpactPair {
  const draft: TeamState = { ...team, impact: structuredClone(team.impact) };
  recordPurchase(draft, units, { social: 0, environmental: 0 });
  const { environmental, social } = impactScores(draft);
  return { environmental, social };
}

const decimalFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

/** One decimal at most: an indicator out of 100 ("62,4") or a factor ("1,5"). */
export function formatDecimal(value: number): string {
  return decimalFormat.format(value);
}

/** Name shown for a company: the one chosen in the lobby, else the team name. */
export function companyLabel(company: { companyName: string | null; name: string }): string {
  return company.companyName ?? company.name;
}

export type Investigation = TeamState["blackMarket"]["investigations"][number];

export interface InvestigationResult extends Investigation {
  /** Position among all the team's investigations (1 = first): a stable key. */
  ordinal: number;
}

/** The team's private investigation results on one company, latest first. */
export function investigationsOn(
  investigations: readonly Investigation[],
  targetTeamId: string,
): InvestigationResult[] {
  const results: InvestigationResult[] = [];
  investigations.forEach((result, index) => {
    if (result.targetTeamId === targetTeamId) results.push({ ...result, ordinal: index + 1 });
  });
  return results.reverse();
}

/** First day a company may be accused again (one accusation per target per cooldown). */
export function nextAccusationDay(lastAccusationDay: number | undefined): number | null {
  return lastAccusationDay === undefined ? null : lastAccusationDay + accusation.cooldownDays;
}

/** What the latest investigation tells before accusing: a clean result proves nothing. */
export function evidenceLine(
  name: string,
  latest: Investigation | undefined,
  today: number,
): string {
  if (!latest) return `Vous n'avez mené aucune enquête sur ${name} : vous accusez sans preuve.`;
  if (!latest.proofFound) {
    return `Votre enquête du jour ${latest.day} n'a rien trouvé, ce qui ne prouve pas son innocence.`;
  }
  if (today - latest.day >= rules.traceDays) {
    return `Votre enquête du jour ${latest.day} avait trouvé des preuves, mais ces traces ont plus de ${rules.traceDays} jours : elles se sont effacées depuis.`;
  }
  return `Votre enquête du jour ${latest.day} a trouvé des preuves de marché noir.`;
}

/** Everything an accusation can cost, for both outcomes (R13, N17, stories 86–88). */
export function accusationConsequences({
  name,
  today,
  reputation,
  cash,
  latest,
}: {
  name: string;
  today: number;
  reputation: number;
  cash: number;
  latest: Investigation | undefined;
}): string[] {
  const fine = accusation.falseAccusationFine;
  const toDebt = Math.max(0, fine - Math.max(0, cash));
  const reputationAfter = Math.max(0, reputation - accusation.falseAccusationReputation);
  const debt =
    toDebt > 0 ? ` (dont ${credits(toDebt)} ajoutés à votre dette, faute de trésorerie)` : "";
  return [
    evidenceLine(name, latest, today),
    `Si ${name} a fait affaire au marché noir ces ${rules.traceDays} derniers jours : amende de ${accusation.fineMultiplier} × son gain illicite (au moins ${credits(accusation.minFine)}), −${accusation.reputationPenalty} de réputation, pénalité sur son indicateur social, exclusion du marché noir pendant ${accusation.banDays} jours et scandale dans ${newsSources.tabloid}, qui citera votre nom.`,
    `Sinon, l'accusation est infondée : vous payez ${credits(fine)} d'amende${debt}, votre réputation passe de ${reputation} à ${reputationAfter} et ${newsSources.tabloid} le fera savoir.`,
    `Si ${name} est protégée par une carte Amnistie, l'accusation est classée sans suite.`,
    `Vous ne pourrez plus accuser ${name} avant le jour ${today + accusation.cooldownDays}.`,
  ];
}

export type SanctionKind = "conviction" | "unfounded" | "shielded";

export interface SanctionEvent {
  id: number;
  day: number;
  kind: SanctionKind;
  message: string;
}

/** Openings of the engine's black-market event messages (black-market.ts, tested together). */
const SANCTION_PREFIXES: ReadonlyArray<readonly [string, SanctionKind]> = [
  ["Activité de marché noir démasquée", "conviction"],
  ["Accusation infondée", "unfounded"],
  ["Une accusation vous visait", "shielded"],
];

/** Sanctions received (conviction, baseless accusation) and accusations shielded, latest first. */
export function sanctionEvents(log: readonly ActivityEntry[]): SanctionEvent[] {
  const events: SanctionEvent[] = [];
  for (const entry of log) {
    if (entry.kind !== "event") continue;
    const match = SANCTION_PREFIXES.find(([prefix]) => entry.message.startsWith(prefix));
    if (match)
      events.push({ id: entry.id, day: entry.day, kind: match[1], message: entry.message });
  }
  return events.reverse();
}

export type Verdict = "confirmed" | "unfounded" | "dismissed";

export interface AccusationRecord {
  id: number;
  day: number;
  verdict: Verdict;
}

/**
 * The team's accusations against one company and their outcome, latest first, read from its
 * log: a baseless accusation is logged right after the decision; a dismissed one (amnesty)
 * has no decision line; otherwise the target was convicted.
 */
export function accusationRecords(
  log: readonly ActivityEntry[],
  targetName: string,
): AccusationRecord[] {
  const accused = `Accusation publique contre ${targetName}.`;
  const dismissed = `Accusation contre ${targetName} classée sans suite.`;
  const records: AccusationRecord[] = [];
  log.forEach((entry, index) => {
    if (entry.kind === "event" && entry.message === dismissed) {
      records.push({ id: entry.id, day: entry.day, verdict: "dismissed" });
      return;
    }
    if (entry.kind !== "decision" || entry.message !== accused) return;
    const next = log[index + 1];
    const unfounded =
      next !== undefined &&
      next.kind === "event" &&
      next.day === entry.day &&
      next.message.startsWith("Accusation infondée");
    records.push({ id: entry.id, day: entry.day, verdict: unfounded ? "unfounded" : "confirmed" });
  });
  return records.reverse();
}
