---
phase: 260730-obc-listrow-standalone-cq-fix
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - viewmodel-shell/styles/default.css
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/test/list-row.test.ts
  - /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/index.html
  - /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/browser.js
  - /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/default.css
autonomous: false
requirements: []

must_haves:
  truths:
    - "A ListRowNode rendered STANDALONE (parent is not `.vms-list`) stacks correctly below 28rem container width — leading/content/trailing on separate rows, primary text unbroken."
    - "A ListRowNode inside ListNode(variant:\"rows\") emits byte-identical DOM to today (zero regression for the primary consumer path)."
    - "The tasting page section 2's new third panel (SectionNode wrapper + 8.0.3 assets) visually matches the middle panel (ListNode wrapper) at 320px width."
    - "Full green-tree gate passes at the release commit."
    - "Ashley eyeballs the tasting page third panel and confirms the fix before publish."
  artifacts:
    - path: "viewmodel-shell/styles/default.css"
      provides: "New `.vms-list-row-standalone-container` class with `display:block; container-type:inline-size;`. `.vms-list-row-standalone` REMOVED from the container-type declaration."
      contains: ".vms-list-row-standalone-container"
    - path: "viewmodel-shell/src/browser.ts"
      provides: "listRow() wraps the standalone row in an outer .vms-list-row-standalone-container div."
      contains: "vms-list-row-standalone-container"
    - path: "viewmodel-shell/test/list-row.test.ts"
      provides: "Updated standalone test + new in-list negative test verifying the wrapper's presence/absence."
      contains: "vms-list-row-standalone-container"
  key_links:
    - from: "viewmodel-shell/src/browser.ts (listRow)"
      to: "viewmodel-shell/styles/default.css (.vms-list-row-standalone-container)"
      via: "className emitted by renderer, styled by CSS establishing CQ context on the wrapper"
      pattern: "vms-list-row-standalone-container"
    - from: "tasting page section 2 third panel"
      to: "post-fix built assets (browser.js + default.css)"
      via: "copied into the tasting page's asset dir"
      pattern: "AFTER FIX"
---

<objective>
Fix the ListRowNode standalone container-query scope bug (diagnosed this session: `container-type` on the row itself cannot restyle the row via CQ — the row IS the container, and per CSS Containment spec a container's own rules don't apply to itself) by introducing an outer wrapper element that owns the CQ context.

Purpose: ListRowNode is a shipped v8.0.0 composite. Its standalone rendering path (used whenever the parent is not `.vms-list` — the canonical case is wrapping list-rows in a SectionNode, which is what Metis prod does) collapses catastrophically at column widths below 28rem: the ChipListNode in trailing takes max-content, the middle 1fr clamps to min-content, and `overflow-wrap: anywhere` shatters primary text to one char per line. The 8.0.1 CQ stack was correctly added to `.vms-list--rows` (the ListNode variant path), but the same class on `.vms-list-row-standalone` is a no-op because the row IS the container — the fix works only for the wrapping-collection path, leaving the standalone path broken. Real consumer impact confirmed at http://100.113.23.63:41139/ section 2 this session.

Output: npm 8.0.3 patch (CSS + renderer + test only; NuGet unchanged). Standalone rows stack correctly below 28rem; in-list rows unchanged (byte-identical DOM).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@AGENTS.md
@CLAUDE.md

# Target files — read the exact regions BEFORE editing.
# Current CSS (v8.0.2) — the ineffective `.vms-list-row-standalone { container-type: inline-size; }` declaration:
@viewmodel-shell/styles/default.css

# Current listRow() renderer — the standalone branch at line 1158-1173 that
# needs a wrapper div added when !isInList:
@viewmodel-shell/src/browser.ts

# Existing standalone test at line 172-180 asserts `<div>` is the direct child
# with class `vms-list-row.vms-list-row-standalone`. The DOM emission delta
# means this test must be updated to expect the outer wrapper.
@viewmodel-shell/test/list-row.test.ts

# The tasting page — section 2 currently panels-2 (BEFORE SectionNode vs
# MIDDLE ListNode); needs a third panel using post-fix assets.
# NOTE: this path is OUTSIDE the repo tree — the tasting page lives in Vicky's
# bounties dir. Use absolute paths for both the HTML and the asset dir.

