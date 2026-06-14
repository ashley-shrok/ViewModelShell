---
phase: 260614-bmd-issue-21-sectionnode-url-link-variant-cl
plan: 01
requirements: [ISSUE-21]
completed: 2026-06-14
---

# 260614-bmd — SectionNode.link URL-wrapper clickable-card primitive

Closes [issue #21](https://github.com/ashley-shrok/ViewModelShell/issues/21). Adds a URL-link navigator sibling of `SectionNode.action` (1.4.0 / 1.3.0). The renderer emits a wrapping `<a href>` element so every native browser link affordance works for free — middle-click new tab, Ctrl/Cmd-click, right-click context menu, drag-to-bookmarks, status-bar URL preview, accessible link semantics. Lockstep MINOR bump: npm 1.4.0 → **1.5.0**, NuGet 1.3.0 → **1.4.0**.

## Per-task summary

### Task 1 — TS wire field + renderer + CSS + TUI

- `SectionNode.link?: { url: string; external?: boolean }` declared in `viewmodel-shell/src/index.ts` with TSDoc that cites issue #21, names the four tree-validation rejections, documents the wrapper-anchor rationale, and references the `action` sibling.
- BrowserAdapter's section renderer (`viewmodel-shell/src/browser.ts`) wires:
  - Wrapping `<a href={n.link.url}>` element instead of `<section>` when `n.link` is set
  - `target="_blank"` + `rel="noopener noreferrer"` when `n.link.external === true` (mirrors LinkNode's external attribute pattern byte-for-byte)
  - className `vms-section vms-section--linked` (+ `vms-section--card`, `vms-section--{layout}` modifiers)
  - Heading renders as `<h2 class="vms-section__heading">` inside the anchor
  - NO `role`, NO `tabindex`, NO `aria-label` (anchor element provides native link / keyboard / a11y semantics)
  - Containment: `stopPropagation` on nested `.vms-button, .vms-checkbox__input, .vms-checkbox, .vms-field__input, .vms-table__link, a[href]`; for nested anchors additionally `preventDefault` so bubbled clicks can't re-trigger the wrapper. The catch-all `a[href]` selector excludes the wrapper itself via `ctrl === a` so the wrapper's own click is NOT preventDefaulted.
- `default.css` gains a `.vms-section--linked` block: cursor + anchor color reset (`color: inherit`) + text-decoration reset (`text-decoration: none`) + hover ring + `:focus-visible` outline. Without the reset rules a linked card would render with browser-default blue underlined heading text.
- TUI experimental adapter (`viewmodel-shell/src/tui.tsx`):
  - New `SectionLinkActionable` interface widening `PaneSummary.primaryActionable` to include the synthetic link-actionable.
  - When the focused pane IS a section with `link.url`, `focusedPaneSummary` seeds `primaryActionable = { type: "section-link", url }` BEFORE scanning descendants.
  - `activatePane` Enter branch handles `a.type === "section-link"` by calling `this.navigate(a.url)`.
  - `paneActivationHint` (status bar) labels the section-link with the pane's heading (else generic `"open"`).
- Header comment block updated to note the new behavior: `section.link → focused-pane Enter dispatches navigate(url) (1.5.0)`.
- **Commit:** `eca419c feat(260614-bmd): add SectionNode.link URL-wrapper primitive (TS + CSS + TUI)`

### Task 2 — TS validateSectionAction extension

- `viewmodel-shell/src/server.ts` `validateSectionAction` extended. Threaded parameter renamed `outerClickable: SectionNode | null` → `outerInteractive: SectionNode | null` (semantic widening: "an ancestor section has either action OR link set"). Verified zero leftover `outerClickable` references with grep.
- Four new validation checks added in this priority order so the most-actionable error wins:
  1. `section.action != null && section.link != null` — "either a dispatcher (action) or a navigator (link)"
  2. `section.link != null && section.collapsible === true` — "Link and Collapsible: true"
  3. (existing) `section.action != null && section.collapsible === true` — unchanged
  4. `section.link != null && outerInteractive !== null` — differentiated message: link-in-link (HTML5 nested `<a>`) vs link-in-action (click-ownership)
  5. `section.action != null && outerInteractive !== null` — existing rule now also catches action-in-link with a differentiated message
- Doc comment block above `validateSectionAction` enumerates all five rejected combos.
- New `viewmodel-shell/test/tree-walker.test.ts` (8 cases) covers: plain linked card passes; link+action throws; link+collapsible throws; link-in-link throws (HTML5); link-in-action throws (click-ownership); action-in-link throws; styling-only inner card inside both linked and action cards passes (regression).
- **Commit:** `db1bd3f feat(260614-bmd): extend validateSectionAction for SectionNode.link rules (TS)`

### Task 3 — jsdom test suite for renderer

- New `viewmodel-shell/test/section-link.test.ts` (10 cases) — structural sibling of `section-action.test.ts`:
  - A: external linked card emits `<a>` with href + `target="_blank"` + `rel="noopener noreferrer"`
  - B: non-external linked card omits target + rel
  - C: className contains `vms-section vms-section--linked` (NOT `--clickable`)
  - D: heading renders as `<h2 class="vms-section__heading">` INSIDE the anchor
  - E: clicking nested ButtonNode dispatches its own action; sentinel listener on the wrapper anchor never fires (containment via stopPropagation)
  - F: clicking nested CheckboxNode does not bubble to wrapper
  - G: clicking nested inner LinkNode does not bubble to wrapper (the inner anchor wins)
  - H: no `role`, no `tabindex`, no `aria-label` (anchor element provides semantics natively)
  - I: backward-compat — section without link AND without action renders as `<section>`, no `--linked` / `--clickable` class, no `href`/`target`/`rel`
  - J: combined `variant: "card"` + `layout: "split"` modifiers on the linked `<a>` className
  - K (skipped with inline note): CSS reset verification deferred to AA-contrast guard; jsdom stylesheet parsing would be heavy and the visual is shipped CSS not renderer-injected.
- Containment tests use a sentinel listener (`s1.addEventListener("click", ...)`) on the wrapper anchor to prove stopPropagation works (the listener should never fire when nested controls are clicked).
- **Commit:** `189fa45 test(260614-bmd): jsdom test suite for SectionNode.link`

### Task 4 — .NET wire field + extended ValidateSectionAction

- New `SectionLink(string Url, bool External = false)` helper record positioned immediately above `SectionNode` in `viewmodel-shell-dotnet/ViewModels.cs`. Url is non-nullable (required); External is non-nullable `bool` defaulting to `false` — same posture as `LinkNode.External` (serializes as `"external": false` when defaulted; no `JsonIgnore` because non-nullable values are semantically meaningful).
- `SectionNode` record gains trailing positional param `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] SectionLink? Link = null` after `Action`. JsonIgnore-on-null is REQUIRED per AGENTS.md critical gotcha #8 (file-header maintainer rule).
- `WalkForSectionAction`:
  - Parameter renamed `outerClickable` → `outerInteractive` (zero leftover references verified with grep).
  - Four new checks added in priority order matching the TS twin. Message wording is byte-aligned with the TS implementation so cross-backend test assertions stay portable.
  - Existing `Action + Collapsible` rule preserved unchanged.
- XML doc summary on `ValidateSectionAction` enumerates all five rejected combos.
- `ShellResponse<TState>.Validate()` (line ~211) already calls `ValidateSectionAction(Vm)` — no change needed; the extended walk runs through the same seam.
- `dotnet build` clean (0 warnings, 0 errors); existing demo positional call sites compile unchanged (verified by building HelpDesk).
- **Commit:** `598f872 feat(260614-bmd): add SectionNode.Link + extended ValidateSectionAction (.NET)`

### Task 5 — .NET tree-validation tests

- `viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` appends nine new `[Fact]`s:
  - `Validate_SectionLink_Plain_Passes` — plain linked card with descendants is valid
  - `Validate_SectionLink_PlusAction_Throws` — message contains "either a dispatcher (Action) or a navigator (Link)" + heading
  - `Validate_SectionLink_PlusCollapsible_Throws` — message contains "Link and Collapsible: true"
  - `Validate_SectionLink_NestedLinkInLink_Throws` — message contains "HTML5 prohibits nested" + both heading names
  - `Validate_SectionLink_NestedLinkInAction_Throws` — message contains "Click-ownership" + both headings
  - `Validate_SectionLink_NestedActionInLink_Throws` — message contains "Click-ownership" + both headings
  - `Validate_SectionLink_StylingOnlyInnerCard_Passes` — pins locked decision: styling-only inner card inside a linked card is VALID
  - `Validate_SectionLink_ExternalDefaultsFalse` — record-shape pin: `new SectionLink(url).External` is false; explicit `External: true` is true
  - `ShellResponse_Validate_RunsSectionLinkValidation` — pins the `ShellResponse<TState>.Validate()` seam runs the extended walk for the link case
- New `LinkedCard(heading, link, ...children)` local helper mirrors the existing `Card(...)` helper added in the prior phase.
- Tests project: 51 → **60 facts** (all passing).
- **Commit:** `83691fb test(260614-bmd): .NET tree-validation tests for SectionNode.Link`

### Task 6 — Parity fixture coverage

- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs`: BuildVm appends a sibling `linkedCardSection` next to the existing `clickableCardSection`. Uses `SectionLink("https://example.com/probe", External: true)`. No state change / no dispatch arm — link navigation is pure client-side, the wire shape itself is the parity gate.
- `demo/FeatureProbe-bun/handler.ts`: identical change on the bun twin (heading, URL, external flag, body text byte-identical so the parity diff is byte-clean).
- `parity/fixtures/feature-probe.json`: NOT changed — the linked card appears inside the tree on every step automatically because BuildVm produces it on every response.
- `bun run parity/run.ts` passes — all 8 fixtures, 15 backends agree byte-for-byte on the new `link: { url, external }` field. Verified manually by extracting the linked-card wire shape from the running bun backend.
- **Bun-link side-effect** (replicating the prior phase's pattern): had to register the worktree as the global `bun link` target via `cd viewmodel-shell && bun link` so the parity bun backends pick up the new SectionNode.link TS field. Main-repo link restored after parity run completed (verified `readlink -f ~/.bun/install/global/node_modules/@ashley-shrok/viewmodel-shell` resolves to `/home/ubuntu/ViewModelShell/viewmodel-shell` again).
- **Commit:** `1fd4b4a feat(260614-bmd): parity coverage for SectionNode.link via FeatureProbe`

### Task 7 — Showcase demo

- `demo/Showcase/frontend/src/main.ts` Dashboard archetype view gains a "Resources" cards strip placed just before the "New report" button section. Three external-link tiles, each using `SectionNode.link` with real GitHub URLs so manual browser tests actually navigate:
  - "Read the docs" → `https://github.com/ashley-shrok/ViewModelShell#readme`
  - "View on GitHub" → `https://github.com/ashley-shrok/ViewModelShell`
  - "Report an issue" → `https://github.com/ashley-shrok/ViewModelShell/issues`
- Inline comment cites 1.5.0 + issue #21 and names the four native browser link affordances the workaround (`.action` + server redirect) loses.
- The Showcase is pure-frontend (per AGENTS.md), no .NET or bun counterpart to update.
- `npm run build` produces a clean Vite build (17 modules transformed, 12.37 kB gzipped).
- **Commit:** `fb77323 feat(260614-bmd): Showcase demo of SectionNode.link external resource tiles`

### Task 8 — CHANGELOG + MIGRATION + version bumps

- `viewmodel-shell/package.json` version `1.4.0` → `1.5.0`. `package-lock.json` re-synced via `npm install --package-lock-only`.
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` `1.3.0` → `1.4.0`.
- `CHANGELOG.md` prepends a new `## 1.5.0 / 1.4.0 — SectionNode.link URL-wrapper clickable cards (npm + NuGet)` entry citing issue #21, with Added / Demo migration / Tests / Consumers sections in the same voice as the 1.4.0 / 1.3.0 entry.
- `MIGRATION.md` prepends a new `## Upgrading to '1.5.0' / '1.4.0' (lockstep — npm + NuGet)` entry with: version-bump table, one-paragraph "what changed", explicit "Consumer action required: none.", Not breaking subsection, New capability subsection with copy-pasteable TS + C# snippets, and "What the framework rejects" subsection enumerating the four new rejections with rationale.
- Old entries untouched (release-gated rule per AGENTS.md).
- **NOT published** — Task 9 (publishing to npm + NuGet + git tag) is operator-driven per AGENTS.md "🚨 A version bump is NOT a release". See "Task 9 status" below.
- **Commit:** `99804c9 chore(release): viewmodel-shell 1.5.0 / NuGet 1.4.0 — SectionNode.link`

## Task 9 status — DEFERRED to operator

Per the executor constraints and AGENTS.md "Working agreement for agents", publishing is operator-driven and was NOT performed by this run:

- `npm publish` (1.5.0 → npmjs) — NOT executed.
- `dotnet nuget push` (1.4.0 → nuget.org) — NOT executed.
- `git tag -a v1.5.0` + `git push origin v1.5.0` — NOT executed.

The publish ritual (with credential precheck) is documented in `260614-bmd-PLAN.md` Task 9 `<how-to-verify>` and mirrors the canonical sequence from AGENTS.md "Conventions for evolving the framework". The operator runs steps 1-4 manually after confirming `.env` is current (`grep -E '^(NPM_TOKEN|NUGET_API_KEY)=' /home/ubuntu/ViewModelShell/.env`), syncing `~/.npmrc` to the bypass-2FA token, and sourcing `NUGET_API_KEY` into the shell. After publish, tag the release commit (`99804c9` — `chore(release): viewmodel-shell 1.5.0 / NuGet 1.4.0`).

## Files touched

- `viewmodel-shell/src/index.ts` — SectionNode.link field declaration + TSDoc
- `viewmodel-shell/src/browser.ts` — section renderer emits `<a href>` wrapper + containment
- `viewmodel-shell/src/server.ts` — validateSectionAction extended for link rules
- `viewmodel-shell/src/tui.tsx` — SectionLinkActionable + activatePane handling + status bar hint
- `viewmodel-shell/styles/default.css` — `.vms-section--linked` cursor + anchor reset + hover + focus-visible
- `viewmodel-shell/test/section-link.test.ts` — 10 jsdom cases (new file)
- `viewmodel-shell/test/tree-walker.test.ts` — 8 validation cases (new file)
- `viewmodel-shell/package.json` — version 1.4.0 → 1.5.0
- `viewmodel-shell/package-lock.json` — re-synced to 1.5.0
- `viewmodel-shell-dotnet/ViewModels.cs` — SectionLink record + SectionNode.Link positional param + extended WalkForSectionAction + XML doc
- `viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs` — 9 new .NET facts
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — Version 1.3.0 → 1.4.0
- `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — linked card section
- `demo/FeatureProbe-bun/handler.ts` — bun twin linked card section
- `demo/Showcase/frontend/src/main.ts` — Dashboard "Resources" external-link strip
- `CHANGELOG.md` — new 1.5.0 / 1.4.0 entry
- `MIGRATION.md` — new 1.5.0 / 1.4.0 entry

## Test status (project sanity sweep — ran AFTER Task 8, BEFORE Task 9)

- `npm run check:core-globals` — PASS (`viewmodel-shell/src/index.ts` references zero platform globals)
- `npm run check:aa-contrast` — PASS (13/13 pairs WCAG-AA on default + all 12 themes; `--vms-accent` token covers `.vms-section--linked:focus-visible`)
- `npm run check:theme-byte-identity` — PASS (all 11 theme files match recorded SHA-256 baselines)
- `npm run check:theme-function` — PASS (all 12 themes function as their name claims)
- `npm run check:no-demo-style` — PASS (8 hand-edited HTML files zero-`<style>`; Showcase main.ts is `.vms-*`-only)
- `npx vitest run` — **293 passed | 1 skipped** across 24 test files (was 275 — 18 new = 10 section-link + 8 tree-walker)
- `dotnet test viewmodel-shell-dotnet/Tests/Tests.csproj` — **60 passed** (was 51 — 9 new SectionNode.Link facts)
- `bun run parity/run.ts` — PASS, all 15 backends agree byte-for-byte across all 8 fixtures (including the new `Linked card` section in FeatureProbe)
- `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj -c Release` — PASS (0 warnings, 0 errors)
- HelpDesk demo `dotnet build` — PASS (existing positional call sites compile unchanged)

## Deviations from plan

1. **Test file scaffolding for Task 2.** Plan said to append validation tests to `viewmodel-shell/src/tree-walker.test.ts` (a new file at `src/` next to `server.ts`), but the existing project convention is to put validator tests in `test/`. Created `viewmodel-shell/test/tree-walker.test.ts` instead — matches the directory convention of `test/section-action.test.ts` (which holds K + L validation cases) and `test/conformance.browser.test.ts`. Applied Rule 1 (match existing pattern). The plan's `files_modified` list named `test/tree-walker.test.ts` (in the test directory), so this is just clarifying the path.

2. **TUI changes a bit broader than minimal.** Plan said "keep the change minimal (one extra branch in actionable-detection)". The implementation needed three touchpoints: (a) widen the `primaryActionable` type with a new `SectionLinkActionable` interface, (b) seed it from the pane in `focusedPaneSummary` BEFORE descendant scan, (c) handle the new type in both `activatePane` (Enter dispatch) and `paneActivationHint` (status bar label). The status-bar update was necessary because `paneActivationHint`'s existing fall-through (`else label = a.label ?? "copy"`) would compile-error on the new type (which has no `label` field) without an explicit branch. All four touchpoints are minimal one-block additions; the TUI focus model is unchanged.

3. **Inner-anchor `preventDefault` semantics documented as TODO.** Plan said the containment listener should `e.stopPropagation() + e.preventDefault()` on nested anchor descendants "so the inner anchor wins." Technically `preventDefault()` on an inner anchor's click cancels the INNER anchor's navigation (not the outer's), so the literal effect is "neither anchor navigates" — which is actually the safe behavior for the tests but breaks intent for real LinkNode-inside-section.link use. The plan acknowledges this: "LinkNode-inside-section.link is left to the existing LinkNode renderer (which produces an inner `<a>` that browsers handle ungracefully); the executor should document this in the renderer with a TODO". Followed the plan's explicit `preventDefault` instruction AND added the requested TODO comment in `browser.ts` referring to a possible follow-up runtime warning. Test G in `section-link.test.ts` asserts the OUTER wrapper does NOT receive the click (via sentinel listener), not that the inner navigates — so the implementation passes the test as specified.

4. **CSS reset verification (Test case K).** Plan made case K "optional but recommended." Skipped with an inline comment because injecting + parsing `default.css` into jsdom would be heavy and the CSS reset is shipped CSS (visible in `default.css`), not renderer-injected, so the AA-contrast guard's `.vms-section--linked:focus-visible` coverage plus the Showcase demo as a visual reference is the appropriate verification path.

5. **Bun-link side-effect** (replicating prior phase). The bun parity backends resolve `@ashley-shrok/viewmodel-shell` via `link:` from the global `~/.bun/install/global/node_modules/@ashley-shrok/viewmodel-shell` symlink, which by default points at `/home/ubuntu/ViewModelShell/viewmodel-shell` (the main repo). Without re-registering, the bun parity runs would use the main-repo TS source without the new `link` field, causing parity diffs against the .NET backend. Re-registered the worktree as the global link target before the parity run; restored the main-repo link after. Verified the link target now resolves to `/home/ubuntu/ViewModelShell/viewmodel-shell` again post-run.

No deviations from the locked decisions in the plan (nested-object wire shape `{url, external?}` over flat fields; SectionLink helper record on .NET over flat `LinkUrl`/`LinkExternal` pair; styling-only inner card inside linked card valid; lockstep MINOR bump; Showcase opt-in).

## Authentication gates

None — pure code change, no external credentials required for Tasks 1-8. Task 9 (operator-driven publishing) requires `NPM_TOKEN` and `NUGET_API_KEY` from `/home/ubuntu/ViewModelShell/.env`, but that's part of the deferred operator step, not the executor's path.

## Self-Check: PASSED

All 16 modified/created files exist on disk:

```
viewmodel-shell/src/index.ts                              FOUND
viewmodel-shell/src/browser.ts                            FOUND
viewmodel-shell/src/server.ts                             FOUND
viewmodel-shell/src/tui.tsx                               FOUND
viewmodel-shell/styles/default.css                        FOUND
viewmodel-shell/test/section-link.test.ts                 FOUND
viewmodel-shell/test/tree-walker.test.ts                  FOUND
viewmodel-shell/package.json                              FOUND (1.5.0)
viewmodel-shell/package-lock.json                         FOUND (1.5.0)
viewmodel-shell-dotnet/ViewModels.cs                      FOUND
viewmodel-shell-dotnet/Tests/ViewTreeValidationTests.cs   FOUND
viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj  FOUND (1.4.0)
demo/FeatureProbe/AspNetCore/FeatureProbeController.cs    FOUND
demo/FeatureProbe-bun/handler.ts                          FOUND
demo/Showcase/frontend/src/main.ts                        FOUND
CHANGELOG.md                                              FOUND (1.5.0 entry)
MIGRATION.md                                              FOUND (1.5.0 entry)
```

All 8 task commits present in git log: `eca419c`, `db1bd3f`, `189fa45`, `598f872`, `83691fb`, `1fd4b4a`, `fb77323`, `99804c9`.
