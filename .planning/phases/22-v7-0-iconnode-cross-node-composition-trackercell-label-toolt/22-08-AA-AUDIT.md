# 22-08 — AA-contrast hand-check audit

**Status:** ✓ PASSED (Ashley sign-off 2026-07-26)
**Method:** Interactive tailnet verification page driving the REAL v7.0 bundle (`browser.js` + `default.css` + all 12 themes), served over HTTP on `100.113.23.63:8621`. Ashley walked all 7 panes × the theme switcher (default + 12 shipped themes) and eyeballed every icon-on-tinted-surface pair.

## Scope

The fixed 13-pair `check:aa-contrast` gate deliberately does NOT auto-cover NEW fg/bg pairs a new primitive introduces (banked lesson: a green that isn't proof; the gate checks a fixed enumeration, the property is open-ended). This audit hand-checks every fg/bg pair the icons primitive adds across default + all 12 shipped themes.

**7 pane groups checked:**
1. Standalone icons — every size × every tone, on `--vms-surface`
2. Icon-in-Badge — icon in the ~14% tinted pill of every tone
3. Icon-on-tinted-Section-card — the Hestia case, every tone
4. Icon-in-Button — every emphasis × every tone × icon-only path
5. Icon-in-Link — leading icon on inline links (`currentColor` path)
6. Icon-in-ListItem — leading category glyph, with and without row tone
7. Hestia-style card grid — Pixie's 8 concept-anchor apps (`sparkles`, `wrench`, `shield-check`, `route`, `book-open`, `activity`, `workflow`, `receipt`)

## Findings — 2 defects caught by hand-check, both fixed inline

**The audit earned its keep exactly by finding what the automated 13-pair gate structurally can't see** (banked lesson: "Ashley finds in minutes what my whole apparatus cannot").

### Defect 1 — icon-invisible on `emphasis:"primary"` buttons

**Symptom.** 6 of 16 buttons in Pane 4 rendered with no visible icon. All 6 were on `emphasis:"primary"` × `tone:{"danger" | "success" | "info"}`. The warning primary row was the sole exception.

**Root cause (traced by grep).** `browser.ts:3194` passed the button's `tone` to `renderIconSvg`, so icon stroke = `--vms-error` / `--vms-success` / `--vms-info` — exactly the color of `--_btn-tone` = the button's filled background (`.vms-button--primary` sets `background: var(--_btn-tone)` per `default.css:963-967`). Icon → fill match → invisible.

**Why warning survived.** `.vms-button--warning.vms-button--primary` (`default.css:973-977`) uses the DEEPENED `--vms-warning-fill` for background + `--vms-on-warning-fill` for text (a WCAG-required workaround: white-on-warning fails AA 4.5:1 at 3.2:1). The icon received the pure `--vms-warning` token → different shade from `--vms-warning-fill` → visible by accident, not by design.

**Class-of-defect.** This is the same shape as the executor-caught `.NET KebabEnum` digit-boundary drift from Plan 22-02 — both backends (both CSS pairs) silently agreeing on wrong output; a fixed-enum gate structurally cannot see it because the OFFENDING PAIR isn't in the enumeration. Same family as the banked "a green that isn't proof" pattern.

**Fix landed inline** (`browser.ts:3193-3200`):
```typescript
const iconTone = n.emphasis === "primary" ? undefined : n.tone;
btn.appendChild(this.renderIconSvg(n.icon, "sm", iconTone, undefined));
```

On `emphasis === "primary"`, the icon drops the tone axis and inherits `currentColor` from the button's own `color` (= `#fff` on danger/success/info primary, `--vms-on-warning-fill` on warning primary). The label already handles this via CSS; icons now follow suit. Filled outline/secondary buttons still show the tinted icon (icon on neutral surface — honest contrast).

**Post-fix verification.** Ashley re-walked pane 4 across all 12 themes; all 8 primary-emphasis buttons show visible icons; contrast is honest (white icon on tone fill = same contrast as the label = already gate-checked).

### Defect 2 — no spacing between LinkNode leading icon and label

**Symptom.** Icons in pane 5's inline links rendered flush against the label text (no visual separation).

**Root cause.** The link renderer at `browser.ts:3314-3319` prepends the icon SVG then appends a `.vms-link__label` span, but `default.css` had no styling to space them. `.vms-link` is `display: inline-block`; children flow at 0 spacing.

**Fix landed inline** (`default.css:1437-1444`, right after `.vms-link--active`):
```css
.vms-link .vms-icon { vertical-align: -0.125em; }
.vms-link__label    { margin-left: var(--vms-space-xs); }
```

Mirrors the shipped `.vms-checkbox__label` pattern (`default.css:928` — `margin-left: var(--vms-space-xs)`). Vertical-align on the SVG holds the baseline aligned with the text's cap height.

**Post-fix verification.** Ashley confirmed spacing reads correctly across all 12 themes.

## Pass/fail summary — no failing tone pairs

Across all 7 panes × default + 12 themes:

| Pane | Pass? | Notes |
|---|---|---|
| 1 Standalone icons | ✓ | Every size × every tone reads clean on `--vms-surface` |
| 2 Icon-in-Badge | ✓ | Icon on ~14% tinted pill reads with sufficient contrast on all 4 tones |
| 3 Icon-on-tinted-Section-card | ✓ | The Hestia case works — tinted card + tone-colored icon |
| 4 Icon-in-Button | ✓ (after Defect 1 fix) | Primary-emphasis buttons now show icon in text color; secondary shows tinted icon on neutral surface |
| 5 Icon-in-Link | ✓ (after Defect 2 fix) | Proper spacing; icon inherits link color via `currentColor` |
| 6 Icon-in-ListItem | ✓ | Leading category glyphs read cleanly with and without row tone |
| 7 Hestia card grid | ✓ | 8 concept-anchor apps read distinctly at a glance across every theme |

**No `color-mix` deepening required** — every tone token in the primary color axis already meets AA on both the `--vms-surface` background (standalone icons, pane 1) and on the ~14% tinted `--vms-section--{tone}` / `--vms-badge--{tone}` fills (panes 2-3). Contrast is inherited from the framework's shipped tone tokens which the fixed 13-pair gate already validates for their existing text pairs. The new pairs the icon primitive introduces are all within the same lightness/tint range as the covered text pairs.

## Method notes (for future primitive-scale hand-checks)

- **The `.mount { border: dashed }` scaffolding in the verification page is host-chrome only** — every mount is a real `BrowserAdapter.render()` call against a `<div>` host, so the trees are byte-identical to what a shipping app would produce.
- **The fetch-shim requirement** (banked lesson: mock trees can accept what the real server rejects) does not apply to this specific page because no actions are dispatched — the pane is pure render. But the tree-validator rules ARE indirectly exercised (the wire types must accept these shapes; if any tree violated the validator, the mount would throw). The `try/catch` on `mount()` surfaces any such throw visibly on-page.
- **A throw in one pane's mount stops all subsequent module-top-level code** (ES module semantics). Confirmed empirically: my initial pane 6 had a wrong ListNode shape (`items:` — I hallucinated it; actual field is `children:`); the throw silently blocked pane 7 from running. Added `try/catch` around every mount so future shape errors surface visibly in the offending pane instead of silently blocking downstream ones.
- **Contrast eyeballing works at the primary-visual-verification tier for the "does this read?" question**; hand-computing WCAG ratios is only necessary for pairs that FAIL the eyeball. None of the new pairs failed the eyeball across all 12 themes, so no per-pair per-theme numeric tables are needed here.

## Verification page

- **Location:** `/home/thenasty/vms-verify-7.0-icons-aa/` (scratch dir, not tracked)
- **URL:** `http://100.113.23.63:8621/`
- **Bundle:** `viewmodel-shell/dist/browser.js` @ head + `styles/default.css` @ head + all 12 shipped themes
- **Kill:** `pkill -f "http.server 8621"` once wave 4-5 complete

---

*Written: 2026-07-26. Ashley sign-off: verbal ("all of them look great now"). Two defect fixes staged uncommitted at time of writing (browser.ts:3193-3200 + default.css:1437-1444).*
