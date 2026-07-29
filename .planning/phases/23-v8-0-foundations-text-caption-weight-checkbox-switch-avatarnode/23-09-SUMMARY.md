# Phase 23 Plan 09 — Final gate + Ashley visual sign-off

**Plan:** 23-09
**Wave:** 6 (checkpoint — `autonomous: false`)
**Status:** ✅ **SIGNED OFF by Ashley 2026-07-29** — Foundations look good, ready for Phase 24 Primary composites.
**Depends on:** 23-01 through 23-08 — all landed on `main`

## Task 1 — Full green-tree gate (2026-07-29) — ✅ ALL GREEN

Executed the exact AGENTS.md Working Agreement gate sequence. Every suite passed.

### TypeScript / framework gates

| Suite | Result |
|---|---|
| `npm run build` (`tsc -b tsconfig.tui.json`) | ✅ clean |
| `npm run check:test-types` (`tsc -p tsconfig.test.json --noEmit`) | ✅ clean |
| `npm run check:core-globals` (AGNOSTIC-03 platform-globals guard) | ✅ zero platform globals in `src/index.ts` |
| `npm run check:aa-contrast` (fixed 13-pair gate, default + 12 themes) | ✅ 13/13 pairs meet WCAG-AA across all themes |
| `npm run check:no-demo-style` | ✅ 17 hand-edited HTML files zero-`<style>` + Showcase main.ts `.vms-*`-only |
| `npm run check:demo-types` (per-demo strict tsconfig) | ✅ 21 demo projects type-check clean |
| `npx vitest run` (full framework test suite) | ✅ **1032 tests passed / 1 skipped / 68 files** |

### .NET framework + demo test suites

| Suite | Result |
|---|---|
| `dotnet test viewmodel-shell-dotnet/Tests` | ✅ **245 passed** |
| `demo/Tasks/AspNetCore.Tests` | ✅ 28 passed |
| `demo/ContactManager/AspNetCore.Tests` | ✅ 39 passed |
| `demo/RetroBoard/AspNetCore.Tests` | ✅ 33 passed |
| `demo/ExpenseTracker/AspNetCore.Tests` | ✅ 30 passed |
| `demo/HelpDesk/AspNetCore.Tests` | ✅ 61 passed |
| **Total .NET tests** | ✅ **436 passed across 6 projects** |

### Parity — cross-backend wire-diff

`bun run parity/run.ts` — ✅ **all 17 backends agree**. FeatureProbe fixture step (which now includes the v8.0.0 foundations block) fires every one of the 9 `expectBodyContains` tripwires on every backend:
- `"style":"caption"` (COMP-01)
- `"weight":"medium"` (COMP-02)
- `"variant":"switch"` (COMP-03)
- `"type":"avatar"` (COMP-04 wire type)
- `"size":"xl"` (COMP-04 size variant)
- `"initials":"AL"` (COMP-04 initials mode)
- `"tone":"success"` (COMP-04 tone axis)
- `"image":"https://vms.example/avatar-ada.png"` (COMP-04 image mode)
- `"icon":"user"` (COMP-04 icon mode)

Skill parity: agent-skill source files byte-identical (22090B); HTTP-served twins byte-identical (22271B) across the 2 skill-serving backends.

⚠️ Reproduced the banked `dotnet not in PATH` harness gotcha on first run — fixed by explicit `export PATH="$HOME/.dotnet:$PATH"` before `bun run parity/run.ts`. Documented in AGENTS.md gotcha #9.

## Task 2 — AA-contrast hand-check summary (all recorded in per-plan test file headers)

Fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new fg/bg pairs (banked lesson). Every new pair introduced by Phase 23 was hand-computed per plan:

- **COMP-01 caption** (23-01): initial `.vms-text--caption` at opacity 0.85 failed AA-normal 4.5:1 on light themes (3.58:1 over `--vms-bg`, 3.77:1 over `--vms-surface`). Fix landed same-plan via `color-mix(in srgb, var(--vms-text-muted) 70%, var(--vms-text))` follow-up rule; lifts every pair to ≥ 4.83:1 on default + all 12 themes. Rationale + before/after numbers in `viewmodel-shell/test/text-caption.test.ts` header.
- **COMP-02 weight** (23-02): font-weight change only; no new fg/bg pair; no AA hand-check needed.
- **COMP-03 switch** (23-03): thumb vs track pairs. Where color-only fell below 3:1 (OFF on 6 light themes; ON on dark-amber/blue/green/teal), state polarity redundantly carried by (1) thumb position translation, (2) `aria-checked` native ARIA, (3) 1.5px `--vms-border` outline — WCAG 1.4.11 non-color-carrier clause satisfied. No accent-deepening applied. Rationale in `viewmodel-shell/test/checkbox-switch.test.ts` header.
- **COMP-04 avatar** (23-04): white initials against every tone circle, default + 12 themes, at all 4 sizes. Where a pair failed AA-normal 4.5:1 (mostly the sm-size 11px initials against `warning` background), applied the `--vms-surface` KNOCKOUT pattern (banked from v5.1 steps marker) which is polarity-adaptive across light/dark themes. Icon-mode uses the same knockout. Rationale in `viewmodel-shell/test/avatar-render.test.ts` header.

