---
phase: 01-capability-seam-refactor
plan: 03
subsystem: docs
tags: [documentation, capability-seam, platform-agnostic, agents-md, readme, agnostic-04]

# Dependency graph
requires:
  - phase: 01-capability-seam-refactor (Plan 01-01)
    provides: extended Adapter interface (navigate/storage/transport), processResponse() D-05/D-06 routing, failCapability() fail-loud helper, BrowserAdapter verb implementations
  - phase: 01-capability-seam-refactor (Plan 01-02)
    provides: check:core-globals grep guard (scoped src/index.ts, 5-token denylist), parity.yml gating step, framework-level jsdom adapter test
provides:
  - AGENTS.md "### The capability seam" subsection (verbs, optional-methods shape, redirect resolution order, fail-loud rule, enforcement)
  - AGENTS.md augmented "core never references HTMLElement/document/platform type" invariant — now stated as CI-enforced and scoped to src/index.ts
  - AGENTS.md "Conventions for evolving the framework" enforced-invariant convention
  - README.md "### Capability seam (platform-agnostic core)" consumer-facing subsection with non-breaking reassurance
affects: [phase-2-upload-progress, MIGRATE-01 consumer-migration-blurb]

# Tech tracking
tech-stack:
  added: []
  patterns: [docs-ship-with-phase (D-14), aspirational-claim-becomes-enforced-invariant, signatures-cited-byte-for-byte-from-shipped-source]

key-files:
  created: []
  modified:
    - AGENTS.md
    - README.md

key-decisions:
  - "Placed AGENTS.md '### The capability seam' inside the Architecture section (after Wire format, before Node types) — keeps all architectural/adapter material co-located; placement was Claude's discretion per D-14"
  - "Augmented the invariant in two places in AGENTS.md: a fresh emphatic statement in the new seam subsection AND a checkable convention bullet under 'Conventions for evolving the framework' — so both a feature author and a framework maintainer hit the enforced rule"
  - "Cited the Adapter interface and onRedirect signature verbatim from shipped src/index.ts/browser.ts (not from plan prose) — every signature/command matches the shipped code byte-for-byte"
  - "README.md placed '### Capability seam (platform-agnostic core)' before Install, after the existing architecture intro paragraphs — consumer learns the guarantee in context without disrupting the Install/Use flow"

patterns-established:
  - "Enforced-invariant documentation: an aspirational core claim is documented WITH the exact CI mechanism that enforces it (script path, npm script name, workflow step, denylist tokens, scope)"
  - "Behavior-preservation docs: a refactor's docs are purely additive — explicitly reassure that wire format / onRedirect / node types are byte-identical, no existing behavioral section removed or contradicted"

requirements-completed: [AGNOSTIC-04]

# Metrics
duration: 2min
completed: 2026-05-15
---

# Phase 1 Plan 03: Capability-Seam + Enforced-Invariant Documentation Summary

**AGENTS.md and README.md now document the capability-seam pattern (navigate/storage/transport verbs, optional-methods-on-Adapter shape, onRedirect→adapter.navigate→loud-error resolution order, fail-loud rule with the auth-JWT security rationale) and reframe the previously aspirational "core references zero platform globals" claim as a CI-enforced, checkable invariant — naming the `check:core-globals` guard, the parity.yml gating step, and the src/index.ts-only scope — with every signature cited byte-for-byte from the shipped source and zero behavioral/wire documentation changed.**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-05-15T12:43:16Z
- **Completed:** 2026-05-15T12:45:14Z
- **Tasks:** 1 / 1
- **Files modified:** 2

## Accomplishments

