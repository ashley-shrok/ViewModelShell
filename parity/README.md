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
- **Tasks** — .NET (`demo/Tasks/AspNetCore`) vs Bun (`demo/Tasks-bun`)

## Adding a new backend

Add an entry to `backends.json` with start command, port, and which fixtures
it implements. The harness will include it in the next run.

## Adding a new fixture

Drop a JSON file under `fixtures/`. Each step references the previous
response's state automatically — you only write the action name and context.
Mark every backend in `backends.json` that should be tested against the
fixture by adding the fixture name to its `fixtures` array.

## Why this exists

ViewModel Shell is a wire-format contract. The contract is what consumer
apps depend on. Unit tests on either side prove a backend behaves correctly
in isolation, but they can't prove two backends behave *identically* — which
is what the framework actually promises. Any drift between backends is a
bug that bites every consumer app, often silently.
