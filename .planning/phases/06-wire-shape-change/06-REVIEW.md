---
phase: 06-wire-shape-change
reviewed: 2026-06-07T19:53:00Z
depth: standard
files_reviewed: 62
files_reviewed_list:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/server.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/src/tui.tsx
  - viewmodel-shell/src/adapter.test.ts
  - viewmodel-shell/src/tree-walker.test.ts
  - viewmodel-shell-dotnet/ViewModels.cs
  - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
  - viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs
  - viewmodel-shell-dotnet/Tests/Tests.csproj
  - viewmodel-shell-dotnet/Tests/GlobalUsings.cs
  - viewmodel-shell/test/browser-scroll.test.ts
  - viewmodel-shell/test/conformance-fixtures.ts
  - viewmodel-shell/test/multi-action-form.test.ts
  - viewmodel-shell/test/table-selection-pagination.test.ts
  - viewmodel-shell/test/tui-lifecycle.test.ts
  - viewmodel-shell/tsconfig.json
  - viewmodel-shell/vitest.config.ts
  - demo/Tasks-bun/server.ts
  - demo/ContactManager-bun/server.ts
  - demo/ExpenseTracker-bun/server.ts
  - demo/RetroBoard-bun/server.ts
  - demo/HelpDesk-bun/server.ts
  - demo/Reorder-bun/server.ts
  - demo/FeatureProbe-bun/handler.ts
  - demo/Tasks/AspNetCore/TasksController.cs
  - demo/Tasks/AspNetCore/TasksState.cs
  - demo/Tasks/AspNetCore.Tests/TasksControllerTests.cs
  - demo/ContactManager/AspNetCore/ContactsController.cs
  - demo/ContactManager/AspNetCore/ContactsState.cs
  - demo/ContactManager/AspNetCore.Tests/ContactsControllerTests.cs
  - demo/ExpenseTracker/AspNetCore/ExpensesController.cs
  - demo/ExpenseTracker/AspNetCore/ExpensesState.cs
  - demo/ExpenseTracker/AspNetCore.Tests/ExpensesControllerTests.cs
  - demo/RetroBoard/AspNetCore/RetroBoardController.cs
  - demo/RetroBoard/AspNetCore/RetroState.cs
  - demo/RetroBoard/AspNetCore.Tests/RetroBoardControllerTests.cs
  - demo/HelpDesk/AspNetCore/AgentController.cs
  - demo/HelpDesk/AspNetCore/AgentState.cs
  - demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs
  - demo/HelpDesk/AspNetCore/RequesterController.cs
  - demo/HelpDesk/AspNetCore/RequesterState.cs
  - demo/HelpDesk/AspNetCore.Tests/RequesterControllerTests.cs
  - demo/Reorder/AspNetCore/ReorderController.cs
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - demo/Tasks/frontend/index.html
  - demo/ContactManager/frontend/index.html
  - demo/ExpenseTracker/frontend/index.html
  - demo/RetroBoard/frontend/index.html
  - demo/HelpDesk/frontend/agent.html
  - demo/HelpDesk/frontend/requester.html
  - demo/Tasks-fullstack-bun/index.html
  - demo/Showcase/frontend/src/main.ts
  - parity/run.ts
  - parity/README.md
  - parity/fixtures/tasks.json
  - parity/fixtures/contacts.json
  - parity/fixtures/expenses.json
  - parity/fixtures/feature-probe.json
  - parity/fixtures/helpdesk.json
  - parity/fixtures/reorder.json
  - parity/fixtures/retro.json
findings:
  critical: 1
  warning: 8
  info: 6
  total: 15
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-06-07T19:53:00Z
**Depth:** standard
**Files Reviewed:** 62
**Status:** issues_found

## Summary

Phase 6 lands a hard wire-format break — `context` payload eliminated, `bind`
paths declared on every input, `TableSelection` removed, action-name uniqueness
enforced server-side at tree-build time, and `viewmodel-shell/src/browser.ts`
rewritten as a thin interpreter. All 14 demo backends migrated; cross-backend
parity green across 15 backends and 7 fixtures.

