/**
 * Minimal structural diff used to push deltas instead of full views (S9).
 * - Objects are compared key by key (state uses records keyed by id, so deltas stay small).
 * - Arrays that only grew at the end produce one "append" op (activity log, announcements).
 * - Anything else that changed is replaced with "set".
 */
export type Path = (string | number)[];

export type PatchOp =
  | { op: "set"; path: Path; value: unknown }
  | { op: "delete"; path: Path }
  | { op: "append"; path: Path; values: unknown[] };

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, i) => deepEqual(item, b[i]));
  }
  if (isObject(a)) {
    if (!isObject(b)) return false;
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every((key) => key in b && deepEqual(a[key], b[key]));
  }
  return false;
}

export function diff(before: unknown, after: unknown, path: Path = [], ops: PatchOp[] = []) {
  if (deepEqual(before, after)) return ops;
  if (isObject(before) && isObject(after)) {
    for (const key of Object.keys(before)) {
      if (!(key in after)) ops.push({ op: "delete", path: [...path, key] });
    }
    for (const key of Object.keys(after)) {
      if (!(key in before)) ops.push({ op: "set", path: [...path, key], value: after[key] });
      else diff(before[key], after[key], [...path, key], ops);
    }
    return ops;
  }
  if (Array.isArray(before) && Array.isArray(after) && after.length > before.length) {
    if (before.every((item, i) => deepEqual(item, after[i]))) {
      ops.push({ op: "append", path, values: after.slice(before.length) });
      return ops;
    }
  }
  ops.push({ op: "set", path, value: after });
  return ops;
}

/** Applies ops immutably (structural sharing), suitable for a TanStack Query cache. */
export function applyPatch<T>(target: T, ops: readonly PatchOp[]): T {
  let result: unknown = target;
  for (const op of ops) result = applyOne(result, op, 0);
  return result as T;
}

function applyOne(node: unknown, op: PatchOp, depth: number): unknown {
  if (depth === op.path.length) {
    if (op.op === "set") return op.value as Json;
    if (op.op === "append") return [...(node as unknown[]), ...op.values];
    return undefined;
  }
  const key = op.path[depth] as string | number;
  if (Array.isArray(node)) {
    const copy = [...node];
    copy[key as number] = applyOne(copy[key as number], op, depth + 1);
    return copy;
  }
  const source = isObject(node) ? node : {};
  if (op.op === "delete" && depth === op.path.length - 1) {
    const { [key]: _removed, ...rest } = source;
    return rest;
  }
  return { ...source, [key]: applyOne(source[key], op, depth + 1) };
}
