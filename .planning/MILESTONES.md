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

## 0.4.0 Design System (Shipped: 2026-05-18)

**Phases completed:** 3 phases, 13 plans

**Key accomplishments:**

- A shipped default stylesheet now gives any app a serviceable page shell, coherent spacing + type scale, density knob, and `section variant: "card"` grouping with zero app-authored CSS. The override seam (`:root` CSS variables + alternate theme files) is preserved byte-identically — a one-line theme import fully reskins the UI.
- One additive `layout?: "stack" | "split" | "cards"` enum on `PageNode`/`SectionNode` (both backends, byte-aligned) declares layout *intent* on the wire; CSS implements every pixel. Default omitted/`"stack"` renders byte-identically to the prior vertical flow (non-breaking). `split` collapses to stacked on narrow viewports and `cards` auto-fits from `--vms-card-min` — zero `@media` queries, zero app-specified breakpoints.
- Showcase gained a navigable canonical reference set (gallery + Dashboard/Form-heavy/List-detail archetypes mapped to Bootstrap Dashboard/Checkout/Album as the visual quality bar); every demo was de-chromed to zero per-demo `<style>` and pins one distinct shipped theme via its TS entrypoint; AGENTS.md got a focused Design system section pointing at the live Showcase as single source of truth.
- Default palette re-based dark→light (D-01↔D-07 AA conflict resolved via the one-value D-17 precedent — `--vms-warning #c89610→#a37510`, surfaced to the user not auto-resolved); `themes/dark-purple.css` captures the prior dark default byte-exact (one-line import to restore); 11 shipped theme files byte-unchanged.
- Aligned npm + NuGet bump to `0.4.0` (the layout enum is the wire-format change forcing the aligned minor per the major.minor-alignment rule); consolidated CHANGELOG/MIGRATION; parity 7/7 byte-identical green; vitest 31/31; 4 static CI guards (no-demo-style, WCAG-AA contrast floor, layout-classes, core-globals) gated in `parity.yml`.

---

## 1.0.0 Truly Self-Describing Wire (Shipped: 2026-06-08)

**Phases completed:** 2 phases, 10 plans

**Key accomplishments:**

- Delivered the framework's founding pitch — "agents drive what the browser drives" — without the asterisk. The `context` payload is gone from the wire entirely; dispatch carries only `{action, state, files?}`. Every input node declares a `bind` path; the renderer reads and writes state through that path; an agent reading only `{vm, state}` from a GET and walking the tree can compose any request the browser composes, byte-identically.
- The renderer (`viewmodel-shell/src/browser.ts`) was rewritten as a thin interpreter — the seven distinct context-assembly paths collapsed into one declarative bind-path code path. No DOM harvest, no implicit scope rules, no synthetic context. The Adapter contract gained a third `stateAccess` parameter (the seam through which adapters read/write state at bind paths); `tui.tsx` updated to match.
- Action names are now unique per operation, app-named (`delete-row-42`, `select-tab-active`, etc.) — framework enforces "one action name = one operation" at tree-build time via a tree-walker that errs strictly on outside-form duplicates (closes the per-row-buttons-missing-id bug class). `TableSelection` was removed entirely from `TableNode`; per-row selection is just `CheckboxNode` cells bound to state paths the app chose.
- Phase 7 added the framework-owned error envelope: malformed payloads, unknown action names (via the new `UnknownActionError` / `UnknownActionException` classes apps throw from their `default:` cases), and uncaught handler exceptions all return uniform `{ok: false, errors: [{path?, message, code?}]}` envelopes — 400 for client-fault, 500 for server-fault, body shape identical across all cases. Every response carries a framework-set top-level `ok: true | false` flag — agents have one stable signal across every VMS app.
- TS-side shell update: dispatch path now parses the body before throwing; surfaces `VmsActionError extends Error` carrying `.errors` and `.status` through the existing `onError` callback. Apps that don't care see a normal Error with a useful message; apps that want structured handling `instanceof VmsActionError` and read `.errors`. Same callback, no new API surface.
- 14 demos migrated to the new wire shape (state records absorb what used to be transient form-input values; BuildVm declares bind paths everywhere; action handlers read from state, never from a removed `payload.Context`); the canonical HelpDesk workflow (tabs → filter → narrow → bulk action) still works end-to-end on the new shape.
- Aligned npm + NuGet `1.0.0` major bump; consolidated MIGRATION.md / CHANGELOG.md / AGENTS.md updated with the full breaking-change recipe and the new agent-driving promise. Cross-backend parity green byte-identical across 7 fixtures × 15 backends (.NET / Bun / Node), including a new envelope-fixture exercising malformed payload + unknown action + uncaught throw. Test gates at release time: vitest 236/237 (1 skipped TUI test deferred), framework dotnet 45/45, demo dotnet 172/172, core-globals + WCAG-AA + parity CI guards all green.

---