The headline mechanics hold up. The validator catches the canonical
missing-row-id bug class on both backends; the renderer's bind-driven read/write
seam works as documented; demo controllers consistently call `.Validate()` on
returned `ShellResponse`s; the wire envelope strictly carries `{name, state, files?}`.

That said, the review surfaces one **CRITICAL** prototype-pollution gap in the
bind-path walker (the server controls `bind` strings today, but the walker is the
runtime that takes user-input *paths* into mutation primitives — needs defense),
and a cluster of **WARNINGs** centered on:

- The walker's "infer container shape from next segment" heuristic mis-creates
  arrays when binding into a map keyed by numeric IDs (e.g. `selectedIds.42`)
  while the parent slot is uninitialized — survives in demos only because all
  state slots are pre-initialized.
- `tui-lifecycle.test.ts` still asserts the OLD `FieldNode.value` / `ActionEvent.context`
  shape — tests pass only because excess properties survive JS runtime + the
  test file isn't in the tsc graph. They provide false confidence about new-shape behavior.
- Validator gap: `CheckboxNode` actions inside `TableRow.actions[]` are skipped
  by both TS and .NET validators (filter-to-`ButtonNode` for parity). A duplicate
  action name landed via a checkbox would not be caught.
- TS bun backends bypass `validateActionNames` on initial-load GET; .NET runs it.
  Asymmetric initial-load coverage.
- Multiple stale doc comments still describe pre-Phase-6 "harvest into action.context"
  behavior on FormNode.Buttons (both TS and .NET).
- Defensive `-1` index fallbacks in demo controllers produce malformed
  `bind: "items.-1.completed"` paths that the walker silently writes to `items["-1"]`
  on arrays.

None of the findings block parity (which the harness confirms is byte-identical
green); they're correctness-and-future-proofing gaps that should land before
the 1.0 cutover in Phase 7.

## Critical Issues

### CR-01: Bind-path `writePath` allows `__proto__` / `constructor` segments → prototype pollution surface

**File:** `viewmodel-shell/src/index.ts:736-777`
**Issue:** `writePath` walks dotted segments and writes via `o[seg] = nxt` /
`(cur as Record<string, unknown>)[last] = value` without filtering against
JavaScript's special keys (`__proto__`, `constructor`, `prototype`). A path of
`__proto__.polluted` will set `Object.prototype.polluted = value`. Today the
`bind` string is server-controlled (the SECOND argument to `stateAccess.write`
is the server-emitted `node.bind`), so the *immediate* attacker isn't user
input — but:

1. **The server-trust assumption is fragile.** Any future feature that lets
   user input influence a bind path (e.g. a server that templates a bind from
   request params, or a TS server that takes a path from a query string) opens
   the hole. The validator at the framework boundary should be defense in depth,
   not "trust the server forever."
2. **The walker is *also* invoked by demo / Showcase code** that builds bind
   strings dynamically (e.g. `bind: \`actionItems.${idx}.resolved\``). A negative
   idx would land at a property like `actionItems.-1.resolved` — still safe
   from prototype pollution, but the surface is wider than just framework-emitted
   bind strings.
3. **The TS shell exposes `stateWrite(path, value)` as a public method**
   (`ViewModelShell.stateWrite`, line 585). Any consumer that calls it with a
   user-derived path is the next prototype-pollution CVE.

**Fix:** Reject special keys in `writePath` and `readPath`. A 3-line guard
prevents the entire class:

```typescript
function isUnsafeSegment(seg: string): boolean {
  return seg === "__proto__" || seg === "constructor" || seg === "prototype";
}

function writePath(obj: unknown, path: string, value: unknown): unknown {
  if (path == null) return obj;
  if (path === "") return value;
  const segs = path.split(".");
  for (const seg of segs) {
    if (isUnsafeSegment(seg)) return obj; // silently drop; alternative: throw
  }
  // ... rest unchanged
}
```

Apply the same guard in `readPath`. Apply the equivalent fix in
`parity/run.ts:92` (the parity runner has its own walker mirror) and in
`demo/Showcase/frontend/src/main.ts:98` (the Showcase inlines its own walker).

