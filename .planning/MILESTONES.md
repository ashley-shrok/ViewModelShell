# Milestones

## 0.3.13 Platform-Agnosticism (Shipped: 2026-05-15)

**Phases completed:** 2 phases, 6 plans, 13 tasks

**Key accomplishments:**

- The 3 core platform-global violations (window.location.href, localStorage, sessionStorage) were relocated out of `viewmodel-shell/src/index.ts` behind a generic optional-verb capability seam implemented in BrowserAdapter — with zero observable behavior change and a fail-loud guarantee replacing the prior silent-no-op risk.
- The "core references zero platform globals" invariant is now CI-enforced by a standalone grep-denylist guard scoped to src/index.ts, a net-new framework-level vitest+jsdom harness proves the Wave 1 core→adapter relocation actually fires (navigate/onRedirect-precedence/storage/fail-loud), and the D-12 dual verification gate (full 7-fixture parity green AND adapter test green) was satisfied locally and wired into the existing parity workflow as gating steps.
- AGENTS.md and README.md now document the capability-seam pattern (navigate/storage/transport verbs, optional-methods-on-Adapter shape, onRedirect→adapter.navigate→loud-error resolution order, fail-loud rule with the auth-JWT security rationale) and reframe the previously aspirational "core references zero platform globals" claim as a CI-enforced, checkable invariant — naming the `check:core-globals` guard, the parity.yml gating step, and the src/index.ts-only scope — with every signature cited byte-for-byte from the shipped source and zero behavioral/wire documentation changed.
- 1. [Rule 1 - Bug] Removed a stray duplicate mock-XHR construction in case (d)
- npm `@ashley-shrok/viewmodel-shell` bumped `0.3.12 → 0.3.13` (PATCH, D-10 — never `0.4.0`) with NuGet held at `0.3.9` and the AGENTS.md versioning rule byte-unchanged; a copy-pasteable root `MIGRATION.md` ships all D-13 items 1-5 (exact versions + why-patch/why-no-NuGet rationale, the one `onUploadProgress` API addition, the NOT-breaking list incl. existing custom Adapters, upgrade steps, and both non-obvious silent-behavior caveats with a `total > 0` divide-by-zero guard); the full milestone gate is green — `check:core-globals` exit 0, vitest 14/14, and the 7-fixture cross-backend parity suite "all backends agree".

---
