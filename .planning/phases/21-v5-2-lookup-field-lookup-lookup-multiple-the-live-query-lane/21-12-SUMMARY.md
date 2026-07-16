# Phase 21 Plan 12: D15 — the Enter-overload reshape — Summary

**One-liner:** `allowCustom` + `searchAction` together now fails loud instead of being half-served, which makes Enter mean exactly one thing in every shipped shape; the verification page's §4 is split into the two shapes that actually ship.

Driven by an operator brief, not a PLAN.md. Commits: `7d0dada` (renderer + types + tests), `d0a2cf5` (verification page).

---

## What landed

### Task 1 — D15: the combo fails loud

The Enter-overload I flagged in 21-11 is resolved by **excluding the combination rather than ordering it**. The brief's framing was the unlock: *that there is no good ordering is the tell that the shape is wrong.*

- **`[vms:lookup-ambiguous-enter]`** fires at render when a lookup declares both, following the **`[vms:orphan-file]` precedent** exactly: `warnOnce` (deduped per field over the adapter's lifetime), `console.warn`, **not a throw**. It names what is wrong and what to do — the two supported shapes, spelled out.
- **It degrades coherently rather than exploding:** the field renders as a working combobox and reads as the **directory picker** (the search wins; `allowCustom` is ignored). That is not a precedence — it is only reachable for the unsupported combo, and it is the reading the warning names.
- **Enter's precedence is now a formality, not a tie-break:** active option → `searchAction` → `allowCustom` → `action`. With the combo excluded, **no two arms can both apply**. The old invent-before-search block (and its long apologetic comment about being "partially served") is gone.
- The deferred answer is recorded at the site so it is not re-derived: react-select's synthetic *"Create 'urgent'"* candidate, which collapses invention into "accept the active option".

### The `action`-reachability decision — a real limitation, documented (not a bug)

I flagged in 21-11 that `action` is unreachable when `searchAction` exists. **It still is, and that is correct.** Decided explicitly:

- This is **not** the D15 ambiguity. D15 is *two acts fighting over one key*; this is **one act occupying the key**, which is what declaring a search *means*.
- Enter is the lookup's only dispatch key. There is no second Enter to hand `action`, and manufacturing a second submit gesture would be a keybinding no combobox pattern sanctions.
- ⇒ **Documented as a deliberate limitation on both backends' TSDoc** (`FieldNode.searchAction` / `SearchAction`): *on a searching lookup, put the submit on a `ButtonNode`.* Pinned by a test so it stays a decision rather than being silently "fixed" by re-ordering the arms.

### Task 2 — the verification page's §4

§4 declared the combo, so the operator was being asked to sign off on something that does not ship. Split into the two shapes **over the same domain (labelling a ticket)**, so the contrast itself is the lesson — same control, one declared act each:

- **4a. Category (curated)** — `lookup` + `searchAction`, no `allowCustom`. Enter searches; arrow+Enter accepts; typing a non-existent category invents **nothing**. Backed by a real curated `CATEGORIES` directory, with `selected` resolved out of that id space and **never** out of `candidates` (the same D1 anti-trap rule as the people fields).
- **4b. Tags (free-form)** — `lookup-multiple` + `allowCustom`, no `searchAction`. Enter invents, unambiguously, because nothing else claims the key. Labels omitted per D5.

The orphaned `search-tags` handler is removed (it correctly answers `unknown_action` now — verified over the wire). Everything else kept: the headline, the anti-trap, Enter-to-search, chips, click-outside, the search-error state, the 13-theme picker. **Still the real backend** — the shipped validator runs on every response.

## Tests

`803 → 808` (2 obsolete precedence tests removed, 7 added). The two deleted tests encoded the *old* invent-before-search precedence — they were correct for a shape that no longer exists.

New coverage: the error fires for the combo (and names both shapes); the combo does **not** throw and still renders a coherent combobox; each supported shape's Enter does **exactly one** thing; **neither supported shape emits the error**; the warning dedupes across re-renders; `action` unreachability is pinned.

## Green-tree gate — all green, no exceptions

| Suite | Result |
|---|---|
| `npx vitest run` | **808 passed** \| 1 skipped (803 baseline + 5 net) |
| `bun run parity/run.ts` | **✓ passed** (incl. skill twins byte-identical) |
| `npm run check:core-globals` | **✓ zero platform globals** |
| `dotnet test viewmodel-shell-dotnet/Tests` | **136/136** |
| `demo/Tasks` · `ContactManager` · `RetroBoard` · `ExpenseTracker` · `HelpDesk` | **28 · 39 · 33 · 29 · 52 — all pass** |

`dist` was rebuilt **before** re-serving, so the served bundle carries all of this.

## Serving

**`http://100.113.23.63:3012/`** — backgrounded (`setsid`+`disown`, survives this session), real bun backend on all interfaces.

Smoke-tested over the tailnet IP, all 200: `/` · `/api/lookup` · `/assets/index-BHn-hbZp.js` · `/vms/default.css` · `/vms/themes/dark-purple.css` · `/.well-known/vms-skill.md`.

Verified over the wire: no field declares both axes; the headline holds (`bind: "u-401"`, label **"Sally Omer"** rendered, `candidates: []`, no search run); the anti-trap holds (query `"Petrova"` → 8 Petrova candidates excluding the selection, label survives); 4a's search returns real curated candidates.

## Deviations from plan

- **[Rule 3 — Blocking] A stale server was squatting port 3012.** My `pkill -f "LookupVerification-bun/server.ts"` did not match (the process cmdline is the relative `bun run server.ts`), so the previous session's server survived, my replacement failed to bind, and the page would have kept serving **pre-D15 code while looking healthy**. Killed by PID after confirming its cwd. Deliberately left PID 1713333 alone — unrelated app (`~/vms-apps`, port 9000).
- **[Rule 2 — Missing critical] The .NET twin carried the same now-false guidance** ("if the field also declares AllowCustom, a non-empty Enter INVENTS…"). Not in the brief, but leaving it would have drifted the two backends' documented contracts. Doc-only; wire shape unchanged, so no parity impact.

## Where the brief was wrong / notes for the operator

- **Nothing in the brief was wrong.** Two clarifications worth recording:
  - The brief said §4 declares the combo — correct, but its `searchAction: {name:"search-tags"}` had **no `candidates` behind it at all**. §4 was already a tags field with a search that could never return anything: the combo was not just unsupported, it was inert. Splitting it gave 4a a real curated directory so the directory-picker half is genuinely exercised rather than mimed.
  - The brief listed "13 themes" for the picker and AGENTS.md says "default + 12 themes" — these agree (default + 12). Untouched; noted only so the count is not read as a discrepancy.
- **`blocking` was not touched.** The renderer neither sets, infers, nor upgrades it — the AGENTS.md rule holds, and D15 removes the pressure that would have tempted it.
- **`.planning/STATE.md` not created/updated**, and ROADMAP.md not touched as a status cache, per AGENTS.md.
- **Not pushed, branched, tagged, or published** — two atomic commits on `main`, as authorized. `CHANGELOG.md` deliberately untouched: no version bump here, and it is release-gated, not HEAD-synced.

## Self-Check: PASSED

- `7d0dada`, `d0a2cf5` — both present in `git log`.
- `.planning/phases/21-.../21-12-SUMMARY.md` — this file.
- Server verified live on `100.113.23.63:3012` (all six assets 200).
