---
quick_id: 260710-gj3
slug: fix-formnode-submitbutton-dropping-pendi
date: 2026-07-10
status: complete
reason: shipped npm 5.0.1 after Ashley visual sign-off
commit: a0d4957
---

# SUMMARY — FormNode.submitButton honors pendingLabel / disabled / confirm

## What shipped (committed a0d4957, on main, NOT pushed)
- `viewmodel-shell/src/browser.ts`: factored `BrowserAdapter.applyButtonBehavior(btn, node, dispatch)`
  — sets className (incl. `disabled`) + label + disabled attr, returns a guarded `activate()`
  running disabled → confirm → pendingLabel-swap → dispatch. Both `button()` and the FormNode
  `submitButton` branch now use it, so the two can't diverge again (the divergence WAS the bug).
  Submit path fires `activate()` on the form's submit event (single dispatch point; Enter-to-submit
  preserved). `submitOnEnter` (textarea) path left untouched (separate affordance).
- `viewmodel-shell/test/form-submit-button-behavior.test.ts`: 6 tests — appearance parity,
  pendingLabel swap on submit, disabled guard (attr+class, no dispatch, no swap), confirm
  accept (dispatch + swap) / cancel (suppress both).

## Green-tree gate — ALL green
vitest 566 (+6) · build · check:core-globals · check:aa-contrast 13/13 · check:theme-byte-identity
· check:no-demo-style · parity · .NET 109 + demos (28/39/33/52/29) = 181.

## Scope
Client-renderer only. NO wire/type change (index.ts / ViewModels.cs untouched). Verified in the
rebuilt dist (`applyButtonBehavior` present).

## Remaining (post-sign-off release leg)
Rendering change ("in question") → held before publish. After Ashley eyeballs the tailnet
run-through page (submit-button label flip + disabled + confirm, light+dark):
1. bump npm `5.0.0 → 5.0.1` (package.json + package-lock: 2 self-version spots only) — npm-only patch, .NET unchanged.
2. CHANGELOG entry (release-gated — rides with the bump).
3. `npm publish` (auth sync from .env, never `npm login`); confirm registry.
4. tag `v5.0.1`, advance `main`, verify `git merge-base --is-ancestor v5.0.1 main`.
5. announce `#vms-changelog` (@vicky) + ping Hilda's room (Hecate bumps + re-runs PR #82 as live test).

Memo: `~/.claude/identities/vicky/memos/form-submitbutton-pendinglabel-disabled-confirm/`.
