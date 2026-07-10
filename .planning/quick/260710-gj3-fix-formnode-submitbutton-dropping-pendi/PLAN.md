---
quick_id: 260710-gj3
slug: fix-formnode-submitbutton-dropping-pendi
date: 2026-07-10
status: in-progress
---

# Fix: FormNode.submitButton drops pendingLabel / disabled / confirm

## Problem
`FormNode.submitButton` (browser renderer) renders the consumer's button and wires the
FORM submit event, but never replicates the standalone `ButtonNode` click behavior. So a
form-level submit button silently ignores **pendingLabel** (no text swap / no
`.vms-button--pending`), **disabled** (no class/attr/guard), and **confirm** (the v5.0.0
destructive-action guard). Types already promise the behavior (`index.d.ts` JSDoc) — the
impl lagged. Reported by @hilda (Hecate PR #82, inert-but-correct).

Verified in source: `viewmodel-shell/src/browser.ts:982-994` (submitButton branch) vs
`:1392-1421` (standalone `button()`).

## Approach — unify so the two paths can't diverge (the divergence IS the bug)
Factor a private `applyButtonBehavior(btn, node, dispatch)` on `BrowserAdapter` that:
- sets the full className (emphasis/tone/size/width/**disabled**), label, and `disabled` attr;
- returns a guarded `activate()` running **disabled → confirm → pendingLabel-swap → dispatch**
  (same order/semantics as today's `button()` click handler).

Then:
- `button()` uses it, attaching `activate` to the button's `click`.
- The `submitButton` branch uses it, attaching `activate` to the FORM's `submit` event
  (single dispatch point; keeps Enter-to-submit for text fields; no double-dispatch).

`submitOnEnter` (textarea chat-composer path) is deliberately untouched — it's a separate
affordance that dispatches directly and is not part of the reported bug.

## Scope / non-scope
- Client renderer only: `viewmodel-shell/src/browser.ts` + rebuild `dist/`.
- NO wire change, NO type change (`index.ts` / `ViewModels.cs` untouched).
- New vitest: submit button applies pendingLabel+class on submit; disabled blocks dispatch
  (attr+class); confirm-cancel suppresses dispatch+swap, confirm-accept proceeds.

## Release
npm-only PATCH `5.0.1` (.NET has no renderer). **In-question / rendering change** →
STOP before publish: commit code + CHANGELOG now; tailnet run-through page for Ashley's
eyes; publish only after visual sign-off.

## Gate (all green before commit)
`npx vitest run` · `npm run build && npm run check:core-globals` · `check:aa-contrast` ·
`check:theme-byte-identity` · `check:no-demo-style` · `bun run parity/run.ts` ·
`.NET: viewmodel-shell-dotnet/Tests + every demo/**/*.Tests.csproj`.
