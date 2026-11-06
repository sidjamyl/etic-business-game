import { z } from "zod";
import { materialIds } from "./catalog.ts";

/** Hidden secrets of the platform (R20, N23). Answers are stored as fingerprints only. */
export const easterEggSchema = z.object({
  id: z.enum(["konami", "logo", "acrostic", "secret-supplier"]),
  name: z.string(),
  /** secretHash of the expected answer; null when the trigger itself is the proof. */
  answerHash: z.number().nullable(),
  /** Reward for the first company only; later finders get a badge. */
  reward: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("cash"), amount: z.int().positive() }),
    z.object({ kind: z.literal("item"), item: z.enum(materialIds), quantity: z.int().positive() }),
  ]),
});

export type EasterEgg = z.infer<typeof easterEggSchema>;
export type EasterEggId = EasterEgg["id"];

export const easterEggs = z.array(easterEggSchema).parse([
  { id: "konami", name: "Code Konami", answerHash: null, reward: { kind: "cash", amount: 2_000 } },
  { id: "logo", name: "Les dix coups", answerHash: null, reward: { kind: "cash", amount: 2_000 } },
  {
    id: "acrostic",
    name: "L'acrostiche",
    answerHash: 8083530837569497,
    reward: { kind: "cash", amount: 2_000 },
  },
  {
    id: "secret-supplier",
    name: "L'entrepôt fantôme",
    answerHash: 1353065420921574,
    reward: { kind: "item", item: "components", quantity: 30 },
  },
]);

export const easterEggById = new Map(easterEggs.map((egg) => [egg.id, egg]));
export const easterEggIds = easterEggs.map((egg) => egg.id) as [EasterEggId, ...EasterEggId[]];
