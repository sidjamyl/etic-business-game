import { randomInt } from "node:crypto";

// Short, unambiguous French words (no accents) for codes that are easy to read aloud.
const WORDS = [
  "LYNX",
  "OURS",
  "LOUP",
  "AIGLE",
  "PUMA",
  "COBRA",
  "ORCA",
  "FAUCON",
  "TIGRE",
  "PANDA",
  "ZEBRE",
  "CERF",
  "HIBOU",
  "REQUIN",
  "BISON",
  "RENARD",
  "KOALA",
  "GECKO",
  "MORSE",
  "CHOUETTE",
];

/** Generates a code like "LYNX-42", unique among `taken` (case-insensitive). */
export function generateJoinCode(taken: ReadonlySet<string>): string {
  for (let attempt = 0; attempt < 1000; attempt++) {
    const word = WORDS[randomInt(WORDS.length)] ?? "CODE";
    const code = `${word}-${randomInt(10, 100)}`;
    if (!taken.has(code)) return code;
  }
  throw new Error("Could not generate a unique join code");
}

export function normalizeJoinCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}
