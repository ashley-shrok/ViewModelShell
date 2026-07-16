---
phase: 21-v5-2-lookup-field-lookup-lookup-multiple-the-live-query-lane
plan: 06
subsystem: renderer
tags: [lookup, lookup-multiple, chips, a11y, roving-tabindex, allowCustom, tags, browser, css]
requires:
  - "21-01 (FieldNode.selected/candidates/allowCustom)"
  - "21-03 (the lookup arm of field(); the isMulti seam; commit())"
  - "21-04 (the liveRegions 1400ms announce helper; the lookupOpenSnapshot pass)"
provides:
  - "the chips layer: role=list/listitem with real item-specific-labelled remove buttons"
  - "focusAfterChipRemoval() — the next -> previous -> input rule that never lands on <body>"
  - "roving tabindex across the chips (clamped, not wrapped)"
  - "two-step non-destructive Backspace, arm keyed by VALUE"
  - "the allowCustom commit path (picked and invented share ONE function)"
  - "the free-form tags composition, with no renderer special case"
  - ".vms-field__chip* CSS on the badge's private-tone + surface-knockout technique"
affects:
  - "21-07 (TUI degradation must handle the chip group)"
  - "21-08 (the verification page drives chips)"
  - "21-09 (owns the FINAL chip mix ratio; this plan's 12% is provisional but hand-verified)"
tech-stack:
  added: []
  patterns:
    - "roving tabindex for a non-text-editable set, ALONGSIDE aria-activedescendant for the text-editable input — one control, two focus models, for two different reasons"
    - "optimistic chip DOM + authoritative server re-render (the model every other input here uses)"
    - "preserving DOM-local state keyed by VALUE, not position, when a mismatch would confirm a destructive act against the wrong item"
key-files:
  created:
    - viewmodel-shell/test/lookup-multiple.test.ts
  modified:
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
decisions:
  - "OPEN-3 CONFIRMED by construction: no __isNew__ marker and no create-option action. Picked-vs-invented is server-decidable; D3's explicitness is carried by allowCustom being a DECLARED axis on the node."
  - "The two-step Backspace's arm is preserved across re-render keyed by VALUE, not as a boolean. A positional flag would confirm the second press against a DIFFERENT item than the one announced — reintroducing the exact wrong-record deletion the two-step exists to prevent."
  - "Chips traverse CLAMPED, not wrapped. The popup listbox wraps (§7 #16) because it is a closed loop being cycled; a chip row is a line being walked."
  - "Chip tone is --vms-text at a 12% mix, NOT the badge's --vms-text-muted at 16%: a chip carries CONTENT (a name), not muted status."
  - "allowCustom is honored on single-select too, not just multi. It is a node-level declared axis; leaving the single path silently dead would be a gap, and LOOK-04 is wholly owned by this plan."
metrics:
  duration: ~30 min
  tasks: 3
  commits: 4
  files: 3
  tests_added: 77
  completed: 2026-07-16
---

# Phase 21 Plan 06: lookup-multiple — the chips layer + allowCustom Summary

`lookup-multiple` ships immediately behind single (D2): chips labelled from the node, built
conservatively to design §7 items 23-31 — which are **extrapolation from a publicly failed design**,
not an APG pattern — plus the `allowCustom` axis that makes a free-form tags input fall out of the
existing renderer with no special case.

## What landed

| Task | Commit | What |
|---|---|---|
| 1 (RED) | `a1374d8` | 49 tests against the unimplemented seam — **38 failed** |
| 1 (GREEN) | `a57eef0` | The chips layer: role=list/listitem, item-specific removes, roving tabindex, the focus rule, two-step Backspace, multi-listbox semantics |
| 2 | `23e2259` | Announcements with the running count + the allowCustom path (+28 tests, mutation-verified) |
| 3 | `ad4a5c9` | `.vms-field__chip*` CSS — private-tone + surface knockout, without `nowrap` |

**Tests:** 719 baseline → **796 passing, 1 skipped** (+77).

## Verification

