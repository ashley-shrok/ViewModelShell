# Layout System — Primitive-Set Research & Recommendation

**Status:** Research synthesis for decision. No implementation yet.
**Date:** 2026-06-24
**Question being answered:** What is the right general layout vocabulary for VMS — grounded in mature frameworks — so the frontend can build any app's layout without (a) per-need bespoke tokens sprawling forever, or (b) leaking raw CSS into the wire?

This doc synthesizes four parallel research passes: the **CSS-grid framework family** (Bootstrap, Tailwind, Foundation + native CSS), **component libraries** (MUI, Chakra, Radix, Mantine), **first-principles primitives** (Every-Layout, Braid, Primer, Spectrum, CUBE), and **declarative-native UI** (SwiftUI, Jetpack Compose, Flutter). Sources are linked at the bottom.

---

## The headline (and the surprise)

**The winning general grid is the *intrinsic auto-fit min-width grid*, NOT the 12-column placement grid — and VMS already ships it as `layout:"cards"`.**

Every one of the four research families independently converged on the **same** breakpoint-free grid mechanism:

```css
grid-template-columns: repeat(auto-fit, minmax(min(var(--itemMin), 100%), 1fr));
```

- Every-Layout's `Grid` primitive — identical.
- Chakra `SimpleGrid minChildWidth`, Bulma Smart Grid, Pico `.grid` — identical.
- SwiftUI `GridItem(.adaptive(minimum:))`, Compose `GridCells.Adaptive(minSize)`, Flutter `SliverGridDelegateWithMaxCrossAxisExtent` — the same idea (give a tile min/max size, the engine computes the column count from *container* width).
- VMS `--vms-card-min` + `layout:"cards"` — **already this.**

The implication reframes the whole effort: the "general substrate" the user reached for is not a thing we need to build — **it's already the correct, industry-converged primitive and VMS has it.** The 12-column placement grid (Bootstrap/Tailwind `col-span-N`) is, per the research, the *wrong* substrate for VMS because **it is breakpoint-driven by construction** — a `.col-md-4` only becomes 4/12 *inside* a `@media (min-width:768px)` rule; the author/framework must enumerate viewport tiers. That violates VMS's hard constraint ("framework owns responsiveness, zero app breakpoints"). The number 12 is just a divisibility convenience and carries no benefit here.

So the work is **not a grid rewrite.** It's: (1) complete the *primitive set* (one genuine gap), (2) add the *alignment/arrangement enums* the row primitive is missing (this subsumes the `justify` header-bar request), and (3) optionally adopt one high-leverage *responsive-selection* idea. Details below.

---

## The two principles the research validates

These become the standing test for **every future layout change** — so we answer the next request with a test, not a debate:

