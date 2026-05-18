---
phase: 05-canonical-examples-0-4-0-release-closeout
reviewed: 2026-05-18T00:00:00Z
depth: standard
files_reviewed: 33
files_reviewed_list:
  - .github/workflows/parity.yml
  - AGENTS.md
  - CHANGELOG.md
  - MIGRATION.md
  - README.md
  - demo/ContactManager/frontend/index.html
  - demo/ContactManager/frontend/src/main.ts
  - demo/ContactManager/frontend/vite.config.ts
  - demo/ExpenseTracker/frontend/index.html
  - demo/ExpenseTracker/frontend/src/main.ts
  - demo/ExpenseTracker/frontend/vite.config.ts
  - demo/HelpDesk/frontend/agent.html
  - demo/HelpDesk/frontend/index.html
  - demo/HelpDesk/frontend/requester.html
  - demo/HelpDesk/frontend/src/agent.ts
  - demo/HelpDesk/frontend/src/requester.ts
  - demo/HelpDesk/frontend/vite.config.ts
  - demo/RetroBoard/frontend/index.html
  - demo/RetroBoard/frontend/src/app-tokens.css
  - demo/RetroBoard/frontend/src/main.ts
  - demo/RetroBoard/frontend/vite.config.ts
  - demo/Showcase/frontend/index.html
  - demo/Showcase/frontend/src/main.ts
  - demo/Tasks/frontend/index.html
  - demo/Tasks/frontend/src/main.ts
  - demo/Tasks/frontend/vite.config.ts
  - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
  - viewmodel-shell/package.json
  - viewmodel-shell/scripts/check-aa-contrast.mjs
  - viewmodel-shell/scripts/check-no-demo-style.mjs
  - viewmodel-shell/scripts/check-theme-byte-identity.mjs
  - viewmodel-shell/styles/default.css
  - viewmodel-shell/styles/themes/dark-purple.css
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-05-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 33
**Status:** issues_found

## Summary

