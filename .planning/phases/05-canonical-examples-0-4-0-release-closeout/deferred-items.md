# Deferred / Out-of-Scope Items — Phase 05

Out-of-scope discoveries logged during plan execution (not fixed in-plan; see
the GSD scope-boundary rule: only auto-fix issues directly caused by the
current task's changes).

## 05-02 (Showcase canonical set + de-chrome)

### Pre-existing: `*.css?inline` imports lack ambient TS declarations

- **Found during:** Plan 05-02 Task 1/2 (`npx tsc --noEmit` on `demo/Showcase/frontend`).
- **Symptom:** `tsc` reports `TS2307: Cannot find module '@ashley-shrok/viewmodel-shell/themes/<x>.css?inline'` for every `?inline` theme import (11 inherited + the 1 new D-06-mandated `dark-purple` import = 12).
- **Why pre-existing / out of scope:** The *original* `main.ts` already produced the identical class of 11 `TS2307` errors for the same `?inline` imports (verified by stashing the new file and re-running `tsc` on the original — 11 identical errors). This is a Vite-specific virtual-module import syntax that `tsc` cannot resolve without an ambient `declare module "*.css?inline"` declaration. Vite's bundler resolves `?inline` at build/runtime correctly (confirmed by `vite build`). The 05-02 archetype/view/nav code itself is fully type-clean (zero non-`?inline` `tsc` errors). The plan's own Task-1 verify line runs `npx tsc --noEmit ... 2>/dev/null` (output suppressed, exit not gated) precisely because this `?inline` gap is known-expected.
- **Not fixed here because:** D-21 "don't improve adjacent surfaces" discipline; demo-wide TS/build hygiene is owned by Plans 03/06 (release closeout / RELEASE-04), not the Showcase canonical-set plan. Adding an ambient `.d.ts` would be a demo-wide hygiene change outside 05-02's disjoint file set.
- **Suggested future fix (usage-driven, not speculative):** a single ambient `src/vite-env.d.ts` (`declare module "*.css?inline" { const css: string; export default css; }`) per demo, or one shared at the demo root — appropriate to fold into Plan 06's release-closeout hygiene pass if demo `tsc` cleanliness becomes a gated invariant.

## 05-03 (Demo de-chrome — dropped functional overrides)

Per D-15/D-16: these per-demo affordances had **no 0.4.0 model/preset/wire
expression**. Deleting them with the `<style>` block was correct (no new wire in
a closeout phase). The demo now renders the shipped default. Logged here as
deferred usage-driven framework-gap ideas — **explicitly NO new wire field, CSS
rule, token, node, or preset was added** to preserve any of these.

### Dispatch-dim loading affordance (`body.is-loading #app{opacity}`)

- **Found during:** Plan 05-03 Task 1 + 2 (all 4 + HelpDesk demos shared the rule).
- **Affordance dropped:** the `body.is-loading #app { opacity:0.6; pointer-events:none }` dim-on-dispatch. The `onLoading(){ document.body.classList.toggle("is-loading", loading) }` JS callback was intentionally **left in `main.ts`** (harmless inert JS toggling a now-unstyled class — D-15: not worth churning the entrypoints to remove dead JS).
- **0.4.0 expression:** none — the framework has no loading/pending-dispatch visual affordance.
- **Disposition:** deferred candidate future framework feature, usage-driven (revisit only if perceived-latency feedback proves broadly needed across real apps — per project "defer by usage, not speculation" discipline). NOT hand-patched.

### Form-field-direction / horizontal forms

- **Found during:** Plan 05-03 Task 1.
- **Affordances dropped (now render shipped vertical default):**
  - **Tasks:** `.vms-form{flex-direction:row}` horizontal add-form.
  - **ContactManager:** `.vms-form:not(:has(textarea)){flex-direction:row}` horizontal search form.
  - **ExpenseTracker:** `.vms-form{flex-direction:row;align-items:flex-end}` inline add-transaction form.
  - **RetroBoard:** `.vms-section .vms-form{flex-direction:row}` per-column horizontal add-form.
- **0.4.0 expression:** none — `form`/`field` have no layout-direction model field; the Phase-4 `layout` preset enum is on `page`/`section`, not `form`. (RetroBoard's separate **page-width** retune *did* have a sanctioned expression — `--vms-page-max` via the per-app token file — and was kept; only the form *direction* is dropped here.)
- **Disposition:** deferred candidate future wire field **only** if real apps prove horizontal forms common (usage-driven, per project discipline — not added in this closeout phase).

### ContactManager custom contact-list scrollbar (`#contact-list` webkit-scrollbar styling)

- **Found during:** Plan 05-03 Task 1.
- **Affordance dropped:** `#contact-list { max-height; overflow-y:auto }` + the `::-webkit-scrollbar*` thin-scrollbar styling. The list now renders at natural height with the platform default scrollbar.
- **0.4.0 expression:** none — no scroll-container / max-height affordance on `list` in the wire; custom scrollbar chrome is exactly the hand-rolled per-demo CSS D-15 removes.
- **Disposition:** deferred; a constrained-scroll list region is a candidate future framework idea, usage-driven (not speculative; not in a closeout phase).

## Post-0.4.1 (bun-demo local-source debt fix)

### RESOLVED: `FeatureProbe-bun` strict-`tsc` TS5097 (`./handler.ts`)

- **Found during:** the bun-demo stale-pin debt fix (repoint `*-bun` from npm `^0.3.11` → `link:` local source; per-demo `tsc --noEmit` sweep proving the now-current types).
- **Symptom (pre-existing, unrelated to the pin):** `demo/FeatureProbe-bun` was the only `*-bun` demo failing `bunx tsc --noEmit`: `server.ts(5,30): error TS5097: An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled` — from `import { fetchHandler } from "./handler.ts"` (the split-entrypoint pattern `server.ts`/`server-node.ts` share, deliberately keeping the explicit `.ts` so `node --experimental-strip-types server-node.ts` resolves at runtime). Structurally independent of the framework dependency: a *local relative* import, `server.ts` byte-unchanged by the debt fix, identical at the `^0.3.11` baseline. CI (`parity.yml`) never typechecks the bun demos (`grep -c tsc parity.yml` = 0) so demo `tsc` cleanliness was never a gated invariant.
- **Resolution (same session, user-directed "fix and commit all"):** added `"allowImportingTsExtensions": true` to `demo/FeatureProbe-bun/tsconfig.json` (it already had the prerequisite `noEmit: true`). One-line, demo-local, zero runtime/wire surface. All 7 `*-bun` demos now `bunx tsc --noEmit` clean; full parity unchanged (7/7 byte-identical). No longer deferred — recorded here for the rationale trail.

### ExpenseTracker serif section-heading + number-spinner-strip + over-budget progress tint

- **Found during:** Plan 05-03 Task 1.
- **Affordances dropped:** the `.vms-section__heading` serif/large/non-uppercase restyle, the `input[type=number]` spinner-strip, and the `.vms-list-item--warning .vms-progress__bar` warning-tint override.
- **0.4.0 expression:** none — these are pure visual re-skins of shipped `.vms-*` classes (exactly the hand-rolled chrome D-15 removes); heading typography is owned by the shipped type scale, not a per-demo override. The shipped default now renders.
- **Disposition:** dropped, renders shipped default. Not a framework gap worth a wire field — the shipped design system owns heading/control/progress appearance by design (THEME-05 seam: retune via `--vms-*` tokens only, none of these have a sanctioned single-token expression). No deferral action needed beyond recording the drop.
