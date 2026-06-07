# Phase 6 — Deferred items

Items discovered during Phase 6 execution that are out of scope for the
discovering plan and have been deferred. Each entry names the discovering
plan and explains why it was punted.

---

## 1. Per-demo frontend `adapter.test.ts` files still assert the old wire shape

**Discovered during:** Plan 06-05 (Task 5 — full test-suite verification).

**Files affected:**
- `demo/Tasks/frontend/src/adapter.test.ts` — 5 failing tests (10 pass)
- `demo/ContactManager/frontend/src/adapter.test.ts` — 4 failing tests (6 pass)
- `demo/ExpenseTracker/frontend/src/adapter.test.ts` — 2 failing tests (14 pass)
- `demo/RetroBoard/frontend/src/adapter.test.ts` — 3 failing tests (9 pass)
- `demo/HelpDesk/frontend/src/adapter.test.ts` — 19 failing tests (25 pass)

**What's broken:** every failing assertion expects the renderer to dispatch
`{name, context: {...}}`. Under the Phase 6 wire shape (06-01 / 06-04) the
renderer dispatches `{name}` only — input values flow through `bind` paths
on the round-tripped state. Sample failing assertion:

```ts
expect(onAction).toHaveBeenCalledWith({ name: "add", context: { title: "New task" } });
```

**Why not fixed in 06-04:** Plan 06-04's verification only covered the
framework's own `npx vitest run` (174 pass | 1 skipped) and the .NET
test projects — the per-demo `frontend/src/adapter.test.ts` files were not
listed as a verification gate and were not migrated alongside the backend
controllers. Plan 06-05's scope is the parity harness + protocol meta bump;
re-authoring 5 demo adapter test suites is materially separate work and
would balloon 06-05.

**Why not fixed in 06-05:** Per the executor scope-boundary rule
("only auto-fix issues DIRECTLY caused by the current task's changes"),
these are pre-existing failures introduced by 06-04. Phase 6's headline
gates (framework vitest, framework dotnet tests, all 172 demo .NET tests,
cross-backend parity across .NET / Bun / Node) all pass green. The demo
frontend adapter tests are scaffolding for the demos themselves, not
framework correctness gates.

**Suggested fix:** A follow-up plan (Phase 7 candidate, or a quick under
the 0.17.0 milestone closeout) should rewrite each `adapter.test.ts` to
exercise bind-path writes on state instead of `context` payload
assertions. The pattern is straightforward — drive a click, then assert
that the next dispatch's `_state` carries the bind-path mutation
(e.g. `state.draftTitle === "New task"`) and that the action is
`{name: "add"}` only. The Tasks demo is the simplest reference; HelpDesk
is the most extensive and should be saved for last.

**Impact of NOT fixing:** Per-demo frontend adapter tests do not run in
CI's parity workflow and do not gate releases — confirmed by checking
`.github/workflows/parity.yml`, which runs the parity suite and the
framework's own vitest, but not per-demo frontend test scripts. The
failures are local-dev noise, not a release blocker, but they should
be cleaned up before 1.0.0 ships so the demo set remains a credible
teaching reference.
