# Phase 21 Plan 13: the popup stops guessing, and a selection looks selected — Summary

**One-liner:** The lookup popup no longer opens on typing or focus (it opens when the results you asked for arrive), a single-select's selection now renders as an SLDS-style pill with a clear ✕ instead of bare text, and the anti-trap demo moves to the one field where it is actually observable.

Driven by an operator brief off the live tailnet page, not a PLAN.md. Commits: `06c31e5` (popup), `0d0381f` (pill), `4378621` (verification page).

---

## What landed

### Task 1 — the popup opens on RESULTS, never on typing or focus (`06c31e5`)

One line survived D4's reversal and shouldn't have: `if (optionEls.length > 0) setOpen(true)` in the input listener. Under type-as-you-go the list tracking keystrokes *was* the contract; under Enter-to-search it is the box guessing. The operator named the harm precisely:

> *"it shouldn't pop up the box before I hit enter, because otherwise it's just kind of throwing random possibilities at me."*

She was watching the popup volunteer **the previous query's answers** — or a server-supplied MRU list — against text she was still typing. Candidates she never asked for, presented as though she had.

**The popup now opens on exactly two events, and neither is typing:**
1. **Results arrive** from a search the user ran (the `querying` branch of the open-preservation block: Enter → dispatch → candidates render → open).
2. **Down / Alt+Down / Up** on a closed popup that has candidates (§7 item 15) — an explicit request, which is the opposite of a guess. **Kept deliberately**, per the brief.

**Focus never opened it** — there is no focus listener in this arm, deliberately — but that was an unstated accident, so it now has a test saying so.

Not regressed (each still covered): click-outside closes, Escape's two-stage, and OPEN-6's empty-query-still-dispatches.

### Task 2 — a single-select's selection LOOKS selected (`0d0381f`)

**The operator found a design gap, not a demo problem, and the fix was already in our own survey.** In single-select the input does double duty — it shows the **selection** and accepts the **query** — with *zero* visual difference between them. "Sally Omer" in that box could be a chosen record or text the user typed. The tree knew which it was the whole time; the pixels didn't say.

SLDS's answer, adopted: **style the input itself as a pill when a record is selected.** The detail that makes this the right shape rather than a lookalike is that for single-select **no separate pill element exists at all** — multi's pills live outside the input (D2's chips layer); single's selection *is* the input. So this is **appearance + a clear control**: no new element, no new node, nothing on the wire, and the input keeps `role="combobox"` and stays typeable (pinned by a test).

```
selection present + no active query  ⇒ pill + a clear ✕
user is typing (query non-empty)     ⇒ plain query text, no pill
```

That predicate is **exactly the existing `labelShown` flag** ("the box is showing a label, not a query"), so it is deliberately *not* a second flag that could drift out of step with the first. All mutation now routes through `setLabelShown()` — the closure and the DOM must never disagree, the rule `open` already follows. The clear ✕ also means **Escape is no longer the only way out**; "hunting for Escape" is not a discoverable affordance. The keyboard path is unchanged — the ✕ is an addition, not a replacement.

**AA — hand-computed, because the fixed 13-pair gate does not cover this pair.** It reuses the **chip's** tokens (`--_chip-tone` + its 12% knockout), adding **no theme var**, so it is *literally* the chip's already-measured pair:

| Pair | Worst | Where | Bar |
|---|---|---|---|
| pill label text / pill fill | **10.63:1** | all dark-\* | 4.5:1 |
| pill label text / pill fill | 13.60:1 | default + all light-\* | 4.5:1 |
| clear ✕ focus ring / pill fill | 10.63:1 | all dark-\* | 3:1 |
| pill border / page bg (informational) | 2.16 light / 2.85 dark | — | vs bare `--vms-border`'s **1.32 / 1.43** |

Deriving from `--_chip-tone` is what **structurally** avoids 21-09's trap (the chip's focus ring failed 3:1 on light-amber/green/teal off `--vms-accent`; the mix ratio was not the lever). The toned border is strictly better than the shipped input border on every target, so it cannot regress.

One non-obvious implementation fact, commented at the site: **`--_chip-tone` is declared on the wrapper, not the input** — the clear ✕ is the input's *sibling* and would silently fall back to an untoned color otherwise.

### Task 3 — the anti-trap demo moves to the MULTI field (`4378621`)

**The brief was right that it was demonstrated on the wrong field and was not performable.** §1 told the reviewer to search a query excluding Sally and observe that "the label is STILL shown" — but in single-select the box shows **the query** mid-search, so there was nothing to observe. The page also never mentioned Escape, which is why it read as nonsense.

