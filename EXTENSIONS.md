# ViewModel Shell — Extensions Status

All extensions originally listed here have been implemented. This document records what
shipped and how it differs from the original spec, so the next session has accurate
expectations.

Implementation lives in:
- `viewmodel-shell/src/index.ts` — TypeScript types + shell
- `viewmodel-shell/src/browser.ts` — BrowserAdapter (DOM renderer)
- `demo/Tasks/AspNetCore/ViewModels.cs` (and parallel copies in each demo) — C# node types

Test suites kept green:
- `demo/Tasks/frontend` — `npx vitest run` (15 tests)
- `demo/HelpDesk/frontend` — `npx vitest run` (40 tests)
- `demo/HelpDesk/AspNetCore.Tests` — `dotnet test` (37 tests)

---

## 1. Hidden inputs ✅

`FieldNode.inputType: "hidden"` renders a bare `<input type="hidden">` with no wrapper, no
label. Server reads via `Str("field_name")` like any other field.

**Excluded from draft snapshot** — server is always authoritative for hidden values, so
re-renders never restore stale snapshots over fresh server values.

## 2. Time / datetime-local ✅

`FieldNode.inputType: "time"` and `"datetime-local"` are pure additions to the union — no
adapter changes beyond the input element being created with the right `type`. On the C#
side the recommended parsing is `TimeOnly.TryParse` for `time` and `DateTime.TryParse` for
`datetime-local`.

## 3. Select / select-multiple ✅

`FieldNode.inputType: "select"` and `"select-multiple"` with `options: [{ value, label }]`.
For single select, `value` selects the matching option. For multi-select, `value` is a
comma-separated string and the form submit collects selected options as comma-joined.

**Selects are NOT included in the draft snapshot.** The reasoning: the snapshot mechanism
exists to preserve user-typed text mid-flow. Selects don't have typed content, and we
can't safely distinguish "server set this value" from "user changed it" after rendering.
If this turns out to be a UX problem in practice, revisit with a `data-user-selected`
flag approach.

**Empty/placeholder option:** browser default behaviour — first option selected when
`value` is null. No explicit placeholder option is rendered.

## 4. File input + multipart contract change ✅

This was the largest change. Rather than the original two-phase upload spec, we changed
the entire dispatch contract to `multipart/form-data` so that files travel naturally with
their containing form submission and the protocol stays uniform.

**What changed:**
- `ViewModelShell.dispatch` always sends `multipart/form-data` (not JSON), with the action
  payload in a `_action` form field and any files as additional form entries.
- `ActionEvent` now has an optional `files?: Record<string, File>` field.
- File inputs persist across re-renders via the `DataTransfer` API: the adapter holds
  selected `File` objects in a `fileRegistry` map and re-applies them to newly rendered
  file inputs on each render. This means a user can pick a file, dispatch other actions,
  and the file stays put until form submission.
- The action endpoint signature changed from `Action([FromBody] ActionPayload payload)`
  to `Action()` reading `Request.Form["_action"]` via `ActionPayload.Parse(...)`. All six
  demo controllers and both HelpDesk test files were updated.
- File handling is per-app: the controller reads `Request.Form.Files`, persists each
  `IFormFile` however the app needs (disk, blob storage, DB), and surfaces resulting
  paths/IDs in the next ViewModel.

**Trade-off accepted:** every dispatch now incurs the multipart overhead even when no
files are involved. In exchange, the contract is uniform, the file-input UX is natural
(pick-then-submit, no out-of-band token shuffle), and there is no second endpoint to
configure. Given the framework's "server owns everything" philosophy, the uniformity
won.

## 5. Real-time field action → Enter-key dispatch ✅

The previous behaviour where `FieldNode.action` fired on every `input` event has been
replaced with Enter-key dispatch on `keydown`. Textareas do not get the listener (Enter
inserts a newline). This was a breaking change to the framework contract — no demo
relied on per-keystroke dispatch, so all existing demos work unchanged.

## 6. Modal node ✅

`ModalNode` with optional `title`, required `children`, and optional `dismissAction`.
Renders as `.vms-modal-backdrop > .vms-modal[role=dialog]` with header/body. CSS handles
the overlay positioning via `position: fixed` — no special DOM insertion (modal is a
normal child of `this.container`).

Implemented per the discussion:
- No backdrop-click dismissal (clicking the backdrop does nothing).
- Close button rendered only when `dismissAction` is set, dispatches that action verbatim.
- No focus management (focus is not moved to the modal or returned to the trigger).
- A modal with no `dismissAction` is non-dismissible by client-side interaction —
  intentional, the dev must include an in-modal action to close it.

## 7. Table node ✅

`TableNode` with `columns`, `rows`, optional `sortColumn`/`sortDirection`/`sortAction`,
optional `filterValue`/`filterAction`. Sortable headers compute the next direction
client-side from the current `sortColumn`/`sortDirection` and dispatch
`{ column, direction }`. Filter input dispatches on Enter (no per-keystroke dispatch),
and is pre-populated from `filterValue` so the server is the single source of truth.

Per-row `action` is supported; row variant becomes `vms-table__row--{variant}`.

---

## Conventions to remember next time

- **Don't add features the framework doesn't have a clean place for.** The two-phase
  upload originally proposed for files would have been a workaround. Changing the
  dispatch contract was a bigger change but kept the framework coherent.
- **Test suites are non-negotiable.** Every change kept the existing tests green and
  added new tests for new behaviour. The HelpDesk frontend went from 13 → 40 tests.
- **All demo ViewModels.cs copies must stay in sync.** When adding a new node type or
  changing `ActionPayload`, update all five copies (Tasks, HelpDesk, ExpenseTracker,
  ContactManager, RetroBoard).
- **All controllers use the same action signature.** When changing the dispatch
  contract, all six controllers must be updated together to keep the codebase honest.
