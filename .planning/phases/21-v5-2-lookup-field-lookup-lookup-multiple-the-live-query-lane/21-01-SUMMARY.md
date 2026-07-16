---
phase: 21-v5-2-lookup-field-lookup-lookup-multiple-the-live-query-lane
plan: 01
subsystem: wire-types
tags: [lookup, wire-shape, validator, typescript]
requires: []
provides:
  - "FieldNode.inputType tokens: lookup, lookup-multiple"
  - "LookupItem interface (exported from src/index.ts)"
  - "FieldNode.selected / candidates / searchBind / searchAction / allowCustom"
  - "collectActions descends into FieldNode.searchAction (uniqueness-checked)"
affects:
  - "21-02 (.NET twin mirrors this shape)"
  - "21-03 (renderer consumes selected/candidates/searchBind/searchAction)"
  - "21-08 (verification page's real-validator shim relies on searchAction uniqueness)"
tech-stack:
  added: []
  patterns:
    - "TSDoc house style: every optional field closes with `Omitted = <default>`"
    - "Always-array over T | T[] (parity-drift avoidance)"
key-files:
  created:
    - viewmodel-shell/test/lookup-wire-shape.test.ts
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/server.ts
    - viewmodel-shell/src/tree-walker.test.ts
decisions:
  - "OPEN-1 SETTLED: textArrangement deferred to a fast-follow; recorded on the node so it isn't re-derived."
  - "OPEN-3 SETTLED (verified, not assumed): server-decidable is enough; NO __isNew__ wire marker. A client-supplied provenance marker would be strictly WORSE than none."
  - "OPEN-6 SETTLED: an empty query is a legitimate query and IS dispatched; no minChars anywhere in the type or its TSDoc."
metrics:
  duration: ~15 min
  tasks: 2
  commits: 2
  files: 4
  tests_added: 15
  completed: 2026-07-16
---

# Phase 21 Plan 01: Lookup wire surface (TypeScript) Summary

The lookup wire surface now exists in the TypeScript backend — `"lookup"`/`"lookup-multiple"` inputType
tokens, an exported `LookupItem`, and five new `FieldNode` fields — with the D1 direction invariant
stated at the type, and `searchAction` participating in action-name uniqueness with a test proving a
duplicate is rejected.

## What landed

| Task | Commit | What |
|---|---|---|
| 1 | `e8c782b` | `inputType` tokens, `LookupItem`, `selected`/`candidates`/`searchBind`/`searchAction`/`allowCustom` on `FieldNode`, full mandated TSDoc, `bind` TSDoc updated, OPEN-1 deferral note |
| 2 | `62c9d23` | `collectActions` records `field.searchAction`; 5 walker tests incl. duplicate rejection |

**Design fidelity notes:**

- `inputType` extended **in place** beside `select`/`select-multiple` — the cardinality split mirrors
  our existing pattern (D2) rather than introducing a new one.
- `selected` and `candidates` are **separate always-array fields**. Separate because fusing them is the
  original sin (with an id-valued field, "filter the candidate list" and "forget what's selected" are
  the same operation). Always-array — including single `lookup`, holding 0 or 1 entries — because a
  `T | T[]` union drifts across backends. There is no precedent in `index.ts` for a deliberately
  array-of-≤1 field, so the reasoning is written down at the type.
- The `bind` TSDoc now names `lookup`/`lookup-multiple` in the value-bearing REQUIRED list (so the
  `[vms:no-bind]` diagnostic's documented contract doesn't drift) and states that `lookup` binds a
  `string` and `lookup-multiple` a `string[]`.
- Deliberately NOT added (all out of scope): `textArrangement`, `minChars`, `loading`, any appearance knob.

## Decision records

### OPEN-1 — `textArrangement` in v1 or fast-follow? ⇒ **FAST-FOLLOW**

Adopting the design's recorded lean. The enum (`"text"` default / `"text-id"` / `"id-text"`, from SAP's
`UI.TextArrangement`) is **purely additive**, so shipping it later costs nothing and breaks nothing.
v1's surface is already large — two inputTypes, five fields, a new dispatch cadence, a chips a11y
contract — and **no v1 success criterion needs the id rendered beside the label**. Keeping v1 honest
means shipping only what the headline proofs need.

Recorded as a comment **on the node** (not only here), so the next implementer finds the decision
instead of re-deriving it: the enum is fully designed, its deferral is deliberate, and `TextSeparate`
is permanently out of scope (a layout intent no `{label,value}` pair can carry).

### OPEN-3 — is server-side "is this id one of mine?" enough? ⇒ **YES. No wire marker.** (verified)

**This was verified against the code, not assumed** — D3's whole point is explicitness.

**The verification.** The client's POST payload is constructed at `src/index.ts:1372-1380`, and it is
exhaustive:

```typescript
form.append("_action", JSON.stringify({ name: action.name }));  // :1376 — NAME ONLY
form.append("_state", JSON.stringify(this.currentState));       // :1377
```

