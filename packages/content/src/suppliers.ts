import { z } from "zod";
import { materialIds } from "./catalog.ts";
import { machineTypes } from "./machines.ts";
import { regionIds } from "./regions.ts";

const ethics = z.object({
  /** 0 (very bad) to 100 (exemplary), feeds the impact indicators (R17). */
  social: z.int().min(0).max(100),
  environmental: z.int().min(0).max(100),
});

const restock = z.object({
  /** Days between restocks (R4). */
  everyDays: z.int().positive(),
  /** Stock level restored at each restock. */
  level: z.int().nonnegative(),
});

export const materialSupplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.enum(regionIds),
  material: z.enum(materialIds),
  /** Price per unit in crédits. */
  price: z.number().positive(),
  /** Preparation days before shipping; travel days are added (geography.ts). */
  handlingDays: z.int().nonnegative(),
  ethics,
  restock,
});

export const equipmentSupplierSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.enum(regionIds),
  /** Multiplier applied to machine base prices. */
  priceFactor: z.number().positive(),
  handlingDays: z.int().nonnegative(),
  ethics,
  /** Units of each machine type available per restock. */
  restock: z.object({ everyDays: z.int().positive(), unitsPerType: z.int().nonnegative() }),
});

export type MaterialSupplier = z.infer<typeof materialSupplierSchema>;
export type EquipmentSupplier = z.infer<typeof equipmentSupplierSchema>;

const weekly = (level: number) => ({ everyDays: 7, level });

