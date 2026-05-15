# Phase 1: Capability Seam Refactor - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Purge the 3 platform-global violations from core (`viewmodel-shell/src/index.ts`), relocate them behind a generic capability seam implemented in `BrowserAdapter`, enforce the "core references zero platform globals" invariant with a CI guard, and document the pattern in AGENTS.md + README — all with **zero observable behavior change** (the cross-backend parity suite stays 100% green).

Confirmed violations in `src/index.ts`:
- `window.location.href = body.redirect` (line 316) — redirect default lives in core; partial `onRedirect` hook exists
- `localStorage.setItem(...)` (line 307) — side-effect, no override hook, fully browser-bound
- `sessionStorage.setItem(...)` (line 309) — side-effect, no override hook

`fetch` / `FormData` / `setTimeout` / `URLSearchParams` / `console` are deliberately treated as universal and **stay in core** (per the existing comment at index.ts:185-186). Upload progress / XHR is Phase 2 and is explicitly out of scope here.

</domain>

<decisions>
## Implementation Decisions

### Seam API shape

- **D-01:** The seam is exposed as **optional methods on the existing `Adapter` interface** (`viewmodel-shell/src/index.ts:13-15`): `navigate?(url)`, `storage?(scope, key, value)`, `transport?(...)`. Core calls them as `adapter.navigate?.(url)` etc. Chosen because AGNOSTIC-01 literally specifies "the same way `render()` is already delegated to the adapter," and optional methods keep any existing custom `Adapter` implementation non-breaking. A future mobile/terminal adapter implements one interface to become a complete target — the property this milestone exists to create.
- **D-02:** `storage` verb signature follows AGNOSTIC-01 exactly: `storage(scope, key, value)` — write-only (the only side-effects are `set-local-storage` / `set-session-storage`; there is no storage *read* in the wire contract).
- **D-03:** `BrowserAdapter` (`viewmodel-shell/src/browser.ts`) implements all three verbs. `window.location.href` relocates into `BrowserAdapter.navigate`; `localStorage.setItem` / `sessionStorage.setItem` relocate into `BrowserAdapter.storage`. The relocation moves *where the binding executes* (core → adapter), not *what it does*.

### onRedirect backward compatibility

- **D-04:** `ShellOptions.onRedirect` is preserved with its **exact documented signature `(url: string) => void`** and exact behavior. Do NOT "improve" the signature while refactoring.
- **D-05:** Redirect resolution order: **explicit `onRedirect` hook (if set) → `adapter.navigate` → loud error.** Any consumer that currently sets `onRedirect` sees byte-identical behavior; consumers relying on the core default now get it from `BrowserAdapter.navigate` instead of core. Fully non-breaking — every real consumer uses `BrowserAdapter`, which implements everything.

### Missing-capability behavior (correctness/security)

- **D-06:** `navigate` and `storage` have **no sane core default**. If a plugged-in adapter omits them, the feature must **fail loudly** — surface via `onError` / throw with a clear message. Never a silent no-op. Rationale: a redirect that silently does nothing, or a `set-local-storage` side-effect that silently swallows (e.g. the Hecate JWT-to-localStorage auth flow), is a correctness/security failure, not a soft degradation.
- **D-07:** `transport` is **asymmetric** from navigate/storage: it *does* have a universal default. Core keeps `fetch` as the in-core default transport (fetch works browser/Node/Deno/Bun). `adapter.transport?` is a **pure optional enhancement** — only an adapter wanting upload progress / XHR overrides it, and that override is **Phase 2 (UPLOAD-01)**. Phase 1 defines the optional `transport?` extension point and leaves `fetch` in core unchanged; it does **not** move `load()`/`dispatch()` fetch calls behind a mandatory transport indirection.

### CI guard mechanism (AGNOSTIC-03)

- **D-08:** Mechanism is a **grep-based denylist check**, not ESLint and not a TypeScript no-DOM-lib compile barrier (the latter would require splitting the single shared `tsconfig.json` — explicitly avoided).
- **D-09:** Denylist tokens checked in `src/index.ts`: `window`, `document`, `localStorage`, `sessionStorage`, `XMLHttpRequest`. Post-refactor that set must be **empty**; **any** hit fails the build.
- **D-10:** Packaging: a **committed standalone script** (e.g. `scripts/check-core-platform-globals.mjs` — exact name at planner discretion) that performs the grep and exits non-zero on any hit, wired as a **new step in the existing `.github/workflows/parity.yml` job**. The script must be locally runnable via an npm script (e.g. `npm run check:core-globals`) so developers catch violations before CI. No separate workflow file.

