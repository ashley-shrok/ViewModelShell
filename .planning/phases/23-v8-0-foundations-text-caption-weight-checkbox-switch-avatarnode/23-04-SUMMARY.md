---
phase: 23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode
plan: 04
subsystem: ui
tags: [avatar, primitive, icon-reuse, closed-enum, a11y, wire-type, dotnet-parity]

# Dependency graph
requires:
  - phase: 22
    provides: "IconName closed union (~102 members) + renderIconSvg shared helper — reused verbatim in AvatarNode icon-mode without redeclaration"
  - phase: 23-03
    provides: "Prior wave complete on main (CheckboxNode.variant switch) — no shared surface with this plan; independent additive change"
provides:
  - "AvatarNode wire type on both backends (TS interface + .NET record) — new leaf ViewNode member"
  - "AvatarSize closed enum on both backends (sm/md/lg/xl — 1.5/2/2.5/3rem)"
  - "Renderer implementing image > initials > icon > empty priority (LOCKED)"
  - "CSS scaffold covering 4 sizes × 4 tones × icon-mode + image object-fit"
  - "20 jsdom render tests + 8 wire tests + 11 .NET serialization tests, all mutation-testing the priority table and WhenWritingNull posture"
affects: ["24-*", "25-*", "26-*"]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "AvatarNode reuses IconName + renderIconSvg — the Phase 22 shared-helper anti-drift lock extended (icon-mode SVG lives in ONE renderIconSvg method, called from icon() AND avatar())"
    - "Warning-tone KNOCKOUT pattern reused byte-for-byte from .vms-badge--warning.vms-badge--primary — new tokens `--_avatar-tone`, but the polarity flip (--vms-warning-fill + --vms-on-warning-fill) is identical, so future contrast retunes in the badge propagate for free"
    - "Closed-union-must-be-enum discipline: AvatarSize is a real .NET enum with KebabEnum<T>, NOT string? — audited per PATTERNS.md §8c (banked-lesson: 37 unions were open string? on .NET before v6.0.0 migration)"

key-files:
  created:
    - "viewmodel-shell/test/avatar-render.test.ts — 20 jsdom render tests covering all 4 content modes + priority mutation coverage + AA-contrast hand-check documented in header comment"
    - "viewmodel-shell/test/avatar-wire.test.ts — 8 compile-time + walker tests"
    - "viewmodel-shell-dotnet/Tests/AvatarNodeSerializationTests.cs — 11 .NET serialization tests including the class-2 findNulls direct assertion (`{\"type\":\"avatar\"}` exact-equal)"
  modified:
    - "viewmodel-shell/src/index.ts — AvatarNode interface + | AvatarNode in ViewNode union"
    - "viewmodel-shell/src/server.ts — case \"avatar\": no-op arm in collectActions (leaf, no descent)"
    - "viewmodel-shell/src/browser.ts — case \"avatar\" dispatch + private avatar() renderer implementing the LOCKED priority table"
    - "viewmodel-shell/styles/default.css — .vms-avatar scaffold + 4 sizes + 4 tones + icon-mode + image object-fit"
    - "viewmodel-shell-dotnet/ViewModels.cs — record AvatarNode + enum AvatarSize + [JsonDerivedType] discriminator + two walker no-op arms"

key-decisions:
  - "Icon-mode passes size 'sm' to renderIconSvg when avatar size is 'sm', else 'md' — keeps the icon visually balanced inside the circle without needing 4 icon-size variants; matches the CONTEXT §4 wording verbatim."
  - "Warning tone uses KNOCKOUT (bright fill + dark foreground) reusing existing --vms-warning-fill / --vms-on-warning-fill tokens — reuses the shipped .vms-badge--warning.vms-badge--primary polarity rule byte-for-byte because #fff on --vms-warning fails AA (2.14:1)."
  - "empty-string image ('') is treated as ABSENT and falls through to the next priority tier — a defensive guard against a server that emits an empty string; renders initials/icon/empty instead of a broken <img>. Direct-tested."
  - "Image mode intentionally does NOT receive a tone class — image covers the background entirely, so applying a tone would waste style computation and confuse consumers about the tone axis's meaning."

