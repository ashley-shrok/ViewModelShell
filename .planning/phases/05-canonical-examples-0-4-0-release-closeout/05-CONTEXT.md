# Phase 5: Canonical Examples + 0.4.0 Release Closeout - Context

**Gathered:** 2026-05-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Two coupled deliverables, no new wire/API surface:

**A. Canonical few-shot agent surface (EXAMPLES-01/02/03)**
- Showcase gains a navigable canonical reference set (≥ dashboard, form-heavy, list/detail) on the shipped stylesheet, benchmarked against named Bootstrap example pages.
- Every demo runs on the shipped stylesheet with zero hand-rolled per-demo `<style>` page chrome.
- AGENTS.md documents layout presets / density / card so an agent can use them from docs alone.

**B. 0.4.0 release closeout (RELEASE-01/02/03/04)**
- npm + NuGet bump aligned to `0.4.0`; full cross-backend parity green; MIGRATION/CHANGELOG; existing tests green + the new-behavior verification surface.

**The one genuinely-deferred decision now executed here:** Phase 3 D-16 — re-baseline the shipped default palette to light, demoting dark-purple to a theme file (Phase 3 explicitly parked this call for "Phase 5 EXAMPLES-01, with the Showcase visible against Bootstrap").

**Out of this phase (locked elsewhere / scope-creep guard):**
- No new wire/model field (0.4.0's only wire change is the Phase 4 `layout` enum). Gaps found while de-chroming are *logged*, not built.
- No new parity fixture/backend (D-24). No backend for the Showcase (D-11).
- No README/standalone design-system doc (D-22 — AGENTS.md only).
- The fixed-N-column preset (LAYOUT-F1, v2), image/chart nodes (#5/#6) — REQUIREMENTS Out of Scope, untouched.

</domain>

<decisions>
## Implementation Decisions

### Default palette re-baseline (D-16 decision point — EXAMPLES-01, RELEASE-03)

- **D-01:** Shipped `:root` default in 0.4.0 = **light, reusing the existing `light-purple.css` value set** (`--vms-bg #f7f7f9`, `--vms-surface #fff`, `--vms-accent #5a4ad7`, `--vms-color-scheme light`, etc.). Lowest risk — values already exist in the tested theme set; accent stays purple for brand continuity; benchmarks cleanly against Bootstrap's light example pages.
- **D-02:** Create **`viewmodel-shell/styles/themes/dark-purple.css`** as a **byte-exact capture of today's `:root` dark block**, so `import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css"` reproduces the prior default pixel-for-pixel (fills the one missing slot alongside dark-blue/green/rose/amber/teal). **Leave `light-purple.css` byte-unchanged** — it becomes a harmless no-op override; editing or deleting it would be a THEME-05 seam behavior change and break consumers importing it.
- **D-03:** **THEME-05 is mechanism-invariant, not value-frozen.** Three CI-checkable assertions define the regression guard: (a) every `--vms-*` variable name still exists (none removed/renamed); (b) the 11 pre-existing theme files stay byte-identical **and** the new `dark-purple.css` is a byte-exact capture of the prior default `:root` dark block; (c) overriding `:root` still fully reskins. THEME-05 explicitly does **not** mean default-value identity — D-16 is the sanctioned re-baseline Phase 3 pre-authorized, extending the D-17 precedent ("the variable still exists, themes still override it; only the shipped default value changes"). Stays CI-checkable like Phase 3 discipline.
- **D-04:** Log D-16 as **one explicit decision paragraph** in the release/verification record: *"default `:root` re-based onto the `light-purple.css` value set; prior default preserved byte-exact in `dark-purple.css`."* Captures the traceability benefit of a heavier per-variable audit at near-zero cost — no per-variable gate.
- **D-05:** MIGRATION/CHANGELOG frames the dark→light flip as an **intentional default change, NOT a wire/API/ViewNode break**. Existing apps that set their own `:root` or import a theme are unaffected; prior look is one line away (`import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css"`). Same honest-framing style as the 0.3.13 silent-behavior caveats.
- **D-06:** Showcase **boots in the new light default**: the theme-switcher's implicit empty-string slot becomes `light-purple`; add a real `dark-purple` entry pointing at the new `themes/dark-purple.css`; initial state boots light-purple so the canonical set benchmarks light-on-Bootstrap-light.
- **D-07:** The Phase 3 D-17 WCAG-AA "serviceable" floor is **re-enforced for the new light default via a scripted CI assertion** (body + muted text on `--vms-bg`/`--vms-surface`/`--vms-surface-2`, plus semantic colors on light surfaces), gated like the core-globals guard. Keeps "serviceable" mechanically falsifiable for the blind pipeline. (Phase 3 verified AA only on the dark default and left the 11 theme files byte-unchanged-but-unaudited — see Specifics RESEARCH ITEM.)
- **D-08:** **Each demo statically pins a distinct shipped theme** (`import "@ashley-shrok/viewmodel-shell/themes/<x>.css"` — the real-app pattern), so the canonical set doubles as a theme gallery and an agent sees theming is a one-line import. HelpDesk's two roles import **two different shipped themes** via the seam, not inline `:root` (role differentiation is semantic, preserved via the sanctioned seam).

### Showcase canonical reference set (EXAMPLES-01)

- **D-09:** **Augment, navigable.** Keep the existing kitchen-sink component gallery as one view; add **Dashboard / Form-heavy / List-detail** as sibling views switched by a top-level `tabs` nav (idiomatic — Showcase already uses tabs + the theme switcher). Preserves the every-node/variant few-shot value and adds the app archetypes EXAMPLES-01 requires.
- **D-10:** **Fixed teaching mapping** of archetype → Phase 4 preset: **Dashboard = `cards`** (stat/summary card grid + `section variant:"card"`), **List/detail = `split`** (list ↔ detail, collapses on narrow), **Form-heavy = `stack`** (or `split` with a help/summary aside). The canonical set's purpose is teaching the blind agent *when* to reach for each preset — make it explicit. Exact archetype content = Claude's discretion.
- **D-11:** Showcase stays **client-only, NOT a parity fixture** (BrowserAdapter + `buildVm` + local state, like today) — no .NET/bun backend, not added to the parity suite. It is a visual/few-shot artifact; wire-contract parity stays covered by the 7 fixtures + FeatureProbe.
- **D-12:** "Visually serviceable benchmarked against Bootstrap" made **falsifiable**: each archetype maps to a named Bootstrap example; CI-checkable structural proxies (archetype views use **only `.vms-*` nodes**, **zero per-view `<style>`**, **AA passes per D-07**); the irreducibly-subjective "looks comparable" is an **explicit documented human/agent reviewer sign-off in the verification doc** — not pretended-automated (visual quality cannot be browser-unit-tested, by framework design).
- **D-13:** **Locked Bootstrap benchmark mapping:** Dashboard → Bootstrap **"Dashboard"**, Form-heavy → Bootstrap **"Checkout"**, List/detail → Bootstrap **"Album"** (Album covers the list half; the detail panel is our own composition — Bootstrap has no literal master-detail page).
- **D-14:** **Theme switcher scoped to the gallery view only.** Archetype views render **one deliberate fixed theme** = the new shipped light default (a stable target for the D-12 reviewer sign-off; benchmarks the out-of-box look against Bootstrap's light pages). The component-gallery view keeps the 12-theme runtime switcher as the swappable-themes reference.

### Demo de-chroming (EXAMPLES-02)

- **D-15:** **Minimal scaffold, zero HTML `<style>`** per demo: doctype + head (meta/title) + shipped `styles.css` and the pinned theme imported via `main.ts` (the Showcase pattern) + `<body><div id="app"></div><script>`. The `.vms-page` shell + default.css body rule own reset/centering/width/bg/font. The `body.is-loading` dim-on-dispatch affordance is **dropped** and logged as a deferred framework-gap idea — not hand-patched.
- **D-16:** **Functional layout overrides** (e.g. Tasks' `.vms-form{flex-direction:row}` horizontal add-form): express via an existing model field/preset where one fits; where 0.4.0 has **no** model expression, the demo **drops the affordance and renders default**, with the gap logged as a deferred usage-driven idea. **No new wire in Phase 5** (closeout, not feature).
- **D-17:** **Sanctioned single-token seam overrides allowed** as the taught mechanism: a demo wanting a narrower page or branded fonts sets only `--vms-page-max` / `--vms-font-*` as a one-line `:root` override applied *after* the theme. Font `<link>` kept only where a font-token override is kept. Demonstrates the correct Phase 3 D-12 retune path (few-shot: "override the token, don't hand-roll").
- **D-18:** **Theme assignment = deliberate spread** covering light accents **+ ≥1 dark, explicitly putting the demoted `dark-purple` on a demo** (reinforces the D-05 "still shipped, just opt-in" migration story). HelpDesk's two roles = distinct themes. **Bun mirrors match their non-bun twin's theme** (avoids confusing the parity pair). Exact per-demo picks = Claude's discretion within these constraints.
- **D-19:** D-17's token override physically lives in **a tiny per-app stylesheet** (one `:root{}` with only sanctioned `--vms-*` tokens) imported in `main.ts` immediately after the pinned theme import — same mechanism the Showcase uses for themes. **Not an HTML `<style>`** (this is how D-15's "zero `<style>`" and D-17 coexist). Exact filename/path = Claude's discretion.

### AGENTS.md docs (EXAMPLES-03)

- **D-20:** Add **one focused "Design system" section**: import `styles.css` + a theme → serviceable look handled; the `--vms-*` token override seam (page-max / fonts / colors); a when-to-use guide for layout presets (stack/split/cards) + density + card. Plus fix the now-false lines. The node/CSS tables are already accurate (Phases 3/4) — a bare class list does **not** meet EXAMPLES-03's "usable from docs alone" bar for an agent deciding *when* to use cards vs split. Scoped tight, not a sprawling guide.
- **D-21:** **Bounded accuracy pass** over AGENTS.md: review the whole doc but change only statements the Phase 3–5 design-system work invalidated (the "Reference dark-theme stylesheets: demo/Tasks…/demo/HelpDesk…" line, the recurring "the app owns the CSS" framing, and the Demo apps / Frontend wiring / Testing sections where they assume per-demo hand-rolled CSS). **Accuracy-only** — no rewriting unrelated content (Phase 3/4 "don't improve adjacent surfaces" discipline).
- **D-22:** **AGENTS.md only** per EXAMPLES-03's explicit scope. Touch README **only** if it currently makes a now-false styling claim (accuracy fix, not new docs). No new standalone design-system doc.
- **D-23:** **Docs mirror the Showcase canonical set (single source of truth).** The preset→archetype mapping in AGENTS.md is exactly D-10/D-13's; AGENTS.md states the mapping and points to the Showcase as the live worked example rather than inventing separate doc snippets. Docs and the few-shot Showcase reinforce each other and cannot drift.

### Release closeout (RELEASE-01/02/03/04)

- **D-24:** **RELEASE-02 = pure regression-green gate, zero new parity surface.** Run the existing 7 fixtures (incl. the Phase-4-widened FeatureProbe already covering layout/density/card across .NET/Bun/Node), confirm byte-identical green. The re-based default + `dark-purple.css` are CSS-only (parity diffs wire JSON, not CSS); Showcase is client-only (D-11). No new fixture, **no `parity/backends.json` change**.
- **D-25:** **RELEASE-04 = static CI guards for invariants + inherited jsdom for behavior.** AA-contrast (D-07) = a standalone Node CI script computing WCAG ratios from `default.css` `:root`, gated in `.github/workflows/parity.yml` like `check:core-globals` (a static invariant, not DOM behavior — jsdom is the wrong tool). The 11-theme byte-identity + `dark-purple.css` byte-exact capture (D-03) + demos/archetypes zero-`<style>` & `.vms-*`-only (D-12/D-15) = static repo-scan CI assertions. Layout/density/card *behavioral* class-emission stays the existing Phase 3/4 jsdom tests (RELEASE-04 inherited-green). **No new jsdom behavior tests** — Phase 5 adds no wire/DOM behavior, only CSS values + repo hygiene.
- **D-26:** **RELEASE-03 = one consolidated 0.4.0 milestone entry.** Single CHANGELOG `## 0.4.0` + single MIGRATION `## Upgrading to 0.4.0` covering the whole milestone (theme/density/card + layout enum + palette re-baseline + de-chrome), grouped Added/Changed/Consumer-action. States the npm `0.3.14`→`0.4.0` / NuGet `0.3.10`→`0.4.0` jump and **why aligned** (the layout wire-format change per the AGENTS.md major.minor rule — symmetric to the 0.3.13 "why PATCH" explanation). Unreleased intermediate 0.3.x dev states not separately enumerated (non-events). Existing copy-pasteable one-section-per-release format.

### Claude's Discretion

- Exact archetype content/composition for Dashboard / Form-heavy / List-detail (D-10), within the fixed preset mapping and the named-Bootstrap-page benchmark (D-13).
- Exact per-demo theme assignments (D-18), within "deliberate spread, ≥1 dark incl. dark-purple, HelpDesk roles distinct, bun mirrors match twins."
- Exact filename/path of the per-app token-override stylesheet (D-19).
- Whether Form-heavy uses `stack` or `split`-with-aside (D-10).
- Exact wording/structure of the AGENTS.md "Design system" section (D-20), within "tight, mirrors the Showcase, not a sprawling guide."
- Exact AA-script implementation and the precise color-pair list it checks (D-07/D-25), provided it covers body + muted on bg/surface/surface-2 + semantic colors on light surfaces and gates in parity.yml.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements & locked decisions
- `.planning/REQUIREMENTS.md` — EXAMPLES-01..03 + RELEASE-01..04 acceptance criteria; Out of Scope (external CSS framework as dependency; spatial layout utilities; image/chart nodes; LAYOUT-F1 v2)
- `.planning/ROADMAP.md` §"Phase 5: Canonical Examples + 0.4.0 Release Closeout" — the 5 success criteria; "Depends on Phase 4" rationale
- `.planning/PROJECT.md` — Core Value (platform-agnostic, blind-agent rationale); Key Decisions ("0.4.0 minor bump npm+NuGet aligned", "appearance is 100% CSS / override seam untouched", "Bootstrap is a visual benchmark only — never a CSS dependency"); Constraints (no wire/API break; parity gate; verifier/plan-check ON); Out of Scope (image #5, chart #6)
- `.planning/phases/03-default-design-system/03-CONTEXT.md` — **D-15/D-16 (palette frozen in Phase 3; re-baseline directional intent explicitly deferred to "Phase 5 EXAMPLES-01")**, **D-17 (the WCAG-AA "serviceable" floor precedent + the "sanctioned default-value change is NOT a seam behavior change" reasoning D-03/D-07 extend)**, D-06 (override-seam discipline: additive `--vms-*` only, 11 theme files byte-identical), D-12 (`--vms-page-max` exposed for width retune), D-08 (literal normalization principle)
- `.planning/phases/04-preset-grid-layout/04-CONTEXT.md` — D-01/D-02 (`layout?` closed-union, omitted/`stack` byte-identical, the split/cards presets the canonical set demonstrates), D-11 (no version bump in Phase 4 — "Phase 5 RELEASE-01 owns the aligned 0.4.0"), D-08/D-09 (FeatureProbe is the widened 3-backend fixture RELEASE-02 inherits), the "5 ViewModels.cs copies" trap (D-10 — one shared source)
- `.planning/STATE.md` §Architectural Notes — "parity diffs wire JSON, CSS has no parity surface"; "canonical good-looking examples are the highest-leverage quality lever, Bootstrap as benchmark only"

### Implementation targets — examples surface
- `viewmodel-shell/styles/default.css` — `:root` (lines ~17–60) re-based onto the light value set (D-01); rule bodies must reference only `--vms-*` color vars (Specifics RESEARCH ITEM); the "Page chrome" body rule (~line 62+) is what makes D-15 demo body-chrome redundant
- `viewmodel-shell/styles/themes/dark-purple.css` — **NEW FILE**, byte-exact capture of today's `default.css` `:root` dark block (D-02)
- `viewmodel-shell/styles/themes/light-purple.css` — **byte-unchanged** (now a no-op override; D-02 — do NOT edit/delete)
- `viewmodel-shell/styles/themes/{dark,light}-{blue,green,rose,amber,teal}.css` (the other 10) — **byte-unchanged** (D-03 regression surface)
- `demo/Showcase/frontend/src/main.ts` — add the navigable archetype views (D-09/D-10/D-13); switcher mapping change (D-06: implicit slot → light-purple, add real dark-purple entry); switcher scoped to gallery view (D-14)
- `demo/Showcase/frontend/index.html` + every `demo/*/frontend/*.html` (ContactManager, ExpenseTracker, HelpDesk index+agent+requester, RetroBoard, Tasks, Showcase; `-bun` mirrors) — strip the single `<style>` block to zero (D-15); theme imported via the demo's `main.ts`/`server.ts` (D-08/D-18)
- `demo/HelpDesk/frontend/agent.html` + `requester.html` — the inline `:root` per-role themes → two distinct shipped theme imports (D-08/D-18)
- Per-app token-override stylesheet (new, path = Claude's discretion) imported after the theme in each retuning demo's `main.ts` (D-17/D-19)

### Implementation targets — release surface
- `viewmodel-shell/package.json` `version` `0.3.14` → `0.4.0` (RELEASE-01/D-26)
- `viewmodel-shell-dotnet/*.csproj` `<Version>0.3.10</Version>` → `0.4.0` (RELEASE-01/D-26)
- `MIGRATION.md` — new `## Upgrading to 0.4.0` section (D-05/D-26 format)
- `CHANGELOG.md` — new `## 0.4.0` section above the `0.3.14` entry (D-26)
- `AGENTS.md` — new "Design system" section (D-20); bounded accuracy pass on the §"CSS classes emitted by BrowserAdapter" footer line, the "app owns the CSS" framing, §"Demo apps", §"Frontend wiring", §"Testing" (D-21); version-string refs (Specifics RESEARCH ITEM — rule TEXT byte-unchanged)
- README.md — accuracy-touch only if it carries a now-false styling claim (D-22)

### Verification & docs
- `.github/workflows/parity.yml` + `viewmodel-shell/scripts/check-core-platform-globals.mjs` — the pattern the new AA-contrast script + static repo-scan guards follow (D-07/D-25); add new gating steps, do not weaken existing ones
- `parity/run.ts`, `parity/normalize.ts`, `parity/backends.json`, `parity/fixtures/*.json` — RELEASE-02 is regression-only; 7 fixtures stay byte-identical green; **no new fixture, no backends.json change** (D-24)
- `viewmodel-shell/test/theme-modifiers.test.ts` + `vitest.config.ts` — existing Phase 3/4 jsdom class-emission tests; RELEASE-04 inherits these green, adds **no** new jsdom behavior tests (D-25)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Theme-via-import pattern (Showcase `main.ts`)** — already does `import "@ashley-shrok/viewmodel-shell/styles.css"` + per-theme `?inline` imports + a runtime `<style>` swap. D-08 (per-demo static theme import), D-15 (theme via main.ts not HTML), D-19 (per-app token file after theme) all reuse this exact mechanism; D-06/D-14 modify the switcher's `themeFiles` map + boot state in place.
- **`.vms-page` shell (Phase 3 D-11/D-12)** — already centered, `--vms-page-max:1080px`, `clamp()` padding, zero media queries. This is what makes every demo's inline `#app{max-width}` + body centering redundant (D-15) and what `--vms-page-max` retunes (D-17).
- **default.css "Page chrome" body rule** — already applies theme bg/color/font to `<body>`; removes the need for each demo's inline `body{background/color/font}` (D-15).
- **`check-core-platform-globals.mjs` + parity.yml gating step** — the established standalone-static-CI-guard pattern; D-07's AA script + D-25's repo-scan assertions follow it exactly (not jsdom).
- **`light-purple.css`** — its value set *is* the new default (D-01); copying its `:root` body into `default.css` `:root` is the core re-baseline edit.
- **Phase-4-widened FeatureProbe fixture** — already exercises layout/density/card across .NET/Bun/Node; RELEASE-02 (D-24) inherits it, adds nothing.

### Established Patterns
- **Parity diffs wire JSON, not CSS** — the load-bearing invariant behind D-11/D-24: a CSS palette re-baseline + a client-only Showcase have zero parity surface.
- **Sanctioned default-value change ≠ seam behavior change** — Phase 3 D-17 established it (the one AA fix); D-03/D-07 extend the *same* reasoning to the full D-16 re-baseline. THEME-05 guards the mechanism, not value identity.
- **Optional/additive, default = byte-identical; don't improve adjacent surfaces** — D-16 (no new wire), D-21 (accuracy-only doc pass) carry the Phase 1–4 discipline forward.
- **Verification = parity (wire) + jsdom (DOM behavior) + standalone static CI guards (invariants)** — D-24/D-25 slot Phase 5's checks into the correct one of these three (no misuse of jsdom for static invariants).

### Integration Points
- `default.css` `:root` — the single core edit of the re-baseline (D-01); `themes/dark-purple.css` the single new file (D-02).
- `Showcase/frontend/src/main.ts` — archetype views + nav + switcher remap + scope (D-06/D-09/D-10/D-13/D-14).
- Every `demo/*/frontend/*.html` + their `main.ts`/`server.ts` — `<style>` → zero, theme via import (D-08/D-15/D-18); HelpDesk agent/requester the only two-theme-one-app case.
- `parity.yml` — new gating steps for the AA script + repo-scan guards (D-07/D-25), beside the existing core-globals step.
- `package.json` + `.csproj` + `MIGRATION.md` + `CHANGELOG.md` + `AGENTS.md` — the release-string + doc surface (RELEASE-01/03; D-26).

</code_context>

<specifics>
## Specific Ideas

- **RESEARCH ITEM — `default.css` rule-body color literals.** Confirm `default.css` rule bodies reference only `--vms-*` color vars with **no hardcoded dark hex literals outside `:root`** (Phase 3 D-08 snapped *spacing/font* literals to vars but the *palette was frozen* — color literals in rule bodies were never audited). If clean, D-16 is a pure `:root` value swap; if any rule-body color literal assumes dark, the re-baseline also needs those localized (still accuracy-scoped, not a redesign).
- **RESEARCH ITEM — re-confirm WCAG-AA for the new light default.** Phase 3 D-17 verified AA only on the dark default; the 11 theme files (incl. the `light-purple` values now becoming the default) were left byte-unchanged but **never AA-audited**. "AA holds" is an item to *verify and CI-enforce* (D-07), not an assumption — the milestone's whole "falsifiable serviceable" claim collapses if the shipped default silently fails AA.
- **RESEARCH ITEM — RELEASE-01 version-string completeness.** Enumerate every version-string location before bumping: npm `package.json`, NuGet `.csproj <Version>`, plus any README badges, AGENTS.md version references, the MIGRATION version table. **The AGENTS.md major.minor-alignment *rule text* stays byte-unchanged — only version *numbers* change.** A missed bump location is a classic closeout failure.
- **Bootstrap is a visual benchmark only, never a CSS dependency** (PROJECT.md / REQUIREMENTS Out of Scope, carried from Phases 3/4). D-12/D-13's "benchmarked against Bootstrap's Dashboard/Checkout/Album" means quality parity on the Showcase + a documented reviewer sign-off — never adopting Bootstrap classes/CSS.
- **"Serviceable" must stay falsifiable for a blind pipeline** (Phase 3 specifics). Visual quality genuinely cannot be browser-unit-tested (the framework's own no-browser-test promise). Hence D-12's split: CI-checkable structural proxies (`.vms-*`-only, zero per-view `<style>`, AA) carry the falsifiable load; the irreducible subjective bit is an *explicit, owned* reviewer sign-off — not pretended-automated, not silently skipped.
- **Two deferred framework-gaps are signals, not omissions** — the dispatch loading affordance and form-field-direction (see Deferred). Recording them keeps the project's "no silent gaps; defer by usage, not speculation" discipline; dropping them from demos is correct (no new wire in a closeout phase).

</specifics>

<deferred>
## Deferred Ideas

- **Dispatch loading affordance** — the `body.is-loading` dim-on-dispatch UX (currently hand-rolled per demo) has **no framework expression**. Dropped from demos in Phase 5 (D-15); candidate future framework feature, usage-driven (revisit if perceived-latency feedback proves broadly needed across real apps, not speculatively).
- **Form-field-direction / horizontal-form model expression** — Tasks' `.vms-form{flex-direction:row}` (horizontal add-form) has no 0.4.0 model field. Affordance dropped (D-16); candidate future wire field **only** if real apps prove the pattern common (usage-driven, per project discipline — not added in this closeout phase).
- **Default-palette re-baseline** — was Phase 3 D-16's deferred directional intent; **executed here** (D-01..D-08). No longer deferred.
- **Dedicated density/card parity fixture** — was Phase 3 D-05 / Phase 4 D-09; already closed by Phase 4's widened FeatureProbe. RELEASE-02 (D-24) only regression-runs it.
- **README / standalone design-system guide** — out of EXAMPLES-03 scope (D-22). Revisit only if a real need emerges; AGENTS.md is the normative few-shot surface.

### Reviewed Todos (not folded)
None — `todo match-phase 5` returned 0 matches.

</deferred>

---

*Phase: 05-canonical-examples-0-4-0-release-closeout*
*Context gathered: 2026-05-17*