This is BLOCKER-class because (a) it's a well-known JavaScript footgun whose
fix is a 3-line addition, (b) the wire contract explicitly invites consumers
to build path strings dynamically (`rows.${i}.selected`), and (c) we're about
to publish v1.0.0 as a wire-protocol contract — landing this defense AFTER
1.0 is a much harder conversation than landing it now.

## Warnings

### WR-01: `writePath`'s container-shape heuristic mis-creates arrays for maps keyed by numeric IDs

**File:** `viewmodel-shell/src/index.ts:750-768`
**Issue:** When `writePath` needs to create an intermediate container, it
chooses array vs. object from the NEXT segment's shape (`isArrayIndexSegment(nextSeg) ? [] : {}`).
This is correct for true array-index paths like `items.0.completed`, but
**wrong** for map paths whose keys happen to be numeric — e.g. `selectedIds.42`
when `state.selectedIds` has not yet been initialized.

Concretely, if `state.selectedIds === undefined` and a user clicks the row-42
checkbox bound to `selectedIds.42`:
1. `writePath(state, "selectedIds.42", true)` enters the loop
2. At `seg="selectedIds"`, `nextSeg="42"` → `nextShape="array"`
3. `state.selectedIds = []` (an Array, not a Dictionary)
4. Sets `state.selectedIds[42] = true` → a sparse array of length 43

When this round-trips to .NET, deserializing `Dictionary<string, bool>` from a
JSON array throws. The HelpDesk Agent demo dodges this because `AgentState.Initial`
explicitly seeds `SelectedIds = new Dictionary<string, bool>()` (line 24 of
`AgentState.cs`), so the slot is never null on the wire — but the framework's
runtime invariant is silently "every map-with-numeric-keys must be pre-initialized
in initial state or you lose wire parity." That invariant is not documented
anywhere.

**Fix:** Provide a way for the bind to declare its container shape, or default
container creation to `{}` (the safer of the two for round-tripping). Long-form:

```typescript
// Option A: default to object; let strict-array bind paths declare ["items[0]"]
// or similar syntax.
// Option B: when the parent slot exists, USE its shape; only fall back to the
// heuristic when bootstrapping the root.
// Option C: document the invariant loudly: every map-with-numeric-keys must
// be initialized to {} in the initial state.
```

The same mirror lives in `parity/run.ts:92-130` and `demo/Showcase/frontend/src/main.ts:98-115`
— fix all three or they drift.

### WR-02: `tui-lifecycle.test.ts` still asserts the OLD `FieldNode.value` / `ActionEvent.context` wire shape

**File:** `viewmodel-shell/test/tui-lifecycle.test.ts:326,367,394-399,408,423,755,764,797`
**Issue:** Multiple test cases construct ViewNode fixtures with `value: "..."`
on `FieldNode` (a property that no longer exists in the Phase-6 type) and
assert that dispatched actions have a `.context` field (also removed from
`ActionEvent`). They pass for two reasons:

1. The test file is not in `viewmodel-shell/tsconfig.json`'s include set
   (`"include": ["src/**/*.ts"]` — `test/**/*.ts` is unchecked), so TypeScript
   never enforces the type contract on the fixtures.
2. JavaScript preserves excess object properties at runtime, so the OLD-shape
   fields survive through the test's mock dispatch path.

Specifically:
- Lines 367, 394-399, 423, 797: `{ type: "field", ..., value: "..." }` — the
  `value` property is dead data; the new TUI's `FieldView` (`src/tui.tsx:1663`)
  reads `wireValue = ""` and ignores `n.value`.
- Lines 326, 408, 764: the test's own mock `submit` function constructs
  `{ name, context: merged }` and asserts the dispatched action equals it.
  This re-implements the OLD harvest behavior IN THE TEST — the framework
  under test no longer does this.
- Line 755: `action: { name: "save", context: { id: 42 } }` — the `context`
  property is preserved by JS and the test asserts it round-trips, but the
  Phase-6 wire contract is name-only.

**Why this matters:** These tests don't catch the wire-shape change at all.
A regression that re-introduced context harvest into the TUI would still pass
these assertions; a future bug that broke name-only dispatch would not turn
them red.

**Fix:** Rewrite the affected tests to:
- Remove `value:` from FieldNode fixtures; pass values through `stateAccess.read`
  when the TUI gains the third render arg (Phase 7).
