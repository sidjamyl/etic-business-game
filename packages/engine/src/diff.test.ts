import { describe, expect, test } from "bun:test";
import { applyPatch, diff } from "./diff.ts";

describe("diff / applyPatch", () => {
  const before = {
    clock: { day: 1, step: 0 },
    team: { cash: 100, stock: { flour: 3, water: 1 }, log: [{ id: 1 }] },
    removed: true,
  };
  const after = {
    clock: { day: 1, step: 1 },
    team: { cash: 90, stock: { flour: 3, soap: 2 }, log: [{ id: 1 }, { id: 2 }] },
  };

  test("produces minimal ops", () => {
    expect(diff(before, after)).toEqual([
      { op: "delete", path: ["removed"] },
      { op: "set", path: ["clock", "step"], value: 1 },
      { op: "set", path: ["team", "cash"], value: 90 },
      { op: "delete", path: ["team", "stock", "water"] },
      { op: "set", path: ["team", "stock", "soap"], value: 2 },
      { op: "append", path: ["team", "log"], values: [{ id: 2 }] },
    ]);
  });

  test("applying the diff reproduces the target without mutating the source", () => {
    const copy = structuredClone(before);
    expect(applyPatch<unknown>(before, diff(before, after))).toEqual(after);
    expect(before).toEqual(copy);
  });

  test("identical values produce no ops", () => {
    expect(diff(after, structuredClone(after))).toEqual([]);
  });

  test("arrays that were trimmed are replaced", () => {
    expect(diff({ log: [1, 2, 3] }, { log: [2, 3, 4] })).toEqual([
      { op: "set", path: ["log"], value: [2, 3, 4] },
    ]);
  });

  test("unchanged branches keep their identity after a patch", () => {
    const patched = applyPatch(before, diff(before, after));
    expect(patched.team.log[0]).toBe(before.team.log[0]);
  });
});
