import { z } from "zod";
import { productIds } from "./catalog.ts";

/** Machine types (R5). Production settings are used by the Production module. */
export const machineTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
  /** Base price in crédits before the equipment supplier's factor. */
  price: z.int().positive(),
  /** Minimum operators assigned for the machine to run. */
  operatorsRequired: z.int().positive(),
  /** Only obtainable through an auction (not sold by equipment suppliers). */
  auctionOnly: z.boolean().default(false),
  /** Compatible products, one at a time, with their cycle settings. */
  products: z.partialRecord(
    z.enum(productIds),
    z.object({ cycleDays: z.int().positive(), outputPerCycle: z.int().positive() }),
  ),
});

export type MachineType = z.infer<typeof machineTypeSchema>;

export const machineTypes = z.array(machineTypeSchema).parse([
  {
    id: "oven",
    name: "Four industriel",
    price: 8_000,
    operatorsRequired: 2,
    products: {
      bread: { cycleDays: 1, outputPerCycle: 40 },
      "packaged-meal": { cycleDays: 2, outputPerCycle: 30 },
    },
  },
  {
    id: "bottling-line",
    name: "Ligne d'embouteillage",
    price: 6_000,
    operatorsRequired: 2,
    products: { "bottled-water": { cycleDays: 1, outputPerCycle: 50 } },
  },
  {
    id: "soap-vat",
    name: "Cuve de saponification",
    price: 6_000,
    operatorsRequired: 2,
    products: { soap: { cycleDays: 2, outputPerCycle: 40 } },
  },
  {
    id: "textile-workshop",
    name: "Atelier textile",
    price: 12_000,
    operatorsRequired: 3,
    products: { clothing: { cycleDays: 2, outputPerCycle: 25 } },
  },
  {
    id: "assembly-line",
    name: "Chaîne d'assemblage",
    price: 15_000,
    operatorsRequired: 3,
    products: { kettle: { cycleDays: 2, outputPerCycle: 20 } },
  },
  {
    id: "tech-line",
    name: "Ligne électronique Tech",
    price: 22_000,
    operatorsRequired: 4,
    products: { laptop: { cycleDays: 3, outputPerCycle: 10 } },
  },
  {
    id: "next-gen-line",
    name: "Ligne électronique dernière génération",
    price: 40_000,
    operatorsRequired: 3,
    auctionOnly: true,
    products: {
      laptop: { cycleDays: 3, outputPerCycle: 15 },
      console: { cycleDays: 3, outputPerCycle: 18 },
    },
  },
  {
    id: "leisure-line",
    name: "Ligne électronique Loisirs",
    price: 20_000,
    operatorsRequired: 4,
    products: { console: { cycleDays: 3, outputPerCycle: 12 } },
  },
]);

export const machineTypeById = new Map(machineTypes.map((m) => [m.id, m]));

/** Machine types sold by equipment suppliers. */
export const purchasableMachineTypes = machineTypes.filter((type) => !type.auctionOnly);
