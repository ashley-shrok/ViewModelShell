# Phase 2: Upload Progress + Milestone Closeout - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two things, with **zero wire-format or public-API breaking change**:

1. **UPLOAD-01** — `ShellOptions.onUploadProgress(sent, total)` implemented as the *first feature built through the `transport` capability seam*. The XHR upload-progress binding lives in `BrowserAdapter.transport` (`viewmodel-shell/src/browser.ts`), never in core. It activates **only** when a dispatch carries files **AND** the `onUploadProgress` callback is set. The HTTP response funnels through the **shared `processResponse()`** in `viewmodel-shell/src/index.ts` so only the *send* path differs between the fetch and XHR transports.
2. **MIGRATE-01** — A concrete, copy-pasteable consumer-maintainer migration blurb stating exact npm/NuGet versions, the single public-API addition, the explicit "what is NOT breaking and why" list, and recommended upgrade steps.

The `transport?(input, init, hooks?)` seam shape — including `hooks.onUploadProgress?: (sent: number, total: number) => void` — was **locked in Phase 1** (Adapter interface `index.ts:28-37`, documented in AGENTS.md §"The capability seam"). Phase 2 *implements* that shape; it does not redesign it.

Out of this phase: any wire-format change, any .NET/`server.ts` change, drag-and-drop, a new demo app.

</domain>

<decisions>
## Implementation Decisions

### A. Transport routing trigger & missing-transport fallback
- **D-01:** `dispatch()` routes the POST through `adapter.transport` **only when all three hold**: `action.files` is present, `ShellOptions.onUploadProgress` is set, and `adapter.transport` exists. In every other case the existing in-core `fetch(actionEndpoint, …)` path (`index.ts:297-301`) executes **unchanged** — Phase 1's D-07 deliberately did not route `dispatch()`/`load()` through a mandatory transport indirection, and that stays true.
- **D-02:** If `onUploadProgress` is set and files are present but `adapter.transport` is absent → **silent fallback to the core `fetch` path** (the upload still succeeds; progress events simply do not fire). This is intentionally *unlike* `navigate`/`storage` (D-06, fail-loud). Rationale: per Phase 1 D-07, `transport` is the one *asymmetric* verb with a safe universal default (`fetch`); progress reporting is a soft enhancement, not a correctness/security guarantee, so a missing override degrades gracefully rather than throwing.

### B. `onUploadProgress` API surface & threading
- **D-03:** Add a new optional callback to `ShellOptions` (`index.ts:210-224`): `onUploadProgress?: (sent: number, total: number) => void`. Signature mirrors the already-locked `Adapter.transport` hook (`index.ts:35`) and the AGENTS.md docs **byte-for-byte** — do not "improve" or rename it. Purely additive; existing `ShellOptions` consumers are unaffected.
- **D-04:** `dispatch()` threads the option into the transport call as `adapter.transport(input, init, { onUploadProgress: this.options.onUploadProgress })`. The hooks object is the only new argument; `input`/`init` are constructed identically to the fetch path (see D-06).

### C. XHR progress semantics
- **D-05:** `BrowserAdapter.transport` gains an XHR branch that binds `xhr.upload.onprogress`. Emission rule: when `e.lengthComputable` → call `onUploadProgress(e.loaded, e.total)`; when **not** computable → call `onUploadProgress(e.loaded, 0)` where `0` is the documented "indeterminate total" sentinel. Emit a final deterministic `onUploadProgress(total, total)` on successful upload completion so progress-bar consumers always observe 100%.
- **D-06:** The XHR branch sends the exact same payload as the fetch path: same `FormData` (`_action`, `_state`, file fields), same merged `getRequestHeaders()` headers, same `Accept: application/json`, same `method: POST`, same endpoint. Only the *transport mechanism* differs.
- **D-07:** XHR `error` / `timeout` / `abort` → **reject the returned Promise** with an `Error`, so the existing `dispatch()` try/catch routes it to `onError` exactly like a failed `fetch`. No new error channel.

