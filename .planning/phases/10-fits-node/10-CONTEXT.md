# Phase 10: Fits Node - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning
**Source:** Authored by orchestrator from the locked design doc + an explicit operator decision ("Build it — true measurement"). The measurement design below is LOCKED.

<domain>
## Phase Boundary

Add the **`fits` node** (SwiftUI `ViewThatFits` ported to the wire): a new ViewNode that renders **the first child whose intrinsic size fits the available container, else the next** — container-relative responsive *selection*, decided client-side at layout time via real measurement, zero viewport breakpoints. Generalizes the existing `split`→`stack` collapse to arbitrary alternatives.

This is the ONE primitive that is NOT pure CSS — it requires layout measurement in the renderer. The operator has explicitly chosen the true-measurement implementation and accepts that its selection behavior is verified by human review (Phase 11), not jsdom unit tests (jsdom has no layout engine).

IN SCOPE: the `FitsNode` wire type (both backends + discriminator) + the measure-and-pick renderer in `browser.ts` (ResizeObserver-driven) + the TUI/no-layout fallback + minimal CSS + parity for the WIRE shape + a minimal Showcase demo + tests for structure/fallback (not real selection).
OUT OF SCOPE: comprehensive demo spread + real-app compositions + the consolidated release (Phase 11). **Release DEFERRED** — accumulate under the existing `## Unreleased` CHANGELOG heading; do NOT bump versions or publish.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Wire shape (FITS-01/03)
- New node: **`FitsNode { type: "fits"; axis?: "horizontal" | "vertical" | "both"; children: ViewNode[] }`** (TS, in `viewmodel-shell/src/index.ts`). Add `FitsNode` to the `ViewNode` union. `axis` is a closed union, default (omitted) = **`"horizontal"`** (the dominant case: pick the widest layout that fits the width). `children` is the ordered candidate list.
- **Children ordering convention (document prominently):** candidates are ordered **preferred/widest FIRST → safe-fallback/narrowest LAST.** The renderer picks the first that fits; the LAST is the guaranteed-fits fallback. (Same direction as SwiftUI ViewThatFits.)
- .NET (`viewmodel-shell-dotnet/ViewModels.cs`): a `FitsNode` record + register it in the `ViewNode` polymorphic config with `[JsonDerivedType(typeof(FitsNode), "fits")]` (mirror the existing derived-type registrations for the other nodes). Fields: `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Axis = null` + `IReadOnlyList<ViewNode> Children`. Mirror the existing node-record + discriminator pattern exactly.

### Renderer — measure-and-pick (browser.ts, FITS-01)
- Add a `case "fits": return this.fits(n, parent, on)` to the `node()` dispatch switch (~L238) and a `private fits(n, parent, on)` method.
- **Algorithm:**
  1. Create a container element `<div class="vms-fits">` appended to `parent`. It must be **block / full-width** (width parent-driven, NOT shrink-wrapped to content) so its observed width reflects the available space, not the chosen child — this also prevents a measure→resize feedback loop.
  2. `pick()`:
     - **No-layout guard:** if `container.clientWidth === 0` (jsdom / SSR / detached / display:none), render ONLY the LAST child (the safe fallback) and return — measurement is unavailable.
     - Otherwise, for each candidate in order: clear the container, render that candidate into it, force a synchronous reflow, and test overflow on the axis (`horizontal`: `container.scrollWidth > container.clientWidth + 1`; `vertical`: `scrollHeight > clientHeight + 1`; `both`: either). The **first** candidate that does NOT overflow wins → stop. If NONE fit, the LAST candidate remains rendered (fallback). The 1px tolerance avoids sub-pixel false positives. Because `pick()` runs synchronously, the browser paints only the final choice (no flash of intermediate candidates).
  3. Attach a **`ResizeObserver`** on the container that re-runs `pick()` when the container's box changes (so a window/parent resize re-selects). Since the container width is parent-driven, observing it is stable (no content-feedback loop).
- **ResizeObserver lifecycle (avoid leaks):** add a `private fitsObservers: ResizeObserver[] = []` field on `BrowserAdapter`. At the TOP of `render()` (alongside the existing focus/scroll snapshot seam ~L66-90, BEFORE `this.container.innerHTML = ""`), `this.fitsObservers.forEach(o => o.disconnect()); this.fitsObservers = [];`. Each `fits()` call pushes its new observer into the array. This mirrors the adapter's existing per-render reset idiom and ensures observers from a prior render don't leak when the tree is rebuilt.
- **Capability-seam note:** measurement uses `ResizeObserver` + DOM measurement, which live in `BrowserAdapter` (`browser.ts`) — NOT in core `src/index.ts` (which must stay platform-global-free; the `check:core-globals` guard covers `index.ts` only, and `ResizeObserver` is a browser global that belongs in `browser.ts`). Confirm `check:core-globals` stays green (it will — no core change).

### CSS (minimal)
- `viewmodel-shell/styles/default.css`: a single minimal rule, e.g. `.vms-fits { display: block; }` (full-width block so the observed width is parent-driven). No alignment/visual styling — `fits` is a structural selector, not a visual layout. Place it near the other layout rules.

### TUI degradation (FITS-02)
- `viewmodel-shell/src/tui.tsx`: add a `case "fits":` to the node dispatch switch (~L937) that renders the node's **LAST child** (the safe fallback) via the existing node renderer — a terminal has no pixel fit, so the guaranteed-fits candidate is correct. Document this as the deliberate degradation rule. (The TUI is `@experimental`; the requirement is only that `fits` does not break it and degrades sensibly.)