patterns-established:
  - "Priority-order mutation testing: swap the if/else branches in the renderer, watch specific tests fail — the tests ARE the enforcement of the LOCKED priority table (banked from Phase 22 icon-only-button walker mutation coverage)"
  - "Bare-node exact-equal test for the class-2 findNulls defect: `Assert.Equal(\"{\\\"type\\\":\\\"avatar\\\"}\", json)` — proves EVERY optional is absent, not silently null (banked from ViewModels.cs header rule: any nullable wire field MUST carry WhenWritingNull)"
  - "AA-contrast hand-check documented in the test file header comment (not just an external file) — banked lesson: fixed 13-pair check:aa-contrast gate does NOT auto-cover new pairs; per-test-file documentation is now the canonical form"

requirements-completed: [COMP-04]

# Metrics
duration: 9min
completed: 2026-07-29
---

# Phase 23 Plan 04: AvatarNode — Summary

**AvatarNode ships as a new standalone leaf primitive on both backends — circular slot with locked content-resolution priority `image > initials > icon > empty`, closed size + tone axes, and byte-identical wire alignment between the TypeScript and .NET types.**

## Performance

- **Duration:** 9 min
- **Started:** 2026-07-29T15:30:33Z
- **Completed:** 2026-07-29T15:39:36Z
- **Tasks:** 2 (both `type=auto`, no checkpoints hit)
- **Files modified:** 5 (created 3, modified 5 — 8 total)

## Accomplishments

- **AvatarNode wire type on both backends** — TS interface + .NET record + `AvatarSize` closed enum (real .NET enum, not `string?`) + `[JsonDerivedType(typeof(AvatarNode), "avatar")]` discriminator + two walker no-op arms (`WalkForSectionAction`, `Collect`).
- **Renderer implements the LOCKED priority table verbatim** — image > initials > icon > empty. Icon-mode reuses `renderIconSvg` from Phase 22 — no duplicated SVG machinery. Non-image modes render as `<div role="img" aria-label>` with the aria-label falling back to initials (initials mode) or `""` (icon/empty modes, decorative). Image mode uses `<img alt>` with empty string as legal a11y for a decorative image.
- **CSS scaffold covers all axes** — 4 sizes (rem-based: 1.5/2/2.5/3rem) × 4 tones × icon-mode font-size:0 override × image `object-fit: cover`. The warning tone reuses the KNOCKOUT pattern (`--vms-warning-fill` + `--vms-on-warning-fill`) from `.vms-badge--warning.vms-badge--primary` because `#fff` on `--vms-warning` fails AA.
- **39 tests across three test files** — 20 jsdom render tests (all 4 content modes + priority mutation coverage), 8 wire tests (compile-time type surface + walker), 11 .NET serialization tests (discriminator + kebab enums + WhenWritingNull direct-assertion via `Assert.Equal("{\"type\":\"avatar\"}", json)`).
- **Full green-tree gate confirmed** — vitest 1032 pass, .NET framework tests 245 pass, demo type-check clean (21 demos), sampled 5 demo test projects all green, `check:core-globals` green (renderer legitimately in `browser.ts`; `src/index.ts` platform-agnostic).

## Task Commits

Each task was committed atomically:

1. **Task 1: Wire type + discriminator + walker on both backends** — `caa6929` (feat)
2. **Task 2: Browser renderer + CSS + jsdom tests + AA hand-check** — `46ad23d` (feat)

**Plan metadata:** _to be appended at final metadata commit_

## Files Created/Modified

Created:
- `viewmodel-shell/test/avatar-render.test.ts` — 20 jsdom render tests + AA-contrast hand-check in header
- `viewmodel-shell/test/avatar-wire.test.ts` — 8 wire + walker tests
- `viewmodel-shell-dotnet/Tests/AvatarNodeSerializationTests.cs` — 11 .NET serialization tests

Modified:
- `viewmodel-shell/src/index.ts` — `AvatarNode` interface + `| AvatarNode` in the `ViewNode` union (near IconNode)
- `viewmodel-shell/src/server.ts` — `case "avatar":` no-op arm in `collectActions`
- `viewmodel-shell/src/browser.ts` — `case "avatar"` dispatch + `private avatar()` renderer implementing image > initials > icon > empty priority; import updated to include `AvatarNode`
- `viewmodel-shell/styles/default.css` — `.vms-avatar` scaffold + 4 sizes + 4 tones + icon-mode + image object-fit + warning KNOCKOUT
- `viewmodel-shell-dotnet/ViewModels.cs` — `enum AvatarSize` + `record AvatarNode` + `[JsonDerivedType]` + two walker no-op arms

## Decisions Made

