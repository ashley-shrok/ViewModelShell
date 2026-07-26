# IconNode + cross-node icon composition — VMS's first icon primitive

**Design of record.** Read before proposing any change to the icons work.

**Status:** LOCKED pending Ashley review 2026-07-26. Ready for `/gsd:plan-phase` on green-light.

**Milestone:** v7.0 — aligned npm + NuGet **major** release. Major bump is forced by the TrackerCell companion rename (see §7); icons themselves are additive.

## 1. Why + gap

VMS ships **zero** icon primitive today. Source comments state it explicitly, in two places:
- `viewmodel-shell/src/index.ts:1255-1256` — *"No icon field — the framework ships no icon set."*
- `viewmodel-shell-dotnet/ViewModels.cs:1666-1667` — same clause on the .NET twin.

The current workaround is emoji-in-TextNode-label (`label: "📧 Mail"`), which is **platform-inconsistent** by construction — every OS and browser renders the same codepoint differently, and the icon effectively can't be tinted, sized, or a11y-labelled. Every mature UI framework (Material, Chakra, Ant, shadcn/Lucide) ships icons as a first-class primitive. VMS is the outlier.

**Green-lit on the easy-yes rule** (Ashley, 2026-07-26):
- **Capability gap: STRONG** — no primitive, no clean fallback, all peers ship this.
- **Containment: STRONG** — self-contained render primitive with a name lookup; the ONE combinatoric decision (which set) is a one-time choice; no fan-out with the rest of the surface.
- Directly from Ashley (Hestia UX pass, relayed by Pixie 2026-07-26) → zero signal-count debate.

