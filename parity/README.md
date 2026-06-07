# Parity test harness

Verifies that every official ViewModel Shell backend produces byte-identical
wire-format responses for the same input sequence. Catches the bug class
that unit tests on either side can't see: drift between backends.

## How it works

1. `backends.json` lists each backend implementation: start command, port,
   readiness URL, which fixtures it implements.
2. `fixtures/*.json` define recorded scripts of HTTP actions for each app.
   The harness threads the response `state` from step N into the `_state`
   form field of step N+1 — same way the real shell does.
3. `run.ts` spins up every backend in parallel, runs each fixture against
   every backend that claims to implement it, and diffs the responses
   step-for-step.
4. `normalize.ts` strips fields that necessarily differ across runs
   (timestamps, generated IDs) before diffing — anything that should be
   byte-identical stays untouched.

A parity failure prints the exact JSON path where the responses diverged.

## Run

```
cd parity
bun install
bun run test
```

Currently exercises:
- **Tasks** — .NET (`demo/Tasks/AspNetCore`) vs Bun (`demo/Tasks-bun`) — 8-step fixture covering forms, lists, checkboxes, tabs, progress
- **ContactManager** — .NET (`demo/ContactManager/AspNetCore`) vs Bun (`demo/ContactManager-bun`) — 11-step fixture covering views (list/detail), search, navigation, deletion

Runs in GitHub Actions on every push and PR via `.github/workflows/parity.yml`.

## Adding a new backend

Add an entry to `backends.json` with start command, port, and which fixtures
it implements. The harness will include it in the next run.

## Adding a new fixture

Drop a JSON file under `fixtures/`. Each step references the previous
response's state automatically — you only write the action name. As of
Phase 6 (wire shape 0.17.0 / WIRE-07), the on-wire `_action` payload is
`{ "name": "..." }` only — there is no `context` field. Per-row / per-tab
identity is encoded in the action name itself (e.g. `delete-row-42`,
`filter-active`).

For fixture steps that simulate user-typed form input followed by a submit
click, add a `stateMutations` array — each entry is `{ path, value }` and is
written into the prior step's response state before this step's request is
sent. The path syntax mirrors `BindNode.bind` in the renderer (dotted
segments; numeric segments index arrays). Example:

```json
{
  "id": "add-task",
  "method": "POST",
  "action": { "name": "add" },
  "stateMutations": [{ "path": "draftTitle", "value": "Acme" }]
}
```

Mark every backend in `backends.json` that should be tested against the
fixture by adding the fixture name to its `fixtures` array.

## Why this exists

ViewModel Shell is a wire-format contract. The contract is what consumer
apps depend on. Unit tests on either side prove a backend behaves correctly
in isolation, but they can't prove two backends behave *identically* — which
is what the framework actually promises. Any drift between backends is a
bug that bites every consumer app, often silently.
