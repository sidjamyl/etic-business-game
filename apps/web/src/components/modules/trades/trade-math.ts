import {
  deliveryRules,
  type ItemId,
  machineTypeById,
  materialIds,
  type ProductId,
  productIds,
  type RegionId,
  type TransportOption,
  tradeRules,
  transportOptions,
} from "@etic/content";
import {
  availableCash,
  type CompanySummary,
  canProduce,
  type GameStatus,
  type MachineState,
  type SimTime,
  shippingCost,
  shippingDays,
  type TeamState,
  type TeamView,
  type TradeGood,
  type TradeOffer,
  type TransportDelay,
} from "@etic/engine";
import { credits, dayLabel, formatNumber, itemLabel, percent } from "@/lib/format";

/**
 * Pure helpers of the Échanges module (#40, R15, N19): partners, goods, shipping quotes, the
 * checks shown before an offer or a transfer, and the state of offers and shipments. Previews
 * only: the server applies the rules and refuses anything these checks miss.
 */

export type TradeShipmentView = TeamView["trades"]["shipments"][number];
export type Payer = TradeOffer["shippingPaidBy"];

/** A good as `trade.offer` and `transfer.goods` take it. */
export type GoodPayload =
  | { kind: "item"; item: ItemId; quantity: number }
  | { kind: "machine"; machineId: string };