### Guard scope (AGNOSTIC-03)

- **D-11:** Guard scope is **`viewmodel-shell/src/index.ts` only** (REQUIREMENTS.md literal wording: "Core `src/index.ts`"). `viewmodel-shell/src/server.ts` is **not** in scope for this phase's guard. `viewmodel-shell/src/browser.ts` is the browser layer and is **always excluded** (it legitimately owns all DOM/platform bindings).

### Verification gate (do NOT over-trust parity)

- **D-12:** Phase 1 is not done until **both** hold:
  1. The full cross-backend parity suite (`parity/run.ts`, all 7 fixtures including FeatureProbe) is 100% green — proves the `{redirect:url}` / side-effect **wire contract is unchanged**.
  2. An **adapter-level jsdom/vitest test** proves the relocation actually fires: `window.location → BrowserAdapter.navigate` performs the browser navigation, `onRedirect`-when-set takes precedence, and `BrowserAdapter.storage` actually writes to local/session storage.
- **D-13:** The FeatureProbe parity fixture exercises redirect **without** `onRedirect` set (driving the `adapter.navigate` default path), but the harness only observes the `{redirect: url}` **wire response**, not an actual browser navigation. Parity therefore proves the protocol is unchanged but does **NOT** prove the core→adapter relocation works. **No framework-level adapter unit tests exist today** (tests live in demo frontends with jsdom). Phase 1 **must add** the adapter-level navigate/storage test described in D-12.2 — otherwise the relocation ships unverified. This is a required deliverable of the phase, not optional hardening.

### AGNOSTIC-04 documentation

- **D-14:** AGENTS.md and README updates ship **with** this phase (not after). Content: document the capability-seam pattern (the `navigate`/`storage`/`transport` verbs, the optional-methods-on-Adapter shape, the redirect resolution order, the fail-loud rule) and the CI-enforced "core references zero platform globals" invariant. AGENTS.md currently asserts "The core never references HTMLElement, document, or any platform type" (index.ts:10-11 comment echoes this) — that claim becomes an enforced, checkable invariant and the docs must say how it is enforced. Exact prose is Claude's discretion.

### Claude's Discretion

- Exact standalone script filename, language (Node `.mjs` vs shell), and npm script name.
- Exact grep implementation (token regex, word-boundary handling) provided it fails on any genuine occurrence of the 5 denylist tokens and does not false-positive on the allowed universals (`fetch`, `FormData`, `setTimeout`, `URLSearchParams`, `console`).
- Exact `transport?` method signature/shape for the optional extension point, provided it can later carry a progress callback in Phase 2 without a Phase-1 wire or public-API change.
- Exact error message wording for the fail-loud path (D-06).
- Exact AGENTS.md / README prose and placement (D-14).
- Whether the adapter-level test (D-12.2) is a new top-level test harness or colocated — provided it runs in CI as part of the gate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & locked decisions
- `.planning/REQUIREMENTS.md` — AGNOSTIC-01..04 acceptance criteria (Phase 1 section); guard scope wording ("Core `src/index.ts`")
- `.planning/PROJECT.md` — locked Key Decisions (capability seam over per-feature hooks; 2 sequential phases; no wire/API breaking change), Constraints (compatibility, verification gates), and the "architectural drift being corrected" + FeatureProbe parity-coverage risk note in ## Context
- `.planning/ROADMAP.md` §"Phase 1: Capability Seam Refactor" — the 4 success criteria

### Core refactor targets
- `viewmodel-shell/src/index.ts` — the 3 violations (`localStorage` line 307, `sessionStorage` line 309, `window.location.href` line 316); `Adapter` interface (lines 13-15) to extend; `ShellOptions` + `onRedirect` (lines 188-202, 197); `processResponse()` redirect/side-effect handling (lines 304-324)
- `viewmodel-shell/src/browser.ts` — `BrowserAdapter implements Adapter`; where `navigate`/`storage`/`transport` get implemented
- `viewmodel-shell/src/server.ts` — defines `ShellSideEffect` / redirect wire shapes; OUT of guard scope but informs the contract that must stay unchanged
- `viewmodel-shell/tsconfig.json` — single shared tsconfig (`lib: ["ES2022","DOM","DOM.Iterable"]`, `include: ["src/**/*.ts"]`); explains why the no-DOM-lib guard approach was rejected
- `viewmodel-shell/package.json` — exports map (`.`, `./browser`, `./server`), version `0.3.12`, `build: tsc -p tsconfig.json`; where the `check:core-globals` npm script is added

