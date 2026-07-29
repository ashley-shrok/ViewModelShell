---
phase: 23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode
plan: 07
type: execute
wave: 5
completed: 2026-07-29
duration: ~15min
requirements: [COMP-01, COMP-02, COMP-03, COMP-04]
files_touched:
  - demo/FeatureProbe-bun/handler.ts
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - parity/fixtures/feature-probe.json
  - demo/Showcase/frontend/src/main.ts
commits:
  - f6d3a48: feat(23-07) — FeatureProbe parity extension for v8.0.0 foundations
  - 6ab06c7: feat(23-07) — Showcase Foundations section for v8.0.0 primitives
gates:
  parity: green (3 FeatureProbe backends byte-identical; 9 tripwires firing)
  check:demo-types: green (21 demo projects type-check clean, Showcase included)
  showcase:build: green (vite build succeeds; 22 modules transformed)
  net:build: green (FeatureProbe .NET builds — 0 warnings, 0 errors)
---

# Phase 23 Plan 07: Fleet Adoption + Parity for v8.0.0 Foundations — Summary

**One-liner:** All four v8.0.0 foundations from plans 23-01..04 now have both a
byte-identical parity FeatureProbe extension (9 coverage tripwires wired in
lockstep across bun/node/dotnet) and a real in-situ Showcase demo section —
closing the fleet-adoption + parity-coverage loops in one wave.

## What landed

### Task 1 — FeatureProbe parity extension (commit `f6d3a48`)

Extended both FeatureProbe backends with a byte-identical `Foundations`
`SectionNode` covering all four v8.0.0 additions, plus 9 `expectBodyContains`
tripwires on the initial GET step of `parity/fixtures/feature-probe.json`.

**Files:**
- `demo/FeatureProbe-bun/handler.ts` — new `foundationsSection` const inserted
  between `iconsSection` and `richTextSection`, appended to the page children
  array. Shared with the `node` backend (which mounts the same handler.ts).
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — byte-aligned
  `pageChildren.Add(new SectionNode(...))` block matching the bun twin.
- `parity/fixtures/feature-probe.json` — appended v8.0.0 clause to `$comment`
  and added 9 `expectBodyContains` tripwires to the `initial` GET step.

**Branch coverage (banked lesson: a diff can only prove things about code it
actually RUNS):**

| Foundation | Branch exercised | Tripwire (unique to this branch) |
|------------|------------------|----------------------------------|
| COMP-01 (caption) | `TextNode { style: "caption" }` | `"style":"caption"` |
| COMP-02 (weight) | 3× `TextNode { weight: "regular" \| "medium" \| "bold" }` | `"weight":"medium"` |
| COMP-03 (switch) | `CheckboxNode { variant: "switch" }` + one with variant OMITTED | `"variant":"switch"` |
| COMP-04 (avatar wire type) | Bare `AvatarNode` + 4 sizes + 3 content modes | `"type":"avatar"` |
| COMP-04 (size enum) | `AvatarNode { size: "xl", initials: "AL", tone: "success" }` | `"size":"xl"` |
| COMP-04 (initials mode) | Same node — unique 2-char initials | `"initials":"AL"` |
| COMP-04 (tone) | Same node — success on the AvatarNode (distinct from stat-bar) | `"tone":"success"` |
| COMP-04 (image mode) | `AvatarNode { image: "https://vms.example/avatar-ada.png" }` | `"image":"https://vms.example/avatar-ada.png"` |
| COMP-04 (icon mode) | `AvatarNode { icon: "user", tone: "warning", size: "lg" }` | `"icon":"user"` |

**Parity result:** `bun run parity/run.ts` GREEN across all 3 FeatureProbe
backends (`dotnet-probe`, `bun-probe`, `node-probe`). Every foundation
crosses the wire byte-aligned. The `foundations` (bun `const`) / `Foundations`
(.NET `SectionNode.Heading`) section serializes identically. Every tripwire
matches on every backend.

**Additional invariants exercised:**
- Bare `AvatarNode()` (all optionals absent) proves gotcha #8 posture
  (WhenWritingNull → absent, not null) across both backends. `parity/normalize.ts`'
  `findNulls` catches the class-2 defect if it ever regressed.
- One `CheckboxNode` with `variant` OMITTED proves absent = default
  (WhenWritingNull), NOT a `"variant":"checkbox"` fill-in.
