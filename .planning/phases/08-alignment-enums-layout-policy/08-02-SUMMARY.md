---
phase: 08-alignment-enums-layout-policy
plan: 02
subsystem: docs-policy + demo + release-staging
tags: [layout, policy, arrange, align, showcase, header-bar, changelog, version-bump]
requires:
  - phase: 08-01
    provides: "PageNode/SectionNode arrange?/align? closed-union wire fields + vms-arrange--/vms-align-- emission + default.css box-alignment rules"
provides:
  - "AGENTS.md '### Layout policy' section — P1 (intrinsic/zero-viewport-breakpoint) + P2 (closed-enum/bounded-scalar) as the governing IFF test; names sidebar+switcher; points at the research doc"
  - "Showcase header-bar (row + arrange:space-between + heading TextNode first child + nav cluster) + align-value matrix, zero app CSS"
  - "Staged-but-uncommitted CHANGELOG 1.12.0/1.10.0 entry + npm 1.12.0 + NuGet 1.10.0 version bumps (handed to operator-gated Task 4)"
affects: [09-switcher, 11-comprehensive-demo, future-layout-changes]
tech-stack:
  added: []
  patterns:
    - "Layout policy = the standing IFF test (P1∧P2) for any future layout wire field — answer the next request with the test, not a debate"
    - "Demo additions are pure ViewNode trees (zero <style>); arrange/align proven via the Showcase header-bar without app CSS"
key-files:
  created:
    - .planning/phases/08-alignment-enums-layout-policy/08-02-SUMMARY.md
  modified:
    - AGENTS.md
    - demo/Showcase/frontend/src/main.ts
    - CHANGELOG.md
    - viewmodel-shell/package.json
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
key-decisions:
  - "Layout policy placed as a '### Layout policy' subsection inside '## Design system', right after the layout-preset guidance, so it reads as the governing test for layout changes"
  - "Showcase demo appended to componentsView() (not a new tab) — minimal per CONTEXT.md; comprehensive spread is Phase 11"
  - "Task 3 (CHANGELOG + version bumps) left UNCOMMITTED in the working tree by design — they land with the operator-gated release commit to keep version-bump + publish atomic"
patterns-established:
  - "P1/P2 governing IFF test for layout vocabulary admission"
requirements-completed: [ALIGN-04, POLICY-01]
duration: ~20min
completed: 2026-06-24
---

# Phase 8 Plan 02: Layout Policy + Showcase Alignment Demo Summary

**Codified the two standing layout principles (P1 intrinsic-collapse / P2 closed-enum) into AGENTS.md as the governing IFF test for every future layout field, proved the `arrange`/`align` vocabulary in the Showcase with the canonical header-bar + an `align` matrix (zero app CSS), and staged the lockstep npm 1.12.0 / NuGet 1.10.0 release for the operator-gated publish.**

> **Scope note:** This run executed **Tasks 1–3 only**. Task 4 (the operator-gated release: full green gate → commit → npm publish → NuGet publish → annotated `v1.12.0` tag → advance `main`) is **PENDING** and was deliberately not run — the orchestrator hands it to the operator. No publish, no release commit, no tag, no main-advance was performed here.

## What changed

**Task 1 — AGENTS.md Layout policy (POLICY-01) · committed `efc3734`**
- Added a `### Layout policy` subsection to `AGENTS.md` inside `## Design system`, immediately after "### When to use which layout preset / density / card". States the governing test in dense house style:
  - **P1** — responsiveness intrinsic / container-relative, ZERO viewport breakpoints; auto-fit `minmax`, flex-wrap, negative-flex-basis (Switcher), Holy-Albatross wrap (Sidebar), `min/max/clamp`, and CSS container queries are the legal mechanisms; container queries are the **only** escape hatch; a viewport `@media` (or `{xs,md,lg}` object / 12-col `colSpan`) structurally violates the contract.
  - **P2** — every layout knob is a closed enum or bounded scalar, never raw CSS (no spans/tracks/areas/breakpoint maps).
  - The explicit rule: **a field joins the layout vocabulary IFF it passes BOTH.** `arrange:"space-between"` passes (in); a 12-col `colSpan` fails both (out).
  - Names `sidebar` + `switcher` as the two flexbox idioms a grid provably cannot express (switcher = Phase 9 forward reference, intentional). Points at `.planning/design/layout-system-research.md` as the rationale of record, and defers enum values to the type source per the existing concern→source convention (no drift-prone catalog).