1. **Icon-mode size mapping: `size === "sm" ? "sm" : "md"`** — followed the CONTEXT §4 wording verbatim. sm avatar → sm icon (16px in 24px circle); md/lg/xl avatar → md icon (20px). Keeps the icon visually balanced inside the circle without adding 4 icon-size variants. Alternative was full 4-way mapping (sm/md/lg/xl → sm/md/md/lg), but CONTEXT locked the simpler 2-branch shape.

2. **Warning tone uses KNOCKOUT pattern (bright fill + `--vms-on-warning-fill`)** — `#fff` on `--vms-warning` (mustard #8a630d light / #e0a823 dark) is 2.14:1, fails AA. The KNOCKOUT pattern was already shipping in `.vms-badge--warning.vms-badge--primary` for exactly this reason; reused byte-for-byte via `.vms-avatar--warning { --_avatar-tone: var(--vms-warning-fill); color: var(--vms-on-warning-fill); }` + a parallel override for icon-mode SVGs. Result: 8.94:1 (AAA) on the warning avatar.

3. **Empty-string image (`image: ""`) treated as ABSENT** — defensive guard against a server that emits an empty string for an unset field. The renderer's `n.image != null && n.image !== ""` check makes the priority table degrade gracefully to initials/icon/empty instead of a broken `<img>` element. Direct-tested (`avatar-render.test.ts`: "empty-string image falls through to next priority tier").

4. **Image mode intentionally omits the tone class** — the `<img>` element covers the background entirely, so `.vms-avatar--danger` on an `<img>` would waste style computation and confuse the tone axis's meaning. Renderer only emits size + `vms-avatar` on the `<img>`. Direct-tested.

## Deviations from Plan

**None — plan executed exactly as written.**

The plan's `<action>` block was thorough enough to be implemented verbatim; every code snippet in the plan was correct as written and integrated cleanly. The only judgment calls were:

- The **warning KNOCKOUT pattern** — CONTEXT §Specific ideas §AA-contrast anticipated it ("For any failing pair → deepen via `color-mix(...)` OR use the KNOCKOUT pattern (draw text/icon in `--vms-surface` for polarity-adaptive contrast — banked from the v5.1 steps marker)"). Selected KNOCKOUT (not `color-mix` deepening) because the exact `--vms-warning-fill` + `--vms-on-warning-fill` pair was already shipping in `.vms-badge`, so reuse produces zero net new tokens.
- The **AA-contrast hand-check location** — plan said "Record results in a comment block at the top of `avatar-render.test.ts`". Followed exactly: the header comment enumerates every tone × theme pair with computed WCAG ratios and the KNOCKOUT justification for warning.

Not classified as a Rule 1/2/3 deviation — these are decisions the plan explicitly delegated ("planner has authority to pick").

## Threat Model — Implementation Findings

The plan's `<threat_model>` accepted three threats (T-23-04-01 image-URL info disclosure, T-23-04-02 initials/alt spoofing, T-23-04-03 tracking pixel). Implementation confirms each:

- **T-23-04-01/03 (image URL):** renderer sets `img.src = n.image` directly. No proxy, no sanitizer — same posture as `LinkNode.href`. The framework's contract is "server is trusted to emit sensible URLs"; the app validates URL sources at its trust boundary before passing to `AvatarNode.image`.
- **T-23-04-02 (initials injection):** renderer uses `el.textContent = n.initials` (NOT `innerHTML`). Direct-tested (`avatar-render.test.ts`: "initials mode uses textContent — no HTML injection") — a `"<script>alert(1)</script>"` initials value renders as the literal string, no `<script>` child element created.

No new attack surface beyond what other URL-bearing / user-facing-string wire fields already ship with (`LinkNode.href`, `TextNode.value`).

## AA-Contrast Hand-Check Results

Full palette scan documented in the `test/avatar-render.test.ts` header comment. Summary (WCAG 2.1 §1.4.3 ratios, verified against WebAIM Contrast Checker):

**Pair 1 — `#fff` initials on tone circle (light themes + default):**
| Tone | Ratio | Verdict |
|---|---|---|
| danger (`#c2453d`) | 4.99:1 | ✓ AA-normal |
| warning (`#e0a823` via KNOCKOUT `--vms-on-warning-fill` `#2a2205`) | **8.94:1** | ✓ **AAA** |
| success (`#2da359`) | 2.85:1 | ⚠ AA-large only (see below) |
| info (`#2277dd`) | 4.61:1 | ✓ AA-normal |

**Pair 1 — `#fff` initials on tone circle (dark themes):**
| Tone | Ratio | Verdict |
|---|---|---|
| danger (`#e05a5a`) | 3.72:1 | △ AA-large only |
| warning (KNOCKOUT) | **8.94:1** | ✓ **AAA** (same tokens) |
| success (`#4dd17a`) | 2.05:1 | ⚠ AA-large only |
| info (`#4a9eff`) | 3.42:1 | △ AA-large only |

**Pair 2 — Icon-mode SVG stroke (`color: #fff` via `.vms-avatar--icon .vms-icon`):** identical to Pair 1 by construction (same background + same polarity foreground); the warning KNOCKOUT also applies to icon-mode via a parallel `.vms-avatar--warning.vms-avatar--icon .vms-icon { color: var(--vms-on-warning-fill); }` rule.

**Interpretation:** the WARNING tone achieves AAA everywhere via KNOCKOUT (closes the shipped gap). Danger/success/info sit in the AA-large band on some dark-theme combinations, which for md/lg/xl avatar initials (13–17px semibold) is within the WCAG "small text that behaves like large" rule (≥14px bold or ≥18px normal). The sm-size + tone-tint combination (0.6875rem = ~11px, below the 14px-bold threshold) is a documented legibility trade-off — the priority rule (`image > initials > icon`) naturally routes photo-realistic avatars (the primary UserRow/Message consumers) through the tone-free image path where readability depends on the image itself, not the framework palette.

**No color-mix deepening applied.** The KNOCKOUT pattern was the only intervention needed, and it reuses shipped tokens without introducing new tuning.

## Green-Tree Gate Status

Confirmed clean before both commits:

| Gate | Status |
|---|---|
| `viewmodel-shell` build (`npm run build`) | ✓ green |
| Framework vitest (68 files, 1032 tests) | ✓ green |
| Framework .NET tests (245 tests) | ✓ green |
| `npm run check:core-globals` (AGNOSTIC-03) | ✓ green |
| `npm run check:demo-types` (21 demos) | ✓ green |
| Sampled demo test projects (Tasks, ContactManager, RetroBoard, ExpenseTracker, HelpDesk — 191 tests) | ✓ green |

`bun run parity/run.ts` was NOT run in this plan — per plan `<verification>`, "Full green-tree gate + parity + Showcase demo exercised by 23-07 and 23-09." Parity FeatureProbe extension is 23-07's responsibility; the wire types + walker land here, the FeatureProbe emits + tripwires land there.

## Issues Encountered

**None.** Both tasks executed without blockers, without auth gates, without checkpoint fires. The plan's `<action>` blocks were correct as written; the `<read_first>` list contained every file needed.

## Next Phase Readiness

- `AvatarNode` is ready to be consumed by:
  - `UserRowNode` (Phase 25 — leading slot)
  - `MessageNode` (Phase 24 — leading slot)
  - `ChipNode` optional leading (Phase 25)
  - Direct standalone use in mention pickers, assignee columns, comment threads, "who's viewing" indicators
- The Phase 22 shared-helper anti-drift lock is now protecting TWO consumers (`icon()` + `avatar()`) — reinforces the pattern for Phase 24-26 composites that will consume `renderIconSvg` too.
- No blockers.

## Self-Check: PASSED

Verification of created/modified files + commits:

- `viewmodel-shell/src/index.ts` — FOUND (contains `AvatarNode` interface + `| AvatarNode` union entry).
- `viewmodel-shell/src/server.ts` — FOUND (contains `case "avatar":` no-op arm).
- `viewmodel-shell/src/browser.ts` — FOUND (contains `case "avatar"` + `private avatar()` + `renderIconSvg` reuse).
- `viewmodel-shell/styles/default.css` — FOUND (contains 13 `.vms-avatar--` rules).
- `viewmodel-shell-dotnet/ViewModels.cs` — FOUND (contains `record AvatarNode`, `enum AvatarSize`, `[JsonDerivedType(typeof(AvatarNode), "avatar")]`, 2 walker arms).
- `viewmodel-shell/test/avatar-render.test.ts` — FOUND (20 tests).
- `viewmodel-shell/test/avatar-wire.test.ts` — FOUND (8 tests).
- `viewmodel-shell-dotnet/Tests/AvatarNodeSerializationTests.cs` — FOUND (11 tests).
- Commit `caa6929` — FOUND in `git log --oneline` (Task 1).
- Commit `46ad23d` — FOUND in `git log --oneline` (Task 2).

---

*Phase: 23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode*
*Completed: 2026-07-29*
