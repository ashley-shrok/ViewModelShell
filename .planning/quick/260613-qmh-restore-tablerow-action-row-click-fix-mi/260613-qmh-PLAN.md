---
phase: quick-260613-qmh
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell-dotnet/ViewModels.cs
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/styles/default.css
  - demo/HelpDesk/AspNetCore/AgentController.cs
  - demo/HelpDesk-bun/server.ts
  - demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs
  - viewmodel-shell/test/table-row-action.test.ts
  - viewmodel-shell/package.json
  - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
  - CHANGELOG.md
  - MIGRATION.md
  - AGENTS.md
autonomous: true
requirements:
  - QMH-01-row-action-restored
  - QMH-02-actions-mixed-types
  - QMH-03-helpdesk-demo-migrated
  - QMH-04-tests-cover-both-fixes
  - QMH-05-release-1.1.0-shipped

must_haves:
  truths:
    - "TableRow.action exists on both TS and .NET sides as an optional ActionEvent / ActionDescriptor with no context field."
    - "Clicking anywhere on a row with row.action set dispatches the action; clicking a per-row button, checkbox, or cell link does NOT also fire the row action."
    - "Pressing Enter or Space while a clickable row is focused dispatches the row action; Space prevents page scroll; Tab does not dispatch."
    - "Clickable rows expose role=button, tabindex=0, and a non-empty aria-label."
    - "A CheckboxNode in TableRow.actions[] renders as a real <input type=checkbox> (not an empty button) and remains bound."
    - "HelpDesk Agent queue rows fire select-ticket-{id} on row click (no Open button in the trailing actions cell) AND still show the per-row selection checkbox."
    - "All four CI suites pass: vitest (240+), HelpDesk dotnet (26+), parity, and the core-globals + AA-contrast guards."
    - "npm + NuGet ship 1.1.0 in lockstep with a CHANGELOG entry and MIGRATION note."
  artifacts:
    - path: "viewmodel-shell/src/index.ts"
      provides: "TableRow.action?: ActionEvent and TableRow.actions?: (ButtonNode | CheckboxNode)[]"
      contains: "action?: ActionEvent"
    - path: "viewmodel-shell-dotnet/ViewModels.cs"
      provides: "TableRow.Action with [JsonIgnore] when-null on the wire"
      contains: "ActionDescriptor? Action"
    - path: "viewmodel-shell/src/browser.ts"
      provides: "row-click + keyboard handler; type-dispatch over actions[] entries; stopPropagation on actions td and linkLabel anchors when row.action is set"
    - path: "viewmodel-shell/test/table-row-action.test.ts"
      provides: "jsdom suite covering both bug fixes — row.action click/keyboard/ARIA, stopPropagation containment, CheckboxNode actually renders as input[type=checkbox]"
    - path: "demo/HelpDesk/AspNetCore/AgentController.cs"
      provides: "row.Action set to select-ticket-{id}; Open button removed; selection CheckboxNode retained"
    - path: "demo/HelpDesk-bun/server.ts"
      provides: "matching change in the bun twin"
    - path: "CHANGELOG.md"
      provides: "1.1.0 release entry covering both fixes"
      contains: "1.1.0"
    - path: "MIGRATION.md"
      provides: "Brief 1.1.0 note about additive change + mixed types in row.actions[]"
      contains: "1.1.0"
  key_links:
    - from: "viewmodel-shell/src/browser.ts"
      to: "TableRow.action"
      via: "row click + keydown handler; emits on({ name: row.action.name })"
      pattern: "row\\.action"
    - from: "viewmodel-shell/src/browser.ts"
      to: "actions[] entry dispatch"
      via: "switch on entry.type for 'button' | 'checkbox'"
      pattern: "entry\\.type"
    - from: "demo/HelpDesk/AspNetCore/AgentController.cs"
      to: "TableRow.Action"
      via: "ActionDescriptor($\"select-ticket-{t.Id}\")"
      pattern: "select-ticket"
    - from: "viewmodel-shell-dotnet/ViewModels.cs (Action field) and viewmodel-shell/src/index.ts (action field)"
      to: "wire shape parity"
      via: "1:1 mirror with JsonIgnore-when-null on .NET"
      pattern: "Action"
---

<objective>
Ship two related TableRow bug fixes from the Phase-6 wire-shape refactor as a single npm 1.1.0 + NuGet 1.1.0 release:

1. **Restore `TableRow.action`** — the click-anywhere row dispatch primitive removed in 61193ff / cleaned up in 2410fe3. Re-add it with full keyboard (Enter + Space) + ARIA (role=button, tabindex=0, aria-label).
2. **Fix `TableRow.actions[]` mixed types** — the TS type was `ButtonNode[]` but the renderer was called blindly as `this.button(entry, td, on)`. HelpDesk-bun (and HelpDesk/AspNetCore) put a CheckboxNode in there alongside the ButtonNode, so the per-row selection checkbox silently rendered as an empty button. Type as `(ButtonNode | CheckboxNode)[]` on TS, keep `IReadOnlyList<ViewNode>` on .NET (intentional loose typing for the polymorphic discriminator), dispatch by `entry.type` in the renderer.

Migrate the HelpDesk demo (both backends) to the canonical pattern: `row.action = select-ticket-{id}` for click-anywhere navigation, `row.actions[] = [CheckboxNode]` for the per-row bulk-selection checkbox (no Open button). Update tests, parity fixture, CHANGELOG, MIGRATION, and AGENTS.md docs. Bump npm + NuGet to 1.1.0 in lockstep.

Purpose: Restore lost feature parity + a11y improvement, fix latent silent breakage that was masking the HelpDesk bulk-action toolbar, and ship as a clean additive minor.
Output: 1.1.0 release with passing CI (vitest, dotnet, parity, core-globals + AA-contrast guards), atomic per-task commits to the current branch (main).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@AGENTS.md
@viewmodel-shell/src/index.ts
@viewmodel-shell/src/browser.ts
@viewmodel-shell-dotnet/ViewModels.cs
@viewmodel-shell/styles/default.css
@demo/HelpDesk/AspNetCore/AgentController.cs
@demo/HelpDesk-bun/server.ts
@demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs
@parity/fixtures/helpdesk.json
@CHANGELOG.md
@MIGRATION.md
@viewmodel-shell/package.json
@viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj

<interfaces>
<!-- Pre-extracted from the live source so the executor doesn't have to scavenger-hunt. -->

Current TableRow (TS — viewmodel-shell/src/index.ts:295):
```typescript
export interface TableRow {
  id?: string;
  cells: Record<string, string>;
  /** Per-row action buttons. Each is a full ButtonNode with its own unique
   *  action name (e.g. `delete-row-42`, `close-ticket-42`) — per-row identity
   *  is encoded in the name, not as a separate context payload. */
  actions?: ButtonNode[];
  variant?: string;
}
```

Current TableRow (.NET — viewmodel-shell-dotnet/ViewModels.cs:352):
```csharp
public record TableRow(
    Dictionary<string, string> Cells,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Id = null,
    // ... (existing Actions field stays as IReadOnlyList<ViewNode>?, see file)
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ViewNode>? Actions = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Variant = null
);
```
Maintainer rule (already documented in ViewModels.cs header): every nullable wire field MUST carry `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`. The new `Action` field must follow it.

Current renderer cell loop (browser.ts:761-794) — what to extend:
```typescript
n.rows.forEach(row => {
  const tr = document.createElement("tr");
  let rowClass = "vms-table__row";
  if (row.variant) rowClass += ` vms-table__row--${row.variant}`;
  tr.className = rowClass;
  if (row.id) tr.dataset.id = row.id;
  n.columns.forEach(col => {
    const td = document.createElement("td");
    td.className = "vms-table__td";
    const cellValue = row.cells[col.key] ?? "";
    if (col.linkLabel && cellValue) {
      const a = document.createElement("a");
      a.href = cellValue;
      // ... (existing linkExternal handling)
      td.appendChild(a);
    } else {
      td.textContent = cellValue;
    }
    tr.appendChild(td);
  });
  // Per-row buttons render as plain ButtonNodes in a trailing actions cell.
  if (row.actions && row.actions.length > 0) {
    const td = document.createElement("td");
    td.className = "vms-table__td vms-table__td--actions";
    for (const btn of row.actions) this.button(btn, td, on);  // ← BUG: blind ButtonNode call
    tr.appendChild(td);
  }
  tbody.appendChild(tr);
});
```

