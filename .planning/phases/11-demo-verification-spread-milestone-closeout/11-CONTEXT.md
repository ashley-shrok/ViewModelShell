# Phase 11: Demo Verification Spread + Milestone Closeout - Context

**Gathered:** 2026-06-24
**Status:** Ready for planning
**Source:** Authored by orchestrator. This is the milestone CENTERPIECE — the human (operator) visually verifies every layout, then we do POLICY-02 docs + the consolidated batched release.

<domain>
## Phase Boundary

Assemble a comprehensive, navigable demo spread covering EVERY layout primitive built this milestone (arrange/align, switcher, cards minItem, fits, plus the pre-existing stack/split/cards/sidebar/row), serve it locally for the operator to review in a browser, iterate on feedback to sign-off, then finalize the AGENTS.md node docs (POLICY-02) and perform the ONE consolidated lockstep release for the whole v1.12 milestone (RELEASE-01/02).

IN SCOPE: a clean "Layouts" review surface in the Showcase (DEMO-01) + two real-app compositions using the new primitives (DEMO-02) + the operator review loop (DEMO-03) + the AGENTS.md node concern→source table / Design-system update (POLICY-02) + the consolidated release (RELEASE-01/02, OPERATOR-GATED).
OUT OF SCOPE: new primitives (all built in 8/9/10). The deferred v2 items (center/cover/Spacer/CQ-discrete) stay deferred.
</domain>

<decisions>
## Implementation Decisions (LOCKED)

### Demo spread (DEMO-01) — a dedicated, well-labeled review surface
- Add a new **"Layouts"** view/tab to the Showcase (`demo/Showcase/frontend/src/main.ts`; add to the `state.view` tabs ~L680 + a `layoutsView()` returning ViewNode[] + a `case` in `viewChildren()` ~L666). Move/consolidate the incremental layout demos (currently appended into `componentsView()` by phases 8/9/10) into this organized surface so each primitive is reviewable on its own, clearly labeled, with a one-line muted caption per item explaining what to look for (esp. "resize the window to see the flip/selection" for switcher/fits). Zero `<style>` (the `check-no-demo-style` guard must stay green — ViewNodes only).
- Coverage checklist the surface MUST include, each labeled:
  - **arrange** — a `row` per value (start/center/end/space-between/space-around/space-evenly), each with a few visible children.
  - **align** — a `row` per value (start/center/end/stretch/baseline) with differently-sized children so the effect is visible (esp. baseline + stretch).
  - **header-bar** — the canonical `arrange:"space-between"` + heading-TextNode-first-child + nav cluster (ALIGN-04).
  - **switcher** — ~4 equal items + a caption "resize: all-row ↔ all-stack, never partial"; plus one with `threshold` and one with `limit`.
  - **cards minItem** — 2-3 `cards` blocks at different `minItem` tokens side by side (xs/md/xl) to show the density difference; caption to resize and see auto-fit collapse.
  - **fits** — the wide-toolbar ↔ compact-stacked `fits` with a caption "resize: the renderer measures and picks the first that fits."
  - The pre-existing presets (stack/split/cards/sidebar/row) can be referenced in their archetype views (no need to duplicate).

### Real-app compositions (DEMO-02)
- Enhance the existing `dashboardView()` (~L499) and `listDetailView()` (~L628) to actually USE the new primitives, proving they compose:
  - **dashboard**: a header-bar (`row` + `arrange:"space-between"` + title TextNode + nav cluster) across the top; a `cards` stat/summary grid with an explicit `minItem`.
  - **list-detail**: use a `fits` node to choose between a side-by-side (`split`/`sidebar`) list+detail layout (wide) and a stacked layout (narrow) — the canonical fits use case generalizing split→stack; and/or a `switcher` for an equal-action toolbar.
  - Keep them clean, zero `<style>`, typecheck clean (`vite build` authoritative; ignore the ~12 pre-existing theme `?inline` tsc errors — add ZERO new).

### Operator review (DEMO-03) — the human gate
- This is a `checkpoint:human-action` task. The orchestrator SERVES the Showcase locally (Vite — `npm run dev` or `build`+`preview` from `demo/Showcase/frontend`) on a tailnet-accessible host/port and hands the operator the URL + a guided checklist of what to look at (the coverage list above). The operator reviews every layout in a real browser (resizing to exercise switcher/fits/cards collapse) and either signs off or returns feedback; on feedback, iterate the demos and re-serve until sign-off. Verification is by human review — NOT assumed.

### Docs (POLICY-02)
- Update AGENTS.md (repo root): the node-type concern→source table + the Design-system "## Layout system" / preset guidance to reflect the completed vocabulary (arrange/align, switcher, cards minItem, fits) WITHOUT enumerating in a drift-prone way — point at the type source + the live Showcase per the existing concern→source convention. Keep the Layout policy section (Phase 8) intact; this is the descriptive docs catch-up.

