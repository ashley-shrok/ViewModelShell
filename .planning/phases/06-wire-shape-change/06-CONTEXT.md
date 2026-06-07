# Phase 6 Context: Wire Shape Change

**Phase:** 6 — Wire Shape Change
**Milestone:** v1.0.0 Truly Self-Describing Wire
**Captured:** 2026-06-07
**Origin:** Decisions distilled from a long design conversation (no separate /gsd:spec-phase). Codebase audit by an Explore agent inventoried every `context`-assembly path before the conversation produced its conclusions.

---

## Domain

This phase delivers the framework's central wire-format break: **eliminate the `context` payload entirely.** Every input node declares a `bind` path into the app's state record; typing or selecting mutates the locally-held state in place at that path; on dispatch the wire carries only `{action, state, files?}`. Every dispatch-bearing node carries an action name only — no embedded data. Per-row identity moves into the action name itself (e.g. `delete-row-42` instead of `delete-row` with `{id: 42}`). The framework enforces "one action name = one operation" at tree-build time. The renderer in `viewmodel-shell/src/browser.ts` is rewritten as a thin interpreter: the seven distinct context-assembly paths collapse to one declarative bind-path path with zero DOM harvest, zero implicit scope rules, zero synthetic context. All demos are migrated. Cross-backend parity green across .NET / Bun / Node.

**Why this matters:** today the wire is self-describing only when paired with the browser renderer — the renderer applies scope rules ("buttons inside a form gather the form's inputs") that don't exist in the JSON. An agent driving the API directly has to mentally simulate the renderer to know what to send. v1.0.0 closes that asymmetry: an agent reading only `{vm, state}` from a GET, walking the tree, and reading each input's `bind` field can compose any request the browser can compose. The protocol becomes honestly self-describing rather than self-describing-when-paired-with-our-renderer.

---

## Canonical References

Downstream agents (researcher, planner, executor) MUST read these:

- `.planning/REQUIREMENTS.md` — WIRE-01..08 requirement definitions and their phase mapping
- `.planning/ROADMAP.md` — Phase 6 goal and success criteria (the falsifiable bar)
- `.planning/PROJECT.md` — Current Milestone section + Core Value (platform-agnostic transformer of a structured wire protocol)
- `AGENTS.md` (project root) — Framework conventions, especially "Critical gotchas" and "Action payload" sections (both of which this phase rewrites)
- `viewmodel-shell/src/index.ts` — Core wire-protocol types (the `ViewNode` discriminated union, `Adapter` interface, dispatch/load logic). Lines 321-352 (form harvest), 452, 526, 557, 634, 762, 790, 916, 887 are the seven context-assembly sites the audit found.
- `viewmodel-shell/src/server.ts` — TypeScript backend mirror types (the `/server` subpath that .NET-shape consumers use)
- `viewmodel-shell/src/browser.ts` — The renderer being rewritten as a thin interpreter
- `viewmodel-shell-dotnet/ViewModels.cs` — Single source for .NET `ViewNode` records (mirrored 1:1 with TS)
- `parity/backends.json` + `parity/run.ts` — Cross-backend parity harness; every fixture's wire shape changes in this phase

---

## Decisions

Locked. Downstream agents do not re-ask.

### Wire shape

- **Dispatch wire carries `{action, state, files?}` only.** The `context` field is removed from the protocol entirely. Files remain on the multipart side channel — that's the only path exempt from "everything lives in state." GET responses are unchanged in shape (`{vm, state, nextPollIn?, …}`); the load side of the contract isn't touched by this phase.
- **No backwards-compatibility shims.** No "legacy context reader," no deprecation warnings, no dual-mode renderer. The framework ships the corrected protocol; apps migrate. This is the milestone's explicit posture per PROJECT.md.

### Bind paths

- **Syntax: dotted string** — e.g. `bind: "fields.title"`, `bind: "rows.42.selected"`. Matches JS/C# property-path conventions, reads naturally in JSON, supports nested state and array-index segments without inventing query syntax. Single-key paths (e.g. `bind: "filter"`) are just the degenerate case.
- **Bind paths walk the state JSON.** A segment that's purely numeric (`"42"`) is treated as an array index when it lands inside an array; otherwise it's an object key. Apps that use stable string IDs as object keys (`rowSelections.row-42`) and apps that use array indices (`rows.0.selected`) both work without framework opinion on which is right.
- **Every input node declares its `bind`.** Text fields, number fields, email/password/date/time/datetime/textarea, selects, checkboxes (both `CheckboxNode` and `FieldNode` of type checkbox), file inputs (binding the picked `File` reference). The renderer reads the bound value to render and writes back on user input.
- **The bind path is the wire contract for inputs.** An agent reading the tree sees the bind path on each input and knows exactly which state slot a value travels through. Today's "infer from form scope" disappears.

