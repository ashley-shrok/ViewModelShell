---
phase: 01-capability-seam-refactor
fixed_at: 2026-05-15T09:05:00Z
review_path: .planning/phases/01-capability-seam-refactor/01-REVIEW.md
iteration: 1
findings_in_scope: 2
fixed: 2
skipped: 0
status: all_fixed
---

# Phase 1: Code Review Fix Report

**Fixed at:** 2026-05-15T09:05:00Z
**Source review:** .planning/phases/01-capability-seam-refactor/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 2 (WR-01, WR-02 — Critical+Warning; Info IN-01..04 out of scope this pass)
- Fixed: 2
- Skipped: 0

## Fixed Issues

### WR-01: Guard false-positives on the 5 tokens when they appear in comments or string literals

**Files modified:** `viewmodel-shell/scripts/check-core-platform-globals.mjs`, `AGENTS.md`
**Commit:** 168d596
**Applied fix:**

Made the AGNOSTIC-03 guard strip comments and string/template literals before the
denylist scan, so a legitimate doc comment or string in `src/index.ts` naming one of
the 5 tokens no longer hard-fails CI, while a real code reference still fails the build.

Implementation (lightweight, no parser dependency — per D-08):
- Block comments `/* */` → blanked, preserving newlines (keeps line numbers accurate).
- Line comments `//...` → removed.
- String/template literals (`'`/`"`/`` ` ``, with escape handling, non-greedy,
  `[\s\S]` so multi-char/multi-line template literals are fully consumed) → blanked,
  preserving newlines.
- The denylist regex now scans the STRIPPED lines, but the violation report prints the
  ORIGINAL source line text so real-violation error messages stay readable.
- Scope unchanged: `src/index.ts` only. Denylist unchanged: exactly the 5 tokens.
- Added a documentation note to AGENTS.md §Enforcement stating the guard scans code
  only (comments/strings naming a token are allowed; only a real code reference fails).

**Proof of BOTH directions (by execution):**

- **Direction 1 — no false-positive:** Temporarily appended to a copy of `src/index.ts`
  a doc comment AND a string literal each naming all 5 tokens
  (`// ...window/localStorage/sessionStorage...document and XMLHttpRequest...` and
  `const _docStr = "...window document localStorage sessionStorage XMLHttpRequest";`).
  `npm run check:core-globals` → **exit 0** ("references zero platform globals").
  Reverted; no test scaffolding committed.
- **Direction 2 — real violation still caught:** Temporarily appended
  `const _x = window;` to `src/index.ts`. `npm run check:core-globals` → **exit 1**,
  output named the line precisely:
  `src/index.ts:375  [window]  const _x = window;`. Reverted.
- **Final committed state:** clean `src/index.ts` → `npm run check:core-globals`
  **exit 0**. `src/index.ts` was NOT modified by this fix (verified via `git status`/
  `git diff --stat` — only the guard script and AGENTS.md doc note changed).

### WR-02: No adapter test covers `onRedirect` + `adapter.navigate`-absent, and no test asserts side-effect ordering relative to redirect

**Files modified:** `viewmodel-shell/test/adapter-seam.test.ts`
**Commit:** 2e04bca
**Applied fix:**

Added three regression test cases (no production code change — these guard
already-correct behavior, as the review states):

- **Case E — JWT-then-redirect ordering (security path D-06):** Feeds a single
  `push()` response carrying BOTH a `set-local-storage` of `hecate_jwt` AND a
  `redirect: "/app"`. Uses prototype spies on `BrowserAdapter.storage` and
  `.navigate`; the storage spy records order and writes through to real jsdom
  storage, the navigate spy asserts `localStorage.getItem("hecate_jwt") === "tok"`
  AT navigation time. Asserts both the persisted value and the explicit ordering
  `["storage:local:hecate_jwt", "navigate:/app"]` (storage strictly before nav).
- **Case F (success) — onRedirect alone, render-only adapter (SPA-router shape):**
  `onRedirect` set, adapter implements only `render()` (no `navigate`). Asserts
  `onRedirect` is called with the URL and `onError` is NOT called (precedence path:
  `failCapability` never reached, no navigate needed).
- **Case F (floor) — neither onRedirect nor navigate:** With both absent, asserts the
  fail-loud `Error` (message contains "navigate") still surfaces via `onError`,
  explicitly pinning the converse of the precedence path requested in the invariants.

Uses the existing suite's patterns (jsdom, `ViewModelShell.push()`, prototype spies,
`beforeEach` storage clear, `afterEach` `vi.restoreAllMocks`). Existing 5 cases were
NOT weakened or modified.

**Verification (by execution):**

- `npx vitest run` → **8 passed** (5 original unchanged + 3 new), exit 0.
- `npm run build` (`tsc -p tsconfig.json`) → exit 0 (test file type-checks clean).
- `git diff --stat` confirms ONLY `test/adapter-seam.test.ts` changed for this fix;
  `src/index.ts` and `src/browser.ts` untouched (regression guards against current
  implementation, no production change).

## Locked Invariant Confirmation (post-fix, by execution)

All locked phase invariants re-verified after both commits:

- `npm run build` → exit 0.
- `npm run check:core-globals` → exit 0 on clean `src/index.ts`.
- `npx vitest run` → exit 0 (8/8 tests green, including the 3 added for WR-02).
- `src/index.ts` and `src/browser.ts` logic unchanged (no production code modified;
  WR-01 touched only the guard script + AGENTS.md doc note, WR-02 touched only the
  test file). `onRedirect?: (url: string) => void` unchanged; `await fetch(` still
  ≥2× in `src/index.ts`; zero of {window, document, localStorage, sessionStorage,
  XMLHttpRequest} in `src/index.ts`.

No invariant regressed. No findings skipped.

---

_Fixed: 2026-05-15T09:05:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
