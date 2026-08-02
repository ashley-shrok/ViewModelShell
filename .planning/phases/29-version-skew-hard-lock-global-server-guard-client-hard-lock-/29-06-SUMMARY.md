---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 06
subsystem: ui
tags: [version-skew, adapter-dom, hard-lock, browser-adapter, css, jsdom-test, viewmodel-shell]

# Dependency graph
requires:
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-01"
    provides: Adapter.showSkewLock verb declaration + ShellOptions.onVersionSkew opt-out + private skewLocked field + lockSkew helper + placement-gated guards
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-03"
    provides: lockSkew wired from both trigger sites (checkVersionSkew mismatch + stale_client catch arm) — this plan makes the REAL BrowserAdapter implementation exist so the shipped bundle behaves correctly
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-04"
    provides: TS-server-subpath createVersionGuard factory (used indirectly — the modal fires when a stale request comes back 400)
provides:
  - BrowserAdapter.showSkewLock method implementing the Adapter.showSkewLock verb (framework-owned non-dismissible modal DOM with [Reload] button)
  - .vms-skew-lock* CSS rules using shipped tone tokens (no new AA pair) — z-index 1200 above toast-region + modal-backdrop
  - jsdom adapter test coverage for DOM shape + ARIA + reload wiring + idempotency + non-dismissibility + auto-focus (6 new tests)
