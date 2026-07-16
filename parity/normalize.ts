// Strip fields that are necessarily different across backends/runs (timestamps,
// generated IDs) before diffing. Anything that should be byte-identical across
// implementations stays untouched.

const VOLATILE_FIELD_NAMES = new Set([
  "createdAt",     // Tasks seed timestamps — Date.now() vs DateTimeOffset.UtcNow
  "updatedAt",
  "timestamp",
]);

/** Recursively walks a JSON value, replacing volatile field values with placeholders
 *  and dropping fields with null values entirely (so "missing" and "null" compare
 *  equal — which they are semantically for every optional field in the wire format). */
export function normalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(normalize);
  const result: Record<string, unknown> = {};
  for (const [key, v] of Object.entries(value)) {
    if (v === null) continue; // drop null fields — semantically equivalent to missing
    if (VOLATILE_FIELD_NAMES.has(key)) {
      result[key] = "<volatile>";
    } else {
      result[key] = normalize(v);
    }
  }
  return result;
}

/** Collect the JSON-Path of every key whose value is an explicit `null`.
 *
 *  This exists because `normalize()` above DROPS nulls before the diff, which
 *  makes the cross-backend diff structurally blind to the exact drift AGENTS.md
 *  gotcha #8 is entirely about: the wire contract is "an unset optional is
 *  ABSENT, never `"field": null`", and a TS backend emitting `"x": null` against
 *  a .NET twin that omits `x` normalizes to equal and passes. "Parity green" was
 *  therefore never proof of null-omission.
 *
 *  This is deliberately NOT a diff. Null-omission is a per-response INVARIANT
 *  that each backend must satisfy on its own, not a property of a comparison —
 *  and that makes this check strictly stronger than a "strict diff mode" would
 *  be. Two backends that BOTH emit `"x": null` match each other perfectly, so a
 *  diff of any strictness passes them, while both violate the contract and both
 *  break strict-`tsc` consumers (`exactOptionalPropertyTypes`). Only a
 *  per-response invariant catches that.
 *
 *  Arrays are walked (a null INSIDE an array is a real value, not an unset
 *  optional, so only object VALUES are reported — an array element that is null
 *  is left to the diff).
 */
export function findNulls(value: unknown, path = "$", out: string[] = []): string[] {
  if (value === null || typeof value !== "object") return out;
  if (Array.isArray(value)) {
    value.forEach((v, i) => findNulls(v, `${path}[${i}]`, out));
    return out;
  }
  for (const [key, v] of Object.entries(value)) {
    if (v === null) out.push(`${path}.${key}`);
    else findNulls(v, `${path}.${key}`, out);
  }
  return out;
}

/** Deep-equality check after normalization. Returns null if equal, else a JSON-Path-style diff string. */
export function diff(a: unknown, b: unknown, path = "$"): string | null {
  if (a === b) return null;
  if (a === null || b === null || typeof a !== typeof b) {
    return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  }
  if (typeof a !== "object") {
    return `${path}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`;
  }
  if (Array.isArray(a) !== Array.isArray(b)) {
    return `${path}: array vs object`;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}.length: ${a.length} vs ${b.length}`;
    for (let i = 0; i < a.length; i++) {
      const d = diff(a[i], b[i], `${path}[${i}]`);
      if (d) return d;
    }
    return null;
  }
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const keys = new Set([...Object.keys(aObj), ...Object.keys(bObj)]);
  for (const k of keys) {
    if (!(k in aObj)) return `${path}.${k}: missing in left, present in right`;
    if (!(k in bObj)) return `${path}.${k}: present in left, missing in right`;
    const d = diff(aObj[k], bObj[k], `${path}.${k}`);
    if (d) return d;
  }
  return null;
}
