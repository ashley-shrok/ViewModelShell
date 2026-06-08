# Migration Guide

This document tells downstream app maintainers exactly what (if anything) to update,
what is explicitly **NOT breaking** and why, and the two non-obvious silent behaviors
to be aware of. It is copy-pasteable — every command and version string is concrete.

---

## Upgrading to '1.0.0' (npm @ashley-shrok/viewmodel-shell + NuGet AshleyShrok.ViewModelShell)

1.0.0 is the milestone where the wire becomes truly self-describing: an agent reading only `{vm, state}` from a GET response and walking the tree can drive any VMS app end-to-end identically to the browser renderer. Two breaking changes ship together: the `context` payload is GONE from the wire, and every response now carries a framework-set `ok` flag with a uniform `{ok: false, errors: [...]}` envelope for failures.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.16.0` | **`1.0.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.16.0` | **`1.0.0`** |

### What changed (consolidated across Phase 6 + Phase 7)

1. **Context payload eliminated.** The dispatch wire is now `{action: {name}, state, files?}`. Every input node declares a `bind` path naming where its value lives in state; the renderer reads/writes through the path. The seven distinct context-assembly code paths in the renderer collapsed into one bind-path interpreter. WIRE-01..WIRE-08.

2. **Action-name uniqueness rule.** Every dispatch-bearing node carries an action name only. Per-row identity is encoded IN the action name (`delete-row-42`, not `delete-row` with context). The framework enforces "one action name = one operation" at tree-build time; `ValidateActionNames` throws on violations. WIRE-04, WIRE-05.

3. **Framework-owned `ok` flag on every response.** Every framework-rendered response now carries `ok: true | false` at the top level. Normal renders, redirects, sideEffects-only responses, polls — all uniformly carry `ok: true`. Framework-detected failures (malformed payload, unknown action, uncaught exception) carry `ok: false` with a structured `errors[]` array. Agents check one field. ERROR-03.

4. **`{ok: false, errors: [{path?, message, code?}]}` envelope.** Replaces the old `{error: msg}` body shape on framework failures. `errors` is always an array; entries always have `message`; `path` and `code` are optional and ABSENT from the wire when not set (no `"path": null` etc.). Initial `code` vocabulary is small + stable + framework-only: `"parse_error"`, `"unknown_action"`, `"invalid_tree"`, `"uncaught_exception"`. App handlers never set `code`. ERROR-01, ERROR-02.

5. **`UnknownActionError` (TS) / `UnknownActionException` (.NET).** New public exception classes — your dispatch `default:` arm throws this with the unknown name; the framework catches and surfaces `code: "unknown_action"`. No framework-shipped router primitive; you keep your switch-or-startsWith convention.

6. **`VmsActionError` on the client side.** New exported class extending `Error` with `errors: ErrorEntry[]`, `status: number`, and a `code?` shortcut. Surfaced via the existing `onError` callback — non-VMS apps that wired `onError` for fetch failures keep working unchanged. Apps that want structured failure handling do `if (err instanceof VmsActionError) { ... err.errors ... }`.

7. **`BadRequestError` / `BadRequest("...")` semantic split.** Stays in the public API on both backends, but the wire shape changes: the framework now wraps it into `{ok: false, errors: [{message: ...}]}` (no `code`). Reserved for structurally-invalid requests the user can't see (missing required action field); NOT for routine app validation. State-based validation (TextNode error + ValidationError state field — gotcha #4) is unchanged — those responses are still `ok: true`.

### Migration recipe (single end-to-end pass for any consumer on 0.4.x or 0.16.x)

For each VMS app you maintain:

**Step 1 — Inputs.** Every input node now declares a `bind` path. Audit `FieldNode`, `CheckboxNode`, `TextareaNode`, `SelectNode`, `FileInputNode`, etc. — add `bind: "path.to.field"` matching where the value lives in your state record. Remove any code that harvests field values out of the DOM on submit.

**Step 2 — Action names.** Every per-row / per-operation action name must be unique. Replace `{name: "delete-row", context: {id: 42}}` patterns with `{name: "delete-row-42"}`. The convention is yours — slashes (`row/42/delete`), dashes (`delete-row-42`), or anything else you like; the framework only checks uniqueness. Run a build / GET against your dev server — `ValidateActionNames` will throw on the first violation with a precise diagnostic.

**Step 3 — Dispatch handlers.** Read your action handlers — anywhere they pull from `payload.context` becomes `payload.state` (the state record carries the values now). Switch on `payload.name`; if you need to extract a per-row id, parse the action name (`name.startsWith("delete-row-")` -> `parseInt(name.slice("delete-row-".length))`).

**Step 4 — `default:` arm.** Replace:
- `.NET`: `return BadRequest($"Unknown action: {name}")` → `throw new UnknownActionException(name)`.
- `TS`: `throw new BadRequestError(\`Unknown action: ${name}\`)` → `throw new UnknownActionError(name)`.

Add the new exception class to your import block (`using ViewModelShell;` already covers .NET; on TS, add `UnknownActionError` to your `@ashley-shrok/viewmodel-shell/server` import).

**Step 5 — .NET only: register the framework exception filter.** In each `Program.cs`, add `options.Filters.Add<ShellExceptionFilter>()` to your `AddControllers(...)` lambda. This wires the envelope-construction edge — without it, .NET apps won't emit envelope responses on thrown exceptions.

**Step 6 — Client `onError`.** Optional: if you want to branch on failure class, change your `onError` handler from `(err) => { console.error(err.message) }` to:
```typescript
onError: (err) => {
  if (err instanceof VmsActionError) {
    // err.errors[] has structured info; err.code === "unknown_action" / "parse_error" / etc.
  } else {
    // network/parse failure — plain Error
  }
}
```

**Step 7 — Side effects.** No changes needed: redirects, sideEffects, polling, busy, preventUnload, and the multipart file channel are unchanged.

### What you DON'T need to change

- State-based validation (TextNode + ValidationError state field — gotcha #4): unchanged, still `ok: true`.
- Frontend wiring: same `ViewModelShell(...)` constructor, same `BrowserAdapter`, same imports — only behavior change is `onError` now optionally receiving `VmsActionError`.
- CSS / themes / layout presets / density / card variants: unchanged.
- Polling, redirects, side effects, busy, preventUnload, file uploads: unchanged.

### Backwards-compat policy

None. No compatibility shims, no legacy-context reader, no deprecation warnings. The framework ships the corrected protocol; apps migrate; this doc is the upgrade path. This is by design per the milestone charter.

---

## Upgrading to `0.16.0` (busy lockout + generic per-round-trip lock — npm + NuGet)

**Nothing to do for compatibility.** Every existing response renders byte-identically. The new `busy` field is opt-in for the explicit long-action lockout, and the implicit per-round-trip lock applies to your app automatically (it makes the dispatch guard's behavior visually honest — rapid clicks during a round-trip no longer flip checkboxes / depress buttons before being dropped).

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.15.0` | **`0.16.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.15.0` | **`0.16.0`** |

### What changed automatically (no opt-in)

The shell now applies `.vms-busy` to the `BrowserAdapter` container for the duration of every user-initiated dispatch. Default CSS (`cursor: wait` + `pointer-events: none` on interactive descendants) makes the lock visually honest — clicks during the round-trip never reach inputs. **If your app has its own custom CSS that depends on interactive descendants being clickable during a brief moment after click**, you may notice a slight UX change. The behavior is correct; just be aware.

Polls (silent dispatches) don't trigger the class, so background polling doesn't flicker.

### Opting into the explicit lockout (long-running server actions)

Same pattern as `PreventUnload`. While server-side work is pending, return `Busy = true` from each render; clear when done:

```csharp
case "start-report":
    state = state with { ReportPending = true /* + kick off work */ };
    return new ShellResponse<MyState>(BuildVm(state), state) {
        PreventUnload = true,
        Busy = true,
        NextPollIn = 1000,
    };

case "poll":
    state = state with { ReportPending = !ReportDoneByNow() };
    return new ShellResponse<MyState>(BuildVm(state), state) {
        PreventUnload = state.ReportPending,
        Busy = state.ReportPending,
        NextPollIn = state.ReportPending ? 1000 : null,
    };
```

TypeScript mirrors with conditional spread (matches C#'s `WhenWritingDefault`):

```ts
return {
    vm: buildVm(state),
    state,
    ...(state.reportPending
        ? { preventUnload: true, busy: true, nextPollIn: 1000 }
        : {}),
};
```

The result: while the work is pending, the page is **continuously** locked (cursor wait + interactive elements non-clickable) — no per-poll flicker — until the next response that clears the flag.

### Worked example

`demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (+ bun twin) — the "Start long action" button pairs `Busy + PreventUnload + NextPollIn` for the whole 3-tick lifecycle. Parity-tested.

---

## Upgrading to `0.15.0` (remove `TableSelection.action` — npm + NuGet)

**Almost certainly nothing to do.** The 0.13.0 release deprecated this path in favor of `selection.buttons[]`, and the only worked example using it (HelpDesk-Agent) was already migrated in 0.13.0. If you happened to wire `selection.action` somewhere yourself, see the diff below.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.14.0` | **`0.15.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.14.0` | **`0.15.0`** |

### If you were using `selection.action`

The whole point of removing it: it had a UX foot-gun (rapid clicks silently dropped under the dispatch guard, in-flight re-render wiped DOM). Swap to `selection.buttons[]` — the bulk-action button(s) harvest the checked rows on click, exactly the pattern HelpDesk-Agent has used since 0.13.0:

```diff
- // Before (0.14.0 and earlier)
- // state: IReadOnlyList<string> SelectedIds
- new TableNode(
-     Columns: [...], Rows: rows,
-     Selection: new TableSelection(state.SelectedIds, new ActionDescriptor("toggle-select")));
- // + a per-toggle handler maintaining SelectedIds
- // + bulk handlers reading state.SelectedIds

+ // After (0.15.0)
+ // state: NO SelectedIds field
+ new TableNode(
+     Columns: [...], Rows: rows,
+     Selection: new TableSelection(
+         SelectedIds: [],
+         Buttons: [
+             new ButtonNode("Archive", new ActionDescriptor("bulk-archive"), "secondary"),
+         ]));
+
+ case "bulk-archive":
+     foreach (var id in StrList("selectedIds")) _store.Archive(id);
+     break;
```

TypeScript backend mirrors. See `demo/HelpDesk/AspNetCore/AgentController.cs` (+ bun twin) for the worked diff.

### Why this is OK as a pre-1.0 minor

`TableSelection.action` shipped in 0.12.0, was made optional in 0.13.0 alongside the recommended `selection.buttons[]` path, stayed optional through 0.14.0. By 0.15.0 we had direct visibility that no app in the framework's orbit was using it. Pre-1.0 semver tolerates this kind of pruning; the alternative was carrying a known-buggy code path with no users for an unknown amount of time.

### If we ever bring it back

It will come back through a redesigned wire shape with dispatch queueing + optimistic DOM preservation — not as the old `action` field. The current name is reserved for that future work.

---

## Upgrading to `0.14.0` (warn-before-leave guard via `preventUnload` — npm + NuGet)

**Nothing to do for compatibility.** Every existing response renders byte-identically — the new `preventUnload` field is opt-in.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.13.0` | **`0.14.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.13.0` | **`0.14.0`** |

### When to use it

Any long-running server action where an accidental tab-close (or refresh, or cross-origin nav) would lose in-flight work. The classic case: user clicks "Generate report"; the server kicks off something that takes 20s; while that's pending, the browser should warn before letting the user leave the page.

### Pattern

Server state tracks whether the work is pending; every render response includes `PreventUnload = isPending`. Mirrors how `NextPollIn` drives the poll cadence — set it on every response while you want the guard, omit/clear when done.

```csharp
case "start-report":
    state = state with { ReportPending = true /* + kick off work */ };
    return new ShellResponse<MyState>(BuildVm(state), state) {
        PreventUnload = true,
        NextPollIn = 1000,    // poll until done
    };

case "poll":   // auto-fired by the framework while NextPollIn is set
    state = state with { ReportPending = !ReportDoneByNow() };
    return new ShellResponse<MyState>(BuildVm(state), state) {
        PreventUnload = state.ReportPending,
        NextPollIn = state.ReportPending ? 1000 : null,    // omit to stop polling
    };
```

TypeScript backend mirrors:
```ts
return {
    vm: buildVm(state),
    state,
    ...(state.reportPending ? { preventUnload: true, nextPollIn: 1000 } : {}),
};
```

The conditional spread on the bun side matches C#'s `WhenWritingDefault` (which drops `false` from the wire). Both sides emit `preventUnload: true` while pending and omit the field when done.

### Honest constraint

**Modern browsers don't let you customize the dialog text** (privacy / UX reasons — they show their own "Leave site? Changes you made may not be saved"). The API only signals *whether* to warn; the dialog itself is browser-controlled. For your case this is fine — you want *a* warning, not a custom message.

### TUI

The TUI doesn't implement `setPreventUnload` (terminals have no unload concept). The shell fail-quiets — sending `preventUnload: true` from a TUI-rendered backend is a no-op, not an error.

### Worked example

`demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (and its bun twin at `demo/FeatureProbe-bun/handler.ts`) — the "Start long action" button kicks off a 3-tick lifecycle: the `start-long-action` handler sets `LongActionPolls = 3` + returns `PreventUnload = true`, each `long-action-poll` tick decrements, the final tick clears both. Parity-tested.

---

## Upgrading to `0.13.0` (`TableNode` local-mode selection + bulk-action toolbar — npm + NuGet)

**Nothing to do for compatibility.** Every existing table that sets `selection.action` renders byte-identically. **You will almost certainly want to switch**, though — see below.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.12.0` | **`0.13.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.12.0` | **`0.13.0`** |

### When to switch

If your app has a table with selection checkboxes + bulk-action buttons (delete-selected, archive-selected, …), the 0.12.0 server-truth pattern has a real UX bug: when a user clicks checkboxes in quick succession, the framework's dispatch guard silently drops the second click and the in-flight server response wipes the visually-flipped checkbox on re-render. The user sees "I clicked it, why's it unchecked?" — and there's no consistent way to fix it from app-side in 0.12.0.

Local mode in 0.13.0 fixes this by removing the round-trip per click. Toggles live in the DOM until a bulk-action button fires, which harvests the checked rows and dispatches once with `selectedIds` in context. **Recommended for every bulk-action workflow that doesn't need cross-page selection persistence.**

### How to switch (minimal diff)

Before (0.12.0 server-truth mode):
```csharp
// state: IReadOnlyList<string> SelectedIds
new TableNode(
    Columns: [...], Rows: rows,
    Selection: new TableSelection(state.SelectedIds, new ActionDescriptor("toggle-select")));
// + per-toggle action handler maintaining SelectedIds
// + conditional bulk toolbar above the table, reading state.SelectedIds
```

After (0.13.0 local mode):
```csharp
// state: NO SelectedIds field — selection lives in the DOM
new TableNode(
    Columns: [...], Rows: rows,
    Selection: new TableSelection(
        SelectedIds: [],         // server doesn't pre-select; user toggles in DOM
        Buttons: [               // adapter renders ABOVE the table; each click harvests
            new ButtonNode("Archive Selected", new ActionDescriptor("bulk-archive"), "secondary"),
            new ButtonNode("Delete Selected",  new ActionDescriptor("bulk-delete"),  "danger"),
        ]));

// Action handlers read selectedIds from CONTEXT, not state:
case "bulk-archive":
    foreach (var id in StrList("selectedIds")) _store.Archive(id);
    break;
```

Where `StrList` is a small helper (see `demo/HelpDesk/AspNetCore/AgentController.cs`):
```csharp
List<string> StrList(string key) =>
    payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.Array
        ? v.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).ToList()
        : new List<string>();
```

**TypeScript backend** mirrors the same shape — `selection: { selectedIds: [], buttons: [...] }` on the table node; the action handler reads `selectedIds` from `payload.context` as a string array.

### What you give up (be honest)

- **Live "N selected" indicator.** Server doesn't see selection until a bulk button fires. The visual is row-tint via `.vms-table__row--selected` (driven by the DOM in local mode).
- **Conditional bulk-toolbar render.** Buttons are always visible. Bulk handlers should be no-ops on empty selection (or return a "nothing selected" message).
- **Cross-page selection persistence.** Paginating or filtering rebuilds the table → DOM resets → selection gone. Most bulk-action workflows select within a page anyway; if yours genuinely needs sweep-select-across-pages, stay in `selection.action` mode (the 0.12.0 behavior).

### What you gain

- **No dropped clicks ever.** No dispatch per toggle → the dispatch guard can't drop anything.
- **Instant visual feedback.** DOM updates synchronously with no round-trip.
- **Per-row validity feedback on click is natural.** Your bulk handler iterates `selectedIds` and returns a view tree that can say "processed 5, row 7 was protected because…" — no framework knowledge of per-row validity needed.

### Worked example

`demo/HelpDesk/AspNetCore/AgentController.cs` (+ bun twin at `demo/HelpDesk-bun/server.ts`) is the migrated reference — the same demo, switched from 0.12.0 server-truth to 0.13.0 local mode. Diff is small.

---

## Upgrading to `0.12.0` (`TableNode` selection + pagination — npm + NuGet)

**Nothing to do** beyond taking the bump. `0.12.0` adds two optional fields to `TableNode` — `selection` and `pagination`. Every existing table renders byte-identically; you opt in per table.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.11.0` | **`0.12.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.11.0` | **`0.12.0`** |

**Bulk row selection** — add `selection` to a `TableNode`, keep the selected ids in your state record, and put the bulk-action buttons *outside* the table:

```csharp
// state: IReadOnlyList<string> SelectedIds
new TableNode(
    Columns: [...], Rows: rows,
    Selection: new TableSelection(state.SelectedIds, new ActionDescriptor("toggle-select")));
// action handler:
case "toggle-select":
    var set = new HashSet<string>(state.SelectedIds);
    if (Bool("all")) { /* add/remove the current page's row ids */ }
    else { var id = Str("id"); if (Bool("checked")) set.Add(id!); else set.Remove(id!); }
    state = state with { SelectedIds = /* materialize in a stable order */ };
    break;
case "bulk-archive":
    foreach (var id in state.SelectedIds) _store.Archive(id);
    state = state with { SelectedIds = [] };
    break;
```

The adapter merges `{ id, checked }` per row and `{ all: true, checked }` for the header select-all (where "all" = the rendered page). `TableRow.action` is untouched — rows stay click-to-open *and* selectable. Keep `selectedIds` in a **deterministic order** (e.g. sorted) if you have a TypeScript backend twin that must match a C# one under parity. The "select all N matching, not just this page" pattern is your own node composed above the table.

**Pagination** — add `pagination` and slice `rows` **server-side** (the adapter does not slice):

```csharp
new TableNode( Columns: [...], Rows: pageRows,   // already sliced to the page
    Pagination: new TablePagination(page, pageSize, totalRows, new ActionDescriptor("page")));
// action handler:
case "page": state = state with { Page = Int("page", state.Page) }; break;
// and reset Page = 1 inside your sort/filter handlers (the row window shifts).
```

The adapter renders "X–Y of N" + prev/next from these numbers and dispatches `{ page }`. For a DB-backed table this is just `LIMIT/OFFSET` + a `COUNT(*)` — see `demo/HelpDesk/AspNetCore/AgentController.cs` (and its bun twin) for the worked SQL example.

**TypeScript backend** is the mirror shape: `selection: { selectedIds, action }`, `pagination: { page, pageSize, totalRows, action }` on the table node. **TUI** renders `[x]`/`[ ]` checkboxes and a text prev/next footer with the same dispatch payloads.

---

## Upgrading to `0.11.0` (`ImageNode` + `TextNode` "warning" style + AA hardening — npm + NuGet)

**Nothing to do** beyond taking the bump. `0.11.0` adds the `ImageNode` type, adds `"warning"` to the `TextNode.style` union, and darkens the `--vms-warning` token (default + light themes) so warning text clears WCAG-AA. Purely additive.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.10.0` | **`0.11.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.10.0` | **`0.11.0`** |

- **New `ImageNode`:** render images with `{ type: "image", src, alt?, size?, shape? }` (TS) / `new ImageNode(src, Alt: …, Size: …, Shape: …)` (C#). `size` ∈ `small|medium|large|full`, `shape` ∈ `circle` — both are design-system classes, not free-form CSS. The browser renders `<img class="vms-image">`; the TUI degrades to `[image: <alt>]`. Always provide `alt` for accessibility and non-browser targets.
- **New inline warning text:** use `style: "warning"` on a `TextNode` (TS) / `new TextNode("…", "warning")` (C#) instead of wrapping a one-line caveat in a `ListItemNode{variant:"warning"}`. Emits `.vms-text--warning` in the browser, amber foreground in the TUI.
- **`TextNode.Style` was already a free `string?` in C#**, so code that passed `"warning"` *compiled* on ≤0.10.0 but rendered **unstyled** (the value wasn't in the renderer's recognized set). After 0.11.0 that same code renders correctly — a silent visual fix, not a breaking change. (The `"warning"` style adds no C# type; the NuGet package changes in 0.11.0 only because of the new `ImageNode` record.)
- **`--vms-warning` is now a touch darker** (`#8a630d`, was `#a37510` default / `#c89610` light themes). If you read that token for a custom warning border/badge, expect a slightly deeper amber. Dark themes are unchanged. No action required.
- **Custom themes:** if you ship your own theme stylesheet and use `--vms-warning` for *text*, verify it clears 4.5:1 on your surface/bg — the shipped `check:aa-contrast` now enforces this for the bundled themes, but your own files are yours to check.

---

## Upgrading to `0.10.0` (Multi-action forms — npm + NuGet)

**Nothing to do** beyond taking the bump. `0.10.0` adds `FormNode.buttons?: ButtonNode[]` and relaxes `submitAction` from required to optional. Both changes are forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.9.0` | **`0.10.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.9.0` | **`0.10.0`** |

- **Existing single-submit forms:** unchanged — keep using `submitAction` + `submitLabel`.
- **Multi-action forms:** add `buttons: [...]` (each a full `ButtonNode`). Each button harvests the form's current field values into its action context, then dispatches. Set `submitAction: null` (C#) / omit it (TS) for a buttons-only form with no default submit.
- **`variant` + `pendingLabel` on form buttons:** apply automatically, since `buttons[]` entries are real `ButtonNode`s.
- **A plain `ButtonNode` in `children`** still does NOT harvest — only `buttons[]` entries do.

Closes [#15](https://github.com/ashley-shrok/ViewModelShell/issues/15).

---

## Upgrading to `0.9.0` (`CopyButtonNode.variant` — npm + NuGet)

**Nothing to do** beyond taking the bump on whichever side you use. `0.9.0` adds one additive optional field on `CopyButtonNode` (`variant?: "primary" | "secondary" | "danger"`), mirroring `ButtonNode.variant`. Wire is forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.8.0` | **`0.9.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.8.0` | **`0.9.0`** |

- **Existing copy-buttons:** unchanged. Omit `variant` for the default look (byte-identical to `0.8.0`).
- **Copy-buttons near regular buttons:** set `Variant: "secondary"` (C#) / `variant: "secondary"` (TypeScript) to make the copy affordance read distinctly. `"primary"` and `"danger"` also available, same as `ButtonNode.variant`.
- **No CSS work:** the existing `.vms-button--primary` / `.vms-button--secondary` / `.vms-button--danger` rules already apply to whichever `<button>` the framework emits.

Closes [#14](https://github.com/ashley-shrok/ViewModelShell/issues/14).

---

## Upgrading to `0.8.0` (`ButtonNode.pendingLabel` — npm + NuGet)

**Nothing to do** beyond taking the bump on whichever side you use. `0.8.0` adds one additive optional field on `ButtonNode` (`pendingLabel?: string`) and changes dispatch-error behavior to re-render `currentVm` (previously it only fired `onError`). Both changes are forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.7.1` | **`0.8.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.7.0` | **`0.8.0`** |

- **Existing buttons:** unchanged. Omit `pendingLabel` for instant-click behavior (byte-identical to `0.7.x`).
- **Slow-action buttons:** set `PendingLabel: "Loading…"` (C#) / `pendingLabel: "Loading…"` (TypeScript) on the `ButtonNode`. The framework swaps the visible label + dims the button on click; reverts on response (success path replaces the button entirely; error path re-renders `currentVm`).
- **Adapters that mutate the DOM on click:** the error-path re-render now reverts client-side ephemeral state automatically. If you had a custom adapter implementing analogous pending logic via your own cleanup hook, you can drop that hook — the framework re-render handles it.
- **TUI consumers:** the `TuiAdapter` mirrors the BrowserAdapter behavior (label swap + `dimColor` while pending). Same wire field; no separate opt-in.

Closes [#11](https://github.com/ashley-shrok/ViewModelShell/issues/11).

---

## Upgrading to npm `0.7.1` (Browser scroll preservation — npm only)

**Nothing to do** beyond taking the patch. `0.7.1` fixes [#7](https://github.com/ashley-shrok/ViewModelShell/issues/7): the window scroll position is now preserved across action-driven re-renders, and `el.focus()` no longer yanks the viewport to the focused element. NuGet unchanged at `0.7.0`; major.minor stays `0.7`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.7.0` | **`0.7.1`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.7.0` | `0.7.0` (unchanged) |

- **Browser consumers with long, scrollable pages:** the page no longer jumps on every action. If you explicitly want scroll-to-top after an action, navigate via `ShellResponse.redirect` — that's the existing wire affordance for app-driven navigation.
- **Server / TUI consumers:** nothing to do — no wire/type/API change.

---

## Upgrading to `0.7.0` (`PageNode.width` override seam — npm + NuGet)

**Nothing to do** beyond taking the bump on whichever side you use. `0.7.0` adds one additive `PageNode` field (`width?: "wide" | "full"`). No existing consumer code requires changes; the wire is forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.6.0` | **`0.7.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.6.0` | **`0.7.0`** |

- **Existing pages:** unchanged behavior. Omitting the new field renders the same as `0.6.0` (1080px max-width).
- **Wider pages for data-heavy views:** set `Width: "wide"` (C#) / `width: "wide"` (TypeScript) on the page; the framework emits `.vms-page--wide` and the page extends to `var(--vms-page-max-wide)` (1440px default).
- **Full-bleed pages:** `Width: "full"` removes the max-width cap entirely.
- **Host retune of the wide value:** add `:root { --vms-page-max-wide: 1280px }` to your app's stylesheet (imported after the theme).
- **Global retune of the default cap (also valid):** `:root { --vms-page-max: 1280px }`. This was already a sanctioned seam (`AGENTS.md`); `0.7.0` annotates it in the inline `default.css` comment to match.
- **TUI consumers:** the `width` field is ignored — terminals fill naturally; width caps are a browser concept. No code change.

Closes [#13](https://github.com/ashley-shrok/ViewModelShell/issues/13).

---

## Upgrading to `0.6.0` (Terminal substrate rewrite — OpenTUI + Bun runtime)

**No wire change. NuGet contents identical to `0.5.0`** — it bumps to `0.6.0` only to keep shared major.minor with npm.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.5.0` | **`0.6.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.5.0` | **`0.6.0`** *(alignment-only; no functional change)* |

### What changed and what didn't

- **Wire format:** unchanged. `ViewNode` types, `ShellSideEffect`, `ShellResponse`, anti-forgery / `getRequestHeaders()` plumbing — all identical to `0.5.0`. The cross-backend parity suite passes byte-for-byte against the same 14 backends.
- **`BrowserAdapter` (`./browser` subpath):** unchanged. No code change, no behavior change, no install change.
- **Backend types (`./server` subpath + NuGet):** unchanged.
- **`TuiAdapter` (`./tui` subpath + `vms-tui` CLI):** **rewritten on OpenTUI**, which is currently Bun-only. The visual layout is meaningfully different (per-pane borders + focused-pane highlight + persistent status bar at the bottom); functionally it now ships mouse support throughout (click any button/checkbox/link/copy-button/table header/table row), wheel scroll, Tab/Shift-Tab focus cycle across panes, and Enter/Space keyboard activation of the focused pane's primary actionable.

### What you need to do

- **If you're a browser-only consumer or a server-only consumer:** nothing. The npm bump is harmless; you can take it or pin to `0.5.0` (the wire is identical).
- **If you use the `vms-tui` CLI** (e.g. `npx vms-tui http://localhost:3000/api/tasks`):
  1. Install Bun if you don't have it: `curl -fsSL https://bun.sh/install | bash` (see [bun.sh](https://bun.sh/install) for other installers).
  2. Swap `npx vms-tui …` → `bunx vms-tui …` (or `bun install -g @ashley-shrok/viewmodel-shell && vms-tui …`). The Node entry still runs — it now prints a clear "needs Bun" message and exits 1 before any FFI import attempts.
- **If you import `TuiAdapter` programmatically** (i.e. `import { TuiAdapter } from "@ashley-shrok/viewmodel-shell/tui"`):
  1. Update your `package.json` `optionalDependencies` / `dependencies`: remove `ink`, `ink-text-input`, `ink-select-input`, and any `react@18` pin; add `@opentui/core`, `@opentui/react`, `react@19`. Or just install via the new README snippet: `bun add @ashley-shrok/viewmodel-shell @opentui/core @opentui/react react`.
  2. Your host process must run under Bun (not Node) for the TUI render path. Side-channel verbs (`storage`, `saveFile`, `navigate`) still work under Node, but mounting the renderer (`adapter.render(vm, onAction)`) requires Bun's FFI.
  3. Public API surface — constructor (`new TuiAdapter({ viewport?, sidebarFraction? })`), `render(vm, onAction)`, and the optional `Adapter` capability verbs — is byte-identical to `0.5.0`. No code changes to your integration.

### Why the version is aligned even with no NuGet-side change

`AGENTS.md` (top of file) states the two packages "share major.minor; bumping a `ViewNode` type or wire-format change bumps both sides." This wasn't a wire change, but a major.minor on npm with the existing rule means NuGet ticks too. The alternative — letting npm hit `0.6` while NuGet stays at `0.5` — would diverge major.minor and silently break the rule. Going forward, if the TUI work needs another bump without a wire change, that's another no-op alignment release on NuGet; once OpenTUI's Node support lands and we drop the Bun requirement, the alignment story stays clean.

---

## Upgrading to `0.5.0` (Authenticated downloads — npm + NuGet)

**Nothing to do** beyond taking the bump on whichever side you use. `0.5.0` adds one additive `ShellSideEffect` type (`"download"`) and one optional `Adapter` capability verb (`saveFile?`). No existing consumer code requires changes; the existing wire is forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.9` | **`0.5.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | **`0.5.0`** |

- **Browser / server consumers (no `"download"` side-effect emitted):** nothing to do — existing `ShellSideEffect` JSON is unchanged (new `Url`/`Filename` fields are optional and null-omitted).
- **Backends that want to offer authenticated downloads:** use the new factory in your action handlers — the shell will fetch the URL with `getRequestHeaders()` merged and save the response:
  ```csharp
  return new ShellResponse<MyState>(BuildVm(state), state)
      .WithEffect(ShellSideEffect.Download("/api/invoices/42/pdf", "invoice-42.pdf"));
  ```
  ```typescript
  return { vm: buildVm(state), state,
    sideEffects: [shellSideEffect.download("/api/invoices/42/pdf", "invoice-42.pdf")] };
  ```
- **Custom `Adapter` implementations:** to support `"download"` side-effects, implement the new optional `saveFile?(data: Blob, filename: string, contentType: string): void | Promise<void>` verb on your adapter. Without it, an arriving `"download"` side-effect surfaces a loud `onError` (no silent swallow). `BrowserAdapter` and `TuiAdapter` ship the verb out of the box.
- **Static / non-interactive output (TUI `renderTree`):** byte-identical to `0.4.9`.

---

## Upgrading to npm `0.4.9` (Terminal sidebar rail proportional — npm only)

**Nothing to do** beyond taking the patch. `layout:"sidebar"`'s rail is
now proportional (~⅓ of the terminal, clamped [24,56]) instead of a
hardcoded 24 cols — usable for master/detail on wide terminals. NuGet
unchanged at `0.4.2`; major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.8` | **`0.4.9`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire/type/API change.
- **Terminal master/detail apps:** the sidebar rail now scales with the
  terminal. Tune it with `new TuiAdapter({ sidebarFraction: 0.3 })`
  (0.15–0.6; default ⅓). `split` is still a fixed 50/50.
- **Non-interactive / static render:** byte-identical to `0.4.8`.

---

## Upgrading to npm `0.4.8` (Terminal link OSC 8 fix — npm only)

**Nothing to do** beyond taking the patch. `0.4.8` fixes a long-latent bug
where terminal `link` nodes emitted `]8;;…` garbage text (the ESC
introducer + ST terminator were missing) instead of a real OSC 8
hyperlink — broken in every terminal. NuGet unchanged at `0.4.2`;
major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.7` | **`0.4.8`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire/type/API change.
- **Terminal consumers using `link` nodes:** `0.4.8` is required —
  `0.4.7` and earlier render them as raw `]8;;…` text. Empty-href links
  still degrade to plain text (unchanged).
- **Non-interactive / static render:** now carries a proper OSC 8 escape
  (terminals ignore it if unsupported) rather than literal `]8;;` text.

---

## Upgrading to npm `0.4.7` (Terminal fill reaches section content — npm only)

**Nothing to do** beyond taking the patch. Completes `0.4.5`/`0.4.6`:
section-wrapped content (the idiomatic norm — e.g. a sidebar with card
sections) now scales with the terminal instead of rendering at a fixed
width inside an otherwise-filled surface. NuGet unchanged at `0.4.2`;
major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.6` | **`0.4.7`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire/type/API change.
- **Terminal consumers:** `sidebar`/`split`/`stack` and section content now
  fill and re-flow with the terminal. `cards` stays a uniform small-tile
  grid by design. Opt-out unchanged:
  `new TuiAdapter({ viewport: "content" })`.
- **Non-interactive (pipe / CI / agent / `</dev/null`) & static render:**
  byte-identical to `0.4.4`–`0.4.6`.

---

## Upgrading to npm `0.4.6` (Terminal viewport fill reaches the content — npm only)

**Nothing to do** beyond taking the patch. `0.4.6` completes `0.4.5`: the
terminal-sized root introduced in `0.4.5` now actually propagates through the
layout spine, so `sidebar`/`split`/`stack` content fills the terminal and
re-flows with it (previously the surface grew but content stayed a fixed
width). NuGet unchanged at `0.4.2`; major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.5` | **`0.4.6`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire/type/API change.
- **Terminal consumers:** the full-screen UI now genuinely fills the
  terminal (the intended `0.4.5` behavior). `cards` stays a uniform
  small-tile grid by design. Opt-out unchanged:
  `new TuiAdapter({ viewport: "content" })`.
- **Non-interactive (pipe / CI / agent / `</dev/null`) & static render:**
  byte-identical to `0.4.5`/`0.4.4`.

---

## Upgrading to npm `0.4.5` (Terminal full-viewport + alternate screen — npm only)

**Behavior change on an interactive terminal only.** `TuiAdapter` /
`vms-tui` now fill the screen via the alternate-screen buffer (vim/htop
style; your terminal is restored verbatim on every exit — quit, Ctrl-C,
SIGTERM, crash) and re-flow on resize, instead of rendering at intrinsic
content size. NuGet unchanged at `0.4.2`; major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.4` | **`0.4.5`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire, type, or API
  change.
- **Terminal consumers who want the old look:**
  `new TuiAdapter({ viewport: "content" })` — intrinsic content size, no
  screen takeover (pre-`0.4.5` behavior).
- **Non-interactive (pipe / CI / agent / `</dev/null`):** unchanged from
  `0.4.4` — one static frame, no alternate screen.

---

## Upgrading to npm `0.4.4` (Terminal non-TTY crash fix — npm only)

**Nothing to do** beyond taking the patch. `0.4.4` fixes a `0.4.3` bug where
`vms-tui` crashed (Ink "Raw mode is not supported") on non-TTY stdin (pipes,
`</dev/null`, CI, agent shells) instead of rendering one static frame and
exiting. NuGet unchanged at `0.4.2`; major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.3` | **`0.4.4`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

No wire, type, API, or behavior change for browser/server consumers. If you
drive an app from a terminal in a non-interactive shell (agents, CI, cron),
`0.4.4` is required — `0.4.3` errors there. `npx vms-tui@latest <url>` picks
it up automatically.

---

## Upgrading to npm `0.4.3` (Terminal/TUI front-end — npm only)

**Nothing to do.** This is an additive, client-only npm release. NuGet
`AshleyShrok.ViewModelShell` is **unchanged at `0.4.2`**; major.minor stays
aligned at `0.4` (client-only changes take an npm-only patch — the same model
as `0.4.1`).

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.2` | **`0.4.3`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

No wire, type, API, or behavior change. Existing browser and server apps are
unaffected and do not need to upgrade. The new
`@ashley-shrok/viewmodel-shell/tui` export and the `vms-tui` bin are purely
additive; Ink is an optional dependency that web/server consumers never load.

**Optional, if you want it** — drive any existing ViewModel Shell backend from
a terminal, no backend change:

```bash
npx vms-tui https://your-app.example/api/tasks
```

---

## Upgrading to 0.4.0 (Design system: theme + layout + canonical examples)

This is **one consolidated milestone**: a serviceable shipped default look + density/card,
an additive `layout` preset enum, the default-palette re-baseline, and the de-chromed
canonical examples. There are no separately-migratable intermediate `0.3.x` dev states —
treat the whole thing as a single `0.4.0` upgrade.

### 1. Exact versions

| Package | Source | From | To |
|---|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | frontend renderer + `/server` subpath | `0.3.14` | **`0.4.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | .NET backend `ViewNode` types | `0.3.10` | **`0.4.0`** |

#### Why this is a MINOR (`0.3.x → 0.4.0`), aligned across both packages

The project's own governing rule, documented in [`AGENTS.md`](./AGENTS.md):

> *"The two packages share major.minor — bumping a `ViewNode` type or wire-format
> change bumps both sides."*

This release **does** carry a wire-format change: the additive `layout?: "stack" |
"split" | "cards"` closed-union enum on `PageNode`/`SectionNode` (plus the additive
`density?` and `variant?` closed-union fields). A wire-format change moves the
`major.minor`, so both packages bump together to **`0.4.0`**.

This is the **same rule, opposite outcome** to `0.3.13`: that release had *zero*
wire-format change, so the rule held `major.minor` fixed and it shipped as a npm-only
PATCH. This release *does* change the wire format, so the same rule **requires** an
aligned minor on both npm and NuGet. The rule text in `AGENTS.md` is unchanged — only
the version numbers move.

### 2. What is explicitly NOT breaking (and why)

| Area | Why it is NOT breaking |
|---|---|
| **The new wire fields** (`layout`, `density`, `variant`) | All three are **additive optional closed unions**. Omitting them (or sending the default `"stack"`/`"comfortable"`) is **byte-identical** to prior behavior — proven by the cross-backend parity suite staying 100% green (the FeatureProbe fixture was widened to exercise all three across .NET/Bun/Node). Existing apps render unchanged unless they explicitly opt in. |
| **Every existing `ViewNode` type** | No type added, removed, or changed in a breaking way. The additions are optional fields on the existing `PageNode`/`SectionNode`. |
| **The `--vms-*` override seam** | Every `--vms-*` variable name still exists; the 11 pre-existing theme files are byte-identical; overriding `:root` still fully reskins. The seam mechanism is unchanged. |
| **`themes/light-purple.css`** | Byte-unchanged. It used to be a real override; it is now a harmless no-op (its values are the new default) — importing it is still valid and still produces exactly its documented look (`--vms-warning` `#c89610` included). |

#### The one intentional default-appearance change (NOT a wire/API break)

The unthemed shipped `default.css` `:root` was **re-based dark→light** onto the
existing `light-purple` value set (`--vms-bg #f7f7f9`, `--vms-surface #fff`,
`--vms-accent #5a4ad7`, `--vms-color-scheme light`). This is an **intentional change to
the shipped default appearance** — it is **not** a wire-format, API, or `ViewNode`
break, and it does **not** affect any app that already sets its own `:root` or imports
a theme (the default never applied to those apps).

Additionally, **one** value of the unthemed default was tightened for accessibility:
the shipped default's `--vms-warning` is **`#a37510`** (a slightly darker amber than
`light-purple.css`'s `#c89610`) so the shipped default clears the WCAG-AA non-text
contrast floor (≥3.0:1 on `--vms-bg`/`--vms-surface`/`--vms-surface-2`; it was
2.51/2.68/2.36:1, it is now 3.84/4.11/3.62:1 — CI-enforced). This applies **only** to
the unthemed shipped default: if you `import
"@ashley-shrok/viewmodel-shell/themes/light-purple.css"` explicitly, you still get the
original `#c89610` (that theme file is byte-unchanged). This is the same
one-value-tighten-to-pass-AA precedent as the `0.3` `--vms-text-muted` fix — the
variable still exists and themes still override it, so it is not a seam behavior change.

**Restoring the exact prior dark look (one line).** If you relied on the prior dark
default and set **no** theme and **no** `:root`, the prior look — pixel-for-pixel — is
one import away:

```ts
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css";
```

`themes/dark-purple.css` is a **byte-exact capture of the prior (pre-0.4.0) dark
default**, shipped specifically so the prior appearance is recoverable with a single
import (it fills the previously-missing dark-purple slot alongside dark-blue/green/rose/
amber/teal). Same honest-framing discipline as the `0.3.13` silent-behavior caveats: if
something visible changes by default, here is exactly what changed and exactly how to
put it back.

### 3. Recommended upgrade steps

**npm (frontend / `/server` subpath consumers):**

```bash
npm update @ashley-shrok/viewmodel-shell
```

(or pin `"@ashley-shrok/viewmodel-shell": "^0.4.0"` in `package.json`).

If you do nothing else, your app keeps working — the new wire fields are opt-in. If you
relied on the prior **dark** default look and set no theme, add the one-line
`dark-purple.css` import shown above to keep it pixel-identical. To adopt the new
design-system features, set `layout`/`density` on `PageNode`/`SectionNode` or
`variant: "card"` on a `SectionNode` (see [`AGENTS.md`](./AGENTS.md) "Design system"
for the when-to-use guide and the live Showcase worked example).

**.NET (NuGet `AshleyShrok.ViewModelShell`) consumers:**

```bash
dotnet add package AshleyShrok.ViewModelShell --version 0.4.0
```

The new fields are additive optional members on the existing `PageNode`/`SectionNode`
records — existing backends compile and emit byte-identical wire output unless they set
the new fields.

---

## Upgrading to npm `0.3.13` (Upload Progress, MIGRATE-01)

### 1. Exact versions

| Package | Source | From | To |
|---|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | frontend renderer + `/server` subpath | `0.3.12` | **`0.3.13`** |
| `AshleyShrok.ViewModelShell` (NuGet) | .NET backend `ViewNode` types | `0.3.9` | **`0.3.9` — unchanged** |

#### Why this is a PATCH (`0.3.12 → 0.3.13`), not a minor

The project's own governing rule, documented in
[`AGENTS.md`](./AGENTS.md):

> *"The two packages share major.minor — bumping a `ViewNode` type or wire-format
> change bumps both sides."*

This release has **zero wire-format and zero `ViewNode` change**: Phase 1 only
relocated *where* browser bindings execute (out of core, behind the capability
seam — not *what* the protocol does), and this upload-progress release is a pure
**client-side transport** addition. By the rule above, the `major.minor` stays
fixed at `0.3`, so the change ships as a PATCH.

This also matches the established patch cadence — every prior client-relevant
feature shipped as a patch:

- server-initiated redirect → `v0.3.4`
- client side-effects → `v0.3.5`
- polling / push → `v0.3.6`
- npm-only tooling/backend-subpath changes → `0.3.10`, `0.3.11`, `0.3.12`

Consumers tracking that cadence will notice the number; the reason is the
`AGENTS.md` `major.minor`-alignment rule above plus this zero-wire-change release.

#### Why there is NO NuGet bump

`AshleyShrok.ViewModelShell` stays at `0.3.9` and **.NET-only consumers need to do
nothing**. There is no wire-format change and no .NET API change — upload progress
is browser-runtime only. Both packages remain on the `0.3` `major.minor`, so
*not* bumping NuGet **preserves** the documented npm/NuGet alignment invariant
(it is not divergence — bumping NuGet to a number with no corresponding change
would be the divergence).

### 2. The single public-API addition

One new **optional** field on `ShellOptions`:

```typescript
onUploadProgress?: (sent: number, total: number) => void;
```

That is the entire public-API surface delta. Its signature is byte-identical to
the already-documented `Adapter.transport` hook (`hooks.onUploadProgress`). It is
purely additive — existing `ShellOptions` consumers are unaffected.

### 3. What is explicitly NOT breaking (and why)

Nothing in this release is a breaking change. Specifically, all of the following
are **NOT breaking**:

| Area | Why it is NOT breaking |
|---|---|
| **Wire format** | No new/changed request or response field. The XHR upload path sends the *exact same* `multipart/form-data` (`_action`, `_state`, file fields), the same headers, and resolves a real `Response` so the shared `processResponse()` path is byte-identical regardless of transport. Cross-backend parity (7 fixtures) stays 100% green. |
| **Server-initiated redirect** (`redirect`) | Untouched. Phase 1 relocated *where* the binding runs, not *what* it does; this release adds nothing to the redirect path. |
| **Client side-effects** (`set-local-storage` / `set-session-storage`) | Untouched — unchanged behavior and ordering. |
| **Polling & push** (`pollInterval`, `NextPollIn`, `shell.push()`) | Untouched. |
| **Every existing `ViewNode` type** (page, section, list, form, field, checkbox, button, text, link, stat-bar, tabs, progress, modal, table) | No type added, removed, or changed. Zero `ViewNode`/wire change is exactly why this is a PATCH. |
| **Existing custom `Adapter` implementations** | `transport?` is and remains **optional**. A custom `Adapter` that implements only `render` (or `render` + `navigate`/`storage` but not `transport`) **still compiles and behaves exactly as before** — it transparently uses the core `fetch` path. No adapter must be changed. |

In one line: Phase 1 relocated *where* bindings run, not *what* they do; this
release only **adds an optional client-side send path** — it removes or changes
nothing.

### 4. Recommended upgrade steps

**npm (frontend / `/server` subpath consumers):**

```bash
npm update @ashley-shrok/viewmodel-shell
```

(or pin `"@ashley-shrok/viewmodel-shell": "^0.3.13"` in `package.json`).

Optionally, if you want byte progress on file uploads, set `onUploadProgress`
in your `ShellOptions`:

```typescript
const shell = new ViewModelShell({
  endpoint:       "/api/your-feature",
  actionEndpoint: "/api/your-feature/action",
  adapter:        new BrowserAdapter(container),
  onUploadProgress: (sent, total) => {
    const pct = total > 0 ? Math.round((sent / total) * 100) : null;
    // pct === null → indeterminate (no content length); show a spinner, not a bar
    updateProgressUi(pct);
  },
});
```

If you do nothing, uploads behave exactly as before — `onUploadProgress` is
opt-in.

**.NET (NuGet `AshleyShrok.ViewModelShell`) consumers:** **No action.** The NuGet
package is unchanged at `0.3.9`.

### 5. Two non-obvious silent behaviors — read these before relying on progress

These are intentional design decisions, not bugs. A consumer that does not know
about them will otherwise ship a broken or misleading upload UI.

#### (5a) Progress fires ONLY if the adapter implements `transport`

`onUploadProgress` fires **only when the plugged-in `Adapter` implements
`transport`**. The default `BrowserAdapter` does, so the common path works.

But a **custom adapter without `transport` silently falls back** to the core
`fetch` path: **the upload still succeeds, but NO progress events fire** — and
**no error is raised**. This is *intentional graceful degradation* (the
`transport` verb is the one asymmetric capability with a safe universal default;
progress is a soft enhancement, not a correctness/security guarantee), **not** an
error and **not** the fail-loud behavior of `navigate`/`storage`.

Implication: if you supply a custom adapter and set `onUploadProgress` but your
progress UI never updates, the cause is a missing `transport` on your adapter —
the upload itself is fine. Do **not** assume "the callback was set, therefore
progress fired."

#### (5b) `total` may be `0` — guard before dividing

The `total` argument may be **`0`**, meaning **"indeterminate"** — the server or
stream did not report a content length. **Consumers MUST guard `total > 0`
before computing `sent / total`**, or a percentage calculation yields `NaN` /
`Infinity` and your progress bar breaks.

Copy-pasteable guard:

```typescript
onUploadProgress: (sent, total) => {
  const pct = total > 0 ? Math.round((sent / total) * 100) : null;
  // pct === null  → indeterminate: render an indeterminate spinner, not "0%"
  // pct is 0..100 → render a determinate bar
};
```

(The framework also never reports `(0, 0)` at completion — an indeterminate
upload completes with `(finalLoaded, finalLoaded)` so a guarded UI lands on a
sensible terminal state — but the in-flight `total === 0` sentinel still requires
the `total > 0` guard above.)

---

*Migration guide for npm `@ashley-shrok/viewmodel-shell` `0.3.13` (NuGet
`AshleyShrok.ViewModelShell` unchanged at `0.3.9`). See
[`AGENTS.md`](./AGENTS.md) for the full wire format and the capability-seam
architecture.*