- The 4 avatar sizes (sm/md/lg/xl) prove the closed `AvatarSize` enum crosses
  on both backends (KebabEnum<T> on .NET → kebab-lowercase strings).

### Task 2 — Showcase Foundations section (commit `6ab06c7`)

Added a new `v8.0.0 Foundations` section to `demo/Showcase/frontend/src/main.ts`
inside the `componentsView()` function, inserted immediately after the existing
"Text styles" section (the natural home — two of the four foundations are
typographic).

**Files:**
- `demo/Showcase/frontend/src/main.ts` — new section with a muted intro para,
  four sub-sections (caption tier, weight axis, switch variant, AvatarNode),
  and 4 new `formInputs.switch*` bind slots added to the state seed.

**Visual coverage in Showcase:**
- **Caption tier:** body / muted / caption in a `layout: "row"` for direct
  visual comparison of the three typographic tiers.
- **Weight axis:** regular / medium / bold body-styled TextNodes proving
  weight is orthogonal to style (a `body`-styled node can still be `medium`).
- **Switch variant:** three CheckboxNodes with `variant: "switch"` (one on,
  one off, one with a tooltip) + one classic variant-omitted checkbox for
  contrast. Bound to `formInputs.switchNotifications / switchBeta / switchDim
  / switchClassic` (seeded with `switchNotifications: true, switchDim: true`
  so both states are visible on load).
- **AvatarNode:** four separate rows —
  - Size row: same "AL" initials at sm/md/lg/xl.
  - Tone × initials: info/success/warning/danger with real 2-char initials
    ("GH", "AL", "MG", "DL").
  - Tone × icon: four `user-*` icons (`user`, `user-check`, `user-plus`,
    `user-x`) with all four tones at size `lg`.
  - Image mode + bare/decorative: one lg image via an inline SVG data URL
    (matches the existing image-section pattern at main.ts:260-261) + one
    bare `AvatarNode { size: "lg" }` (empty circle, decorative).

**Gates:**
- `npm run check:demo-types` (Showcase strict tsconfig) → GREEN.
- `npm run build` on Showcase → GREEN (22 modules transformed, no errors).

## Success criteria review

- [x] Both FeatureProbe backends emit a byte-aligned Foundations section
      covering all 4 additions.
- [x] Parity fixture has the $comment clause + 9 expectBodyContains tripwires;
      parity green.
- [x] Showcase demo exercises all 4 additions in situ (fleet-adoption
      discipline honored).
- [x] `check:demo-types` green (Showcase strict tsconfig).

## Deviations from plan

None. Plan executed exactly as written, both tasks in wave-5 order.

## Deferred items

None. This is the fleet-adoption + parity-coverage wave; downstream Phase 24-26
plans will consume the four foundations as composite-node dependencies.

## Notes for downstream (Phase 24+)

- The 9 tripwires in `parity/fixtures/feature-probe.json` are branch-unique
  (each substring appears in only ONE `buildVm` case). If a future refactor
  moves a foundation's emission or normalizes a key, parity will fail LOUDLY
  instead of going vacuous. Do not tighten the diff normalizer at the expense
  of these invariants.
- The Showcase's four `formInputs.switch*` bind slots are stable Nature-1 state
  additions. Downstream composite plans (SettingRowNode, etc.) can reuse the
  same seed pattern.
- No version bump / release ritual in this plan — batched to Phase 26 closeout
  per CONTEXT.md §5 (locked decision: batch-then-ship for v8.0.0).

## Self-Check: PASSED

- `demo/FeatureProbe-bun/handler.ts` — FOUND (`foundationsSection` present at line ~1042)
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — FOUND (`"v8.0.0 Foundations"` SectionNode present)
- `parity/fixtures/feature-probe.json` — FOUND (v8.0.0 clause appended to `$comment`; all 9 tripwires present in `expectBodyContains` per python3 JSON verification)
- `demo/Showcase/frontend/src/main.ts` — FOUND (Foundations section with all 4 sub-sections)
- Commit `f6d3a48` — FOUND (`git log --oneline` confirms)
- Commit `6ab06c7` — FOUND (`git log --oneline` confirms)
- Parity green — CONFIRMED (`bun run parity/run.ts` printed "Parity tests passed")
- `check:demo-types` green — CONFIRMED (21 demo projects type-check clean)
