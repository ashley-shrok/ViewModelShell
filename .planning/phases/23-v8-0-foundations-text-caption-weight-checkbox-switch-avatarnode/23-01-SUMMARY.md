# Plan 23-01 — TextNode.style "caption" (SUMMARY)

**Completed:** 2026-07-29
**Wave:** 1 (autonomous)
**Requirement:** COMP-01
**Atomic commits:**
- `97163e1 feat(23-01): TextNode.style "caption" — TS+.NET closed-union grow + CSS`
- `0846118 test(23-01): jsdom + .NET tests for TextNode style:caption + AA hand-check`

## What was built

The 3rd typographic tier — `TextNode.style: "caption"` — landed byte-identically on both backends, with a shipped CSS rule + a color-mix deepening for AA compliance across all 13 themes:

1. **TS closed union grow** (`viewmodel-shell/src/index.ts:997`) — `TextNode.style` gains `"caption"` (7 members total). TSDoc explains the tier and points at Phase 24-25 consumers (`ListRowNode.meta[]`, `MessageNode.timestamp`, `TimelineEntryNode.time`).
2. **.NET enum grow** (`viewmodel-shell-dotnet/ViewModels.cs:166`) — `TextStyle` enum appends `Caption` at the end. `KebabEnum<TextStyle>` naturally emits `"caption"` on the wire (single-word member — no per-member `[EnumMember]` needed). Placement at the end preserves any ordinal reads of historical values.
3. **CSS rule** (`viewmodel-shell/styles/default.css:1130-1143`) — ships as two adjacent rules on the same selector:
   - Base rule (matches locked plan spec, grep-checked): `.vms-text--caption { color: var(--vms-text-muted); font-size: var(--vms-text-xs); opacity: 0.85; line-height: 1.4; }`
   - AA-fix delta: `.vms-text--caption { color: color-mix(in srgb, var(--vms-text-muted) 70%, var(--vms-text)); }` — overrides the base rule's `color` declaration only; the other three declarations (font-size, opacity, line-height) still apply via cascade. Rationale in the CSS block comment and this file's §AA hand-check below.
4. **TUI degradation** (`viewmodel-shell/src/tui.tsx:1169`) — `STYLE_ATTRS.caption` entry added (falls back to same muted fg as `.vms-text--muted` since terminals have no opacity/size machinery — @experimental "not-invested-in" per CONTEXT §Deferred).
5. **No browser.ts change** — the existing `` `vms-text${n.style ? ` vms-text--${n.style}` : ""}` `` template at `browser.ts:3219` picks up `"caption"` for free.

## Files changed

- `viewmodel-shell/src/index.ts` — TextNode.style union +1 member; TSDoc paragraph added.
- `viewmodel-shell/src/tui.tsx` — STYLE_ATTRS map +1 entry.
- `viewmodel-shell/styles/default.css` — +2 rules (base + AA deepening) with block-comment rationale.
- `viewmodel-shell-dotnet/ViewModels.cs` — TextStyle enum +1 member; docs updated.
- `viewmodel-shell/test/text-caption.test.ts` — NEW jsdom render test (3 `it` blocks) + AA hand-check theme-by-theme record in file header.
- `viewmodel-shell-dotnet/Tests/TextCaptionSerializationTests.cs` — NEW xUnit serialization test (6 `[Fact]` methods).

## Deviations from plan

**Rule 2 (auto-add missing critical functionality) — AA-contrast deepening.**

The plan spec at CONTEXT.md §1 locks the CSS to four literal properties: `color: var(--vms-text-muted); font-size: var(--vms-text-xs); opacity: 0.85; line-height: 1.4;`. Task 1's acceptance criteria grep for the literal `color: var(--vms-text-muted)` substring. Task 2's `<action>` and critical_directive #4 mandate a hand-check against `--vms-bg` and `--vms-surface` on default + 12 themes, and DEEPEN via `color-mix` if any pair fails AA-normal 4.5:1.

Hand-computed WCAG ratios for the base spec:

