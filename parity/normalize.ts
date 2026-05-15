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