### CI guard & verification
- `.github/workflows/parity.yml` — the existing single workflow/job; the new guard step is added here (D-10)
- `parity/run.ts` — parity harness; FeatureProbe fixture drives redirect/side-effects at the **wire level only** (D-13)
- `parity/normalize.ts` — response normalization used by the diff (read to confirm redirect/sideEffects fields are parity-covered)

### Docs to update (AGNOSTIC-04, ships with phase)
- `AGENTS.md` — asserts "core never references HTMLElement/document/platform type"; document the seam pattern + enforced invariant here
- `README.md` — public-facing; document the capability seam + the CI-enforced invariant

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`Adapter` interface (`src/index.ts:13-15`)** — already the established delegation seam (`render()`). The capability seam extends this exact pattern; no new plug-in concept needed.
- **`BrowserAdapter` (`src/browser.ts`)** — already `implements Adapter` and already owns 100% of DOM access. It is the natural and only home for the relocated `window.location`/`localStorage`/`sessionStorage` bindings.
- **`ShellOptions.onRedirect` (`src/index.ts:197`)** — a partial, already-shipped seam for the navigate verb. Its precedence-first preservation (D-05) makes the redirect refactor non-breaking by construction.
- **Parity harness (`parity/run.ts`, FeatureProbe fixture)** — the highest-signal regression check for wire-contract drift; gates the "zero observable behavior change" requirement.

### Established Patterns
- **Optional-hook precedence** — `onError`/`onLoading`/`getRequestHeaders`/`onRedirect` are all optional `ShellOptions` callbacks with `?.()` call sites. The seam follows the same optional-call idiom (`adapter.navigate?.(url)`), but with a fail-loud fallback for navigate/storage (D-06) since unlike onError/onLoading these have no safe no-op.
- **Single tsconfig over `src/**/*.ts`** — index/browser/server compile together with DOM lib included. This is why AGNOSTIC-03 is grep-based, not compiler-enforced (D-08).
- **Verification = parity (wire) + jsdom/vitest (DOM behavior)** — the framework's stated promise is "no browser runtime for tests"; the adapter test uses jsdom (already the demo-frontend test pattern), not a real browser.

### Integration Points
- `processResponse()` in `src/index.ts` (lines 304-324) is where both the side-effect loop and the redirect branch live — this is the single function the refactor rewrites to route through `adapter.storage` / (`onRedirect` → `adapter.navigate` → throw).
- New CI step slots into `.github/workflows/parity.yml` after checkout, before/independent of the parity run; npm script slots into `viewmodel-shell/package.json` scripts.
- The adapter-level test (D-12.2) is net-new infrastructure — no framework-level test harness currently exists.

</code_context>

<specifics>
## Specific Ideas

- **Hecate JWT-to-localStorage flow** (referenced by the user, mirrored in AGENTS.md `server.ts` examples using `hecate_jwt`): the canonical example of why a silent storage no-op is a *security* failure, not a cosmetic one. This is the concrete motivation behind D-06 (fail loud).
- "Don't 'improve' the `onRedirect` signature while you're in there" — preserve `(url: string) => void` exactly; precedence-first means existing consumers must see byte-identical behavior (D-04).
- "A future mobile/terminal adapter implements one interface to be a complete target — exactly the property the milestone exists to create" — the design intent test for D-01: the seam shape is correct if a non-browser adapter needs to satisfy exactly one interface.

</specifics>

<deferred>
## Deferred Ideas

- **Upload progress / `adapter.transport?` XHR override (UPLOAD-01)** — Phase 2. Phase 1 only defines the optional `transport?` extension point with `fetch` as the in-core default; the progress-capable XHR binding is built *through* the seam in Phase 2.
- **Consumer-maintainer migration blurb (MIGRATE-01)** — Phase 2 milestone closeout.
- **Extending the guard to `server.ts`** — out of scope this phase (D-11 scopes to `index.ts` only per REQUIREMENTS). Note for a future hardening pass if server-side platform leakage ever becomes a concern; not acted on now.

</deferred>

---

*Phase: 01-capability-seam-refactor*
*Context gathered: 2026-05-15*