CSS already in place (default.css:606-613):
```css
.vms-table__row--clickable { cursor: pointer; }
.vms-table__row--clickable:hover { background: var(--vms-surface); }
.vms-table__row--disabled.vms-table__row--clickable { cursor: default; }
.vms-table__row--disabled.vms-table__row--clickable:hover { background: transparent; }
```
**Important:** `--clickable` already exists from pre-Phase-6. We're adding the `:focus-visible` ring + restoring the renderer that toggles the class. There is NO `--vms-focus` token in the framework — route the focus ring through the existing `--vms-accent` token (used for the same purpose elsewhere in the file).

Internal renderer for checkbox (browser.ts:498):
```typescript
private checkbox(n: CheckboxNode, parent: HTMLElement, on: (a: ActionEvent) => void): void { ... }
```
This is the method to call when an actions[] entry has `type: "checkbox"`.

Bun-side rowActions assembly (demo/HelpDesk-bun/server.ts:358):
```typescript
const rowActions: ViewNode[] = [
  // per-row selection checkbox (binds to selectedIds.{id})
  { type: "checkbox", name: `select-${t.id}`, bind: `selectedIds.${t.id}`, ... },
  { type: "button", label: "Open", action: { name: `select-ticket-${t.id}` }, variant: "secondary" },
];
// ... later: actions: rowActions
```

.NET-side rowActions assembly (AgentController.cs:177):
```csharp
var rowActions = new List<ViewNode>
{
    new CheckboxNode($"select-{t.Id}", $"selectedIds.{t.Id}", null, null),
    new ButtonNode("Open", new ActionDescriptor($"select-ticket-{t.Id}"), "secondary"),
};
return new TableRow(Cells: ..., Id: t.Id.ToString(), Actions: rowActions, Variant: ...);
```

Existing .NET test assertions for row.Actions (AgentControllerTests.cs:152-161) — must update after migration:
```csharp
Assert.NotNull(row.Actions);
var checkbox = row.Actions!.OfType<CheckboxNode>().Single();
// ...
var openBtn = row.Actions!.OfType<ButtonNode>().Single();
Assert.Equal($"select-ticket-{id}", openBtn.Action.Name);
```
After migration: assert NO ButtonNode in row.Actions; assert CheckboxNode still present; assert `row.Action` carries `select-ticket-{id}`.

Current versions (must move in lockstep):
- viewmodel-shell/package.json: `"version": "1.0.1"`
- viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj: `<Version>1.0.0</Version>`

