# Non-Blocking Actions — combined human-verification script

This is the **single combined verification script** for NBA-08 (v4.1 Non-Blocking
Actions milestone). It covers all three purpose-built demo apps built in Phase 16:

| Demo | Directory | Port | Proves |
|---|---|---|---|
| Selection → Live Action Bar | [`NonBlockingActionBar-bun`](./NonBlockingActionBar-bun/) | `3008` | NBA-06 (checkbox optimistic-check + server-recomputed action bar) + `shellRejection` re-validation |
| Poll + User Coexistence | [`NonBlockingPoll-bun`](./NonBlockingPoll-bun/) | `3009` | NBA-05 (poll folded into the non-blocking lane — never contends with a blocking user action) |
| Out-of-Order Staleness | [`NonBlockingStaleness-bun`](./NonBlockingStaleness-bun/) | `3010` | NBA-03 (client-side sequence counter discards a stale/out-of-order response) |

None of this behavior is (or can be) asserted by vitest — it is inherently about
concurrency and timing as observed by a human clicking a real browser against a
real network round trip. This script exists so "it works" means something
precise and repeatable, for the operator today and for any future re-verifier.

---

## Run all three demos

Each demo is an independent single-process Bun app (`Bun.serve` serving both the
Vite-built client and its own wire API — the `Tasks-fullstack-bun` pattern). They
run on three different ports simultaneously with no conflicts. From the repo
root, in three separate terminals (or three backgrounded processes):

```bash
cd demo/NonBlockingActionBar-bun && bun install && bun run serve   # http://localhost:3008
```
```bash
cd demo/NonBlockingPoll-bun      && bun install && bun run serve   # http://localhost:3009
```
```bash
cd demo/NonBlockingStaleness-bun && bun install && bun run serve   # http://localhost:3010
```

`bun run serve` = `vite build && bun run server.ts`. Each app's default port is
baked into its `server.ts` (`Number(process.env.PORT ?? "300X")`) — override with
`PORT=<n> bun run serve` if a port is taken by something else on the box.

**Tailnet access — no extra configuration needed.** `Bun.serve({ port })` binds
`hostname: "0.0.0.0"` by default, so each app is already listening on every
interface, including the tailnet one. Open each app from any tailnet device at:

- `http://100.113.23.63:3008/` — Selection → Live Action Bar
- `http://100.113.23.63:3009/` — Poll + User Coexistence
- `http://100.113.23.63:3010/` — Out-of-Order Staleness

(Loopback `http://localhost:300X/` works identically if verifying from the same
box the servers run on.)

---

## Scenario 1 — Selection → Live Action Bar (`:3008`)

1. Open `http://100.113.23.63:3008/`. Confirm the invoice table renders 6 rows:
   3 `Pending` (Acme Supply Co., Northwind Traders, Contoso Logistics), 1
   `Locked` (Fabrikam Freight), 1 `Approved` (Globex Distribution), 1
   `Rejected` (Initech Materials).
2. Check two of the three **pending** rows' checkboxes in quick succession
   (e.g. Acme then Northwind, within a second of each other).
   **Expect:** neither checkbox visually reverts/unchecks at any point, and the
   "Approve Selected" / "Reject Selected" buttons become enabled within about a
   second of the second click (each toggle fires an artificially-delayed
   750ms `recompute-<id>` round trip that recomputes the action bar's
   enabled/disabled state server-side).
3. Click "Clear Selection" (confirm the two boxes uncheck and the action bar
   buttons disable again). Then check the **locked** row (Fabrikam Freight)
   **together with** one pending row, and **immediately** — within well under a
   second, deliberately *before* the action bar has visibly caught up to the
   new selection — click "Approve Selected".
   **Expect:** a visible rejection message naming the locked row specifically
   (e.g. `"Fabrikam Freight" is Locked, not Pending — deselect it before
   approving.`) appears above the table. **Not** a silent success (Fabrikam's
   status must NOT change to Approved) and **not** a crash/blank page.
4. Click "Reset Demo" to restore the original 6-row seed for a repeat run.

## Scenario 2 — Poll + User Coexistence (`:3009`)

1. Open `http://100.113.23.63:3009/`. Confirm the stat bar shows "Poll ticks
   (auto, ~1.2s cadence)" and "Button clicks (blocking, instant)", both
   starting at `0`.
   **Expect:** "Poll ticks" increments on its own within a couple of seconds,
   with no action needed from you (the client auto-dispatches a `poll` action
   every ~1.2s; the server artificially delays each poll round trip ~1.8s, so
   a poll is essentially always in flight).
2. Click "Click me — increments instantly" five times in quick succession.
   **Expect:** "Button clicks" becomes `5` immediately, with no perceptible
   delay waiting on the in-flight poll (the click is a plain blocking action
   and lands independently of the poll's round trip).
3. Keep watching the page for another 5–10 seconds without clicking anything.
   **Expect:** "Poll ticks" keeps incrementing on its own cadence, unaffected
   by the clicks you just made — it neither stalled nor jumped.
4. For the record (nothing to click): before Phase 14/15 of this project, a
   single global dispatch mutex meant a poll in flight could have silently
   swallowed a click fired during its round trip (or vice versa). That failure
   mode no longer exists in this codebase to literally reproduce side-by-side
   — steps 2–3 above are the direct confirmation of its absence, not a toggle
   between an old and a new behavior.
5. Click "Reset Demo" to zero both counters for a repeat run.

## Scenario 3 — Out-of-Order Staleness (`:3010`)

1. Open `http://100.113.23.63:3010/`. Confirm the large value line reads
   `(no update yet)` and "last applied by: initial".
2. Click "① Start slow background check (3s)" (a non-blocking action that
   will apply its result ~3 seconds later).
3. Within about a second of step 2 — no special timing precision needed —
   click "② Set value instantly (fast)" (a plain blocking action, ~150ms).
   **Expect:** the displayed value becomes `user click result (fast, ~150ms)`
   and "last applied by: user" almost immediately after this click.
4. **Without clicking anything else**, wait at least 4 more seconds (long
   enough for the slow ~3s background response from step 2 to have arrived
   and been processed).
   **Expect:** the displayed value remains `user click result (fast, ~150ms)`
   / "last applied by: user" — it must **not** revert to
   `background result (slow, 3s delay)` / "last applied by: background". The
   late-arriving, now-stale response is discarded rather than clobbering the
   newer render.
5. Click "Reset Demo" to restore `(no update yet)` for a repeat run.

---

## Sign-off

Operator: record the date and outcome below (pass, or the specific scenario/step
where an expected outcome did not hold and what was observed instead).

- **Date:**
- **Outcome:**
