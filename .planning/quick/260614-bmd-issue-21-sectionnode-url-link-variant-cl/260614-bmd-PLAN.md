---
phase: 260614-bmd-issue-21-sectionnode-url-link-variant-cl
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/src/server.ts
  - viewmodel-shell/src/tui.tsx
  - viewmodel-shell/styles/default.css
  - viewmodel-shell/test/section-link.test.ts
  - viewmodel-shell/test/tree-walker.test.ts
  - viewmodel-shell-dotnet/ViewModels.cs
  - viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - demo/FeatureProbe-bun/handler.ts
  - parity/fixtures/feature-probe.json
  - demo/Showcase/frontend/src/main.ts
  - viewmodel-shell/package.json
  - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
  - CHANGELOG.md
  - MIGRATION.md
autonomous: true
requirements:
  - ISSUE-21
must_haves:
  truths:
    - "A SectionNode with `link: { url, external? }` set renders as a wrapping `<a href=url>` element so every native browser link affordance (left-click navigate, middle-click new tab, Ctrl/Cmd-click new tab, Shift-click new window, right-click context menu, drag-to-bookmarks, status-bar URL preview) works WITHOUT custom JS."
    - "`external: true` adds `target=\"_blank\" rel=\"noopener noreferrer\"` — byte-identical to LinkNode's external handling."
    - "Clicks on nested ButtonNode / CheckboxNode / FieldNode / linkLabel anchors INSIDE a linked card do NOT also fire the link navigation (stopPropagation + preventDefault containment)."
    - "A SectionNode without `link` AND without `action` renders byte-identical to today's output (no `<a>` wrapper, no class drift, no extra attrs)."
    - "Tree validation rejects {link + action} on the same SectionNode with `invalid_tree` (dispatcher OR navigator, never both)."
    - "Tree validation rejects {link + collapsible: true} on the same SectionNode with `invalid_tree` (same rationale as action+collapsible — the summary IS the click target)."
    - "Tree validation rejects a SectionNode.link nested inside another SectionNode.link with `invalid_tree` (nested `<a>` is an HTML5 spec violation)."
    - "Tree validation rejects a SectionNode.link nested inside a SectionNode.action (and vice versa) — same overlap-ambiguity rationale as action-in-action."
    - "Wire stays absent when `link` is omitted (JsonIgnore-on-null on the .NET nullable; optional field in TS)."
    - "AA-contrast guard passes for `.vms-section--linked:focus-visible` on default + all 12 themes (reuses the same `--vms-accent` token gated by existing pair coverage)."
    - "Cross-backend parity (TS + .NET) emits byte-identical wire for `link` present and absent; verified by the FeatureProbe fixture."
  artifacts:
    - path: "viewmodel-shell/src/index.ts"
      provides: "SectionNode.link?: { url: string; external?: boolean } declaration with TSDoc"
      contains: "link?: { url: string"
    - path: "viewmodel-shell/src/browser.ts"
      provides: "linked-card <a href> wrapper + containment wiring for nested interactives"
      contains: "vms-section--linked"
    - path: "viewmodel-shell/src/server.ts"
      provides: "validateSectionAction extended to enforce link/action/collapsible/nesting rules"
      contains: "section.link"
    - path: "viewmodel-shell/src/tui.tsx"
      provides: "TUI section.link routes Enter to navigate(url) (mirrors LinkNode TUI handling)"
    - path: "viewmodel-shell/styles/default.css"
      provides: ".vms-section--linked cursor + hover + :focus-visible outline + anchor reset (no underline, inherit color)"
      contains: ".vms-section--linked"
    - path: "viewmodel-shell/test/section-link.test.ts"
      provides: "jsdom test suite for SectionNode.link — anchor emission, external attrs, containment, ARIA, backward-compat baseline"
    - path: "viewmodel-shell-dotnet/ViewModels.cs"
      provides: "SectionNode.Link SectionLink? = null appended, JsonIgnore-on-null + extended ValidateSectionAction walk"
      contains: "SectionLink? Link = null"
    - path: "viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs"
      provides: ".NET tree-validation facts for the four new rejected combos + positive baseline"
    - path: "demo/FeatureProbe/AspNetCore/FeatureProbeController.cs"
      provides: "linked-card section in FeatureProbe (.NET) for parity coverage"
    - path: "demo/FeatureProbe-bun/handler.ts"
      provides: "linked-card section in FeatureProbe (bun twin)"
    - path: "parity/fixtures/feature-probe.json"
      provides: "fixture step that exercises a SectionNode.link card (parity gate — both backends emit byte-identical wire)"
    - path: "demo/Showcase/frontend/src/main.ts"
      provides: "Showcase demo of section.link (e.g. 'Read the docs' / 'View on GitHub' tile)"
    - path: "CHANGELOG.md"
      provides: "1.5.0 / 1.4.0 entry"
    - path: "MIGRATION.md"
      provides: "1.5.0 / 1.4.0 entry (additive — no consumer action required)"
  key_links:
    - from: "viewmodel-shell/src/browser.ts (section renderer)"
      to: "LinkNode renderer at browser.ts ~line 661-671"
      via: "shared idiom — same href + target=_blank + rel=noopener noreferrer attribute pattern"
      pattern: "external.*target.*rel"
    - from: "viewmodel-shell/src/browser.ts (section renderer non-collapsible branch)"
      to: "SectionNode.action wiring at browser.ts ~line 321-358"
      via: "sibling idiom — link replaces <section> with <a>; same containment selector list"
      pattern: "vms-section--linked"
    - from: "viewmodel-shell/src/server.ts (validateSectionAction)"
      to: "ShellResponse server-side validation pipeline (createAction)"
      via: "extended walk handles link parameter alongside action"
      pattern: "validateSectionAction"
    - from: "viewmodel-shell-dotnet/ViewModels.cs (ValidateSectionAction walk)"
      to: "ShellResponse<TState>.Validate() at ViewModels.cs ~line 207-211"
      via: "existing wire-edge validation seam invokes the extended walk"
      pattern: "ViewTreeValidation.ValidateSectionAction"
---

