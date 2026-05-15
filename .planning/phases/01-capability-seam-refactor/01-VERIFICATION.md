---
phase: 01-capability-seam-refactor
verified: 2026-05-15T09:05:00Z
status: passed
score: 13/13 must-haves verified
overrides_applied: 0
---

# Phase 1: Capability Seam Refactor Verification Report

**Phase Goal:** Core src/index.ts references zero platform globals; all browser bindings live behind a generic capability seam in BrowserAdapter; the invariant is CI-enforced and documented
**Verified:** 2026-05-15T09:05:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

All four ROADMAP success criteria and all PLAN-frontmatter must-haves were verified by **executing the actual commands** (build, guard, negative-control, vitest, grep counts, full parity suite) against the current codebase — not by trusting SUMMARY.md claims. Every SUMMARY claim that mattered was independently reproduced with a passing command.

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Core `src/index.ts` references zero of {window, document, localStorage, sessionStorage, XMLHttpRequest} | ✓ VERIFIED | Grep `\b(window\|document\|localStorage\|sessionStorage\|XMLHttpRequest)\b` on `viewmodel-shell/src/index.ts` → **No matches found**. Full-file read confirms even the doc comments were rephrased (line 11 "references zero platform globals"; line 21 "the browser adapter sets the page location"; line 218 onRedirect comment "falls back to adapter.navigate(url)"). |
| 2  | Capability seam is OPTIONAL methods on the existing `Adapter` interface (navigate?/storage?/transport?) | ✓ VERIFIED | `index.ts:19-37`: `Adapter` has required `render` plus `navigate?(url: string): void`, `storage?(scope: "local" \| "session", key: string, value: string): void`, `transport?(input, init, hooks?): Promise<Response>`. All three optional — confirmed by `tsc` building green against `BrowserAdapter` (D-01). |
| 3  | `BrowserAdapter` implements navigate/storage/transport; relocated bindings live in `browser.ts` not core | ✓ VERIFIED | `browser.ts:61-63` `navigate` → `window.location.href = url`; `browser.ts:65-68` `storage` → `sessionStorage`/`localStorage` `.setItem`; `browser.ts:70-77` `transport` → `fetch` passthrough. Verbatim relocation (D-03). |
| 4  | `await fetch(` still present ≥2× in index.ts (D-07: fetch stays in core) | ✓ VERIFIED | Grep `await fetch(` on `index.ts` → **2 occurrences** (`load()` line 259, `dispatch()` line 297). transport NOT wired into request path. |
| 5  | `ShellOptions.onRedirect?: (url: string) => void` signature unchanged (no breaking change, D-04) | ✓ VERIFIED | `index.ts:219` exactly `onRedirect?: (url: string) => void;` — byte-identical. |
| 6  | Redirect resolution order = explicit onRedirect → adapter.navigate → loud error (D-05) | ✓ VERIFIED | `index.ts:348-356` `processResponse()`: `if (this.options.onRedirect)` → `else if (adapter.navigate)` → `else this.failCapability("navigate", …)`. Order is exact; precedence (onRedirect first) verified by vitest Case C. |
| 7  | Missing navigate/storage fails loud (surfaces Error via onError/console.error), never silent no-op (D-06) | ✓ VERIFIED | `index.ts:326-335` `failCapability()` builds an Error (message contains the word `security`) routed via `this.options.onError ? onError(err) : console.error(...)`. vitest Case D proves both storage-missing and navigate-missing surface an Error AND nothing is written. |
| 8  | `cd viewmodel-shell && npm run build` exits 0 (tsc, noEmitOnError) | ✓ VERIFIED | Executed: `BUILD_EXIT=0`. |
| 9  | Guard exists, denylist = exactly the 5 tokens, scoped to `src/index.ts` ONLY, exits 0 on clean core | ✓ VERIFIED | `scripts/check-core-platform-globals.mjs`: `DENYLIST = ["window","document","localStorage","sessionStorage","XMLHttpRequest"]`, `TARGET = resolve(__dirname, "../src/index.ts")` (not server.ts/browser.ts). Executed `npm run check:core-globals` → **exit 0**, prints "references zero platform globals". |
| 10 | Guard fails non-zero when a denylisted token is reintroduced into src/index.ts (negative control) | ✓ VERIFIED | Executed: appended `const _x = window;` → guard **exit 1**, reported `src/index.ts:375 [window]`; `git checkout` restored → guard back to **exit 0**. Genuine enforcement, not hope. |
| 11 | A NEW guard+adapter-test step exists in the EXISTING parity.yml (no new workflow file) | ✓ VERIFIED | `Glob .github/workflows/*` → only `parity.yml`. `parity.yml:31-39` adds `Enforce core platform-agnosticism (AGNOSTIC-03)` (runs `npm run check:core-globals`) and `Framework adapter-seam tests (D-12.2 relocation proof)` (`npx vitest run`) inside the existing `parity` job, before the unchanged `Run cross-backend parity tests` step (line 64-65). |
| 12 | Net-new jsdom/vitest adapter test proves the relocation fires; `npx vitest run` exits 0 | ✓ VERIFIED | `test/adapter-seam.test.ts` + `vitest.config.ts` (`environment: "jsdom"`) exist. Executed `npx vitest run` → **5/5 passed, exit 0**: Case A (storage writes to real jsdom local/session), Case B (adapter.navigate fires on onRedirect-absent path), Case C (onRedirect precedence, navigate spy NOT called), Case D ×2 (fail-loud storage + navigate). |
| 13 | AGENTS.md + README.md document the seam pattern AND the CI-enforced invariant; additive only | ✓ VERIFIED | Docs presence check exits 0. AGENTS.md `### The capability seam` (verbs, optional shape, resolution order with `(url: string) => void`, fail-loud rule + `hecate_jwt` rationale, Enforcement naming `check:core-globals`) + augmented invariant + evolution-conventions bullet. README.md `### Capability seam (platform-agnostic core)` (zero globals, CI-enforced, non-breaking, onRedirect unchanged). `git diff 07fcdd0 HEAD -- AGENTS.md README.md` is **purely additive** (zero deletions of behavioral/wire docs); original "core never references HTMLElement, document, or any platform type" assertion preserved verbatim and augmented. |