/** "1 article", "3 articles": French keeps the singular for 0 and 1. */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${formatNumber(n)} ${Math.abs(n) >= 2 ? many : one}`;
}

// ——— Companies ———

export interface Partner {
  id: string;
  name: string;
  region: RegionId | null;
}

/** The name the engine uses in its messages: the company name, else the team name. */
export function companyNameOf(company: Pick<CompanySummary, "companyName" | "name">): string {
  return company.companyName ?? company.name;
}

export function partnerName(competitors: Record<string, CompanySummary>, id: string): string {
  const company = competitors[id];
  return company ? companyNameOf(company) : "Entreprise inconnue";
}

/** The other companies of the game, by name: possible buyers and recipients. */
export function partnersOf(competitors: Record<string, CompanySummary>): Partner[] {
  return Object.values(competitors)
    .map((company) => ({ id: company.id, name: companyNameOf(company), region: company.region }))
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

// ——— Goods ———

export function machineTypeName(typeId: string): string {
  return machineTypeById.get(typeId)?.name ?? typeId;
}

/** "120 × Farine", or the machine type: "Four industriel". */
export function goodLabel(good: TradeGood): string {
  return good.kind === "item"
    ? `${formatNumber(good.quantity)} × ${itemLabel(good.item)}`
    : machineTypeName(good.typeId);
}

/** Units a good counts for in the shipping cost: a machine counts as 10 units (N19). */
export function shippingUnits(
  good: { kind: "item"; quantity: number } | { kind: "machine" },
): number {
  return good.kind === "item" ? good.quantity : tradeRules.machineShippingUnits;
}

export function isMaterial(item: ItemId): boolean {
  return (materialIds as readonly string[]).includes(item);
}

/** Products a machine type makes, and whether this company may produce them yet (R1, R2). */
export function machineProducts(
  typeId: string,
  team: TeamState,
): { productId: ProductId; unlocked: boolean }[] {
  const type = machineTypeById.get(typeId);
  if (!type) return [];
  return productIds
    .filter((productId) => type.products[productId] !== undefined)
    .map((productId) => ({ productId, unlocked: canProduce(team, productId) }));
}

export function operatorsRequired(typeId: string): number | null {
  return machineTypeById.get(typeId)?.operatorsRequired ?? null;
}

// ——— Transport ———

export interface RouteQuote {
  option: TransportOption;
  /** Rounded like the engine, with the payer's shipping perk when it is known (N16). */
  cost: number;
  /** Travel days, transport events in progress included. */
  days: number;
}

/** Extra days transport events add to a route touching either region (R12). */
export function eventDelayDays(
  delays: readonly Pick<TransportDelay, "region" | "extraDays">[],
  from: RegionId,
  to: RegionId,
): number {
  let extra = 0;
  for (const delay of delays) {
    if (delay.region === from || delay.region === to) extra += delay.extraDays;
  }
  return extra;
}

/**
 * The three transport options of a trade (R8, N19): the goods leave the seller's region
 * without going through the logisticians' queue. `factor` is the payer's shipping perk.
 */
export function routeQuotes({
  units,
  from,
  to,
  factor = 1,
  delays = [],
}: {
  units: number;
  from: RegionId | null;
  to: RegionId | null;
  factor?: number;
  delays?: readonly Pick<TransportDelay, "region" | "extraDays">[];
}): RouteQuote[] | null {
  if (!from || !to) return null;
  const extra = eventDelayDays(delays, from, to);
  return transportOptions.map((option) => ({
    option,
    cost: Math.round(shippingCost(option, units, from, to) * factor),
    days: shippingDays(option, from, to) + extra,
  }));
}

export function quoteFor(
  quotes: readonly RouteQuote[] | null,
  option: TransportOption,
): RouteQuote | null {
  return quotes?.find((quote) => quote.option === option) ?? null;
}

/** "Standard (route)" → "Standard". */
export function optionShortName(option: TransportOption): string {
  const name = deliveryRules.options[option].name;
  const cut = name.indexOf(" (");
  return cut > 0 ? name.slice(0, cut) : name;
}

/** "Standard (route)" → "route". */
export function optionMode(option: TransportOption): string | null {
  const match = /\(([^)]+)\)/.exec(deliveryRules.options[option].name);
  return match?.[1] ?? null;
}

export function isTransportOption(value: string): value is TransportOption {
  return (transportOptions as readonly string[]).includes(value);
}

// ——— What the company can send ———

export interface StockLine {
  item: ItemId;
  inStock: number;
  /** Reserved by accepted customer orders (products, O2): cannot leave. */
  reserved: number;
  /** What can leave the warehouse now. */
  available: number;
}

/** Goods in the warehouse, raw materials first, in catalog order. */
export function stockLines(team: Pick<TeamState, "inventory" | "reserved">): StockLine[] {
  const reservedOf: Partial<Record<ItemId, number>> = team.reserved;
  const lines: StockLine[] = [];
  for (const item of [...materialIds, ...productIds]) {
    const inStock = team.inventory[item] ?? 0;
    if (inStock <= 0) continue;
    const reserved = reservedOf[item] ?? 0;
    lines.push({ item, inStock, reserved, available: Math.max(0, inStock - reserved) });
  }
  return lines;
}

/** "200 disponibles", or "30 disponibles sur 50 (20 réservés par vos commandes)". */
export function stockHint(line: StockLine): string {
  const available = count(line.available, "disponible");
  if (line.reserved <= 0) return available;
  return `${available} sur ${formatNumber(line.inStock)} (${count(line.reserved, "réservé")} par vos commandes)`;
}

export interface MachineChoice {
  machine: MachineState;
  /** Type name, numbered when the company owns several machines of the type. */
  name: string;
  /** Why it cannot leave now: a cycle in progress, or output waiting for warehouse space. */
  blocked: "cycle" | "output" | null;
  /** Production still queued: a new cycle may start before the buyer accepts. */
  queued: boolean;
  /** Operators assigned to it, released when it leaves. */
  operators: number;
}

const idNumber = (id: string) => Number.parseInt(id.replace(/^\D+/, ""), 10) || 0;

/** The company's machines in acquisition order, with what keeps each one from leaving. */
export function machineChoices(team: Pick<TeamState, "machines" | "employees">): MachineChoice[] {
  const machines = Object.values(team.machines).sort(
    (a, b) => idNumber(a.id) - idNumber(b.id) || a.id.localeCompare(b.id),
  );
  const totals = new Map<string, number>();
  for (const machine of machines) {
    totals.set(machine.typeId, (totals.get(machine.typeId) ?? 0) + 1);
  }
  const operators = new Map<string, number>();
  for (const employee of Object.values(team.employees)) {
    if (employee.machineId) {
      operators.set(employee.machineId, (operators.get(employee.machineId) ?? 0) + 1);
    }
  }
  const ranks = new Map<string, number>();
  return machines.map((machine) => {
    let name = machineTypeName(machine.typeId);
    if ((totals.get(machine.typeId) ?? 0) > 1) {
      const rank = (ranks.get(machine.typeId) ?? 0) + 1;
      ranks.set(machine.typeId, rank);
      name = `${name} n° ${rank}`;
    }
    return {
      machine,
      name,
      blocked: machine.cycle ? "cycle" : machine.pendingOutput ? "output" : null,
      queued: machine.job !== null && machine.job.cyclesRemaining > 0,
      operators: operators.get(machine.id) ?? 0,
    };
  });
}

/** Short state of a machine in the picker. */
export function machineNote(choice: MachineChoice): string {
  if (choice.blocked === "cycle") return "en plein cycle";
  if (choice.blocked === "output") return "production en attente de place";
  return `rendement ${percent(choice.machine.efficiency)}`;
}

// ——— Typed numbers ———

export interface WholeNumber {
  /** Nothing typed: neither a value nor an error. */
  empty: boolean;
  /** The whole number typed; null when empty or not a whole number. */
  value: number | null;
}

export function readWhole(text: string): WholeNumber {
  const trimmed = text.trim();
  if (trimmed === "") return { empty: true, value: null };
  const value = Number(trimmed);
  return { empty: false, value: Number.isSafeInteger(value) ? value : null };
}

export function quantityError(text: string): string | null {
  const { empty, value } = readWhole(text);
  if (empty || (value !== null && value > 0)) return null;
  return "Entrez un nombre entier d'unités, au moins 1.";
}

export function priceError(text: string): string | null {
  const { empty, value } = readWhole(text);
  if (empty || (value !== null && value >= 0)) return null;
  return "Entrez un prix entier en crédits, 0 ou plus.";
}

/** Money transfers come out of the available cash (bids lock the rest, N16). */
export function amountError(text: string, available: number, reservedCash: number): string | null {
  const { empty, value } = readWhole(text);
  if (empty) return null;
  if (value === null || value <= 0) return "Entrez un montant entier en crédits, au moins ₢1.";
  if (value > available) {
    const locked = reservedCash > 0 ? ` (${credits(reservedCash)} bloqués par vos enchères)` : "";
    return `Trésorerie disponible insuffisante : ${credits(Math.max(0, available))}${locked}.`;
  }
  return null;
}

// ——— A good being chosen in a form ———

export interface GoodDraft {
  kind: "item" | "machine";
  item: ItemId | null;
  /** Quantity as typed. */
  quantity: string;
  machineId: string | null;
}

export const emptyGoodDraft: GoodDraft = {
  kind: "item",
  item: null,
  quantity: "",
  machineId: null,
};

export interface ResolvedGood {
  /** What to send; null while incomplete, invalid or blocked. */
  payload: GoodPayload | null;
  /** Units counted for shipping; null while unknown. */
  units: number | null;
  stock: StockLine | null;
  machine: MachineChoice | null;
}

/** Reads a draft against the company's current stock and machines. */
export function resolveGood(
  draft: GoodDraft,
  stock: readonly StockLine[],
  machines: readonly MachineChoice[],
): ResolvedGood {
  if (draft.kind === "machine") {
    const machine = machines.find((choice) => choice.machine.id === draft.machineId) ?? null;
    if (!machine) return { payload: null, units: null, stock: null, machine: null };
    return {
      payload: machine.blocked ? null : { kind: "machine", machineId: machine.machine.id },
      units: tradeRules.machineShippingUnits,
      stock: null,
      machine,
    };
  }
  const line = stock.find((entry) => entry.item === draft.item) ?? null;
  const { value } = readWhole(draft.quantity);
  const quantity = value !== null && value > 0 ? value : null;
  return {
    payload: line && quantity !== null ? { kind: "item", item: line.item, quantity } : null,
    units: quantity,
    stock: line,
    machine: null,
  };
}

/** "120 × Farine", "la machine « Four industriel n° 2 »"; null while nothing is chosen. */
export function resolvedLabel(good: ResolvedGood): string | null {
  if (good.machine) return `la machine « ${good.machine.name} »`;
  if (good.stock && good.units !== null) {
    return `${formatNumber(good.units)} × ${itemLabel(good.stock.item)}`;
  }
  return null;
}

// ——— Checks ———

export type MessageTone = "error" | "warning" | "info";

export interface TradeMessage {
  tone: MessageTone;
  text: string;
}

export function hasError(messages: readonly TradeMessage[]): boolean {
  return messages.some((message) => message.tone === "error");
}

/**
 * What blocks or threatens the departure of a good. An offer only checks the stock when the
 * buyer accepts (nothing is reserved), so a shortage is a warning; a gift leaves at once.
 */
export function goodMessages(good: ResolvedGood, mode: "offer" | "gift"): TradeMessage[] {
  const messages: TradeMessage[] = [];
  const { stock, machine } = good;
  if (stock && good.units !== null && good.units > stock.available) {
    const reserved =
      stock.reserved > 0 ? ` (${count(stock.reserved, "réservé")} par vos commandes)` : "";
    const have = `${formatNumber(stock.available)} ${itemLabel(stock.item)}${reserved}`;
    messages.push(
      mode === "offer"
        ? {
            tone: "warning",
            text: `Stock disponible : ${have}. L'acceptation sera refusée s'il reste insuffisant.`,
          }
        : { tone: "error", text: `Stock disponible insuffisant : ${have}.` },
    );
  }
  if (machine) {
    if (machine.blocked === "cycle") {
      messages.push({
        tone: "error",
        text: "Cette machine est en plein cycle : elle pourra partir une fois le cycle terminé.",
      });
    } else if (machine.blocked === "output") {
      messages.push({
        tone: "error",
        text: "La production de cette machine attend de la place dans l'entrepôt : libérez de l'espace d'abord.",
      });
    } else if (machine.queued) {
      messages.push(
        mode === "offer"
          ? {
              tone: "warning",
              text: "Sa production est programmée : arrêtez-la dans Production, sinon un nouveau cycle bloquera l'échange.",
            }
          : { tone: "info", text: "Sa production programmée sera annulée." },
      );
    }
    if (machine.operators > 0) {
      messages.push({
        tone: "info",
        text:
          machine.operators > 1
            ? `Ses ${machine.operators} opérateurs seront libérés à son départ.`
            : "Son opérateur sera libéré à son départ.",
      });
    }
  }
  return messages;
}

/** Goods still on the road when the game ends are lost; a contract's buyer is refunded (R19). */
export function arrivalMessage(
  arrivalDay: number | null,
  endDay: number | null,
  kind: "contract" | "gift",
): TradeMessage | null {
  if (arrivalDay === null || endDay === null || arrivalDay <= endDay) return null;
  return {
    tone: "warning",
    text:
      kind === "contract"
        ? `Arrivée prévue après la fin de la partie (jour ${endDay}) : le contrat serait annulé, l'acheteur remboursé et les marchandises perdues.`
        : `Arrivée prévue après la fin de la partie (jour ${endDay}) : l'envoi serait perdu.`,
  };
}

