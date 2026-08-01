# Phase 28: Rich text WYSIWYG input primitive — `RichTextFieldNode` + `RichTextToolbarNode` composite + bundled TipTap + markdown-string wire — Context

**Gathered:** 2026-07-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Ship a first-class rich text WYSIWYG input primitive as a **dedicated new node** (NOT an extension of `FieldNode`). Bundle **TipTap 2.x** (headless — framework owns the toolbar and CSS) into the main `@ashley-shrok/viewmodel-shell` package, lazy-imported from `browser.ts` following the Chart.js precedent (zero bytes for consumers who never render one). Wire format is a **markdown string** on the field's bind path, converted client-side via `turndown`; on later display the value flows through the existing markdown → InlineRuns pipeline (`viewmodel-shell/src/markdown.ts` + Markdown companion NuGet) — no new render code. Toolbar ships as a **new Route B composite** (`RichTextToolbarNode`) with typed slots and closed-enum variance axes, gated on a served before/after tasting + Ashley's visual sign-off BEFORE the composite lands (per Route B governance in AGENTS.md and `.planning/design/composite-nodes-layer.md` §2).

**Feature-surface floor** (Slack/GitHub level): bold, italic, link, ordered list, unordered list, heading (h1/h2/h3), inline code, code block, blockquote. Everything else (mentions, embeds, tables, image upload, comment-only mode) is a future phase.

**Additive only** — wire protocol token stays `viewmodel-shell/1.0`. Aligned MINOR release (npm + NuGet, likely 8.2.0).

</domain>

<decisions>
## Implementation Decisions

### Node shape (Q1) — Ashley 2026-07-31
- **D-01: Dedicated new node `RichTextFieldNode`, NOT `FieldNode(inputType:"rich")`.** Rich text has a class of anticipated customization surface (`allowedMarks`/`allowedNodes`, `mentionsProvider`, `plainTextValueBind`, `heightMin`/`heightMax`, `sanitizeConfig`) that would ONLY apply to rich fields and would bloat FieldNode with a section every other inputType ignores. Ashley's principle: future customization pressure earns the shape its own primitive. New node added to both TS `ViewNode` union (`viewmodel-shell/src/index.ts`) and .NET records (`viewmodel-shell-dotnet/ViewModels.cs`) with `[JsonDerivedType]` discriminator; must appear in both tree validators.

### Toolbar shape (Q2) — Ashley 2026-07-31
- **D-02: New Route B composite `RichTextToolbarNode`, NOT `SectionNode(layout:"row") + ButtonNode` composition.** Same underlying principle as D-01: anticipated toolbar customization (`visibleTools`, headings-dropdown, position/compact variants, overflow-to-kebab) would either contaminate Section+Button props with rich-text-specific knobs or force per-consumer re-encoding. Composite is the correct abstraction seam.
- **D-03: Route B governance applies — a before/after tasting page MUST be served on the tailnet and Ashley MUST visually sign off BEFORE the composite lands in code.** Per `.planning/design/composite-nodes-layer.md` §2 (the earned-a-composite rule) and AGENTS.md "Route B composite-nodes layer". Add a distinct plan-task for the tasting; it gates the composite plan-task. Typed slots + closed-enum variance per the composite pattern in AGENTS.md §3.

### Bundling strategy (Q3) — Ashley 2026-07-31
- **D-04: Bundle TipTap + turndown into the main `@ashley-shrok/viewmodel-shell` package, lazy-imported from `browser.ts` via dynamic `import()` — matches the Chart.js precedent.** Consumers who never render a `RichTextFieldNode` ship ZERO TipTap/turndown bytes (lazy-load provides the containment). No opt-in subpath; no companion package. Rationale: subpath (`/rich-text`) was the earlier lean, but was based on the false premise that main-package bundling forces bytes on every consumer — with lazy-import via dynamic `import()`, main-package is strictly simpler AND matches an established framework pattern.
- **Symmetric requirement:** the lazy import must actually be lazy (dynamic `import()`, not top-level `import`) — verified by an adapter test that renders no `RichTextFieldNode` and asserts TipTap/turndown are NOT in the initial bundle graph.

### Locked from spike + Ashley alignment 2026-07-31 → 2026-08-01 (do NOT re-open)
- **D-05: Library = TipTap 2.x.** Alternatives (Lexical, Quill, Milkdown, Milkdown Crepe) evaluated + rejected in bounty `rich-text-input`; rationale documented (trajectory, Filament v4 precedent, server-driven-framework population signal, zero session integration fixes, cleanest custom-node API).
- **D-06: Wire format = markdown string** on the field's bind path (via `turndown` for HTML → markdown; existing `marked` for markdown → HTML on read). Zero XSS surface on the wire; zero new render infrastructure (existing markdown → InlineRuns pipeline handles display).
- **D-07: VMS owns the toolbar** (headless TipTap). Ashley's exact directive: *"we will just have to have a little friction if the toolbar doesn't come out right"* — greenlit trade of headless-library + build-our-toolbar. Do NOT re-litigate at plan-phase.
- **D-08: Feature-surface floor = Slack/GitHub level** (bold, italic, link, ordered/unordered list, headings h1-h3, inline code, code block, blockquote). Everything else deferred to real signal.
- **D-09: Additive only** — no breaking wire changes. Aligned MINOR release (likely 8.2.0). Wire protocol token stays `viewmodel-shell/1.0`.

