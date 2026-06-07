# Phase 6 Discussion Log

**Phase:** 6 — Wire Shape Change
**Date:** 2026-06-07
**Mode:** discuss (compressed — most decisions carried forward from prior milestone-design conversation)

This log captures the discussion that produced `06-CONTEXT.md`. It is for human reference only — downstream agents read CONTEXT.md, not this file.

---

## Pre-discussion state

Prior to running `/gsd:discuss-phase 6`, the user and maintainer had a multi-turn architectural design conversation that produced the v1.0.0 milestone definition. By the time discuss-phase was invoked, the following decisions were already locked from that conversation and did not need to be re-asked:

- Wire shape: `{action, state, files?}` only — no `context` field
- Every input node binds to a path in state
- Action names are unique per operation, app-named, framework-enforced at tree-build time
- Renderer is a thin interpreter — 7 context-assembly paths collapse to 1
- Files stay on multipart channel (only "everything in state" exception)
- No backwards-compatibility shims; no router primitive; no migration codemod
- Per-row identity in action name (not context payload)
- All 0.16.0 features (busy, preventUnload, side effects, polling, redirects) preserved unchanged

The user invoked discuss-phase with the instruction "you should do the discuss phase 6, since you already understand the full thing" — explicitly asking the maintainer to compress the questioning and produce CONTEXT.md based on the existing understanding plus any genuinely undecided gray areas.

---

## Gray areas surfaced

Three gray areas were identified as genuinely undecided and surfaced for user sign-off. All affected what consumers / agents would see in the JSON or how the framework would behave at the contract level.

### 1. Bind path syntax

**Question:** What syntax should the bind path use on the wire?

**Options presented:**
- Dotted string — e.g. `"fields.title"` (Recommended)
- Single key — e.g. `"title"`
- JSON pointer — e.g. `"/fields/title"`
- Other

**User selection:** Dotted string

**Captured in:** Decisions → Bind paths

### 2. Auto-dispatch on input change

**Question:** When an input changes today and dispatches an action (tab click, select-on-change, field-on-Enter, checkbox toggle), should that auto-dispatch behavior survive the wire change?

**Options presented:**
- Yes — keep auto-dispatch, just drop the context (Recommended)
- No — only write to state, require explicit dispatch
- Other

**User selection:** Yes — preserve auto-dispatch

**Captured in:** Decisions → Auto-dispatch on change

### 3. Table selection state — where it lives

**Question:** Where does the table's row-selection state live in the state model?

**Options first presented:**
- App-declared bind path on the table (`selectionBind: "..."`)
- Framework-reserved well-known path
- Other

**User reframe:** "why can't which checkboxes are checked be all that is needed?"

This was a genuine architectural insight that the maintainer had missed. The maintainer re-presented the question with a concrete example explaining that the user's framing meant removing the `TableSelection` concept entirely — selection just becomes per-row `CheckboxNode` cells bound to state paths the app chose; bulk-action buttons are plain `ButtonNode`s; the framework knows nothing about "selection" as a concept.

**Question (re-asked):** Confirm the simplification: `TableSelection` concept removed entirely; selection is just per-row CheckboxNode cells bound to state?

**User selection:** Yes, exactly

**Captured in:** Decisions → Table selection — concept removed

**Note:** This decision removes wire surface added in the recent 0.13.0 / modified in 0.15.0 changes. The net effect is a framework simplification; every selection workflow stays expressible.

---

## Deferred ideas

None surfaced during this session. Scope-creep redirections were not triggered — the conversation stayed on Phase 6's wire-shape territory.

---

## Maintainer discretion items

These were decided by the maintainer based on existing conversation context and convention, without being surfaced as gray areas:

- **State mutation semantics: in-place.** The renderer mutates the held state object in place rather than producing immutable replacements. Lighter; identity-stable between server round-trips; app authors who want immutability can return new state objects from server handlers. Did not surface because this is an implementation-detail of the renderer, not a contract-level decision.
- **Bind path resolution: array indices via numeric segments.** A path like `"rows.0.selected"` works whether `rows` is an object with key `"0"` or an array — JSON walking treats them identically. No special bracket syntax.
- **Files retain multipart side channel.** The bind path on a file input points at a serialization-safe placeholder in state; binary travels alongside as a multipart entry, keyed by input name. Unchanged from today's server-side handling.

---

## Open questions captured for the researcher

Eight implementation questions were captured in CONTEXT.md under "Open Questions Researcher Should Investigate" rather than discussed in-session, because they require codebase inspection to answer well and the planner needs concrete answers before sequencing the work.

---

*Discussion completed 2026-06-07. CONTEXT.md is the canonical record; this log is human-only reference.*
