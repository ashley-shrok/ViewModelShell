# Phase 31: TextNode.maxLines axis — Context

**Gathered:** 2026-08-03
**Status:** Ready for planning
**Source:** Design locked via 2026-08-03 tasting on tailnet (see bounty `~/.claude/identities/vicky/bounties/textnode-maxlines-axis/bounty.json`)

<domain>
## Phase Boundary

Add a Route A wire-visible axis `maxLines?: 1 | 2 | 3` to `TextNode` on both backends. Closed enum; absent = current wrap behavior unchanged (full backwards-compatible additive). CSS emits per value: `1` → single-line ellipsis (`overflow:hidden; text-overflow:ellipsis; white-space:nowrap`); `2|3` → line-clamp (`display:-webkit-box; -webkit-line-clamp:N; -webkit-box-orient:vertical; overflow:hidden`).

Composes for free into every composite carrying a TextNode slot (UserRowNode.name, ListRowNode.primary + secondary, MessageNode.content, TimelineEntryNode.description, DetailRowNode.label + value, ChipNode.label, standalone TextNode) — the axis lives on TextNode; consumers opt in by passing `TextNode(value, maxLines:N)` into a composite slot instead of a bare string.

Ship as npm 9.2.0 + NuGet 9.2.0 — MINOR bump on both (additive optional field, no wire break).

Motivating consumer: Angel /ai's sidebar session titles (2026-08-03) — she wrote server-side `.Substring(0, 16) + "…"` in `BuildSessionLabel` because VMS had no wire knob. Framework gap surfaced. Diagnosis conversation archived in `userrow-name-width-angel` bounty.

</domain>

<decisions>
## Implementation Decisions (LOCKED)

All five design questions were resolved at the 2026-08-03 tasting. Ashley visual sign-off: "all of those are limiting to the number of lines correctly."

### Value set — LOCKED closed enum `1 | 2 | 3`
- TypeScript: `maxLines?: 1 | 2 | 3` on `TextNode` interface in `viewmodel-shell/src/index.ts`.
- .NET: `int? MaxLines` on `TextNode` record in `viewmodel-shell-dotnet/ViewModels.cs`, with `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` per gotcha #8 (nullable wire fields MUST carry WhenWritingNull to prevent absent-vs-null drift).
- .NET does NOT emit a validation enum for `1|2|3` — the TS union is the closed-enum specification per AGENTS.md "closed unions enforced on ONE side only" documented invariant. Values outside `1|2|3` emitted by an app would render as an unknown class the CSS doesn't style; this matches how the framework handles other closed unions today.
- Rationale: matches MUI `noWrap` + `Typography.Text ellipsis={rows:N}` (Ant), Chakra `Text noOfLines={N}`, Bootstrap `.text-truncate`. Chakra's open int is the outlier; hold P2 discipline (a closed enum is what a wire axis should be). 90th-percentile use: 1 (hug titles / labels), 2 (list previews), 3 (message summaries).

### Tooltip auto-wire — LOCKED consumer-composed, NOT auto
- Framework does NOT auto-emit `TooltipNode` on truncation.
- Consumers who need a11y-honest reveal compose `TooltipNode` explicitly around the `TextNode`.
- Rationale: (a) truncation-detection at wire time isn't knowable — container width is client-only; auto-wire would need client-side detection + client-side node injection, which walks past "server tree is truth" (AGENTS.md philosophy #2/#3); (b) matches MUI + Ant opt-in posture (both treat tooltip as `TooltipProps` / `ellipsis={{tooltip:true}}` opt-ins, not automatic); (c) mirrors `SectionNode.collapsible` shape (framework ships the mechanism; consumers compose the affordance).

### Middle-truncate — LOCKED out-of-scope
- No `truncate: "end" | "middle"` axis.
- Rationale: universally out-of-scope in every flagship (MUI/Ant/Chakra/Bootstrap); there is no pure-CSS middle-truncate mechanism short of `text-overflow: ellipsis ellipsis` which Firefox never shipped. If a real consumer surfaces the need, separate future primitive (JS-based or a `direction:rtl` hack in a wrapper node).

