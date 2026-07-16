# Phase 21 Plan 11: The Reshape (D4 + D11 reversed) — Summary

**One-liner:** `searchAction` becomes an ordinary Enter-fired blocking action (the `filterAction` pattern); the display/dispatch conflation that rendered a placeholder over a set reference is split and fixed; the false-pass headline test is made real and proven RED first.

Driven by an operator brief, not a PLAN.md. Commits: `4546c4a` (renderer + tests), `e4ea61d` (framework docs + skill), `af598c6` (verification page copy).

---

## What landed

### Task 1 — the cadence is gone
Deleted from `browser.ts`: the 300ms debounce + its adapter-keyed `searchTimers` map (and its mark-sweep), the renderer-forced `blocking: false`, and the 1400ms status debounce (`LOOKUP_STATUS_DEBOUNCE_MS`, the `timer` field on the live-region entry, and the trailing-debounce body of `announceLookup`).

**The renderer now never touches `blocking`** — not to set it, not to infer it, not in either polarity. `on(searchAction)` dispatches the app's `ActionEvent` as declared. Kept, per brief: the live regions + their `chartInstances`-style identity preservation, popup-open preservation, chips, `allowCustom`, and all §7 ARIA/keyboard except the debounce-specific items.

`querying` now means "this render answers a search the user asked for" and is set by `search()` (the Enter) rather than by typing.

### Task 2 — the headline bug
Split the one `!= null` test into the two questions it was fusing:

- **DISPLAY** keys on the query being **non-empty** → the label shows on a cold load.
- **DISPATCH** keys on **non-null** → the empty query still reaches the server (OPEN-6/MRU not regressed; asserted directly).

**Two further bugs the fix exposed, both fixed here** (they were latent under the old behavior because the box never showed a label while a query slot existed):

