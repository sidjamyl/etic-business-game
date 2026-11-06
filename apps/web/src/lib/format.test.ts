import { describe, expect, test } from "bun:test";
import { credits, percent, signedCredits, stepLabel, timeLeft } from "./format.ts";

const clean = (text: string) => text.replace(/\s/g, " ");

describe("format", () => {
  test("credits use French grouping, decimals only when needed", () => {
    expect(clean(credits(12_500))).toBe("₢12 500");
    expect(clean(credits(3.6))).toBe("₢3,60");
    expect(clean(credits(-300))).toBe("−₢300");
    expect(clean(signedCredits(1_200))).toBe("+₢1 200");
  });

  test("percent", () => {
    expect(clean(percent(0.85))).toBe("85 %");
  });

  test("time left converts simulated days into real time", () => {
    expect(timeLeft(135, 60_000)).toBe("≈ 2 h 15");
    expect(timeLeft(45, 60_000)).toBe("≈ 45 min");
    expect(timeLeft(120, 60_000)).toBe("≈ 2 h");
    expect(timeLeft(0, 60_000)).toBe("< 1 min");
  });

  test("sub-steps have names when the day has four", () => {
    expect(stepLabel(0, 4)).toBe("Matin");
    expect(stepLabel(3, 4)).toBe("Soir");
    expect(stepLabel(2, 6)).toBe("3/6");
  });
});