Phase 5 is a release-closeout / canonical-examples phase, judged against its
stated design intent ("no new tokens/wire/CSS rules beyond the `--vms-warning`
re-baseline and the new byte-exact `dark-purple.css`"; "Bootstrap is
benchmark-only, never imported"). I verified the design-intent claims hold and
focused on real correctness:

- **The 3 new guard scripts are correct.** I ran all three. `check-aa-contrast`
  passes 11/11 pairs with `exit 0`; I independently recomputed the WCAG relative-
  luminance math for `--vms-warning #a37510` against `--vms-bg`/`--vms-surface`/
  `--vms-surface-2` and the script's ratios match. `check-theme-byte-identity`
  passes — I independently `sha256sum`'d all 11 frozen theme files and every hash
  matches the embedded manifest byte-for-byte, and the `dark-purple.css` :root
  declaration-set / value comparison is correct. `check-no-demo-style` passes —
  the literal allow-list correctly excludes `wwwroot/**` and the Showcase-scoped
  `innerHTML`/`insertAdjacentHTML` assertion is correctly scoped (the other demos'
  `onError` `insertAdjacentHTML` is intentionally out of scan scope and is HTML-
  escaped). Exit codes, regex robustness, and false-pass/false-fail risk all
  check out.
- **Showcase view-switching / theme-switcher logic is sound.** The
  `state.view === "components"` guard makes the D-14 switcher-scope structurally
  falsifiable; the `view:set`/`list-detail:select` action wiring, the
  `selectedItem()` fallback, and `applyTheme()`'s nullish-coalesce are all
  correct. Two minor robustness gaps noted below (WR-01, WR-02).
- **Demo de-chrome is correct.** Zero `<style>` in the 8 hand-edited HTML files;
  every demo statically pins a distinct shipped theme via its TS entrypoint; no
  broken imports or dangling references. RetroBoard's single-token
  `app-tokens.css` override is imported after the theme as documented.
- **Version strings are consistent.** `package.json` `0.4.0` and the `.csproj`
  `<Version>0.4.0</Version>` agree, and match the CHANGELOG/MIGRATION `0.4.0`
  aligned-MINOR narrative and the `AGENTS.md` major.minor rule.
- **One real documentation defect (WR-01):** the CHANGELOG and MIGRATION AA-
  contrast numbers are transposed relative to the labels they are printed under.

No Critical issues. No security vulnerabilities (the demo `onError` handlers
HTML-escape `err.message` before `insertAdjacentHTML`; no secrets, no `eval`, no
injection surface).

## Warnings

### WR-01: CHANGELOG / MIGRATION AA-contrast numbers are transposed against their stated label order

**File:** `CHANGELOG.md:25`, `MIGRATION.md:62-63`
**Issue:** Both docs state the WCAG-AA non-text floor "on
`--vms-bg`/`--vms-surface`/`--vms-surface-2`; was 2.68/2.51/2.36:1, now
4.11/3.84/3.62:1". The label order is bg, surface, surface-2 — but the numbers
are in surface, bg, surface-2 order. Independently recomputed (WCAG 2.x relative
luminance, the same formula the shipped `check-aa-contrast.mjs` uses):

| pair | old `#c89610` | new `#a37510` |
|---|---|---|
| warning on `--vms-bg` (`#f7f7f9`) | **2.51** | **3.84** |
| warning on `--vms-surface` (`#ffffff`) | **2.68** | **4.11** |
| warning on `--vms-surface-2` (`#f0f0f4`) | 2.36 | 3.62 |

So the prose says "bg = 2.68 / 4.11" and "surface = 2.51 / 3.84" when the actual
values are the reverse. The floor is genuinely cleared either way (the guard
script is correct and passes), so this is not a correctness blocker — but this is
the consumer-facing release-closeout migration text, the numbers are presented as
precise CI-enforced evidence, and they are internally inconsistent with their own
labels.
**Fix:** Make the number order match the stated `--vms-bg`/`--vms-surface`/
`--vms-surface-2` label order in both files:
```
(was 2.51/2.68/2.36:1, now 3.84/4.11/3.62:1, CI-enforced)
```
(Or reorder the labels to `--vms-surface`/`--vms-bg`/`--vms-surface-2` — but
matching the numbers to the existing label order is the clearer fix.)

### WR-02: Showcase theme/view/tab actions cast unvalidated `ctx.value` to closed-union types

**File:** `demo/Showcase/frontend/src/main.ts:542,552,561,565`
**Issue:** `view:set` does `state.view = String(ctx.value) as View`,
`theme:mode` does `state.mode = ctx.value as Mode`, `theme:accent` does
`state.accent = ctx.value as Accent`, and `tab:set` stores `String(ctx.value)`.
`as View`/`as Mode`/`as Accent` are unchecked type assertions — an unexpected
`ctx.value` is silently accepted. The practical failure path: if `state.mode` or
`state.accent` ever holds a value not in `themeFiles`, `applyTheme()` sets
`themeStyle.textContent = ""` (the `?? ""` branch), silently dropping all theme
CSS and rendering the gallery with no accent palette — a confusing soft failure
with no console signal. In the Showcase the tab values are framework-emitted and
match the unions, so this does not misfire in practice; flagging it as a
robustness/code-quality gap in the one file the phase rewrote ~900 lines of, not
a live bug. (`view:set` is partially hardened by the `componentsView()`
`default:` fallback in the `switch`, so an unknown view degrades gracefully;
`theme:mode`/`theme:accent` have no such fallback.)
**Fix:** Validate against the known key set before assigning, e.g.:
```ts
case "theme:mode": {
  const v = String(ctx.value);
  if (v === "dark" || v === "light") { state.mode = v; applyTheme(); stateChanged = true; }
  break;
}
```
or, minimally, keep the cast but make `applyTheme()` fail loud instead of
silently blanking: `themeStyle.textContent = themeFiles[key] ?? (console.warn("[showcase] unknown theme", key), "");`

## Info

### IN-01: `selectedItem()` fallback can desync the highlighted list row

**File:** `demo/Showcase/frontend/src/main.ts:128-130,480`
**Issue:** `selectedItem()` returns `catalog.find(...) ?? catalog[0]` when
`state.selectedItemId` does not match any catalog id. The detail pane then shows
`catalog[0]`, but the list-row highlight uses
`item.id === state.selectedItemId` (line 480), which still matches nothing — so
the detail pane shows the first record while no list row is highlighted. Not
reachable through the shipped UI (all `list-detail:select` ids come from the
catalog), so this is a latent inconsistency, not a live bug.
**Fix:** If you want the fallback to be self-consistent, also reset
`state.selectedItemId` when the lookup misses, or derive the highlight from
`selectedItem().id` instead of `state.selectedItemId`.

### IN-02: `state` declared with `let` but never reassigned

**File:** `demo/Showcase/frontend/src/main.ts:40`
**Issue:** `let state: State = { ... }` — `state` is only ever mutated in place
(`state.view = ...`), never reassigned. `const` communicates that invariant and
prevents accidental whole-object replacement.
**Fix:** `const state: State = { ... };`

### IN-03: `visibleRows()` sort uses `(a as any)[state.sortColumn]`

**File:** `demo/Showcase/frontend/src/main.ts:102-104`
**Issue:** `(a as any)[state.sortColumn] ?? ""` defeats type-checking on the
sort key and would silently sort by `""` for any unknown column (stable no-op
sort). Cosmetic for a showcase with a fixed 4-column table, but `as any` in the
phase's flagship example file is worth a keyof-narrowed type for the few-shot
audience this file explicitly targets.
**Fix:** `const av = a[state.sortColumn as keyof typeof a] ?? "";` (rows are a
known shape), or type `sortColumn` as `keyof (typeof allRows)[number]`.

### IN-04: `check-aa-contrast.mjs` / `check-theme-byte-identity.mjs` duplicate the comment-strip + :root-isolate parser

**File:** `viewmodel-shell/scripts/check-aa-contrast.mjs:35-44`,
`viewmodel-shell/scripts/check-theme-byte-identity.mjs:112-117`
**Issue:** Both scripts independently reimplement the identical
`replace(/\/\*[\s\S]*?\*\//g, ...)` comment-strip plus `:root\s*\{([\s\S]*?)\}`
isolate. The comments in both files explicitly note they are "the SAME parse" —
which is a correctness coupling: if the parser ever needs a fix (e.g. to handle a
`}` inside a comment-free value), it must be changed in two places or the two
guards silently diverge. The regex itself is fine for the current well-formed
files (verified: both scripts pass and the `[\s\S]*?` non-greedy `}` match is
safe because neither `:root` body contains a literal `}`). Code-quality /
maintainability note only.
**Fix:** Extract a tiny shared `parseRootBlock(css)` helper (e.g.
`scripts/lib/css-root.mjs`) imported by both guards so the invariant parser has
one definition. Optional — acceptable as-is for two ~150-line standalone CI
scripts.

---

_Reviewed: 2026-05-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