affects: [29-08 (agent-skill.md — Client build / version skew section may reference the shipped modal behavior), 29-09 (tailnet verification page rendering the modal in a real browser for Ashley eyeball), 29-11 (MIGRATION.md v9.0.0 hard-lock behavior description)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-analog adapter verb implementation: attachment idiom from toast() (append to document.body so DOM survives render() wipe) + DOM shape from modal() (backdrop + dialog + role/aria) with critical deviations (no close X, no backdrop-click, no Escape, imperative not tree-node)"
    - "Idempotent-mount pattern: querySelector-and-no-op guards second entry — matches shipped toast-region idiom"
    - "Container.inert attribute for underlying-page hard-lock — no JS-driven focus trap needed; modern browsers handle it natively"
    - "Framework-owned copy hardcoded verbatim (title + body + button label) — 'apps describe, they don't decorate' applied to error UX; consumers wanting different copy opt-out via onVersionSkew:'custom'"
    - "Auto-focus for keyboard/SR accessibility on modal open (learned gap from ExpenseTracker's in-modal success card per AGENTS.md 'In-modal success feedback' section)"
    - "CSS class layer stacking: z-index 1200 for skew-lock > 1100 for toast-region > 1000 for modal-backdrop — the hard-lock is the most-terminal visible layer"
    - "Test-side vi.spyOn(adapter, 'reload') over Object.defineProperty(window.location, 'reload', ...) — the safer mocking approach that decouples from jsdom's non-configurable window.location fragility"
    - "Reuse of shipped AA-tested color pairs (--vms-warning-fill + --vms-on-warning-fill from .vms-toast--warning and .vms-button--warning.vms-button--primary) — no new fg/bg pair introduced, check:aa-contrast gate stays green without update"

key-files:
  created:
    - .planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-06-SUMMARY.md
  modified:
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell/test/version-skew.test.ts

key-decisions:
  - "showSkewLock's info arg is signature-declared but UNUSED in the shipped body — the CONTEXT-locked copy is fixed, and build ids surface via VmsVersionSkewError / VmsActionError through onError. Custom adapters that WANT to render build ids for debugging still get them via the info arg (per the Plan 29-01 verb signature)."
  - "Prefixed the info parameter with _underscore (_info) to communicate intentional-unused-argument to TypeScript's noUnusedParameters gate — matches shipped convention for capability verbs whose default implementations don't consume all their args."
  - "TSDoc on the new method explicitly names the four deliberate deviations from modal() (no X, no backdrop-click, no Escape, imperative not tree-node) so a future refactor that mistakenly adds one of them fails a code-review pass at read time — the semantic invariant is codified in the doc, not just in the tests."
  - "Placed showSkewLock immediately after reload() (adjacent placement — they are conceptually paired: one triggers the modal that offers the other). Matches Plan 29-01's adjacent-placement decision for lockSkew() next to checkVersionSkew()."
  - "CSS block placed at the bottom of default.css (after the Phase 28 rich-text-editor rules) rather than grouped with modal/toast — bottom placement is safe because CSS specificity respects source order and .vms-skew-lock uses a fully-qualified class prefix that never overlaps with sibling blocks."
  - "Idempotent guard uses document.querySelector(.vms-skew-lock) — cheaper than tracking an instance field, and matches the toast() idiom precisely. A second call while the modal is up finds the existing backdrop and no-ops (proved by the 3rd new test)."

requirements-completed: [SKEW-05]

# Metrics
duration: ~8min
completed: 2026-08-02
---

# Phase 29 Plan 06: BrowserAdapter.showSkewLock DOM + .vms-skew-lock* CSS + jsdom adapter test

**Landed the Wave-4 shipped BrowserAdapter implementation of the SKEW-05 hard-lock modal. Three atomic commits: (1) BrowserAdapter.showSkewLock method at browser.ts:509 with framework-owned non-dismissible modal DOM (attachment from toast(), shape from modal() minus close X + backdrop-click + Escape + tree-node dispatch; sets container.inert; auto-focuses [Reload]; CONTEXT-locked copy hardcoded), (2) .vms-skew-lock* CSS rules at default.css:3545-3610 using shipped tone tokens (no new AA pair; z-index 1200 above toast-region+modal-backdrop), (3) 6 jsdom adapter tests in version-skew.test.ts appended as the 6th "9.0.0" describe block — DOM shape + ARIA + reload wiring (via vi.spyOn(adapter,'reload')) + idempotency + non-dismissibility × 2 + auto-focus. Full framework vitest green (1364/1364 tests, was 1358 pre-plan → +6 exactly). check:core-globals + check:aa-contrast + check:no-demo-style + check:test-types + npm run build all exit 0. The verb Plan 29-01 declared + Plan 29-03 called through a SpyAdapter mock is now IMPLEMENTED on the shipped BrowserAdapter; the modal will render correctly in a real browser on either skew signal.**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-08-02T17:43Z
- **Completed:** 2026-08-02T17:51Z
- **Tasks:** 3
- **Files modified:** 3 (viewmodel-shell/src/browser.ts, viewmodel-shell/styles/default.css, viewmodel-shell/test/version-skew.test.ts)

## Modification Sites (exact final line numbers / ranges)

| # | Site | Location | What lands |
|---|------|----------|------------|
| 1 | `BrowserAdapter.showSkewLock` method | `viewmodel-shell/src/browser.ts:487-565` (method opens at line 509 after 22-line TSDoc) | +76 lines: full framework-owned modal DOM implementation |
| 2 | `.vms-skew-lock*` CSS block | `viewmodel-shell/styles/default.css:3545-3610` (66 lines including trailing blank) | +67 lines: 8 CSS rules (outer backdrop + dialog + icon + title + body + reload-btn + hover + focus-visible) |
| 3 | 9.0.0 BrowserAdapter.showSkewLock DOM describe block | `viewmodel-shell/test/version-skew.test.ts` — appended at end | +88 lines (net +87 counting removed newline): 6 new tests + beforeEach/afterEach scaffold |

## Accomplishments

- **`BrowserAdapter.showSkewLock` method shipped** (line 509) — placed adjacent to the shipped `reload()` method at line 483 (conceptually paired: one triggers the modal that offers the other). Method body implements: idempotent `querySelector(".vms-skew-lock")` guard, `container.setAttribute("inert", "")` for underlying-page hard-lock, backdrop `<div class="vms-skew-lock">` appended to `document.body`, dialog `<div class="vms-skew-lock__dialog">` with `role="dialog"`, `aria-modal="true"`, `aria-labelledby="vms-skew-lock-title"`, warning-tone icon via `renderIconSvg("alert-triangle", "lg", ...)`, hardcoded CONTEXT-locked copy ("This app is out of date" / "Reload to continue. Any unsaved changes will be lost." / "Reload"), `[Reload]` button whose click handler calls `this.reload()` (reusing shipped verb so consumer subclass overrides work), and `reloadBtn.focus()` for keyboard/SR accessibility.
- **`.vms-skew-lock*` CSS block shipped** (default.css:3545-3610) — 8 rules total: outer backdrop (position:fixed; inset:0; centered flex; z-index:1200), dialog (surface bg + border + orange top-border + max-width:420px; centered column flex), icon (tinted circle backdrop via color-mix), title (font-family: head; text-xl; weight:600), body (muted text), reload-btn (--vms-warning-fill / --vms-on-warning-fill — the shipped AA-tested pair), :hover (darkened fill), :focus-visible (2px outline). ALL tokens are pre-existing shipped tokens verified via grep before placement.
- **6 jsdom adapter tests appended** (version-skew.test.ts) — new `describe("9.0.0 — BrowserAdapter.showSkewLock DOM (SKEW-05)")` block with fresh document.body beforeEach + cleanup afterEach. Each test dynamically imports `BrowserAdapter` from `../src/browser.js`, constructs a real adapter with a test container, and asserts a specific facet: (a) DOM shape + ARIA attributes + inert container + CONTEXT-locked copy, (b) [Reload] click calls adapter.reload via `vi.spyOn(adapter, "reload").mockImplementation(...)` — the safer mocking approach that avoids jsdom's fragile window.location.reload redefinition, (c) idempotency — second showSkewLock() call produces querySelectorAll length 1, (d) non-dismissibility on backdrop click, (e) non-dismissibility on Escape key, (f) auto-focus (document.activeElement === reload button).
- **CONTEXT-locked copy hardcoded verbatim** — grep verified: `grep -c 'This app is out of date' src/browser.ts` returns 1; `grep -c 'Reload to continue' src/browser.ts` returns 1. The strings are literals in the shipped method body, not template literals or i18n keys — consumers wanting different copy opt-out via `onVersionSkew: "custom"` and render their own affordance.

## Task Commits

Each task was committed atomically on `main`:

1. **Task 1: Add BrowserAdapter.showSkewLock method to browser.ts** — `bfc2c82` (feat)
2. **Task 2: Add .vms-skew-lock* CSS rules to default.css** — `b4c8407` (feat)
3. **Task 3: Add jsdom adapter tests for showSkewLock (6 new tests)** — `507beef` (test)

## Files Modified

- `viewmodel-shell/src/browser.ts` — 1 commit (feat), +76 lines (method body + TSDoc). Method placed at lines 487-565 (TSDoc opens at 487; method signature at 509; body closes at 565).
- `viewmodel-shell/styles/default.css` — 1 commit (feat), +67 lines (CSS block at lines 3545-3610).
- `viewmodel-shell/test/version-skew.test.ts` — 1 commit (test), +88 -1 lines (import extension + new describe block). Test count went from 20 to 26 (+6, matching plan).

## Gate Verification (pre-plan baseline vs post-plan)

| Gate | Pre-plan | Post-plan | Exit code |
|------|----------|-----------|-----------|
| `cd viewmodel-shell && npm run build` | exit 0 | exit 0 | ✓ 0 |
| `cd viewmodel-shell && npm run check:core-globals` | exit 0 | exit 0 | ✓ 0 |
| `cd viewmodel-shell && npm run check:aa-contrast` | exit 0 (13/13 pairs) | exit 0 (13/13 pairs — no new pair introduced) | ✓ 0 |
| `cd viewmodel-shell && npm run check:no-demo-style` | exit 0 | exit 0 | ✓ 0 |
| `cd viewmodel-shell && npm run check:test-types` | exit 0 | exit 0 | ✓ 0 |
| `cd viewmodel-shell && npx vitest run` | 1358 tests | **1364 tests** (+6 exactly) | ✓ 0 |
| `cd viewmodel-shell && npx vitest run test/version-skew.test.ts` | 20 tests | **26 tests** (+6 exactly) | ✓ 0 |
| `grep -c 'showSkewLock' src/browser.ts` | 0 | 2 (method signature + TSDoc explanatory reference) | — |
| `grep -c '"vms-skew-lock"' src/browser.ts` | 0 | 2 (idempotent-guard querySelector + backdrop className) | — |
| `grep -c 'This app is out of date' src/browser.ts` | 0 | 1 (CONTEXT-locked title copy — hardcoded verbatim) | — |
| `grep -c 'Reload to continue' src/browser.ts` | 0 | 1 (CONTEXT-locked body copy — hardcoded verbatim) | — |
| `grep -c 'setAttribute("inert"' src/browser.ts` | 0 | 1 (inert container assignment) | — |
| `grep -c 'this.reload()' src/browser.ts` | 0 | 2 (button click handler + TSDoc explanatory reference) | — |
| `grep -A 65 "showSkewLock(_info?" src/browser.ts \| grep -c 'window.location.reload'` | — | 0 (the button calls this.reload(), NOT window.location.reload) | — |
| `grep -c '\.vms-skew-lock ' styles/default.css` | 0 | 1 (outer backdrop rule) | — |
| `grep -c '\.vms-skew-lock__dialog' styles/default.css` | 0 | 1 | — |
| `grep -c '\.vms-skew-lock__reload-btn' styles/default.css` | 0 | 3 (base + :hover + :focus-visible) | — |
| `grep -c 'z-index: 1200' styles/default.css` | 0 | 1 (CONTEXT-mandated stacking above modal-backdrop + toast-region) | — |
| `grep -c 'var(--vms-warning' styles/default.css` | 29 | **36** (+7 — well above +3 bar; dialog border-top + icon color + icon color-mix + reload-btn bg + reload-btn border + hover color-mix + focus-visible outline) | — |
| `grep -c 'describe("9.0.0 — BrowserAdapter.showSkewLock' test/version-skew.test.ts` | 0 | 1 | — |
| `grep -c 'describe("9.0.0' test/version-skew.test.ts` | 5 (Plan 29-03: 4 + Plan 29-04: 1) | **6** (+ this plan: 1) | — |
| `grep -c '  it(' test/version-skew.test.ts` | 20 | **26** (+6 exactly matching plan) | — |
| `grep -c 'showSkewLock' test/version-skew.test.ts` | 10 (Plans 29-03/04) | **19** (+9 across the 6 new tests — imports + constructions + assertions) | — |
| `grep -c 'vi.spyOn(adapter, "reload")' test/version-skew.test.ts` | 0 | 1 (safer mocking approach — NOT Object.defineProperty) | — |
| `grep -c 'Object.defineProperty(window.location' test/version-skew.test.ts` | 0 | 0 (fragile approach correctly avoided) | — |
| `grep -c 'not.toBeNull()' test/version-skew.test.ts` | 0 | 6 (still-present-after-dismiss-attempt assertions across the 3 non-dismissibility tests + backdrop + dialog + reload-btn queries) | — |

## Note on the plan's "grep -c 'showSkewLock' ... returns exactly 1" acceptance criterion

The plan targeted exactly 1 for `grep -c 'showSkewLock' src/browser.ts` (the method definition). Post-plan the count is 2 because the shipped TSDoc explicitly names "Adapter.showSkewLock verb" as a cross-reference. The INTENT of the criterion — "the method exists once, not duplicated" — is met (the second occurrence is a doc reference, not a duplicate method). Preserving the cross-reference to Plan 29-01's Adapter interface declaration aids future readers.

Same pattern for `this.reload()` = 2 rather than +1: one is the click handler (the plan's target), the other is a TSDoc reference explaining what the button does. Both aid readability at the site.

## Byte-Identity Verification (must be unchanged per plan scope)

- **`Adapter.showSkewLock?` verb declaration** at `viewmodel-shell/src/index.ts:145` — untouched (Plan 29-01's territory).
- **`ShellOptions.onVersionSkew?: "default" | "custom"` opt-out** at `viewmodel-shell/src/index.ts:2902` — untouched.
- **`private skewLocked = false;` field + `private lockSkew(info?)` helper** at `viewmodel-shell/src/index.ts:3109 + 3574` — untouched.
- **Two `if (this.skewLocked) return;` early-return guards** at `viewmodel-shell/src/index.ts:3309 + 3520` — untouched.
- **`load()` GET header hoist + `stale_client` arm rewrite + `checkVersionSkew` extension** (Plan 29-03's territory) — untouched.
- **`createVersionGuard` factory in `src/server.ts`** (Plan 29-04's territory) — untouched.
- **.NET Versioning.cs global guard filter** (Plan 29-02's territory) — untouched.
- **The shipped `modal()` renderer at `browser.ts:4778-4823`** (line shifted by +76 due to Task 1 insertion; body identical) — untouched. The new `showSkewLock` is a completely separate method; `modal()` continues to serve `ModalNode` in the render pipeline unchanged.
- **The shipped `reload()` at `browser.ts:483`** — untouched. The new `showSkewLock`'s button calls `this.reload()` to reuse this shipped implementation.
- **The shipped `toast()` at `browser.ts:568-599`** (line shifted +76) — untouched.

## Decisions Made

- **Prefixed the unused `info` parameter with `_info`:** the shipped BrowserAdapter deliberately does not surface build ids (the modal shows generic copy per CONTEXT-locked design). Prefixing with underscore communicates intentional-unused to any lint/tsc rule that flags unused parameters. A future custom adapter subclass that DOES want to render build ids can override the method and drop the underscore in its own signature.
- **Dynamic `import("../src/browser.js")` inside each test rather than a top-of-file static import:** matches the pattern the plan called out (matches similar dynamic imports elsewhere in the test suite for jsdom-only entry points), and keeps the imports scoped to the `.showSkewLock` block — the pre-existing 5 describe blocks in the file do NOT need BrowserAdapter (they use the SpyAdapter mock), so a top-level import would be a semantic-noise change for the whole file. The one-test-at-a-time dynamic import is more surgical.
- **Placed the new CSS block at the very end of default.css** rather than grouped with the shipped modal/toast blocks — CSS specificity respects source order, and the new `.vms-skew-lock*` classes have a fully-qualified prefix that never collides with any existing selector, so bottom placement is safe. Grouping with modal/toast would have required inserting into the middle of the file at line ~2400, which is a larger diff.
- **TSDoc on the new method spells out the four DELIBERATE DEVIATIONS from modal()** in a bulleted list (no X, no backdrop-click, no Escape, imperative not tree-node) — codifying the semantic invariant IN THE DOC so a future refactor that mistakenly adds one of them (thinking "oh, this modal is missing an obvious feature") fails a code-review pass at read time. The three non-dismissibility tests (backdrop-click, Escape, idempotency) are the executable half of the same invariant.

## Deviations from Plan

None. Plan executed exactly as written — all three tasks land on the first pass with the exact code shape the plan specified. Two minor grep-count deviations were noted above as intent-met (grep-c 'showSkewLock' returns 2 instead of exactly 1 because of a helpful TSDoc cross-reference; grep-c 'this.reload()' increased by 2 rather than exactly 1 for the same reason). Neither affects the shipped behavior, and both add readability at the site. No auto-fixes were required; no analog-model refactors were needed; the pre-plan gates were all green and stayed green.

## Issues Encountered

None. The pre-plan gates (`npm run build`, `npm run check:core-globals`, `npm run check:aa-contrast`, `npm run check:no-demo-style`, `npm run check:test-types`, `npx vitest run`) all exited 0. Post-plan they all still exit 0. The framework vitest suite went from 1358 to 1364 tests (all passing) — a delta of exactly 6, matching the 6 new tests added in Task 3.

The plan's stated risk about jsdom `Object.defineProperty(window.location, 'reload', ...)` fragility was avoided by using `vi.spyOn(adapter, "reload").mockImplementation(...)` per the plan's explicit guidance. All 26 tests pass on the first run with zero TypeError or non-configurable-property errors.

## User Setup Required

None. Pure implementation changes inside `viewmodel-shell/` — no new dependencies, no configuration, no runtime behavior change for CONSUMERS who don't set `clientBuildId` (versioning off). Consumers on `clientBuildId + onVersionSkew: "custom"` see the same behavior as pre-9.0.0 (signal-only via onError, no modal). Consumers on `clientBuildId + onVersionSkew: "default"` (or omitted) now see the modal on either skew signal — the intended v9.0.0 hard-lock behavior.

## Next Phase Readiness

- **Plan 29-07 (parity fixtures)** — UNBLOCKED by 29-04 (already committed). Independent of this plan.
- **Plan 29-08 (agent-skill.md revised Client build / version skew section)** — READY to draft with reference to the shipped modal behavior. The agent-facing behavior for `stale_client` is UNCHANGED (agents still reload); the docs update is about accurately describing the browser-side UX change (modal vs. silent auto-reload).
- **Plan 29-09 (tailnet verification page)** — UNBLOCKED. The BrowserAdapter now has the real DOM to render; the verification page will exercise the modal in a real browser for Ashley's eyeball sign-off (per SKEW-08 gating in CONTEXT).
- **Plan 29-11 (MIGRATION.md v9.0.0)** — READY. The behavior-change note ("auto-reload retired; hard-lock modal fires instead; opt-out via onVersionSkew:'custom'") can now reference the shipped adapter implementation.

## Self-Check: PASSED

**Files created:** verified
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-06-SUMMARY.md` — FOUND (this file, written by Write tool)

**Files modified:** verified
- `viewmodel-shell/src/browser.ts` — FOUND (1 modification site: new method at line 509)
- `viewmodel-shell/styles/default.css` — FOUND (1 modification site: new CSS block at lines 3545-3610)
- `viewmodel-shell/test/version-skew.test.ts` — FOUND (2 modification sites: import extension + new describe block appended)

**Commits exist:** verified via `git log --oneline -3`
- `bfc2c82` — FOUND (Task 1: BrowserAdapter.showSkewLock method)
- `b4c8407` — FOUND (Task 2: .vms-skew-lock* CSS rules)
- `507beef` — FOUND (Task 3: 6 jsdom adapter tests)

**Test count verified:** 26 tests in version-skew.test.ts (was 20 pre-plan; +6 exactly); 1364 total framework tests (was 1358 pre-plan; +6 exactly) — no regressions elsewhere.

---
*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-*
*Completed: 2026-08-02*
