# Phase 1: Capability Seam Refactor - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 1-capability-seam-refactor
**Areas discussed:** Seam API shape, onRedirect back-compat, CI guard mechanism, Guard scope, Transport depth in Phase 1, CI guard packaging

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Seam API shape | Where navigate/storage/transport live + onRedirect reconciliation | ✓ |
| CI guard mechanism | grep vs ESLint vs tsconfig no-DOM-lib | ✓ |
| Guard scope | index.ts only vs +server.ts; deny/allow boundary | ✓ |
| Transport depth in P1 | fetch moves behind seam now vs verb-only + fetch stays | ✓ |

**User's choice:** All four areas.

---

## Seam shape

| Option | Description | Selected |
|--------|-------------|----------|
| Extend Adapter interface | Optional navigate?/storage?/transport? on existing Adapter; core calls adapter.navigate?.(url); BrowserAdapter implements them | ✓ |
| Separate Capabilities object | Standalone Capabilities interface via new ShellOptions.capabilities field | |

**User's choice:** Extend Adapter interface.
**Notes:** Matches AGNOSTIC-01's literal "same way render() is already delegated to the adapter." Optional methods keep existing custom Adapter implementations non-breaking; a future mobile/terminal adapter satisfies exactly one interface to be a complete target.

---

## onRedirect reconciliation

| Option | Description | Selected |
|--------|-------------|----------|
| onRedirect overrides navigate | onRedirect (if set) → adapter.navigate; window.location.href moves to BrowserAdapter.navigate; non-breaking | ✓ |
| Deprecate onRedirect, route via navigate | onRedirect becomes deprecated shim; consumers steered to custom adapter.navigate | |
| You decide | Claude picks non-breaking approach | |

**User's choice:** onRedirect overrides navigate.
**Notes:** User supplied extensive guidance that also resolved the remaining three areas:
- **Transport asymmetry:** transport has a real universal default (fetch works browser/Node/Deno/Bun) → core keeps fetch as default transport, adapter.transport? is a pure optional enhancement (XHR/upload progress = Phase 2). navigate/storage have NO sane core default.
- **Fail loud, never silent:** if an adapter omits navigate/storage, fail loudly via onError/throw — a silent redirect no-op or swallowed set-local-storage (Hecate JWT flow) is a correctness/security footgun.
- **Resolution order:** explicit onRedirect → adapter.navigate → loud error. Default browser behavior moves from core into BrowserAdapter.navigate, not away entirely.
- **Preserve onRedirect signature exactly** — `(url: string) => void`; don't "improve" it.
- **AGNOSTIC-03 guard:** grep core src/index.ts for window/document/localStorage/sessionStorage/XMLHttpRequest; post-refactor that set must be empty; CI fails on any hit.
- **Verification split:** FeatureProbe parity exercises redirect without onRedirect (drives adapter.navigate default) but only observes the {redirect:url} wire response — parity proves the wire contract, NOT the window.location→BrowserAdapter.navigate relocation. That needs an adapter-level jsdom/vitest test (navigate actually navigates; onRedirect-when-set wins; storage actually writes). No such framework-level test exists yet → Phase 1 must add one.

---

## CI guard packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Standalone script + existing workflow | Committed grep script, locally runnable via npm, new step in existing parity.yml | ✓ |
| Inline grep step in existing workflow | Raw grep embedded in parity.yml YAML | |
| Standalone script + dedicated workflow | Script in its own fast-fail core-invariant.yml | |

**User's choice:** Standalone script + existing workflow.
**Notes:** Script must be locally runnable (npm run check:core-globals) so devs catch violations pre-CI; reuses the single existing workflow.

---

## Readiness gate

| Option | Description | Selected |
|--------|-------------|----------|
| Write CONTEXT.md | Capture decisions, proceed to /gsd-plan-phase 1 | ✓ |
| Revisit an area | Reopen an area before locking | |

**User's choice:** Write CONTEXT.md.

---

## Claude's Discretion

- Standalone script filename/language and npm script name
- grep token regex / word-boundary handling (must not false-positive on fetch/FormData/setTimeout/URLSearchParams/console)
- transport? extension-point signature (must carry a Phase-2 progress callback without a Phase-1 wire/API change)
- fail-loud error message wording
- AGENTS.md / README prose and placement
- adapter-level test harness shape (new vs colocated) provided it runs in CI as part of the gate

## Deferred Ideas

- Upload progress / transport XHR override (UPLOAD-01) — Phase 2
- Consumer migration blurb (MIGRATE-01) — Phase 2
- Extending the platform-global guard to server.ts — future hardening, out of scope this phase
