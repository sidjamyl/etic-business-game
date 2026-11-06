/**
 * Deterministic pseudo-random generator (sfc32) whose whole state lives in the game state.
 * Same seed + same calls = same numbers, which makes games replayable (S13).
 */
export type RngState = [number, number, number, number];

export function seedRng(seed: string): RngState {
  // cyrb128 string hash → four 32-bit words.
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  return [(h1 ^ h2 ^ h3 ^ h4) >>> 0, (h2 ^ h1) >>> 0, (h3 ^ h1) >>> 0, (h4 ^ h1) >>> 0];
}

/** Returns a float in [0, 1) and advances the generator in place. */
export function nextFloat(rng: RngState): number {
  let [a, b, c, d] = rng;
  const t = (((a + b) | 0) + d) | 0;
  d = (d + 1) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  c = (c + t) | 0;
  rng[0] = a >>> 0;
  rng[1] = b >>> 0;
  rng[2] = c >>> 0;
  rng[3] = d >>> 0;
  return (t >>> 0) / 4294967296;
}

/** Integer in [min, max] inclusive. */
export function nextInt(rng: RngState, min: number, max: number): number {
  return min + Math.floor(nextFloat(rng) * (max - min + 1));
}

/** Fisher–Yates shuffle returning a new array. */
export function shuffle<T>(rng: RngState, items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = nextInt(rng, 0, i);
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}
