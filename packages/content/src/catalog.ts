import { z } from "zod";

/** Raw materials (N7). */
export const materialIds = [
  "flour",
  "water",
  "plastic",
  "oil",
  "fabric",
  "vegetables",
  "metal",
  "components",
  "batteries",
] as const;
export type MaterialId = (typeof materialIds)[number];

/** Finished products (R1, N7). */
export const productIds = [
  "bread",
  "bottled-water",
  "soap",
  "clothing",
  "packaged-meal",
  "kettle",
  "laptop",
  "console",
] as const;
export type ProductId = (typeof productIds)[number];

/** Anything that can sit in a warehouse. */
export type ItemId = MaterialId | ProductId;

export const materialSchema = z.object({
  id: z.enum(materialIds),
  name: z.string(),
});

export const productSchema = z.object({
  id: z.enum(productIds),
  name: z.string(),
  tier: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  /** Tier-3 branch (R1); null below tier 3. */
  branch: z.enum(["tech", "leisure"]).nullable(),
  /** Materials consumed per unit produced (N7). */
  recipe: z.partialRecord(z.enum(materialIds), z.int().positive()),
  /** Price in a region of normal purchasing power, in crédits (N10). */
  referencePrice: z.number().positive(),
  /** Units demanded per day by a population of 1, at full recovery and reference price (N10). */
  baseDemand: z.number().positive(),
});

export type Material = z.infer<typeof materialSchema>;
export type Product = z.infer<typeof productSchema>;

export const materials = z.array(materialSchema).parse([
  { id: "flour", name: "Farine" },
  { id: "water", name: "Eau" },
  { id: "plastic", name: "Plastique" },
  { id: "oil", name: "Huile végétale" },
  { id: "fabric", name: "Tissu" },
  { id: "vegetables", name: "Légumes" },
  { id: "metal", name: "Métal" },
  { id: "components", name: "Composants électroniques" },
  { id: "batteries", name: "Batteries" },
]);

export const products = z.array(productSchema).parse([
  {
    id: "bread",
    name: "Pain",
    tier: 1,
    branch: null,
    recipe: { flour: 2, water: 1 },
    referencePrice: 31,
    baseDemand: 120,
  },
  {
    id: "bottled-water",
    name: "Eau en bouteille",
    tier: 1,
    branch: null,
    recipe: { water: 2, plastic: 1 },
    referencePrice: 19,
    baseDemand: 140,
  },
  {
    id: "soap",
    name: "Savon",
    tier: 1,
    branch: null,
    recipe: { oil: 2, water: 1 },
    referencePrice: 29,
    baseDemand: 70,
  },
  {
    id: "clothing",
    name: "Vêtements",
    tier: 2,
    branch: null,
    recipe: { fabric: 3 },
    referencePrice: 94,
    baseDemand: 40,
  },
  {
    id: "packaged-meal",
    name: "Plats préparés",
    tier: 2,
    branch: null,
    recipe: { flour: 1, vegetables: 2, plastic: 1 },
    referencePrice: 54,
    baseDemand: 50,
  },
  {
    id: "kettle",
    name: "Bouilloire",
    tier: 2,
    branch: null,
    recipe: { metal: 2, plastic: 1, components: 1 },
    referencePrice: 187,
    baseDemand: 12,
  },
  {
    id: "laptop",
    name: "Ordinateur portable",
    tier: 3,
    branch: "tech",
    recipe: { components: 4, metal: 2, plastic: 1, batteries: 1 },
    referencePrice: 900,
    baseDemand: 6,
  },
  {
    id: "console",
    name: "Console de jeu",
    tier: 3,
    branch: "leisure",
    recipe: { components: 3, plastic: 2, batteries: 1 },
    referencePrice: 600,
    baseDemand: 8,
  },
]);

export const materialById = new Map(materials.map((m) => [m.id, m]));
export const productById = new Map(products.map((p) => [p.id, p]));

export function itemName(id: ItemId): string {
  return materialById.get(id as MaterialId)?.name ?? productById.get(id as ProductId)?.name ?? id;
}
