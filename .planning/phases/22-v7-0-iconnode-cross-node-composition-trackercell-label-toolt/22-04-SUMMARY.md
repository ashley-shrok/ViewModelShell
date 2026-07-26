# Plan 22-04 — Browser renderer + ICONS payload + CSS (SUMMARY)

**Completed:** 2026-07-26
**Wave:** 2 (autonomous)
**Requirements:** ICON-02, ICON-03
**Atomic commit:** `dbcc0b0 feat(22-04): browser renderer + ICONS payload + CSS for icons primitive`

## What was built

The render pass for the v7.0.0 icons primitive:

1. **Generator script** — `viewmodel-shell/scripts/generate-icons-payload.mjs`. One-shot script reading lucide-static SVGs, extracting inner `<path>`/`<circle>`/`<line>` elements, emitting `src/icons-payload.ts`. Idempotent re-runs.
2. **`ICONS` payload map** — `viewmodel-shell/src/icons-payload.ts` (generated). Byte-identical `Record<IconName, string>` with 102 entries from `lucide-static v1.27.0`. Pure ESM string map; zero platform-global refs; imported ONLY by `browser.ts`.
3. **`renderIconSvg` helper** — single shared factory in `browser.ts` used by BOTH the standalone `icon()` renderer AND the 5 host cross-node emissions. Anti-drift by construction (one place to change).
4. **`icon()` renderer + `case "icon":` dispatch arm** — standalone IconNode support in the browser adapter. Uses `createElementNS("http://www.w3.org/2000/svg", ...)` (SVG namespace is REQUIRED — `createElement("svg")` produces HTMLUnknownElement which renders as nothing in real browsers). Emits design-doc §3 wrapper attrs; a11y dispatch on label presence.
5. **Cross-node leading-icon emission** on 5 hosts per design-doc §4:
   - **Button**: size sm, tone inherited from button.tone
   - **Link**: size sm, NO tone class (inherits currentColor)
   - **Section**: size xl, tone inherited from section.tone (ALL 3 branches — default, link-wrapper, collapsible summary)
   - **Badge**: size xs, tone inherited from badge.tone
   - **ListItem**: size sm, tone inherited from list-item.tone
6. **`.vms-icon*` CSS** — base + 5 sizes + 4 tone classes in `viewmodel-shell/styles/default.css`. Tone classes drive `color:` from existing framework tokens (`--vms-info`, `--vms-success`, `--vms-warning`, `--vms-error`); the SVG's `stroke="currentColor"` inherits from these.
7. **13 jsdom tests** in `test/icon-render.test.ts` covering standalone rendering (5 sizes, decorative vs meaning-carrying a11y), all 5 host cross-node emissions, icon-only Button a11y integration, and a regression guard for the optional `icon?` posture.

## Files changed

- `viewmodel-shell/scripts/generate-icons-payload.mjs` — new generator.
- `viewmodel-shell/src/icons-payload.ts` — new generated payload map.
- `viewmodel-shell/src/browser.ts` — `import IconNode/IconName/ICONS`; `renderIconSvg` helper; `icon()` method + dispatch arm; leading-icon emission blocks in `button()`/`link()`/`section()` (3 branches)/`badge()`/`listItem()`.
- `viewmodel-shell/styles/default.css` — `.vms-icon` + 5 size modifiers + 4 tone modifiers.
- `viewmodel-shell/test/icon-render.test.ts` — 13 new tests.
- `viewmodel-shell/package.json` — `lucide-static @ ^1.27.0` as devDep.
- `viewmodel-shell/package-lock.json` — lockfile update.

## Deviations from plan

### 1. Tone set is 4 (danger/warning/success/info), not 6 (plan expected 6 including muted + brand)

The plan (task 22-04-04) called for six tone classes `.vms-icon--info/success/warning/danger/muted/brand`. But the actual TS source of truth (`viewmodel-shell/src/index.ts`) declares `IconNode.tone?: "danger" | "warning" | "success" | "info"` — the framework's shipped closed union with 4 members (matching every other node's tone axis: `SectionNode.tone`, `BadgeNode.tone`, `ButtonNode.tone`, etc.). Adding `muted` and `brand` would extend the union beyond the design-doc §3 shape.

