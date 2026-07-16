---
phase: 21-v5-2-lookup-field-lookup-lookup-multiple-the-live-query-lane
plan: 07
subsystem: tui + parity
tags: [tui, parity, feature-probe, lookup, LOOK-06]
requires: [21-02, 21-06]
provides:
  - TUI degradation for lookup / lookup-multiple
  - FeatureProbe lookup omitted-vs-present matrix across all 3 backends
  - v5.2 $comment clause on the feature-probe fixture
affects: [viewmodel-shell/src/tui.tsx, demo/FeatureProbe-bun/handler.ts, demo/FeatureProbe/AspNetCore/FeatureProbeController.cs, parity/fixtures/feature-probe.json]
tech-stack:
  added: []
  patterns: [honest-degradation, static-view-shape-probe, unique-action-name-walker-proof]
key-files:
  created: []
  modified:
    - viewmodel-shell/src/tui.tsx
    - demo/FeatureProbe-bun/handler.ts
    - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
    - parity/fixtures/feature-probe.json
decisions:
  - "TUI degrades both lookup inputTypes to a bound id text input + a selected-labels line; no search machinery ported (design of record §6 — an agent sets `bind` and never touches the search UI)"
  - "Probe work landed in demo/FeatureProbe-bun/handler.ts, NOT server.ts as the plan stated (server.ts is an 11-line Bun entry point; handler.ts holds buildVm and is shared by bun + node)"
metrics:
  duration: ~35m
  completed: 2026-07-16
---

# Phase 21 Plan 07: TUI degradation + lookup parity coverage Summary

TUI now degrades `lookup`/`lookup-multiple` to a bound id input plus a selected-labels line, and all three FeatureProbe backends render the lookup omitted-vs-present matrix as static view-shape — proving the lookup wire is byte-identical across .NET, bun, and node.

## Tasks

| Task | Name | Commit |
|---|---|---|
| 1 | TUI lookup/lookup-multiple degradation | 35241a9 |
| 2 | FeatureProbe lookup matrix (3 backends) | 78bbb4b |
| 3 | v5.2 $comment clause | 5e4ae64 |

## What landed

**Task 1 — TUI (`tui.tsx`).** A `lookup`/`lookup-multiple` branch in `FieldView`: label + text input bound to the id at `bind` + a `Selected: …` line rendering `label ?? value` (the wire's "label omitted = label equals value" rule). Labels are read from `selected` and ONLY `selected` — never `candidates` (the D1 invariant), commented at the site. No debounce, no `searchAction` dispatch, no popup/chips/live region. The maintained header contract (:1794-1807) gained a per-inputType entry recording that this is the architecture working as designed, not a gap, following the `select-multiple` → single-select honest-degradation precedent.

**Task 2 — the probe matrix.** A "Lookup field" section in `buildVm` on both probe sources, shape-identical:
- `lookup-owner` — the headline: `selected` PRESENT + `candidates` ABSENT, `allowCustom` OMITTED, selected entry carrying `label` + `type`.
- `lookup-tag` — `allowCustom: true` (literal boolean) + `candidates`; selected entry with `label` omitted (free-form tag, D5) and `type` omitted (monomorphic, D6).
- `lookup-watchers` — `lookup-multiple`, 2 selected entries, `string[]` bind, `searchBind` + the unique `lookup-search-probe` searchAction.

Lookup bind slots seeded byte-identically in both state records. No new fixture, no `backends.json` change, no POST step.

**Task 3 — the `$comment`.** A v5.2 clause in the established four-part voice (what was added; the omitted-vs-present fields; the unique walker-proof name; the browser-only NOTE).

## Verification

- `npx tsc --noEmit` — exit 0.
- `npx vitest run` — **796 passed | 1 skipped** (matches the 21-06 baseline exactly; no drift).
- `npm run check:core-globals` — ✓ AGNOSTIC-03.
- `bun run parity/run.ts` — ✓ green across dotnet-probe/bun-probe/node-probe + skill parity.
- `git diff --exit-code parity/backends.json` — unchanged. No new file under `parity/fixtures/`.
- Full green-tree gate: `viewmodel-shell-dotnet/Tests` (136) + all 5 demo test projects (28/39/33/52/29) — all Passed, 0 failed.

**Wire independently inspected on both live backends** (not just "parity agrees" — agreement would also hold if the section rendered nothing). Confirmed on the .NET side: `allowCustom` ABSENT on `lookup-owner` (not `false`), `label`/`type` ABSENT on the free-form tag, `candidates` ABSENT on the headline, and `LookupItem.Type` serializing as `"type"` with **no** polymorphic-discriminator collision (the Plan 21-02 risk the plan flagged — it is clean).

## Deviations from Plan

**1. [Rule 3 — Blocking] The plan's probe file path was wrong.**
- **Issue:** The plan (frontmatter, `files_modified`, `read_first`, and both acceptance-criteria greps) names `demo/FeatureProbe-bun/server.ts` as the bun+node `buildVm` twin. That file is an 11-line `Bun.serve` entry point with no `buildVm`. The real shared implementation is `demo/FeatureProbe-bun/handler.ts` (899 lines), which `server.ts` (bun) and `server-node.ts` (node) both import. `backends.json:129` pointing bun+node at the same *cwd* is what the plan misread as "they share server.ts" — they share `handler.ts`.
- **Fix:** Implemented in `handler.ts`. The bun+node sharing claim itself is correct; only the filename was wrong. The plan's literal `grep -q "lookup-search-probe" demo/FeatureProbe-bun/server.ts` verify step would fail as written — the equivalent grep against `handler.ts` passes.

## Flag for the phase (not worked around)

**Parity cannot catch absent-vs-null.** `parity/normalize.ts:20` drops every null-valued field before diffing ("missing" and "null" compare equal), so a .NET member that emitted `"label": null` instead of omitting it would sail through the byte-diff. The `WhenWritingDefault` bools *are* covered (`false` is not null, so an `allowCustom: false` vs absent divergence still fails the diff), but the `WhenWritingNull` nullables (`selected`, `candidates`, `searchBind`, `searchAction`, `LookupItem.label`/`type`) are **not** parity-gated for omission. That coverage lives solely in the .NET serialization tests (`Assert.DoesNotContain`), per 21-PATTERNS §10c. This is pre-existing and by design, not a Phase 21 regression — but the phase should not read "parity green" as proof that null-omission holds. I verified the omissions by hand against the live .NET wire (above) rather than assuming.

## Self-Check: PASSED

- `viewmodel-shell/src/tui.tsx` — FOUND, contains `lookup`.
- `demo/FeatureProbe-bun/handler.ts` — FOUND, contains `lookup-search-probe`.
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — FOUND, contains `lookup-search-probe`.
- `parity/fixtures/feature-probe.json` — FOUND, valid JSON, `$comment` contains `lookup-search-probe` + `NOT part of parity`.
- Commits 35241a9, 78bbb4b, 5e4ae64 — all FOUND in `git log`.