### Table cell truncation — LOCKED separate axis, NOT this phase
- `TableRow.cells` is `Record<string, string>` (pure strings, not ViewNodes) — `TextNode.maxLines` cannot flow into a table cell without a separate `TableColumn.maxLines?` field.
- Explicitly out-of-scope for THIS phase. Documented as a follow-on conversation if a real consumer needs it.

### Interaction with `overflow-wrap: anywhere` — LOCKED clamp-after-wrap composes cleanly
- The existing `overflow-wrap: anywhere` on `.vms-text` and composite text slots (`.vms-user-row__name`, etc.) stays untouched.
- Line-clamp emits AFTER wrapping happens; long unbroken tokens still break within a word (as they do today). The maxLines axis caps line count, does not change wrapping behavior.

### CSS class emission — LOCKED
- BrowserAdapter adds `.vms-text--max-lines-{1|2|3}` class to the emitted `.vms-text` element when `maxLines` is set.
- Absent (unset) → no class emitted → default wrap behavior unchanged (backwards-compatible).
- Three CSS rules in `viewmodel-shell/styles/default.css`:
  ```css
  .vms-text--max-lines-1 {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: top;
  }
  .vms-text--max-lines-2,
  .vms-text--max-lines-3 {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .vms-text--max-lines-2 { -webkit-line-clamp: 2; }
  .vms-text--max-lines-3 { -webkit-line-clamp: 3; }
  ```
- No `--vms-*` token needed. No theme change. `check:aa-contrast` unchanged.

