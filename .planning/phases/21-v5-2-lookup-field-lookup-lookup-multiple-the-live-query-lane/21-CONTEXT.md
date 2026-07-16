# Phase 21: v5.2 Lookup / remote-search reference field — Context

**Gathered:** 2026-07-16
**Status:** Ready for planning
**Source:** PRD Express Path — `.planning/design/lookup-field.md` is the **design of record, SIGNED OFF** (Ashley, 2026-07-16) after a three-part survey (mature component libraries; enterprise reference fields; the combobox a11y contract). Run `--skip-ui`: the design doc IS the design contract for this framework-drawn primitive, and its §7 is a numbered, implementable a11y spec.

> ⚠️ **PLANNER: READ `.planning/design/lookup-field.md` FIRST AND IN FULL.** It is the rationale of
> record in the same role `layout-system-research.md` serves for layout. Every decision below is
> there with its evidence. Do not re-derive, do not re-litigate, do not "improve" a LOCKED decision.

<domain>
## Phase Boundary

Close the primitive VMS has been missing since the beginning. `select`/`select-multiple` both assume the option set can be **enumerated into the tree**; the moment the set is a 5,000-person directory or an 80,000-row customer table, VMS has no answer and the app is forced into a workaround (which by our own rule is the signal a primitive is missing). The industry calls it a **lookup / reference / relation** field. Conceptually it is **not a big select**: a select says *"here are all the values, pick one"*; a lookup says *"the values are a database table — describe which row you mean."*

Ship as an aligned **npm + NuGet `5.2.0`** minor, additive (wire token stays `viewmodel-shell/1.0`), ONE tailnet verification page + ONE publish.