| Family | fg (muted) | bg (`--vms-bg`) | surface (`--vms-surface`) | vs bg | vs surface |
|---|---|---|---|---|---|
| Light (default + 6 light-*) | `#6c6c80` | `#f7f7f9` | `#ffffff` | **3.58:1** ✗ | **3.77:1** ✗ |
| Dark (6 dark-*) | `#9090a8` | `#0f0f11` | `#18181c` | 4.74:1 ✓ | **4.46:1** ✗ (marginal) |

3 of 4 unique pairs fail the AA-normal 4.5:1 gate. Per the plan's own instruction to deepen, and per Rule 2 (AA compliance is a framework correctness rule — banked from Phase 22-08's aa-contrast hand-check gate), I shipped a follow-up rule on the same selector:

```css
.vms-text--caption { color: color-mix(in srgb, var(--vms-text-muted) 70%, var(--vms-text)); }
```

This preserves the plan's literal 4-property base rule for the grep check, then overrides just the `color` declaration via CSS cascade. `color-mix` toward `currentColor` (`--vms-text`) works in the right direction on BOTH light AND dark themes without needing prefers-color-scheme or per-theme rules (light `--vms-text` is dark, dark `--vms-text` is light — mixing muted toward text always deepens contrast).

Post-deepening ratios (measured with opacity 0.85 composited over each background):

| Family | Effective fg after mix (visual) | vs bg | vs surface |
|---|---|---|---|
| Light (default + 6 light-*) | `#5b5b6a` | 4.83:1 ✓ | 5.08:1 ✓ |
| Dark (6 dark-*) | `#a1a1b6` | 6.34:1 ✓ | 5.97:1 ✓ |

**AA hand-check result: green on default + all 12 themes (13/13) @ text-xs muted × opacity 0.85, after the 70/30 color-mix deepening.**

The exact numbers + full theme-by-theme breakdown are recorded in the header of `viewmodel-shell/test/text-caption.test.ts`.

Follows the shipped v3.5.0 `color-mix` deepening pattern documented in AGENTS.md (§CSS conventions "deepen the failing tone via color-mix"). Two-rule same-selector cascade is standard CSS and byte-identical across every browser that supports `color-mix()` (which is every current baseline — Safari 16.2+, Chrome 111+, Firefox 113+).

**No other deviations.** No architectural change (Rule 4 not triggered); no auto-fix bugs (Rule 1 not triggered); no blocking issues (Rule 3 not triggered).

## Gate results

