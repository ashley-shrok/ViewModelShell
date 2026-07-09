# Reorder — the canonical way to reorder a list in ViewModel Shell

This demo is the **blessed pattern** for letting a user reorder items. It is
also a statement of what the framework deliberately does **not** do.

## The rule: no drag-and-drop

Pointer drag-and-drop is **rejected on principle**. The framework's whole
premise is that anything a person can do, an agent can do, and a keyboard-only
user can do. Dragging breaks all three: it is a mouse-gesture, an agent cannot
"drag," and it is famously hostile to keyboard and assistive tech. So reordering
is expressed as **discrete, named actions** instead — identical for a human
clicking, a keyboard user tabbing to a button, and an agent dispatching over the
wire.

## Two patterns, zero new framework code

Both patterns are composed entirely from primitives that already exist — a
button, a modal, and named actions. There is **no new node type** for
reordering.

### 1. Up / Down — reorder within a group

Each row carries an **Up** and a **Down** button whose action names encode the
row's id (`move-up-<id>` / `move-down-<id>`). The server swaps the item with its
nearest neighbour and returns the new order. The first row's Up and the last
row's Down are `disabled`.

> **The server clamps; `disabled` is only a hint.** `disabled` is a client-side
> rendering nicety — an agent (or a crafted request) can still dispatch
> `move-up-<firstItem>`. The server therefore treats an out-of-range move as a
> **no-op**, never an error. The parity fixture exercises exactly this
> (`up-first-clamp`, `up-single-clamp`).

### 2. Move… — relocate to another group

For the "move this into a different folder" case that drag would otherwise do,
each row has a **Move…** button (`move-open-<id>`) that opens a **modal**
listing the *other* groups. Picking one dispatches `move-to-<group>-<id>` and
the server relocates the item (appended to the end of the target group). The
modal's close (`dismissAction: move-close`) cancels.

> The modal carries a `dismissAction` and **no same-named footer Close button**
> — a modal must not have both (see the AGENTS.md "Critical gotchas").

## If drag-and-drop is ever revisited

It could only ever be added as **sugar on top of these same actions** — a
pointer gesture that ultimately fires the same `move-*` action names — so that
agents and keyboard users keep working through the action layer underneath.
Drag can never become the primary mechanism. Building the action-based reorder
now is the necessary foundation for any future drag layer.

## Files

- `AspNetCore/ReorderController.cs` — the .NET backend.
- `../Reorder-bun/server.ts` — the byte-identical TypeScript-backend twin.
- `../../parity/fixtures/reorder.json` — the cross-backend parity fixture that
  proves both backends produce identical responses for every step.

This demo is **backend-only** (driven by the parity harness and by agents over
the wire); it has no bespoke frontend — the universal client renders it.