**In scope:** two new `FieldNode.inputType` values (`"lookup"`, `"lookup-multiple"`) across BOTH backends (`viewmodel-shell/src/index.ts` + `src/browser.ts` renderer + `styles/default.css`; `viewmodel-shell-dotnet/ViewModels.cs`); **the live-query dispatch lane** (VMS's first — see below); both tree-validators descending into the new fields; TUI degradation; parity/FeatureProbe coverage per inputType (⚠️ the ACTUAL v5.1 pattern is to EXTEND `buildVm` in the 3 FeatureProbe backends + append to the `$comment` — NOT a new fixture file, NOT a `backends.json` change; see 21-PATTERNS.md); a Showcase/demo entry; `agent-skill.md` (picker-as-public-protocol); the tailnet verification page; the aligned 5.2.0 release closeout.

**Out of scope (deferred — do NOT build):**
- **Inline caret-spliced `@mention` in prose.** Explicitly ruled out (Ashley: *"maybe we do text editing but certainly not right now"* — a NOT-NOW with the door open, NOT a permanent rejection). It's a rich-text-editor feature: not agent-drivable, needs caret-offset semantics, and would be the first inline content VMS ever put inside text.
- **`create-new-inline`** ("+ New" from inside the picker). Least essential feature in the survey; the newest mature design (Salesforce's `lightning-record-picker`) deliberately omits it.
- **`UI.TextArrangement`'s `TextSeparate`** mode (code here, text rendered elsewhere) — a layout intent no `{label,value}` pair can carry.
- **A `minChars` gate.** Nearly nonexistent in BOTH surveyed lanes (ServiceNow has no min-chars property at all; PrimeReact is the only library with `minLength`). Debounce is the real convention.
- **A `loading` wire field.** The shell already knows a dispatch is in flight — framework state, not app state. Renderer-owned.
- Appearance knobs of any kind on the wire.
</domain>

<decisions>
## Implementation Decisions

### 🚨 D1 — THE LOAD-BEARING DECISION: the label is VIEW, not STATE (LOCKED)
- **`bind` holds the id. The node carries the label.** `selected?: Array<{value: string, label?: string, type?: string}>`.
- **DIRECTION IS THE WHOLE SAFETY ARGUMENT:** `value` round-trips; the label is **server→client ONLY**, recomputed every render, **never authoritative, never trusted coming back from the client.**
- Why, from our own principles: the view is a pure function of state. The id **is** state (persists, round-trips, authoritative). The label is derived + recomputed every render + server-owned ⇒ **view**. Putting the label in the bind is putting **view into state**.
- **❌ DO NOT resolve the label from `candidates`.** This is THE TRAP and the reason this phase exists. With an id-valued field, *"filter the candidate list"* and *"forget what's selected"* are **the same operation**. Ant Design ships this failure silently (`label: ... ?? item.value` renders the raw database id); Zag chased it across four changelog entries and two years; SAP names it as its own degenerate case.
- **❌ DO NOT put `{value,label}` in the bind.** That's the component-lib consensus (6–7 of 8) but it is **an artifact of being client-only** — they hold the object because they have no server to ask. We have a server.
- **`selected` and `candidates` are SEPARATE FIELDS ON PURPOSE.** Fusing them is the original sin.

### D2 — `lookup` and `lookup-multiple` are SEPARATE inputTypes (LOCKED)
- Three-survey convergence, **contradicting** the component libs' 7/8 "multiple is a flag" consensus (wrong for the same client-only reason). Downshift charges a separate hook — *"a second widget grafted onto the first… Everyone else hides the cost."* SLDS renders single INSIDE the input (no pill element exists) vs multi as a separate pill listbox OUTSIDE.
- **Mirrors our existing `select` / `select-multiple` split — this is our existing pattern, not a new one.**
- **`select-multiple` REMAINS the control for enumerable sets. That split is an A11Y REQUIREMENT, not taste** (the APG combobox has *"tested poorly with users for more than two decades"*; GOV.UK's chips multiselect was RETIRED as inaccessible). The lookup must NEVER try to swallow `select-multiple`.
- **Sequencing:** design both; **single ships first, multi immediately behind.** Ashley's multiple-first directive = design both up front, NOT add a bool.

### D3 — Custom entries are an EXPLICIT, DECLARED axis (LOCKED — Ashley)
- `allowCustom?: boolean`. **Never inferred from behavior.** Ashley's rationale: *"choosing somebody to mention is very different from inventing a new tag"* — different ACTS sharing a widget, so the control DECLARES which it's doing.
- An invented value stays a **HOMOGENEOUS object, never a bare string** — that's why we can unify at all. MUI's `multiple+freeSolo` yields `Array<Value|string>`, a heterogeneous union forcing every consumer to branch on `typeof`; we never admit a bare string so it never arises. A free-form tag is a value whose label equals itself.
- **`allowCustom: true` + no candidates ⇒ a free-form tags input, with NO special case in the renderer.** This SUPERSEDES the separately-designed `inputType:"tags"` proposal.

### 🚨 D4 — The live-query lane (LOCKED) — THE RISKIEST TASK IN THIS PHASE
- **VMS has ZERO live-query dispatch today.** Grep-verified: every text field's action fires on **Enter only** (`browser.ts:1291-1303`), and the table's column filter is the same (keystrokes write the bind; Enter dispatches `filterAction`). **This is a genuinely new dispatch cadence.**
- `searchAction` dispatches **debounced ~250–300ms** on keystroke, riding the **EXISTING v4.2 non-blocking lane (Phases 14/15)** whose lane-aware epoch already discards stale/out-of-order responses. **This phase is that lane's first real consumer — reuse it, do NOT build a parallel mechanism.**
- `searchBind` round-trips the query so the view stays a pure function of state.
- ⚠️ **BANKED LESSON, APPLIES WITH FULL FORCE:** subtle-concurrency code needs **adversarial interleaving verification**; the first implementation is almost never right. The v4.2 build had three ship-blocking defects that were found ONLY by tracing specific two-round-trip interleavings, never by reading the code. **Each of these needs a FAIL-before/PASS-after test: user-action-races-background; background-resolves-first; rapid-fire-supersede; stale-arrives-late.** A green suite that doesn't script the interleaving proves NOTHING about the race.
- **Also check:** is this the signal for the deferred, conditional **Phase 17 admission barrier**? (Recorded as conditional-on-a-real-signal; a typeahead may be it.)

### D5 — The label is ABSENT when redundant (LOCKED)
Principle 7 applied to a pair. Salesforce sets `displayValue: null` for a plain string field, populating it **only when it carries information `value` doesn't**. ⇒ **omit `label` when it equals `value`** (exactly the free-form-tag case). `type` omitted for monomorphic refs.

### D6 — Polymorphic refs need a `type` tag (LOCKED)
Microsoft, verbatim: *"This value doesn't tell you whether the owner of the record is a user or a team."* ⇒ `{value, label?, type?}`. **Optional** — omit for monomorphic references.

### D7 — Any cap is VISIBLE in the tree (LOCKED)
Principle 8. ServiceNow is the anti-pattern: a 15-result cap applied **post-ACL behind a hard 250-row SQL ceiling** ⇒ *an exact-match record can be silently invisible.* **Our in-house answer already exists and needs NO new wire field** — the canonical table workflow's *"Refine your filter — N matches, max is X"*; the app renders a `TextNode`. **Document this on the node.**

### D8 — The picker's filter is UX, NEVER authorization (LOCKED)
Both vendors say so outright. ServiceNow: ***"To restrict what data specific users can access, use ACLs not reference qualifiers."*** Salesforce runs two layers: `lookupFilter` (metadata, enforced server-side on save) vs the component `filter` (UI-only). ⇒ **MUST be stated in the node's TSDoc** — a filter that looks like a security boundary and isn't is exactly what gets trusted by mistake.

### D9 — A11y: build to the baseline; do NOT gate the ship on a screen reader (LOCKED — Ashley)
- Ashley: *"the actual pool of users for the framework is too small for that to be something that we're worried about. And if it ever came up, we'd revisit it."*
- **Only the VERIFICATION is declined.** Building correctly is near-free up front and a rewrite to retrofit ⇒ **BUILD TO THE NUMBERED BASELINE IN design §7** (34 items; it IS the spec).
- **ONE cheap test survives** — see LOOK-05 / §7 item 8.

### 🔬 D9a — The live region reuses the EXISTING `chartInstances` idiom (CORRECTED 2026-07-16)
- A11y baseline §7 item 8: **the live region must exist EMPTY at mount and must NEVER be conditionally re-rendered.** Screen readers only announce changes to elements they already registered for; creating the element and injecting text in the same tick announces **nothing**. `BrowserAdapter` FULL-REBUILDS the tree on every response, so a naively-rendered live region **never announces — and fails SILENTLY: the page looks perfect and every structural test passes.**
- ⚠️ **CORRECTION — an earlier revision of the design doc (and of this file) told you to build a "genuinely NEW, FOURTH preservation category." THAT WAS WRONG.** Caught by the pattern-mapper; verified by grep. The mechanism already exists and has shipped since Phase 12: **`BrowserAdapter.chartInstances`** (`browser.ts:83-95`, reuse site `:676-700`). Its own comment states the exact property — *"DELIBERATELY PERSISTENT across renders (NOT reset like the per-render fields below): the canvas + Chart instance must **SURVIVE render()'s innerHTML wipe**… Instances are mark-swept (destroy()'d + deleted) in render() when the new tree drops them"* — and at the reuse site: *"Reuse the SAME canvas element (**detached by the innerHTML wipe, not destroyed**)."*
- The real distinction still holds and is worth understanding: focus/scroll/details restore **STATE** onto fresh nodes; a live region (like a canvas) needs **THE SAME NODE OBJECT**, because what survives is an *external registration* (the AT's, or Chart.js's). **But that's a distinction between two EXISTING idioms, not a gap.**
- ⇒ **DO NOT BUILD A PARALLEL MECHANISM. Copy `chartInstances`** — a persistent, mark-swept map keyed by a stable per-render ordinal, holding the live-region element(s), reattached each render. Include the mark-sweep (a lookup dropped from the tree must drop its regions) and the per-render key-counter reset idiom (`chartKeyCounter` / `chartKeysSeen`). See design D10 and `21-PATTERNS.md`.
- On Safari/VoiceOver the ARIA plumbing conveys **nothing** (verified against the APG's OWN reference example) ⇒ the live region is **the only thing that works there**. Load-bearing, not decorative.

### 🚨 D11 — `searchAction` is RENDERER-FORCED non-blocking; the app cannot opt out (NEW 2026-07-16)
- The non-blocking lane is opted into via **`ActionEvent.blocking === false`** (`index.ts:20`) — **a wire field the APP sets.** For search-as-you-type that's a footgun: an app that forgets `blocking:false` **busy-locks the whole page on every keystroke** (the framework applies `.vms-busy` for the duration of any user-initiated dispatch). Severe, silent at author time, only visible when someone types.
- ⇒ **The renderer FORCES `searchAction` non-blocking regardless of what the app declares.** A search query is *definitionally* a background question; there is no coherent app that wants a blocking one, so it isn't a choice worth exposing. Same instinct as the framework owning debounce + ordering (D4).
- **`blocking` is MEANINGLESS on `searchAction` — say so in the TSDoc** rather than letting an author think setting it does something.

### D12 — Candidate ORDER is the app's; the renderer NEVER re-sorts (NEW 2026-07-16, consumer signal)
- `candidates` order is **meaningful data**. The renderer presents them as given — **sorts nothing, dedupes nothing, truncates nothing.**
- **Why it's written down:** @molly/Metis plans to sort candidates by *recency-weighted mention frequency* server-side in her provider handler, and flagged it as *"Metis-side sort… so it doesn't touch your design."* **It does** — a renderer that helpfully alphabetized would silently destroy her ranking with no way for the app to stop it.
- Settles **OPEN-6** concretely and matches the survey: Salesforce's `searchType` **defaults to `Recent`**; Dynamics shows 5 MRU + 5 favourites (explicitly NOT filtered by the search term). **Relevance ordering is universal in mature pickers and is ALWAYS the server's judgment, never the widget's.**
- If the app wants a cap, D7 applies: say so visibly in the tree.
- **SCOPE (ambiguity caught by the planner — the fix is in the decision, not the plan):** D12 governs the **PRESENTATION of `candidates`**, NOT state writes. FORBIDDEN: reordering/filtering/deduping/truncating `candidates` for display — that list is the server's answer and the renderer has no opinion about it. ALLOWED AND CORRECT: **deduping `bind` on commit** in `lookup-multiple` (don't write the same id into the selection twice) — a state write about the user's own accumulated selection; a selection set has set semantics and a duplicate id in `bind` is meaningless. Mature libs prevent it structurally (react-select's `hideSelectedOptions` defaults on for multi). **In one line: D12 is about not second-guessing the server's answer; it is NOT a ban on the renderer having any logic at all.** Comment the distinction at the commit site.

### Cross-backend / release rules (LOCKED — from AGENTS.md)
- Byte-identical wire across TS + .NET. `allowCustom` is an optional non-nullable bool whose `false` means absent ⇒ **`[JsonIgnore(Condition = WhenWritingDefault)]`** (gotcha #8). Every nullable ⇒ `WhenWritingNull`. Otherwise it silently re-introduces null/false-vs-absent drift from the TS twin.
- **Prefer `string` over number/union** for any string-attribute-ish field (parity-drift avoidance). `selected`/`candidates` are **always arrays** — including single-select, where `selected` holds 0 or 1 entries — deliberately, so no `T | T[]` union can drift across backends.
- **AA-contrast:** the chip fill is a **NEW fg/bg pair the fixed 13-pair `check:aa-contrast` gate does NOT auto-cover.** Hand-compute across the default + all 12 themes. Consider the `--vms-surface` knockout technique (polarity-adaptive, cleared ≥3:1 on all 13 targets for the steps marker with zero per-theme deepening).
- **Verification page:** must drive the REAL shipped bundle, and **its fetch-shim MUST run `buildVm` output through the REAL tree validator** — banked lesson: the shim otherwise bypasses server-side validation and accepts trees the real server rejects (a duplicate action name anywhere in one tree is a hard validator failure; it 500'd on a real controller after sailing through a mock).
</decisions>

<open_points>
## Open points to SETTLE during planning (recorded so they're decisions, not accidents)

Design §8 carries these in full. Each needs an explicit answer in a PLAN, not an implementation accident.

- **OPEN-1 — `textArrangement` in v1 or fast-follow?** Closed enum (`"text"` default / `"text-id"` / `"id-text"`), adopted from SAP's `UI.TextArrangement`. Purely additive. **Lean: fast-follow**, to keep v1's surface honest.
- **OPEN-2 — Does `Tab` select the active option or abandon it?** ⚠️ **APG is SILENT** (its table only says where Tab *goes*). Real-world splits: IDE/URL-bar muscle memory expects Tab to accept; the other camp says Tab is navigation and must never silently commit. **Lean: close the popup, do NOT select** — non-destructive, matches Escape's keep-the-value semantics, and an accidental Tab silently committing a wrong value is unannounced data corruption. **Will generate complaints either way — wants a decision record.**
- **OPEN-3 — Is server-side "is this id one of mine?" enough to distinguish picked-from-invented**, or does an invented value need an explicit wire marker (react-select's `__isNew__` + distinct `create-option` action)? **Lean: server-decidable is enough** — but D3's whole point is that this is EXPLICIT, so **verify rather than assume**.
- **OPEN-4 — Stale-response discard-only vs cancel.** Our lane discards today (as react-select does) — correct but wasteful: the superseded request still goes out and still costs the server. On a per-keystroke directory search that's real load.
- **OPEN-5 — Search error state.** No surveyed library has a first-class one; **react-select actively SWALLOWS it** (`loader.then(callback, () => callback())`) ⇒ *a failed fetch is indistinguishable from "no results"* — a direct violation of principle 8 and a **free differentiator**. Reuse `FieldNode.error` (currently validation-shaped) or add a distinct search-error slot? **Lean: reuse**; needs a look at how `error` renders.
- **OPEN-6 — MRU empty state.** Salesforce's `searchType` **defaults to `Recent`**; Dynamics shows 5 most-recently-used + 5 favourites. Cheap UX win. It's the APP's job (it supplies `candidates` on an empty query) — the design just must not **preclude** it. **Confirm the empty-query path reaches the server at all.**
</open_points>

<constraints>
## Hard constraints

- **Green-tree gate before ANY push/publish** — full framework suite + `bun run parity/run.ts` + `npm run check:core-globals` + `viewmodel-shell-dotnet/Tests` + EVERY `demo/**/*.Tests.csproj`. No exceptions for "pre-existing" or "unrelated".
- **Never `return Ok(...)`** from a .NET controller — return `BuildVm(state)` / a `ShellResponse<TState>` directly (gotcha #1).
- **The core stays platform-agnostic** — `src/index.ts` references ZERO platform globals; `check:core-globals` gates it. All DOM work belongs in `browser.ts`.
- **Apps describe, never decorate** — zero appearance on the wire.
- **Additive only** — existing apps and wire-driving agents byte-unchanged; wire token stays `viewmodel-shell/1.0`.
- **`agent-skill.md` maintainer rule:** any wire-shape/verb/error-vocabulary change updates `viewmodel-shell/agent-skill.md` in the SAME change, then re-copy byte-identically to `viewmodel-shell-dotnet/AgentSkill.md`. `parity/check-skill.ts` gates it.
- **Git is operator-driven.** Do NOT create branches. Do NOT push. Publishing/tagging is a separate, explicitly-authorized step.
</constraints>

<success_criteria>
## What must be TRUE (from ROADMAP Phase 21)

1. **The preselected-value case works with NO search having occurred** — a form loads with a reference already set and renders its label, because the label came from the NODE, not from an empty candidate list. This is the case that kills naive designs; it is the phase's headline proof.
2. **The live-query lane is correct under adversarial interleaving**, not merely green — four scripted races, each FAIL-before/PASS-after.
3. **`lookup-multiple` chips meet the a11y baseline** (design §7) — item-specific remove labels, roving tabindex, add/remove announced with the running count, focus after removal next→previous→input and never `<body>`, chips as `role=list`/`listitem` with real buttons.
4. **The live region survives re-render with node identity intact**, proven by a jsdom test (the 4th preservation category).
5. Byte-identical across TS/.NET; both tree-validators descend; parity green with FeatureProbe coverage extended per inputType (extend `buildVm` in the 3 backends + `$comment`; NOT a new file — see 21-PATTERNS.md); TUI degrades legibly; chip fill hand-checked for AA across default + all 12 themes.
6. `agent-skill.md` documents the picker as a public first-class protocol; byte-identical .NET twin; `parity/check-skill.ts` green.
7. Aligned npm + NuGet `5.2.0` published, tagged, `main` advanced, CI green, `#vms-changelog` announced — after a tailnet verification page Ashley confirms.
</success_criteria>