### Claude's Discretion (implementation calls in plan-phase; Ashley can call any back into discussion)
- **Q4 — Sanitization on the READ side.** Audit-and-confirm the existing `markdown.ts` → InlineRuns pipeline is safe against malicious link schemes / autolink XSS. Add per-response invariant tests if a gap surfaces. Not new work — existing surface.
- **Q5 — Testing story.** Vitest unit tests for the composite + FeatureProbe parity fixture carrying a floor tree with `RichTextFieldNode`. Wire is a string, parity story is small.
- **Q6 — Adopter migration.** Additive; one CHANGELOG entry, one MIGRATION note. Nothing breaks.
- **Q7 — Initial content pre-load.** Existing markdown-string bind pre-loads via `marked` (already in VMS deps) → `editor.setContent()` at mount; unit test the round-trip for floor content.

### Ashley's banked directives that constrain this phase's plan
- **`autonomous: false` checkpoints ONLY for real design/taste decisions.** DO NOT insert theatrical "confirm the green-tree gate is green" checkpoints (banked 2026-07-31 in vicky.md Learned preferences). The visual-tasting checkpoint (D-03) IS a legitimate `autonomous: false` — it's Ashley's visual sign-off on a Route B composite. The green-tree gate is machine-verifiable and auto-proceeds.
- **Verify announce room ID against `/joined_rooms` BEFORE baking into the release plan** (banked 2026-07-31). Announce goes to `#vms-announcements` (`!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net`) where vicky is OWNER — NOT `#vms-changelog`. Confirmed 2026-07-31.
- **STRIP GSD-generated `checkpoint:human-action` auth-precheck tasks** (banked 2026-07-30). Ashley does not do them; agent executes the mechanical precheck inline.
- **The verification page rule** (banked 2026-07-30 v8.0.3 lesson): A/B panels that hinge on different asset versions MUST be scoped via iframes. If this phase's tasting compares approaches (compose-from-primitives vs composite, or before/after CSS), scope per-panel iframes so a shared `<script>`/`<link>` can't cross-contaminate.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design of record + governance
- `AGENTS.md` §"Route B composite-nodes layer (v8.0.0)" — the earned-a-composite governance rule, the typed-slots pattern with closed-enum variance, the tasting-before-ship requirement.
- `.planning/design/composite-nodes-layer.md` §2 (governance), §3 (typed-slots pattern), §5 (release ritual) — copy-consistent source of truth for the composite pattern; MUST be updated if this phase ships a new composite to the shipped-recipes inventory.
- `.planning/design/framework-capability-gap-survey.md` — MEDIUM-ranked rich text as a genuine capability gap; source of this phase's mandate.

### Wire types + renderer + validators
- `viewmodel-shell/src/index.ts` — TS `ViewNode` union; add `RichTextFieldNode` + `RichTextToolbarNode` interfaces + discriminator + tree validator arms.
- `viewmodel-shell-dotnet/ViewModels.cs` — .NET records; add matching records with `[JsonDerivedType]` + `[JsonIgnore(WhenWritingNull)]` per gotcha #8 on any nullable properties.
- `viewmodel-shell/src/browser.ts` — the DOM renderer. This is where the lazy `import("@tiptap/core")` + `import("@tiptap/starter-kit")` + `import("turndown")` lives (Chart.js precedent — search for `import("chart.js")` for the shape). Owns the emitted `.vms-*` classes for both nodes.
- `viewmodel-shell/src/markdown.ts` — the shipped markdown → InlineRuns pipeline that display-side rendering flows through. Sanitization audit (D-Q4) targets this file + the Markdown companion NuGet.
- `viewmodel-shell/src/server.ts` — the TS tree validator (`validateActionNames` and neighbors); the walker MUST descend into both new nodes.