# CHANGELOG format reference — the 8.0.1 and 8.0.2 entries at the top of
# CHANGELOG.md are the format template for the new 8.0.3 entry.
@CHANGELOG.md

# MIGRATION format reference.
@MIGRATION.md

# Current package version — will bump from 8.0.2 → 8.0.3.
@viewmodel-shell/package.json

<interfaces>
<!-- The CQ context invariant this fix relies on:

CSS Containment spec: an element with `container-type: inline-size` establishes
a CQ context for its DESCENDANTS. A container's own rules cannot be restyled
by its own container queries.

Current v8.0.2 code (WRONG for standalone):
```css
.vms-list--rows,
.vms-list-row-standalone { container-type: inline-size; }

@container (max-width: 28rem) {
  .vms-list-row { grid-template-columns: 1fr; grid-template-areas: "leading" "content" "trailing"; ... }
  .vms-list-row__leading  { grid-area: leading; ... }
  .vms-list-row__content  { grid-area: content; }
  .vms-list-row__trailing { grid-area: trailing; ... }
}
```

For `.vms-list--rows` (isInList): the `<ul>` is the container; `<li class="vms-list-row">`
is a descendant; CQ restyles it. WORKS.

For `.vms-list-row-standalone` (!isInList): the `<div class="vms-list-row vms-list-row-standalone">`
IS the container. The `.vms-list-row` rule inside `@container` targets the container itself
→ ignored. The children rules match, but their `grid-area` values reference the parent's
`grid-template-areas` which was never set → grid-area fails silently → row keeps its default
`grid-template-columns: auto 1fr auto` → collapse. BROKEN.

Fix: introduce an outer wrapper element in the standalone case that owns the CQ context.
The row becomes a descendant of a genuine container.

Post-fix DOM emission:

  in-list (unchanged):
    <ul class="vms-list vms-list--rows">           ← CQ container
      <li class="vms-list-row">…</li>              ← descendant, restyled correctly
    </ul>

  standalone (was: `<div class="vms-list-row vms-list-row-standalone">…</div>`):
    <div class="vms-list-row-standalone-container"> ← NEW: CQ container
      <div class="vms-list-row vms-list-row-standalone">…</div>  ← now a descendant
    </div>

Post-fix CSS:

  .vms-list-row-standalone-container { display: block; container-type: inline-size; }
  .vms-list--rows { container-type: inline-size; }  ← only the standalone class removed from the union

The @container block itself is UNCHANGED (still targets `.vms-list-row` and its
`__leading`/`__content`/`__trailing` children).
-->

Consumer-visible DOM emission delta (for CHANGELOG.md + MIGRATION.md):

  Standalone ListRowNode: one extra `<div class="vms-list-row-standalone-container">`
  wrapper appears between the row and its parent. Playwright / DOM-shape tests that
  assumed the row was a direct child of its parent will need one extra step in the
  selector chain. Consumers using `.vms-list-row-standalone` / `.vms-list-row` selectors
  directly (not caring about parent chain) are unaffected. In-list rendering is unchanged.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: CSS + renderer change with local jsdom test proof</name>
  <files>viewmodel-shell/styles/default.css, viewmodel-shell/src/browser.ts, viewmodel-shell/test/list-row.test.ts</files>
  <action>