**Score:** 13/13 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `viewmodel-shell/src/index.ts` | Extended Adapter iface + processResponse seam routing + failCapability; zero platform globals | ✓ VERIFIED | Exists, substantive (374 lines), wired (imported by browser.ts/test); zero denylist tokens; D-04/D-05/D-06/D-07 all honored. |
| `viewmodel-shell/src/browser.ts` | BrowserAdapter.navigate/storage/transport implementations | ✓ VERIFIED | Exists, substantive (587 lines), `implements Adapter`; verbatim relocated bindings present; no `XMLHttpRequest` (Phase 2). |
| `viewmodel-shell/scripts/check-core-platform-globals.mjs` | Standalone grep guard scoped to src/index.ts | ✓ VERIFIED | Exists; 5-token denylist; targets `../src/index.ts`; runnable via npm script; negative control proven. |
| `viewmodel-shell/package.json` | check:core-globals + test scripts; vitest/jsdom devDeps | ✓ VERIFIED | `check:core-globals` and `test` scripts present and executed successfully; vitest@^2.1.4 + jsdom@^25.0.1 resolved (run used vitest 2.1.9). |
| `viewmodel-shell/vitest.config.ts` | jsdom environment | ✓ VERIFIED | Exists; `environment: "jsdom"`, `include: ["test/**/*.test.ts"]`. |
| `viewmodel-shell/test/adapter-seam.test.ts` | D-12.2 relocation proof (navigate/onRedirect-precedence/storage/fail-loud) | ✓ VERIFIED | Exists; 5 tests, all green; imports local source via `.js` NodeNext specifiers; feeds responses through `ViewModelShell.push()`. |
| `.github/workflows/parity.yml` | New guard + adapter-test gating steps, no new workflow file | ✓ VERIFIED | Exists; two new steps in existing `parity` job; `Glob .github/workflows/*` returns only this file. |
| `AGENTS.md` | Capability-seam pattern + enforced-invariant documentation | ✓ VERIFIED | Additive `### The capability seam` section + augmented invariant + conventions bullet. |
| `README.md` | Public-facing seam + CI-enforced-invariant documentation | ✓ VERIFIED | Additive `### Capability seam (platform-agnostic core)` section with non-breaking reassurance. |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| `index.ts processResponse()` | `adapter.storage` | side-effect loop delegates set-local/session-storage | ✓ WIRED | `index.ts:341,344` `adapter.storage("local"\|"session", ...)`; vitest Case A proves real jsdom storage written. |
| `index.ts processResponse()` | `adapter.navigate` | redirect branch fallback from onRedirect | ✓ WIRED | `index.ts:352` `adapter.navigate(body.redirect)`; vitest Case B proves spy fires. |
| `browser.ts BrowserAdapter.navigate` | `window.location.href` | relocated browser binding | ✓ WIRED | `browser.ts:62` `window.location.href = url`. |
| `parity.yml` | `check-core-platform-globals.mjs` | new workflow step `npm run check:core-globals` | ✓ WIRED | `parity.yml:36` invokes it inside the gating `parity` job. |
| `adapter-seam.test.ts` | `ViewModelShell.processResponse via push()` | feed {redirect}/{sideEffects}, assert binding fired | ✓ WIRED | `push(` used in all 5 tests; assertions verify binding executes. |