const present = (message: TradeMessage | null): TradeMessage[] => (message ? [message] : []);

// ——— New offer (seller) ———

export interface OfferPreview {
  /** Shipping of the chosen option: exact when the seller pays, an estimate otherwise. */
  quote: RouteQuote | null;
  quotes: RouteQuote[] | null;
  /** The seller's own perk applies only when it pays (the buyer's perks are private). */
  estimate: boolean;
  /** Shipping of the chosen option for each payer. */
  payerCosts: Record<Payer, number | null>;
  /** Days added by transport events on the route. */
  delayDays: number;
  /** What the buyer pays at acceptance, shipping included when it pays it. */
  buyerPays: number | null;
  /** What the seller keeps: the price, minus shipping when it pays it. */
  sellerNet: number | null;
  arrivalDay: number | null;
  expiresOnDay: number;
  messages: TradeMessage[];
  /** Complete and free of blocking errors. */
  ready: boolean;
}

export function previewOffer({
  team,
  buyer,
  good,
  price,
  option,
  payer,
  today,
  endDay,
  delays,
}: {
  team: TeamState;
  buyer: Partner | null;
  good: ResolvedGood;
  /** Null while empty or invalid. */
  price: number | null;
  option: TransportOption;
  payer: Payer;
  today: number;
  endDay: number | null;
  delays: readonly TransportDelay[];
}): OfferPreview {
  const sellerPays = payer === "seller";
  const from = team.region;
  const to = buyer?.region ?? null;
  const quotesWith = (factor: number) =>
    good.units === null ? null : routeQuotes({ units: good.units, from, to, factor, delays });
  const sellerQuotes = quotesWith(team.perks.shippingFactor);
  const buyerQuotes = quotesWith(1);
  const quotes = sellerPays ? sellerQuotes : buyerQuotes;
  const quote = quoteFor(quotes, option);
  const arrivalDay = quote ? today + quote.days : null;
  const messages = [...goodMessages(good, "offer")];
  const available = availableCash(team);
  if (sellerPays && quote && quote.cost > available) {
    messages.push({
      tone: "warning",
      text: `Le transport à votre charge (${credits(quote.cost)}) dépasse votre trésorerie disponible (${credits(Math.max(0, available))}) : l'acceptation sera refusée si elle ne suffit toujours pas.`,
    });
  }
  messages.push(...present(arrivalMessage(arrivalDay, endDay, "contract")));
  const validPrice = price !== null && price >= 0;
  return {
    quote,
    quotes,
    estimate: !sellerPays,
    payerCosts: {
      seller: quoteFor(sellerQuotes, option)?.cost ?? null,
      buyer: quoteFor(buyerQuotes, option)?.cost ?? null,
    },
    delayDays: from && to ? eventDelayDays(delays, from, to) : 0,
    buyerPays: validPrice && quote ? price + (sellerPays ? 0 : quote.cost) : null,
    sellerNet: validPrice && quote ? price - (sellerPays ? quote.cost : 0) : null,
    arrivalDay,
    expiresOnDay: today + tradeRules.offerExpiryDays,
    messages,
    ready: buyer !== null && good.payload !== null && validPrice && !hasError(messages),
  };
}

