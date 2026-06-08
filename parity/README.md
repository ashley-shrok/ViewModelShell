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

### Envelope-case steps (Phase 07 additions)

Three additive optional fields on `FixtureStep` support testing failure paths:

**`expectStatus?: number`** — for steps that expect a non-2xx HTTP status. When set, the
runner asserts `res.status === expectStatus` instead of throwing on `!res.ok`, and also
asserts `body.ok === false`. All success-path steps (no `expectStatus`) assert `body.ok === true`.
This makes the `ok` flag a wire-level invariant enforced on every step of every fixture:

```json
{
  "id": "unknown-action",
  "method": "POST",
  "action": { "name": "this-action-does-not-exist" },
  "expectStatus": 400
}
```

**`malformedBody?: "empty-action" | "non-json" | "missing-action-field"`** — instructs the
runner to construct a deliberately broken `_action` multipart field for parse-error testing.
When set, the step's `action` field is ignored. `"empty-action"` sends an empty string for
`_action`; `"non-json"` sends a syntactically broken JSON string; `"missing-action-field"`
omits the `_action` field entirely:

```json
{
  "id": "malformed-payload",
  "method": "POST",
  "malformedBody": "empty-action",
  "expectStatus": 400,
  "compareIgnoreFields": ["errors.0.message"]
}
```

**`compareIgnoreFields?: string[]`** — a list of dotted paths into the captured response that
the cross-backend diff skips for this step. Paths use dot notation with numeric segments for
array indices (e.g. `"errors.0.message"` skips `errors[0].message`). This field exists to
accommodate library-flavored divergence — use it **SPARINGLY**. Its only intended use is
parse-error messages where .NET System.Text.Json and JS JSON.parse produce different human-readable
strings while agreeing on the structured fields (`ok`, `status`, `errors[0].code`). Do NOT use
it to paper over real wire-shape drift; reviewers should treat additions with scrutiny. The
existing `feature-probe-envelope` fixture demonstrates the only sanctioned use:

```json
{
  "id": "malformed-payload",
  "method": "POST",
  "malformedBody": "empty-action",
  "expectStatus": 400,
  "compareIgnoreFields": ["errors.0.message"]
}
```

## Why this exists

ViewModel Shell is a wire-format contract. The contract is what consumer
apps depend on. Unit tests on either side prove a backend behaves correctly
in isolation, but they can't prove two backends behave *identically* — which
is what the framework actually promises. Any drift between backends is a
bug that bites every consumer app, often silently.