<objective>
Add `SectionNode.link` — a URL-link variant of the clickable-card primitive that mirrors `SectionNode.action` (1.4.0) but emits a wrapping `<a href>` so every native browser link affordance works for free: middle-click opens in new tab, Ctrl/Cmd-click opens in new tab, Shift-click new window, right-click context menu, drag-to-bookmarks, status-bar URL preview, accessible link semantics. Closes [issue #21](https://github.com/ashley-shrok/ViewModelShell/issues/21).

Purpose: `SectionNode.action` (1.4.0) covers the dispatcher case (clicking the card runs server-side work). When the card is conceptually a NAVIGATIONAL link (docs tile, gallery item, launcher tile), nesting a LinkNode inside loses click-anywhere ergonomics, and using `.action` + server redirect loses every modifier-click behavior. `SectionNode.link` is the navigator sibling — same click-anywhere ergonomics, native link semantics.

Output: TS interface field + .NET record positional param + renderer wires `<a href>` wrapper + CSS class + jsdom test suite + .NET validation tests + parity fixture coverage + Showcase demo update + CHANGELOG/MIGRATION entries + lockstep MINOR version bumps (`@ashley-shrok/viewmodel-shell` 1.4.0 → 1.5.0; `AshleyShrok.ViewModelShell` 1.3.0 → 1.4.0). Per-section identity is encoded by the URL itself; the dispatcher (`.action`) and navigator (`.link`) are mutually exclusive on a single section (enforced by tree validation at both backends).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/home/ubuntu/ViewModelShell/AGENTS.md
@/home/ubuntu/ViewModelShell/viewmodel-shell/src/index.ts
@/home/ubuntu/ViewModelShell/viewmodel-shell/src/browser.ts
@/home/ubuntu/ViewModelShell/viewmodel-shell/src/server.ts
@/home/ubuntu/ViewModelShell/viewmodel-shell/src/tui.tsx
@/home/ubuntu/ViewModelShell/viewmodel-shell-dotnet/ViewModels.cs
@/home/ubuntu/ViewModelShell/viewmodel-shell/styles/default.css
@/home/ubuntu/ViewModelShell/viewmodel-shell/test/section-action.test.ts
@/home/ubuntu/ViewModelShell/viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs
@/home/ubuntu/ViewModelShell/parity/fixtures/feature-probe.json
@/home/ubuntu/ViewModelShell/CHANGELOG.md
@/home/ubuntu/ViewModelShell/MIGRATION.md
@/home/ubuntu/ViewModelShell/.planning/quick/260614-9hq-add-sectionnode-action-clickable-cards-p/260614-9hq-SUMMARY.md

<interfaces>
SectionNode.action (1.4.0) is the precedent. SectionNode.link mirrors that idiom — same containment selectors, same validation seam, same fail-loud "pick one" disposition — but emits a wrapping `<a href>` element instead of a `<section role="button">`. The reason for the element swap: browsers grant link affordances (middle-click, modifier-click, drag, status bar, context menu) to `<a href>` elements specifically. No JS substitute exists for those — every browser implements them at the anchor-element level. Wrapping the card content in `<a href>` is the only way to inherit them for free.

From viewmodel-shell/src/index.ts (LinkNode — the URL/external attribute precedent):
- `LinkNode` has `label: string; href: string; external?: boolean`. When `external: true`, the browser renderer adds `target="_blank"` and `rel="noopener noreferrer"`. That exact attribute pattern is what SectionNode.link must mirror.

From viewmodel-shell/src/index.ts (SectionNode at line ~126-163 — where the new field goes):
- SectionNode currently has: type, heading?, variant? ("card"), layout?, id?, collapsible?, action?, children. Append `link?: { url: string; external?: boolean }` AFTER `action?`, BEFORE `children:`. Use an inline object type (mirrors how `TableColumn.linkLabel` / `linkExternal` are flat siblings; using a nested object here keeps the wire clean and leaves room for future link options without flat-field sprawl).

From viewmodel-shell/src/browser.ts ~lines 310-360 (the SectionNode renderer — the structural mirror):
- Today the non-collapsible branch does `const el = document.createElement("section")` and applies className modifiers. The new `link` branch splits BEFORE that: when `n.link` is set AND the section is not collapsible (validation guarantees this combo is rejected — see below), the renderer creates `<a>` instead of `<section>`, sets `a.href = n.link.url`, adds `target="_blank" rel="noopener noreferrer"` if `external: true`, and applies `.vms-section vms-section--linked` (+ `vms-section--card` if variant set, + layout modifier if set). No `role="button"`, no `tabindex=0`, no `aria-label` from heading — the anchor element gives all of that for free with the right text content + semantics. No `addEventListener` for click/keydown — the browser handles every modifier-click case natively. Containment listeners on nested interactives ARE still needed (next bullet).
- Containment: clicks on nested interactive controls (`.vms-button`, `.vms-checkbox__input`, `.vms-checkbox`, `.vms-field__input`, `.vms-table__link`, `a[href]` other than the wrapper itself) must NOT trigger the wrapper anchor's navigation. The TableRow.action / SectionNode.action pattern uses `stopPropagation()`, but anchor-wrapped clicks need BOTH `stopPropagation()` (so a bubbled click doesn't re-fire the anchor's default behavior in some browsers) AND `preventDefault()` on nested anchor descendants that have their own href (so the inner anchor wins). The renderer walks descendants via `el.querySelectorAll(...)` AFTER `kids()` runs and attaches the per-control containment listener — same idiom as the SectionNode.action wiring at browser.ts:354-358 but with the expanded selector list.
- HTML5 spec compliance: anchors can contain "transparent content" (`<a>` can wrap most flow content including div/section/h2/p), so wrapping `<h2 class="vms-section__heading">…` + child sections/buttons inside `<a class="vms-section vms-section--linked">` is spec-legal. The ONE exception: an `<a>` cannot contain another `<a>` (interactive content prohibition). That is exactly what tree validation rejects — nested `section.link` inside another `section.link`, AND nested LinkNode inside a section.link's children would technically be invalid HTML but is a different issue; for this plan, only sibling SectionNode-level nesting is validated. LinkNode-inside-section.link is left to the existing LinkNode renderer (which produces an inner `<a>` that browsers handle ungracefully); the executor should document this in the renderer with a TODO referring to a possible follow-up runtime warning, but NOT block it (consumers can avoid the combo).

From viewmodel-shell/src/browser.ts ~lines 661-671 (LinkNode renderer — attribute reference):
- `a.href = n.href`, then `if (n.external) { a.target = "_blank"; a.rel = "noopener noreferrer"; }`. Mirror this exactly for the SectionNode.link branch.

From viewmodel-shell/src/server.ts ~lines 249-324 (validateSectionAction — the validation walk to extend):
- The existing walk threads `outerClickable: SectionNode | null` to detect nested clickable sections. Extend the threaded context to track BOTH "outer has action" AND "outer has link" (a single `outerInteractive: SectionNode | null` field is enough — the walk treats action and link symmetrically because both produce a click-handling element). Add four checks alongside the existing two:
  - (c) `section.action != null && section.link != null` on the same section — invalid (dispatcher OR navigator, never both).
  - (d) `section.link != null && section.collapsible === true` on the same section — invalid (same rationale as action+collapsible).
  - (e) `section.link != null && outerInteractive != null` — invalid (covers link-in-link AND link-in-action; nested anchor or ambiguous click ownership).
  - The existing rule (b) `section.action != null && outerInteractive != null` now also covers action-in-link (was only action-in-action) because of the unified `outerInteractive` rename.
- Error messages should name the offending section(s) by heading (or `(headingless)`), mirror the wording style of the existing action+collapsible / nested action messages, and reference both the field name (link vs action) and the cause (HTML5 nested-anchor prohibition for link-in-link; click-ownership ambiguity for the mixed cases).

From viewmodel-shell-dotnet/ViewModels.cs ~lines 250-279 (SectionNode record):
- Define a new positional-style helper record `SectionLink(string Url, bool External = false)` near the SectionNode declaration (after LinkNode at line ~434 is the natural placement — but co-locating with SectionNode for discoverability is also fine; mirror whatever placement reads cleanest in context). Note: a flat `string? LinkUrl, bool LinkExternal` pair was considered and rejected (locked decision 2) — the nested record keeps the wire clean and matches the TS shape exactly.
- SectionNode (line ~250-279) gains an appended positional param `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] SectionLink? Link = null` AFTER `Action`. Default null preserves all existing positional call sites.
- JsonIgnore-on-null on `Link` is REQUIRED per AGENTS.md critical gotcha #8 (the file-header maintainer rule explicitly mandates the attribute on every new nullable wire field).
- The `SectionLink` record's `External` field is non-nullable `bool` with default `false` — same posture as LinkNode.External — so it serializes as `"external": false` on the wire even when defaulted. That matches LinkNode's wire shape; the parity check will confirm both backends agree.

From viewmodel-shell-dotnet/ViewModels.cs ~lines 526-590 (ValidateSectionAction tree walk):
- Rename the threaded `SectionNode? outerClickable` parameter to `outerInteractive` (keeps semantics — "an ancestor section has either Action or Link set"). Add the four new checks per the TS bullet above. Error message wording should match the TS twin verbatim (both backends share message text — drift between them would surface to consumers via env-specific failures).
- The new combo `Action + Link` on the same section is checked FIRST (before the existing collapsible+action check) so the most-actionable error message wins when the consumer accidentally sets both — they get told "pick action OR link" not "set neither with collapsible."

From viewmodel-shell/src/tui.tsx ~lines 407-408 (LinkNode TUI handling):
- The TUI's `activatePane` already maps a focused pane's primary `link` actionable to `this.navigate(a.href)`. For SectionNode.link the TUI should treat the section as link-actionable: when the focused pane's section has `link.url`, Enter navigates to that URL via the same `this.navigate(url)` path. This adds parity for the TUI experimental adapter at low cost (the navigate verb already exists; only the actionable-detection needs the new branch). Document the change in the TUI section header comment block at ~line 31-37.

From viewmodel-shell/styles/default.css ~lines 224-235 (.vms-section--clickable — the CSS sibling):
- Add a new `.vms-section--linked` block immediately after `.vms-section--clickable` (line 235). Mirror the clickable rules: cursor pointer, hover ring (1px accent-dim), :focus-visible outline (2px accent, positive offset). ADDITIONALLY: an `<a>` element ships with browser-default text-decoration (underline) and link colors — reset those for the section context with `.vms-section--linked { color: inherit; text-decoration: none; }`. Without these, a linked card would render with underlined heading text in browser blue.

Wire shape (the canonical example agents will paste from):
```json
{
  "type": "section",
  "variant": "card",
  "heading": "Read the docs",
  "link": { "url": "https://github.com/ashley-shrok/ViewModelShell", "external": true },
  "children": [
    { "type": "text", "value": "Architecture, gotchas, and runnable demos.", "style": "muted" }
  ]
}
```

The four mutually-exclusive combos rejected by validation, summarized for the Task 2 + Task 5 message wording:
- `link + action` on same section → "A SectionNode is either a dispatcher (action) or a navigator (link). Pick one."
- `link + collapsible:true` on same section → "A collapsible section's `<summary>` IS the click target; a linked card makes the whole section the click target. Pick one."
- `link` nested inside another `link` → "Nested SectionNode.Link: HTML5 prohibits nested `<a>` elements."
- `link` nested inside `action` (or vice versa) → "SectionNode.Link nested inside a clickable SectionNode.Action (or vice versa). Click-ownership in the overlap is ambiguous."
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: TS wire field + renderer + CSS for SectionNode.link</name>
  <files>viewmodel-shell/src/index.ts, viewmodel-shell/src/browser.ts, viewmodel-shell/styles/default.css</files>
  <behavior>
    - Add `link?: { url: string; external?: boolean }` to `SectionNode` in `viewmodel-shell/src/index.ts` immediately after the existing `action?: ActionEvent` field (line ~161), before `children:`. TSDoc must: (a) name issue #21, (b) reference SectionNode.action as the sibling dispatcher primitive, (c) document the four tree-validation rejections in the same prose style as the existing `action` TSDoc, (d) explicitly call out the wire-shape (inline `{url, external?}` object — not flat sibling fields, locked decision 2), (e) note that the renderer emits a wrapping `<a href>` to inherit native browser link affordances.
    - In `viewmodel-shell/src/browser.ts` `private section(...)` (line ~278), the non-collapsible branch (line ~310 onward) gains an EARLIER branch: when `n.link` is set, create `<a>` instead of `<section>`. Set `a.href = n.link.url`. If `n.link.external` is true, set `a.target = "_blank"` and `a.rel = "noopener noreferrer"` (mirror LinkNode at line 661-671 EXACTLY — same attributes). className: `vms-section vms-section--linked${n.variant === "card" ? " vms-section--card" : ""}${n.layout && n.layout !== "stack" ? ` vms-section--${n.layout}` : ""}`. Heading still renders as `<h2 class="vms-section__heading">` inside the anchor. Call `this.kids(...)` to render descendants. NO `role`, NO `tabindex`, NO `aria-label` — the anchor's semantics (and its accessible name from the heading + descendant text) cover that.
    - The `n.action` branch (line ~321-358) is unchanged — validation guarantees `link` and `action` are mutually exclusive. The collapsible branch (line ~283-307) is unchanged — validation guarantees link+collapsible is rejected.
    - Containment: AFTER `kids()` runs on the linked anchor, walk descendants with `el.querySelectorAll<HTMLElement>(".vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, .vms-table__link, a[href]")` and attach a per-control `click` listener that calls BOTH `e.stopPropagation()` AND `e.preventDefault()` if the descendant is an anchor (`HTMLAnchorElement` instance check) — otherwise just `stopPropagation()`. Rationale: a bubbled click on a nested anchor would trigger the wrapper anchor's default navigation in some browsers; preventing default on inner anchors makes the inner anchor's own href win. For non-anchor controls, stopPropagation alone is enough — the wrapper anchor's click handler is the browser's default navigation, which only fires on the anchor element itself, but stopPropagation prevents bubbled events from re-triggering it via the wrapping element's other event listeners. The catch-all `a[href]` selector includes the wrapper anchor itself; the executor must exclude `el` from the walk (skip `if (ctrl === el)`) so the wrapper anchor's own click is NOT preventDefaulted.
    - In `viewmodel-shell/src/tui.tsx` (the TUI experimental adapter), find `activatePane` (line ~395) and `focusedPaneSummary` (find via grep: `grep -n "focusedPaneSummary\|primaryActionable" viewmodel-shell/src/tui.tsx`). Extend the actionable-detection so a focused pane whose section has `link.url` is treated as link-actionable — Enter dispatches `this.navigate(section.link.url)`. The minimal change is to plumb `section.link` into the primaryActionable detection alongside existing LinkNode handling; the TUI is experimental, so "Enter on a focused linked card opens the URL via navigate()" is the bar, NOT full visual emphasis or keyboard tab-order. Update the TUI section header comment block at line ~31-37 to note: `section.link → focused-pane Enter dispatches navigate(url) (1.5.0)`.
    - In `viewmodel-shell/styles/default.css`, add a new block immediately after `.vms-section--clickable` (line ~235). Mirror the clickable rules for cursor + hover + :focus-visible:
      ```
      .vms-section--linked { cursor: pointer; color: inherit; text-decoration: none; }
      .vms-section--linked:hover { box-shadow: 0 0 0 1px var(--vms-accent-dim); }
      .vms-section--linked:focus-visible { outline: 2px solid var(--vms-accent); outline-offset: 2px; }
      ```
      The `color: inherit; text-decoration: none;` reset is what stops the anchor from rendering as browser-default blue underlined text. Add a comment block above the rules explaining issue #21 and the anchor-reset rationale, mirroring the comment style of the `.vms-section--clickable` block.
    - Backward compat: a SectionNode with `link` omitted produces byte-identical DOM (still `<section>`, no new class, no anchor element). Verified by Task 3.
    - Run `npm run check:core-globals` after — browser.ts and tui.tsx are outside the guard's scope (it's index.ts-only), so this is just a sanity check the build still passes.
  </behavior>
  <action>Implement per `<behavior>` above. Mirror LinkNode's external-attribute pattern at browser.ts:661-671 exactly. Mirror the SectionNode.action containment-walker pattern at browser.ts:354-358 with the expanded selector list AND the wrapper-anchor-exclusion guard. For the TUI: keep the change minimal (one extra branch in actionable-detection); do not refactor the TUI focus model. Run `npx tsc --noEmit` to confirm types are sound. Per AGENTS.md "Working agreement for agents", commit ONE atomic commit for this task: `feat(260614-bmd): add SectionNode.link URL-wrapper primitive (TS + CSS + TUI)`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell &amp;&amp; npm run check:core-globals &amp;&amp; npx tsc --noEmit</automated>
  </verify>
  <done>SectionNode interface gains `link?: { url, external? }` with TSDoc citing issue #21; `private section()` emits `<a href>` wrapper with external attrs + containment for `n.link`; default.css has `.vms-section--linked` cursor + anchor-reset + hover + :focus-visible blocks; TUI's Enter-on-focused-pane dispatches navigate() for section.link; tsc clean; core-globals guard green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: TS validateSectionAction extension for link rules</name>
  <files>viewmodel-shell/src/server.ts, viewmodel-shell/test/tree-walker.test.ts</files>
  <behavior>
    - In `viewmodel-shell/src/server.ts`, extend the existing `validateSectionAction(vm: ViewNode)` function (line ~249) and its private `walkForSectionAction(node, outerClickable)` helper (line ~253). Rename the threaded `outerClickable: SectionNode | null` parameter to `outerInteractive: SectionNode | null` (semantic widening — "an ancestor section has either action OR link set"). Add four new validation checks in the `case "section":` branch (line ~263), in this priority order so the most-actionable error message wins:
      1. (NEW — check FIRST): `section.action != null && section.link != null` on the same section → throw with message: `SectionNode '${hdr}' has both Action and Link set. A SectionNode is either a dispatcher (action) or a navigator (link) — they create different user expectations of what a click means. Pick one.`
      2. (NEW): `section.link != null && section.collapsible === true` → throw with message: `SectionNode '${hdr}' has both Link and Collapsible: true set. A collapsible section's summary IS the click target; a linked card makes the whole section the click target. Pick one.`
      3. (EXISTING, unchanged behavior): `section.action != null && section.collapsible === true` — keep as-is.
      4. (NEW): `section.link != null && outerInteractive !== null` → throw with message that distinguishes link-in-link from link-in-action: when `outerInteractive.link != null` use `Nested SectionNode.Link: inner section '${innerHdr}' is inside linked outer section '${outerHdr}'. HTML5 prohibits nested <a> elements.`; when `outerInteractive.action != null` use `SectionNode.Link inner section '${innerHdr}' is inside clickable outer SectionNode.Action '${outerHdr}'. Click-ownership in the overlap is ambiguous — a linked card inside a dispatcher card creates two competing primary interactions.`
      5. (EXTENDED): the existing `section.action != null && outerInteractive !== null` check (action-in-action) now also catches action-in-link because of the unified parameter. Update the error message to reflect this: when `outerInteractive.action != null` keep the existing "Nested SectionNode.Action" wording; when `outerInteractive.link != null` use `SectionNode.Action inner section '${innerHdr}' is inside linked outer SectionNode.Link '${outerHdr}'. Click-ownership in the overlap is ambiguous.`
    - Update the threaded recursion: `const nextOuter = (section.action != null || section.link != null) ? section : outerInteractive;`. Then `for (const child of section.children) walkForSectionAction(child, nextOuter);`.
    - Update the doc comment block above `validateSectionAction` (line ~219-238) to enumerate all five rejected combos (the existing two + the four new) with the same prose style. Update the function-level JSDoc on `validateSectionAction` itself (line ~240-248) to mention link.
    - Tests: read `viewmodel-shell/src/tree-walker.test.ts` to find the existing `validateSectionAction` test cases (search: `grep -n "validateSectionAction\|action.*collapsible\|nested.*action" viewmodel-shell/src/tree-walker.test.ts`). Append new test cases:
      - `link + action` on same section throws (assert message contains "either a dispatcher (action) or a navigator (link)")
      - `link + collapsible:true` on same section throws (assert message contains "Link and Collapsible")
      - link-in-link throws (assert message contains "HTML5 prohibits nested" + both heading names)
      - link-in-action throws (assert message contains "Click-ownership" + both heading names)
      - action-in-link throws (assert message contains "Click-ownership" + both heading names; the action-side variant)
      - styling-only inner `variant: "card"` (no link, no action) inside a linked card → PASSES
      - styling-only inner card inside a clickable-action card with internal buttons → still PASSES (regression check that the rename didn't break the existing pass)
      - Plain linked card with descendants (no nesting, no collapsible) → PASSES
  </behavior>
  <action>Edit `viewmodel-shell/src/server.ts` per `<behavior>`. Read the existing `walkForSectionAction` body (line 253-324) end-to-end before editing — the rename of `outerClickable` → `outerInteractive` touches multiple lines and the priority ordering of the new checks matters. After editing, run `grep -n "outerClickable\|outerInteractive" viewmodel-shell/src/server.ts` to confirm zero leftover references to the old name. Then append the new test cases to `tree-walker.test.ts` (mirror the existing test scaffolding pattern — same imports, same helper functions, same assertion style). Commit: `feat(260614-bmd): extend validateSectionAction for SectionNode.link rules (TS)`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell &amp;&amp; npx vitest run test/tree-walker.test.ts</automated>
  </verify>
  <done>validateSectionAction enforces all five rules (existing 2 + new 4 — note the existing action+collapsible stays as-is); the unified `outerInteractive` parameter detects action-in-link and link-in-action; new tree-walker.test.ts cases all pass; full vitest sweep stays green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: jsdom test suite for SectionNode.link renderer</name>
  <files>viewmodel-shell/test/section-link.test.ts</files>
  <behavior>
    Create `viewmodel-shell/test/section-link.test.ts` as a structural sibling of `viewmodel-shell/test/section-action.test.ts`. Tree under test: a PageNode containing three sections:
    - S1: linked, `link: { url: "https://example.com/docs", external: true }`, heading "Read the docs", containing a styling-only inner `variant:'card'` section (no link/action) holding a ButtonNode (`close-card-1`), a CheckboxNode (`pick-card-1`), and an inner LinkNode (`href: "/foo"`, label "Inner link").
    - S2: linked, `link: { url: "/internal" }` (no `external`), heading "Open detail", body just a TextNode. (Tests the internal/relative URL case.)
    - S3: NO `link` AND NO `action` — backward-compat baseline section.

    Cases:
    - A. The S1 element is an `<a>` (not `<section>`); `a.tagName === "A"`, `a.getAttribute("href") === "https://example.com/docs"`, `a.getAttribute("target") === "_blank"`, `a.getAttribute("rel") === "noopener noreferrer"`.
    - B. The S2 element is an `<a>`, `a.href` ends with `/internal`, NO `target` attr, NO `rel` attr (omitted when external is falsy).
    - C. S1 has className containing `vms-section vms-section--linked` (NOT `vms-section--clickable` — that's the action class).
    - D. S1 still renders its heading as `<h2 class="vms-section__heading">Read the docs</h2>` inside the anchor.
    - E. Clicking the nested ButtonNode inside S1 fires `close-card-1` but does NOT trigger anchor navigation (test by spying on the anchor's click default OR by asserting the click event's `defaultPrevented` is true after propagation if the inner control is an anchor; for the button case, just confirm the dispatch event was the button's action and assert the anchor's default click was stopped via the addEventListener-based stopPropagation). Reasonable approach: attach a click listener on the anchor that throws if called with `e.target` outside the anchor; OR use `e.target.closest("a") === anchor && e.defaultPrevented` style check.
    - F. Clicking the nested CheckboxNode inside S1 does NOT trigger anchor navigation; the bind path receives the new checked value (proves the checkbox change handler still ran — containment is stopPropagation, NOT canceling the input event).
    - G. Clicking the nested inner LinkNode (`href="/foo"`) does NOT trigger the OUTER anchor's navigation; the inner anchor's own click should win. Mirror table-row-action test G approach for silencing jsdom navigation warnings — add a captured-phase preventDefault on document for `click` events with `target.tagName === "A"` to silence jsdom; assert the dispatch (or, if no dispatch, just that the test did not throw).
    - H. S1's accessible name is derivable from its heading + content; no `role="button"` attribute is present; no `tabindex="0"` is present (the anchor element provides keyboard and focus semantics natively).
    - I. S3 (backward compat): renders as `<section>` (not `<a>`), has className `vms-section` WITHOUT `vms-section--linked` and WITHOUT `vms-section--clickable`, has no `href`, no `target`, no `rel`.
    - J. A linked section with `variant: "card"` has className containing BOTH `vms-section--card` AND `vms-section--linked`. A linked section with `layout: "split"` has className containing `vms-section--split` too.
    - K. (Optional but recommended) Anchor element's `style.color` (after applying the stylesheet) is inherited and `style.textDecoration` is `none` — confirms the CSS reset is in place. If injecting the stylesheet into jsdom is heavy, skip with an inline comment and rely on Task 1's CSS visual-inspection or the Showcase demo as the proof.
    - Reuse the freshContainer / mkSA / render helpers from `test/section-action.test.ts` (copy verbatim into the new file — small, self-contained).
  </behavior>
  <action>Read `viewmodel-shell/test/section-action.test.ts` end-to-end and write `viewmodel-shell/test/section-link.test.ts` as the structural sibling per `<behavior>` above. For containment assertions (E/F/G), prefer asserting via the dispatcher callback (mkSA / mock action handler) — that's how section-action.test.ts proves containment for nested controls. For jsdom navigation noise from anchor clicks, replicate the silencing pattern used in row/section-action tests for inner LinkNode clicks. The tree-validation tests (link+action, link+collapsible, nested) live in Task 2's `tree-walker.test.ts`, NOT here — this file is renderer-only. Commit: `test(260614-bmd): jsdom test suite for SectionNode.link`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell &amp;&amp; npx vitest run test/section-link.test.ts</automated>
  </verify>
  <done>All A-J (K optional) cases pass; full `npx vitest run` stays green; test count goes up by ~10 cases.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: .NET wire field + extended ValidateSectionAction walk</name>
  <files>viewmodel-shell-dotnet/ViewModels.cs</files>
  <behavior>
    - Add a new record `SectionLink(string Url, bool External = false)` at a sensible location — recommended: immediately below `ActionDescriptor` at line ~26, OR colocated with SectionNode at line ~248. The record is a positional record (mirrors `ActionDescriptor`) with `External` defaulting to `false`. NO `[JsonIgnore]` attributes on its members — `Url` is non-nullable required, `External` is a non-nullable bool that serializes as `"external": false` when defaulted (matches LinkNode.External wire posture; critical gotcha #8 only mandates the attribute on NULLABLE fields).
    - SectionNode record (line ~250-279) gains an appended positional param `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] SectionLink? Link = null` AFTER `Action`. Default null preserves every existing positional call site. JsonIgnore-on-null is REQUIRED per AGENTS.md critical gotcha #8 (the maintainer rule explicitly mandates it on nullable wire fields).
    - Update the existing SectionNode doc comment block (line ~266-277) to reference both `Action` and `Link`, the four tree-validation rejections (action+link, link+collapsible, link+link, link+action mixed), and the issue #21 reference.
    - Rename `WalkForSectionAction`'s `outerClickable: SectionNode?` parameter to `outerInteractive: SectionNode?` everywhere it appears in the file (line ~528-590). Run a grep on the file after editing to confirm zero leftover `outerClickable` references.
    - Extend the `case SectionNode section:` branch (line ~539-562) with the four new validation checks, in the same priority order as the TS twin (Task 2):
      1. (NEW — first): `section.Action is not null && section.Link is not null` → throw `InvalidOperationException` with message: `$"SectionNode '{hdr}' has both Action and Link set. A SectionNode is either a dispatcher (Action) or a navigator (Link) — they create different user expectations of what a click means. Pick one."` (use the existing `string.IsNullOrEmpty(section.Heading) ? "(headingless)" : section.Heading` pattern for `hdr`).
      2. (NEW): `section.Link is not null && section.Collapsible == true` → throw with message: `$"SectionNode '{hdr}' has both Link and Collapsible: true set. A collapsible section's summary IS the click target; a linked card makes the whole section the click target. Pick one."`
      3. (EXISTING, unchanged): `section.Action is not null && section.Collapsible == true` — keep as-is.
      4. (NEW): `section.Link is not null && outerInteractive is not null` → throw with differentiated message based on whether the outer has Link or Action (mirror the TS Task 2 logic exactly — same wording).
      5. (EXTENDED): the existing `section.Action is not null && outerInteractive is not null` check now also catches action-in-link; differentiate the message based on whether outer is Link or Action.
    - Update the threaded recursion: `var nextOuter = (section.Action is not null || section.Link is not null) ? section : outerInteractive;`.
    - The XML doc summary on `ValidateSectionAction` (line ~515-525) must be updated to enumerate all five rejected combos. Cross-reference both the issue #20 (action precedent) and issue #21 (link addition).
    - `ShellResponse<TState>.Validate()` (line ~207-211) already calls `ValidateSectionAction(Vm)` — no change needed; the extended walk runs through the same seam.
    - Compile sanity: `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj -c Release` must succeed. Every existing positional call site in demos still compiles because the new `Link` param defaults to null.
  </behavior>
  <action>Add `SectionLink` record (recommended position: just above `SectionNode` at line ~250, or alongside the other helper records — pick what reads cleanest). Append `Link = null` to SectionNode positional params. Rename `outerClickable` → `outerInteractive` throughout `WalkForSectionAction`. Add the four new validation checks in the priority order specified. Confirm with `grep -n "outerClickable" viewmodel-shell-dotnet/ViewModels.cs` that zero leftover references remain. Run `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj -c Release` to confirm clean build. Commit: `feat(260614-bmd): add SectionNode.Link + extended ValidateSectionAction (.NET)`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet &amp;&amp; dotnet build AshleyShrok.ViewModelShell.csproj -c Release</automated>
  </verify>
  <done>SectionLink record exists; SectionNode record has appended `Link` param with JsonIgnore-on-null; outerClickable renamed to outerInteractive throughout WalkForSectionAction; four new validation checks added in priority order with matching messages; `dotnet build` succeeds with zero warnings; existing demo call sites compile unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5: .NET tree-validation tests for SectionNode.Link</name>
  <files>viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs</files>
  <behavior>
    Append a new region "SectionNode.Link validation (issue #21)" at the end of the existing test class. xUnit `[Fact]`s (mirror the structure of the existing Task-4-style `Validate_SectionAction_*` facts from the 1.3.0 work; read the file first via `grep -n "Validate_SectionAction\|\\[Fact\\]" viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` to see the exact scaffolding):
    - `Validate_SectionLink_Plain_Passes` — PageNode containing a SectionNode with `Link = new SectionLink("https://example.com")`, no Action, no Collapsible, no nesting. `ViewTreeValidation.ValidateSectionAction(tree)` returns without throwing.
    - `Validate_SectionLink_PlusAction_Throws` — same section but also has `Action = new ActionDescriptor("x")`. Asserts `InvalidOperationException` with message containing `"either a dispatcher (Action) or a navigator (Link)"` AND the section heading.
    - `Validate_SectionLink_PlusCollapsible_Throws` — section has `Link` AND `Collapsible: true`. Asserts message contains `"Link and Collapsible: true"` AND the heading.
    - `Validate_SectionLink_NestedLinkInLink_Throws` — PageNode > SectionNode(Heading="Outer", Link=outer, Children=[ SectionNode(Heading="Inner", Link=inner, Children=[]) ]). Asserts message contains `"HTML5 prohibits nested"` AND both `"Outer"` and `"Inner"`.
    - `Validate_SectionLink_NestedLinkInAction_Throws` — PageNode > SectionNode(Heading="Outer", Action=outer, Children=[ SectionNode(Heading="Inner", Link=inner, Children=[]) ]). Asserts message contains `"Click-ownership"` AND both heading names.
    - `Validate_SectionLink_NestedActionInLink_Throws` — PageNode > SectionNode(Heading="Outer", Link=outer, Children=[ SectionNode(Heading="Inner", Action=inner, Children=[]) ]). Asserts message contains `"Click-ownership"` AND both heading names.
    - `Validate_SectionLink_StylingOnlyInnerCard_Passes` — PageNode > SectionNode(Link=outer, Children=[ SectionNode(Variant:"card", Link=null, Action=null, Children=[ Btn("close-outer") ]) ]). No throw. Pins the locked decision that a styling-only inner card inside a linked card is VALID.
    - `Validate_SectionLink_ExternalDefaultsFalse` — sanity check on the `SectionLink` record: `new SectionLink("https://example.com").External` is `false`; `new SectionLink("https://example.com", External: true).External` is `true`. (Not a tree-validation test per se — a record-shape pin to catch accidental default flips.)
    - `ShellResponse_Validate_RunsSectionLinkValidation` — construct a `ShellResponse<TState>` (mirror the existing `ShellResponse_Validate_RunsSectionActionValidation` pattern from the prior phase — read it first) with a link-in-link tree. Assert `.Validate()` throws `InvalidOperationException`.
    - Reuse the existing `Btn(...)` and `Page(...)` helpers at the top of the file. Add a local `LinkedCard(string? heading, SectionLink? link, params ViewNode[] children)` helper if it makes the test bodies cleaner — match the style of the existing `Card(...)` helper added in the prior phase.
  </behavior>
  <action>Append per `<behavior>`. Re-read Task 4's `WalkForSectionAction` implementation immediately before writing message-substring assertions — drift between thrower and test is the easiest miss. Check existing `Validate_SectionAction_*` facts for the canonical xUnit pattern in this codebase. Commit: `test(260614-bmd): .NET tree-validation tests for SectionNode.Link`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet/Tests &amp;&amp; dotnet test Tests.csproj --filter "FullyQualifiedName~ViewTreeValidationTests"</automated>
  </verify>
  <done>All nine new `Validate_SectionLink_*` facts plus the `ShellResponse_Validate_RunsSectionLinkValidation` fact pass; the full Tests project `dotnet test` stays green.</done>
</task>

<task type="auto">
  <name>Task 6: Parity fixture coverage for SectionNode.link via FeatureProbe</name>
  <files>demo/FeatureProbe/AspNetCore/FeatureProbeController.cs, demo/FeatureProbe-bun/handler.ts, parity/fixtures/feature-probe.json</files>
  <behavior>
    - Read `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (the SectionNode.Action clickable card precedent at line ~257-268 — `clickableCardSection`). Add a SIBLING `linkedCardSection` immediately after it: `new SectionNode(Heading: "Linked card", Children: new ViewNode[] { new TextNode("Renders as <a href> for native link affordances.", "muted") }, Variant: "card", Link: new SectionLink("https://example.com/probe", External: true))`. Add it to the section list emitted by BuildVm so the parity-rendered tree includes it. (The link does NOT need a state change — unlike action's CardClickCount, a link is pure client-side navigation; the wire shape itself is the parity gate.)
    - Make the same change in `demo/FeatureProbe-bun/handler.ts` — mirror the clickable card section addition (around line ~195 per the prior phase's grep output) with a sibling linked card. Use identical heading + URL + external flag + body text so the parity diff is byte-clean.
    - Update `parity/fixtures/feature-probe.json`. The fixture's `fresh` step (and `fresh-card` for the SectionNode.action coverage) renders the initial tree; the linked card will appear inside the tree on every step automatically. The parity gate fails immediately if the .NET and bun backends emit different serializations for the SectionLink. NO new fixture steps are needed (no dispatch step to add — link navigation is client-side, the server never sees it).
    - Run `bun run parity/run.ts` to confirm parity holds. Both backends must emit `{ "link": { "url": "https://example.com/probe", "external": true } }` byte-identically. If the backends drift (e.g. .NET emits `"External"` capitalized vs bun's `"external"`, or the SectionLink record's JSON property naming differs from TypeScript's), the parity run will fail with a clear diff — fix the .NET-side JSON property naming policy on SectionLink before resubmitting (System.Text.Json defaults to PascalCase property names; demos use `PropertyNamingPolicy = JsonNamingPolicy.CamelCase` in Program.cs — confirm this applies to SectionLink as well).
    - The Showcase demo update (Task 7) is SEPARATE from this task. This task is the parity / wire-shape gate.
  </behavior>
  <action>Read `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` and `demo/FeatureProbe-bun/handler.ts` end-to-end first (focus on the clickable-card section additions from the prior phase as the exact template). Add the sibling linked card in both backends with identical wire shape. Re-read the prior phase's Task 5 SUMMARY notes for any bun-link side-effects (the prior summary noted: "had to register the worktree as the global `bun link` target to make the parity run pick up new types; restored the main-repo link after the run") — replicate that if you hit the same issue. Run `bun run parity/run.ts` and confirm `✓ Parity tests passed`. Commit: `feat(260614-bmd): parity coverage for SectionNode.link via FeatureProbe`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell &amp;&amp; bun run parity/run.ts</automated>
  </verify>
  <done>Parity run passes with `link` field present on the new SectionNode in both backends; wire diff is byte-clean; FeatureProbe's BuildVm tree includes a `Linked card` section alongside the existing `Clickable Card`.</done>
</task>

<task type="auto">
  <name>Task 7: Showcase demo of SectionNode.link</name>
  <files>demo/Showcase/frontend/src/main.ts</files>
  <behavior>
    - Read `demo/Showcase/frontend/src/main.ts` end-to-end to find the natural placement. The Dashboard view (line ~387-415) currently uses four `SectionNode.action` stat tiles ("Revenue", "Active users", "Conversion", "Open issues"); the natural sibling demonstration is a "Resources" or "Docs" cards strip with `SectionNode.link` tiles. The "Album" view (the third archetype per AGENTS.md) is also a natural fit if the executor finds it cleaner.
    - Add a new section to the Dashboard view (or Album view if cleaner) titled "Resources" or "External links", using `layout: "cards"`, with at least 2-3 linked tiles:
      - "Read the docs" → `link: { url: "https://github.com/ashley-shrok/ViewModelShell#readme", external: true }`
      - "View on GitHub" → `link: { url: "https://github.com/ashley-shrok/ViewModelShell", external: true }`
      - "Report an issue" → `link: { url: "https://github.com/ashley-shrok/ViewModelShell/issues", external: true }`
    - Each tile: `{ type: "section", variant: "card", link: { url, external: true }, heading: "...", children: [{ type: "text", value: "<short description>", style: "muted" }] }`.
    - Add an inline code comment above the strip noting `// 1.5.0 — SectionNode.link demo: clickable cards that navigate via <a href>, preserving every native browser link behavior (middle-click new tab, Ctrl/Cmd-click, right-click context menu, drag-to-bookmarks, status-bar URL preview). Issue #21.`
    - The Showcase is pure-frontend (per AGENTS.md: `pure-frontend demo/Showcase/`) — no .NET or bun counterpart to update.
    - Confirm `npm run build` produces a clean Vite build (no new warnings).
  </behavior>
  <action>Edit `demo/Showcase/frontend/src/main.ts`. Pick whichever archetype view (Dashboard or Album) has the most natural seam — don't shoehorn it. Add the resource-link strip per `<behavior>`. Confirm `cd demo/Showcase/frontend && npm run build` succeeds. Commit: `feat(260614-bmd): Showcase demo of SectionNode.link external resource tiles`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/demo/Showcase/frontend &amp;&amp; npm run build</automated>
  </verify>
  <done>Showcase main.ts has a Resources / External links strip with at least 2-3 `SectionNode.link` external tiles; `npm run build` produces a clean build (no new warnings); the tiles' URLs are real (github.com/issues) so a manual browser test would actually navigate.</done>
</task>

<task type="auto">
  <name>Task 8: CHANGELOG + MIGRATION entries + lockstep version bumps</name>
  <files>CHANGELOG.md, MIGRATION.md, viewmodel-shell/package.json, viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj</files>
  <behavior>
    - Bump `viewmodel-shell/package.json` `"version": "1.4.0"` → `"version": "1.5.0"`. Re-sync `viewmodel-shell/package-lock.json` via `npm install --package-lock-only` (mirror the prior phase's approach).
    - Bump `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>1.3.0</Version>` → `<Version>1.4.0</Version>`.
    - Prepend a new entry to `CHANGELOG.md` immediately after the `---` separator under the "# Changelog" preamble, in the same Keep-a-Changelog format as the 1.4.0/1.3.0 entry (which is the immediate precedent — read lines 1-40 first). Required sections:
      - Heading: `## 1.5.0 / 1.4.0 — SectionNode.link URL-wrapper clickable cards (npm + NuGet)` with the version-bump callout line.
      - One-paragraph "why" intro citing issue #21 and naming the four browser-native affordances (middle-click, Ctrl/Cmd-click, right-click context menu, drag-to-bookmarks) the workaround (server redirect via .action) loses.
      - `### Added` listing: SectionNode.link wire field (TS + .NET shapes); the SectionLink helper record on .NET; `.vms-section--linked` CSS class with anchor-reset rationale; the four new tree-validation rejections (action+link, link+collapsible, link-in-link, link-in-action / action-in-link mixed); TUI Enter-on-focused-pane handling.
      - `### Demo migration` section noting Showcase gained a Resources strip + FeatureProbe gained a linked card for parity coverage.
      - `### Tests` section: new `section-link.test.ts` (~10 cases); new tree-walker tests for the four rules (TS); 9 new `Validate_SectionLink_*` .NET facts + the ShellResponse Validate integration fact.
      - `### Consumers` section: additive — nothing required. Default-null wire field, byte-identical wire when omitted.
    - Prepend a new entry to `MIGRATION.md` immediately above the existing 1.4.0/1.3.0 entry (read lines 1-60 first to match voice). Required content:
      - Heading: `## Upgrading to '1.5.0' / '1.4.0' (lockstep — npm @ashley-shrok/viewmodel-shell + NuGet AshleyShrok.ViewModelShell)`.
      - Version-bump table (npm 1.4.0 → 1.5.0; NuGet 1.3.0 → 1.4.0).
      - One-paragraph "what changed".
      - Explicit "**Consumer action required: none.**" callout (field is additive + optional; wire stays byte-identical when omitted).
      - "Not breaking" subsection.
      - "New capability — minimal linked card" subsection with copy-pasteable TS + C# snippets showing an external link tile (https://example.com/docs + `external: true`).
      - "What the framework rejects" subsection enumerating the four new tree-validation rejections (action+link, link+collapsible, link-in-link, link-in-action mixed), with one-line rationale each.
    - Both files are append-prepend; existing entries are UNTOUCHED (release-gated rule per AGENTS.md).
  </behavior>
  <action>Bump both version strings with `Edit`. Run `npm install --package-lock-only` from `viewmodel-shell/` to re-sync the lockfile. Read `CHANGELOG.md` lines 1-40 + `MIGRATION.md` lines 1-60 first to match voice exactly. Insert both new entries via `Edit` (anchor on the first `---` separator under the "# Changelog" preamble; anchor on the existing `## Upgrading to '1.4.0' / '1.3.0'` heading in MIGRATION and insert above it). Cite issue #21 (and issue #20 as the .action precedent) in both entries. Do NOT touch the existing 1.4.0 / 1.3.0 (or earlier) entries. Commit: `chore(release): viewmodel-shell 1.5.0 / NuGet 1.4.0 — SectionNode.link`.</action>
  <verify>
    <automated>grep -q '"version": "1.5.0"' /home/ubuntu/ViewModelShell/viewmodel-shell/package.json &amp;&amp; grep -q '<Version>1.4.0</Version>' /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj &amp;&amp; grep -q '1.5.0' /home/ubuntu/ViewModelShell/CHANGELOG.md &amp;&amp; grep -q '1.5.0' /home/ubuntu/ViewModelShell/MIGRATION.md</automated>
  </verify>
  <done>Both package versions bumped; package-lock.json re-synced to 1.5.0; CHANGELOG.md and MIGRATION.md have new 1.5.0/1.4.0 entries citing issue #21; old entries untouched.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 9: Publish to npm + NuGet + tag release (OPERATOR-DRIVEN — final step)</name>
  <what-built>
    Tasks 1-8 produced eight atomic commits implementing SectionNode.link end-to-end: TS + .NET wire field, validation, jsdom + .NET tests, parity coverage, Showcase demo, CHANGELOG / MIGRATION entries, and the lockstep version bumps (npm 1.4.0 → 1.5.0; NuGet 1.3.0 → 1.4.0). The code is committed to the current branch and ready to ship, but per AGENTS.md "🚨 A version bump is NOT a release — the registries are. Publishing is mandatory and manual." this final step has to be operator-driven for two reasons:
    1. Publishing requires sourcing `/home/ubuntu/ViewModelShell/.env` for `NPM_TOKEN` and `NUGET_API_KEY`, syncing `~/.npmrc` to the bypass-2FA token, and running `npm publish` + `dotnet nuget push`. The .env values are sensitive and the operator should confirm before the package goes to the global registry.
    2. Tagging the release (`git tag -a v1.5.0 <sha> -m "viewmodel-shell 1.5.0"` + `git push origin v1.5.0`) is part of the release per AGENTS.md; untagged releases break `git checkout v1.5.0`-based backlog recovery and are invisible to anyone browsing tags/releases on GitHub.
  </what-built>
  <how-to-verify>
    Operator runs the publish ritual from AGENTS.md "Conventions for evolving the framework" section. The exact sequence (copy-paste from AGENTS.md, with version strings filled in):

    1. **Credential precheck** (verify .env has both keys, ~/.npmrc is in sync, NUGET_API_KEY sources cleanly):
    ```
    grep -E '^(NPM_TOKEN|NUGET_API_KEY)=' /home/ubuntu/ViewModelShell/.env
    echo "//registry.npmjs.org/:_authToken=$(grep '^NPM_TOKEN=' /home/ubuntu/ViewModelShell/.env | cut -d= -f2- | tr -d \"'\\\"\")" > ~/.npmrc
    chmod 600 ~/.npmrc
    npm whoami  # should print ashley-shrok (E401 here means the .env token is stale — mint a new one before continuing)
    set -a; source /home/ubuntu/ViewModelShell/.env; set +a
    [ -n "$NUGET_API_KEY" ] && echo "NUGET_API_KEY sourced"
    ```

    2. **Publish npm** (1.5.0):
    ```
    cd /home/ubuntu/ViewModelShell/viewmodel-shell
    npm publish
    curl -s https://registry.npmjs.org/@ashley-shrok/viewmodel-shell | python3 -c "import sys,json; print(json.load(sys.stdin)['dist-tags']['latest'])"
    # should print 1.5.0
    ```

    3. **Publish NuGet** (1.4.0):
    ```
    cd /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet
    dotnet pack -c Release
    dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.1.4.0.nupkg --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json
    curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json | python3 -c "import sys,json; print(json.load(sys.stdin)['versions'][-1])"
    # should print 1.4.0
    ```

    4. **Tag the release** (find the release commit sha first — it's Task 8's commit, the `chore(release):` one):
    ```
    cd /home/ubuntu/ViewModelShell
    RELEASE_SHA=$(git log --format=%H --grep="chore(release): viewmodel-shell 1.5.0" -n 1)
    git tag -a v1.5.0 $RELEASE_SHA -m "viewmodel-shell 1.5.0"
    git push origin v1.5.0
    ```

    **Operator confirmation expected before each step**: confirm the .env values are current (the prior phase noted bypass-2FA tokens expire silently if the operator runs `npm login` accidentally). Confirm the version strings match what was bumped in Task 8. Confirm the registry curl-back shows the new versions before tagging.

    **If `npm whoami` returns E401** at step 1: the .env token is stale. AGENTS.md has the recovery: mint a new Granular Access Token at https://www.npmjs.com/settings/ashley-shrok/tokens (publish scope, 2FA-bypass checkbox TICKED), update `.env`, re-run step 1. Do NOT run `npm login` — it overwrites `~/.npmrc` with a non-bypass session token and breaks publish again.
  </how-to-verify>
  <resume-signal>Type "published" (with both registry confirmations + tag pushed) or "skip publishing" if the operator wants to defer the release.</resume-signal>
</task>

</tasks>

<verification>
After Tasks 1-8 complete (and BEFORE Task 9), run the full project sanity sweep:
- `cd viewmodel-shell &amp;&amp; npm run check:core-globals` — core platform-agnosticism guard (browser.ts and tui.tsx changes are out of scope; only validates index.ts stays platform-free)
- `cd viewmodel-shell &amp;&amp; npm run check:aa-contrast` — AA contrast across default + 12 themes (validates `.vms-section--linked:focus-visible` outline uses the AA-passing `--vms-accent` token)
- `cd viewmodel-shell &amp;&amp; npm run check:theme-byte-identity` — themes haven't drifted
- `cd viewmodel-shell &amp;&amp; npm run check:theme-function` — every theme remains functional
- `cd viewmodel-shell &amp;&amp; npm run check:no-demo-style` — no demo-side CSS regressions
- `cd viewmodel-shell &amp;&amp; npx vitest run` — full TS test suite (should be 275 from prior phase + 10 from section-link + 5-7 from tree-walker = ~290 passing)
- `cd viewmodel-shell-dotnet/Tests &amp;&amp; dotnet test` — full .NET test suite (should be 51 from prior phase + 9 new = 60 passing)
- `cd /home/ubuntu/ViewModelShell &amp;&amp; bun run parity/run.ts` — cross-backend wire parity confirms .NET + bun emit byte-identical `link` field

Task 9 (publishing) is operator-driven and runs AFTER the project sanity sweep + AFTER operator confirms versions match expectations.
</verification>

<success_criteria>
- [ ] SectionNode.link declared in TS + .NET with JsonIgnore-on-null (.NET) and TSDoc citing issue #21 (TS).
- [ ] SectionLink helper record defined on .NET with `Url` required + `External` defaulting to false.
- [ ] Renderer emits `<a href>` wrapper (not `<section>`) when `link` is set; mirrors LinkNode external attribute pattern exactly.
- [ ] CSS class `.vms-section--linked` includes cursor + anchor-color-reset + text-decoration-reset + hover ring + :focus-visible outline.
- [ ] Containment: stopPropagation on all nested interactive controls; preventDefault additionally on nested anchor descendants so inner anchors win.
- [ ] TUI Enter-on-focused-pane navigates via `this.navigate(section.link.url)` when section has link.
- [ ] Tree validation rejects all four new combos (action+link, link+collapsible, link-in-link, mixed action↔link nesting) with `invalid_tree`.
- [ ] Existing action+collapsible and action-in-action rejections still work (regression-free after the `outerClickable` → `outerInteractive` rename).
- [ ] Section without `link` AND without `action` renders byte-identical (wire + DOM) to pre-change baseline.
- [ ] Parity suite passes — both backends emit byte-identical wire for `link` present (`{"url", "external"}` shape) and absent.
- [ ] Showcase demo includes 2-3 external-link tiles that demonstrate the feature with real URLs.
- [ ] npm bumped 1.4.0 → 1.5.0; NuGet bumped 1.3.0 → 1.4.0; package-lock.json re-synced.
- [ ] CHANGELOG.md and MIGRATION.md have new 1.5.0/1.4.0 entries citing issue #21; old entries untouched.
- [ ] **Task 9 only**: operator publishes to npm + NuGet + pushes the v1.5.0 git tag (or explicitly defers publishing).
</success_criteria>

<output>
Create `.planning/quick/260614-bmd-issue-21-sectionnode-url-link-variant-cl/260614-bmd-SUMMARY.md` when done. Include:
- Summary of changes per task
- Files touched (full paths)
- Test run results (vitest + dotnet test + parity)
- Version bump confirmation
- Whether Task 9 (publishing) was completed by the operator or deferred + rationale
- Any deviations from the plan (apply Rule 1 — diverge from the plan when an instruction contradicts existing patterns; note each deviation explicitly with the reason)
</output>