### Action names

- **Unique per operation, app-named.** Each dispatch-bearing node declares an action name only. Per-row identity is encoded in the name itself — `delete-row-42`, `toggle-row-42`, `row/42/delete`, `tickets:42:close` — the framework doesn't have an opinion on naming style.
- **Framework enforces "one action name = one operation" at tree-build time.** When the server builds the view tree, the framework walks it and errors if two nodes that dispatch declare the same action name for semantically distinct operations. Two nodes sharing a name for the same operation (e.g. a top-of-form and bottom-of-form "Save" button firing `save-ticket-42`) is allowed and not a violation. The check happens before the tree is serialized to the wire, so the violation surfaces in development immediately.
- **No framework router primitive.** Apps handle action-name dispatch on the server side with whatever pattern fits — `switch`, `if (action.startsWith(...))`, regex match, a small per-app router. The framework provides no pattern-matching helper. The wire contract is "action is an opaque string"; everything else is app code.

### Auto-dispatch on change

- **Preserve today's auto-dispatch behavior.** Tab clicks, select-on-change, field-on-Enter, and standalone checkbox toggles continue to fire their declared action immediately. The only thing that changes is that the action no longer carries an embedded context payload — state already has the new value at the bound path, so the server reads from there.
- This preserves UX continuity (every demo today depends on immediate-feedback dispatch) and avoids forcing every consumer to add explicit "apply" buttons.

### Table selection — concept removed

- **`TableSelection` is removed from `TableNode` entirely.** Selection is no longer a framework concept. A selectable row just has a `CheckboxNode` cell bound to a state path the app chose. Bulk-action buttons ("Delete Selected", "Close Selected") are plain `ButtonNode`s wherever the app puts them; they fire action names; the server handler reads state to find rows where the bound boolean is true and acts on them.
- This removes the recent (0.13.0 → 0.15.0) local-mode `TableSelection.buttons[]` wire surface. Net simplification of the framework; every selection workflow stays expressible.
- Apps choose the shape of their per-row selection state — inline on the row record (`rows[i].selected: bool`), a sibling map (`rowsSelected: {42: true}`), a Set of IDs — framework doesn't care.

### Renderer

- **`viewmodel-shell/src/browser.ts` is rewritten as a thin interpreter.** It reads the bound state value to render each input, writes back to state on user-input events, and dispatches action names verbatim. No DOM harvest. No implicit scope rules. No synthetic context (no row-IDs-from-data-attributes, no harvest of all-form-inputs on submit, no "gather all checked checkboxes for bulk action").
- **The seven context-assembly paths identified by the codebase audit collapse to one declarative bind-path path.** Specifically — Path A (form harvest), B/C/D (immediate-dispatch field reads), E (tab value), F (table sort/filter/pagination/selection), G (button pre-baked context) all disappear; the renderer's only job is "interpret the bind declaration."
- **Client-side state mutation is a new renderer capability.** Today state is fully opaque to the renderer (only ever assigned from server responses). Under the new model, the renderer maintains a mutable local copy and writes to it at the bound path on every user-input event. State mutation semantics: **in-place mutation** of the held state object (lighter, identity-stable between server round-trips). Apps that want immutability internally can return new state objects from their server handlers; the wire doesn't care.

### Files

- **Files travel on the existing multipart side channel.** When a file input has a picked `File`, dispatch is multipart: `_action` (the JSON-encoded action), `_state` (the JSON-encoded state), plus one form-data entry per file input keyed by its `name`. The bind path on file inputs points at a slot in state that holds a serialization-safe placeholder (e.g. the filename and size); the actual binary travels alongside, keyed by the same name. Server handler reads `Request.Form.Files["<name>"]` (or the TS equivalent) — unchanged from today on the server side.
- This is the only path that doesn't fit the "everything in state" model, and it's justified: files cannot be JSON-serialized for round-trip.

### What stays intact

- All 0.16.0 features ship through this phase unchanged: `ShellResponse.busy`, `preventUnload`, side effects (`set-local-storage`, `set-session-storage`, `download`), polling (`pollInterval`, `NextPollIn`, `shell.push()`), redirects (`RedirectTo`), the capability seam (`navigate`/`storage`/`transport`/`saveFile` on `Adapter`). None of these are `context`-bound.
- The agent-discoverability `<meta name="viewmodel-shell">` tag on demo HTML stays. Bump the `protocol` token to `viewmodel-shell/1.0`.

---

## Deferred / Out of Scope