Make three edits in this order and commit as one atomic change (or three sequential commits if the executor's protocol prefers — either is fine, since the tests only pass end-to-end).

Edit 1 — `viewmodel-shell/styles/default.css` around line 1218-1219:

Replace the current two-selector declaration:
```
.vms-list--rows,
.vms-list-row-standalone { container-type: inline-size; }
```
with:
```
.vms-list--rows { container-type: inline-size; }

/* Standalone rows can't be their OWN CQ container — a container's rules
   don't apply to itself per CSS Containment spec. Wrap in an outer element
   that owns the CQ context; the row becomes a descendant that CQ can restyle.
   Renderer emits this wrapper only in the standalone path (browser.ts:listRow). */
.vms-list-row-standalone-container { display: block; container-type: inline-size; }
```
The `@container (max-width: 28rem) { ... }` block IMMEDIATELY BELOW at line 1221 stays byte-identical — it already targets `.vms-list-row` and its `__leading`/`__content`/`__trailing` children, which are descendants of the new wrapper. Also keep the existing `.vms-list-row-standalone { background/border/border-radius/border-top }` block at lines 1202-1207 unchanged — that class still exists on the row itself and provides its bordered-surface styling; only the container-type declaration moves.

Edit 2 — `viewmodel-shell/src/browser.ts`, `listRow()` method at line 1158:

The current `!isInList` branch creates a `<div>` with `.vms-list-row vms-list-row-standalone` classes and appends it directly to `parent`. Change the parent-append step so that in the standalone case (`!isInList`), the row `<div>` is appended to an outer `<div class="vms-list-row-standalone-container">` which is then appended to `parent`. In the in-list case (`isInList`), the `<li>` continues to be appended to `parent` directly — zero DOM delta.

The simplest shape (find where the built row element gets appended to `parent` — locate the `parent.appendChild(el)` in this method; if the method appends to parent multiple times or via a different path, respect the existing flow):

Where the method currently does its final append to `parent`, replace with:
```typescript
if (isInList) {
  parent.appendChild(el);
} else {
  const wrapper = document.createElement("div");
  wrapper.className = "vms-list-row-standalone-container";
  wrapper.appendChild(el);
  parent.appendChild(wrapper);
}
```
Keep all existing behavior on `el` (class list, tabIndex, aria-label, keyboard/click handlers) unchanged — the wrapper is purely a DOM structural addition to establish the CQ context. Add a comment referencing the CSS side and the diagnostic reason (one-liner: "Outer wrapper establishes the CQ context — .vms-list-row-standalone can't be its own container per CSS Containment spec. See default.css:.vms-list-row-standalone-container.").

Edit 3 — `viewmodel-shell/test/list-row.test.ts`:

The existing test at lines 172-180 asserts `<div class='vms-list-row-standalone'>` is a direct child of the container — this assertion is now wrong. Update in place:

- Change the assertion from `container.querySelector("div.vms-list-row.vms-list-row-standalone")` to `container.querySelector("div.vms-list-row-standalone-container > div.vms-list-row.vms-list-row-standalone")`. Keep the tagName check (`el!.tagName === "DIV"`) and the negative `<li>` check.
- Update the test's `it(...)` description to reflect the wrapper: `"emits <div class='vms-list-row-standalone-container'> wrapper around the standalone row"`.

Then ADD one new negative test in the same describe block, immediately after the updated standalone test:

```typescript
it("does NOT wrap the row when inside a ListNode(variant:'rows') container", () => {
  const { container, render } = setup();
  render({
    type: "list",
    variant: "rows",
    children: [{ type: "list-row", primary: "Foo" }],
  });
  // In-list path: NO outer wrapper; the <li> lives directly under the <ul>.
  expect(container.querySelectorAll(".vms-list-row-standalone-container").length).toBe(0);
  expect(container.querySelectorAll(".vms-list--rows > li.vms-list-row").length).toBeGreaterThan(0);
});
```

Rationale (leave as a header comment near the two tests): "Regression guard for the v8.0.3 CQ scope fix — the wrapper appears ONLY in the standalone path so the in-list DOM stays byte-identical for the primary consumer path."
  </action>
  <verify>
    <automated>cd viewmodel-shell && npx vitest run test/list-row.test.ts</automated>
  </verify>
  <done>
  - `default.css` has `.vms-list-row-standalone-container { display: block; container-type: inline-size; }` and no longer lists `.vms-list-row-standalone` in the container-type declaration.
  - `browser.ts` listRow() wraps the row in a `.vms-list-row-standalone-container` div in the standalone branch; in-list branch unchanged.
  - `list-row.test.ts` updated standalone test passes; new negative in-list test passes.
  - `vitest run test/list-row.test.ts` — all list-row tests green.
  </done>
</task>

<task type="auto">
  <name>Task 2: Rebuild, run the full green-tree gate</name>
  <files>viewmodel-shell/dist/ (rebuilt outputs — implicit)</files>
  <action>
Rebuild the framework, then run the full green-tree gate per AGENTS.md "NEVER PUBLISH OR PUSH ANYTHING BROKEN". This is a mandatory precondition for the release ritual step Vicky will run after Ashley's visual confirmation.

Run each of these and capture any failure. `dotnet` lives at `~/.dotnet/dotnet` — put it on PATH first: `export PATH="$HOME/.dotnet:$PATH"`.

```bash
cd /home/thenasty/ViewModelShell/viewmodel-shell
npm run build
npm run check:test-types
npm run check:core-globals
npm run check:aa-contrast
npm run check:no-demo-style
npm run check:demo-types
npx vitest run

cd /home/thenasty/ViewModelShell
export PATH="$HOME/.dotnet:$PATH"
dotnet test viewmodel-shell-dotnet/Tests
for p in $(find demo -name '*.Tests.csproj'); do dotnet test "$p" || echo "FAIL: $p"; done

bun run parity/run.ts
```

If ANY step fails: STOP. Do NOT proceed to task 3. Report the failure with the exact command that failed and the tail of its output. Per AGENTS.md, "It was already failing on main" / "unrelated to my change" / "just a demo test" are NOT exceptions — surface it to the operator.

If ALL steps pass: the framework build artifacts (`viewmodel-shell/dist/`) are now the post-fix bundle that will feed the tasting page in task 3. Do NOT bump the package.json version yet — that happens in Vicky's release step after Ashley's visual sign-off.
  </action>
  <verify>
    <automated>echo "Manual gate — every command in the action block must exit 0"</automated>
  </verify>
  <done>
  - `npm run build` succeeds.
  - All six `check:*` scripts pass.
  - `npx vitest run` — all vitest suites pass (expect ~1250+ tests).
  - `dotnet test viewmodel-shell-dotnet/Tests` — all framework .NET tests pass.
  - Every `demo/**/*.Tests.csproj` passes.
  - `bun run parity/run.ts` — all parity backends agree.
  - Zero failures anywhere. If any failure surfaces, task 3 does NOT proceed until it's fixed or explicitly waived by Ashley.
  </done>
</task>

<task type="auto">
  <name>Task 3: Update the tasting page — add third panel with post-fix assets</name>
  <files>/home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/index.html, /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/browser.js, /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/default.css</files>
  <action>
The tasting page at http://100.113.23.63:41139/ section 2 currently has two panels (`.panels-2` at line 247): LEFT = SectionNode wrapper (BROKEN); RIGHT = ListNode(variant:"rows") wrapper (WORKING). Ashley needs to see a THIRD panel proving the 8.0.3 fix: SectionNode wrapper + post-fix assets should render identically to the middle panel.

The tasting page assets are self-contained copies of `browser.js` + `default.css` — they are NOT symlinked to the repo. To make the third panel use the post-fix code, replace those two files with the freshly-built post-fix output from task 2.

Steps:

1. Copy the rebuilt post-fix bundle into the tasting page asset dir:
```bash
cp /home/thenasty/ViewModelShell/viewmodel-shell/dist/browser.js \
   /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/browser.js
cp /home/thenasty/ViewModelShell/viewmodel-shell/styles/default.css \
   /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/default.css
```

2. Edit `index.html` section 2:
   - Change `<div class="panels-2">` at line 247 to `<div class="panels-3">`.
   - Add a THIRD `<div class="panel">` block after the existing middle (ListNode) panel, before the closing `</div>` of the `.panels-3` wrapper. Structure:
     ```html
     <div class="panel">
       <h3 class="good">AFTER FIX — <code>SectionNode</code> wrapper + 8.0.3 CSS</h3>
       <p class="note">
         Wire: <code>{type:"section", id:"incident-list-stack", children:[…same 15 list-rows…]}</code>.
         Uses the POST-FIX renderer + CSS (outer <code>.vms-list-row-standalone-container</code>
         div establishes the CQ context). Should visually match the middle panel — proves the
         v8.0.3 fix survives Metis's actual composition shape.
       </p>
       <div class="width-320" id="section-2-panel-3"></div>
     </div>
     ```
   - Find the render script for the section-2 panels (around line 361 — `metisSectionTree` and `metisListTree`). Add a THIRD render call that reuses the SAME `metisSectionTree` (SectionNode wrapper, same 15 children) and mounts it into `#section-2-panel-3`. The DOM code for the new panel is identical to the existing SectionNode-panel render — it just targets a different mount node. The visual difference between panel 1 (BROKEN) and panel 3 (FIXED) comes entirely from the swapped assets, since panel 1 and panel 3 use the same tree.
   - Update section 2's `<h2>` heading + intro copy to reflect the three-panel comparison ("LEFT — pre-fix broken; MIDDLE — ListNode workaround; RIGHT — post-fix, same composition as LEFT but with 8.0.3 assets"). Keep the copy tight; Ashley needs the eye-test, not a wall of prose.

3. Reload the tasting page in a browser (Ashley will do this in step 4 — the human-verify checkpoint below). Confirm the file is served correctly by checking the served bytes match the rebuilt output:
```bash
grep -c "vms-list-row-standalone-container" \
  /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/default.css
# Expect: at least 1 (grep counts matches; the new class name should appear in the CSS).
grep -c "vms-list-row-standalone-container" \
  /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/browser.js
# Expect: at least 1 (the renderer emits this className).
```

DO NOT touch the tasting page's other sections. DO NOT restart or restage the tailnet server — the page is served from disk; a fresh browser reload picks up the new bytes.
  </action>
  <verify>
    <automated>test -f /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/browser.js && test -f /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/default.css && grep -q 'vms-list-row-standalone-container' /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/default.css && grep -q 'vms-list-row-standalone-container' /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/browser.js && grep -q 'panels-3' /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/index.html && grep -q 'AFTER FIX' /home/thenasty/.claude/identities/vicky/bounties/ai-coordination/listrow-slot-density-tasting/index.html && echo OK</automated>
  </verify>
  <done>
  - Tasting page assets replaced with post-fix build output; both files contain the `vms-list-row-standalone-container` token.
  - `index.html` section 2 uses `.panels-3` and includes the AFTER FIX third panel that mounts a SectionNode-wrapped tree with the same 15 Metis-shape list-rows.
  - Fresh browser reload of http://100.113.23.63:41139/ shows three panels in section 2.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 4: Ashley visual confirmation — third panel matches middle panel</name>
  <what-built>
Post-fix v8.0.3 CSS + renderer (task 1), full green-tree gate passed (task 2), tasting page section 2 updated with the AFTER FIX third panel using the post-fix assets (task 3).
  </what-built>
  <how-to-verify>
This is the in-question gate per VMS AGENTS.md — a visual/rendering change that only Ashley can confirm turned out right. Vicky will NOT proceed to publish until this checkpoint is signed off.

1. Open http://100.113.23.63:41139/ in a browser (hard-reload / cache-bypass to pick up the new `browser.js` + `default.css`: Cmd/Ctrl-Shift-R).

2. Scroll to section 2 ("Wrapper diagnostic — SectionNode (Metis) vs ListNode(variant:'rows')"). You should now see THREE panels (was two).

3. Confirm visually:
   - LEFT panel (BEFORE — SectionNode wrapper, pre-fix assets): rows COLLAPSE. Primary text shatters to one char per line. This is Metis's real prod bug reproduced.
   - MIDDLE panel (ListNode(variant:"rows") wrapper, pre-fix assets): rows STACK correctly. Leading → content → trailing on separate rows. Primary text intact. This is the 8.0.1 fix working for the ListNode path.
   - RIGHT panel (AFTER FIX — SectionNode wrapper, post-fix v8.0.3 assets): rows should STACK correctly, VISUALLY MATCHING the middle panel. Same composition as LEFT (SectionNode wrapping list-rows — Metis's actual shape) but with the post-fix outer `.vms-list-row-standalone-container` establishing the CQ context.

4. If the RIGHT panel matches the MIDDLE panel → the fix is proven. Say "approved" (or the equivalent) to unblock Vicky's release ritual.

5. If the RIGHT panel still collapses or renders differently from the middle panel → the fix is incomplete. Report what you see; Vicky will NOT publish. Send it back to the executor for a second pass.
  </how-to-verify>
  <resume-signal>Ashley types "approved" (fix visually confirmed) or describes what's still wrong (fix incomplete — do NOT publish; return to executor).</resume-signal>
</task>

<task type="auto">
  <name>Task 5: Handoff to Vicky for release ritual</name>
  <files>(no code changes — this task hands the release off to Vicky per the in-question gate)</files>
  <action>
Ashley has signed off (task 4 approved). The code + tasting page changes are complete and green. The remaining steps are the release ritual per VMS AGENTS.md and are handled by Vicky (the maintainer identity), NOT the executor:

- Version bump `viewmodel-shell/package.json` 8.0.2 → 8.0.3.
- CHANGELOG.md entry for 8.0.3 (format matches the 8.0.1 and 8.0.2 entries at the top of CHANGELOG.md — "What changed" / "Why this shipped" / "Verification" sections, plus a note about the DOM emission delta: standalone rows now render inside an outer `.vms-list-row-standalone-container` div; Playwright/DOM-shape tests that assumed the row was a direct child will need one extra step in the selector chain).
- MIGRATION.md note for the same DOM emission delta.
- Commit + push to main.
- `npm publish` (auth precheck: source .env, `npm whoami` verifies; credentials in gitignored repo-root .env per AGENTS.md).
- Tag `v8.0.3` at the release commit and push the tag.
- Advance main and verify with `git merge-base --is-ancestor v8.0.3 main`.
- Watch CI green.
- NO NuGet change (CSS + renderer only, no .NET code touched — the .NET twin ships no `browser.ts` and no `default.css`).

The executor's job is done. Post a summary of what was landed (files touched, tests added, gate passed) and hand off. Do not attempt to publish, tag, or touch `viewmodel-shell/package.json`.
  </action>
  <verify>
    <automated>echo "Handoff task — no automated verification; the executor summarizes and stops."</automated>
  </verify>
  <done>
  - Executor's SUMMARY.md written (files modified, tests added/updated, green-tree gate result, Ashley's approval token).
  - No version bump attempted.
  - No `npm publish` or `git tag` attempted.
  - Vicky picks up the release ritual from here.
  </done>
</task>

</tasks>

<verification>
Overall phase checks:
- `vitest run test/list-row.test.ts` — updated standalone test + new in-list negative test both pass.
- Full `npx vitest run` — no regressions in the ~1250 existing tests.
- `check:core-globals`, `check:aa-contrast`, `check:no-demo-style`, `check:demo-types`, `check:test-types` all pass.
- `dotnet test viewmodel-shell-dotnet/Tests` + every `demo/**/*.Tests.csproj` pass.
- `bun run parity/run.ts` all backends agree.
- Tasting page section 2 renders three panels; RIGHT visually matches MIDDLE per Ashley's eye-test.
- No touch to `viewmodel-shell/package.json`, CHANGELOG.md, or MIGRATION.md by the executor — those are Vicky's release-ritual steps AFTER Ashley's sign-off.
</verification>

<success_criteria>
- A standalone ListRowNode below 28rem CQI stacks correctly (leading → content → trailing on separate rows; primary text unbroken).
- An in-list ListRowNode (`ListNode(variant:"rows")`) emits byte-identical DOM to today — the primary consumer path is regression-free.
- Full green-tree gate passes at the executor's stopping commit.
- Ashley signed off on the visual A/B/C comparison in the tasting page.
- Vicky has a clean, gate-passing HEAD to run the release ritual against.
</success_criteria>

<output>
Create `.planning/quick/260730-obc-listrow-standalone-cq-fix/260730-obc-01-SUMMARY.md` when done.

Summary should include:
- The three edits made (CSS class add + reshuffle, renderer wrapper, test update + new negative test).
- Green-tree gate result (all commands passed, or which one failed).
- Tasting page third panel added — confirmation that both replaced asset files contain the `vms-list-row-standalone-container` token.
- Ashley's approval token from the human-verify checkpoint.
- Explicit note: "Version bump + CHANGELOG + MIGRATION + npm publish + tag = Vicky's next steps, NOT executor scope."
</output>
