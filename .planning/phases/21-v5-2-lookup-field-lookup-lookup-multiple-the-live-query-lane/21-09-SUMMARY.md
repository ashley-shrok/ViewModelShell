---
phase: 21-v5-2-lookup-field-lookup-lookup-multiple-the-live-query-lane
plan: 09
subsystem: release-gate
tags: [green-tree, aa-contrast, verification-page, tailnet, sign-off, lookup]
requires:
  - "21-05 (the single lookup control)"
  - "21-07 (TUI degradation)"
  - "21-08 (parity/FeatureProbe coverage)"
provides:
  - "a fully green tree across all seven suite groups, re-run AFTER the CSS tuning"
  - "the chip's fg/bg pair hand-measured across the default + all 12 themes"
  - "the --_chip-tone focus-ring fix (the accent ring FAILED 3:1 on 3 light themes)"
  - "demo/LookupVerification-bun — the real-bundle, real-validator tailnet sign-off page"
affects:
  - "21-10 (the publish — BLOCKED on Ashley's sign-off recorded here)"
tech-stack:
  added: []
  patterns:
    - "a verification page as a REAL backend (createAction) rather than a fetch shim — the shipped validator runs for free on POST, and explicitly at startup on GET"
    - "mutation-verifying a validator gate: inject a duplicate action name, assert the process refuses to boot"
key-files:
  created:
    - demo/LookupVerification-bun/server.ts
    - demo/LookupVerification-bun/index.html
    - demo/LookupVerification-bun/src/main.ts
  modified:
    - viewmodel-shell/styles/default.css
decisions:
  - "The chip's remove-button focus ring derives from --_chip-tone, NOT --vms-accent. The accent ring measured BELOW the 3:1 non-text bar on light-amber/green/teal. The mix ratio is not the lever — the ring still fails at a 4% tint."
  - "The chip fill stays at the 12% mix from 21-06: independently re-measured, worst 10.63:1 vs a 4.5:1 bar. No change needed."
  - "The chip pair was NOT added to check-aa-contrast.mjs: its PAIRS table is structurally var-vs-var hex only, and the chip's bg is a computed color-mix. Recorded as a candidate improvement rather than forced."
  - "The headline field carries NO MRU on an empty query — an MRU list would put the preselected person into candidates and let a naive candidate-resolving implementation render correctly BY ACCIDENT, destroying the proof."
metrics:
  duration: ~45 min
  tasks: 3 of 4 (Task 4 is the blocking human checkpoint)
  commits: 2
  files: 4
  completed: 2026-07-16
---

# Phase 21 Plan 09: green-tree gate + chip AA + the tailnet sign-off page Summary

The gate between "built" and "released". The tree is green, the chip's new fg/bg pair is
hand-measured across all 13 targets (and one real failure was found and fixed), and a tailnet
page drives the REAL shipped bundle through the REAL validator. **Task 4 — Ashley's sign-off —
is pending; 21-10's publish does NOT proceed without it.**

## Task 1 — the full green-tree gate

Run in full, no exceptions. **Every suite green on the first run; zero pre-existing failures found.**

| Suite | Result |
|---|---|
| `npx vitest run` | **796 passed \| 1 skipped** (57 files) — matches the 21-06 baseline exactly |
| `npm run check:core-globals` | ✓ AGNOSTIC-03: `src/index.ts` references zero platform globals |
| `node scripts/check-aa-contrast.mjs` | ✓ all 13 pairs meet WCAG-AA on default + 12 themes |
| `node scripts/check-theme-byte-identity.mjs` | ✓ all 11 theme files match their SHA-256 baseline |
| `bun run parity/run.ts` | ✓ Parity tests passed (incl. skill source + HTTP twins byte-identical) |
| `dotnet test viewmodel-shell-dotnet/Tests` | **136 passed**, 0 failed — the easily-forgotten one |
| `demo/**/*.Tests.csproj` (5 projects) | ContactManager **39**, ExpenseTracker **29**, HelpDesk **52**, RetroBoard **33**, Tasks **28** — all 0 failed (**181** total) |

⚠️ **Gotcha for the next executor:** `parity/run.ts` spawns `dotnet` and fails with a bare
`ENOENT: Executable not found in $PATH: "dotnet"` if `~/.dotnet` isn't exported into *that*
shell. It is not a parity failure and reads nothing like one.

## Task 2 — the chip AA hand-check: a real failure, found and fixed

**The `check:aa-contrast` gate passed the whole time and proved nothing about the chip** — exactly
as the plan predicted. The hand-check found a genuine, shipping-blocking failure the fixed 13-pair
gate cannot see.