- `npx tsc --noEmit` — clean.
- `npx vitest run` — **796 passed | 1 skipped**, 57 files.
- `npm run check:core-globals` — passes (all DOM work in `browser.ts`; core untouched).
- `node scripts/check-theme-byte-identity.mjs` — passes.
- `npm run check:aa-contrast` — passes (all 13 existing pairs).
- **The select branch is untouched.** `git diff` over the whole plan matches no `select-multiple` /
  `selectedSet` / `sel.selectedOptions` code line — the only textual hit is a new *comment* stating
  that `select-multiple` remains the enumerable-set control. That split is an a11y requirement (the
  APG combobox has "tested poorly with users for more than two decades"); the lookup does not
  swallow it.

## How the tests were proven able to FAIL

**Task 1 had a genuine RED:** 38 of 49 failed against the unimplemented seam. The 11 that passed
were single-select control assertions (no chip group, no `aria-multiselectable`, Backspace never
intercepted) — they must stay green, and did.

**Task 2 had NO true RED, and that is recorded rather than papered over.** Its implementation landed
in the Task 1 commit because it is structurally inseparable: `addValue()` cannot exist without its
announce, and `commitCustom()` is called from the Enter handler Task 1 rewired. Rather than claim an
unearned green, the six load-bearing assertions were **mutation-verified** against a per-file
snapshot, restored byte-identical (`diff` → IDENTICAL):

| Mutation | Result |
|---|---|
| drop the count from the ADD announce | 4 failed |
| drop the count from the REMOVE announce | 1 failed |
| `aria-label` → bare `"Remove"` (the GOV.UK failure) | 9 failed |
| `focusAfterChipRemoval` no-ops (focus falls to `<body>`) | 7 failed |
| the `allowCustom` gate removed | 2 failed |
| the commit-path dedupe removed | 4 failed |

## The three that killed GOV.UK — where each one lives

`alphagov/accessible-autocomplete-multiselect` is **retired as inaccessible**; the UK government
shipped this exact control and pulled it. Each failure has a named home and a named test:

- **§7 #25 — unique, item-specific remove names.** `appendChip()` sets `aria-label="Remove ${label}"`
  (per D5 a label-less item names itself by value, so it is never unnamed). Asserted: two chips
  produce two *different* names; the name is never bare `"Remove"`/`"x"`/`"×"`.
- **§7 #27 — add AND remove announced WITH the running count.** Both go through 21-04's existing
  1400ms alternating helper — no second mechanism. Asserted on the string, and the alternation still
  holds (two identical announcements land in different regions).
- **§7 #29 — the focus rule.** `focusAfterChipRemoval()` is a single named helper, deliberately: it
  is the highest-risk item here and has **no analog anywhere in this codebase** (nothing else manages
  focus across a *set*; the `<details>` restore is by id, not set position). All three arms asserted
  (middle → next, last → previous, only → the input), each also asserting `!== document.body`, plus a
  drain-every-chip loop.

## Decision records

### OPEN-3 — confirmed: server-decidable is enough, no wire marker

No `__isNew__`, no distinct `create-option` action. react-select needs a marker because it is
client-only and has no server to ask; we have a server, and it produced every candidate it ever
offered. D3's demand for explicitness is satisfied by `allowCustom` being a **declared axis on the
node** — the app declares the *act* — not by a per-value flag. The bind stays uniformly `string[]`
whether entries were picked or invented, so MUI's `Array<Value | string>` union cannot arise.

### The arm is keyed by VALUE, not by position

The single non-obvious call in this plan. Preserving an armed *flag* across re-render would confirm
the user's second Backspace against whatever the server happened to put last — **a different item
than the one announced**. That is precisely the silent, unannounced deletion of the wrong record
that §7 #31's two-step exists to prevent, reintroduced by the preservation pass meant to make it
work. Keyed by value, a changed last chip simply fails to match and the arm drops (fail-safe: the
user re-arms). Asserted by a named test.

## Deviations from Plan