- Drop `context:` from action fixtures and from the test's mock submit. Assert
  dispatched actions are `{ name }` only.
- Update the "form submit: collects current field values..." test to assert
  the state-write path, not the context-harvest path.

The test file is the deferred-items.md neighbor of the demo `frontend/src/adapter.test.ts`
files — those are tracked. This is the framework's own test file and should
not be deferred to Phase 7's cleanup.

### WR-03: Validator skips `CheckboxNode` actions inside `TableRow.actions[]` — gap in duplicate detection

**File:** `viewmodel-shell/src/server.ts:182-197` and `viewmodel-shell-dotnet/ViewModels.cs:463-472`
**Issue:** Both validators filter `row.actions` to `ButtonNode` before
recording — the TS side via `if (node.type === "button")`, the .NET side via
`.OfType<ButtonNode>()`. This was the correct fix for 06-05's auto-fix (TS was
crashing on `row.actions` entries with no `.action` field), but it goes further
than needed: a `CheckboxNode` with an actual `.action` property in `row.actions`
also gets skipped.

So this tree would NOT be caught:

```typescript
{
  type: "table",
  columns: [{ key: "name", label: "Name" }],
  rows: [{
    cells: { name: "Alpha" },
    actions: [
      { type: "checkbox", name: "x", bind: "x", action: { name: "toggle" } },
    ],
  }],
}
// Plus a top-level button:
{ type: "button", label: "Toggle", action: { name: "toggle" } }
```

The HelpDesk Agent demo uses bind-only checkboxes (line 170 of `AgentController.cs`:
`new CheckboxNode($"select-{t.Id}", $"selectedIds.{t.Id}", null, null)` — action
is null), so this gap doesn't manifest today. But the gap exists.

**Fix:** Change the filter from "is this a ButtonNode?" to "does this node
have an `.action`?":

```typescript
// TS:
for (const node of row.actions) {
  if (node.type === "button") {
    recordAction((node as ButtonNode).action, enclosingForm, out);
  } else if (node.type === "checkbox" && (node as CheckboxNode).action) {
    recordAction((node as CheckboxNode).action!, enclosingForm, out);
  }
}
```

```csharp
// .NET (in ViewModels.cs:467-471):
foreach (var node in rowActions) {
    if (node is ButtonNode btn) Record(btn.Action, enclosingForm, sink);
    else if (node is CheckboxNode cb && cb.Action is { } a) Record(a, enclosingForm, sink);
}
```

### WR-04: TS bun backends bypass `validateActionNames` on initial-load GET; .NET runs it via `.Validate()`

**File:** `demo/Tasks-bun/server.ts:232`, `demo/ContactManager-bun/server.ts:314`, `demo/ExpenseTracker-bun/server.ts:305`, `demo/RetroBoard-bun/server.ts:239`, `demo/HelpDesk-bun/server.ts:865,872`, `demo/Reorder-bun/server.ts:157`, `demo/FeatureProbe-bun/handler.ts:280`
**Issue:** Every TS bun backend's GET handler returns
`Response.json({ vm: buildVm(state), state })` directly, never running the
view tree through `validateActionNames`. Only POST actions go through
`createAction`, which auto-validates. The .NET side calls `.Validate()` on
GET responses too (e.g. `TasksController.cs:15`, `ContactsController.cs:15`).

**Why this matters:** A future controller could land a duplicate-action-name
bug in its initial view tree that the TS side serves silently but the .NET
side throws on. The cross-backend parity suite *would* catch this (because
the bytes differ — one's a normal response, the other's a 500) but only when
the fixture exercises that initial-load path. A controller with bug-on-GET
but the fixture only exercises POST would slip through both gates.

**Fix:** Either:
- (a) Wrap each TS bun backend's GET response with `validateActionNames(vm)`
  before returning, mirroring the .NET pattern, or
- (b) Provide a `validatedJson(vm, state, ...)` helper in `viewmodel-shell/server`
  that runs the walker before serializing.

```typescript
// Tasks-bun:
if (url.pathname === "/api/tasks" && request.method === "GET") {
  const state = initialState();
  const vm = buildVm(state);
  validateActionNames(vm);  // <-- add this
  return Response.json({ vm, state });
}
```