### Parity (FITS-03)
- The WIRE is `{type:"fits", axis?, children}` — backend-symmetric and parity-testable. Add a `fits` node to BOTH FeatureProbe backends (`demo/FeatureProbe-bun/handler.ts` + `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`) as static view-shape: a `fits` with 2-3 candidate children (e.g. a `row` toolbar candidate first, a `stack`/`switcher` candidate last), plus one with `axis` omitted (proves omitted-absent) and one with `axis:"both"`. Update the fixture `$comment`. `bun run parity/run.ts` byte-identical green. **The measurement/selection is client-only and NOT part of parity** — parity only proves the node serializes identically across backends.

### Tests (jsdom — structure + fallback only)
- `viewmodel-shell/test/` (a new `fits.test.ts` or extend an existing suite): assert (a) a `fits` node renders a `.vms-fits` container; (b) the **no-layout fallback** — in jsdom (clientWidth 0) the LAST child is the one rendered; (c) the `axis` field is accepted for all three values + omitted; (d) the ResizeObserver is registered and **disconnected on re-render** (e.g. render a tree with fits, re-render without it, assert `disconnect` was called — can stub `ResizeObserver`). **Document in the test file that the real measure-and-pick selection cannot be unit-tested in jsdom (no layout engine) and is verified by the Phase 11 human review.**

### Demo (incremental — minimal)
- `demo/Showcase/frontend/src/main.ts` (zero `<style>`): a `fits` node whose first candidate is a wide horizontal `row` (e.g. a toolbar with several labeled links) and whose last candidate is a compact stacked/`switcher` version — so resizing the window switches between them. Minimal; the full review is Phase 11.

### Docs
- No AGENTS.md policy change needed (the policy is layout-field-focused; `fits` is a node). The node concern→source table update is Phase 11 (POLICY-02). Optionally add a one-line mention of `fits` where the node set is described, per the concern→source convention (don't enumerate exhaustively).

### Known limitation (document, don't solve in v1)
- A resize-triggered candidate switch rebuilds the `fits` subtree, so focus/caret/draft state inside the fits subtree may reset on a switch (edge case: resizing the window while typing in a fits child). Acceptable for v1; note it. The framework's normal focus/scroll preservation still applies to server-driven re-renders; this is specifically the resize-switch path.

### Release — DEFERRED
- Add a `### Fits node — Phase 10` subsection under the existing `## Unreleased` CHANGELOG heading. Do NOT bump `package.json`/`.csproj`, do NOT publish/tag. Consolidated release is Phase 11. All Phase 10 tasks `autonomous: true`.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design rationale
- `.planning/design/layout-system-research.md` — the ViewThatFits section (intrinsic responsive selection; why measurement; the preferred-first/fallback-last ordering).

### Code anchors
- `viewmodel-shell/src/index.ts` — the `ViewNode` union (the 16-type list) to extend with `FitsNode`; the node-interface doc-comment style.
- `viewmodel-shell/src/browser.ts` — `node()` dispatch switch (~L238, add the `fits` case); the `render()` top snapshot/reset seam (~L66-90, add the ResizeObserver disconnect-and-clear here); the existing per-node render methods (`page()`/`section()`) as the method-shape template; how children are walked (`this.node(child, container, on)`).
- `viewmodel-shell/styles/default.css` — add the minimal `.vms-fits` rule near the layout rules.
- `viewmodel-shell-dotnet/ViewModels.cs` — the `[JsonDerivedType(typeof(X), "x")]` registrations on the `ViewNode` union + the existing node records (e.g. a children-bearing one like `SectionNode`/`ListNode`) as the `FitsNode` record template.
- `viewmodel-shell/src/tui.tsx` — the node dispatch switch (~L937, add the `fits` case rendering the last child) + an existing `*View` for the render-a-child pattern.
- `demo/FeatureProbe-bun/handler.ts` + `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` + `parity/fixtures/feature-probe.json` — the parity harness.
- `viewmodel-shell/scripts/check-core-platform-globals.mjs` — confirm it stays green (it scopes to `index.ts`; `ResizeObserver` in `browser.ts` is allowed).

### Prior-art precedent
- **Phases 8 & 9** (`.planning/phases/08-*`, `09-*`) — the change-shape template for the wire/parity/test/demo/Unreleased-CHANGELOG mechanics. The DIFFERENCE: Phase 10 is a brand-new NODE TYPE (not a field) with client-side measurement, so it touches the `ViewNode` union + the `node()` dispatch + the TUI switch + the `[JsonDerivedType]` registration — places the field-only phases did not.
</canonical_refs>

<specifics>
## Specific Ideas
- Fits acceptance (FITS-01): a `fits` with `[ <wide toolbar row>, <stacked column> ]` shows the toolbar on a wide container and the stacked version on a narrow one, switching live on resize — with no `@media` and no app code.
- No-layout fallback (FITS-02): in the TUI and in jsdom, the LAST child renders (the safe, narrowest candidate).
</specifics>

<deferred>
## Deferred Ideas
- Preserving focus/draft across a resize-triggered candidate switch (v2 if it ever matters). Comprehensive demo spread + real-app compositions + the consolidated release → Phase 11.
</deferred>

---

*Phase: 10-fits-node*
*Context authored 2026-06-24 by orchestrator; measurement design locked per operator "build it" decision.*
