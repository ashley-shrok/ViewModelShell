# ViewModel Shell

## What This Is

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser, and all UI tests are pure unit tests with no browser runtime. The server is a stateless transformer: it takes the client's current UI state plus an action and returns the next state plus a fresh view tree of typed nodes. A thin TypeScript adapter renders that tree to DOM with no app-specific code. Ships as two version-aligned packages: `@ashley-shrok/viewmodel-shell` (npm — frontend renderer + `/server` backend subpath) and `AshleyShrok.ViewModelShell` (NuGet — .NET backend types).

## Core Value

The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end. If platform assumptions leak into the core, the framework's central promise (and its main differentiator) is broken.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

- ✓ Stateless server / wire-format contract (GET → {vm,state}, POST multipart → {vm,state}) — existing
- ✓ Full ViewNode hierarchy (page, section, list, form, field, checkbox, button, text, link, stat-bar, tabs, progress, modal, table) — existing
- ✓ Server-initiated redirect (`ShellResponse.RedirectTo`) — existing
- ✓ Client side-effects (`set-local-storage`, `set-session-storage`) — existing
- ✓ Polling + push (`pollInterval`, `NextPollIn`, `shell.push()`) — existing
- ✓ TypeScript backend subpath (`@ashley-shrok/viewmodel-shell/server`), compiled JS so it runs in plain Node — existing (v0.3.11)
- ✓ Cross-backend parity harness — 7 fixtures, .NET/Bun/Node byte-identical, CI-gated — existing
- ✓ ModalNode size variants, table horizontal overflow, box-sizing reset (issue #3) — existing
- ✓ **AGNOSTIC-01**: Core (`src/index.ts`) references zero platform globals — generic capability seam delegates `navigate`, `storage`, and optional `transport` to the adapter — Validated in Phase 1: Capability Seam Refactor
- ✓ **AGNOSTIC-02**: Browser bindings (`window.location`, `localStorage`, `sessionStorage`) relocated out of core into `BrowserAdapter` behind the seam, zero observable behavior change (parity green, all 7 fixtures) — Validated in Phase 1
- ✓ **AGNOSTIC-03**: CI guard (`check-core-platform-globals.mjs`, step in `parity.yml`) fails the build if `src/index.ts` references a platform global — Validated in Phase 1
- ✓ **AGNOSTIC-04**: AGENTS.md + README document the capability seam and the CI-enforced "core references zero platform globals" invariant — Validated in Phase 1
- ✓ **UPLOAD-01**: Upload progress (issue #4) — `ShellOptions.onUploadProgress(sent,total)` shipped as the first feature built *through* the `transport` seam; `XMLHttpRequest` binding lives only in `BrowserAdapter.transport` (zero in core src/index.ts, CI-gated); three-condition routing with silent fetch fallback; XHR failures reject into the existing `onError` path (byte-identical to fetch, parity green) — Validated in Phase 2: Upload Progress + Milestone Closeout
- ✓ **MIGRATE-01**: Copy-pasteable `MIGRATION.md` at repo root — npm `0.3.13` (patch; NuGet unchanged `0.3.9`; major.minor-alignment rule honored), the `onUploadProgress` API addition, explicit NOT-breaking list, upgrade steps, and the two silent-behavior caveats (transport-fallback, `total > 0` divide-by-zero guard) — Validated in Phase 2

### Active

<!-- Current scope. Building toward these. -->

- (None — milestone "Restore & Enforce Core Platform-Agnosticism" complete; all 6 requirements validated. Awaiting next milestone.)

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Drag-and-drop / `DraggableNode` / `DropTargetNode` (issue #2) — declined; drag is the most browser-runtime-dependent interaction (conflicts with no-browser-test promise), keyboard a11y is the unsolved hard 20%, and a single-child wrapper is a foreign structural pattern. Reorder is solved via the click-to-select-then-place pattern (Reorder demo) with zero framework changes.
- `reorderable` convenience on ListNode — deferred; revisit only if per-app reorder boilerplate proves painful across many real apps (driven by usage, not speculation).
- Global `*` box-sizing reset — rejected; the stylesheet is opt-in and must not stomp the host app's own page elements. Scoped reset shipped instead.
- Cross-runtime parity beyond Bun+Node (Deno/Workers) — deferred; same Web Fetch surface, low marginal value until a consumer needs it.

## Context

- Mature framework, mid-stream. Codebase, demos (Tasks, ContactManager, ExpenseTracker, RetroBoard, HelpDesk, FeatureProbe, Reorder + `-bun` mirrors), npm + NuGet packages, and a green cross-backend parity harness all already exist.
- Verification surface: 136 C# unit tests, ~97 frontend vitest, 7-fixture cross-backend parity (CI-gated on every push), plain-Node smoke. Parity is the highest-signal check — it catches wire-format drift between backends, the bug class that silently breaks consumers.
- The architectural drift being corrected: `src/index.ts` directly calls `window.location.href` (redirect; has an `onRedirect` hook but the default lives in core), and `localStorage`/`sessionStorage` (side-effects; **no** override hook — fully browser-bound in core). This violates the framework's own stated invariant ("the core never references HTMLElement, document, or any platform type"). Issue #4 (upload progress) would add `XMLHttpRequest` as a third violation if bolted on rather than built through a seam.
- Reassuring risk note: the wire contract (redirect/side-effect responses) is parity-covered by the FeatureProbe fixtures. The refactor moves *where the browser binding executes*, not *what the protocol does* — blast radius is "which layer holds the binding," not "does the feature still work."

## Constraints

- **Compatibility**: No wire-format or public-API breaking change. Consumers use bundlers (frontend) or the `/server` subpath (backend); the seam must be internal or backward-compatible.
- **Tech stack**: TypeScript ESM, compiled to `dist/` via tsc; npm + NuGet shipped version-aligned at major.minor for wire-format changes (npm-only bumps allowed for client-only changes).
- **Verification**: Phase is not done until the full parity suite is green AND the new CI invariant guard passes. Verifier/plan-check agents on — this is architecture-invariant work, not a quick.
- **Security**: Dual-use N/A; standard safe-code practices.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Capability seam over per-feature browser hooks | Generic verbs (navigate/storage/transport) let any future front-end pick up redirect/side-effects/progress automatically; restores the core invariant the framework already claims | ✓ Shipped Phase 1 — optional Adapter methods, CI-enforced, parity green |
| 2 sequential phases, zero quicks | Phase 1 = refactor (no behavior change, parity-verifiable); Phase 2 = feature through the seam, depends on Phase 1. Quicks skip the verification gates this work centers on | — Pending |
| Upload progress built *through* the seam, not bolted on | Avoids a third core platform violation; makes issue #4 the first feature done right | — Pending |
| Consumer migration blurb is a first-class milestone deliverable | Downstream maintainers (multiple apps) must know what/whether to update; not an afterthought | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-15 — Phase 2 (Upload Progress + Milestone Closeout) complete: UPLOAD-01 + MIGRATE-01 validated. Milestone "Restore & Enforce Core Platform-Agnosticism" fully delivered — all 6 requirements (AGNOSTIC-01..04, UPLOAD-01, MIGRATE-01) shipped; npm 0.3.13, NuGet 0.3.9.*
