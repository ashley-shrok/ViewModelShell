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
