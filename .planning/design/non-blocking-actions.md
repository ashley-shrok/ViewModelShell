# Non-Blocking Actions + Reconciliation — Design of Record

**Status:** design locked (Ashley + Vicky, 2026-07-08). Rationale-of-record for the milestone that
adds a real concurrency model to the dispatch loop. Origin: an outside-agent spec
(`framework-primitives-spec.md`, kept in the `framework-primitives-spec` memo) written to solve a
PBMInvoices (Poppy) need, then reframed with Ashley from fundamentals.

## The need (concrete, generalizable)

PBMInvoices: the user toggles invoice checkboxes rapidly; an **action bar above the table must
reflect server-computed validity for the current selection** (which buttons are valid depends on
complex server-side lifecycle rules that MUST NOT be computed client-side), **live, without a
blocking round-trip per click**. Generalizes to any "server's opinion of my fast-changing local
state": live totals, live validation summaries, live counts.

## Why today's model can't do it (verified in source)

The dispatch loop has a **single global mutex**: `viewmodel-shell/src/index.ts` — `dispatch()` guards
`if (this.dispatching) return;` for **every** round-trip, silent (poll) or user. Consequences:

- A poll in flight → a user click hits that guard and is **silently dropped**. And the reverse.
- So "poll is non-blocking" is only half-true: it hides the *busy UI* (a separate user-only flag,
  0.16.0) but still **occupies the one dispatch slot**, so it contends with and drops user actions.
- There is no concept of a round-trip that genuinely coexists with user actions. It's "one at a
  time, everything else eaten." That is fatal the moment input-triggered refreshes fire frequently.

## The primitive (the fundamental reframe)

**One primitive: the non-blocking action.** Not a new "Query" node type — a **property of a
dispatch**: `blocking: false` (default `true` → fully backward-compatible). Everything else is an
instance of it:

- **Poll** = a non-blocking action on a timer. Folding poll into this model **fixes the poll/user
  contention above as a side effect** (a real correction to existing behavior, not just an addition).
- **Checkbox / selection refresh** = a non-blocking action on input change. This is the **proper
  redo of `selection.action`**, removed in 0.15.0 because of the rapid-toggle-during-round-trip
  revert bug — the reconciliation below is exactly the fix that lets it return correctly.

A non-blocking action still sends full state (server stays a pure `(state, action) → (state, view)`
transformer) and returns a **full view tree** (NOT a fragment — reuse the renderer + existing
focus/scroll/caret/draft preservation; the re-render only visually touches what changed). Fragment
return is an optimization we deliberately do **not** build now; it would put partial trees on the
wire, a much bigger philosophical change than the feature. Revisit only if profiling forces it.

## Reconciliation (why the spec's §3/§4 earn their place once actions can mutate)

Server re-validation already guarantees **server-state correctness** (never trust the client; the
server re-validates every action against the submitted state and can reject via the `rejected`
envelope). But once background round-trips coexist with user actions, two problems appear that
re-validation does NOT cover:

1. **Out-of-order clobbering** — a stale background response landing after a newer one and
   overwriting the view with old truth. Re-validation says nothing about *which response wins the
   render*. → solved by **epoch ordering**.
2. **Intent drift** — a button changing meaning under the cursor between render and click. → the
   **admission** concern.

### Epoch — client-side, off the wire

A monotonic **client-side sequence counter**, incremented on every dispatch and stamped on each
request; a response is applied only if no later dispatch has already been applied (last-writer-wins;
late/stale responses discarded). In a stateless world every round-trip is independent, so the client
is the only place with global order — **no server change, no new wire field.** (The outside spec put
"view tree epoch" on the wire; we keep it a pure client concern.)

### Admission — staged, not built speculatively

The spec's **admission barrier + full-node diff** (hold a blocking action while any non-blocking
round-trip is in flight; at departure compare the clicked node's snapshot to the current-epoch tree;
drop on ANY difference) is **philosophy-consistent** — the framework can't know which node
attributes are semantically load-bearing for a given app, so refusing to guess and treating the
whole node as the contract is the same move VMS makes everywhere. But it is **polish, not the core**,
so we stage:

- **Stage 1 (core):** non-blocking dispatch + client epoch ordering. Correctness comes from server
  re-validation + the `rejected` envelope (a click that raced a refresh into invalidity is rejected
  with a message). Ships the capability cleanly.