### AGENTS.md non-negotiables (relevant to this phase)
- AGENTS.md §"Critical gotchas" #4 (validation-in-state, not BadRequest), #5 (UnknownActionException on default arm), #8 (null omission — `WhenWritingNull` on every nullable in the .NET twin, `WhenWritingDefault` on optional bools that mean "absent when false"), #9 (parity gate is only half the story — add `expectBodyContains` for any branch a fixture exists to cover).
- AGENTS.md §"The capability seam" — new lazy-imported library falls under the same fail-loud rule as `saveFile`/`navigate`/`storage` if it can't be loaded at runtime. Decide the load-failure behavior explicitly in plan-phase (render a fallback textarea? throw?).
- AGENTS.md §"Design system" — appearance axes (`tone`/`emphasis`/`size`/`state`/`style`) are the ONLY way to express visual variance; NO raw CSS/style on the wire. The toolbar composite's variance axes are closed enums per the layout policy.

### Cross-backend parity
- `parity/backends.json` — machine registry; a new node type needs FeatureProbe fixture coverage in ALL 3 backends (Bun handler, Node server, .NET controller).
- `parity/run.ts` — parity harness. Per gotcha #9, add `expectBodyContains` tripwires on any per-response branch the fixture exists to cover (e.g., the rich field's initial markdown content in the round-trip response).
- `parity/normalize.ts` — normalizes bodies before diff; be aware it drops nulls before diffing (class-2 blind spot from AGENTS.md).

### Companion + related bounties (interaction surface)
- `~/.claude/identities/vicky/bounties/rich-text-input/bounty.json` — the driving bounty with full evidence trail from the tasting spike.
- `~/.claude/identities/vicky/bounties/rich-text-input/spike/` — 4-panel tasting artifacts; `spike/tiptap/index.html` is the reference for the floor-toolbar wiring pattern.
- `~/.claude/identities/vicky/bounties/chat-composer-primitive/` — Angel's chat-composer ask; rich text field COULD be its compose area. Design question deferred to POST-ship — do NOT fold into this phase's scope.
- `~/.claude/identities/vicky/bounties/mention-picker-primitive/` (Molly) — future consumer of rich text via `mentionsProvider` slot; slot design in this phase should not preclude the eventual integration.

### Release ritual + credentials + green-tree gate
- `~/.claude/identities/vicky/vms-map.md` §"Publishing runbook" — the auth precheck, npm/NuGet publish commands, tag-and-advance-main flow. Read before the release plan.
- `~/.claude/identities/vicky/vms-map.md` §"The local green-tree gate" — the EXACT set of gating commands (framework vitest + core-globals + test-types + AA-contrast + no-demo-style + demo-types + parity + `viewmodel-shell-dotnet/Tests` + every `demo/**/*.Tests.csproj` + Markdown companion compile).