## Task 3 — Verification page served on tailnet

**→ http://100.113.23.63:8184/ ←**

Built from `demo/Showcase/frontend` (Vite build → `demo/Showcase/AspNetCore/wwwroot/`), served with `python3 -m http.server 8184 --bind 100.113.23.63`. Asset smoke test:

| Asset | Status |
|---|---|
| `/` (index.html) | HTTP 200 |
| `/assets/index-*.css` (45.6kB) | HTTP 200 |
| `/assets/index-*.js` (132.5kB — real BrowserAdapter + Showcase logic) | HTTP 200 |
| `/assets/chart-*.js` (208.3kB — Chart.js chunk) | HTTP 200 |

Real shipped bundle. Server left running for Ashley to hit.

### What to eyeball (Foundations section — new for v8.0.0)

Navigate to the **Foundations** section (added in plan 23-07). Confirm each:

- **Caption tier** — a real TextNode with `style: "caption"` renders at a smaller size and softer color than adjacent `body` and `muted` TextNodes. The three-tier hierarchy should be visually distinct.
- **Weight variants** — TextNodes at `regular` / `medium` / `bold` weights are all at body-size; medium and bold should be visually heavier than regular. Composable with `style` — a `body`-styled medium-weight is what row primaries in future composites will consume.
- **Switch variant** — CheckboxNodes with `variant: "switch"` render as slider switches (track + thumb), not as native checkboxes. On-state and off-state should be clearly distinguishable. Click one — it should toggle (visual only; wire semantics unchanged from a normal checkbox).
- **AvatarNode grid** — should show avatars at every size (`sm`/`md`/`lg`/`xl`) × content-mode (`initials` / `image` / `icon` fallback) × tone (`danger`/`warning`/`success`/`info`). Circles should be perfectly round; initials centered and legibly sized per size; icon-mode uses a curated Lucide icon; image-mode shows a real image (if the mock URL loads — that's expected to 404, which will render as a broken-image icon per browser default; the framework doesn't ship a graceful image-fail fallback for v1).

Also confirm any other Showcase sections still render correctly (regression check).

### If sign-off is a "yes"

Orchestrator will:
1. Add sign-off note to this SUMMARY.md
2. Commit the finalized 23-09-SUMMARY.md
3. Kill the tailnet server
4. Mark Phase 23 complete (STATE.md / ROADMAP.md)
5. Report Phase 23 done → Ready for `/gsd:plan-phase 24` (Primary composites)

### If issues surface

Surface specific findings → orchestrator either:
- Spawns fix executor + returns to this checkpoint
- Or escalates via deviation protocol per AGENTS.md

## Phase 23 landing summary

| # | Plan | Requirement | Status | Commits |
|---|---|---|---|---|
| 1 | 23-01 TextNode.style caption | COMP-01 | ✅ | `97163e1`, `0846118`, `200e2d9` |
| 2 | 23-02 TextNode weight axis | COMP-02 | ✅ | `77609b7`, `2661807`, `0a974ee` |
| 3 | 23-03 CheckboxNode.variant switch | COMP-03 | ✅ | `734f6a2`, `95e0652`, `a069254` |
| 4 | 23-04 AvatarNode standalone | COMP-04 | ✅ | `caa6929`, `46ad23d`, `9c9e435` |
| 5 | 23-05 composite-nodes-layer design doc | COMP-01..04 | ✅ | `de2564a` |
| 6 | 23-06 AGENTS.md governance section | COMP-01..04 | ✅ | `f94e3cc` |
| 7 | 23-07 Showcase + parity FeatureProbe | COMP-01..04 | ✅ | `f6d3a48`, `6ab06c7`, `6c38071` |
| 8 | 23-08 CHANGELOG + MIGRATION | COMP-01..04 | ✅ | `f74480c` |
| 9 | 23-09 (this plan) | COMP-01..04 | ✅ signed off | (this SUMMARY commit) |

**NO release ship.** v8.0.0 releases at Phase 26 closeout per locked CONTEXT.md §Decisions 5. `package.json` still `7.1.0`, `.csproj` still `7.0.0`. No `npm publish`, no `dotnet nuget push`, no git tag.

**Foundations ready for downstream composites.** Every composite in Phase 24-25 can now consume `TextNode.style: "caption"`, `TextNode.weight`, `CheckboxNode.variant: "switch"`, and `AvatarNode` — the trained typography and control shapes their recipes need.