1. **Responsiveness must be intrinsic — container-relative, zero author/viewport breakpoints.** The proven mechanisms that pass: auto-fit `minmax(min(X,100%),1fr)` grid; flex-wrap + flex-basis; the Every-Layout Sidebar (Holy Albatross) and Switcher (negative-flex-basis flip); `min/max/clamp` sizing; and (as the explicit escape hatch) **CSS container queries** — never viewport `@media`, which is structurally wrong for a placement-agnostic server tree (the server doesn't know the viewport, nor where a node will sit, nor how wide its slot is). Container queries are Baseline "widely available" as of 2025 — production-safe.

2. **Every knob is a closed enum or bounded scalar — never raw CSS.** Radix Themes is the model: its entire layout API is closed enums (spacing `"0"–"9"`, container `1–4`, grid columns `"1"–"9"`), arbitrary CSS confined to explicit escape-hatch fields. This is what keeps the layout subtree legible and theme-safe even though (per the earlier agent-legibility discussion) layout fields are allowed to be more mechanism-flavored than the rest of the tree, *because they're ignorable.* "Ignorable" buys richer flow knobs; it does **not** buy raw CSS or mobile-breaking placement.

A field may join the layout vocabulary **iff it passes both.** `justify:"space-between"` passes (intrinsic, closed). A 12-col `colSpan` fails both (needs breakpoints to re-place; spans are an open-ish int against a placement grid). Container-query reflow passes. Viewport `{xs,md,lg}` objects fail #1.

---

## The convergent primitive set

The four families agree on an **irreducible core of three**, a **+3 completeness tier**, and a clear **specialist/defer** bucket. Mapped against what VMS already has:

### Tier 0 — irreducible core (every framework has these)
| Primitive | Role | Responsive mechanism | VMS today |
|---|---|---|---|
| **Stack** | vertical rhythm | pure-intrinsic (owl margin / flex-col) | ✅ `stack` |
| **Cluster** | wrapping horizontal group | pure-intrinsic (flex-wrap) | ✅ `row` |
| **Grid (auto-fit)** | tile grid, column count by space | one param (`min` item width) | ✅ `cards` (`--vms-card-min`) |

### Tier 1 — completeness (+3; each closes a gap the core can't)
| Primitive | Gap it closes | VMS today |
|---|---|---|
| **Sidebar** | fixed-aside + fluid-main that collapses by *content width*, not viewport — **a grid cannot do this** | ✅ `sidebar` |
| **Switcher** | N equal items that flip **all-row ↔ all-stack atomically**, never an awkward "2-then-1" — **a grid cannot do this** | ❌ **MISSING** |
| **Center (nestable)** | center + measure-cap an arbitrary *inner subtree* (not just the page) | ◐ page-level only (`--vms-page-max`) |

### Tier 2 — specialist (defer / skip)
| Primitive | When | VMS today | Verdict |
|---|---|---|---|
| **Box / surface** | padded bordered surface | ✅ `section variant:"card"` | covered |
| **Overlay/Imposter** | centered overlay | ✅ `modal` | covered |
| **Cover** | vertical-center a region (login/splash/empty-state) | ❌ | defer until an app needs it |
| **Frame** | aspect-ratio media crop | ❌ | skip (not a forms/tables concern) |
| **Reel** | horizontal scroll shelf | ❌ | skip (niche) |

**The load-bearing finding:** of all 12 Every-Layout primitives, exactly **two are genuine flexbox idioms a column-grid fundamentally cannot reproduce** — **Sidebar** (Holy Albatross: `flex-grow:999` + `min-inline-size:50%` coupled wrap) and **Switcher** (negative-flex-basis atomic axis-flip). These are the primitives that *earn their name* — they can't be folded into the grid substrate. VMS has Sidebar. **VMS is missing Switcher.** Everything else is either a grid/flex configuration (foldable) or a different concern (overlay→modal, surface→card).

---

## The alignment / arrangement enums (this is where `justify` lives)

The declarative-native toolkits give us the exact closed unions to copy, with **Compose and Flutter agreeing on the justify set verbatim**:

- **Main-axis arrangement (`justify`/`arrange`)** — on `row` (and any flex container):
  `start | center | end | space-between | space-around | space-evenly`
  (Compose `Arrangement` ∩ Flutter `MainAxisAlignment`, exact agreement. The PBMInvoices header-bar request = `space-between` on a `row` with a heading-TextNode first child.)
- **Cross-axis alignment (`align`)**:
  `start | center | end | stretch | baseline`
  (Flutter `CrossAxisAlignment`, the fullest set. `baseline` deferrable; ship `start|center|end|stretch` first.)
- **Fixed gap** — a bounded spacing-scale token (Radix `"0"–"9"` / Compose `spacedBy` / Flutter `spacing`), not raw CSS.
- **Fill / push-apart** — two idioms exist: a per-child `grow`/`weight` bounded int (Compose `weight`, Flutter `flex`), or a dedicated `Spacer` node. For VMS, **`arrange:"space-between"` covers ~90% of bars**; a `Spacer{grow}` node is the secondary, more-expressive tool. Recommend shipping `arrange` first; add `Spacer` only if a real asymmetric case appears.

This generalizes the original `justify`-on-`row` request into the proper, framework-grounded enum rather than a one-off.

---

## The one genuinely new idea worth borrowing: responsive *selection*

SwiftUI's **`ViewThatFits`** is unique among all surveyed systems and is the cleanest declarative answer to "pick the layout that fits" with zero breakpoints: render the **first child whose intrinsic size fits the container, else the next.**

```
{ "type": "fits", "in": "horizontal", "children": [ <preferred side-by-side>, <fallback stacked> ] }
```

This is a natural *superset* of VMS's existing "split collapses to stack" behavior, generalized to arbitrary alternatives, decided client-side at layout time, container-relative, no media query. It's the highest-leverage borrow after the (already-present) adaptive grid. Compose/Flutter only offer imperative equivalents (`BoxWithConstraints`/`LayoutBuilder`), so this is genuinely SwiftUI's contribution.

---

## What this means for VMS — the recommended target

**Reject outright** (the research is unambiguous): a 12-column placement/span grid, and viewport-breakpoint objects (`{xs,md,lg}`) on the wire. Both make the *app* own breakpoints — the opposite of the VMS contract. Neither should ever appear in VMS output.

**Already correct, no work:** `stack`, `row` (cluster), `cards` (auto-fit grid = the converged substrate), `sidebar`, `split`, `section variant:"card"` (box), `modal` (imposter). VMS's existing set already covers Stack + Cluster + Grid + Sidebar + Box + Overlay — a strong, near-complete minimal set.

**Recommended additions, in priority order:**

1. **`arrange` (justify) + `align` enums on `row`** — closed unions from Compose/Flutter above. Subsumes the header-bar request; small; pure-intrinsic. *(Ship first — unblocks the live consumer.)*
2. **`switcher` primitive** — one node, closed `threshold` param (+ optional bounded `limit`). The single missing completeness primitive AND one of only two layouts a grid provably can't express. Highest value-per-primitive.
3. **Promote `--vms-card-min` to a wire field** (e.g. `cards` gains a bounded `minItem` token) — makes the converged substrate server-driven intent rather than a CSS-only token. Low effort, high conceptual payoff (it names the thing the whole industry agrees on).
4. **`fits` node (ViewThatFits)** — responsive selection; generalizes split→stack. Medium effort, high leverage; the one novel borrow.
5. **Nestable `center`** (or `section align:"center" + measure`) — cheap, closes the inner-subtree centering gap. Add when an app hits it.
6. **Defer:** `cover` (until a login/splash/empty-state app needs vertical centering). **Skip:** `frame`, `reel` (out of a forms/tables/workflow framework's wheelhouse; pure-CSS-cheap to add later if ever needed).

**For discrete reflow the auto-fit grid can't express** (named app-shell regions; "exactly 2 cols above width X, else 1"): use **container-query-driven** rules client-side against a small framework-defined set of thresholds — **never server-emitted `@media`**. This is the escape hatch, used sparingly.

---

## Open decisions for sign-off (before any implementation)

1. **Accept the reframing?** — that the general substrate is the intrinsic auto-fit grid VMS already has, so this is *primitive completion + alignment enums*, not a grid rewrite. (Strong recommend: yes.)
2. **Scope of the first release** — ship `arrange`/`align` enums alone (unblocks PBMInvoices), or bundle `switcher` + `minItem` wire field with it as one "layout completeness" release?
3. **`fits` node** — in or out for now? (It's the biggest single capability jump but also the most design surface.)
4. **Exact enum value sets** — adopt the full Compose/Flutter unions (`space-around`/`space-evenly`, `baseline`) up front, or the minimal `start|center|end|space-between` + `start|center|end|stretch` and grow later?
5. **Write the two principles** (intrinsic-collapse + closed-union test) into `AGENTS.md` as the standing layout policy?

---

## Sources

**CSS-grid family / native CSS:** Bootstrap [grid](https://getbootstrap.com/docs/5.3/layout/grid/) · [breakpoints](https://getbootstrap.com/docs/5.3/layout/breakpoints/) · [css-grid](https://getbootstrap.com/docs/5.3/layout/css-grid/); Tailwind [grid-template-columns](https://tailwindcss.com/docs/grid-template-columns) · [responsive-design (container queries)](https://tailwindcss.com/docs/responsive-design); [web.dev one-line layouts](https://web.dev/patterns/layout/repeat-auto-minmax) · [CSS-Tricks auto-fill vs auto-fit](https://css-tricks.com/auto-sizing-columns-css-grid-auto-fill-vs-auto-fit/) · [Foundation XY Grid](https://get.foundation/sites/docs/xy-grid.html) · [Bulma Smart Grid](https://bulma.io/documentation/grid/smart-grid/) · [Pico grid](https://picocss.com/docs/grid).

**Component libraries:** MUI [Grid](https://mui.com/material-ui/react-grid/) · [Stack](https://mui.com/material-ui/react-stack/); Chakra [SimpleGrid](https://chakra-ui.com/docs/components/simple-grid) · [Flex](https://chakra-ui.com/docs/components/flex); Radix [Flex](https://www.radix-ui.com/themes/docs/components/flex) · [Grid](https://www.radix-ui.com/themes/docs/components/grid) · [layout overview](https://www.radix-ui.com/themes/docs/overview/layout); Mantine [SimpleGrid](https://mantine.dev/core/simple-grid/) · [Group](https://mantine.dev/core/group/).

**First-principles:** Every-Layout [Stack](https://every-layout.dev/layouts/stack/) · [Sidebar](https://every-layout.dev/layouts/sidebar/) · [Switcher](https://every-layout.dev/layouts/switcher/) · [Grid](https://every-layout.dev/layouts/grid/) · [full catalog](https://every-layout.dev/layouts/); [SEEK Braid](https://seek-oss.github.io/braid-design-system/foundations/layout/) · [GitHub Primer Stack](https://primer.style/components/stack) · [React Spectrum layout](https://react-spectrum.adobe.com/react-spectrum/layout.html) · [CUBE CSS](https://cube.fyi/).

**Declarative-native:** SwiftUI [HStack](https://developer.apple.com/documentation/swiftui/hstack) · [LazyVGrid/GridItem](https://developer.apple.com/documentation/swiftui/lazyvgrid) · [ViewThatFits](https://developer.apple.com/documentation/swiftui/viewthatfits) · [Spacer](https://developer.apple.com/documentation/swiftui/spacer); Compose [layouts basics (Arrangement/Alignment/GridCells)](https://developer.android.com/develop/ui/compose/layouts/basics); Flutter [MainAxisAlignment](https://api.flutter.dev/flutter/rendering/MainAxisAlignment.html) · [CrossAxisAlignment](https://api.flutter.dev/flutter/rendering/CrossAxisAlignment.html) · [SliverGridDelegateWithMaxCrossAxisExtent](https://api.flutter.dev/flutter/rendering/SliverGridDelegateWithMaxCrossAxisExtent-class.html).