### WR-05: Stale doc comments still describe pre-Phase-6 "harvest into action.context" behavior

**File:** `viewmodel-shell/src/index.ts:163`, `viewmodel-shell-dotnet/ViewModels.cs:194`
**Issue:** Both `FormNode.buttons` (TS) and `FormNode.Buttons` (.NET) carry
doc comments stating:

> Each is a full ButtonNode (so variant + pendingLabel apply) that, on
> activation, HARVESTS this form's current field values into its `action.context`
> and dispatches

But Phase 6 eliminated harvest. The renderer (`browser.ts:278-286`) reads only
file inputs from the form on submit and dispatches `{ name }` only — field
values reach the server through state at the bind paths, not through `action.context`.

**Why this matters:** A future contributor reading the type declaration will
implement against the documented behavior, not the actual behavior. The wire
contract is exactly what these comments describe at the type's definition site
— that's the AGENTS.md mandate ("Behavior that isn't obvious from a node's
type alone is documented at the type's definition in source").

**Fix:** Rewrite both comments to describe the post-Phase-6 behavior:

```typescript
// TS (src/index.ts:161-167):
/** Multi-action submit buttons (#15). Each is a full ButtonNode (so
 *  `variant` + `pendingLabel` apply) that, on activation, dispatches its
 *  declared action by name. Field values live in state at each input's
 *  `bind` path and travel with the dispatch's `_state` payload. Mirrors
 *  HTML's multiple submit buttons / `formaction` — different action per
 *  button, same underlying state. A plain ButtonNode placed in `children`
 *  has identical dispatch semantics; the buttons[] slot is a layout hint. */
```

Apply the same correction to the .NET twin comment.

### WR-06: Demo controllers silently produce `bind: "items.-1.completed"` when the index lookup fails

**File:** `demo/Tasks/AspNetCore/TasksController.cs:109-119`, `demo/Tasks-bun/server.ts:113-122`, `demo/RetroBoard/AspNetCore/RetroBoardController.cs:157-167`, `demo/RetroBoard-bun/server.ts:139`
**Issue:** Multiple controllers compute a state-array index for the bind path
and use a default of `-1` when the lookup fails:

```csharp
// TasksController.cs:
var i = -1;
for (var k = 0; k < sourceItems.Count; k++) {
    if (sourceItems[k].Id == t.Id) { i = k; break; }
}
return (ViewNode)new ListItemNode(...) {
    // bind path: `items.{i}.completed` where i could be -1
};
```

When `i == -1`, the emitted bind string is `"items.-1.completed"`. The walker
at `index.ts:723-725` rejects this on read (returns undefined), but on write
the code at `index.ts:771-775` does `cur[Number(last)] = value`, which sets
`array[-1] = value` — a non-index property on the array. The state then has
`items[-1] = true` (as a property), which serializes as JSON with the key
`"-1"`. On round-trip to .NET, deserialization of `IReadOnlyList<TaskRecord>`
ignores non-numeric keys → silent data loss.

The lookup never fails today because `t` always comes from `sourceItems` via
filtering, so the loop always finds a match. But the defensive `-1` default
papers over what would otherwise be an exception, and lets a future bug
(e.g. filtering changed but `sourceItems` not updated) corrupt state silently.

**Fix:** Throw when the lookup fails — the canonical-style fix:

```csharp
var i = -1;
for (var k = 0; k < sourceItems.Count; k++) {
    if (sourceItems[k].Id == t.Id) { i = k; break; }
}
if (i < 0) throw new InvalidOperationException(
    $"Task id '{t.Id}' is in the filtered list but not in sourceItems. " +
    "Bind paths require a valid array index.");
```

Same fix applies to `RetroBoardController.cs:157`. The TS twins
(`Tasks-bun/server.ts:113`, `RetroBoard-bun/server.ts:139`) should match.

### WR-07: Reorder bun handler diverges from .NET — `splice(-1, ...)` vs. .NET `Insert(-1, ...)` throw

**File:** `demo/Reorder-bun/server.ts:124-125`
**Issue:** The bun handler does:

```typescript
const idx = rest.findIndex(i => i.id === beforeId);
rest.splice(idx, 0, moving);
```