// ——— Free goods transfer (sender pays shipping) ———

export interface GiftPreview {
  quotes: RouteQuote[] | null;
  quote: RouteQuote | null;
  arrivalDay: number | null;
  messages: TradeMessage[];
  ready: boolean;
}

export function previewGift({
  team,
  recipient,
  good,
  option,
  today,
  endDay,
  delays,
}: {
  team: TeamState;
  recipient: Partner | null;
  good: ResolvedGood;
  option: TransportOption;
  today: number;
  endDay: number | null;
  delays: readonly TransportDelay[];
}): GiftPreview {
  const quotes =
    good.units === null
      ? null
      : routeQuotes({
          units: good.units,
          from: team.region,
          to: recipient?.region ?? null,
          factor: team.perks.shippingFactor,
          delays,
        });
  const quote = quoteFor(quotes, option);
  const arrivalDay = quote ? today + quote.days : null;
  const messages = [...goodMessages(good, "gift")];
  const available = availableCash(team);
  if (quote && quote.cost > available) {
    messages.push({
      tone: "error",
      text: `Trésorerie disponible insuffisante pour le transport : il faut ${credits(quote.cost)}, vous avez ${credits(Math.max(0, available))}.`,
    });
  }
  messages.push(...present(arrivalMessage(arrivalDay, endDay, "gift")));
  return {
    quotes,
    quote,
    arrivalDay,
    messages,
    ready: recipient !== null && good.payload !== null && quote !== null && !hasError(messages),
  };
}