### Consolidated release (RELEASE-01/02) — OPERATOR-GATED, the ONE release for the whole milestone
- This is the single batched release covering Phases 8-11 (deferred from each phase). Steps, in order, AFTER operator demo sign-off:
  1. Convert the `## Unreleased` CHANGELOG section into a versioned entry. Version: npm MINOR (the additive layout fields/nodes across the milestone) → **`1.12.0`**; NuGet MINOR → **`1.10.0`** (wire protocol token stays `viewmodel-shell/1.0` — all additive). Bump `viewmodel-shell/package.json` 1.11.0→1.12.0 and `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` 1.9.0→1.10.0.
  2. **Full green gate (all must pass):** `bun run parity/run.ts` byte-identical; `cd viewmodel-shell && npx vitest run`; the static guards (`check:core-globals`, `check-aa-contrast`, `check-no-demo-style`); `cd viewmodel-shell-dotnet && dotnet test`; Showcase `vite build`.
  3. **Credential precheck** (per AGENTS.md): `ENV="$(git rev-parse --show-toplevel)/.env"; grep -E '^(NPM_TOKEN|NUGET_API_KEY)=' "$ENV"`; sync `~/.npmrc` from `NPM_TOKEN`; `npm whoami` (expect `ashley-shrok`, not E401); `set -a; source "$ENV"; set +a`. NEVER `npm login`.
  4. **Commit** the release (version bumps + CHANGELOG versioned) on `main`.
  5. **npm publish** (`cd viewmodel-shell && npm publish`; confirm registry `dist-tags.latest == 1.12.0`).
  6. **NuGet publish** (`cd viewmodel-shell-dotnet && dotnet pack -c Release && dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.1.10.0.nupkg --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json`; confirm flatcontainer last == 1.10.0).
  7. **Tag** annotated `v1.12.0` at the release commit; push.
  8. **Advance main:** `git merge-base --is-ancestor v1.12.0 main && echo "on main"` MUST print on main.
  9. **Notify the PBMInvoices maintainer** over the agent-relay (the room `vms-row-headerbar-layout-0624`) that `arrange`/`align` shipped in npm 1.12.0 (the header-bar request).
- ⚠️ This is OPERATOR-GATED: the orchestrator pauses for explicit go before any publish/commit/tag/push (outward-facing + the repo git policy). Mark the task `autonomous: false`, `checkpoint:human-action`, `gate="blocking"`.

### Milestone closeout
- After release: mark the v1.12 milestone complete (the GSD `/gsd:complete-milestone` flow may be run, or a lightweight MILESTONES.md entry). Optional — the user may handle this.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

- `.planning/design/layout-system-research.md` — the full vocabulary + the Showcase-as-source-of-truth convention.
- `demo/Showcase/frontend/src/main.ts` — the Showcase (tabs ~L680, viewChildren ~L666, componentsView ~L217 has the incremental demos to consolidate, dashboardView ~L499, listDetailView ~L628). Zero `<style>` (check-no-demo-style guard).
- The phase SUMMARYs `.planning/phases/{08,09,10}-*/0*-SUMMARY.md` — what each primitive does + how it's demoed, to assemble the spread.
- `AGENTS.md` (repo root) — the node concern→source table + Design-system section (POLICY-02 target); the Layout policy section (Phase 8, keep intact); the "Conventions for evolving the framework" release ritual (the canonical publish procedure + the .env credential handling + the advance-main rule).
- `CHANGELOG.md` — the `## Unreleased` section (phases 8/9/10 subsections) to convert to the `1.12.0 / 1.10.0` versioned entry at release.
- Phase 8's `08-02-PLAN.md` Task 4 — the operator-gated release task TEMPLATE (the full ritual is written there; reuse its structure for the consolidated release).
</canonical_refs>

<specifics>
## Specific Ideas
- Serve command: `cd demo/Showcase/frontend && npm run dev -- --host` (Vite dev, tailnet-accessible) or `npm run build && npm run preview -- --host`. Give the operator the resolved URL.
- The review checklist mirrors the DEMO-01 coverage list; the operator resizes the browser to exercise switcher (atomic flip), fits (measure-and-pick), and cards (auto-fit collapse).
</specifics>

<deferred>
## Deferred Ideas
- v2 layout items (center/cover/Spacer/CQ-discrete) remain deferred (REQUIREMENTS.md Future). The milestone ships the completed core set.
</deferred>

---

*Phase: 11-demo-verification-spread-milestone-closeout*
*Context authored 2026-06-24 by orchestrator.*
