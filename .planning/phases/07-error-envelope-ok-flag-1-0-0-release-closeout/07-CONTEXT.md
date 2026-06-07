# Phase 7: Error Envelope + ok Flag + 1.0.0 Release Closeout - Context

**Gathered:** 2026-06-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Close the v1.0.0 milestone. Two coupled deliverables:

1. **Framework-owned error envelope + top-level `ok` flag.** Every VMS response carries a top-level `ok: true | false` set by the framework — not the app. Malformed payloads, unknown action names, and uncaught handler exceptions all return a uniform `{ok: false, errors: [{path?, message, code?}]}` envelope. The framework intercepts *before* the app handler runs (for parse failures) or wraps app-thrown exceptions on the way out, so the silent-revert anti-pattern stops being writable in app code. Agents check a single field across every VMS app.

2. **1.0.0 release closeout.** Aligned npm + NuGet `1.0.0` major bump (the wire-shape break shipped in Phase 6 + the envelope/ok-flag addition in this phase are the forcing change). Consolidated MIGRATION.md, CHANGELOG.md, and a surgical AGENTS.md rewrite for the new model. Parity green; vitest + dotnet test green; new tests cover the envelope shape, the ok flag on every response shape, and the UnknownActionError pattern.

**Carried forward from Phase 6 (locked, do not re-decide):** dispatch wire is `{action, state, files?}`; every input declares a `bind` path; action names are unique per operation, enforced at tree-build time; renderer is a thin interpreter (no DOM harvest, no synthetic context); all 14 demo backends migrated; cross-backend parity green on the new wire shape; agent-discoverability `<meta>` protocol token is `viewmodel-shell/1.0`.

</domain>

<decisions>
## Implementation Decisions

### Error envelope shape

- **D-01:** Wire shape: `{ok: false, errors: [{path?: string, message: string, code?: string}]}` at the response top level. `errors` is always an array; entries always have `message`; `path` and `code` are optional (omitted when not applicable, per the published WhenWritingNull / conditional-spread null-omission convention every other VMS optional wire field uses).
- **D-02:** `path` semantics: omitted entirely for framework-originated errors that aren't tied to a specific input slot (parse error, uncaught handler exception). Present and set to a bind-path string when the error IS bound to a specific input slot — reserved for future app-thrown error paths that want to surface inline.
- **D-03:** `code` semantics: optional discriminator string for framework-classified failures. Initial vocabulary: `"unknown_action"` (set when the framework catches an `UnknownActionError`). The framework MAY set other codes for the parse-error / uncaught-exception cases; the researcher proposes the exact vocabulary; the principle is "small, stable, framework-only set" — app handlers don't set `code`. Agents that want generic handling check `ok`; agents that want to branch by failure class check `code`.

### Top-level `ok` flag — uniform on every response

- **D-04:** **`ok` is set on EVERY response shape, no conditionals.** Normal renders (`{ok: true, vm, state, ...}`), redirect-only (`{ok: true, redirect: url}`), sideEffects-only (`{ok: true, sideEffects: [...]}`), silent poll responses, busy / preventUnload toggles, anything else the framework ships out — all carry `ok: true`. Every response the framework intercepts as a failure carries `ok: false` with `errors[]`. The whole point of the flag being framework-set is that it's a stable signal across every response shape, with no per-shape conditional logic on either side of the wire.
- **D-05:** The shell's branching code is literally `if (body.ok === false) { surface VmsActionError } else { processResponse(body) }`. Same path for every successful response regardless of what payload it carries (vm + state, redirect, sideEffects, etc.).
- **D-06:** `ok` is added by the framework at the response edge — controllers / app handlers do NOT set it. In .NET, `ShellResponse<TState>` gains an `Ok = true` default property; the framework's error-wrapping path constructs the `ok: false` envelope without an app-supplied `ShellResponse<T>`. In TypeScript, `createAction`'s wrapper sets `ok: true` on the successful path; the catch branches construct the `ok: false` envelope directly.

### App validation — stays state-based (gotcha #4 canonical)

