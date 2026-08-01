# Phase 28: Rich text WYSIWYG input primitive — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-31
**Phase:** 28 — Rich text WYSIWYG input primitive
**Areas discussed:** Node shape (Q1), Toolbar shape / Route B governance (Q2), Bundling strategy (Q3)

---

## Q1 — Node shape

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Extend `FieldNode(inputType:"rich")` | Additive to existing closed union; matches the `code` inputType precedent. Vicky's original lean. | |
| (b) New dedicated `RichTextFieldNode` | Whole new node in the ViewNode union with `[JsonDerivedType]` discriminator. More surface, but isolates rich-text-only props from FieldNode. | ✓ |

**Ashley's principle:** *"do you think that there's going to be customization to the point where it deserve its own node? Because if that were the case, then we wouldn't want to be messing with field node and adding potential parameters and things like that when only the one input type would use it."*

**Vicky's answer:** Yes — real rich-text-only customization surface anticipated: `allowedMarks`/`allowedNodes` (comment-only vs full editor, Angel already asked), `mentionsProvider` (Molly's mention-picker bounty integration when it lands), `plainTextValueBind` (Notion `plain_text` pattern for previews/search/agent-audience), `heightMin`/`heightMax` (rich needs different sizing knobs than textarea's `rows`), `sanitizeConfig` (allowed link schemes / autolink behavior).

**Decision:** New dedicated `RichTextFieldNode`. Ashley's principle: future customization pressure earns the shape its own primitive.

---

## Q2 — Toolbar shape / Route B governance

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Compose from primitives for v1 | `SectionNode(layout:"row") + ButtonNode`. Zero new node. Promote later if signal. Vicky's original lean. | |
| (b) New Route B composite `RichTextToolbarNode` | Full composite with typed slots + closed-enum variance. Requires a served before/after tasting + Ashley visual sign-off BEFORE the composite lands (per Route B governance). | ✓ |

**Ashley's convergence:** *"I actually think the answer ends up in the same spot, which is that if we plan to offer any kind of customization that would start to intrude on the original node type, then B could be the better answer."*

**Vicky's answer:** Yes — real toolbar customization surface anticipated: `visibleTools` (which buttons show; comment mode = 3, full mode = 8+), a headings-dropdown (select-inside-a-toolbar shape Section+Button can't cleanly express), position variants (top/bottom/floating), compact/expanded modes, overflow-to-kebab on narrow.

**Decision:** New Route B composite `RichTextToolbarNode`. **Route B tasting owed** — a before/after page served on tailnet + Ashley visual sign-off BEFORE the composite lands. Distinct plan-task gates the composite plan-task.

---

## Q3 — Bundling strategy

| Option | Description | Selected |
|--------|-------------|----------|
| (a) Main package + lazy-import from `browser.ts` | Bundle TipTap+turndown into `@ashley-shrok/viewmodel-shell` core; dynamic `import()` inside the renderer means consumers who render no rich field ship zero bytes. Chart.js precedent. | ✓ |
| (b) Opt-in subpath `@ashley-shrok/viewmodel-shell/rich-text` | Matches `/tui` `/server` `/markdown` `/vite` subpath precedent. Vicky's original lean. | |
| (c) Companion NuGet-style opt-in package | Matches the .NET Markdown companion; overkill for a browser-only bundle. | |

**Ashley's answer:** *"for question three, I think I agree with going with A."*

**Vicky's correction:** The subpath lean was based on a false premise — that main-package bundling forces bytes on every consumer. With lazy-import via dynamic `import()` from `browser.ts` (the Chart.js pattern), consumers who never render a `RichTextFieldNode` ship ZERO TipTap/turndown bytes. So (a) is strictly simpler AND matches an established framework pattern.

**Decision:** Main package + lazy dynamic-import from `browser.ts`. Consumer bundle impact is zero for non-users.

**Symmetric requirement (banked for plan-phase):** an adapter test that renders no `RichTextFieldNode` and asserts TipTap/turndown are NOT in the initial bundle graph — makes the "lazy" property machine-verifiable rather than trusted.

---

## Claude's Discretion (implementation calls Vicky handles in plan-phase)

- **Q4 — Sanitization on the READ side** — audit-and-confirm the existing `markdown.ts` → InlineRuns pipeline is safe against malicious link schemes / autolink XSS. Not new work. If a gap surfaces, add per-response invariant coverage.
- **Q5 — Testing story** — vitest unit tests for composite + FeatureProbe parity fixture with a floor tree carrying `RichTextFieldNode`. Wire is a string, parity story is tiny.
- **Q6 — Adopter migration** — one additive CHANGELOG entry, one MIGRATION note. Additive only.
- **Q7 — Initial content pre-load** — existing `marked` (already in VMS) round-trips markdown → HTML → `editor.setContent()`; unit test the floor content.

## Deferred Ideas

- `mentionsProvider` slot (waits on Molly's mention-picker-primitive bounty)
- `plainTextValueBind` (Notion `plain_text` pattern for previews; framework-derives-it constraint applies)
- Comment-only vs full editor mode (`allowedMarks`/`allowedNodes`) — Angel-flagged; needs concrete signal
- `imageUpload` — intersects with file-input surface + file-upload-progress-drag-drop bounty; future phase
- Toolbar position/compact/overflow variants — motivated the composite decision, NOT built in this phase (the composite is the seam that lets us add them later without app changes)
- Chat-composer-primitive integration (Angel) — deferred to POST-ship
- `/ai` streaming integration — Angel low-priority