// Each material has a cheap/polluting option and a pricier/responsible one (N7).
// Weekly levels cover about 85% of four companies producing at full speed (#23 balancing).
export const materialSuppliers = z.array(materialSupplierSchema).parse([
  {
    id: "moulins-azura",
    name: "Moulins d'Azura",
    region: "azura",
    material: "flour",
    price: 3,
    handlingDays: 1,
    ethics: { social: 50, environmental: 60 },
    restock: weekly(700),
  },
  {
    id: "grands-moulins-nordiques",
    name: "Grands Moulins Nordiques",
    region: "nordhaven",
    material: "flour",
    price: 3.5,
    handlingDays: 1,
    ethics: { social: 80, environmental: 75 },
    restock: weekly(440),
  },
  {
    id: "farines-ferro",
    name: "Farines Ferro",
    region: "ferronia",
    material: "flour",
    price: 2.25,
    handlingDays: 1,
    ethics: { social: 30, environmental: 35 },
    restock: weekly(880),
  },
  {
    id: "source-claire",
    name: "Source Claire",
    region: "nordhaven",
    material: "water",
    price: 1,
    handlingDays: 0,
    ethics: { social: 85, environmental: 80 },
    restock: weekly(1080),
  },
  {
    id: "hydro-port",
    name: "Hydro Port",
    region: "port-libre",
    material: "water",
    price: 0.75,
    handlingDays: 0,
    ethics: { social: 40, environmental: 45 },
    restock: weekly(1620),
  },
  {
    id: "aquaferr",
    name: "Aquaferr",
    region: "ferronia",
    material: "water",
    price: 0.75,
    handlingDays: 0,
    ethics: { social: 35, environmental: 30 },
    restock: weekly(1350),
  },
  {
    id: "polyferr",
    name: "PolyFerr",
    region: "ferronia",
    material: "plastic",
    price: 2.25,
    handlingDays: 1,
    ethics: { social: 30, environmental: 15 },
    restock: weekly(900),
  },
  {
    id: "bioplast-nordique",
    name: "Bioplast Nordique",
    region: "nordhaven",
    material: "plastic",
    price: 3.5,
    handlingDays: 1,
    ethics: { social: 75, environmental: 85 },
    restock: weekly(360),
  },
  {
    id: "plastiques-du-port",
    name: "Plastiques du Port",
    region: "port-libre",
    material: "plastic",
    price: 3,
    handlingDays: 1,
    ethics: { social: 45, environmental: 30 },
    restock: weekly(540),
  },
  {
    id: "huileries-azura",
    name: "Huileries d'Azura",
    region: "azura",
    material: "oil",
    price: 3.75,
    handlingDays: 1,
    ethics: { social: 45, environmental: 50 },
    restock: weekly(660),
  },
  {
    id: "oleo-vert",
    name: "Oléo Vert",
    region: "nordhaven",
    material: "oil",
    price: 5,
    handlingDays: 1,
    ethics: { social: 80, environmental: 80 },
    restock: weekly(330),
  },
  {
    id: "filatures-azura",
    name: "Filatures d'Azura",
    region: "azura",
    material: "fabric",
    price: 4.5,
    handlingDays: 2,
    ethics: { social: 25, environmental: 40 },
    restock: weekly(420),
  },
  {
    id: "textile-ethique",
    name: "Textile Éthique",
    region: "nordhaven",
    material: "fabric",
    price: 6,
    handlingDays: 2,
    ethics: { social: 85, environmental: 75 },
    restock: weekly(210),
  },
  {
    id: "tissages-du-port",
    name: "Tissages du Port",
    region: "port-libre",
    material: "fabric",
    price: 5.25,
    handlingDays: 2,
    ethics: { social: 50, environmental: 45 },
    restock: weekly(280),
  },
  {
    id: "cooperative-verte",
    name: "Coopérative Verte",
    region: "azura",
    material: "vegetables",
    price: 2.25,
    handlingDays: 0,
    ethics: { social: 70, environmental: 75 },
    restock: weekly(400),
  },
  {
    id: "agro-ferro",
    name: "Agro Ferro",
    region: "ferronia",
    material: "vegetables",
    price: 1.5,
    handlingDays: 0,
    ethics: { social: 35, environmental: 30 },
    restock: weekly(500),
  },
  {
    id: "acieries-ferronia",
    name: "Aciéries de Ferronia",
    region: "ferronia",
    material: "metal",
    price: 9,
    handlingDays: 2,
    ethics: { social: 35, environmental: 20 },
    restock: weekly(360),
  },
  {
    id: "metaux-recycles",
    name: "Métaux Recyclés du Nord",
    region: "nordhaven",
    material: "metal",
    price: 11.25,
    handlingDays: 2,
    ethics: { social: 75, environmental: 85 },
    restock: weekly(140),
  },
  {
    id: "electronique-port",
    name: "Électronique Port-Libre",
    region: "port-libre",
    material: "components",
    price: 22.5,
    handlingDays: 2,
    ethics: { social: 40, environmental: 35 },
    restock: weekly(260),
  },
  {
    id: "nordtech",
    name: "Nordtech Composants",
    region: "nordhaven",
    material: "components",
    price: 28.5,
    handlingDays: 2,
    ethics: { social: 80, environmental: 70 },
    restock: weekly(130),
  },
  {
    id: "ferro-batteries",
    name: "Ferro Batteries",
    region: "ferronia",
    material: "batteries",
    price: 30,
    handlingDays: 3,
    ethics: { social: 30, environmental: 20 },
    restock: weekly(100),
  },
  {
    id: "cellules-nordiques",
    name: "Cellules Nordiques",
    region: "nordhaven",
    material: "batteries",
    price: 37.5,
    handlingDays: 3,
    ethics: { social: 75, environmental: 70 },
    restock: weekly(50),
  },
]);

export const equipmentSuppliers = z.array(equipmentSupplierSchema).parse([
  {
    id: "ferro-machines",
    name: "Ferro Machines",
    region: "ferronia",
    priceFactor: 1,
    handlingDays: 3,
    ethics: { social: 40, environmental: 30 },
    restock: { everyDays: 30, unitsPerType: 3 },
  },
  {
    id: "nordic-equipment",
    name: "Nordic Equipment",
    region: "nordhaven",
    priceFactor: 1.25,
    handlingDays: 4,
    ethics: { social: 80, environmental: 75 },
    restock: { everyDays: 30, unitsPerType: 2 },
  },
]);

export const materialSupplierById = new Map(materialSuppliers.map((s) => [s.id, s]));
export const equipmentSupplierById = new Map(equipmentSuppliers.map((s) => [s.id, s]));

// Integrity: every material has at least two suppliers, every machine type is sold.
for (const material of materialIds) {
  const count = materialSuppliers.filter((s) => s.material === material).length;
  if (count < 2) throw new Error(`Material ${material} needs at least 2 suppliers`);
}
if (machineTypes.length === 0 || equipmentSuppliers.length === 0) {
  throw new Error("Machines need at least one equipment supplier");
}
