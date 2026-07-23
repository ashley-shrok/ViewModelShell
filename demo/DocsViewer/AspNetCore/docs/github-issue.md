## Bug: caching layer returns stale entries after eviction

**Environment:** `example-cache@2.4.0`, Node 20.11.0, macOS 14.

### Steps to reproduce

1. Configure the cache with `maxEntries: 100` and `ttl: 60_000`.
2. Insert 101 entries in a tight loop.
3. Call `get()` on the entry that was evicted.

Expected: `undefined`.
Actual: the evicted entry is returned.

### Minimal reproduction

```typescript
import { Cache } from "example-cache";

const c = new Cache({ maxEntries: 2, ttl: 60_000 });
c.set("a", 1);
c.set("b", 2);
c.set("c", 3); // evicts "a"
console.log(c.get("a")); // expected undefined, got 1
```

### What I tried

- Verified the eviction fires (checked with `c.on("evict", ...)`)
- Checked the [source of `set()`](https://github.com/example/cache/blob/main/src/set.ts#L42) — the eviction path *does* remove the entry from the underlying map
- Traced through `get()` — it appears to read from a stale `hotCache` snapshot

### Checklist before triage

- [x] Reproduced on a clean checkout
- [x] Searched existing issues
- [ ] Bisected to the introducing commit

/cc @maintainers — happy to open a PR if the fix direction is obvious.