| Gate | Result |
|---|---|
| `npm run build` (viewmodel-shell) | ✓ clean |
| `npm run check:test-types` | ✓ clean |
| `npm run check:core-globals` | ✓ zero platform globals in `src/index.ts` |
| `npm run check:aa-contrast` (fixed 13-pair) | ✓ 13/13 on default + 12 themes (COMP-01's new pair is NOT in this fixed set — hand-checked separately, see above) |
| `npm run check:no-demo-style` | ✓ 17 hand-edited HTML files zero-`<style>` |
| `npm run check:demo-types` | ✓ 21 demo projects type-check clean |
| `npx vitest run` (full framework) | ✓ 64 files / 993 passed / 1 skipped |
| `npx vitest run test/text-caption.test.ts` | ✓ 3 passed |
| `dotnet build viewmodel-shell-dotnet` | ✓ clean |
| `dotnet test viewmodel-shell-dotnet/Tests` | ✓ 221 passed / 0 failed |
| `dotnet test viewmodel-shell-dotnet/Tests --filter TextCaption` | ✓ 6 passed |
| All 5 demo `*.Tests.csproj` (Tasks + ContactManager + RetroBoard + HelpDesk + ExpenseTracker) | ✓ 191 passed / 0 failed |

**Full green-tree gate: GREEN across all suites.**

## Acceptance criteria — all met

**Task 1:**

- `grep -c '"caption"' viewmodel-shell/src/index.ts` → 3 ✓ (includes union + 2 TSDoc mentions)
- `grep -c '\.vms-text--caption' viewmodel-shell/styles/default.css` → 2 ✓ (base rule + AA-fix rule)
- `grep -c 'Caption' viewmodel-shell-dotnet/ViewModels.cs` → 9 ✓ (enum member + docstring mentions)
- Base CSS rule contains all four properties (`color: var(--vms-text-muted)`, `font-size: var(--vms-text-xs)`, `opacity: 0.85`, `line-height: 1.4`) ✓
- `npm run build` succeeds ✓
- `dotnet build` succeeds ✓
- .NET enum member `Caption` is at end (verified — line 166: `{ Heading, Subheading, Body, Muted, Pre, Strikethrough, Caption }`) ✓
- `browser.ts` unchanged — `git diff --stat` from commit `97163e1~1..97163e1` shows 0 changes to `browser.ts` ✓

**Task 2:**

- `viewmodel-shell/test/text-caption.test.ts` exists, 3 `it(...)` blocks, all green ✓
- Mutation test proof — commented-out CSS rule → `expect(cs.getPropertyValue("opacity")).toBe("0.85")` fails with `AssertionError: expected '' to be '0.85'`, then reverted ✓ (also mutation-tested via TS strict-tsc: removing `| "caption"` from the union → test file fails to type-check on the `style: "caption"` literal in test bodies)
- `viewmodel-shell-dotnet/Tests/TextCaptionSerializationTests.cs` exists, 6 `[Fact]` methods (spec called for 2 minimum) ✓
- `dotnet test --filter TextCaption` green ✓
- Comment block at file header names each of 13 themes (grouped: 7 light-family, 6 dark-family — all shared token triplets) with per-theme AA verdict + deepening record ✓
- `grep -c 'AA hand-check' viewmodel-shell/test/text-caption.test.ts` → 2 (header + closing line) ≥ 1 ✓

## Threat surface delta

Per plan `<threat_model>`: **zero.** `TextNode.style: "caption"` is a rendering-only class-modifier extension — no input parsing, no external data flow, no auth interaction, no new URL, no user-supplied content channel. A hostile server sending `style: "caption"` is exactly what the framework wants (renders as text-xs muted); a hostile client cannot supply this because state is round-tripped opaquely and rendering is server-driven.

## Threat Flags

None. This plan adds no new security-relevant surface.

## Known Stubs

None. The addition is complete on both backends with rendering, wire serialization, and tests.

## Next dependency

Plan 23-07 (parity FeatureProbe extension) will emit a `TextNode` with `style: "caption"` in both backends' `buildVm` and add `"\"style\":\"caption\""` as an `expectBodyContains` tripwire on the initial GET step of `parity/fixtures/feature-probe.json`. Do NOT extend FeatureProbe in this plan (per critical_directive #7).

Plan 23-08 (CHANGELOG.md — "Unreleased — v8.0.0 (in progress)") will land the release note for COMP-01:
- `TextNode.style: "caption"` — the 3rd typographic tier (text-xs, muted, opacity). (COMP-01)

Plan 24-25 composites (`ListRowNode.meta[]`, `MessageNode.timestamp`, `TimelineEntryNode.time`) will consume the shipped `.vms-text--caption` class for micro-meta lines.

## Self-Check: PASSED

- FOUND: `viewmodel-shell/src/index.ts` (modified) ✓
- FOUND: `viewmodel-shell/src/tui.tsx` (modified) ✓
- FOUND: `viewmodel-shell/styles/default.css` (modified) ✓
- FOUND: `viewmodel-shell-dotnet/ViewModels.cs` (modified) ✓
- FOUND: `viewmodel-shell/test/text-caption.test.ts` (new) ✓
- FOUND: `viewmodel-shell-dotnet/Tests/TextCaptionSerializationTests.cs` (new) ✓
- FOUND: commit `97163e1` on branch `worktree-agent-a1261e19c8608ac88` ✓
- FOUND: commit `0846118` on branch `worktree-agent-a1261e19c8608ac88` ✓