- **D-07:** **Pure framework-only ok:false.** The `ok: false` envelope is reserved for framework-detected failures only (malformed payload, unknown action, uncaught exception). App validation that the app itself decides to handle ("duplicate email", "permission denied") stays state-based per today's AGENTS.md gotcha #4: render the error in the state record (`ValidationError` field) and surface via `TextNode(state.ValidationError, "error")` in the view. Those responses are `ok: true` — the app succeeded in handling the request; the state reflects a validation outcome. This is REQUIREMENTS.md's explicit "next state IS the result" posture made concrete.
- **D-08:** Today's TS `BadRequestError` and .NET `BadRequest("...")` paths stay in the public API but their wire shape changes: the framework's catch wraps them into the new `{ok: false, errors: [...]}` envelope (instead of today's `{error: msg}` shape). They're reserved for "structurally invalid request the user can't see" (missing required action field, etc.) — not for routine app validation. MIGRATION.md teaches this split clearly.

### Unknown action detection — app-driven via `UnknownActionError`

- **D-09:** Framework does NOT re-render the tree from posted state to validate action names. Apps are responsible for surfacing unknown actions from their dispatch: the framework provides a new public `UnknownActionError(name)` exception class (both backends — TS export, .NET class). Apps add a `default:` case to their dispatch switch that throws it. The framework catches all exceptions including this one and wraps into the envelope; `UnknownActionError` is surfaced with `code: "unknown_action"` so agents can distinguish "I sent a name your tree doesn't expose" from "your handler crashed."
- **D-10:** This is mildly less strict than ERROR-02's literal wording ("action names not present in the just-rendered tree") — the action is unknown when the app says it is, not when the framework re-walks the tree and confirms. The trade-off is zero perf cost, zero controller-shape change, and zero framework opinion on the dispatch pattern (consistent with REQUIREMENTS.md's "no framework router primitive" out-of-scope). MIGRATION.md teaches the default-case pattern as the canonical migration step.

### HTTP status code policy

- **D-11:** Split by fault attribution. `ok: true` → 200. Malformed payload (parse failure) → 400. `UnknownActionError` → 400. Uncaught handler exception → 500. ANY ok:false response carries the same envelope body — only the HTTP status differs. Matches today's `createAction` policy; only the body shape changes (from `{error: msg}` to `{ok: false, errors: [...]}`).
- **D-12:** Rationale: proxies, load balancers, and infrastructure monitoring see real HTTP status codes (a 500 fires alerts; a 400 does not); the structured envelope is the body. Uniform-200 was considered and rejected — it hides 500-class faults from monitoring; the small client-side simplification (single status path) is not worth the operational regression.

### Client shell — `VmsActionError` on existing `onError`

- **D-13:** New exported class: `class VmsActionError extends Error { errors: ErrorEntry[]; status: number; code?: string }`. The shell always parses the response body — even on 4xx/5xx. On `ok: false` (or non-2xx with a parseable envelope body), the shell constructs a `VmsActionError` and surfaces it via the **existing** `onError(err)` callback. No new callback.
- **D-14:** Apps that don't care see a normal `Error` with a useful `.message` (composed from the first error entry or a summary). Apps that want the structured payload do `if (err instanceof VmsActionError) { ... err.errors ... }`. Smallest API addition; one callback to remember; non-VMS apps that wired `onError` for fetch failures keep working without change.
- **D-15:** The shell DOES NOT render a returned `vm` on `ok: false`. (Framework `ok: false` responses don't include `vm`/`state` — they're structurally just `{ok: false, errors: [...]}`.) The user's last-good UI persists; agents handle the error via the callback. If future work wants "render this form with inline errors," it can add that as a separate affordance without disturbing this contract.

### MIGRATION + AGENTS scope