1. **The label leaked into the query slot.** `search()` flushes `inp.value` on Enter — but when the box displays the *selected label*, that text is the server's, not the user's. Enter on an untouched preselected field would have sent `"Sally Omer"` as the search term and poisoned the MRU open. Introduced `labelShown`, a closure flag tracking whose text the box holds, set/cleared at exactly three points (render, typing, commit).
2. **A spent query outranked the label.** Single-select `commit()` never cleared `searchBind` (multi's `addValue()` always did), so after picking, the stale query would win the display on the server's next render — the user would watch their selection turn back into their search text. `commit()`/`commitCustom()` now clear it, matching multi.

### Task 3 — the false-pass test
**Proof it went RED against the unmodified, broken renderer** (fixtures fixed first, renderer untouched):

```
× 🚨 D1 THE HEADLINE PROOF … renders the label from `selected` when `candidates` is absent entirely
  → expected '' to be 'Sally Omer'
× 🚨 D1 THE ANTI-TRAP … displays 'Sally Omer' even though `candidates` contains only Bob
  → expected '' to be 'Sally Omer'
× 🚨 D1 THE ANTI-TRAP … an EMPTY candidate list does not erase the selected label
  → expected '' to be 'Sally Omer'
Tests  3 failed | 38 passed (41)
```

`expected ''` **is** the operator's symptom: an empty box renders the placeholder. Every headline/anti-trap fixture now sets `searchBind` + `searchAction` and seeds the query as `""`, as a real app does.

**Audit found worse than an omission.** A second test (`"an EMPTY-STRING query is a REAL query … it does not fall back to the label"`) **actively asserted the bug** — it demanded `input().value === ""` on a preselected field. It was reading OPEN-6 (a dispatch rule) as a display rule. Inverted, with the reasoning recorded at the test. Remaining lookup suites audited: `lookup-keyboard`/`lookup-multiple` already set `searchBind`; `lookup-wire-shape` is type-level only.

### Task 4 — click-outside
Closes the popup on a `mousedown` outside the field. **Closes only** — never clears the selection or the query (Escape remains the only clear). `wrapper.contains()` + `mousedown` keeps option-picking working (options commit on `mousedown`). The `document` listener is swept per-render alongside `fitsObservers`, since `document` survives the `innerHTML` wipe. 7 tests, including the leak sweep and the "a mousedown on an OPTION still commits it" edge.

### Task 5 — suites
`test/lookup-search-races.test.ts` **deleted entirely** (508 lines). Recorded honestly in the commit and here: it was **not sloppy work** — it scripted four interleavings and mutation-proved each could fail. It was rigorous *inside the wrong frame*. The lesson, banked: *before verifying a race exhaustively, ask whether the race should exist.*

`test/lookup-search-dispatch.test.ts` reshaped: Enter dispatches; **typing dispatches nothing** (no timer to advance); the empty query still dispatches on Enter; and `blocking` is passed through exactly as declared — **all three polarities asserted** (absent stays absent, `true` stays `true`, `false` stays `false`).

### Task 6 — docs
`index.ts` TSDoc + the `ViewModels.cs` mirror: Enter-fired ordinary blocking action; no debounce; `blocking` means what it means everywhere else and the framework never sets it (with *why blocking is the right default* — the dispatch guard serializes it). `agent-skill.md` search section corrected and **re-copied byte-identically** to `AgentSkill.md` (parity gate confirms: `skill HTTP twins byte-identical (22271B)`).

---

## Where the brief turned out incomplete — flagged, not worked around

**1. 🚩 Enter is now overloaded, and the `filterAction` pattern doesn't cover it.** The table filter input owns exactly **one** Enter act; a lookup input can declare **three** (`allowCustom` invention, `searchAction`, `action`). The reversal created this collision — it didn't exist when typing searched. Shipped precedence: active option → `allowCustom` (non-empty) → `searchAction` → `action`.

- **`allowCustom` + `searchAction` is partially served.** A non-empty Enter invents and never searches; candidates can only arrive via the empty-query (MRU) Enter. Ordering search first was rejected because it **starves invention entirely** (Enter searches → answer → Enter searches the same string again, forever). `demo/LookupVerification-bun` section 4 declares this exact combo — its "Type a tag, press Enter" behavior is preserved; its type-to-find-existing-tags suggestion is not. **Harmless there** (a tag's value *is* its label, and `addValue` dedupes), but a genuine lookup with `allowCustom` and distinct ids would invent `"Sally"` as an id.
- **`action` is unreachable on a lookup that also declares `searchAction`.** `searchAction` wins.

Both are documented in the TSDoc, both twins, and asserted. The real fix, if it matters, is a third act on the wire or a server-supplied "create X" candidate (react-select's AsyncCreatable approach) — **not** a renderer heuristic guessing the user's intent from what they typed, which D3 forbids.

**2. "Delete the 1400ms status debounce" needed a decision the brief didn't state.** §7 item 11 mandates announcing *"Loading results"*, which is not debounce-specific — kept. With immediate announcement the user now hears "Loading results" then the count (two announcements per Enter, in order, ending on the answer), rather than the debounce silently superseding the first. That matches item 11's intent ("an async combobox silent during the fetch leaves AT users with no signal") and the brief's "one Enter, one announcement" (one *question*, one *answer*).

**3. §7 items 10 and 14's rationale text is now partly stale in the design doc** (`.planning/design/lookup-field.md` §7) — item 10 still specifies the 1400ms debounce as a baseline requirement, and several items argue from "it bites async hardest / results land mid-typing". D4/D11 carry REVERSED banners, but §7 wasn't reworked. Not touched (the brief scoped docs to `index.ts`/`ViewModels.cs`/`agent-skill.md`), and §7 is a rationale-of-record rather than a live spec — **flagging for the operator** since it is the same "reads as though it ships" trap that §5's `textArrangement` banner exists to fix.

---

## Green-tree gate — all suites, no exceptions

| Suite | Result |
|---|---|
| `npx vitest run` (framework) | ✅ **803 passed**, 1 skipped, 56 files |
| `bun run parity/run.ts` | ✅ **Parity tests passed** (incl. skill twins byte-identical) |
| `npm run check:core-globals` | ✅ AGNOSTIC-03 — zero platform globals in `src/index.ts` |
| `dotnet test viewmodel-shell-dotnet/Tests` | ✅ 136 passed |
| `demo/Tasks` | ✅ 28 passed |
| `demo/ContactManager` | ✅ 39 passed |
| `demo/RetroBoard` | ✅ 33 passed |
| `demo/ExpenseTracker` | ✅ 29 passed |
| `demo/HelpDesk` | ✅ 52 passed |

No pre-existing failures encountered. `tsc --noEmit` clean.

## Not done (per brief)

No branch, no push, no publish, no tag — operator-driven. No `.planning/STATE.md` (forbidden; stale copy already deleted). ROADMAP.md not touched. No version bump: this is behavior-and-docs on unreleased Phase 21 work; **npm/NuGet are unchanged, so nothing is published and nothing is stranded** — the operator decides whether v5.2 ships from here.
