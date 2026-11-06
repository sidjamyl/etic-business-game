import { describe, expect, test } from "bun:test";
import { checkTargets } from "./report.ts";
import { simulateGame } from "./simulate.ts";

describe("bot simulation (smoke)", () => {
  test("a 60-day bot game keeps every invariant and makes sales", () => {
    const game = simulateGame("smoke", 60);
    expect(game.invariantViolations).toEqual([]);
    expect(game.ranking).toHaveLength(4);
    const totalSold = Object.values(game.dailySales)
      .flat()
      .reduce((sum, v) => sum + v, 0);
    expect(totalSold).toBeGreaterThan(1_000);
    const invariants = checkTargets([game]).find((check) => check.id === 7);
    expect(invariants?.ok).toBe(true);
  }, 60_000);
});
