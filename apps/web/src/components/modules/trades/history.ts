import type { ActivityEntry, ActivityKind } from "@etic/engine";

/**
 * Private trade history (#40, R15, story 104), read from the company's activity log. The
 * engine keeps no structured history of finished trades, so the lines are recognised by the
 * wording of `modules/trades.ts`; history.test.ts replays every trade command through the
 * real engine so a change of wording fails the tests instead of silently emptying the list.
 */

export type HistoryKind =
  | "offer-sent"
  | "offer-received"
  | "offer-withdrawn"
  | "offer-declined"
  | "purchase"
  | "sale"
  | "money-sent"
  | "money-received"
  | "gift-sent"
  | "goods-received"
  | "payment-received"
  | "gift-delivered";

export interface HistoryEntry {
  entry: ActivityEntry;
  kind: HistoryKind;
  /** The other company of the trade. */
  partner: string;
}

export const historyLabels: Record<HistoryKind, string> = {
  "offer-sent": "Offre envoyée",
  "offer-received": "Offre reçue",
  "offer-withdrawn": "Offre retirée",
  "offer-declined": "Offre refusée",
  purchase: "Achat conclu",
  sale: "Vente conclue",
  "money-sent": "Virement envoyé",
  "money-received": "Virement reçu",
  "gift-sent": "Envoi gratuit",
  "goods-received": "Marchandises reçues",
  "payment-received": "Paiement encaissé",
  "gift-delivered": "Envoi livré",
};

/** Money or goods coming to the company (as opposed to leaving it). */
export const incomingKinds: ReadonlySet<HistoryKind> = new Set([
  "offer-received",
  "offer-withdrawn",
  "purchase",
  "money-received",
  "goods-received",
  "payment-received",
]);

const MONEY = "₢.+";

/** Engine wordings, `name` being the other company (already escaped). */
const templates: { kind: HistoryKind; from: ActivityKind; pattern: (name: string) => string }[] = [
  {
    kind: "offer-sent",
    from: "decision",
    pattern: (name) => `^Offre envoyée à ${name} : .+ pour ${MONEY}\\.$`,
  },
  {
    kind: "offer-received",
    from: "event",
    pattern: (name) => `^${name} vous propose .+ pour ${MONEY}\\.$`,
  },
  {
    kind: "offer-withdrawn",
    from: "event",
    pattern: (name) => `^${name} a retiré son offre\\.$`,
  },
  {
    kind: "offer-declined",
    from: "event",
    pattern: (name) => `^${name} a refusé votre offre\\.$`,
  },
  {
    kind: "purchase",
    from: "decision",
    pattern: (name) => `^Offre de ${name} acceptée : .+, arrivée jour \\d+\\.$`,
  },
  {
    kind: "sale",
    from: "event",
    pattern: (name) => `^${name} accepte votre offre : .+ expédié, paiement à la livraison\\.$`,
  },
  {
    kind: "money-sent",
    from: "decision",
    pattern: (name) => `^Virement de ${MONEY} à ${name}\\.$`,
  },
  {
    kind: "money-received",
    from: "event",
    pattern: (name) => `^${name} vous a viré ${MONEY}\\.$`,
  },
  {
    kind: "gift-sent",
    from: "decision",
    pattern: (name) => `^Envoi gratuit à ${name} : .+\\.$`,
  },
  {
    kind: "goods-received",
    from: "system",
    pattern: (name) => `^Reçu de ${name} : .+\\.$`,
  },
  {
    kind: "payment-received",
    from: "system",
    pattern: (name) => `^Livraison à ${name} effectuée : ${MONEY} encaissés\\.$`,
  },
  {
    kind: "gift-delivered",
    from: "system",
    pattern: (name) => `^Envoi à ${name} livré\\.$`,
  },
];

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface Matcher {
  kind: HistoryKind;
  from: ActivityKind;
  partner: string;
  regex: RegExp;
}

/**
 * One matcher per wording and company: names may contain any character, even " : ". Longer
 * names come first, so "Atlas : Nord" wins over "Atlas" when both exist.
 */
function matchersFor(names: Iterable<string>): Matcher[] {
  const matchers: Matcher[] = [];
  for (const partner of [...new Set(names)].sort((a, b) => b.length - a.length)) {
    const name = escapeRegExp(partner);
    for (const { kind, from, pattern } of templates) {
      matchers.push({ kind, from, partner, regex: new RegExp(pattern(name)) });
    }
  }
  return matchers;
}

/**
 * The trade lines of the activity log, latest first. `names` are the other companies as the
 * engine names them (company name, else team name): a line must name one of them.
 */
export function tradeHistory(
  log: readonly ActivityEntry[],
  names: Iterable<string>,
): HistoryEntry[] {
  const matchers = matchersFor(names);
  const entries: HistoryEntry[] = [];
  for (let index = log.length - 1; index >= 0; index--) {
    const entry = log[index];
    if (!entry) continue;
    const match = matchers.find(
      (matcher) => matcher.from === entry.kind && matcher.regex.test(entry.message),
    );
    if (match) entries.push({ entry, kind: match.kind, partner: match.partner });
  }
  return entries;
}
