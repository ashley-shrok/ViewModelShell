
## [20-05] Stale framework dist/*.d.ts blocks bun-demo tsc (pre-existing, out of scope)
- `viewmodel-shell/dist/*.d.ts` (dated Jul 9/2) predates today's src/index.ts nav-type additions (Plans 20-01/20-02, Jul 11).
- Effect: `bunx tsc --noEmit` in demo/FeatureProbe-bun fails to resolve BreadcrumbNode/StepsNode AND on a pre-existing ModalNode size "small" error (line 556) — proving the failure predates plan 20-05.
- FeatureProbe-bun resolves types via the package `exports` map (dist), NOT a src alias; Showcase resolves via a tsconfig src alias so it is unaffected.
- Runtime is unaffected (types erased): `bun build --target=bun` succeeds and `bun run parity/run.ts` is green.
- Fix (belongs to a framework build refresh, not this fixtures plan): rebuild dist via viewmodel-shell's build so dist/*.d.ts reflect current src.
