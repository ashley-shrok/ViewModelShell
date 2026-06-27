# Roadmap: ViewModel Shell

## Milestones

- ✅ **0.3.13 Platform-Agnosticism** — Phases 1–2 (shipped 2026-05-15) — [archive](./milestones/0.3.13-ROADMAP.md)
- ✅ **0.4.0 Design System** — Phases 3–5 (shipped 2026-05-18; npm + NuGet 0.4.1)
- ✅ **1.0.0 Truly Self-Describing Wire** — Phases 6–7 (shipped 2026-06-08; npm + NuGet 1.0.0)
- ✅ **v1.12 Layout System Completeness** — Phases 8–11 (shipped 2026-06-24; npm 1.12.0 / NuGet 1.10.0)

**Post-v1.12 interstitial releases** (not phased milestones — direct feature commits + CHANGELOG, the same cadence as the 1.7–1.11 interstitials): **2.0.0** remove `SectionNode.flyout` (BREAKING), **2.1.0** `LinkNode.active`, **3.0.0** unified appearance axes (BREAKING — `variant` split into `tone`/`emphasis`/`size`/`state`/`style`), **3.0.1**/**3.0.2** CSS-only fixes, **3.1.0** admin-shell primitives (`ButtonNode.width`, `DividerNode`, `FormNode.submitButton`). Both registries currently at **3.1.0** (2026-06-26). See [CHANGELOG.md](../CHANGELOG.md) for the authoritative per-version history.

## Phases

**Phase Numbering:**
- Integer phases: Planned milestone work (numbering continues sequentially — v1.12 starts at Phase 8, the prior milestone ended at Phase 7)
- Decimal phases (e.g. 8.1): Urgent insertions (marked INSERTED)

<details>
<summary>✅ 0.3.13 Platform-Agnosticism (Phases 1–2) — SHIPPED 2026-05-15</summary>

- [x] Phase 1: Capability Seam Refactor (3/3 plans) — completed 2026-05-15
- [x] Phase 2: Upload Progress + Milestone Closeout (3/3 plans) — completed 2026-05-15

Full detail: [milestones/0.3.13-ROADMAP.md](./milestones/0.3.13-ROADMAP.md)

</details>

<details>
<summary>✅ 0.4.0 Design System (Phases 3–5) — SHIPPED 2026-05-18</summary>

- [x] Phase 3: Default Design System (3/3 plans) — completed 2026-05-17
- [x] Phase 4: Preset-Grid Layout (4/4 plans) — completed 2026-05-18
- [x] Phase 5: Canonical Examples + 0.4.0 Release Closeout (6/6 plans) — completed 2026-05-18

</details>

<details>
<summary>✅ 1.0.0 Truly Self-Describing Wire (Phases 6–7) — SHIPPED 2026-06-08</summary>

- [x] Phase 6: Wire Shape Change (5/5 plans) — completed 2026-06-07
- [x] Phase 7: Error Envelope + ok Flag + 1.0.0 Release Closeout (5/5 plans) — completed 2026-06-08

</details>

<details>
<summary>✅ v1.12 Layout System Completeness (Phases 8–11) — SHIPPED 2026-06-24</summary>

- [x] Phase 8: Alignment Enums + Layout Policy (2/2 plans) — completed 2026-06-24
- [x] Phase 9: Switcher + Cards minItem (2/2 plans) — completed 2026-06-24
- [x] Phase 10: Fits Node (2/2 plans) — completed 2026-06-24
- [x] Phase 11: Demo Verification Spread + Milestone Closeout — completed 2026-06-24

Shipped as one consolidated additive release (npm `1.12.0` / NuGet `1.10.0`): alignment enums (`arrange`/`align`), the `switcher` primitive, the `cards` `minItem` field, and the `fits` node — governed by the new Layout policy (AGENTS.md), grounded in `.planning/design/layout-system-research.md`. The whole vocabulary was human-verified in a browser before release (two real bugs — switcher always-stacked, fits always-first — were caught and fixed). Full detail: CHANGELOG `1.12.0 / 1.10.0` + phase artifacts under [.planning/phases/](./phases/) (08–11).

</details>