- **Stage 2 (fast-follow, conditional):** the admission barrier, added **only if** transient
  intent-drift actually bites in Poppy's UX. Rationale to defer: the difference between "server
  rejects your click with a message" and "the click was silently held-then-dropped" is a UX call,
  and silent-drop has its own sharp edge (rage-clicking). Build it deliberately after watching
  Stage 1, not speculatively. If built, the barrier is **global** (hold blocking actions while any
  non-blocking round-trip is in flight) — scoping it to affected nodes would require the client to
  reason about which nodes a query touches, itself a form of app logic.

## The checkbox-visual rule

A selection checkbox **checks immediately** (local optimistic `bind` write, renders instantly) **and**
fires its action with `blocking: false`. The returned tree MUST echo the selection back so the
response doesn't un-check what the user just checked; epoch + coalescing stops a stale response from
reverting a rapid toggle. This is precisely the 0.15.0 failure mode, now fixed.

## Coalescing

Rapid non-blocking triggers **debounce/coalesce to a single in-flight request** (the classic "latest
wins" for a fast-changing selection). At most one background round-trip in flight at a time; input
accumulation (local) is never blocked.

## Wire / API surface (minimal)

- `blocking?: boolean` on the dispatch (default true). Likely expressed on the triggering node
  (`CheckboxNode`, `ButtonNode`, field-change) and/or the `ActionEvent`. Exact placement pinned in
  planning; keep it ONE optional field, both backends, absent-when-default (F2 rule).
- Optional `debounceMs?` for coalescing on frequently-firing inputs.
- `pollInterval` becomes sugar over the same non-blocking path.
- **No** wire epoch, **no** fragment return, **no** server-side reconciliation state. Server code is
  unchanged beyond handling the (normal) action name a non-blocking dispatch carries.

## Both backends + parity

TS twin (`src/{index,browser}.ts`) and .NET twin (`ViewModels.cs`) stay byte-aligned; the optional
bool follows the F2 `WhenWritingDefault` rule so it's absent-when-default on both. New parity
fixtures exercise: a non-blocking dispatch, coalesced rapid fire, out-of-order response discard.
`agent-skill.md` gains a note on `blocking:false` semantics (then byte-copy to `.NET AgentSkill.md`;
the parity gate diffs both) — an agent driving the wire should know a dispatch can be non-blocking.

## Test apps + human verification (the final, in-question deliverable)

Ashley verifies this in a real browser (it's a concurrency/timing feature — tests prove the logic,
but the *feel* and the race coverage need a human). Build **purpose-designed demo apps** that force
every edge, each shipped with a **step-by-step "trigger X, then Y, expect Z" script** so coverage is
explicit and Ashley knows exactly what she's confirming:

1. **Selection → live action bar** (the PBMInvoices shape): a table of rows with checkboxes; an
   action bar whose enabled/disabled buttons are computed server-side from the selection. Script
   covers: rapid multi-toggle (no revert, no dropped clicks), the bar updating after coalesced
   refresh, a click that races a refresh into invalidity (Stage 1: server rejection message).
2. **Poll + user action coexistence** (the contention fix): a view with an active poll (e.g. a
   running-job status) AND user controls. Script covers: clicking a control *during* a poll
   round-trip and confirming it is NOT dropped (the today-vs-fixed contrast).
3. **Out-of-order / staleness**: an artificially delayed background response arriving after a newer
   one; confirm the stale one is discarded and the newer render stands.
4. (If Stage 2 built) **Intent drift**: force a button to change meaning between render and click;
   confirm the admission barrier holds/drops correctly and the drop is surfaced, not silent.

Serve the demos over the tailnet (`100.113.23.63:<port>`) per the standing "show a visual change"
directive; hand Ashley the `http://100.` URL + the scripts.

## Explicitly NOT doing (guardrails)

- No fragment/partial view trees on the wire (Stage-1 returns full trees).
- No wire-level epoch / no server-side reconciliation state.
- No client-side app logic — epoch/coalesce/admission are all generic framework mechanisms.
- No admission barrier in Stage 1 (conditional Stage 2 only).
- `blocking` defaults true — zero behavior change for existing apps until they opt in.

## Open items to pin in planning

- Exact placement of `blocking` (node vs `ActionEvent`) and whether `debounceMs` is per-node.
- Whether Stage 1 ships the admission barrier disabled-but-scaffolded or omits it entirely.
- Milestone/version: additive (`blocking` defaults true) → **minor** bump. Sequenced AFTER the
  in-flight v4.1 chart release (Phase 13) so that thread isn't stranded.