**Task 2 — Showcase header-bar + align matrix (ALIGN-04) · committed `efc3734`**
- Appended an alignment demonstration to `componentsView()` in `demo/Showcase/frontend/src/main.ts`, built entirely from ViewNodes (zero `<style>`, zero `.innerHTML`):
  - **Header bar:** a `layout:"row"` section with `arrange:"space-between"` + `align:"center"`, FIRST child a heading `TextNode` ("Acme Console") — NOT the section heading — followed by a nested `layout:"row"` nav cluster of three `LinkNode`s (Dashboard / Reports / Settings). Renders title-left / nav-right with no app CSS = the PBMInvoices pattern served by the general primitive.
  - **`align` matrix:** one labeled `layout:"row"` section per value (`start`/`center`/`end`/`stretch`/`baseline`), each pairing a heading `TextNode` with a `LinkNode` so `baseline`/`stretch` are visible, each captioned with a muted `TextNode`.
  - **`arrange` sampler:** `center` + `space-evenly` rows of three links (minimal per CONTEXT.md — the comprehensive spread is Phase 11).

**Task 3 — CHANGELOG + lockstep version bumps (STAGED, NOT COMMITTED)**
- Prepended the `## 1.12.0 / 1.10.0 — Alignment enums (arrange / align) on the row layout (npm + NuGet)` entry above the `1.11.0 / 1.9.0` head: Added/Not-changed/Demo+tests/Migration sections in house style; references the new AGENTS.md "Layout policy" section + the research doc; states the protocol token stays `viewmodel-shell/1.0` (additive), omitted = byte-identical, MIGRATION not needed.
- Bumped `viewmodel-shell/package.json` `1.11.0 → 1.12.0` and `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` `1.9.0 → 1.10.0`.
- **These three edits are left UNCOMMITTED in the working tree** — by the run's commit policy, they land with the operator-gated release commit (Task 4) so "version bump + publish" stays atomic and `main` is never left bumped-but-unpublished.

## Deviations from Plan

None to the plan content. Two environment notes (not deviations):
1. **Showcase frontend had no `node_modules`** in this environment, so the plan's `npx tsc --noEmit` verify couldn't run as-is. Ran `npm install` in `demo/Showcase/frontend` (gitignored devDeps: typescript + vite) to enable it. `tsc --noEmit` then reports **only 12 pre-existing errors** — all on the unchanged theme `?inline` CSS-module imports (lines 4–15), which raw `tsc` can't resolve (Vite handles them at build). Proven pre-existing by stashing my edit and re-running (identical 12 errors). My alignment block adds **zero** new type errors. The authoritative end-to-end compile — `npx vite build` — **succeeds** (17 modules transformed), which is the truer signal that the new `arrange`/`align` usage typechecks against the 08-01 union types.
2. `dotnet` lives at `~/.dotnet/dotnet` off the non-interactive PATH (not needed this run — no .NET build/test in Tasks 1–3; the .csproj edit is a text bump).

## Gate Results

| Gate | Result |
|------|--------|
| `grep 'Layout policy' / 'switcher' / 'layout-system-research.md' AGENTS.md` | all present; P1/P2 line count = 3 |
| `node viewmodel-shell/scripts/check-no-demo-style.mjs` | ✓ green (8 HTML files zero-`<style>`; main.ts `.vms-*`-only) |
| `demo/Showcase/frontend` `npx vite build` (end-to-end compile) | ✓ built (17 modules transformed, 0 errors) |
| `demo/Showcase/frontend` `npx tsc --noEmit` | 12 errors — ALL pre-existing theme `?inline` CSS-module imports (unchanged lines 4–15); **0 new errors from the alignment block** |
| `grep '1.12.0 / 1.10.0' CHANGELOG.md` + `"version": "1.12.0"` + `<Version>1.10.0</Version>` | all present |

## Commits

- `efc3734` feat(08-02): codify Layout policy (P1/P2) + Showcase header-bar/align demo  *(Tasks 1 + 2, atomic, on `main`)*

Task 3 edits (CHANGELOG.md, package.json, .csproj) are **present-but-uncommitted** in the working tree — intentionally staged for the operator-gated release commit.

## Pending (operator-gated — Task 4, NOT executed here)

The full green gate (`bun run parity/run.ts`, `vitest run`, the static guards, `dotnet test`), the single release commit (which sweeps in the staged CHANGELOG + version bumps), `npm publish` (1.12.0), `dotnet nuget push` (1.10.0), the annotated `v1.12.0` tag, and the `main` advance + `git merge-base --is-ancestor v1.12.0 main` check. The orchestrator hands this to the operator per repo git policy + outward-facing-publish gating. Per AGENTS.md: source `.env` → sync `~/.npmrc` from `NPM_TOKEN` (never `npm login`) → `npm whoami` precheck → `set -a; source .env; set +a` for `NUGET_API_KEY`.

## Self-Check: PASSED

- AGENTS.md, demo/Showcase/frontend/src/main.ts, CHANGELOG.md, viewmodel-shell/package.json, viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj — all exist and carry the edits (greps above confirm).
- Commit `efc3734` present in `git log` (Tasks 1+2).
- Task 3 trio confirmed modified-but-uncommitted via `git status --short`.