### The chip's text-on-fill — 21-06's numbers independently confirmed, no change

`--vms-text` on `color-mix(in srgb, --vms-text 12%, --vms-surface)`. Bar: **4.5:1** (14px non-bold
body text; only ≥18.66px-bold / ≥24px-normal drops to 3:1, and the chip is neither).

| Target | chip text-on-fill | AA 4.5 | focus ring vs fill (after fix) | 3.0 |
|---|---|---|---|---|
| default (shipped) | 13.60:1 | pass | 13.60:1 | pass |
| light-amber | 13.60:1 | pass | 13.60:1 | pass |
| light-blue | 13.60:1 | pass | 13.60:1 | pass |
| light-green | 13.60:1 | pass | 13.60:1 | pass |
| light-purple | 13.60:1 | pass | 13.60:1 | pass |
| light-rose | 13.60:1 | pass | 13.60:1 | pass |
| light-teal | 13.60:1 | pass | 13.60:1 | pass |
| dark-amber | 10.63:1 | pass | 10.63:1 | pass |
| dark-blue | 10.63:1 | pass | 10.63:1 | pass |
| dark-green | 10.63:1 | pass | 10.63:1 | pass |
| dark-purple | 10.63:1 | pass | 10.63:1 | pass |
| dark-rose | 10.63:1 | pass | 10.63:1 | pass |
| dark-teal | 10.63:1 | pass | 10.63:1 | pass |

**Worst 10.63:1 vs a 4.5:1 bar. 21-06's 13.60 / 10.63 figures verified independently — correct, and
the 12% mix is kept unchanged.**

### 🚩 The failure: the remove button's focus ring was BELOW the 3:1 bar on three themes

Measured with the shipped `--vms-accent` ring **as it stood at the start of this plan**:

| Theme | accent vs `--vms-surface` | accent vs the **chip fill** | 3:1 |
|---|---|---|---|
| light-amber | 3.34:1 | **2.63:1** | **FAIL** |
| light-green | 3.23:1 | **2.54:1** | **FAIL** |
| light-teal | 3.28:1 | **2.58:1** | **FAIL** |

The mechanism: `--vms-accent` clears 3:1 against `--vms-surface` on all 13 targets, but only *barely*
on those three. The chip's fill is a **tinted** surface, and the tint eats the entire remaining
margin. A failing focus indicator on a **keyboard-only affordance** — the roving tabindex exists
precisely so focus lands there.

**The non-obvious part: the mix ratio is NOT the lever.** Swept it:

| mix | 12% | 10% | 8% | 6% | 4% | 2% |
|---|---|---|---|---|---|---|
| worst ring (light-green) | 2.54 | 2.64 | 2.76 | 2.86 | 2.99 | 3.10 |

It still fails at 4%, and only scrapes 3.10:1 at 2% — **a chip with no visible fill at all**. No chip
worth rendering can rescue the accent here. Had the plan's assumed lever been applied blindly, the
result would have been a washed-out chip that *still* failed.

**The fix (`12814f1`): the ring derives from `--_chip-tone`.** Structural, one line, zero per-theme
rules — it is the same polarity-adaptive knockout pair as the chip's text, so it inherits that pair's
measured headroom (10.63:1 worst vs a 3:1 bar). It is also what the chip's own private-tone technique
already does everywhere else (`.vms-field__chip--armed` borders with it; the button's `color`
inherits it). **The accent ring was the outlier, not the convention.**

- `git diff viewmodel-shell/styles/themes/` — **empty**. No per-theme deepening.
- Both `check-aa-contrast.mjs` and `check-theme-byte-identity.mjs` stay green.

### 🚨 The gate was RE-RUN post-tuning (not Task 1's result)

`default.css` changed, so per AGENTS.md the sign-off must not be taken on an ungated tree. The
**full** gate was re-run against the post-tuning CSS:

| Suite | Post-tuning result |
|---|---|
| vitest | **796 passed \| 1 skipped** (unchanged) |
| core-globals | ✓ |
| aa-contrast | ✓ 13/13 |
| theme-byte-identity | ✓ |
| parity | ✓ passed |
| framework .NET Tests | **136 passed** |
| all 5 demo Tests projects | **181 passed**, 0 failed |

### Was the chip pair added to the automated gate? **No — recorded, not forced.**