Target: BOTH bump to **1.1.0** (additive change; minor bump per framework rule).
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Restore TableRow.action + widen actions[] type on both backends</name>
  <files>viewmodel-shell/src/index.ts, viewmodel-shell-dotnet/ViewModels.cs</files>
  <behavior>
    - TableRow.action exists on TS as `action?: ActionEvent` (no context field; per-row identity goes in the action name — consistent with Phase 6 wire).
    - TableRow.actions on TS is `(ButtonNode | CheckboxNode)[]` (closed union, doc-commented).
    - TableRow.Action exists on .NET as `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null` — follows the maintainer rule in the file header.
    - .NET TableRow.Actions stays `IReadOnlyList<ViewNode>?` (do NOT narrow it; the existing comment about polymorphic discriminator emission still applies).
    - Doc comment on TS `action` explains: click-anywhere primitive; full keyboard + ARIA exposed by the renderer; per-row identity encoded in the action name; coexists with `actions[]` (clicking a button/checkbox/link inside the row does NOT also fire row.action).
    - Doc comment on .NET `Action` mirrors the TS guidance plus the JsonIgnore maintainer rule.
    - Existing fields preserved verbatim — no semantic change to id / cells / variant.
  </behavior>
  <action>
    Edit viewmodel-shell/src/index.ts: in the `TableRow` interface, add `action?: ActionEvent` (before `actions?`) and change `actions?: ButtonNode[]` to `actions?: (ButtonNode | CheckboxNode)[]`. Write JSDoc comments explaining intent per the behavior block above. Keep id / cells / variant unchanged.

    Edit viewmodel-shell-dotnet/ViewModels.cs: in the `TableRow` record, add a new parameter `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ActionDescriptor? Action = null` positioned such that the record-parameter order is stable (place it after `Variant` to avoid breaking any positional construction — verify by grepping the codebase for `new TableRow(` with positional args before deciding; if all callers use named args, placement is free). Leave the existing `Actions` field as `IReadOnlyList<ViewNode>?`. Add an `///` doc comment matching the behavior block.

    Do NOT touch the renderer, demos, tests, or release files in this task — that's task 2 onward. This is the type-contract slice.

    Then atomically commit to the current branch (DO NOT push, per the working agreement in AGENTS.md):
    `git add viewmodel-shell/src/index.ts viewmodel-shell-dotnet/ViewModels.cs && git commit -m "feat(table): restore TableRow.action and widen actions[] to ButtonNode|CheckboxNode"`
  </action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell && npx tsc --noEmit && cd /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet && dotnet build --nologo -v minimal</automated>
  </verify>
  <done>Both type files compile clean. TableRow.action exists on both sides; TableRow.actions is `(ButtonNode | CheckboxNode)[]` on TS; `IReadOnlyList<ViewNode>?` on .NET (unchanged). Atomic commit landed on the current branch.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement row-click + type-dispatched actions[] in the browser renderer + focus-ring CSS</name>
  <files>viewmodel-shell/src/browser.ts, viewmodel-shell/styles/default.css</files>
  <behavior>
    - When `row.action` is set, the `<tr>` gets:
      - class `vms-table__row--clickable` appended
      - `tr.tabIndex = 0`
      - `tr.setAttribute("role", "button")`
      - `aria-label` = concatenated non-empty cell text values (space-separated), trimmed; if empty, fall back to `row.id`; if both empty, omit the aria-label rather than set it to ""
      - click listener: `on({ name: row.action.name })`
      - keydown listener: on `Enter` → dispatch; on `Space` (`" "` or `"Spacebar"`) → `e.preventDefault()` then dispatch; on any other key → ignore
    - When `row.action` is NOT set, the row renders exactly as today (no class change, no listeners, no role/tabindex) — backward-compatible.
    - actions[] cell dispatches by `entry.type`: `"button"` → `this.button(entry, td, on)`; `"checkbox"` → `this.checkbox(entry, td, on)`. Any other type is a no-op (forward-compatible). When `row.action` is set, attach a `click` listener on the actions `<td>` that calls `e.stopPropagation()`.
    - Cell linkLabel anchors: when `row.action` is set, attach a `click` listener on the `<a>` that calls `e.stopPropagation()`. Behavior with row.action unset is unchanged.
    - CSS: add `:focus-visible` rule for `.vms-table__row--clickable` that paints a visible 2px ring using `var(--vms-accent)` with `outline-offset: -2px` so the ring stays inside the row borders. Existing `.vms-table__row--clickable { cursor: pointer; }` is already in default.css — do NOT duplicate.
  </behavior>
  <action>
    Edit `viewmodel-shell/src/browser.ts` inside the `private table()` method:

    1. Inside the `n.rows.forEach(row => { ... })` loop, after the existing `tr.className = rowClass;` and `if (row.id) tr.dataset.id = row.id;` lines:
       - If `row.action` is set: append `" vms-table__row--clickable"` to the tr classname; set `tr.tabIndex = 0`; `tr.setAttribute("role", "button")`; compute aria-label from `Object.values(row.cells).filter(v => v && v.trim()).join(" ").trim()`, fall back to `row.id` if empty, only call `setAttribute("aria-label", ...)` when non-empty; attach click handler that calls `on({ name: row.action!.name })`; attach keydown handler that switches on `e.key` for `"Enter"` (dispatch, no preventDefault needed) and `" "` (preventDefault then dispatch) — store `row.action.name` in a const before the listeners to satisfy TS narrowing.

    2. In the cell loop, when rendering the `<a>` for `col.linkLabel && cellValue`: if `row.action` is set, add `a.addEventListener("click", (e) => e.stopPropagation())`.

    3. In the existing `if (row.actions && row.actions.length > 0)` block:
       - Replace `for (const btn of row.actions) this.button(btn, td, on);` with a typed switch over `entry.type`: `"button"` → `this.button(entry as ButtonNode, td, on)`; `"checkbox"` → `this.checkbox(entry as CheckboxNode, td, on)`; default → no-op (the union narrows; cast only as needed).
       - If `row.action` is set, add `td.addEventListener("click", (e) => e.stopPropagation())` AFTER children are appended.

    4. Update the JSDoc above `private table()` to mention `row.action` (click-anywhere, keyboard + ARIA) and mixed types in `row.actions[]`.

    Edit `viewmodel-shell/styles/default.css`: locate the existing block at line 606 (`.vms-table__row--clickable { cursor: pointer; }`). Add immediately after it:
    ```
    .vms-table__row--clickable:focus-visible {
      outline: 2px solid var(--vms-accent);
      outline-offset: -2px;
    }
    ```
    Do NOT remove or alter the existing `--clickable` `cursor: pointer`, `:hover`, or `--disabled` rules.

    Run `cd /home/ubuntu/ViewModelShell/viewmodel-shell && npm run check:core-globals && npm run check:aa-contrast` to ensure neither guard regresses. If AA contrast fails on the focus ring, raise the issue immediately — do not silently swap colors without checking the implication for the dark-purple theme.

    Atomic commit to the current branch (no push):
    `git add viewmodel-shell/src/browser.ts viewmodel-shell/styles/default.css && git commit -m "feat(table): render TableRow.action with keyboard + ARIA; dispatch actions[] by entry.type"`
  </action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell && npx tsc --noEmit && npm run check:core-globals && npm run check:aa-contrast</automated>
  </verify>
  <done>TS compiles. core-globals + AA-contrast guards pass. Renderer dispatches row.action on click, Enter, and Space (with preventDefault); does NOT bubble per-row button/checkbox/link clicks. CheckboxNode in actions[] renders via this.checkbox(). Atomic commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Write the jsdom test suite that proves both fixes — RED then GREEN</name>
  <files>viewmodel-shell/test/table-row-action.test.ts</files>
  <behavior>
    Vitest + jsdom (matches existing test patterns in viewmodel-shell/test/*.test.ts). Cover:
    - Test A: clicking anywhere on a row with `row.action` dispatches an action whose `name` matches `row.action.name`.
    - Test B: pressing Enter while a clickable row is focused dispatches the action.
    - Test C: pressing Space (key `" "`) while focused dispatches AND calls preventDefault on the event (assert `defaultPrevented` is true).
    - Test D: pressing Tab while focused does NOT dispatch.
    - Test E: clicking a per-row ButtonNode inside `row.actions[]` does NOT also fire `row.action` (assert the only dispatched action is the button's, not the row's).
    - Test F: clicking a per-row CheckboxNode inside `row.actions[]` does NOT also fire `row.action`.
    - Test G: clicking a cell linkLabel `<a>` (when `row.action` is set) does NOT fire `row.action`.
    - Test H (latent bug fix): a row with `actions: [CheckboxNode]` renders an actual `<input type="checkbox">` inside `.vms-table__td--actions` — NOT an empty `<button>`. Assert by querying `td.vms-table__td--actions input[type="checkbox"]`.
    - Test I (a11y): clickable rows expose `role="button"`, `tabindex="0"`, and a non-empty `aria-label` (assert it contains text from the cells).
    - Test J (backward-compat): a row WITHOUT `row.action` has NO `--clickable` class, NO tabindex, NO role, NO aria-label.
  </behavior>
  <action>
    Create `viewmodel-shell/test/table-row-action.test.ts`. Use the existing `table-selection-pagination.test.ts` and `theme-modifiers.test.ts` as scaffolding references — same import shape (vitest + jsdom + BrowserAdapter). For each test:
    - Build a minimal `TableNode` view tree with two rows: row 1 has `action: { name: "select-row-1" }`, `cells: { title: "Outlook crash", status: "Open" }`, `actions: [CheckboxNode, ButtonNode]`; row 2 omits `action` (for the backward-compat test).
    - Mount via `new BrowserAdapter(container)` + `adapter.render(tree, onAction)` where `onAction` is a vitest mock.
    - For click tests, use `el.dispatchEvent(new MouseEvent("click", { bubbles: true }))` so propagation/stopPropagation is honored.
    - For keydown tests, use `new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })` etc. Assert `event.defaultPrevented` for the Space case.

    Be deliberate about the Space-key assertion: the renderer must call `preventDefault()`. Pattern:
    ```typescript
    const ev = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    tr.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
    expect(onAction).toHaveBeenCalledWith({ name: "select-row-1" });
    ```

    For the linkLabel test: include a `TableColumn` with `linkLabel: "Open"` and a cell value that is a URL. Find the `<a>` inside the row and dispatch click on it.

    For the checkbox-actually-renders test: query `tr.querySelector(".vms-table__td--actions input[type='checkbox']")` and assert non-null.

    Run the suite: `cd /home/ubuntu/ViewModelShell/viewmodel-shell && npx vitest run test/table-row-action.test.ts`. All tests must pass. If any fail, fix the renderer (task 2) — do not loosen the tests.

    Then run the full suite to catch regressions: `cd /home/ubuntu/ViewModelShell/viewmodel-shell && npx vitest run`. The baseline was 240/240 + 1 skipped; the new suite ADDS tests, so the new baseline must be `prev_count + N`. If any prior test fails, fix the cause — do not skip.

    Atomic commit to current branch (no push):
    `git add viewmodel-shell/test/table-row-action.test.ts && git commit -m "test(table): cover row.action click+keyboard+ARIA and CheckboxNode-in-actions fix"`
  </action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell && npx vitest run test/table-row-action.test.ts && npx vitest run</automated>
  </verify>
  <done>New test file lands. All ten tests pass. Full TS suite (vitest) passes — no regressions in any other file. Atomic commit landed.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Migrate HelpDesk demo (both backends) + update .NET tests + parity fixture</name>
  <files>demo/HelpDesk/AspNetCore/AgentController.cs, demo/HelpDesk-bun/server.ts, demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs, parity/fixtures/helpdesk.json</files>
  <behavior>
    - .NET AgentController rows: set `TableRow.Action = new ActionDescriptor($"select-ticket-{t.Id}")`. Remove the `new ButtonNode("Open", ...)` from rowActions; keep `CheckboxNode($"select-{t.Id}", ...)` as the sole entry.
    - Bun AgentController rows: identical change — `action: { name: \`select-ticket-${t.id}\` }`; rowActions array contains only the CheckboxNode.
    - .NET AgentControllerTests: update the existing row.Actions assertions:
      - `row.Actions!.OfType<CheckboxNode>().Single()` still passes.
      - Add assertion: `Assert.Empty(row.Actions!.OfType<ButtonNode>())` (the Open button is gone).
      - Add assertion: `Assert.NotNull(row.Action); Assert.Equal($"select-ticket-{id}", row.Action!.Name);`
    - Parity fixture (parity/fixtures/helpdesk.json): no steps assert on row.actions array length explicitly, but the per-step normalized response will now differ for any agent GET — both backends must agree. Run the parity harness and confirm step-by-step parity. If any step needs a tweak (e.g. a comment update or a stateMutation re-alignment), make the minimum change.
    - Demos still mount and behave: clicking a row goes to the ticket detail page (same behavior as before, just no longer requires clicking Open); the per-row checkbox still toggles selection and the bulk toolbar still works.
  </behavior>
  <action>
    1. Edit `demo/HelpDesk/AspNetCore/AgentController.cs` around line 175-198: in the `tickets.Select(t => { ... })` lambda, change `rowActions` to contain only the `CheckboxNode` (drop the `ButtonNode`); pass `Action: new ActionDescriptor($"select-ticket-{t.Id}")` to the `TableRow` constructor.

    2. Edit `demo/HelpDesk-bun/server.ts` around line 358-388: identical change — `rowActions` is `[CheckboxNode]` only; the returned row object gets `action: { name: \`select-ticket-${t.id}\` }`.

    3. Edit `demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs` test `Get_SeededTicket_AppearsAsTableRow` (around line 123-165): replace the `var openBtn = row.Actions!.OfType<ButtonNode>().Single();` block with `Assert.Empty(row.Actions!.OfType<ButtonNode>());` and `Assert.NotNull(row.Action); Assert.Equal($"select-ticket-{id}", row.Action!.Name);`. Keep the existing CheckboxNode assertion.

    4. Run parity: `cd /home/ubuntu/ViewModelShell && bun run parity/run.ts`. The harness diffs normalized responses between AspNetCore and -bun backends step-by-step. If a step fails because the two backends serialized rows differently, fix the discrepancy in BOTH backends rather than tweaking the fixture (the fixture is data, not implementation). Only edit the fixture if a step genuinely depends on the old `actions[]` shape — and in this case verify both backends match the new shape afterward.

    5. Run the .NET tests: `cd /home/ubuntu/ViewModelShell/demo/HelpDesk/AspNetCore.Tests && dotnet test --filter "FullyQualifiedName~AgentControllerTests"`. Baseline was 26/26 after the previous quick task. Must remain 26/26 (or more, if new assertions add test cases — but the task description here adds assertions to existing tests, not new tests).

    Atomic commit to current branch (no push):
    `git add demo/HelpDesk/AspNetCore/AgentController.cs demo/HelpDesk-bun/server.ts demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs parity/fixtures/helpdesk.json && git commit -m "feat(helpdesk): use row.action for click-anywhere navigation; drop Open button"`
  </action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/demo/HelpDesk/AspNetCore.Tests && dotnet test --filter "FullyQualifiedName~AgentControllerTests" --nologo && cd /home/ubuntu/ViewModelShell && bun run parity/run.ts</automated>
  </verify>
  <done>Both HelpDesk backends use row.action; rowActions contains only the CheckboxNode. .NET tests pass (26/26 or higher). Parity harness passes step-for-step. Atomic commit landed.</done>
</task>

<task type="auto">
  <name>Task 5: Bump versions to 1.1.0, write CHANGELOG entry + MIGRATION note + AGENTS.md doc update, run full CI sweep</name>
  <files>viewmodel-shell/package.json, viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj, CHANGELOG.md, MIGRATION.md, AGENTS.md</files>
  <behavior>
    - npm version bumps 1.0.1 → 1.1.0 (minor; additive).
    - NuGet version bumps 1.0.0 → 1.1.0 (lockstep).
    - CHANGELOG.md gets a new top-of-file entry for 1.1.0 with BOTH fixes:
      - **Restored** TableRow.action — the click-anywhere row dispatch primitive (removed in 0.17.0 / Phase 6). Now ships with full keyboard support (Enter + Space, Space preventDefaults) and ARIA (role=button, tabindex=0, aria-label derived from cells).
      - **Fixed** TableRow.actions[] silently dropping non-ButtonNode entries. Type is now `(ButtonNode | CheckboxNode)[]` on the TS side (closed union); .NET stays `IReadOnlyList<ViewNode>` for polymorphic discriminator emission. The renderer dispatches by entry.type.
      - HelpDesk demo migrated to the canonical pattern: row.action for navigation, row.actions[] for the per-row selection checkbox.
    - MIGRATION.md gets a brief 1.1.0 note: additive — no consumer migration required. Apps working around the broken actions[] rendering can now drop the workaround and use the canonical pattern.
    - AGENTS.md "canonical workflow pattern" section (the **"Tables in VMS"** subsection) gets a note that row.action is the click-anywhere primitive and that row.actions[] now accepts mixed ButtonNode + CheckboxNode types (renderer dispatches by entry.type). Keep the existing table workflow guidance intact — append, don't rewrite.
    - Full verification sweep runs and passes: vitest, .NET HelpDesk tests, parity, core-globals + AA-contrast guards. If ANY suite fails, fix the cause before declaring done.
  </behavior>
  <action>
    1. Bump npm version in `viewmodel-shell/package.json`: change `"version": "1.0.1"` to `"version": "1.1.0"`.

    2. Bump NuGet version in `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`: change `<Version>1.0.0</Version>` to `<Version>1.1.0</Version>`.

    3. Read current `CHANGELOG.md` to match the existing entry format (look at the most recent entries for the structure — heading level, date format, bullet style). Prepend a new `## 1.1.0 (2026-06-13)` entry with two sections — `### Fixed` (the actions[] mixed-types bug) and `### Restored / Improved` (TableRow.action + a11y). Use language that frames the actions[] one as a bug fix (was silently dropping non-button entries) and the row.action one as a restoration + a11y improvement. Mention the HelpDesk demo migration as the canonical reference. Append, do not rewrite existing entries.

    4. Read current `MIGRATION.md` to match style. Add a brief 1.1.0 section: "additive change; no consumer steps required. Apps that worked around the broken actions[] rendering by avoiding non-ButtonNode entries can now drop that workaround — the renderer dispatches by entry.type."

    5. Edit `AGENTS.md`: locate the "Tables in VMS — the canonical workflow pattern" subsection. In a natural spot near the existing row.actions discussion, add a short paragraph (3-5 sentences) covering:
       - row.action is the click-anywhere primitive — re-added in 1.1.0 — with full keyboard (Enter + Space) and ARIA support emitted automatically.
       - row.actions[] now accepts both ButtonNode and CheckboxNode (renderer dispatches by entry.type); per-row clicks on those interactive descendants don't bubble to row.action.
       - HelpDesk demo is the canonical reference for using both together (row.action for navigation, row.actions[] for bulk-selection checkbox).
       Keep the surrounding "Mode A / B / C" guidance intact.

    6. Run the FULL verification sweep:
       - `cd /home/ubuntu/ViewModelShell/viewmodel-shell && npx vitest run`
       - `cd /home/ubuntu/ViewModelShell/demo/HelpDesk/AspNetCore.Tests && dotnet test --filter "FullyQualifiedName~AgentControllerTests" --nologo`
       - `cd /home/ubuntu/ViewModelShell && bun run parity/run.ts`
       - `cd /home/ubuntu/ViewModelShell/viewmodel-shell && npm run check:core-globals && npm run check:aa-contrast`

       Read the actual output of each command. If ANY suite shows failures, fix the cause (not the test) before proceeding. "Tests compiled" is not "tests passed" — verify the pass count.

    7. Atomic commit to current branch (no push, per AGENTS.md working agreement):
       `git add viewmodel-shell/package.json viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj CHANGELOG.md MIGRATION.md AGENTS.md && git commit -m "chore(release): viewmodel-shell 1.1.0 — restore TableRow.action + fix actions[] mixed types"`
  </action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell && npx vitest run && cd /home/ubuntu/ViewModelShell/demo/HelpDesk/AspNetCore.Tests && dotnet test --filter "FullyQualifiedName~AgentControllerTests" --nologo && cd /home/ubuntu/ViewModelShell && bun run parity/run.ts && cd /home/ubuntu/ViewModelShell/viewmodel-shell && npm run check:core-globals && npm run check:aa-contrast</automated>
  </verify>
  <done>npm + NuGet both at 1.1.0. CHANGELOG + MIGRATION + AGENTS.md updated. ALL FOUR CI suites pass with the executor having read the actual pass counts. Atomic commit landed on current branch. Do NOT push (per AGENTS.md working agreement — operator-driven git).</done>
</task>

</tasks>

<verification>
The executor MUST run all four suites at the end of task 5 and READ the actual output (not just "compiled"):

1. `cd /home/ubuntu/ViewModelShell/viewmodel-shell && npx vitest run` — baseline was 240/240 + 1 skipped; new total must be 240 + new tests, all passing.
2. `cd /home/ubuntu/ViewModelShell/demo/HelpDesk/AspNetCore.Tests && dotnet test --filter "FullyQualifiedName~AgentControllerTests" --nologo` — baseline 26/26 passing.
3. `cd /home/ubuntu/ViewModelShell && bun run parity/run.ts` — must pass step-for-step.
4. `cd /home/ubuntu/ViewModelShell/viewmodel-shell && npm run check:core-globals && npm run check:aa-contrast` — both guards must pass.

If ANY suite fails, the executor fixes the cause and re-runs — never commits and exits with a known failure. "Tests compiled" is not "tests passed."
</verification>

<success_criteria>
- TableRow.action exists on both TS and .NET; field carries an action name only (no context).
- Clicking a clickable row dispatches; Enter dispatches; Space dispatches + preventDefaults; Tab does not dispatch.
- Clickable rows expose role=button, tabindex=0, non-empty aria-label.
- Clicking a per-row button, checkbox, or cell anchor does NOT also fire row.action.
- A CheckboxNode in row.actions[] renders as a real `<input type="checkbox">` (not an empty button).
- HelpDesk Agent queue (both backends) fires `select-ticket-{id}` on row click and shows a real selection checkbox in the actions cell (no Open button).
- All four CI suites pass.
- npm and NuGet both ship 1.1.0. CHANGELOG + MIGRATION + AGENTS.md reflect the change.
- Five atomic commits land on the current branch (main). No push.
</success_criteria>

<output>
Create `.planning/quick/260613-qmh-restore-tablerow-action-row-click-fix-mi/260613-qmh-SUMMARY.md` summarizing what shipped, version delta, and any deviation from the plan.
</output>