**Fix:** matched the CSS to the actual union (4 tones), not the plan's 6. This is byte-consistent with the rest of the framework's tone axis and passes the TS type-check.

If the future wants `muted` and `brand` on icons specifically, that's an additive change to the closed union (add members to both TS + .NET simultaneously) + matching CSS — worth its own bounty, not silently ex-scope.

### 2. `--vms-danger-fg`-style token names don't exist

The plan (task 22-04-04) suggested token names `--vms-info-fg`, `--vms-danger-fg`, etc. The framework's actual shipped tokens are `--vms-info`, `--vms-success`, `--vms-warning`, `--vms-error` (with `danger` mapping to `error` — the tone-to-token layer). Used the real shipped token names.

### 3. Content emission via nested `label` span, not textContent

Adding a leading `<svg>` to hosts that previously set `textContent` (which replaces all children) required a small change to those renderers: wrap the label in a nested `<span class="vms-{host}__label">…</span>` when an icon is present, so both the icon and the label coexist. This mirrors how ListItemNode already worked with its `vms-list-item__marker` glyph.

## Gate results

| Gate | Result |
|---|---|
| `npx vitest run` (full framework) | ✓ 62 files / 981 passed / 1 skipped (was 968 → +13 new) |
| `npx vitest run test/icon-render.test.ts` | ✓ 13 / 13 passed |
| `npm run check:core-globals` | ✓ index.ts platform-global-free (icons-payload.ts is imported only by browser.ts) |
| `npm run check:test-types` | ✓ clean |
| `npm run check:demo-types` | ✓ 20 demo projects clean (after `dist/` rebuild) |
| `npm run check:no-demo-style` | ✓ 16 hand-edited HTML files zero-`<style>` |
| `npm run check:aa-contrast` | ✓ 13/13 pairs on default + 12 themes (existing pairs; new icon-on-tone pairs are Plan 22-08's hand-check scope) |

## Acceptance criteria — all met

- `ICONS: Record<IconName, string>` exists with 102 entries ✓
- `case "icon": return this.icon(n, parent);` in dispatch switch ✓
- `private icon()` method exists ✓
- Method uses `createElementNS`, `viewBox="0 0 24 24"`, `stroke="currentColor"`, `vms-icon--`, `role`, `aria-label`, `aria-hidden` ✓
- Method uses `n.size ?? "md"` default ✓
- Cross-node emission on all 5 hosts uses shared `renderIconSvg` ✓
- Button icon call passes size `"sm"` ✓
- Section icon call passes size `"xl"` ✓
- Badge icon call passes size `"xs"` ✓
- CSS: base + 5 sizes + 4 tones (12 total per acceptance) ✓ (12 `.vms-icon*` selectors)
- Test file exercises all 5 hosts ✓
- Test file has both decorative (aria-hidden) and meaning-carrying (role=img + aria-label) cases ✓
- Test file's icon-only-button case asserts button-level a11y (`title` + `data-vms-tooltip`) ✓

## Next dependency

Plan 22-05 (TrackerCell tooltip render swap) — replaces the `el.title = cell.tooltip` line in browser.ts's tracker renderer with the shipped 6.12.1 `.vms-tooltip-host` singleton wiring (`applyTooltip(cell, cell.tooltip)`).

Plan 22-06 (TUI drop icons) — teaches the TUI renderer that `case "icon":` returns null and the 5 host `icon?:` props are ignored.

## Known follow-ups (out of scope for this plan)

- **Plan 22-08 AA-contrast hand-check** — the new icon-on-tone pairs the primitive introduces (icon-inside-badge-with-matching-tone, icon-on-card-with-tone) MUST be hand-checked across default + 12 themes. Only the existing 13 gate pairs are auto-covered. Failing pairs get deepened via `color-mix` per the shipped v3.5.0 pattern.
- **Bundle size** — the icons-payload.ts adds ~18KB uncompressed / a few KB gzipped to the browser bundle. Under the design-doc §6 acceptable-cost threshold.