### D. Shared response path / parity fidelity
- **D-08:** The XHR branch resolves with a **real `Response`** built from `xhr.status` / `xhr.statusText` / `xhr.responseText`, so the downstream `if (!res.ok) …` and `(await res.json()) as ShellResponse` → `processResponse()` logic in `dispatch()` (`index.ts:302-303`) is byte-identical regardless of which transport ran. `processResponse()` itself (`index.ts:337-362`) is **not touched** by this phase.
- **D-09:** The full cross-backend parity suite (`parity/run.ts`, all 7 fixtures) must stay 100% green. Upload progress has **no parity surface** (byte-level XHR progress is browser-runtime only — confirmed in STATE.md architectural notes); parity's role here is to prove the *shared response path* and wire contract are unchanged, not to test progress.

### E. Version bump strategy (MIGRATE-01 input)
- **D-10:** npm `@ashley-shrok/viewmodel-shell`: `0.3.12 → 0.4.0` (minor bump — a new backward-compatible public API addition under pre-1.0 SemVer; a minor signals "new feature, safe to adopt" more clearly than a patch).
- **D-11:** NuGet `AshleyShrok.ViewModelShell`: **stays `0.3.9` — no bump, no action for .NET-only consumers**. There is no wire-format or .NET API delta. PROJECT.md Constraints explicitly permit "npm-only bumps … for client-only changes," so the npm/NuGet version divergence here is sanctioned, not drift. The migration blurb must state this no-op *and its rationale* explicitly so .NET consumers are not left guessing.