When `beforeId` is malformed (not found in `rest`), `findIndex` returns `-1`,
and `Array.prototype.splice(-1, 0, item)` inserts before the LAST element of
`rest` — silently misplaces the item.

The .NET twin (`ReorderController.cs:70-71`) is strictly correct:

```csharp
var idx = rest.FindIndex(i => i.Id == beforeId);
rest.Insert(idx, moving);
```

`List<T>.Insert(-1, item)` throws `ArgumentOutOfRangeException` → 500 to the
client. Cross-backend behavior diverges silently on malformed input: bun
returns a 200 with a wrong-positioned item; .NET returns a 500.

Today the parity fixtures only exercise valid `beforeId` values, so this
doesn't fail parity. But a malicious or buggy client gets different behavior
across backends.

**Fix:** Add an explicit check in the bun handler:

```typescript
const idx = rest.findIndex(i => i.id === beforeId);
if (idx < 0) {
  // Match .NET: malformed input → error, not silent misplace.
  throw new Error(`beforeId '${beforeId}' not found in items`);
}
rest.splice(idx, 0, moving);
```

### WR-08: Bun backends throw `Error` from action handlers → 500 where .NET returns 400 (`BadRequest`)

**File:** `demo/Tasks-bun/server.ts:193,213`, `demo/ContactManager-bun/server.ts:238,254,274,300`, `demo/ExpenseTracker-bun/server.ts:264,291`, `demo/RetroBoard-bun/server.ts:203,205,225`, `demo/HelpDesk-bun/server.ts:599,849`, `demo/Reorder-bun/server.ts:143`
**Issue:** Every TS bun backend throws `Error` from inside the `createAction`
handler for validation failures and unknown actions:

```typescript
// Tasks-bun:
if (!title) {
  throw new Error("title required");
}
// ...
throw new Error(`Unknown action: ${name}`);
```

`createAction` (`viewmodel-shell/src/server.ts:341`) calls `handler(payload)`
but the call is NOT inside the try/catch (which only wraps parsing). A thrown
Error propagates up to Bun.serve, which returns a 500.

The .NET twin returns `BadRequest("title required")` — a 400 — for the same
condition. This is a parity gap: same fixture-valid request hits both backends
identically (no error), but a malformed request hits the .NET side with a
400 and the bun side with a 500.

**Fix:** Either:
- (a) Convert the throws to explicit 400 responses via a new ShellResponseBody
  shape (returning `{ error: "..." }` with `status: 400`), or
- (b) Wrap the handler call in `createAction` with a try/catch that returns
  a 400 for `BadRequestError` (a new symbol-tagged error class) and 500 for
  anything else.

Option (b) keeps consumer code lighter:

```typescript
// viewmodel-shell/src/server.ts
export class BadRequestError extends Error { /* marker */ }

// In createAction:
try {
  const result = await handler(payload);
  // ...
} catch (err) {
  if (err instanceof BadRequestError) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  throw err;
}
```

Then bun handlers throw `BadRequestError` instead of plain `Error`.

## Info

### IN-01: HelpDesk-bun starts `Bun.serve` unconditionally (no `import.meta.main` guard)

**File:** `demo/HelpDesk-bun/server.ts:859`
**Issue:** Unlike `Tasks-bun/server.ts:223` (which guards `Bun.serve` behind
`if (import.meta.main)`), `HelpDesk-bun/server.ts` calls `Bun.serve({ port, ... })`
at module top level. Importing this module from another file starts an HTTP
listener immediately — surprising if a future Tasks-fullstack-bun-style wrapper
tries to compose with HelpDesk-bun's handlers.

**Fix:** Add the same guard:

```typescript
if (import.meta.main) {
  Bun.serve({ port, fetch: ... });
  console.log(`HelpDesk Bun backend listening on http://localhost:${port}`);
}
```

Apply the same to `ContactManager-bun`, `ExpenseTracker-bun`, `RetroBoard-bun`,
`Reorder-bun`, and the FeatureProbe `server.ts` for consistency.

### IN-02: Parity runner's "all backends agree" log message stays silent after the first failure

**File:** `parity/run.ts:296-301`
**Issue:** Inside the outer fixture loop:

```typescript
if (exitCode === 0) {
  console.log(`  ✓ all backends agree`);
}
```

`exitCode` is set to 1 the moment any fixture step diverges. Subsequent
fixtures that DO agree never log "all backends agree" — they're silent.
The logged output lies about partial-success runs.

**Fix:** Track per-fixture pass/fail state separately:

```typescript
let fixtureAgreed = true;
for (const other of others) {
  // ...
  if (d) {
    fixtureAgreed = false;
    exitCode = 1;
  }
}
if (fixtureAgreed) {
  console.log(`  ✓ all backends agree`);
} else {
  console.log(`  ✗ this fixture diverged`);
}
```

### IN-03: Test files under `viewmodel-shell/test/` aren't in tsconfig include — TypeScript skips them silently

**File:** `viewmodel-shell/tsconfig.json:15`
**Issue:** `tsconfig.json` declares `"include": ["src/**/*.ts"]` and explicitly
excludes `src/**/*.test.ts`. The `test/` directory isn't in `include` at all,
so `tsc --noEmit` never sees those files. That's why `tui-lifecycle.test.ts`
compiles cleanly despite asserting against properties (`FieldNode.value`,
`ActionEvent.context`) that don't exist on the current types (see WR-02).

**Fix:** Either:
- (a) Add `test/**/*.test.ts` to `include` (and exclude from build with the
  same pattern), so tsc catches type drift in tests too, OR
- (b) Add a separate `tsconfig.tests.json` that vitest's `typecheck` mode
  can consume.

The current setup is invisible silent breakage waiting to happen.

### IN-04: Showcase's inline `writePath` is simpler than the framework's (no array-shape inference)

**File:** `demo/Showcase/frontend/src/main.ts:98-115`
**Issue:** The Showcase inlines its own `writePath`/`readPath` (because the
framework's are file-private). The Showcase version unconditionally creates
`{}` for intermediate containers, ignoring the framework's array-shape heuristic
based on the next segment. This is actually *safer* than the framework's
(it sidesteps WR-01), but it's a divergence — if a developer copy-pastes the
Showcase's walker into another app and uses an array-index bind like `items.0.title`,
the Showcase walker would create `{ "0": ... }` instead of `[..., ...]`.

**Fix:** Either:
- (a) Export `readPath` / `writePath` from `@ashley-shrok/viewmodel-shell`
  for use by no-backend consumers like the Showcase, OR
- (b) Document a recommended inline walker pattern in AGENTS.md so all "Showcase-style"
  apps use the same implementation.

Today the Showcase walker is a one-off, undocumented as a pattern.

### IN-05: Upload-progress, busy, and other framework tests still pass `context: {}` to `shell.dispatch`

**File:** `viewmodel-shell/test/upload-progress.test.ts:146,180,206,243,277,311,346,372`
**Issue:** Pre-existing test files (likely not in Phase 6's modified set, but
sharing the same root cause as WR-02) still pass `{ name: "noop", context: {} }`
to `shell.dispatch`. `ActionEvent` no longer has a `.context` field. These
calls only work because:
1. TypeScript doesn't type-check `test/` files (see IN-03)
2. The extra `context: {}` is preserved at runtime but never used by the new
   dispatch path

These tests aren't broken in the strict sense, but they show the wire-shape
migration didn't sweep every test file. Phase 7 cleanup target.

### IN-06: NuGet `<Version>` still 0.16.0 — wire protocol bumped to 1.0 but package version not

**File:** `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj:13`
**Issue:** The protocol meta tag was bumped to `viewmodel-shell/1.0` in Plan 06-05,
but the NuGet package version stays at `0.16.0`. Per AGENTS.md ("The two
packages share major.minor — bumping a `ViewNode` type or wire-format change
bumps both sides"), this should bump in lockstep with the wire shape break.

The 06-04 summary explicitly notes "the version bump to 1.0 is Phase 7, not
6" — so this is by design. Logging here so a future reviewer doesn't catch
it cold. The lockstep promise in AGENTS.md should be qualified: protocol
token bumps in the demo HTML can happen mid-milestone, but package version
bumps wait for the milestone closeout.

---

_Reviewed: 2026-06-07T19:53:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