// ——— Offers received (buyer) ———

type ViewParts = Pick<TeamView, "team" | "competitors" | "clock" | "warehouseUsed"> & {
  market: Pick<TeamView["market"], "transportDelays">;
};

export interface ReceivedOfferPlan {
  offer: TradeOffer;
  seller: string;
  /** With this company's shipping perk when it pays; the seller's otherwise (unknown). */
  quote: RouteQuote | null;
  /** Shipping paid by this company at acceptance (0 when the seller pays). */
  shippingDue: number;
  /** Price + shipping due: paid at acceptance. */
  dueNow: number;
  available: number;
  arrivalDay: number | null;
  messages: TradeMessage[];
  canAccept: boolean;
}

export function receivedOfferPlan(view: ViewParts, offer: TradeOffer): ReceivedOfferPlan {
  const { team, clock } = view;
  const today = clock.time.day;
  const seller = view.competitors[offer.sellerId];
  const buyerPays = offer.shippingPaidBy === "buyer";
  const quote = quoteFor(
    routeQuotes({
      units: shippingUnits(offer.good),
      from: seller?.region ?? null,
      to: team.region,
      factor: buyerPays ? team.perks.shippingFactor : 1,
      delays: view.market.transportDelays,
    }),
    offer.option,
  );
  const shippingDue = buyerPays ? (quote?.cost ?? 0) : 0;
  const dueNow = offer.price + shippingDue;
  const available = availableCash(team);
  const arrivalDay = quote ? today + quote.days : null;
  const messages: TradeMessage[] = [];
  if (dueNow > available) {
    messages.push({
      tone: "error",
      text: `Trésorerie disponible insuffisante : il faut ${credits(dueNow)}, vous avez ${credits(Math.max(0, available))}.`,
    });
  }
  if (offer.good.kind === "item") {
    const free = Math.max(0, team.warehouse.capacity - view.warehouseUsed);
    if (offer.good.quantity > free) {
      messages.push({
        tone: "warning",
        text: `Entrepôt : ${count(free, "place libre", "places libres")} aujourd'hui. Si la place manque à l'arrivée, la livraison attendra, sans perte.`,
      });
    }
  } else {
    const locked = machineProducts(offer.good.typeId, team).filter((entry) => !entry.unlocked);
    if (locked.length > 0) {
      messages.push({
        tone: "warning",
        text: `Pas encore débloqué pour vous : ${locked.map((entry) => itemLabel(entry.productId)).join(", ")} (voir Progression).`,
      });
    }
    messages.push({
      tone: "info",
      text: "Son rendement actuel n'est pas affiché : demandez-le au vendeur, la machine arrive avec son usure.",
    });
  }
  messages.push(...present(arrivalMessage(arrivalDay, clock.endDay, "contract")));
  return {
    offer,
    seller: seller ? companyNameOf(seller) : "Entreprise inconnue",
    quote,
    shippingDue,
    dueNow,
    available,
    arrivalDay,
    messages,
    canAccept: !hasError(messages),
  };
}

