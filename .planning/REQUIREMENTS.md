# Requirements: ViewModel Shell — Milestone 1.0.0 Truly Self-Describing Wire

**Defined:** 2026-06-07
**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end, and drivable end-to-end by an agent reading only the JSON the server emits.

**Milestone goal:** Deliver the framework's original "agents drive what the browser drives" pitch without the asterisk. Today the wire is self-describing only when paired with the browser renderer — the renderer applies scope rules that aren't in the JSON to assemble a `context` payload, so an agent driving the API directly has to mentally simulate the renderer to know what to send. v1.0.0 closes that asymmetry by eliminating `context` entirely (every input binds to a path in state; action names are unique per operation; renderer becomes a thin interpreter), and by giving every response a framework-owned `ok` flag + structured error envelope so failures are uniformly legible across every VMS app. **Hard wire-format break — no backwards-compatibility shims.** Aligned npm + NuGet `1.0.0` major bump.

## v1 Requirements

Requirements for milestone 1.0.0. Each maps to exactly one roadmap phase (numbering continues from 0.4.0 → starts at Phase 6).

### Wire

The protocol contract change — Phase 6.

- [x] **WIRE-01**: Every input node (text/number/email/password/date/time/datetime/textarea/select/checkbox/file) declares a `bind` path naming where in state its value lives. The renderer reads/writes through that path; an agent reading the JSON sees the same declaration and can mutate state directly at that path.
- [x] **WIRE-02**: The client maintains a locally-mutable copy of state. Typing in an input, changing a select, toggling a checkbox, or picking a file mutates that local state at the declared bind path in place — no DOM-only form state that has to be "harvested" later.
- [x] **WIRE-03**: The dispatch wire carries only `{action, state, files?}`. The `context` field is removed from the protocol entirely. Files remain on the multipart side channel (the only path exempt from "everything lives in state").
- [x] **WIRE-04**: Every dispatch-bearing node (button, table sort header / filter input / pagination / selection button, tabs, fields with action-on-Enter, checkbox-on-change) carries an action name only — no embedded context payload. Per-row identity (the old `context: {id: 42}` pattern) is encoded in the action name itself; the app picks its naming style.
- [x] **WIRE-05**: The framework enforces "one action name = one operation" at tree-build time. Two nodes can share an action name only if they fire the same operation; declaring the same name for semantically distinct operations is an error caught when the tree is built.
- [x] **WIRE-06**: The renderer (`viewmodel-shell/src/browser.ts`) is rewritten as a thin interpreter. The seven distinct context-assembly paths identified by the codebase audit collapse into one declarative bind-path path. No DOM harvest, no implicit scope rules, no synthetic context.
- [x] **WIRE-07**: Every demo app — `demo/Tasks`, `ContactManager`, `ExpenseTracker`, `RetroBoard`, `HelpDesk`, `FeatureProbe`, `Reorder`, Showcase, and every `-bun` twin — is migrated to the new shape. Action handlers read from state, never from a context payload; state records carry per-input values at the bound paths.
- [x] **WIRE-08**: Cross-backend parity suite (`parity/`) green across .NET / Bun / Node — every fixture rewritten to the new wire shape, every backend agrees byte-for-byte. Existing CI gates (`check:core-globals`, parity workflow) stay green.

### Error

Framework-owned error model — Phase 7.

- [ ] **ERROR-01**: The framework intercepts malformed action submissions before the app's handler runs and returns a uniform `{ok: false, errors: [{path, message}]}` envelope at 4xx. Replaces every per-app silent-revert / opaque-error convention.
- [ ] **ERROR-02**: Unknown action names (action names not present in the just-rendered tree) and uncaught exceptions from app handlers are wrapped into the same envelope shape on the way out. App handlers don't need to do anything to participate — throwing is enough.
- [ ] **ERROR-03**: Every response carries a top-level `ok: true | false` flag, set by the framework based on whether parsing, dispatching, and the app handler completed without thrown exceptions. Agents have one stable place to check across every VMS app.

### Release

1.0.0 closeout — Phase 7.

