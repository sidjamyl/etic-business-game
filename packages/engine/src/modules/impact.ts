import {
  deliveryRules,
  impactRules,
  type ProductId,
  productById,
  type TransportOption,
} from "@etic/content";
import type { TeamState } from "../types.ts";

const LOW_RATING = 40;

/** Records purchased units with the supplier's ratings (0/0 for the black market). */
export function recordPurchase(
  team: TeamState,
  units: number,
  ethics: { social: number; environmental: number },
): void {
  const facts = team.impact.purchases;
  facts.units += units;
  facts.environmentalSum += ethics.environmental * units;
  facts.socialSum += ethics.social * units;
  if (Math.min(ethics.social, ethics.environmental) < LOW_RATING) facts.lowRatedUnits += units;
}

export function recordProduction(team: TeamState, productId: ProductId, units: number): void {
  const tier = productById.get(productId)?.tier ?? 1;
  const ferronia = team.region === "ferronia";
  const rating = Math.max(
    0,
    impactRules.productFootprint[tier] - (ferronia ? impactRules.ferroniaProductionPenalty : 0),
  );
  const facts = team.impact.production;
  facts.units += units;
  facts.environmentalSum += rating * units;
  if (ferronia) facts.ferroniaUnits += units;
}

export function recordTransport(team: TeamState, option: TransportOption, units: number): void {
  const facts = team.impact.transport;
  facts.units += units;
  facts.environmentalSum += deliveryRules.options[option].environmental * units;
  if (option === "express") facts.expressUnits += units;
}

const average = (sum: number, units: number) => (units > 0 ? sum / units : null);
const round = (value: number) => Math.round(value * 10) / 10;
const clamp = (value: number) => Math.min(100, Math.max(0, value));

function mean(values: (number | null)[]): number {
  const present = values.filter((v): v is number => v !== null);
  if (present.length === 0) return impactRules.neutral;
  return present.reduce((sum, v) => sum + v, 0) / present.length;
}

const percent = (part: number, whole: number) => Math.round((part / whole) * 100);

/** The two indicators, their sub-scores and plain-language hints (R17, N20). */
export function impactScores(team: TeamState) {
  const { purchases, production, transport } = team.impact;
  const purchasesEnvironmental = average(purchases.environmentalSum, purchases.units);
  const productionScore = average(production.environmentalSum, production.units);
  const transportScore = average(transport.environmentalSum, transport.units);

  const wageRatio = average(team.hr.wageRatioSum, team.hr.employeeDays);
  const { baseScore, fullScoreRatio } = impactRules.wage;
  const wages =
    wageRatio === null
      ? null
      : clamp(baseScore + ((wageRatio - 1) / (fullScoreRatio - 1)) * (100 - baseScore));
  const suppliersSocial = average(purchases.socialSum, purchases.units);

  const p = impactRules.penalties;
  const penalties = {
    strikes: Math.min(p.strikeCap, team.hr.strikeDays * p.perStrikeDay),
    layoffs: team.hr.layoffs * p.perLayoff,
    convictions: team.blackMarket.convictions * p.perConviction,
    resignations: team.hr.massResignations * p.perMassResignation,
  };
  const environmental = clamp(mean([purchasesEnvironmental, productionScore, transportScore]));
  const social = clamp(
    mean([wages, suppliersSocial]) -
      penalties.strikes -
      penalties.layoffs -
      penalties.convictions -
      penalties.resignations,
  );

  const hints: string[] = [];
  const threshold = impactRules.hintThreshold;
  if (transport.units > 0 && transport.expressUnits / transport.units > threshold) {
    hints.push(
      `${percent(transport.expressUnits, transport.units)} % de vos expéditions partent en express.`,
    );
  }
  if (purchases.units > 0 && purchases.lowRatedUnits / purchases.units > threshold) {
    hints.push(
      `${percent(purchases.lowRatedUnits, purchases.units)} % de vos achats viennent de fournisseurs mal notés.`,
    );
  }
  if (team.blackMarket.purchasedUnits > 0) {
    hints.push(
      `${team.blackMarket.purchasedUnits} unités achetées au marché noir pèsent sur vos deux indicateurs.`,
    );
  }
  if (production.units > 0 && production.ferroniaUnits / production.units > threshold) {
    hints.push("Votre production à Ferronia pollue davantage.");
  }
  if (wages !== null && wages <= baseScore) {
    hints.push("Vos salaires ne dépassent pas la moyenne régionale.");
  }
  if (penalties.strikes > 0) hints.push(`${team.hr.strikeDays} jour(s) de grève.`);
  if (penalties.layoffs > 0) hints.push(`${team.hr.layoffs} licenciement(s).`);
  if (penalties.convictions > 0) hints.push("Condamnation pour marché noir.");
  if (penalties.resignations > 0) hints.push("Démission collective après une grève.");

  const opt = (value: number | null) => (value === null ? null : round(value));
  return {
    environmental: round(environmental),
    social: round(social),
    breakdown: {
      environmental: {
        purchases: opt(purchasesEnvironmental),
        production: opt(productionScore),
        transport: opt(transportScore),
      },
      social: { wages: opt(wages), suppliers: opt(suppliersSocial), penalties },
    },
    hints,
  };
}

export type ImpactScores = ReturnType<typeof impactScores>;