- **Lenient type coercion as a separate framework concern.** The `bind` path lands typed values directly into the state's own typing — apps that want strongly typed state get strongly typed inputs naturally. No separate coercion layer.
- **Framework-shipped action-name router.** Per the conversation: striking the helper. Apps handle dispatch in handlers with `switch` / `startsWith` / their own pattern.
- **Action-result type (`{success, message}`) separate from state.** Overlaps with state itself; the next state IS the result. ERROR-01..03 in Phase 7 handles the agent-facing slice.
- **Backwards-compatibility shims of any kind.** Belongs to "out of scope" in REQUIREMENTS.md.
- **A migration codemod.** Apps refactor by hand; the migration is straightforward and a codemod's scope would balloon. MIGRATION.md in Phase 7 is the upgrade path.

---

## Open Questions Researcher Should Investigate

These are implementation questions the planner will need answers to. The researcher (`/gsd:plan-phase` will spawn one) should produce concrete answers for each before plan creation.

1. **Action-name uniqueness check — where exactly?** The framework walks the tree at build time. Concretely: where in the .NET / TS code does that walk happen? Is it a render-time hook in `BuildVm`'s shipping path, a separate validator the controller invokes, or a parity-suite-style check? What does the error surface look like (exception, return value, log)?
2. **State mutation in the renderer — minimal API.** What's the smallest API change to `BrowserAdapter` and the core to support "renderer reads state at a bind path; renderer writes to state at a bind path; renderer keeps the mutable copy"? Does the existing `currentState` field on the shell become mutable, or does the renderer hold its own copy that syncs back on dispatch?
3. **Bind path resolution — JS implementation.** Standard library or one-file utility? `lodash.get`/`set` is the established choice but pulls a dep; a 20-line utility is the alternative. Same question for .NET — does any of this matter on the server, or is bind purely a wire-level field the server doesn't need to interpret?
4. **Wire-level shape of the bind field.** Is it always a string (`bind: "fields.title"`) or are there cases where it should be richer (e.g. `bind: {path: "fields.title", debounce: 200}`)? Recommendation: always a string for now; complexity goes in the node, not the bind.
5. **TableNode after `TableSelection` removal — what survives?** Audit every field on `TableNode` today (sort, filter, pagination, etc.) and confirm what stays vs. what collapses. Pagination state moves to a bind path (e.g. `page` slot in state). Sort state likewise. Filter values too.
6. **Per-fixture parity migration.** The seven parity fixtures all carry `context`-based action sequences today. Each one needs to be rewritten to the new wire shape. The researcher should sample one fixture end-to-end to estimate the migration shape before the planner sequences the work across all of them.
7. **Existing FieldNode interactions to preserve.** Today FieldNode supports both "be part of a form" (value harvested on submit) and "fire its own action on Enter / change" (immediate dispatch). The bind declaration replaces the form-harvest path; the immediate-dispatch path stays (auto-dispatch decision above). Confirm nothing else slips through this transition.
8. **Renderer test surface.** The current `viewmodel-shell/src/adapter.test.ts` (jsdom) tests context-assembly behavior. Under the new renderer, those tests are largely obsolete. What replaces them — bind-path round-trip tests, mutation tests, dispatch-name-only tests? Estimate the new test surface.

---

## Code Context (from prior Explore audit)

The audit fed into this conversation; capturing the key reference points here so the planner doesn't have to re-discover them.

- **Seven context-assembly paths in `browser.ts`:** Form harvest (321-352), field-text-on-Enter (526), field-select-on-change (452), standalone CheckboxNode (557), TabsNode (634), TableNode sort/filter/pagination/selection (762, 790, 916, 882-888), ButtonNode pre-baked context (580). All seven collapse into one declarative bind interpretation under this phase.
- **Dispatch wire format:** `viewmodel-shell/src/index.ts` lines 473-479. This is the code that today appends `_action`, `_state`, and file entries to `FormData`. The `_action`'s JSON-encoded `context` field is what's being removed.
- **Server parse:** `viewmodel-shell/src/server.ts` lines 26-51 (`parseFormDataAction`), and the .NET equivalent `ActionPayload<TState>.Parse` / `ParseJson`. Both currently surface `payload.Context` to handlers; under the new shape, `Context` ceases to exist as a concept — handlers read `payload.State` for everything.
- **Demo handlers today** use only scalar reads from `payload.Context` — strings, ints, bools, occasional arrays of IDs. No nested structures. Migration to "read from state" is mechanical per handler.
- **Existing TableNode wire surface** (to be reduced): `selection` (entire field removed); `sort` action's context (removed — sort state lives in state); `filter` action's context (removed); `pagination` action's context (removed).

---

## Scope Boundary

What this phase delivers: **the wire-format break and the demo migrations.** What this phase does NOT deliver:
- The error envelope and `ok` flag — Phase 7.
- The 1.0.0 version bump, MIGRATION.md, CHANGELOG.md, AGENTS.md rewrite — Phase 7.
- New protocol features beyond what removes `context` — every gray area that suggested "what if we also added X?" was deflected.

---

*Context captured 2026-06-07. Ready for `/gsd:plan-phase 6`.*
