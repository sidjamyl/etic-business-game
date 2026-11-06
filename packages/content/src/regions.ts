import { z } from "zod";

/** The four fictional regions (R3). Numbers used by economic modules arrive with them. */
export const regionSchema = z.object({
  id: z.enum(["azura", "nordhaven", "ferronia", "port-libre"]),
  name: z.string(),
  summary: z.string(),
  advantage: z.string(),
  risk: z.string(),
  /** Operator wage per 30 simulated days, in crédits (N8). */
  baseWage: z.int().positive(),
  /** People available for hire, shared by every team settled in the region (N8). */
  laborPool: z.int().nonnegative(),
  /** Demand multiplier (N10). */
  population: z.number().positive(),
  /** Local price = reference price × purchasing power (N10). */
  purchasingPower: z.number().positive(),
  /** Days by which the recovery of tiers 2 and 3 comes earlier here (N10). */
  recoveryHeadStartDays: z.int().nonnegative(),
});

export type Region = z.infer<typeof regionSchema>;
export type RegionId = Region["id"];

export const regions = z.array(regionSchema).parse([
  {
    id: "azura",
    population: 1.6,
    purchasingPower: 0.75,
    recoveryHeadStartDays: 0,
    baseWage: 1200,
    laborPool: 40,
    name: "Azura",
    summary: "Une région très peuplée qui peine à se relever de la crise.",
    advantage: "Forte population : une demande élevée en produits essentiels.",
    risk: "Faible pouvoir d'achat et instabilité politique : la clientèle peut chuter brutalement.",
  },
  {
    id: "nordhaven",
    population: 0.6,
    purchasingPower: 1.5,
    recoveryHeadStartDays: 30,
    baseWage: 2400,
    laborPool: 15,
    name: "Nordhaven",
    summary: "Une région prospère, épargnée par le pire de la crise.",
    advantage: "Pouvoir d'achat élevé : la demande en produits évolués arrive plus tôt.",
    risk: "Petite population et salaires élevés.",
  },
  {
    id: "ferronia",
    population: 1.0,
    purchasingPower: 1.0,
    recoveryHeadStartDays: 0,
    baseWage: 1600,
    laborPool: 30,
    name: "Ferronia",
    summary: "Le cœur industriel du continent, entre usines et entrepôts.",
    advantage: "Fournisseurs proches : achats moins chers et livrés plus vite.",
    risk: "Pollution (impact environnemental dégradé) et accidents industriels.",
  },
  {
    id: "port-libre",
    population: 0.9,
    purchasingPower: 1.1,
    recoveryHeadStartDays: 0,
    baseWage: 1800,
    laborPool: 25,
    name: "Port-Libre",
    summary: "Un port franc où tout se croise, le licite comme l'illicite.",
    advantage: "Transport moins cher vers toutes les régions, accès facilité au marché noir.",
    risk: "Contrôles douaniers : le marché noir y est plus souvent découvert.",
  },
]);

export const regionIds = regions.map((region) => region.id) as [RegionId, ...RegionId[]];

export const regionById = new Map(regions.map((region) => [region.id, region]));