`check-aa-contrast.mjs`'s `PAIRS` is structurally `[fgVar, bgVar, threshold]` and resolves **both
sides as plain hex `--vms-*` vars**. The chip's background is not a var — it is a computed
`color-mix()`. Admitting it needs a mix-resolver plus a reshaped `PAIRS` entry, i.e. a real
extension to a gating script mid-release. The plan said not to force it, so it is recorded here as a
**candidate improvement with a now-proven payoff**: this exact bug class (an accent ring on a
*tinted* surface) is no longer hypothetical — it was real, and only a hand-check caught it. Interim
mitigation: the `default.css` comment carries the numbers and the instruction *"Re-measure if
`--_chip-tone` ever stops being `--vms-text`."* The throwaway measuring script is reproduced in the
commit message and trivially rebuilt from `check-aa-contrast.mjs`'s helpers.

## Task 3 — the tailnet verification page

**`demo/LookupVerification-bun/`** — on the `NavVerification-bun` precedent: a Vite-built client
driving the **REAL shipped browser bundle** (rebuilt via `npm run build` first) + the **REAL shipped
`default.css` and all 12 themes**, served verbatim over one `Bun.serve`.

### The banked lesson: a REAL backend, not a fetch shim

The plan allowed a fetch-shim + in-page reducer. **A real backend is strictly stronger and was
chosen instead**: the POST path goes through the shipped `createAction`, which *itself* runs
`validateActionNames` + `validateSectionAction` over every response tree — the real framework code
path, not a lookalike. The GET path does not flow through `createAction`, so it calls the **same
shipped validators explicitly**, at **startup** (not first request), so an invalid tree means the
process never comes up.

**Mutation-verified rather than asserted.** Injecting a duplicate action name (`search-assignee` →
`search-owner`) made the server **refuse to boot**, throwing the shipped validator's
*"Duplicate action name … dispatched from semantically distinct nodes"*. `server.ts` was restored
and `diff`'d byte-identical. The gate demonstrably fires.

### The six scenarios (headline first)

| # | Scenario | How it is proven |
|---|---|---|
| 1 | **The headline** — a reference already set, NO search | State holds `owner: "u-401"` and nothing else; `ownerQuery: ""`; **`candidates: []`**; the node carries `{value:"u-401", label:"Sally Omer", type:"user"}` |
| 2 | **The anti-trap** | Query `"Petrova"` → candidates exclude Sally Omer entirely, **label still renders** (verified over the wire) |
| 3 | Live search + **D7 visible cap** + no-matches | `"a"` → `TextNode(tone:"warning")` *"Refine your search — 111 matches, max is 8."*; `"zzzz"` → muted *"No people match"*; empty → the OPEN-6 MRU |
| 4 | `lookup-multiple` chips | Two chips preselected from ids alone; add/remove by mouse + keyboard; two-step Backspace |
| 5 | `allowCustom` free-form tags | No directory behind it; labels **omitted** per D5 (a tag's label is itself) |
| 6 | **The OPEN-5 differentiator** | `"fail"` → `FieldNode.error` (role=alert, red); `"zzzz"` → muted no-matches. Visibly different — the thing react-select swallows |
| — | Themes | A 13-way picker: shipped default + all 12 themes |

### Two flaws in my own page, found by smoke-testing rather than assuming

1. **The headline was silently self-defeating.** My OPEN-6 MRU returned the first 5 people on an
   empty query — which put **Sally Omer into `candidates` on load**. A naive candidate-resolving
   implementation would then render the right label *by accident*, and the headline would prove
   nothing. Fixed: the MRU is opt-in per field and **off for the headline**, which now loads with
   `candidates: []`. The MRU demo moved to section 2, where nothing is selected. Commented at the
   site.
2. **The directory contained twins.** Striding first/last independently (`n%20`, `n*7%15`) has period
   `lcm(20,15) = 60`, so 120 people contained **every pair twice** — two candidates rendering the
   identical name, on a picker verification page. Fixed with a single stride co-prime to 300, plus a
   **startup assertion** that fails loudly if the stride ever stops being co-prime.

### The ~350ms simulated latency is load-bearing, not padding

An in-memory 120-row search returns in ~1ms, so **a busy-lock would flash by unseen** and D11's
renderer-forced-non-blocking `searchAction` would be *unfalsifiable by eye* — defeating the reviewer's
"the page never greys out while you type" check. At ~350ms (measured: 0.352s) an in-flight search is
plainly visible, and the ~300ms debounce and the network read as two distinct effects.

### Reachability

**`http://100.113.23.63:3012/`** — served in the background. Every asset smoke-tested **over the
tailnet IP** (not localhost): `/`, the JS bundle, `/vms/default.css`, the theme files, `/api/lookup`,
`/.well-known/vms-skill.md` — **all 200**. The served bundle contains the new lookup renderer and the
served CSS contains the `--_chip-tone` ring fix. Carries the discoverability meta + `skill` field.

## Deviations from Plan

**1. [Rule 1 — Bug] The chip focus ring failed AA; the plan's assumed fix would not have worked.**
- **Found during:** Task 2. **Issue:** the `--vms-accent` ring measured 2.54–2.63:1 against the chip
  fill on 3 light themes, below the 3:1 non-text bar.
- **The plan's prescribed lever ("tune the mix ratio, or the tone var") could not fix it** — the ring
  fails at any mix down to 4% and only reaches 3.10:1 at 2%. Fixed structurally via `--_chip-tone`
  instead, which stays inside the plan's real constraint (one `color-mix(…, --vms-surface)`
  formulation, zero per-theme deepening).