- **D-16:** MIGRATION.md gains ONE comprehensive 1.0.0 section covering the entire milestone: context-payload elimination (Phase 6), bind paths on every input (Phase 6), action-name uniqueness rule (Phase 6), the new error envelope + ok flag + UnknownActionError pattern (Phase 7). Single end-to-end recipe for any consumer on 0.4.x or 0.16.x — they don't read it in two chunks. Prior sections (0.3.13, 0.4.0) kept append-only for consumers stuck on older versions.
- **D-17:** AGENTS.md gets a **surgical** rewrite matching the Phase 5 bounded-accuracy convention:
  - "Critical gotchas" section: rewritten — drop the context-related footguns (already invalid post-Phase-6), add the new state-vs-throw rule (gotcha #4 stays, refined for the ok-flag era), document the `ok` flag as the single check across responses.
  - "Action payload — JSON body" section: rewritten to show the new `{action, state, files?}` shape and the `{ok: false, errors: [...]}` envelope.
  - "Non-obvious framework behaviors" section: accuracy sweep — add the uniform-`ok` rule, the `VmsActionError` surface, the `UnknownActionError` pattern.
  - "ShellResponse<TState> reference" table: add `Ok` row (framework-set, document it).
  - Everything else: accuracy-only pass; no restructure.

### Release sequencing — bump version LAST

- **D-18:** Plan order is "expose breakage internally before consumers see it":
  1. Framework error envelope + ok flag additive on `ShellResponse<TState>` / `ShellResponseBody<TState>` (both backends). The wire shape addition.
  2. Shell-side parse-then-branch in `viewmodel-shell/src/index.ts` + new `VmsActionError` export + `onError` integration.
  3. New `UnknownActionError` class export (both backends) + sweep every demo controller's dispatch switch to add the `default:` throw.
  4. Parity fixtures updated (see D-19).
  5. Aligned npm + NuGet `1.0.0` bump + consolidated MIGRATION.md / CHANGELOG.md / surgical AGENTS.md updates.
- **D-19:** Version-bumping FIRST would publish a 1.0.0 artifact in front of consumers mid-milestone with half the changes shipped — that's how releases break. Bump in the final plan, after parity is green and migrations are done.

### Parity fixture surface — two cheap deltas

- **D-20:** **(a) Every existing step in every fixture** gets an `ok: true` assertion in the normalized response — purely additive, mechanical sweep across all 7 fixtures × 15 backends. No fixture rewrites; just adding an assertion on the existing responses.
- **D-21:** **(b) One new fixture** (FeatureProbe is the natural home — it already exercises every framework feature) covers the three envelope cases:
  - **Malformed `_action` body** → expect `ok: false`, status `400`.
  - **Unknown action name** (the controller's dispatch throws `UnknownActionError`) → expect `ok: false`, status `400`, `errors[0].code: "unknown_action"`.
  - **Deliberate uncaught-throw action handler** → expect `ok: false`, status `500`.
  
  The planner fills the exact step JSON; the locked surface is "three cases, FeatureProbe, byte-identical across .NET / Bun / Node."

### Claude's discretion

- Internal implementation locations (which file owns the wrapper that sets `ok: true` on the success path; where `VmsActionError` is constructed; the exact .NET serializer wiring) — researcher proposes, planner sequences.
- The exact `code` vocabulary beyond `"unknown_action"` — researcher proposes a small stable set; user-locked decision is just "small, stable, framework-only."
- Test file layout for new vitest / xUnit cases — planner decides per existing conventions.
- The exact wording in MIGRATION.md / CHANGELOG.md / the rewritten AGENTS.md sections — drafted in the final plan, reviewed before commit.
- Whether `errors[0].message` summarization for `VmsActionError.message` is "join with '; '" vs "first entry's message" vs "count summary" — pick whichever is clearest in practice.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project / milestone definition
- `.planning/REQUIREMENTS.md` — ERROR-01..03 + RELEASE-01..05 requirement definitions (the falsifiable bar for this phase)
- `.planning/ROADMAP.md` — Phase 7 goal + success criteria
- `.planning/PROJECT.md` — "Current Milestone: 1.0.0 Truly Self-Describing Wire" section + Validated list (Phase 6 deliverables already shipped — the foundation this phase closes out)
- `.planning/phases/06-wire-shape-change/06-CONTEXT.md` — Phase 6 locked decisions (wire shape, bind paths, action-name uniqueness, `validateActionNames` location, the renderer's interpretive model). The Phase 7 envelope sits ON TOP of these — do not re-decide them.

### Code being modified
- `viewmodel-shell/src/index.ts` — Shell `dispatch` / `load` / `processResponse` paths; today's `if (!res.ok) throw` paths at lines 450 and 523 that lose the structured body and become the new parse-then-branch on `body.ok`. The `ShellOptions.onError` callback (line 373) is the surface to integrate `VmsActionError` into. `ShellResponse` interface (line 403) gains an `ok` field.
- `viewmodel-shell/src/server.ts` — `createAction` (line 343) is the framework's TS error-wrapping point. The existing `BadRequestError` (line 321) stays in the public API but its wire shape changes. Today's `{error: msg}` body construction at lines 357, 367, 383 becomes the new envelope. New exports to add: `UnknownActionError`, `VmsActionError`-equivalent type definitions, response-builder helpers if any.
- `viewmodel-shell-dotnet/ViewModels.cs` — `ShellResponse<TState>` (line 85) gains `Ok = true` default property. `ActionPayload<TState>.Parse` / `ParseJson` (lines 36, 49) throw `ArgumentException` today; that path needs to surface through the framework wrapper as the envelope. `ViewTreeValidation.ValidateActionNames` (line 369) — same exception model as today, just wrapped at the response edge. New class to add: `UnknownActionException` (the .NET twin).
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — version bump in the closeout plan.
- `viewmodel-shell/package.json` — version bump in the closeout plan.

### Demo controllers (sweep targets for the `default:` throw migration)
- `demo/Tasks/AspNetCore/TasksController.cs` + `demo/Tasks-bun/server.ts`
- `demo/ContactManager/AspNetCore/ContactsController.cs` + `demo/ContactManager-bun/server.ts`
- `demo/ExpenseTracker/AspNetCore/ExpensesController.cs` + `demo/ExpenseTracker-bun/server.ts`
- `demo/RetroBoard/AspNetCore/RetroBoardController.cs` + `demo/RetroBoard-bun/server.ts`
- `demo/HelpDesk/AspNetCore/AgentController.cs` + `demo/HelpDesk/AspNetCore/RequesterController.cs` + `demo/HelpDesk-bun/server.ts`
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` + `demo/FeatureProbe-bun/server.ts` + `demo/FeatureProbe-node/server.ts`
- `demo/Reorder/AspNetCore/ReorderController.cs` + `demo/Reorder-bun/server.ts`

### Parity harness
- `parity/backends.json` — backend registry; no entries added by this phase, only the new fixture is registered.
- `parity/run.ts` — harness logic; new envelope assertions added.
- `parity/fixtures/` — every existing fixture gets the `ok: true` assertion sweep; one new fixture file is added for the envelope cases (FeatureProbe-hosted).

### Release artifacts (updated in the closeout plan)
- `MIGRATION.md` (repo root) — append the consolidated 1.0.0 section per D-16.
- `CHANGELOG.md` (repo root) — 1.0.0 entry with crisp before/after framing per RELEASE-03.
- `AGENTS.md` (repo root) — surgical rewrite per D-17.
- `README.md` (repo root) — accuracy check; bump any version examples to 1.0.0.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets
- **Existing exception → 400/500 wrapping in `createAction`** (`viewmodel-shell/src/server.ts` lines 350-372). The structural pattern (try/catch around parse + handler, JSON response body, status branching) is exactly right for the envelope migration — we just swap the body shape and add `ok: true` on the success path.
- **`BadRequestError` class** (`server.ts` line 321) — keep as public API, change its catch-arm body construction to the new envelope.
- **`validateActionNames` walk** (`server.ts` line 39; `ViewModels.cs` line 369) — same model the framework already uses to walk the tree at response edge. The Phase 7 wrapper sits at the same layer.
- **`.NET ShellResponse<TState>` record** (`ViewModels.cs` line 85) — additive `Ok` property fits the existing record-with-defaults pattern; the existing `Validate()` chain (line 127) is where the framework already does response-edge work.
- **Polymorphic JSON wiring** in both backends already handles the discriminated-union pattern needed for `errors[]` entries — no new serializer config required.

### Established patterns
- **Wire-additive-with-WhenWritingNull omission** — already canonical (see PROJECT.md gotcha #6 and the conditional-spread `download` factory at `server.ts` line 308). `path?` and `code?` on error entries follow the same shape: `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` on .NET, conditional spread on TS.
- **Idempotent-on-every-response wire fields** — the Phase 6 `Busy` / `PreventUnload` pattern is the template for "framework sets this on every response, shell branches on it." `ok` follows the same shape, just at the highest priority (checked before anything else).
- **Demo controller dispatch switches** (every `*-Controller.cs` and every `-bun/server.ts`) — already have `switch (payload.Name)` shapes with a `default: return BadRequest(...)` or `default: throw new BadRequestError(...)` arm. The sweep replaces those with `default: throw new UnknownActionException(payload.Name)` / `throw new UnknownActionError(payload.name)` — mechanical.
- **Parity-suite shape** — `parity/run.ts` already normalizes responses for byte-comparison across backends. The `ok: true` assertion sweep is one line per fixture step in the normalized form; the new envelope fixture is one new file matching the existing fixture file template.
- **Bounded AGENTS.md updates** (Phase 5 EXAMPLES-03 / Phase 6 RELEASE-04 convention) — accuracy-only sweep, no restructure. This phase follows the same bound.

### Integration points
- **Shell `processResponse`** (`index.ts` line 613) is where the `if (body.ok === false)` branch lands. The success path is unchanged; the failure path constructs `VmsActionError` and routes to `onError`.
- **Shell `load()` path** (`index.ts` line 443) — should ALSO check `body.ok` on GET responses for symmetry (D-04 says `ok` is on every response). Researcher confirms the GET error path; mechanism is the same.
- **`shell.push()`** (line 547) — external push consumers MAY feed `ok: false` responses (e.g. an SSE stream surfacing a server error). The same branching applies. No new API surface, just behavior consistency.
- **TS `createAction` wrapper** — the central point where every successful return acquires `ok: true` and every caught exception becomes `ok: false`. Apps that bypass `createAction` (custom routing) need to surface this; document in MIGRATION.md.
- **.NET controllers** — equivalent wrapper layer is the existing `ShellResponse<TState>.Validate()` chain + a new framework helper (e.g. `ShellResponse<TState>.AsActionResult()` or a controller filter) that adds `Ok = true` and converts framework exceptions to envelope responses. Researcher proposes the exact mechanism; the constraint is "apps don't need per-controller boilerplate to get `ok` set."

</code_context>

<specifics>
## Specific Ideas

- **"if (body.ok === false) { surface VmsActionError } else { processResponse(body) }"** — user's exact phrasing for the shell branch. This is the literal shape.
- **`code: "unknown_action"`** — user-introduced discriminator on framework-classified failures. The `code` field is canonical on error entries; the initial vocabulary is just `"unknown_action"` (more codes may be added by the researcher for parse / uncaught-exception cases; framework-set only).
- **"expose breakage internally before consumers see it"** — user's principle for plan sequencing. Version bump is the LAST plan, after parity is green.
- **FeatureProbe is the natural home for the new envelope fixture** — it already exercises every framework feature; one new fixture file there covers all three envelope cases (malformed / unknown / uncaught).
- **Single end-to-end 0.4.x→1.0.0 recipe in MIGRATION.md** (not two chunks for Phase 6 + Phase 7) — consumers upgrade once, read the recipe once.

</specifics>

<deferred>
## Deferred Ideas

- **Framework re-rendering the tree from posted state for unknown-action detection.** Rejected for this phase (D-09 / D-10) — costs an extra `buildVm` per dispatch, requires every controller to surface `buildVm` to the framework, and the app-driven default-throw covers the practical case. Revisit only if real apps prove the default-throw discipline isn't holding.
- **Render-on-ok:false** — D-15 says the shell does not render a returned `vm` on `ok: false`. Future "show the form with inline app validation errors via the envelope" flows are explicitly out of scope for v1.0.0; app validation stays state-based (D-07). If that proves limiting in v1.x, revisit.
- **Framework-shipped action-name router / pattern-matching primitive** — out of scope per REQUIREMENTS.md; the `default: throw UnknownActionError` pattern is the canonical handler-side surface.
- **Action-result type separate from state (`{success, message}`)** — out of scope per REQUIREMENTS.md; the next state IS the result; the `ok` flag + structured `errors` cover the agent-facing slice.
- **A migration codemod** — apps refactor by hand; MIGRATION.md is the upgrade path.
- **AGENTS.md full restructure** — bounded accuracy-only pass this phase (D-17). A larger structural rewrite, if ever needed, is its own work.
- **Expanded `code` vocabulary beyond `"unknown_action"`** — researcher proposes a small stable set for the other framework-originated cases; broader app-set codes are explicitly out of scope (framework-only set).

</deferred>

---

*Phase: 7 — Error Envelope + ok Flag + 1.0.0 Release Closeout*
*Context gathered: 2026-06-07*
