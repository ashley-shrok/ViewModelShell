# Phase 7: Error Envelope + ok Flag + 1.0.0 Release Closeout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-07
**Phase:** 7 — Error Envelope + ok Flag + 1.0.0 Release Closeout
**Areas discussed:** App validation pattern, Unknown action detection, ok:false response plumbing (status codes + shell API + path semantics), MIGRATION + AGENTS scope, ok-flag uniformity / release sequencing / parity surface (follow-up)

---

## App validation pattern

| Option | Description | Selected |
|--------|-------------|----------|
| Pure framework-only ok:false | App validation = state-based, period (today's gotcha #4 stays canonical). ok:false reserved for framework-detected failures only: malformed payload, unknown action, uncaught exception. Today's `BadRequestError`/`BadRequest('...')` get wrapped into the new envelope so the wire stays uniform, but apps shouldn't reach for them for normal validation. | ✓ |
| App-throwable ValidationError | Add a public `ValidationError({path, message})` class apps can throw. Framework catches and emits ok:false. Apps choose per case: state-based for inline form errors, throw for "this whole request is rejected" (auth, permissions, structural). Two valid app patterns; documented split. | |
| Deprecate BadRequestError entirely | Remove `BadRequestError`/`BadRequest('...')` from the public API. Only the framework decides ok:false. Anything an app wants to surface goes through state. Most opinionated; forces every consumer to migrate any explicit error-throwing today. | |

**User's choice:** Pure framework-only ok:false (Recommended).
**Notes:** REQUIREMENTS.md's existing exclusion of a separate action-result type ("the next state IS the result") was the anchor. App validation stays state-based; the ok:false envelope is a framework-only signal.

---

## Unknown action detection

| Option | Description | Selected |
|--------|-------------|----------|
| App-driven via thrown UnknownActionError | Framework doesn't re-render the tree. Apps add a default case to their dispatch switch: `default: throw new UnknownActionError(payload.name)`. Framework catches all exceptions and wraps. Zero perf cost, no API restructure, slightly less strict than the spec wording. MIGRATION.md teaches the default-case pattern. | ✓ |
| Framework re-walks the tree via registered buildVm | `createAction(handler, buildVm)` takes both. Framework runs `buildVm(payload.state)`, walks the tree, collects action names; if `payload.action.name` isn't in the set, returns ok:false BEFORE the handler runs. Truest to the spec. Costs one extra buildVm per dispatch; requires every controller to surface buildVm to the framework. | |
| No explicit framework check; rely on uncaught exceptions | Don't add an UnknownActionError class or a framework re-walk. Apps just let unknown actions hit their default-throw / no-op behavior. Framework catches throws as uncaught and wraps. Simpler still but loses "before handler runs" guarantee from ERROR-02 wording. | |

**User's choice:** App-driven via thrown UnknownActionError (Recommended).
**Notes:** The Option-A approach (framework re-renders the tree) would restructure the controller pattern across both backends and add a per-dispatch perf cost, all to satisfy a spec wording that the default-throw pattern satisfies in practice.

---

## ok:false response plumbing — HTTP status codes

| Option | Description | Selected |
|--------|-------------|----------|
| Split: 400 client-fault, 500 server-fault | Malformed payload → 400. Unknown action (UnknownActionError) → 400. Uncaught handler exception → 500. ok:true → 200. Matches today's createAction policy — only the body shape changes. | ✓ |
| Uniform 200 (semantics in body) | All ok:false also returns HTTP 200; the shell always parses the body and branches on `body.ok`. Single client code path. Loses real HTTP status signal to monitoring; uncaught 500s look like 200s to infrastructure. | |
| All ok:false → 4xx (no 5xx) | Even uncaught handler exceptions return 4xx (e.g. 422) since the envelope is structured. Monitoring stops distinguishing server bugs from client errors at the HTTP layer. Simpler client routing but hides genuine server faults. | |

**User's choice:** Split: 400 client-fault, 500 server-fault (Recommended).
**Notes:** Preserves operational visibility for monitoring; structured envelope is the body; matches the established `createAction` policy.

---

## ok:false response plumbing — client shell API

| Option | Description | Selected |
|--------|-------------|----------|
| Typed VmsActionError on existing onError | Shell always parses the body even on 4xx/5xx. On ok:false, surfaces via the existing `onError(err)` callback, but `err` is a `VmsActionError extends Error` carrying `.errors: ErrorEntry[]` and `.status: number`. Apps that don't care see a normal Error with a useful `.message`; apps that want the structured payload `instanceof VmsActionError` to branch. Smallest API addition; one callback to remember. | ✓ |
| New dedicated onActionError callback | Add `ShellOptions.onActionError?: (envelope, status) => void` separate from `onError`. Strict split. Cleaner separation but two callbacks to wire. | |
| Render-and-surface | If the ok:false body includes a `vm`, render it AND call onError. Otherwise just onError. Allows future "show the form with inline errors" flows without API churn but adds one more conditional path now. | |

**User's choice:** Typed VmsActionError on existing onError (Recommended).
**Notes:** Single callback, single class, type-discriminated. Non-VMS apps with `onError` already wired keep working.

---

## ok:false response plumbing — `path` field semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Optional, omitted when not bound to an input | Shape: `errors: [{path?: string, message: string}]`. Framework-originated errors (parse, unknown action, uncaught exception) omit `path` entirely — matches the published WhenWritingNull/conditional-spread convention every other VMS optional field uses. When future app code wires an error to a specific bind path, it sets `path`. | ✓ |
| Always string, empty for global | Shape: `errors: [{path: string, message: string}]`. `path` always present; framework errors set it to `''`. Every entry has the same shape, no optionality branch. Slightly noisier on the wire; breaks the null-omission convention. | |
| Specific tokens for framework cases | Parse errors use sentinel tokens like `'_action'` / `'_state'`; unknown actions use `'_action.name'`; uncaught exceptions omit. Most informative for debugging but invents a vocabulary agents need to learn. | |

**User's choice:** Optional, omitted when not bound to an input (Recommended).
**Notes:** Stays consistent with VMS's null-omission contract on every other optional wire field.

---

## MIGRATION + AGENTS scope

| Option | Description | Selected |
|--------|-------------|----------|
| Consolidated 1.0.0 recipe + surgical AGENTS rewrite | MIGRATION.md gains ONE comprehensive 1.0.0 section: a single end-to-end recipe for 0.4.x/0.16.x → 1.0.0 (covers context elimination, bind paths, action-name uniqueness, error envelope, ok flag). AGENTS.md surgical: rewrite Critical Gotchas + Action Payload sections, accuracy-only sweep elsewhere. | ✓ |
| Two sections in MIGRATION + AGENTS restructure | MIGRATION.md gets two clearly separated 1.0.0 subsections (Phase 6 wire shape first, Phase 7 error envelope/ok flag second). AGENTS.md gets a full restructure now — reorganize Architecture/Patterns/Tables to make bind+ok the canonical narrative. More work, cleaner story for new readers. | |
| Single recipe + new agent-facing 'protocol' page | MIGRATION.md: one consolidated 1.0.0 recipe. AGENTS.md: surgical. PLUS a new dedicated `PROTOCOL.md` or README section aimed at agents driving the wire. Highest-leverage doc work for the "agents drive what the browser drives" pitch. | |

**User's choice:** Consolidated 1.0.0 recipe + surgical AGENTS rewrite (Recommended).
**Notes:** Matches the Phase 5 bounded-accuracy convention; one end-to-end recipe for consumers (they upgrade once, read it once).

---

## Follow-up — ok flag uniformity, release sequencing, parity surface

User provided unprompted depth on three follow-up questions, all locked into CONTEXT.md:

**ok flag uniformity:** `ok` is set on EVERY response shape with no conditional logic. Normal renders, redirect-only (`{ok:true, redirect:url}`), sideEffects-only, silent polls, busy/preventUnload toggles — all carry `ok: true`. The shell's branching code is literally `if (body.ok === false) { surface VmsActionError } else { processResponse(body) }`. The point of the flag being framework-set is that it's stable across every response shape with no per-shape conditional logic on either side of the wire.

**Release sequencing:** "expose breakage internally before consumers see it." Plan order is (1) framework envelope + ok flag, (2) shell-side parse-then-branch + VmsActionError, (3) UnknownActionError + demo controller sweep, (4) parity fixtures, (5) aligned npm + NuGet 1.0.0 bump + docs. Version bump LAST so a published 1.0.0 artifact never sits in front of consumers mid-milestone.

**Parity fixture surface:** two cheap deltas. (a) Every existing step in every fixture gets an `ok: true` assertion in the normalized response — mechanical sweep across all 7 fixtures × 15 backends. (b) One new fixture in FeatureProbe exercises the three envelope cases: malformed `_action` body → 400; unknown action name → 400 with `code: "unknown_action"`; deliberate uncaught throw → 500. Byte-identical across .NET / Bun / Node.

---

## Claude's Discretion

- Internal implementation locations (which file owns the wrapper that sets `ok: true` on the success path; where `VmsActionError` is constructed; the exact .NET serializer wiring) — researcher proposes, planner sequences.
- The exact `code` vocabulary beyond `"unknown_action"` — researcher proposes a small stable framework-only set; user-locked decision is just "small, stable, framework-only."
- Test file layout for new vitest / xUnit cases — planner decides per existing conventions.
- The exact wording in MIGRATION.md / CHANGELOG.md / the rewritten AGENTS.md sections — drafted in the closeout plan, reviewed before commit.
- `VmsActionError.message` composition (first entry vs joined vs count summary) — pick whichever reads clearest.

## Deferred Ideas

- Framework re-rendering the tree from posted state for unknown-action detection — revisit only if real apps prove the default-throw discipline isn't holding.
- Render-on-ok:false (showing forms with inline app-validation errors via the envelope) — explicitly out of scope; app validation stays state-based for v1.0.0.
- Framework-shipped action-name router / pattern-matching primitive — out of scope per REQUIREMENTS.md.
- Action-result type separate from state (`{success, message}`) — out of scope per REQUIREMENTS.md.
- Migration codemod — apps refactor by hand.
- AGENTS.md full restructure — bounded accuracy-only pass this phase.
- Expanded `code` vocabulary set by apps — framework-only set.