**1. [Rule 2 — missing critical functionality] Add/remove must mutate the chip DOM optimistically.**
- **Found during:** Task 1. **The plan assumes a bind write is visible; it is not.** `selected` is
  server-owned VIEW and a `writeBind` does not re-render, so as specified the user clicks
  *"Remove Sally Omer"* and the chip **just sits there**, and picking a candidate shows **nothing at
  all**. The control would be visibly dead on both of its two operations. The focus-after-removal
  rule is also unimplementable without it (there is no "next chip" to move to if nothing was removed).
- **Fix:** the chip DOM changes immediately; the bind round-trips; **the server's next render is
  authoritative** (chips rebuild from `selected`, so a server that rejects a removal puts the chip
  back). This is the model every other input in the file already uses — a text input's DOM diverges
  from the last server render while you type. Commented at both sites.
- **The D1 question this raises, answered explicitly at the call site:** an optimistically-added chip
  is labelled from the item the user *just clicked*. That is **not** the trap. The trap is
  *resolving an already-selected id's label by searching `candidates`*, which fails precisely when it
  matters (cold-start load; a filtered list excluding the selection) because there is nothing to
  find. Nothing here searches: the label is the clicked item's own, used once, immediately, and
  replaced by the server's authoritative `selected` on the next render. The chip **render** path
  reads `n.selected` and only `n.selected`, and the anti-trap test holds.
- **Commit:** `a57eef0`.

**2. [Rule 2] `roving` + `armed` join `lookupOpenSnapshot` — 21-04's hand-forward, honored.**
- 21-04's executor warned: *"21-06's chips are DOM-local too."* They are. Chips themselves render
  from `selected` (fine), but the **roving position** and the **armed chip** both die in `render()`'s
  `innerHTML` wipe, and the 300ms search cadence lands a re-render mid-interaction routinely.
- Both joined the **existing** snapshot rather than growing a fourth mechanism — exactly as 21-04's
  flag 3 asked. Four named tests cover it.
- **Weighed against 21-03's "preserve open, not active" rule and found genuinely different:** not
  preserving `active` is a *positive* a11y requirement (auto-highlight resurrects the §7 #14 NVDA
  failure). The roving position is not an announced highlight — it is only which button is in the tab
  sequence — and it must agree with the focus `render()` already restores by id.
- **Commit:** `a57eef0`.

**3. [Scope] `allowCustom` implemented for single-select too.** The plan's Task 2 describes only the
multi path, but `allowCustom` is a node-level declared axis and LOOK-04 is wholly owned by this plan;
leaving single's `allowCustom` silently dead would be a gap of exactly the kind the framework's own
"nothing important fails quietly" principle forbids. One test covers it.

**4. [Test infra] The house `CSS.escape` jsdom shim was adopted.** jsdom ships no `CSS`; `render()`'s
focus restore uses `CSS.escape`. This is the first suite to re-render **while a chip button holds
focus**, so it is the first to hit that path. Copied verbatim from `test/browser-scroll.test.ts` /
`test/follow-tail.test.ts` rather than invented.

## 🚩 Flags — where the plan turned out wrong

**1. 🚨 The plan's Task 2 ACTION and its own ACCEPTANCE CRITERION contradict each other.** The action
says: *"Comment this, because react-select's `__isNew__` is the obvious precedent and the next person
will reach for it."* The criterion says: `grep -c "__isNew__\|create-option" src/browser.ts` **== 0**.
Writing the comment the action demands makes the criterion fail — the only textual hits in the file
are **the comment forbidding the very thing**. I kept the comment (the action explicitly demands it,
and it is genuinely valuable) and satisfied the criterion's *intent* using the house precedent:
`check-core-platform-globals.mjs` **strips comments and string literals before matching** for exactly
this reason, and its own docs call out that a doc comment naming a forbidden token must not
false-fail CI. Comment-stripped: **0 code references.** If a future gate scripts this grep literally,
it needs the same strip.

