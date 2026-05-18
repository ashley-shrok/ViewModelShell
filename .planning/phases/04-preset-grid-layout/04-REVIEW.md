---
phase: 04-preset-grid-layout
reviewed: 2026-05-17T00:00:00Z
depth: standard
files_reviewed: 8
files_reviewed_list:
  - AGENTS.md
  - demo/FeatureProbe-bun/handler.ts
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - viewmodel-shell-dotnet/ViewModels.cs
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/styles/default.css
  - viewmodel-shell/test/theme-modifiers.test.ts
findings:
  critical: 0
  warning: 0
  info: 3
  total: 3
status: clean
---

# Phase 4: Code Review Report

**Reviewed:** 2026-05-17T00:00:00Z
**Depth:** standard
**Files Reviewed:** 8
**Status:** clean

## Summary

Reviewed the Phase 4 "Preset-Grid Layout" change set at standard depth: the additive `layout?: "stack" | "split" | "cards"` field on `PageNode`/`SectionNode` (TS + .NET), the renderer modifier-class emission, two pure-CSS layout presets, the FeatureProbe parity-fixture extension, and the AGENTS.md doc rows. Focus was on the diff range `1213f69..HEAD`.

The implementation is correct and adheres to every Phase 4 invariant. No bugs, no security issues. Specifically verified:

1. **Byte-identical guarantee (omitted/`"stack"`) — HELD.** The renderer guard `n.layout === "split" || n.layout === "cards"` emits no modifier for omitted/`"stack"` (browser.ts:196-197, 210-211). Test `theme-modifiers.test.ts` asserts `className === "vms-page"` / `"vms-section"` exactly for both omitted and `"stack"`. On the .NET side, `Program.cs` sets `DefaultIgnoreCondition = WhenWritingNull`, so `Layout = null` is omitted from the wire, matching TypeScript's `undefined` omission — and `parity/normalize.ts` drops null fields so "missing" and "null" compare equal across backends.

2. **Class-injection guard — HELD.** `n.layout` is never interpolated raw into a class string. It is interpolated only inside the `split || cards` branch, so only the two whitelisted literals can ever reach `` vms-page--${n.layout} ``. The closed two-literal guard is the exact pattern mandated by the phase context and mirrors the existing `density === "compact"` idiom.

3. **Override seam — HELD.** `default.css` adds exactly one `:root` variable, `--vms-card-min: 16rem` (the documented additive seam, D-05). No theme files were added or modified; existing seam variables (`--vms-space-lg`, `--vms-space-sm`) are reused, not redeclared.

4. **Zero `@media` / `container-type` — HELD.** Both presets are intrinsic grid (`repeat(auto-fit, minmax(...))`). No media or container queries introduced. The split-grid gap math is internally consistent: `.vms-page` gap is `--vms-space-lg` and `.vms-page--split` subtracts `--vms-space-lg`; `.vms-section` gap is `--vms-space-sm` and `.vms-section--split` subtracts `--vms-space-sm`.

5. **No version bump.** No package manifest changes in scope; the additive optional field is non-breaking on both wire and API surface.

6. **Parity coverage — VERIFIED.** `parity/backends.json` runs the `feature-probe` fixture against `dotnet-probe`, `bun-probe`, and `node-probe`, and the TS/C# `buildVm` changes emit the structurally identical node tree (`page{density:"compact",layout:"cards"}` → `section{variant:"card",layout:"split"}`). JSON key-order differences between the C# record serializer and the TS object literal are normalized away by the key-set-based `diff()` in `parity/normalize.ts`, consistent with every existing backend.

All findings below are informational only — no action required for correctness, security, or the phase invariants.

## Info

### IN-01: `compact` + `split`/`cards` interaction is correct but undocumented

**File:** `viewmodel-shell/styles/default.css:113-152`
**Issue:** `.vms-page--compact` remaps `--vms-space-lg` to `1rem`, and `.vms-page--split` consumes `--vms-space-lg` inside its `calc(50% - var(--vms-space-lg))` track minimum. When a page is both `compact` and `split` (exactly the FeatureProbe fixture combination: `density:"compact"` + child `section` `layout:"split"`, and `page` `layout:"cards"`), the split track math resolves against the remapped compact gap. This is the *correct* behavior — the subtracted value tracks the actual rendered gap — but it is an implicit coupling between the density remap block and the layout `calc()` that a future maintainer changing the spacing scale could break silently.
**Fix:** Add a one-line comment near the split block noting the intentional coupling, e.g.:
```css
/* NOTE: calc() subtracts the *effective* gap. Under .vms-page--compact the
   --vms-space-* tokens are remapped, and the split math correctly follows. */
```
No code change required.

### IN-02: `as ViewNode` cast on copy-button node in TS fixture

**File:** `demo/FeatureProbe-bun/handler.ts:34`
**Issue:** Pre-existing line (not introduced by Phase 4, but adjacent to the changed block at lines 36-49). The `copy-button` literal is force-cast with `as ViewNode`, which suppresses structural type checking for that node. The new `probeSection` / page literals (lines 36-49) are correctly typed as `ViewNode` via annotation rather than assertion, which is the safer pattern. Worth noting only because the diff places the cast immediately above the new, correctly-annotated code, inviting the cast pattern to be copied.
**Fix:** If `copy-button` is a valid member of the `ViewNode` union, the cast is unnecessary and can be dropped so the compiler validates the literal. Out of strict Phase 4 scope; flagged for consistency.

### IN-03: AGENTS.md doc rows accurate; minor wording redundancy

**File:** `AGENTS.md:105-106, 141-142`
**Issue:** The new `page`/`section` rows and the "CSS classes emitted" rows accurately describe the emitted classes and the byte-identical guarantee — they match the renderer and CSS exactly (verified `.vms-page--split`, `.vms-page--cards`, `.vms-section--split`, `.vms-section--cards` are all both emitted by browser.ts and styled in default.css). The phrase "omitted/`stack` = no modifier, byte-identical vertical flow" is repeated verbatim in both the `page` and `section` rows; this is acceptable for a reference table but is slightly redundant.
**Fix:** No change required — accuracy is correct, which is the binding constraint for "accurate-only AGENTS.md doc rows." Redundancy is acceptable in a per-node reference table.

---

_Reviewed: 2026-05-17T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