/** What accepting commits to, for the confirmation (R15: a guaranteed contract). */
export function acceptConsequences(plan: ReceivedOfferPlan): string[] {
  const { offer, seller, quote, arrivalDay } = plan;
  const transport = optionShortName(offer.option).toLowerCase();
  const lines = [
    offer.price > 0
      ? `${credits(offer.price)} bloqués tout de suite (séquestre), versés à ${seller} à l'arrivée des marchandises.`
      : "Prix nul : aucun paiement n'est bloqué.",
    offer.shippingPaidBy === "buyer"
      ? `Transport ${transport} payé maintenant${quote ? ` : ${credits(quote.cost)}` : ""}.`
      : `Transport ${transport} payé par ${seller}.`,
  ];
  if (arrivalDay !== null) {
    lines.push(`Arrivée prévue ${dayLabel(arrivalDay).toLowerCase()}, hors retards d'événements.`);
  }
  lines.push(
    offer.good.kind === "item"
      ? "Les marchandises entrent dans votre entrepôt à l'arrivée ; s'il est plein, elles attendent de la place."
      : "La machine arrive avec son rendement actuel, sans opérateur ni production programmée.",
  );
  return lines;
}

// ——— Offers sent (seller) ———

export interface SentOfferPlan {
  offer: TradeOffer;
  buyer: string;
  /** Exact when this company pays; an estimate when the buyer does. */
  quote: RouteQuote | null;
  arrivalDay: number | null;
  /** Why the buyer's acceptance would be refused right now. */
  messages: TradeMessage[];
}

export function sentOfferPlan(view: ViewParts, offer: TradeOffer): SentOfferPlan {
  const { team, clock } = view;
  const buyer = view.competitors[offer.buyerId];
  const sellerPays = offer.shippingPaidBy === "seller";
  const quote = quoteFor(
    routeQuotes({
      units: shippingUnits(offer.good),
      from: team.region,
      to: buyer?.region ?? null,
      factor: sellerPays ? team.perks.shippingFactor : 1,
      delays: view.market.transportDelays,
    }),
    offer.option,
  );
  const arrivalDay = quote ? clock.time.day + quote.days : null;
  const messages: TradeMessage[] = [];
  const good = offer.good;
  if (good.kind === "item") {
    const { item, quantity } = good;
    const available = stockLines(team).find((entry) => entry.item === item)?.available ?? 0;
    if (available < quantity) {
      messages.push({
        tone: "warning",
        text: `Stock disponible : ${formatNumber(available)} ${itemLabel(item)}. L'acceptation sera refusée tant qu'il en manque ${formatNumber(quantity - available)}.`,
      });
    }
  } else {
    const { machineId } = good;
    const machine = machineChoices(team).find((choice) => choice.machine.id === machineId);
    if (!machine) {
      messages.push({
        tone: "warning",
        text: "Vous ne possédez plus cette machine : l'acceptation sera refusée.",
      });
    } else if (machine.blocked) {
      messages.push({
        tone: "warning",
        text:
          machine.blocked === "cycle"
            ? "Machine en plein cycle : l'acceptation sera refusée jusqu'à la fin du cycle."
            : "La production de la machine attend de la place : l'acceptation sera refusée d'ici là.",
      });
    } else if (machine.queued) {
      messages.push({
        tone: "warning",
        text: "Production programmée : un nouveau cycle bloquerait l'acceptation. Arrêtez-la dans Production.",
      });
    }
  }
  const available = availableCash(team);
  if (sellerPays && quote && quote.cost > available) {
    messages.push({
      tone: "warning",
      text: `Transport à votre charge (${credits(quote.cost)}) : votre trésorerie disponible ne suffit pas, l'acceptation serait refusée.`,
    });
  }
  messages.push(...present(arrivalMessage(arrivalDay, clock.endDay, "contract")));
  return {
    offer,
    buyer: buyer ? companyNameOf(buyer) : "Entreprise inconnue",
    quote,
    arrivalDay,
    messages,
  };
}