**2. The plan (and every plan before it) does not account for "a client-side bind write does not
re-render."** This is deviation 1 and it is worth stating as a *pattern*, not a one-off: 21-04's
executor observed that the search cadence *"turns previously-invisible DOM-local state into a bug"*
and hit it twice. This is the mirror image — **server-owned VIEW state that the client must
provisionally own between round-trips**. Any future plan whose control mutates a `selected`-style
server-owned array (a reorder, a bulk clear) will hit it identically. The wire has no
`removeAction`/`addAction`, and it does not need one; the optimistic-DOM + authoritative-re-render
model covers it.

**3. §7 #31's two-step is under-specified in one place the design could not have known.** It says
*"first press highlights the last chip and announces"* but says nothing about what happens if a
re-render lands between the two presses. Under this arm's cadence that is a routine occurrence, not a
corner case, and the naive answer (preserve an armed boolean) is **actively dangerous** — see the
decision record. Recommend the design doc absorb the value-keying as the rule.

**4. The plan's Task 3 read_first cites `.vms-field__option`'s §7 #33 delimiting as this plan's work;
21-03/21-04 already did it** (`overflow-wrap: anywhere` + a delimiting `border-bottom` +
`:last-child` reset, with the GOV.UK 12x quote already in the comment). No action needed; noted so
21-09 does not look for it here.

## Provisional chip mix ratio — for 21-09's AA gate task

**`--_chip-tone: var(--vms-text)` at `color-mix(in srgb, var(--_chip-tone) 12%, var(--vms-surface))`.**

Deliberately **not** the badge's `--vms-text-muted` at 16%: a chip carries **content** (a person's
name), not muted status, and the badge's ratio was tuned for a small badge on a **page** surface. The
chip's background is **opaque**, so the field's input backdrop never enters the contrast pair — the
pair is self-contained (`--vms-text` on a 12% tint of itself in `--vms-surface`).

Hand-computed across the shipped default + all 12 themes (the fixed 13-pair `check:aa-contrast` gate
does **not** auto-cover this new pair):

| Group | Contrast | AA (4.5:1) |
|---|---|---|
| default + all 6 `light-*` | **13.60:1** | pass |
| all 6 `dark-*` | **10.63:1** | pass |

**Worst pair 10.63:1; zero failures.** 21-09 inherits **headroom, not a corner** — the ratio is
conservative, so the tint can be deepened for visual presence and still clear AA comfortably.

## Threat Flags

None. No new network surface, auth path, file access, or schema change.

- **T-21-19** (chip label from `candidates`) — mitigated; the multi anti-trap test asserts chips keep
  their labels while `candidates` excludes them, and with no `candidates` field at all.
- **T-21-20** (XSS via a server label) — mitigated; labels via `textContent`, `aria-label` via
  `setAttribute` (an attribute value, never parsed as markup). No `innerHTML` in the chip path.
- **T-21-21** (AT user cannot perceive the selection — the GOV.UK retirement) — mitigated; §7
  #25/#27/#29 all implemented AND tested AND mutation-verified.
- **T-21-22** (single-press Backspace destroying a chip) — mitigated; two-step, arm keyed by value.
- **T-21-23** (heterogeneous `Value | string`) — mitigated; asserted the bind is uniformly strings
  across picked *and* invented entries, and that no entry is an object.

## Known Stubs

None. `lookup-multiple` is now a complete control. TUI degradation for the chip group is 21-07's;
the verification page is 21-08's; the final chip mix ratio is 21-09's.

## Self-Check: PASSED

- `viewmodel-shell/src/browser.ts` — FOUND (`Remove ${label}`, `focusAfterChipRemoval`,
  `aria-multiselectable`, `commitCustom`, `addValue`)
- `viewmodel-shell/styles/default.css` — FOUND (`vms-field__chip`, `--_chip-tone`, no `nowrap` on the
  chip, `width: fit-content`)
- `viewmodel-shell/test/lookup-multiple.test.ts` — FOUND (`activeElement`, 77 tests)
- commit `a1374d8` — FOUND
- commit `a57eef0` — FOUND
- commit `23e2259` — FOUND
- commit `ad4a5c9` — FOUND