### Data-Flow Trace (Level 4)

Not applicable as a dynamic-data-rendering trace — this phase produces a framework refactor and tooling, not a data-rendering UI. The equivalent data-flow proof is the dual verification gate: the adapter test traces a wire response through `push() → processResponse() → adapter.{storage,navigate}` and asserts the real jsdom side-effect (storage written / navigate spy fired), and parity traces the full wire contract through both backends. Both executed and green (see Behavioral Spot-Checks).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Core build is green | `cd viewmodel-shell && npm run build` | exit 0 | ✓ PASS |
| Guard passes on clean core | `npm run check:core-globals` | exit 0, "references zero platform globals" | ✓ PASS |
| Guard fails on reintroduced token | append `const _x = window;`, run guard, restore | exit 1, `src/index.ts:375 [window]`, then exit 0 after restore | ✓ PASS |
| Adapter-seam relocation proof | `npx vitest run` | 5/5 passed, exit 0 | ✓ PASS |
| Zero observable behavior change (wire contract) | clean state → `cd parity && bun run run.ts` | **✓ Parity tests passed, exit 0** — all 7 fixtures agree incl. `feature-probe` (dotnet+bun+node, 14 steps) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| AGNOSTIC-01 | 01-01, 01-02 | Core references zero platform globals; generic capability seam delegates navigate/storage/transport like render() | ✓ SATISFIED | Truths 1,2,3,4,5; seam is optional methods on Adapter; vitest proves delegation fires. |
| AGNOSTIC-02 | 01-01, 01-02 | Browser bindings relocated out of core into BrowserAdapter, zero observable behavior change | ✓ SATISFIED | Truths 3,6,7; verbatim relocation; parity 7/7 green proves zero wire-contract change; vitest proves relocation fires (D-13 gap closed). |
| AGNOSTIC-03 | 01-02 | CI guard fails build if core references a platform global | ✓ SATISFIED | Truths 9,10,11; guard + negative control + parity.yml gating step all executed/verified. |
| AGNOSTIC-04 | 01-03 | AGENTS.md + README document the seam pattern and CI-enforced invariant, ship with phase | ✓ SATISFIED | Truth 13; both files documented additively; docs presence check exit 0; original invariant augmented not deleted. |