- **AGENTS.md — new `### The capability seam` subsection** (placed in the Architecture section, after *Wire format*, before *Node types*). Documents concretely:
  - **What it is:** the core is a pure wire-protocol transformer; platform side-effects are delegated to the `Adapter` exactly as `render()` already is.
  - **The verbs:** a `typescript` fenced block of the `Adapter` interface copied byte-for-byte from the shipped `viewmodel-shell/src/index.ts` (`render` required; `navigate?(url)`, `storage?(scope: "local" | "session", key, value)` write-only, `transport?(input, init, hooks?)` with the `hooks.onUploadProgress` shape). Each verb's `BrowserAdapter` binding described (`window.location.href = url`, `localStorage`/`sessionStorage`, `fetch` passthrough).
  - **Optional-methods shape & non-breaking guarantee:** a `render`-only custom adapter still compiles; a new target becomes complete by implementing one interface.
  - **Redirect resolution order (D-05):** explicit `ShellOptions.onRedirect` (signature unchanged: stated as `(url: string) => void`) → `adapter.navigate(url)` → loud error, in that order.
  - **Fail-loud rule (D-06):** `navigate`/`storage` have no safe core default; absence surfaces an `Error` via `onError`/`console.error`, **never a silent no-op**; the swallowed `hecate_jwt` auth-JWT / no-op'd post-login redirect named as the security rationale.
  - **`transport` asymmetry:** has a universal `fetch` default, so omitting it is safe (extension point for the Phase 2 XHR upload-progress binding).
  - **Enforcement:** the grep guard `viewmodel-shell/scripts/check-core-platform-globals.mjs`, runnable via `npm run check:core-globals`, denylisting `window`/`document`/`localStorage`/`sessionStorage`/`XMLHttpRequest`, scoped to `src/index.ts` only (browser.ts excluded), wired as the `Enforce core platform-agnosticism (AGNOSTIC-03)` gating step in `.github/workflows/parity.yml`, alongside the jsdom adapter test.
- **AGENTS.md — augmented invariant:** the new seam subsection opens with the bolded original assertion ("The core never references `HTMLElement`, `document`, or any platform type.") and immediately states it is no longer an aspiration but a CI-enforced, checkable invariant — the claim is augmented, not deleted.
- **AGENTS.md — `Conventions for evolving the framework`:** added a checkable-invariant convention bullet so a maintainer evolving the framework is told to put new platform side-effects behind a capability verb, run `check:core-globals` before pushing, and fail loudly for no-safe-default capabilities.
- **README.md — new `### Capability seam (platform-agnostic core)` subsection** (placed after the architecture intro, before *Install*): states the core references zero platform globals and that this is CI-enforced; describes the seam and the three verbs in consumer prose; explicitly reassures consumers it is non-breaking — wire format, node types, side-effect behavior, and `ShellOptions.onRedirect` (still `(url: string) => void`) unchanged, `BrowserAdapter` (what every consumer uses) implements all verbs so default behavior is byte-identical, and `onRedirect` still takes precedence.
- **Behavior-preservation verified:** `git diff -- AGENTS.md README.md` is purely additive — 50 insertions, 0 deletions. No wire-format, node-type, or behavioral section removed or contradicted (the existing "Server-initiated redirect" and "Client side-effects" sections are untouched and the new prose is consistent with them).
- **Guard regression check:** `cd viewmodel-shell && npm run check:core-globals` still exits 0 — docs (which mention `window`/`localStorage` etc. as prose) did not regress core, confirming the guard's `src/index.ts`-only scope.

## Task Commits

Each task was committed atomically:

1. **Task 1: Document the capability seam + enforced invariant in AGENTS.md and README.md** - `0a2c46f` (docs)

**Plan metadata:** (final docs/state/roadmap commit follows this summary)

## Files Created/Modified

- `AGENTS.md` - Added `### The capability seam` subsection under Architecture (verbs, optional-methods shape, redirect resolution order, fail-loud rule with hecate_jwt rationale, enforcement); augmented the core-invariant claim to state it is CI-enforced and scoped to `src/index.ts`; added an enforced-invariant convention bullet under "Conventions for evolving the framework".
- `README.md` - Added consumer-facing `### Capability seam (platform-agnostic core)` subsection: CI-enforced zero-platform-globals statement, the three verbs, non-breaking/byte-identical reassurance including unchanged `onRedirect` signature.

## Decisions Made