- **§3 (watchers) is now the headline.** Search "Nakamura": the list narrows to eight people, not one of whom is Bjorn Omer or Priya Lindqvist — the two selected watchers — **while the chips stay put**. The selection and the list that excludes it, side by side, disagreeing, with the selection winning. That is the trap, visible in one screen.
- **"Nakamura" was chosen by computation, not by guess:** 8 hits (*at* the cap, so they render rather than tripping the over-cap message), excludes the owner *and* both watchers, and collides with none of their first names. ("Petrova" also works but surfaces a "Sally Petrova" beside §1's "Sally Omer" — needless confusion on a verification page.)
- **§1 keeps the cold-start headline** (still the D1 proof) and gains the honest single-select proof — the **round trip** — spelled out keystroke by keystroke.
- The copy is **honest** that the deepest form of the case (server re-renders with candidates excluding the selection, no user action) is unit-tested and **not clickable**.

---

## 🚩 Where the brief turned out wrong

**The brief's Escape instruction for §1 does not do what it says.** It asked for: *"with Sally selected, type 'Petrova', press Enter, then **Escape** — Sally's still there, the selection survived the search."*

Escape **does not visibly restore Sally**, and it can't:
- **Escape #1** (popup open) → stage one: closes the popup, keeps everything. `bind` still holds `u-401` — but the box still reads "Petrova", because the query is still in state and display keys on non-empty.
- **Escape #2** (popup closed) → stage two: **clears the selection**. The opposite of the intended proof.

The label only returns on the next **server render** with an empty query. So the performable proof — verified over the wire, both legs — is:

1. Type "Nakamura", **Enter** → 8 candidates, none of them Sally; the *"bind holds"* line still reads `u-401`. **The search did not touch the selection.**
2. **Clear the box, Enter** → `candidates: 0`, `selected: [Sally Omer]`, query empty ⇒ **the pill is back.**

That is what the page now says. Escape's two stages are documented alongside it rather than presented as the proof.

**Worth noting the two tasks interlock:** Task 2 is what makes this coherent rather than a wart. "The box shows Petrova while the selection is still Sally" is only confusing *if the box looks the same either way* — which was exactly Task 2's gap. With the pill, **no pill means "this text is your query, not your selection"**, at a glance.

---

## Tests

**820 passing** (808 baseline + 12), 56 files.

- **Popup:** the "typing … opens the popup" assertion is **inverted deliberately** (it encoded the reversed model); +3 for the already-have-candidates shape (the exact `optionEls.length > 0` case that misfired), focus, and the kept Down-opens path. The two preservation tests now open via the search rather than via typing.
- **Pill:** +10 holding the predicate (pill ⟺ selected-and-not-querying), that typing drops it on the first keystroke, that commit restores it, that **multi never wears it and has no clear button at all**, the ✕'s behavior + item-specific accessible name + `type="button"`, and that the a11y contract survives (still an `<input role="combobox">`, not readonly, not disabled).

## Green-tree gate — full, no exceptions

| Gate | Result |
|---|---|
| `npx vitest run` | ✅ 820 passed, 1 skipped (56 files) |
| `bun run parity/run.ts` | ✅ passed (incl. skill byte-identity, source + HTTP twins) |
| `npm run check:core-globals` | ✅ zero platform globals in core |
| `dotnet test viewmodel-shell-dotnet/Tests` | ✅ 136/136 |
| `demo/Tasks` · `ContactManager` · `RetroBoard` · `ExpenseTracker` · `HelpDesk` | ✅ 28 · 39 · 33 · 29 · 52 — **all 5 green** |
| `check:aa-contrast` · `no-demo-style` · `theme-byte-identity` · `theme-function` | ✅ all green |

`dotnet` needed `PATH="$HOME/.dotnet:$PATH"` — parity fails `ENOENT` on `spawn dotnet` without it.

## Non-negotiables honored

- **Renderer never touches `blocking`** — verified: zero code references in `browser.ts` (comments only).
- **Zero appearance on the wire** — renderer + CSS only; no node/type/wire change, so no .NET mirror obligation and no `agent-skill.md` change.
- **No new theme vars** — the pill reuses `--_chip-tone`.
- **Git operator-driven** — three atomic commits on `main`. **Not** branched, pushed, published, or tagged.
- **`.planning/STATE.md` not created/updated**; ROADMAP not touched as a status cache.

## The served page

**http://100.113.23.63:3012/** — backgrounded `bun server.ts`, **PID 1770147**.

**Freshness proof (the brief's specific worry — a stale server squatting :3012 and serving old code while looking healthy):**
- `dist/browser.js` rebuilt **17:09:02**, Vite bundle emitted **17:09:12** — served asset is newer. ✅
- The old server **was** squatting :3012 (PID 1716676) and was killed **by PID**, port confirmed free before rebinding. ✅
- Bundle hash changed `index-BHn-hbZp.js` → **`index-D-LjXsNU.js`**; the old hash now **404s**, and `index.html` references the new one.
- **Fetched over the tailnet IP**, the served bundle contains `vms-field--lookup-selected`, `vms-field__clear`, and `` `Clear ${e.label??e.name}` ``; the served `default.css` carries the pill rules (4 hits).
- All assets **200** over `100.113.23.63`: `/`, `/api/lookup`, the bundle, `/vms/default.css`, both probed themes, `/.well-known/vms-skill.md`.
- The **anti-trap itself was driven over the wire**: `search-watchers` with "Nakamura" returns `selected == [Bjorn Omer, Priya Lindqvist]`, 8 candidates, **zero intersection**.

## Self-Check: PASSED

- `viewmodel-shell/src/browser.ts`, `viewmodel-shell/styles/default.css`, `demo/LookupVerification-bun/server.ts` — all present and modified.
- Commits `06c31e5`, `0d0381f`, `4378621` all confirmed in `git log`.
- Working tree clean; `demo/LookupVerification-bun/dist` correctly gitignored (build artifact, not committed).