⇒ **There is no wire path by which the client can communicate provenance.** `_action` carries the name
and nothing else (no `context` field — the Phase 6 wire shape; even `blocking` is stripped, being
client-only). `_state` carries bind paths. `selected` and `candidates` live on the **node** (the `vm`),
which is server→client only and physically cannot travel back. So the only thing the client can say
about a lookup is `bind` — an id, or an array of ids.

**And none is needed.** The server produced every candidate it ever offered, so it classifies by
membership in its own id space: a bind value that isn't one of its ids is an invention. react-select
needs `__isNew__` because it is client-only and **has no server to ask**; we have a server.

**Why this does not violate D3:** the explicitness D3 demands is satisfied by `allowCustom` being a
**declared axis on the node** — *the app declares the ACT it is performing* — not by a per-value
provenance marker. D3's concern is that "choosing somebody to mention" and "inventing a new tag" must
not be inferred from behavior; declaring them on the control settles that, and a per-value marker adds
nothing to it.

**The stronger finding (worth recording, and it goes beyond "the lean was right"):** a wire marker
would be **strictly worse than none**, not merely unnecessary. Any such marker would be *client-supplied*,
and per D1 the client is untrusted — a client could send `__isNew__: false` for an invented value or
vice versa. So a provenance marker would be **a field that looks authoritative and isn't**, which is
precisely the D8 failure mode ("a filter that looks like a security boundary and isn't is exactly what
gets trusted by mistake") transplanted onto provenance. Server-side classification is not a fallback
here; it is the only trustworthy answer available.

**Collision caveat (recorded honestly; does NOT trigger the STOP condition).** The plan's STOP
condition was "an id space where an invented value could collide with a real id." Such a case can be
constructed — a user invents a string that happens to equal a real id — but it does not force a wire
marker, for two reasons:

1. In the **tags case** (`label == value`, D5), the id space *is* the user-visible string space, so
   inventing `"urgent"` when `"urgent"` already exists **should** resolve to the existing tag.
   Classifying it as "picked" is the correct, idempotent outcome — the collision *is* the feature.
2. In the **opaque-id case** (GUIDs, `label != value`), the user types a label, not an id; a collision
   needs them to type a literal existing GUID. And even then a marker wouldn't help, per the
   untrusted-client argument above.

In neither case is authorization affected: the server still authorizes the id in the action handler
with the real auth context (D8). The collision is a provenance-labelling nuance that is
**app-decidable** (an app enabling `allowCustom` over an id space that overlaps user-typeable text has
chosen that), not a wire gap. ⇒ **No STOP; decision stands.**

### OPEN-6 — does the empty-query path reach the server? ⇒ **It must, and nothing precludes it**

This plan owns the **wire half**: **nothing in the type or its TSDoc implies a minimum query length**
(there is no `minChars` — D4, deliberately). The `searchAction` TSDoc states affirmatively that **an
empty query is a legitimate query and IS dispatched**, so an app may answer it with most-recently-used
candidates (Salesforce's picker `searchType` defaults to `Recent`; Dynamics shows 5 MRU + 5 favourites,
explicitly unfiltered by the search term).

⚠️ **Cross-reference — the renderer half is NOT done and is load-bearing for this decision:** the
debounce must fire on a **cleared** input, not only a non-empty one. Enforced in **Plan 21-03**. If
21-03 implements the debounce as `if (value) schedule(...)`, this decision is silently voided and the
MRU empty state cannot work.

## Deviations from Plan

### Flagged, not fixed (as instructed)

**[Task 2] Same-form uniqueness quirk — pre-existing, verified empirically, NOT a Phase 21 regression.**

Because `action` and `searchAction` pass the **same** `enclosingForm` through, a field carrying
`action:{name:"x"}` AND `searchAction:{name:"x"}` **inside one form is ACCEPTED** (same form ⇒ legal by
the rule at `server.ts:82-124`). I verified both halves with a throwaway probe rather than repeating the
claim from the plan:

- same pair **inside** a form ⇒ accepted (no throw);
- same pair **outside** a form ⇒ rejected (`Duplicate action name 'x'`).

That is semantically wrong — they are two distinct operations (Enter commits, typing searches) — but it
is a property of the uniqueness rule as written and is consistent with how `form.submitAction` +
`form.buttons[]` already behave. Per the plan: flagged, not fixed; changing the rule is out of scope.

### Underspecified in the plan (surfaced, not worked around)

**The plan's Task 1 `<verify>` cannot actually catch the type errors it exists to catch.**

Task 1 is `tdd="true"` and its behaviors are type-level ("a bare `LookupItem` is a type ERROR"). But:

- `tsconfig.json`'s `include` is **`src/**/*.ts`** and it **excludes `**/*.test.ts`** — so
  `npx tsc --noEmit` (the plan's verify) type-checks **no test file at all**;
- vitest transpiles via esbuild and **does not type-check**.

⇒ A type-level test in `test/` is checked by **neither** standard command. Observed concretely: at the
RED step the new suite **passed under vitest while `LookupItem` did not yet exist**. A `@ts-expect-error`
that is never type-checked is worse than no assertion — it *looks* like a guard.

**Resolution (no plan deviation in substance):** the suite is verified by an **explicit tsc pass over
the file**, documented in its header comment and run at both RED and GREEN:

```bash
npx tsc --noEmit --strict --target ES2022 --module NodeNext \
  --moduleResolution NodeNext --lib ES2022,DOM --skipLibCheck test/lookup-wire-shape.test.ts
```

RED output confirmed the shape was genuinely absent (`TS2305: no exported member 'LookupItem'`,
`TS2322: "lookup" is not assignable`, `TS2339: Property 'selected' does not exist`); GREEN is clean, and
the `@ts-expect-error` on the always-array assertion now **genuinely fires** (it reported
`TS2578: Unused '@ts-expect-error' directive` at RED, proving it is load-bearing).

**Recommendation for a later plan (not actioned here — out of scope):** this gap is **repo-wide**, not
lookup-specific — *no* test file in `viewmodel-shell/` is type-checked today. Consider a
`tsconfig.test.json` + a `check:types-tests` script so type-level assertions are CI-gated rather than
convention-gated. Logged to `deferred-items.md`.

### GSD-vs-AGENTS.md conflict (project instructions applied; operator decision needed)

The GSD executor flow's `<state_updates>` step updates `.planning/STATE.md`, `ROADMAP.md`, and
`REQUIREMENTS.md`. **AGENTS.md forbids exactly this:**

> *"This repo deliberately has **no** maintained narrative state file (the former `.planning/STATE.md`
> was removed for exactly this reason: a hand-updated status cache drifts and costs more than it's
> worth). Do not recreate one... `.planning/ROADMAP.md` may be **read** for context, but is not to be
> maintained as session bookkeeping."*

Per the CLAUDE.md-takes-precedence rule, **I did not update STATE.md / ROADMAP.md / REQUIREMENTS.md.**
This SUMMARY is append-only phase history under `.planning/phases/**`, not a status cache, so it is
consistent with AGENTS.md and is explicitly required by the plan's `<output>`.

⚠️ **For the operator:** `.planning/STATE.md` **still exists** and is **stale** — its frontmatter reads
`milestone: v5.1`, `current_phase: 20-...`, `current_plan: 06`, `last_updated: 2026-07-11`, while the
repo is executing Phase 21 / v5.2. It is drifting exactly as AGENTS.md predicts. Either delete it (per
AGENTS.md's stated intent) or re-authorize its maintenance — but the two instruction sources currently
contradict each other, and every GSD-executed plan in this repo will hit this.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` (src) | ✅ clean |
| explicit tsc over the type test | ✅ clean (RED→GREEN confirmed) |
| `npx vitest run` | ✅ **597 passed**, 1 skipped, 51 files (was 592 → +5 walker tests) |
| `npm run check:core-globals` | ✅ `index.ts` references zero platform globals |
| `grep -c "interface LookupItem" src/index.ts` | ✅ 1 |
| both inputType tokens in the union (code, comments stripped) | ✅ 1 each |
| the five fields, each exactly once on FieldNode | ✅ 1 each |
| `grep -c "field.searchAction" src/server.ts` | ✅ 1 |
| duplicate `searchAction` rejected by the validator | ✅ (the fail-loud proof) |

**Not run (out of scope for this plan, and correctly so):** parity, `.NET Tests`, demo test projects,
`check:aa-contrast`. This plan touches only TS types + the TS validator and publishes nothing; the full
green-tree gate is a **precondition of the phase's release closeout (21-10)**, not of a wave-1 type
declaration. No push, no publish, no version bump, no branch.

## Threat Flags

None. No new security-relevant surface: this plan adds wire *types* and one validator line. T-21-01
(duplicate search action names) is mitigated as designed (`collectActions` now records `searchAction`;
a duplicate is a hard `invalid_tree` failure). T-21-02 (`selected`/`candidates` trusted inbound) is
mitigated **by shape, not just docs** — verified above at `index.ts:1376-1377`: the client physically
sends only `{name}` + state, so a forged label cannot reach a handler. T-21-03 (D8) and T-21-04 (D7)
are stated in the `candidates` TSDoc in the `uploadOn` register.

## Self-Check: PASSED

- `viewmodel-shell/src/index.ts` — FOUND (LookupItem + 5 fields + both tokens)
- `viewmodel-shell/src/server.ts` — FOUND (`field.searchAction`)
- `viewmodel-shell/test/lookup-wire-shape.test.ts` — FOUND
- `viewmodel-shell/src/tree-walker.test.ts` — FOUND (5 new tests)
- commit `e8c782b` — FOUND
- commit `62c9d23` — FOUND