No orphaned requirements: REQUIREMENTS.md maps exactly AGNOSTIC-01..04 to Phase 1; every ID is claimed by a plan and verified. UPLOAD-01 / MIGRATE-01 are correctly Phase 2 (not in scope).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| `scripts/check-core-platform-globals.mjs` | 17-26 | Guard matches raw source incl. comments/string literals (WR-01) | ℹ️ Info | Robustness/maintainability only — guard still correctly catches real violations (negative control proven) and does NOT false-positive on the current clean core. Advisory hardening, not a goal failure. |
| `test/adapter-seam.test.ts` | 35-150 | No combined sideEffects+redirect test; no "onRedirect + render-only adapter" test (WR-02) | ℹ️ Info | Test-coverage gap, not a behavior regression. The 5 existing tests cover all primary branches; processResponse code is correct. Advisory hardening. |
| `src/browser.ts` | 70-77 | `BrowserAdapter.transport` omits `hooks?` param (IN-01) | ℹ️ Info | Structurally type-compatible (tsc green); intentional Phase-1 shape. Cosmetic. |
| `src/index.ts` | 339-347 | side-effect with null `key` silently skipped (IN-04) | ℹ️ Info | Pre-existing, behavior-preserving, forward-compat; not introduced by this refactor. Out of phase scope. |

No 🛑 Blocker or ⚠️ Warning anti-patterns. The advisory REVIEW findings (WR-01, WR-02, IN-01..04) are recorded as known non-blocking robustness/hardening opportunities; none prevents the phase goal.

### Human Verification Required

None. The behavioral gate (parity suite) is fully automated and was executed locally to a green exit 0 (all 7 fixtures including the feature-probe redirect + set-storage fixture), and is additionally CI-enforced unconditionally on ubuntu-latest. The relocation-fires gap that parity cannot cover (D-13) is closed by the executed jsdom adapter test. No visual/UX/real-time/external-service behavior is in scope for this architecture refactor.

### Parity Execution Status (honest note)

The full cross-backend parity suite **was executed locally and passed (exit 0, "✓ Parity tests passed", all 7 fixtures `✓ all backends agree` including `feature-probe` across dotnet+bun+node)** from a clean process state. Consistent with the SUMMARY's documented honesty: on Windows the harness is intermittently flaky between consecutive runs (stale detached `dotnet run` backends hold mandatory file locks → `EBUSY` on the helpdesk SQLite DB on the *next* run's cleanup). This was reproduced and resolved exactly as documented (kill stale processes + `dotnet build-server shutdown` + remove locked `*parity*.db*`, then the suite runs clean). This is a **pre-existing Windows-only harness process-lifecycle limitation, not a wire-contract regression and not caused by this phase** (the phase adds zero parity/backend/.NET code). CI runs parity unconditionally on Linux where this class of flakiness does not occur. The behavioral gate is satisfied.

### Gaps Summary

No gaps. The phase goal is fully achieved and verified by execution:

- **Core is clean (AGNOSTIC-01/02):** `src/index.ts` has zero of the 5 platform globals (grep confirmed); the seam is optional methods on the existing `Adapter`; bindings are verbatim-relocated into `BrowserAdapter`; `onRedirect` signature is byte-identical; resolution order is onRedirect → adapter.navigate → loud error; missing capability fails loud (never silent). `await fetch(` remains ×2 in core (D-07 honored).
- **Invariant is CI-enforced (AGNOSTIC-03):** the standalone grep guard exists, is scoped to `src/index.ts` only, exits 0 on clean core and **exit 1 with correct token/line on a reintroduced token (negative control executed and restored)**; it is a gating step in the existing `parity.yml` (no new workflow file); the net-new jsdom adapter test (5/5 green) proves the relocation actually fires (closing the D-13 parity-insufficiency gap).
- **Documented (AGNOSTIC-04):** AGENTS.md and README.md document the seam pattern and the CI-enforced invariant additively (zero behavioral/wire doc deletions; original invariant claim augmented, not removed).
- **Zero observable behavior change:** the full 7-fixture parity suite (incl. feature-probe) is 100% green, exit 0.

The advisory code-review findings (WR-01 guard comment/string false-positive class; WR-02 missing combined-sideEffects+redirect and onRedirect+render-only regression tests; IN-01..04) are recorded as non-blocking hardening opportunities for a future pass — they do not fail the phase goal.

---

_Verified: 2026-05-15T09:05:00Z_
_Verifier: Claude (gsd-verifier)_