- [ ] **RELEASE-01**: Aligned `1.0.0` major bump on both npm (`@ashley-shrok/viewmodel-shell`) and NuGet (`AshleyShrok.ViewModelShell`) — wire-format change forces aligned major per the major.minor-alignment rule.
- [ ] **RELEASE-02**: `MIGRATION.md` documents the breaking change explicitly: context-payload elimination, the `bind` path on every input node, action-name uniqueness rule, the new error envelope + `ok` flag, and a per-app migration recipe. No backwards-compat shims; the doc is the upgrade path.
- [ ] **RELEASE-03**: `CHANGELOG.md` 1.0.0 entry covers the full milestone with crisp before/after framing for consumers.
- [ ] **RELEASE-04**: AGENTS.md updated — the "Critical gotchas" section (currently calls out `context`-related footguns) rewritten for the new model; the action-payload section replaced; tables / conventions / patterns sections reflect bind paths and unique action names. Documents the milestone's central promise: an agent that reads only `{vm, state}` from a GET and walks the tree can drive the entire app.
- [ ] **RELEASE-05**: Full cross-backend parity green at release time; vitest + dotnet test green; new tests cover bind-path round-trip, action-name uniqueness enforcement at tree-build, and the error-envelope shape.

## v2 Requirements

Deferred. Tracked but not in the current roadmap.

- _None — milestone scope is the architectural overhaul and its closeout._

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Backwards-compatibility shims (a "legacy `context`" reader, deprecation warnings, dual-mode renderer, migration codemod) | This milestone exists to deliver the framework as it should have been from day one. Compatibility hacks would dilute the change and entrench the asymmetry being removed. Apps migrate; the framework just ships the corrected protocol. |
| Framework-shipped action-name router / pattern-matching primitive | Action-name dispatch in handlers is a one-line `startsWith` / `switch` per app. Framework opinions on naming convention (slashes, dashes, colons) belong in apps, not in the protocol. Strike the helper. |
| Naming convention for unique action names | Each app picks the style that fits its handler ergonomics (`delete-row-42`, `row/42/delete`, etc.). Framework only enforces uniqueness, not structure. |
| Action-result type with `{success, message}` separate from state | Overlaps with state itself — the next state IS the result. Structured `errors` + the `ok` flag (ERROR-01..03) cover the agent-facing slice; no additional layer needed. |
| Bringing earlier features (busy, preventUnload, table modes, side effects, polling, redirects) into the wire change | These already work correctly and aren't `context`-bound. They continue to ship unchanged on the new wire. |
| Lenient type coercion (JSON int → string-field, etc.) as a separate framework capability | The `bind` path lands typed values directly into the state's own typing. Apps that want typed state get typed inputs; apps that want loose state can use loose state. Coercion as a separate concept disappears. |

## Traceability

Which phases cover which requirements. Phase numbering continues from 0.4.0 (Phases 3–5) → 1.0.0 starts at Phase 6.

| Requirement | Phase | Status |
|-------------|-------|--------|
| WIRE-01 | Phase 6 | Complete |
| WIRE-02 | Phase 6 | Complete |
| WIRE-03 | Phase 6 | Complete |
| WIRE-04 | Phase 6 | Complete |
| WIRE-05 | Phase 6 | Complete |
| WIRE-06 | Phase 6 | Complete |
| WIRE-07 | Phase 6 | Complete |
| WIRE-08 | Phase 6 | Complete |
| ERROR-01 | Phase 7 | Pending |
| ERROR-02 | Phase 7 | Pending |
| ERROR-03 | Phase 7 | Pending |
| RELEASE-01 | Phase 7 | Pending |
| RELEASE-02 | Phase 7 | Pending |
| RELEASE-03 | Phase 7 | Pending |
| RELEASE-04 | Phase 7 | Pending |
| RELEASE-05 | Phase 7 | Pending |

**Coverage:**
- v1 requirements: 16 total
- Mapped to phases: 16 (Phase 6: 8, Phase 7: 8)
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-07*
*Last updated: 2026-06-07 — initial requirements for 1.0.0 milestone drafted directly from the design conversation (no research pass; codebase audit by Explore agent inventoried every context-assembly path before drafting). All 16 v1 requirements mapped across Phases 6–7 (WIRE→Phase 6, ERROR+RELEASE→Phase 7).*