// ——— Overview and shipments ———

const byExpiry = (a: TradeOffer, b: TradeOffer) =>
  a.expiresOnDay - b.expiresOnDay || idNumber(a.id) - idNumber(b.id);

export interface TradeOverview {
  /** Offers waiting for this company's answer, the soonest to expire first. */
  received: TradeOffer[];
  /** Offers this company made, waiting for an answer. */
  sent: TradeOffer[];
  incoming: number;
  outgoing: number;
  /** Escrow of contracts on their way to buyers: paid to this company on arrival. */
  toCollect: number;
  /** Escrow this company paid for contracts on their way to it. */
  inEscrow: number;
}

export function tradeOverview(trades: TeamView["trades"], teamId: string): TradeOverview {
  let toCollect = 0;
  let inEscrow = 0;
  let incoming = 0;
  let outgoing = 0;
  for (const shipment of trades.shipments) {
    if (shipment.buyerId === teamId) {
      incoming += 1;
      inEscrow += shipment.escrow;
    } else if (shipment.sellerId === teamId) {
      outgoing += 1;
      toCollect += shipment.escrow;
    }
  }
  return {
    received: trades.offers.filter((offer) => offer.buyerId === teamId).sort(byExpiry),
    sent: trades.offers.filter((offer) => offer.sellerId === teamId).sort(byExpiry),
    incoming,
    outgoing,
    toCollect,
    inEscrow,
  };
}

export interface ShipmentLine {
  shipment: TradeShipmentView;
  direction: "in" | "out";
  partner: string;
  /** Still on the road when the game ends: cancelled, goods lost (R19). */
  afterEnd: boolean;
}

/** Trades on the road, the earliest arrival first. */
export function shipmentLines(
  view: Pick<TeamView, "trades" | "team" | "competitors" | "clock">,
): ShipmentLine[] {
  const { endDay } = view.clock;
  return view.trades.shipments
    .map((shipment): ShipmentLine => {
      const direction = shipment.buyerId === view.team.id ? "in" : "out";
      return {
        shipment,
        direction,
        partner: partnerName(
          view.competitors,
          direction === "in" ? shipment.sellerId : shipment.buyerId,
        ),
        afterEnd: endDay !== null && shipment.arrivesOnDay > endDay,
      };
    })
    .sort(
      (a, b) =>
        a.shipment.arrivesOnDay - b.shipment.arrivesOnDay ||
        idNumber(a.shipment.id) - idNumber(b.shipment.id),
    );
}

// ——— Time ———

/** Simulated days (with their fraction) from now to the start of `day`. */
export function daysUntilStartOf(day: number, time: SimTime, stepsPerDay: number): number {
  return Math.max(0, day - time.day - time.step / stepsPerDay);
}

/** "aujourd'hui", "demain", "dans 3 j", "hier", "il y a 2 j". */
export function relativeDay(target: number, today: number): string {
  const diff = target - today;
  if (diff === 0) return "aujourd'hui";
  if (diff === 1) return "demain";
  if (diff === -1) return "hier";
  return diff > 0 ? `dans ${diff} j` : `il y a ${-diff} j`;
}

/** Why decisions are closed (O1). */
export function blockedReason(status: GameStatus): string | null {
  if (status === "paused") return "Jeu en pause : vous pourrez décider à la reprise.";
  if (status === "ended") return "Partie terminée : plus aucune décision possible.";
  if (status === "lobby") return "La partie n'a pas encore commencé.";
  return null;
}