### Recent-phase precedents (concrete patterns to mirror)
- `.planning/phases/12-*/12-CONTEXT.md` + plans — Chart.js lazy-import + parity FeatureProbe + TUI degradation pattern; the closest structural analog to this phase.
- `.planning/phases/24-*/24-CONTEXT.md` + plans — the first Route B composites; the tasting-then-composite plan structure.
- `.planning/phases/25-*/25-CONTEXT.md` + plans — secondary composites; a good mirror for the RichTextToolbarNode slot design.
- `.planning/phases/27-*/*.md` — most recent phase (state axis uniformity); the release ritual template + the "strip theatrical checkpoints" lesson origin.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`viewmodel-shell/src/markdown.ts` + Markdown companion NuGet** — the display-side markdown → InlineRuns pipeline. The rich text wire (markdown string) round-trips into this without new render code — the same string a `RichTextFieldNode` emits on submit will render on a later view via existing infra. Zero new display code.
- **`marked` dependency** — already in VMS for the markdown → HTML path; reuse for the initial-content pre-load (markdown-string bind → `marked(md)` → `editor.setContent(html)` at mount).
- **`browser.ts` dynamic-import pattern for Chart.js** — grep for `import("chart.js")` in `browser.ts`; that is the exact shape TipTap + turndown adoption should mirror. Consumers who render no `RichTextFieldNode` get zero bytes, same as consumers who render no `ChartNode` get zero Chart.js bytes.
- **`FieldNode` per-inputType branching in `browser.ts`** — the existing switch structure the new `RichTextFieldNode` won't touch (it's a distinct node — D-01). But the renderer's `input`/`textarea`/`select` per-inputType pattern is the reference for the equivalent internal switch inside the new node's renderer (which won't have branches — just one path — but the reference for how the shipped a11y attributes get set is there).
- **Existing subpaths (`/tui`, `/server`, `/markdown`, `/vite`)** — pattern reference for how peer deps are declared; NOT the model we're adopting for TipTap (D-04), but the shape of `package.json` `exports` + `optionalPeerDependencies` is worth reading before deciding not to use it.
- **`.planning/phases/12-*` (ChartNode) — the closest structural analog.** Follow its plan sequencing: wire types → renderer with lazy-import → validators → adapter tests → parity fixture + TUI degradation → demo + release.

### Established Patterns
- **Route B composite pattern** — typed slots (leading/primary/secondary/meta/trailing + role-specific extensions), closed-enum variance axes only (tone/emphasis/size/state), NO raw CSS. `RichTextToolbarNode` must follow this shape.
- **`WhenWritingNull` on every nullable in the .NET twin** (gotcha #8) — any nullable property on either new node's .NET record needs `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`. `WhenWritingDefault` on optional bools whose `false` means "absent".
- **Tree validator descent** — both TS (`server.ts`) and .NET (`ViewModels.cs` filter) walkers must descend into new node types; forgetting this hides duplicate-action-name bugs (banked in vicky.md — 2026-07-16 Nelly finding).
- **Test-file type-checking** (`check:test-types`) — added test files must land in `tsconfig.test.json`'s coverage or they're gated by nothing (banked in vicky.md — 6.0.0 test-file leak).
- **Parity `expectBodyContains` tripwires** (gotcha #9 corollary) — any fixture step exercising a specific branch of the new node's rendering needs a `expectBodyContains` naming a substring only that branch emits, so a config change that stops firing the branch fails LOUDLY.
- **Iframe-scoped A/B verification pages** (banked v8.0.3, 2026-07-30) — the D-03 before/after tasting MUST scope per-panel via iframes if the panels rely on different asset versions.

### Integration Points
- New `ViewNode` union arm in `viewmodel-shell/src/index.ts` — extending the union is a source-only change (all `switch (node.type)` sites in `browser.ts` + validators must add the arm).
- New `[JsonDerivedType]` discriminator in `viewmodel-shell-dotnet/ViewModels.cs` — mirror-symmetric to the TS side.
- New emit sites in `viewmodel-shell/src/browser.ts` — one for `RichTextFieldNode`, one for `RichTextToolbarNode`.
- New CSS class emissions in `viewmodel-shell/styles/default.css` — `.vms-rich-text-field`, `.vms-rich-text-toolbar`, and the closed-enum variance classes (`.vms-rich-text-toolbar--{tone}`, etc.).
- New agent-skill.md entry — the wire operating manual served to agents needs a section on the rich text node (byte-identical copy in .NET `AgentSkill.md`; parity gate checks both).

</code_context>

<specifics>
## Specific Ideas

- The Chart.js precedent is the load-bearing structural reference (D-04 rationale) — plan-phase should read `browser.ts`'s dynamic-import site verbatim before writing TipTap's.
- The typed-slots pattern from AGENTS.md §"Route B composite-nodes layer (v8.0.0)" governs `RichTextToolbarNode` — slot names are `leading?`, `primary`, `trailing?`, plus rich-text-specific ones (probably `tools[]` as the button list, with a `variance?` axis for compact/expanded). Actual slot design worked in plan-phase after tasting.
- The `spike/tiptap/index.html` file under the bounty's spike folder shows a working floor toolbar in ~40 lines of vanilla JS — that is the pattern to adapt into the composite renderer, not a from-scratch design.
- The Notion `plain_text` pattern was investigated in the linked-runs design (banked 2026-07-22 lesson in vicky.md); the safety property is server-derives-it. Applied here: if `RichTextFieldNode` later adds `plainTextValueBind`, the derivation MUST be framework-side (from the markdown on read), NOT app-side.

</specifics>

<deferred>
## Deferred Ideas

- **`mentionsProvider` slot** on `RichTextFieldNode` — waits on Molly's `mention-picker-primitive` bounty. Slot shape in this phase MUST not preclude eventual integration (`mentionsProvider?: MentionPickerNode`).
- **`plainTextValueBind`** on `RichTextFieldNode` — Notion-pattern plain-text projection for search/preview/agent-audience. Real ask; defer to a follow-up phase on real signal. Framework-derives-it constraint above applies.
- **Comment-only vs. full editor mode** (`allowedMarks`/`allowedNodes`) — Angel-flagged for `/ai`. Wait for concrete signal before designing the constraint vocabulary.
- **`imageUpload`** — pasted image handling. Intersects with the existing file-input surface + `file-upload-progress-drag-drop` bounty. Future phase.
- **Toolbar position variants** (top/bottom/floating) + compact/expanded + overflow-to-kebab — enumerated in Q2 discussion as anticipated pressure that motivated the composite decision (D-02). NOT built in this phase — the composite is the ABSTRACTION SEAM that lets us add them later without changing app code.
- **Chat-composer-primitive** (bounty: `chat-composer-primitive`, Angel) — rich text field COULD be the compose area. Design question deferred to POST-ship. Do NOT fold into this phase.
- **Sanctioned integration with `/ai` streaming** — Angel's low-priority ask. Not this phase.

</deferred>

---

*Phase: 28 — Rich text WYSIWYG input primitive (RichTextFieldNode + RichTextToolbarNode composite + bundled TipTap + markdown-string wire)*
*Context gathered: 2026-07-31*