### F. Migration blurb format & content (MIGRATE-01)
- **D-12:** The blurb is a dedicated, copy-pasteable **`MIGRATION.md` at the repo root**, with a short pointer added from `README.md`. One canonical URL downstream maintainers can be sent to.
- **D-13:** `MIGRATION.md` must contain, concretely: (1) exact versions — npm `0.4.0`, NuGet unchanged `0.3.9` (with the "why no NuGet bump" rationale); (2) the single public-API addition — `ShellOptions.onUploadProgress?: (sent, total) => void`; (3) an explicit **NOT breaking** list with reasons: wire format, server-initiated redirect, client side-effects, polling/push, every existing ViewNode type, **and existing custom `Adapter` implementations** (`transport?` is optional, so adapters that don't implement it still compile and behave exactly as before); (4) recommended upgrade steps (`npm update @ashley-shrok/viewmodel-shell`, optionally set `onUploadProgress` to opt into progress; .NET: no action).

### G. Verification surface / demo scope
- **D-14:** UPLOAD-01 is verified by a **net-new framework-level jsdom/vitest mock-XHR unit test** that extends the existing `viewmodel-shell/test/adapter-seam.test.ts` harness (the D-12.2 pattern from Phase 1). It must assert: (a) callback fires with `(sent, total)` during a files-bearing dispatch when `onUploadProgress` is set; (b) callback is **never** invoked when no files are present or the option is unset; (c) on missing `adapter.transport`, dispatch still succeeds via the fetch fallback (D-02); (d) the response still flows through `processResponse()` (rendered VM updates), proving D-08.
- **D-15:** No new demo app and **no change to FeatureProbe** or any parity fixture. Upload progress has no parity surface, and a demo is not required by any Phase 2 success criterion. A standalone upload-progress demo is recorded as a deferred idea, not built here.

### Claude's Discretion
- Exact `MIGRATION.md` prose, headings, and the README pointer wording (D-12/D-13).
- Exact XHR wiring details in `BrowserAdapter.transport` (event listener style, how the `Response` is reconstructed) provided D-05/D-06/D-07/D-08 hold.
- Whether the indeterminate-total sentinel is surfaced in docs as `0` specifically or described qualitatively, provided the locked `(sent, total): void` signature is unchanged (D-03/D-05).
- Whether the npm bump is realized as `0.4.0` exactly vs an alternative if a release-process reason emerges during planning — `0.4.0` is the recommended default and the value the blurb should state unless explicitly revised (D-10).
- Test file placement (extend `adapter-seam.test.ts` vs a sibling `*.test.ts`) provided it runs under the existing `npm test` (vitest/jsdom) and CI (D-14).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & locked decisions
- `.planning/REQUIREMENTS.md` — UPLOAD-01, MIGRATE-01 acceptance criteria (Phase 2 section); the "activates only when a dispatch carries files AND the callback is set; response funnels through shared `processResponse()`" wording
- `.planning/ROADMAP.md` §"Phase 2: Upload Progress + Milestone Closeout" — the 4 success criteria (callback firing rules, no-XMLHttpRequest-in-core grep, parity 100% green, migration blurb contents)
- `.planning/PROJECT.md` — Constraints (no wire-format/public-API break; "npm-only bumps allowed for client-only changes" — the rule that sanctions D-10/D-11), Key Decisions ("upload progress built through the seam, not bolted on"; "consumer migration blurb is a first-class milestone deliverable")
- `.planning/phases/01-capability-seam-refactor/01-CONTEXT.md` — **D-07** (transport asymmetric; `fetch` is the in-core universal default; `transport?` is a pure optional enhancement and UPLOAD-01 *is* the override), **D-06** (fail-loud is for navigate/storage only — contrast for D-02), the locked seam shape and design-intent test

### Core implementation targets
- `viewmodel-shell/src/index.ts` — `Adapter.transport?` locked signature incl. `hooks.onUploadProgress` (lines 28-37); `ShellOptions` where `onUploadProgress?` is added (lines 210-224); `dispatch()` where the routing decision lives (lines 274-311, fetch call 297-301); `processResponse()` shared response path — **must stay untouched** (lines 337-362); `failCapability` (326-335) — the fail-loud pattern that D-02 deliberately does *not* use for transport
- `viewmodel-shell/src/browser.ts` — `BrowserAdapter.transport` currently a thin `fetch` passthrough (lines 70-77); the XHR upload-progress binding is implemented here and **only** here
- `viewmodel-shell/src/server.ts` — wire shapes; **no change** this phase, referenced only to confirm the contract stays fixed

### Verification & CI
- `viewmodel-shell/test/adapter-seam.test.ts` — existing net-new framework jsdom/vitest harness (Phase 1 D-12.2); the upload-progress mock-XHR test extends this pattern
- `viewmodel-shell/vitest.config.ts` — `environment: "jsdom"`; the test runtime
- `parity/run.ts` — cross-backend parity harness; criterion 3 = stays 100% green (no parity surface for progress; proves shared response path/wire contract unchanged)
- `viewmodel-shell/scripts/check-core-platform-globals.mjs` + `.github/workflows/parity.yml` — the Phase 1 CI guard; success criterion 2 ("grep of core `src/index.ts` for XMLHttpRequest returns no matches") is enforced by this existing guard — Phase 2 must not introduce `XMLHttpRequest` into core

### Versioning & migration artifact
- `viewmodel-shell/package.json` — current npm `version: 0.3.12`; bump target `0.4.0` (D-10); exports map (`.`, `./browser`, `./server`)
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — current NuGet `<Version>0.3.9</Version>`; **unchanged** (D-11)
- `AGENTS.md` §"The capability seam" (lines 64-97) — already documents `transport?(input, init, hooks?)` with `hooks.onUploadProgress`; update only if needed to reflect "now implemented (UPLOAD-01)"
- `README.md` — public-facing capability-seam subsection; the `MIGRATION.md` pointer is added here (D-12)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`Adapter.transport?` extension point (`index.ts:28-37`)** — already defined in Phase 1 with the exact `(input, init, hooks?)` shape and the `onUploadProgress` hook typed. Phase 2 needs **no interface change** — it implements the contract that already exists.
- **`BrowserAdapter.transport` (`browser.ts:70-77`)** — already present as a thin `fetch` passthrough with the right signature; the XHR branch slots in here. It already `implements Adapter` and owns 100% of DOM/platform access (the only legal home for `XMLHttpRequest`).
- **`test/adapter-seam.test.ts`** — the net-new framework jsdom/vitest harness Phase 1 created (feeds responses through `ViewModelShell` → `processResponse()` and asserts adapter bindings fire). The upload-progress test is the same pattern with a mock `XMLHttpRequest`.
- **`processResponse()` (`index.ts:337-362`)** — the shared response path. Reusing it unchanged is *the* mechanism that satisfies "only the send differs" and keeps parity green.
- **`getRequestHeaders` + FormData construction in `dispatch()` (`index.ts:288-301`)** — already builds the exact request payload; the XHR path reuses this construction verbatim.

### Established Patterns
- **Optional callback on `ShellOptions` with `?.()` call site** — `onError`, `onLoading`, `onRedirect`, `getRequestHeaders` are all optional callbacks. `onUploadProgress` follows the same idiom (additive, backward-compatible).
- **Asymmetric transport (Phase 1 D-07)** — unlike navigate/storage (fail-loud, no safe default), transport has `fetch` as a universal default; a missing override degrades gracefully. D-02 follows this established asymmetry.
- **Verification = parity (wire) + jsdom/vitest (browser-runtime behavior)** — the framework's "no real browser for tests" promise; mock-XHR under jsdom is the established way to test a browser binding.
- **Version-aligned npm+NuGet only for wire-format changes** — client-only changes get npm-only bumps (PROJECT.md). This change is client-only → D-10/D-11.

### Integration Points
- `dispatch()` (`index.ts:274-311`) is the single function that gains the routing branch (transport-with-hooks vs in-core fetch). It is the *only* core change for UPLOAD-01; `processResponse()` and the `Adapter`/`ShellOptions` types’ existing members are untouched (one additive `ShellOptions` field, D-03).
- `BrowserAdapter.transport` (`browser.ts:70-77`) is where `XMLHttpRequest` is introduced — inside the browser layer, which is *excluded* from the core-globals CI guard by design (D-11 scope from Phase 1).
- `MIGRATION.md` (new, repo root) + a one-line `README.md` pointer are the MIGRATE-01 deliverables; no code coupling.

</code_context>

<specifics>
## Specific Ideas

- "Built *through* the seam, not bolted on" (PROJECT.md Key Decision) — the design-intent test for this phase: the only core change is a routing branch in `dispatch()` plus one additive `ShellOptions` field; all `XMLHttpRequest` lives in `BrowserAdapter`. If `XMLHttpRequest` appears anywhere in `src/index.ts`, the seam was bypassed and the Phase 1 CI guard fails the build.
- The migration blurb is a **first-class milestone deliverable**, not an afterthought (PROJECT.md) — it must be copy-pasteable and explicit about *what is NOT breaking and why*, because multiple downstream apps consume this and the npm/NuGet version divergence (0.4.0 vs unchanged 0.3.9) will otherwise look like a mistake to maintainers.
- The locked progress signature is `(sent: number, total: number) => void` — already in the Adapter interface and AGENTS.md. "Don't improve it while you're in there" (the same discipline applied to `onRedirect` in Phase 1, 01-CONTEXT D-04).

</specifics>

<deferred>
## Deferred Ideas

- **Standalone upload-progress demo app / FeatureProbe extension** — not required by any Phase 2 success criterion and upload progress has no parity surface. If a runnable demo proves valuable for documentation later, it is its own small follow-up, not part of this milestone closeout.
- **Routing `load()` (GET) through the transport seam** — out of scope; UPLOAD-01 is dispatch/POST + files only. Phase 1 D-07 already established `load()`/`dispatch()` are not behind a mandatory transport indirection.
- **Download progress / response-side `onDownloadProgress`** — not in requirements; the locked hook is upload (`xhr.upload.onprogress`) only. Note for a future feature request if a consumer needs it.
- **Extending the core-globals CI guard to `server.ts`** — carried forward from Phase 1 01-CONTEXT deferred list; still out of scope.

### Reviewed Todos (not folded)
None — `todo match-phase 2` returned 0 matches.

</deferred>

---

*Phase: 02-upload-progress-milestone-closeout*
*Context gathered: 2026-05-15*
