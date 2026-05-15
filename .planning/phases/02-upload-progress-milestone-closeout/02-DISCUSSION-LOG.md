# Phase 2: Upload Progress + Milestone Closeout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 02-upload-progress-milestone-closeout
**Mode:** `--auto` (non-interactive — recommended option auto-selected per area, single pass)
**Areas discussed:** Transport routing & fallback; onUploadProgress API surface; XHR progress semantics; Shared response path / parity fidelity; Version bump strategy; Migration blurb format & content; Verification surface / demo scope

---

## A. Transport routing trigger & missing-transport fallback

| Option | Description | Selected |
|--------|-------------|----------|
| Route only when files + callback + adapter.transport; else core fetch unchanged; **silent fetch fallback if transport absent** | Honors Phase 1 D-07 (transport asymmetric, fetch is the safe default); progress is a soft enhancement | ✓ |
| Fail loud (like navigate/storage D-06) if transport absent when progress requested | Treats progress as a hard guarantee | |
| Always route POST through adapter.transport | Mandatory transport indirection — explicitly rejected by Phase 1 D-07 | |

**Auto-selected:** Option 1 (recommended). **Rationale:** Phase 1 D-07 locked `transport` as the one asymmetric verb with a universal `fetch` default; progress is not a correctness/security guarantee, so graceful degradation (D-02) is correct and consistent. → D-01, D-02.

---

## B. `onUploadProgress` API surface & threading

| Option | Description | Selected |
|--------|-------------|----------|
| New optional `ShellOptions.onUploadProgress?: (sent, total) => void`, threaded into `adapter.transport(input, init, { onUploadProgress })` | Mirrors the already-locked transport hook signature byte-for-byte; additive | ✓ |
| New required field / changed signature | Breaking; rejected (REQUIREMENTS: no public-API break) | |

**Auto-selected:** Option 1 (recommended). **Rationale:** REQUIREMENTS.md literally specifies `ShellOptions.onUploadProgress(sent,total)`; signature already locked in `Adapter.transport` hook + AGENTS.md — implement, do not redesign. → D-03, D-04.

---

## C. XHR progress semantics

| Option | Description | Selected |
|--------|-------------|----------|
| `xhr.upload.onprogress`: computable → `(loaded, total)`; non-computable → `(loaded, 0)`; final `(total,total)` on completion; error/timeout/abort → reject Promise | Deterministic 100%, errors reuse existing `onError` path | ✓ |
| No final 100% emission; rely solely on native events | Progress bars may never reach 100% deterministically | |
| Surface a separate error callback for XHR failures | New error channel — unnecessary, breaks "only send differs" | |

**Auto-selected:** Option 1 (recommended). **Rationale:** Deterministic terminal event is friendlier for progress UIs; rejecting the Promise reuses the existing `dispatch()` try/catch → `onError`, keeping one error channel. → D-05, D-06, D-07.

---

## D. Shared response path / parity fidelity

| Option | Description | Selected |
|--------|-------------|----------|
| XHR resolves a real `Response` from status/text; `dispatch()` + `processResponse()` byte-identical; parity stays green | "Only the send differs" — satisfies success criterion 3 | ✓ |
| XHR branch parses JSON itself and calls a parallel response handler | Forks the response path — violates "shared processResponse()" | |

**Auto-selected:** Option 1 (recommended). **Rationale:** ROADMAP success criterion 3 + REQUIREMENTS both require the shared `processResponse()`; reconstructing a real `Response` keeps the downstream path untouched and parity green. → D-08, D-09.

---

## E. Version bump strategy

| Option | Description | Selected |
|--------|-------------|----------|
| npm `0.3.12 → 0.4.0` (minor, new backward-compat API); NuGet stays `0.3.9` (no .NET delta) | Signals "new feature, safe"; npm-only bump sanctioned by PROJECT.md for client-only changes | ✓ |
| npm patch `0.3.13`; NuGet stays `0.3.9` | Under-signals a new public API | |
| Version-align both (bump NuGet too) | Misleading — no .NET change; PROJECT.md only requires alignment for wire-format changes | |

**Auto-selected:** Option 1 (recommended). **Rationale:** Pre-1.0 SemVer: new backward-compatible API = minor. PROJECT.md Constraints explicitly allow npm-only bumps for client-only changes; this is client-only. → D-10, D-11.

---

## F. Migration blurb format & content

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated copy-pasteable `MIGRATION.md` at repo root + README pointer; enumerates exact versions, the one API addition, explicit NOT-breaking list w/ reasons, upgrade steps | One canonical URL; satisfies MIGRATE-01 success criterion 4 verbatim | ✓ |
| Section appended to README only | Less linkable, mixes with general docs | |
| CHANGELOG entry only | Not copy-pasteable as a maintainer-facing blurb | |

**Auto-selected:** Option 1 (recommended). **Rationale:** ROADMAP criterion 4 demands a concrete copy-pasteable artifact with specific contents; a dedicated file is the cleanest deliverable and the explicit NuGet-no-op rationale prevents maintainer confusion over the version divergence. → D-12, D-13.

---

## G. Verification surface / demo scope

| Option | Description | Selected |
|--------|-------------|----------|
| Net-new jsdom/vitest mock-XHR unit test extending `adapter-seam.test.ts`; parity stays green; **no new demo, no FeatureProbe change** | Matches every Phase 2 success criterion; respects "tightly scoped milestone" | ✓ |
| Add an upload-progress demo app | Not required by any criterion; scope creep | |
| Extend FeatureProbe parity fixture | Upload progress has no parity surface (browser-runtime only) — fixture cannot observe it | |

**Auto-selected:** Option 1 (recommended). **Rationale:** STATE.md notes upload progress is browser-runtime only with no parity surface; unit-test via mock XHR (the established D-12.2 pattern) is the correct verification. Demo is recorded as deferred. → D-14, D-15.

---

## Claude's Discretion

- Exact `MIGRATION.md` prose / README pointer wording.
- Exact XHR wiring in `BrowserAdapter.transport` (listener style, `Response` reconstruction) provided D-05..D-08 hold.
- Indeterminate-total documentation (`0` sentinel vs qualitative) provided the locked `(sent, total)` signature is unchanged.
- npm bump realized as `0.4.0` exactly unless a release-process reason emerges (recommended default).
- Test file placement (extend `adapter-seam.test.ts` vs sibling) provided it runs under existing `npm test` + CI.

## Deferred Ideas

- Standalone upload-progress demo / FeatureProbe extension.
- Routing `load()` (GET) through the transport seam.
- Download progress / `onDownloadProgress`.
- Extending the core-globals CI guard to `server.ts` (carried from Phase 1).