**Motivating use case:** the Hestia Pantheon launcher card grid — each of 8 app cards needs a visual identifier so users identify targets at a glance. Two independent consumers (Pixie, Angel's `/ai`) named the same cross-composition surfaces: **Button, Section (card), Badge, ListItem**.

## 2. Set choice — Lucide

**Bake the Lucide icon set into the browser bundle** (curated subset — see §6). Rationale, against a survey of the four viable candidates:

| Set | Verdict |
|---|---|
| **Lucide** | ✅ MIT, actively maintained (Feather fork, uniform 24×24 / 2px stroke), 1600+ icons available, standard in shadcn/ui + Chakra + Radix companions, tree-shakeable SVG package (`lucide-static`), all 8 of Pixie's concept anchors are literal Lucide names (`sparkles`, `wrench`, `shield-check`, `route`, `book-open`, `activity`, `workflow`, `receipt`). |
| Heroicons | Viable but ships THREE variants (24 outline, 24 solid, 20 mini) — complicates the wire (which variant? closed-enum per icon?), and forces a "size × variant" combinatoric that Lucide's uniform stroke avoids. |
| Material Icons | Google-branded / opinionated visual identity; traditionally font-based (heavier), and its per-icon "Material" aesthetic clashes with themes users override via `--vms-*` tokens. |
| Feather | The origin of Lucide, but dormant since 2018 — Lucide is where its community moved. |

**Doctrine consistency.** The framework owns the SVGs (bundled). The wire carries only a NAME (`icon: "sparkles"`), never an SVG payload — same shape as `TextNode.style` (name of a style, framework owns the CSS), `SectionNode.tone` (name of a tone, framework owns the color). Apps describe; framework renders. **The name is a CLOSED UNION** — every valid name corresponds to a bundled SVG; unknown names fail the tree validator (`invalid_tree`).

**Grows by addition.** Consumers who need an icon not in the curated set open a bounty naming the concept. The framework adds the SVG and the enum member in a minor release. Per Ashley's 2026-07-16 correction: **adding an enum member is additive** on both TS and .NET; existing consumer code compiles untouched.

## 3. IconNode — the standalone node

**Wire shape:**
```typescript
export interface IconNode {
  type: "icon";
  /** Closed-union name from the curated Lucide subset (see §6). */
  name: IconName;
  /** Size axis, shared with the framework's Button/CopyButton size enum.
   *  Default: "md" (renders 20px). */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /** Semantic tint. When absent, inherits `currentColor` from the
   *  surrounding text/element — the standard-framework default that keeps
   *  icons visually consistent with adjacent text without duplicating the
   *  tone axis at every callsite. */
  tone?: Tone;
  /** Accessible name for screen readers when the icon carries meaning
   *  INDEPENDENT of nearby text. When absent, the icon is treated as
   *  decorative and rendered `aria-hidden="true"`. Never rendered as
   *  visible text — this is the ARIA channel only. */
  label?: string;
}
```

**Size mapping** (framework owns; not on the wire beyond the enum name):

| Size | Pixel dimension |
|---|---|
| `xs` | 12px |
| `sm` | 16px |
| `md` | 20px (default) |
| `lg` | 24px |
| `xl` | 32px |

**Framework owns (never on the wire):**
- The SVG contents (inline from the bundled Lucide subset).
- The size mapping above.
- `stroke="currentColor"` — the SVG stroke inherits from the CSS color, so `tone` (or the parent's text color) drives visual color.
- `aria-hidden="true"` when `label` is absent; `role="img"` + `aria-label` when `label` is present.

**Rendered DOM (candidate):**
```html
<svg class="vms-icon vms-icon--md vms-icon--danger" role="img" aria-label="Delete"
     width="20" height="20" viewBox="0 0 24 24" fill="none"
     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <!-- inline paths from lucide-static/icons/trash-2.svg -->
</svg>
```

## 4. Cross-node icon composition — `icon?: IconName`

Standalone `IconNode` handles free-composition (icon in a paragraph, icon as a Section child). But four surfaces routinely couple an icon to another semantic element, and the ergonomic wire shape is a **name-only prop on the host node**, not a full `IconNode` child:

| Host node | Prop | Renders as | Framework picks |
|---|---|---|---|
| `ButtonNode` | `icon?: IconName` | Leading icon before the label (or icon-only — see §5). | Size = `sm` inline with button `size`; tone inherits from button `tone`. |
| `LinkNode` | `icon?: IconName` | Leading icon before the label (icon+text pair). | Size = `sm`; tone inherits from surrounding text (currentColor). |
| `SectionNode` | `icon?: IconName` | Prominent card icon rendered at the section header (the Hestia use case). | Size = `xl`; tone = section `tone` if set, else `currentColor`. |
| `Badge` | `icon?: IconName` | Leading icon inside the pill. | Size = `xs`; tone inherits from badge `tone`. |
| `ListItem` | `icon?: IconName` | Leading icon before item content (per-row category glyph). | Size = `sm`; tone inherits from item `tone`. |

**Why name-only, not `IconNode`.** The host node already carries `size` / `tone` in its own axes; embedding an `IconNode` with its own size/tone would create **two ways to say the same thing** (Ashley's philosophy warns against this) and let apps produce meaningless combinations (e.g. `Button size:"lg"` with an `IconNode size:"xs"` inside — which "wins"?). The name-only prop closes the loophole: the host owns the appearance, the icon is the CONTENT.

**When apps need a specifically-sized/toned standalone icon** — an icon inside a paragraph, or as a decorative Section child — they use `IconNode` and set `size`/`tone` explicitly. Composition boundary is clean: HOST slot ⇒ `icon: IconName`; STANDALONE ⇒ `IconNode`.

## 5. Icon-only ButtonNode — accessibility rule

An icon-only button is a real, useful pattern (toolbar close, row actions, table controls). But `<button><svg/></button>` with no text is a screen-reader void — a11y demands a name.

**The rule:** when `ButtonNode.icon` is set AND `label` is empty/absent, the framework **REQUIRES** `tooltip` to be set. The tooltip text double-duties as:
1. The hover-only info bubble (the 6.12.0 TOOL-01 styled tooltip that already ships on ButtonNode).
2. The button's `aria-label` (for screen readers).

**Validator enforcement** — both tree validators reject the tree at buildVm/action-response time with `invalid_tree` on:
```
button.icon != null && (button.label == null || button.label === "") && button.tooltip == null
```

Framework-detected failure → `{ok:false, errors:[{code:"invalid_tree", message:"icon-only ButtonNode requires tooltip (used as aria-label)"}]}` at 500.

**Why reuse `tooltip` instead of a new `ariaLabel` field.** An icon-only button almost invariably wants a hover-text explaining what it does (discoverability + a11y). Adding a separate `ariaLabel` would be redundant — two fields expressing the same "what does this button do" concept — and would allow the case where `tooltip = "Delete"` disagrees with `ariaLabel = "Remove item"`. Reusing the shipped `tooltip` field is compact, honest, and self-consistent.

## 6. Initial curated set — ~100 icons, Lucide names

The **framework SHIPS this exact set** in v1. It covers Pixie's Hestia 8 (marked ✱) plus a common-need bootstrap that lets a workflow app compose without immediately requesting additions. Consumers requesting a NEW icon file a bounty; framework adds in a minor release.

**Categories (Lucide names):**

- **Actions (24):** `check`, `x`, `plus`, `minus`, `edit`, `edit-3`, `trash`, `trash-2`, `save`, `download`, `upload`, `copy`, `clipboard`, `clipboard-copy`, `share`, `share-2`, `refresh-cw`, `rotate-ccw`, `search`, `filter`, `send`, `printer`, `pencil`, `eye`
- **Status (10):** `check-circle`, `check-circle-2`, `x-circle`, `alert-circle`, `alert-triangle`, `alert-octagon`, `info`, `help-circle`, `ban`, `loader-2`
- **Navigation (14):** `home`, `menu`, `more-horizontal`, `more-vertical`, `external-link`, `chevron-left`, `chevron-right`, `chevron-up`, `chevron-down`, `arrow-left`, `arrow-right`, `arrow-up`, `arrow-down`, `arrow-up-right`
- **Content (14):** `book-open`✱, `receipt`✱, `file`, `file-text`, `folder`, `folder-open`, `image`, `paperclip`, `link`, `link-2`, `calendar`, `clock`, `bookmark`, `mail`
- **Communication (5):** `message-square`, `message-circle`, `at-sign`, `phone`, `bell`
- **People (5):** `user`, `user-plus`, `user-check`, `users`, `user-x`
- **Objects (10):** `wrench`✱, `shield-check`✱, `shield`, `lock`, `unlock`, `key`, `star`, `heart`, `tag`, `flag`
- **Data / system (16):** `activity`✱, `workflow`✱, `route`✱, `database`, `server`, `hard-drive`, `cloud`, `wifi`, `bar-chart`, `line-chart`, `pie-chart`, `gauge`, `layers`, `settings`, `cpu`, `terminal`
- **Magic / accents (4):** `sparkles`✱, `zap`, `wand-2`, `flame`

**Total: ~102 icons.** Bundle size cost is small — each Lucide SVG averages ~500 bytes uncompressed; the whole subset is ~50KB uncompressed → single-digit KB after gzip in the browser bundle. Tree-shakeable further if adopters prove they use a fraction (out of scope for v1).

**Delivery mechanism.** Bundle the SVG source strings inline in the browser adapter (single ESM export: `const ICONS: Record<IconName, string> = { sparkles: "<path .../>", ... }`), NOT dynamic fetches. The browser bundle grows by ~a few KB gzipped; the wire carries only names. This is the same pattern as `default.css` — framework asset, name reference on the wire.

## 7. Companion — rename `TrackerCell.label` → `TrackerCell.tooltip` (breaking)

**Ashley-authorized 2026-07-26** — Molly (Metis) is the single fleet consumer of `TrackerCell`; permission to not preserve wire shape for her sake.

**Current state (verified by grep):**
- `TrackerCell.label?: string` (index.ts:1493 / ViewModels.cs)
- Renderer at `browser.ts:4160-4161`: `el.title = cell.label` — browser-native gray box, not the styled TOOL-01 bubble that shipped in 6.12.0-6.12.1 for the other 8 nodes.

**The rename:**
- Wire field: `label?: string` → `tooltip?: string`. Same type, same semantics (hover-only info + a11y fallback).
- Renderer: replace `el.title = ...` with the TOOL-01 styled-tooltip infrastructure (the `.vms-tooltip-host` body-appended singleton + JS positioning + edge-flip clamp that already ships in 6.12.1). The path is identical to what `Button.tooltip` / `TableColumn.tooltip` already route through.
- aria-label derivation unchanged (`aria-label = tooltip ?? state`).

**Why rename rather than add a parallel field.** Two ways to say the same thing (Molly's rejected Option B) creates the exact drift the framework's philosophy warns against. And `label` is used elsewhere in VMS for VISIBLE text (`ButtonNode.label`, `LinkNode.label`, `StatItem.label`) — using it for hover-only text on `TrackerCell` is a naming inconsistency the fleet accidentally lived with. Rename fixes both.

**Consumer impact:** Molly changes `label:` → `tooltip:` in her Metis buildVm (single mechanical rename). I DM her the heads-up + exact rename with a MIGRATION.md excerpt before publish.

**This is what forces v7.0.0** — the rename is a breaking wire change. Icons alone would be additive (minor). Per Ashley's batch-then-ship preference, the two ride together in one release ritual.

## 8. Accessibility

**Icon a11y is straightforward IF the discipline is enforced by the validator:**
- **Decorative icons** (`label` absent, adjacent text carries meaning): `aria-hidden="true"` — the SVG is invisible to screen readers, the text is the source of truth. This is the majority case (Button+icon+label, ListItem with row title).
- **Meaning-carrying icons** (`label` set): `role="img"` + `aria-label={label}` — the SVG announces as one thing. Used when the icon stands alone (a status indicator with no adjacent text, an icon-only navigation glyph).
- **Icon-only buttons** — `tooltip` REQUIRED (§5); becomes the `aria-label`. Validator enforced.

**Color contrast.** Default is `stroke="currentColor"` which inherits from the containing element's text color — so contrast follows the text's gate-checked contrast automatically. When `tone` is set, the icon uses that tone token — which means new tone/bg pairs COULD introduce fresh AA-contrast pairs the fixed 13-pair `check:aa-contrast` gate doesn't cover.

⚠️ **Per banked lesson:** hand-check white-on-tone (or on-fill) WCAG ratio for any NEW pair the icon primitive introduces, across the default + all 12 themes. Follow the SectionNode-tone precedent for icons rendered on tinted card surfaces (a card `tone:"warning"` with an `icon:"alert-triangle"` inside).

**Colorblindness.** Icons carry SHAPE + POSITION as their primary a11y channels; color is secondary. A colorblind user identifies a `trash` icon by the trash-can shape, not by red-vs-green. So icons are inherently colorblind-safe as long as: (a) shape is distinct (Lucide's uniform stroke + curated set already covers this), (b) meaning-carrying icons carry an aria-label (§5), (c) icons aren't used as color-only status strips (that's TrackerNode's job, with its own colorblind-safe palette).

## 9. TUI degradation

**TUI drops icons entirely for v1.** The TUI target is `@experimental` and explicitly not-invested-in (banked directive). Rendering SVG in a terminal isn't a v1 problem worth solving.

- `IconNode` renders as nothing (empty element or omitted from the tree walk).
- Cross-node `icon?:` props are ignored — the button/badge/section renders without an icon.
- No unicode-fallback mapping in v1 — deferred to a future v2 IF the TUI investment ever returns.

This is the honest degradation: TUI users see the framework's already-correct semantic content (labels, tooltips, aria-text) without the visual glyph. Zero framework maintenance cost.

## 10. Cross-backend parity

`IconNode` + the five cross-node `icon?:` props extend the wire in five places. The parity suite (`bun run parity/run.ts`) must green with:
- **New `expectBodyContains` coverage tripwires** (banked lesson: coverage-vs-comparison — a fixture step must assert a substring only its branch emits) for at least: standalone `IconNode`, `Button.icon` with label, `Button.icon` icon-only (with tooltip), `Section.icon`, `Badge.icon`, `ListItem.icon`, and each of the 5 sizes on a standalone icon.
- **Tree-validator descent** on both backends — the .NET walker and TS walker must descend into `IconNode`, and the icon-only-button rule must fire on both.
- **`name` is a closed union on BOTH sides** — TS union of ~102 string literals; .NET enum (per my closed-union-must-be-enum maintainer rule). Both sides ship a converter that emits the wire-value string (kebab-case names as sent).

**FeatureProbe extension** — EXTEND the existing FeatureProbe backends' `buildVm` (per the shipped v5.1 pattern; NOT a new fixture file) to emit an `IconNode` + the cross-node props; append the coverage clause to `$comment`.

## 11. Release

- **Aligned npm + NuGet v7.0.0** major. Major forced by §7's TrackerCell rename. Icons alone = additive.
- Green-tree gate throughout (vitest, `check:test-types`, `check:core-globals`, `check:aa-contrast` (+ hand-check the icon-on-tone pairs), `check:no-demo-style`, `check:demo-types`, framework `viewmodel-shell-dotnet/Tests`, every `demo/**/*.Tests.csproj`, parity 17+ backends).
- `agent-skill.md` — icons are new NODE types, not new wire-protocol verbs — skill enumerates the protocol, not the node catalog. **No agent-skill.md change** for icons. The TrackerCell rename is a wire field name change; verify whether it appears in `agent-skill.md` (probably doesn't — the skill covers the protocol envelope, not per-node fields).
- ONE combined **tailnet verification page** (Hestia-style card grid with all 8 concept anchors + icon-in-Button/Badge/ListItem examples + all 5 sizes + tone matrix + a live TrackerCell strip showing the new tooltip render), served over the tailnet, light + dark, for Ashley pre-publish sign-off.
- CHANGELOG entry (icons additive summary + TrackerCell breaking rename); MIGRATION entry (the ONE break: consumer renames `label` → `tooltip` on TrackerCell).
- Molly heads-up on the relay BEFORE publish so Metis's Phase 6 planning is uninterrupted.
- Publish ritual per AGENTS.md; tag `v7.0.0`; advance `main`; announce `#vms-changelog`.

## 12. Out of scope (v1)

- **Multiple icon sets.** VMS bundles Lucide. Consumers pick names from that set.
- **Custom SVG upload / arbitrary SVG on the wire.** Violates apps-describe; would drag the icon-set-choice problem back onto every consumer. Not now, likely not ever.
- **Icon variants** (filled/outlined). Lucide is stroke-only which is fine; consistent visual identity.
- **Icon animations** (spinning loader, pulse). If needed later, add a scoped `spin?: boolean` on IconNode — deferred.
- **Icon size × tone × emphasis combinatorics beyond what's here.** Size + tone is enough for v1. Add on evidence.
- **TUI unicode fallback.** Deferred (v1 drops icons in TUI; §9).
- **Trailing icons on Button/Link.** V1 is leading-only. Trailing is a real precedent (MUI `endIcon`) but adds a "leading vs trailing" axis; defer until asked.

## 13. Requirement IDs

- **ICON-01** — `IconNode` wire type on both backends: closed-union `name`, optional `size`/`tone`/`label`. Both tree-validators descend. `.NET` name as enum with converter. `WhenWritingNull` on optional fields; `size`/`tone` treated as optional strings on the wire (absent = default).
- **ICON-02** — Curated Lucide subset (§6, ~102 icons) inline-bundled in the browser adapter; `ICONS: Record<IconName, string>` map with the SVG path payloads.
- **ICON-03** — Browser renderer: emit `<svg class="vms-icon vms-icon--{size} vms-icon--{tone}" ...>` with the payload from `ICONS[name]`; `role`/`aria-label` per §8. jsdom tests verify DOM shape and a11y attributes.
- **ICON-04** — Cross-node `icon?: IconName` on `ButtonNode`, `LinkNode`, `SectionNode`, `Badge`, `ListItem`; framework renders at host-appropriate size (§4 table); both backends.
- **ICON-05** — Icon-only ButtonNode validator: `icon && !label && !tooltip` → tree-validator throws `invalid_tree` on both backends; test coverage on both.
- **ICON-06** — TrackerCell rename: `label` → `tooltip` (both backends); renderer path swap to TOOL-01 styled tooltip infrastructure; MIGRATION entry; Molly relay heads-up.
- **ICON-07** — TUI drops icons (empty render, no error).
- **ICON-08** — AA-contrast hand-check for any NEW icon-on-tone / icon-on-fill pairs the primitive introduces, across default + 12 themes.
- **ICON-09** — Parity: FeatureProbe `buildVm` extended in all backends to emit the surfaces above; `expectBodyContains` tripwires per §10; `bun run parity/run.ts` green.
- **ICON-10** — Demo usage: Showcase page carrying every icon at every size + a Hestia-style card grid using Pixie's 8 apps; interactive tailnet verification page for Ashley sign-off.
- **ICON-11** — Aligned npm + NuGet v7.0.0 release: CHANGELOG + MIGRATION (the ONE break = TrackerCell rename); operator-gated publish; tag `v7.0.0`; advance `main`; `#vms-changelog` announce.

---

*Related bounty: `icons-primitive` at `~/.claude/identities/vicky/bounties/icons-primitive/bounty.json`.*