- Placed the AGENTS.md seam subsection inside the Architecture section (after *Wire format*) rather than near the `Adapter` interface description — Architecture is where the structural model lives, keeping it co-located with the (state, action) → (view) model. Placement was explicitly Claude's discretion (D-14).
- Augmented the invariant in two AGENTS.md locations (the seam subsection's emphatic restatement + a "Conventions for evolving the framework" convention bullet) so both a feature author reading Architecture and a maintainer reading the evolution conventions encounter the now-enforced rule.
- All signatures/commands were copied from the shipped `viewmodel-shell/src/index.ts`, `viewmodel-shell/src/browser.ts`, `viewmodel-shell/package.json`, and `.github/workflows/parity.yml` — not transcribed from the plan's `<interfaces>` block — so the docs are accurate to the code, not aspirational (mitigates T-03-02).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- The working directory (`C:\requests\mvc-agent-framework\viewmodel-shell`) is the inner npm package, but the git root, planning files, AGENTS.md, and README.md are at the repository root (`C:\requests\mvc-agent-framework`). Resolved by determining the git root via `git rev-parse --show-toplevel` and using absolute paths for all reads/edits/commits. No content or scope impact.
- Pre-existing untracked `viewmodel-shell-dotnet/nupkg/` and pre-existing `D CLAUDE.md` / `M .planning/config.json` were present in the initial git status. These predate this docs-only plan and are out of scope per the deviation scope boundary — not staged, not modified, logged here as an observation only.

## Threat Model Coverage

- **T-03-01 (misleading guidance):** Mitigated — the fail-loud rule and the swallowed-auth-JWT (`hecate_jwt`) security rationale are documented explicitly in AGENTS.md; an adapter author is told omitting `storage`/`navigate` is a hard failure, not soft degradation.
- **T-03-02 (docs drift from code):** Mitigated — every documented signature/command (`Adapter` interface block, `onRedirect` `(url: string) => void`, `check:core-globals`, denylist tokens, `parity.yml` step name, script path, scope) was read from and matches the shipped post-Plan-01/02 source byte-for-byte.
- **T-03-03 (behavioral docs accidentally changed):** Mitigated — `git diff -- AGENTS.md README.md` shows 50 insertions and 0 deletions; no existing wire-format/redirect/side-effect documentation removed or contradicted.

## Threat Flags

None — this plan modifies documentation only; no new network endpoint, auth path, file access, or schema surface introduced.

## Known Stubs

None — no code changed; the documentation describes the fully shipped, CI-enforced Plan 01-01/01-02 implementation.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- **AGNOSTIC-04 complete.** The capability-seam pattern and the CI-enforced invariant are documented for both internal contributors (AGENTS.md) and public consumers (README.md), shipping *with* Phase 1 (D-14).
- **Phase 1 fully delivered:** all three plans (01-01 refactor, 01-02 CI guard + dual verification gate, 01-03 docs) complete. The "core references zero platform globals" milestone is implemented, CI-enforced, verified (parity 7/7 + adapter test), and documented.
- **Phase 2 (UPLOAD-01):** the documented `transport?(input, init, hooks?)` extension point and its `hooks.onUploadProgress` shape are now the published contract for the Phase 2 XHR upload-progress binding — built through the seam with no wire/API change.
- **MIGRATE-01 (deferred to Phase 2):** the README non-breaking reassurance is the consumer-facing baseline; the deeper consumer-maintainer migration blurb remains a Phase 2 milestone-closeout deliverable (not over-scoped here, per the critical constraint).

## Self-Check: PASSED

- Files verified present: `AGENTS.md`, `README.md`, `.planning/phases/01-capability-seam-refactor/01-03-SUMMARY.md`.
- Commit verified in git history: `0a2c46f` (`docs(01-03): document capability seam + CI-enforced platform-agnostic invariant`).
- Plan automated `<verify>` command exits 0 ("AGNOSTIC-04 docs present"); extended acceptance-criteria string checks all PASS (heading text, verbs, onRedirect signature, resolution order, fail-loud + hecate_jwt rationale, augmented invariant, src/index.ts scope, README non-breaking reassurance).
- `git diff -- AGENTS.md README.md`: 50 insertions, 0 deletions — additive only, no behavioral/wire docs removed.
- `cd viewmodel-shell && npm run check:core-globals` exits 0 — docs did not regress core.

---
*Phase: 01-capability-seam-refactor*
*Completed: 2026-05-15*