### Backend parity — LOCKED byte-identical wire
- TS emits `"maxLines": N` when set, absent when null (per WhenWritingNull-equivalent in TS: property omitted from JSON when undefined).
- .NET emits `"maxLines": N` when set, absent when null (via `[JsonIgnore(WhenWritingNull)]`).
- Parity fixture: `parity/fixtures/textnode-maxlines.json` with a controller (or existing demo backend) that renders a TextNode with each value (unset/1/2/3), diff proves identical wire, `expectBodyContains` per-step tripwires that each value's class emission is present.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Framework philosophy + gotchas (foundational)
- `AGENTS.md` — the ONE source of truth for design philosophy, gotchas (especially #8 null-omission), publishing runbook, working agreement, and the wire-parity discipline. Every plan must respect it.
- `.planning/design/composite-nodes-layer.md` §3 (typed-slots pattern) — TextNode is consumed as a slot value across every composite; the axis composes because slots are typed by semantic name, not node type.

### TypeScript backend
- `viewmodel-shell/src/index.ts` — the ViewNode union + TextNode interface. maxLines added here.
- `viewmodel-shell/src/browser.ts` — the DOM renderer. Class emission on the `.vms-text` element happens here (search for `vms-text` class emission in the TextNode render path — line ~2100-2200 area).

### .NET backend
- `viewmodel-shell-dotnet/ViewModels.cs` — the ONE home of .NET `ViewNode` records. TextNode record here; add `int? MaxLines` field with `[JsonIgnore(WhenWritingNull)]`.

### Design system
- `viewmodel-shell/styles/default.css` — three CSS rules added at the end of the `.vms-text` block.

### Parity
- `parity/backends.json` — machine registry of backends; no new backend needed.
- `parity/fixtures/` — new fixture `textnode-maxlines.json` added.
- `parity/run.ts` — driver; `expectBodyContains` per-step invariants added inline in the fixture.

### Framework tests
- `viewmodel-shell/test/` — vitest suite. New test asserts renderer emits `.vms-text--max-lines-{N}` class when maxLines is set + absents the class + attribute when unset.
- `viewmodel-shell-dotnet/Tests/` — the framework's own .NET tests. New test asserts JSON emission includes `"maxLines": N` when set + omits the key when null (validates gotcha #8 posture).

### Release ritual
- `CHANGELOG.md` — `## 9.2.0` entry.
- `MIGRATION.md` — brief adopter note (no consumer action required; axis is additive optional).
- Publishing runbook: see `~/.claude/identities/vicky/vms-map.md` "Publishing runbook" section.

</canonical_refs>

<specifics>
## Specific Design References

### The served tasting that locked the design (2026-08-03)
- URL was http://100.113.23.63:34423/ (torn down after session).
- Structure: 4 sections (standalone TextNode, UserRow.name, ListRow.primary+secondary, Message.content), each with 4 side-by-side variants (unset / maxLines:1 / maxLines:2 / maxLines:3) at selectable container widths (240/360/560px) and 13 themes.
- Mechanism: real shipped `browser.js` + `default.css`; post-render walked to `.vms-text` element inside each composite slot and applied the axis CSS as-if the axis existed.
- All four maxLines values verified to clamp lines correctly across all four composite contexts.

### Angel's original case
- Angel /ai's sidebar session titles in her Kitsune dashboard app.
- She hit the wire gap and worked around server-side via `.Substring(0, 16) + "…"` in `BuildSessionLabel`.
- `maxLines: 1` gives her the framework-provided affordance she was reaching for.
- Diagnosis + framework-gap surfacing: archived bounty `userrow-name-width-angel/`.

### Flagship survey (validated the closed-enum choice)
- MUI: `Typography noWrap` (bool for 1-line) + `Typography.Text ellipsis={rows:N}`.
- Ant Design: `Typography.Text ellipsis={rows:2}` — closed reasonable values.
- Chakra UI: `Text noOfLines={N}` — open int (the only outlier).
- Bootstrap: `.text-truncate` utility class (1-line only).
- Consensus: closed reasonable values, tooltip is opt-in, middle-truncate not part of the axis.

</specifics>

<deferred>
## Deferred (Explicitly Out-of-Scope for Phase 31)

- **`TableColumn.maxLines?`** — table cells are `Record<string, string>`, not ViewNodes; can't flow this axis through. Separate follow-on if a consumer surfaces the need.
- **Middle-truncate axis** (`abcdef…xyz`) — no pure-CSS mechanism; separate future primitive if needed.
- **Auto-wire TooltipNode on truncation** — consumer composes; not framework-automatic (rationale in decisions above).
- **Values 4+** — closed enum stops at 3; if a consumer needs 4+, that's a content problem, not a truncation problem.

</deferred>

<scope_fence>
## Scope Fence

**In scope for Phase 31:**
- Add `maxLines?: 1|2|3` field to TS `TextNode` interface (index.ts).
- Add `int? MaxLines` field to .NET `TextNode` record (ViewModels.cs) with `[JsonIgnore(WhenWritingNull)]`.
- Emit `.vms-text--max-lines-{N}` class in BrowserAdapter TextNode render path (browser.ts).
- Add 3 CSS rules to default.css.
- Add framework test in vitest suite.
- Add framework test in .NET Tests project.
- Add parity fixture `textnode-maxlines.json` with `expectBodyContains` tripwires.
- CHANGELOG.md entry (9.2.0).
- MIGRATION.md entry (brief; additive, no adopter action).
- Release: npm 9.2.0 + NuGet 9.2.0 (both minor).
- Tag + advance main + announce (`#vms-announcements`).

**Out of scope:**
- Modifying any composite's text slot rendering (they don't change — the axis composes because slots accept ViewNode).
- Adding maxLines to any other node type.
- Table cell truncation.
- Middle-truncate axis.
- Tooltip auto-wire.
- Any theme change.
- Any `--vms-*` token change.
- Companion NuGet rebuild (MINOR bump, no companion binary-compat concern — the 8.0.0 rebuild rule fires only on MAJOR bumps).

</scope_fence>

---

*Phase: 31-textnode-maxlines-axis*
*Context gathered: 2026-08-03 — design locked via served tasting*
