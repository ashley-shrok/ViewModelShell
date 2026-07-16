# 21-14 — D2a: single's selection is a chip; `inp.value` is the query, unconditionally

**Status:** complete. Full green-tree gate passed. Page re-served on the tailnet.
**Commits:** `95dc831` (renderer + CSS + tests), `d3992f6` (the page).

## The decision, and why it is not cosmetic

`lookup` and `lookup-multiple` now render selections **identically** — chip(s)
**outside** the input, from **one implementation**. The only difference is arity:
**single REPLACES on pick, multi APPENDS.** The input, in both modes, holds nothing
but the query.

What the operator hit at the live page: with the input *being* the pill (the SLDS
treatment shipped in 21-13), **there is nowhere to click to type** — the pill is the
entire input, so clicking in just appends to "Sally Omer".

> *"maybe we should just make the pill separate from the input like the tag setup,
> even if it is a little awkward. so you always have a place to type. but instead of
> adding a pill like with tags, it replaces."*

## ⭐ The prize — the arbitration is deleted, not preserved

The headline bug (`ownerQuery: ""` beating the label ⇒ placeholder instead of "Sally
Omer") existed because **the input answered two questions at once** — *is this the
selection or the query?* — arbitrated by a fragile test that also had to not break
OPEN-6's empty-query dispatch. Two correct decisions colliding in one field.

21-11 patched it by *splitting* the two tests (display keyed on non-empty, dispatch on
non-null). Correct, and still a patch: the arbitration remained, so the next reader
could still get it wrong.

**D2a dissolves the root cause.** The renderer now reads, in full:

```ts
const query = n.searchBind != null ? this.readBind(n.searchBind) : undefined;
inp.value = query != null ? String(query) : "";
```

No precedence. No `!= null` vs truthiness split. No `labelShown` flag. **There is no
question left to arbitrate, so there is no rule left to get wrong.** The class of bug
is gone, not fixed.

Everything the flag propped up went with it, and each deletion is commented at its
site so nobody restores it as "missing polish":

| Deleted | Why it existed | Why it cannot recur |
|---|---|---|
| the display fallback (`queryText !== "" ? queryText : selectedLabel`) | the box had to show the label somehow | the label is in a chip |
| `labelShown` + `setLabelShown()` | tracked "is the box a label or a query?" | the box is only ever a query |
| `search()`'s `labelShown ? "" : inp.value` flush guard | stopped "Sally Omer" being sent as a search term | the box cannot hold a label |
| the input listener's `setLabelShown(false)` | dropped the pill on the first keystroke | typing cannot change what the box means |
| `.vms-field--lookup-selected` + `.vms-field__clear` (CSS + DOM) | the pill treatment + its inline ✕ | the chip's own ✕ does that job, both modes, one path |

## What landed (Task 1 — the renderer)

- **`inp.value` = the query, unconditionally, both modes.** OPEN-6 is untouched and now
  lives only where it always belonged (the dispatch question, in `search()` / the Enter
  handler). An empty query still dispatches — it just no longer has a display rule to
  fight with.
- **Single renders `selected[0]` as a chip via the SAME `appendChip` / `removeChipAt` /
  focus / announce path multi uses.** Reused, not forked — per the banked
  provide-your-own-X lesson, a parallel implementation is where behavior silently
  drops. The a11y contract came with it *for free*: `role=list`/`listitem` + real
  `<button>`, item-specific `aria-label="Remove Sally Omer"` (the exact failure that
  retired GOV.UK's multiselect), and the next→previous→**input** focus rule — of which
  single exercises the **last fallback**, structurally, because the chain was written as
  a chain rather than as conditionals.
- **`addValue()` is the ONE place the two modes differ** (replace vs append). Single
  writes a **bare string** id, never `[]` — the wire is `string` for `lookup` and
  `string[]` for multi, and an array in a scalar slot is a cross-backend deserialize
  failure, not a style question.
- **`selected.forEach(appendChip)` renders both modes with no arity branch** — `selected`
  is always an array (§4), so single is simply the array that is never longer than one.
  Nothing clamps it: two chips on a single-select is a *server* bug and should look like
  one (second-guessing the server's answer is D12's instinct, if not its letter).
- **D14 untouched** — the two-step Backspace stays multi-only, armed by value.

## Deviations from the brief (flagged, per instruction)

Three places the brief was silent or turned out to imply more than it said:

1. **Escape stage two no longer clears single's selection** — it clears the **query
   only, in both modes**. The brief didn't mention Escape, but its old rationale had
   *both premises falsified* by D2a: "this is the ONLY keyboard path to un-set a
   single-select — deleting the input text does NOT clear the selection, because the
   text is the LABEL." The text is never the label now, and the chip's ✕ is a real
   focusable button in the tab sequence. Keeping it would also have required a **second
   chip-removal path** beside `removeChipAt()` — the exact fork D2a forbids. The two
   modes now agree.
2. **D6's type tag moved from the input to the chip** (`data-vms-selected-type` →
   `data-vms-type`). It tags *the reference*, and the reference is now the chip; leaving
   it on the input would have left a type tag on a box holding nothing but the query.
   Bonus: multi gets per-chip type exposure it never had — which is D6's own motivating
   case (a mixed user/team set). Verified unreferenced outside tests before moving
   (not in `index.ts`, `agent-skill.md`, or `CHANGELOG.md`).
3. **Single drops the running count from its announcements.** §7 item 27's count exists
   to convey *the size of an accumulating set*; single has no set. "Sally Omer selected.
   **1 items selected.**" is ungrammatical *and* implies an additive control the user
   does not have — which is precisely D2a's recorded "watch for". Single says
   `"{label} selected."` / `"{label} removed. Selection cleared."` (the 21-13 clear ✕'s
   wording, kept verbatim). **Multi keeps item 27 byte-for-byte.**

## Task 2 — the page

§1's proof is now the **anti-trap**, and it is finally performable there. Its history is
the lesson: it lived in §1 originally and was *unperformable* (searching replaced the
on-screen selection with the query, so there was nothing to watch survive — you took the
round trip on faith and read an id off a debug line); 21-13 moved it to §3 (multi), the
only field where a selection and a candidate list could then coexist on screen; D2a moves
single's selection out into a chip, so **both are on screen here now**.

Driven over the wire to confirm, not assumed:

```
THE CHIP (selected): ['Sally Omer']      bind still holds: 'u-401'
the query: 'Nakamura'                    candidates: 8 -> [Naomi Nakamura, ... ]
ANTI-TRAP: PASS — chip unmoved, and Sally is NOT in the candidate list
```

§3 keeps the multi anti-trap: same property at a real set, and it is where
**append-vs-replace** becomes visible as the one difference. Read §1 then §3 back to
back — same chips, same trap, different arity. §6's theme note drops the pill: there is
only **one** colour pair to check now.

## Task 3 — verification

**AA contrast — confirmed, not assumed.** The fixed 13-pair `check:aa-contrast` gate does
**not** cover the chip (it is a `color-mix`, not a bare `--vms-*` pair), so it was
re-measured across the shipped default + all 12 themes. Reusing multi's chip means
reusing its literal pair, and the numbers come out **exactly** as 21-13 recorded:

| | chip text on chip fill | ring on fill | bar |
|---|---|---|---|
| default + light-* | **13.60:1** | 13.60:1 | 4.5 / 3.0 |
| dark-* (worst) | **10.63:1** | 10.63:1 | 4.5 / 3.0 |

Single-select adds **no new fg/bg pair** — it invents no token, so there is nothing new
to measure. (21-13's separate pill measurement is gone with the pill.)

**Green-tree gate — no exceptions:**

| Leg | Result |
|---|---|
| `npx vitest run` | **824 passed**, 1 skipped (baseline 820) |
| `bun run parity/run.ts` | ✓ passed (skill twins byte-identical) |
| `npm run check:core-globals` | ✓ zero platform globals in core |
| `npm run check:aa-contrast` | ✓ 13/13 pairs, default + 12 themes |
| `dotnet test viewmodel-shell-dotnet/Tests` | ✓ **136** |
| Tasks / ContactManager / RetroBoard / ExpenseTracker / HelpDesk `.Tests` | ✓ 28 / 39 / 33 / 29 / 52 |

**Test changes.** The suites now assert the invariant that *replaced* the bug — **the box
never shows the label, in either mode** — plus single-renders-exactly-one-chip,
picking-REPLACES, and the shared chip a11y at one chip. Three assertions were
**deliberately inverted**, and each says at its site why, so a future reader does not
restore them on instinct:

- *"single-select `lookup` renders NO chip group at all (SLDS: no pill element exists)"* → it renders the same one.
- *"STAGE TWO: clears — the only keyboard path to un-set a lookup"* → clears the query, not the selection.
- *"the empty query dispatches EVEN THOUGH the display falls back to the label"* → there is no fallback to be "even though" about.

## Wire

**Zero wire change.** Renderer + CSS only; `selected` already carried everything needed.
Nothing here touches `blocking`.

## The page

**http://100.113.23.63:3012/** — served backgrounded (PID 1867177), bundle
`index-CKY9Grb8.js`. Framework `dist` rebuilt **before** the Vite build; the old server
killed **by PID** (1770147, verified gone with `kill -0` before rebinding — not
`pkill -f`, which has silently failed to rebind twice); the old bundle
`index-D-LjXsNU.js` now **404s** and the new one **200s**.

## One thing worth knowing

`git status` at session start showed `M viewmodel-shell/styles/default.css`. After my
change the working tree is byte-identical to `HEAD` everywhere outside the block I
deliberately deleted, and HEAD's pill block matched what I read in the working tree — so
no operator edit is detectably lost, and the likeliest explanation is a
trailing-newline normalization. Flagging it rather than staying quiet, because I could
not fully account for it.