- **Files:** `viewmodel-shell/styles/default.css`. **Commit:** `12814f1`.

**2. [Rule 2] The page is a real backend, not the fetch shim the prompt described.** The plan's own
`read_first` cites `NavVerification-bun` / `NonBlockingStaleness-bun`, which are real `Bun.serve`
backends. That is strictly stronger for the banked lesson: `createAction` runs the shipped validators
itself, so the *real* code path is exercised rather than a shim that merely calls a validator.
GET is validated explicitly since it bypasses `createAction`. **Commit:** `7cd293d`.

**3. [Rule 2] Added a ~350ms simulated search latency** (not in the plan) — without it the
non-blocking property under review is unobservable. Reasoned above.

## 🚩 Flags — where the plan / prior work turned out wrong

1. **🚨 The plan's Task 2 assumed the mix ratio was the tuning lever for BOTH the chip text and the
   focus ring. For the ring it is not, and no ratio fixes it.** The binding constraint is
   `--vms-accent`'s thin margin in three light themes, which the chip's tint consumes. Any future
   "put a themed accent on a tinted surface" will hit this identically — the general rule is: a token
   tuned against `--vms-surface` has **no guaranteed headroom against a TINT of that surface**, and
   must be re-measured, not assumed.
2. **`--vms-accent` vs `--vms-bg` is at 3.02:1 on light-green and 3.12:1 on light-amber** — passing,
   but with almost nothing to spare. Out of scope here (pre-existing, and the fixed gate does not
   check accent at all), but it is a latent trap for any future tinted surface. **Worth a look in a
   later phase; not a blocker for 5.2.0.**
3. **21-06's provisional chip numbers were correct** (13.60 / 10.63) and its "21-09 inherits headroom,
   not a corner" framing held **for the text pair**. It did not consider the *focus ring* against the
   fill — which is where the actual failure was. Noted so the next reader does not conclude 21-06 was
   wrong; it was right about what it measured.
4. **The plan's own verification snippet (`grep … demo/LookupVerification-bun/…`) assumes repo-root
   cwd** and silently prints nothing if run from inside the demo dir. Passed from the root.

## Threat Flags

None. The verification page adds no auth path, no schema change, and no persistent storage; it serves
a static in-memory directory read-only and binds a local port on the tailnet.

- **T-21-31** (shim accepting a tree the real server rejects) — **mitigated and mutation-verified**:
  the shipped validators run on both paths; a duplicate action name prevents startup.
- **T-21-32** (signing off on a stale bundle) — mitigated: `npm run build` re-run before serving; the
  served bundle was confirmed over the wire to contain the new lookup renderer and the served CSS to
  contain the ring fix.
- **T-21-33** (unreadable chips on some theme) — **mitigated, and it caught a real failure**: all 13
  hand-measured and recorded; the ring fixed with no per-theme deepening.
- **T-21-34** (publishing on a red/unreviewed tree) — mitigated: all seven suite groups green and
  **re-run after the CSS change**; Task 4 blocks 21-10.

## Known Stubs

None.

## Self-Check: PASSED

- `demo/LookupVerification-bun/server.ts` — FOUND (`validateActionNames`, `validateSectionAction`, `lookup-multiple`, `allowCustom`)
- `demo/LookupVerification-bun/index.html` — FOUND (`name="viewmodel-shell"` meta, 13-theme picker)
- `demo/LookupVerification-bun/src/main.ts` — FOUND
- `viewmodel-shell/styles/default.css` — FOUND (`--_chip-tone` focus ring)
- commit `12814f1` — FOUND
- commit `7cd293d` — FOUND
- `http://100.113.23.63:3012/` — 200 over the tailnet IP, all assets

## Task 4 — Ashley's sign-off: ⏸ PENDING

**The blocking checkpoint. 21-10's publish does NOT proceed until this is recorded.** Sign-off and any
flagged items get appended here on her response.
