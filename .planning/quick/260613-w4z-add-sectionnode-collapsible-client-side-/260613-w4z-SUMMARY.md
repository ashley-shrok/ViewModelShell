---
phase: quick-260613-w4z
plan: 01
subsystem: viewmodel-shell + viewmodel-shell-dotnet
tags: [section-node, collapsible, client-side, lockstep, release]
requires:
  - viewmodel-shell 1.1.0
  - viewmodel-shell-dotnet 1.1.0
provides:
  - SectionNode.collapsible?: boolean (TS) / Collapsible: bool? (.NET)
  - SectionNode.id?: string (TS) / Id: string? (.NET)
  - native <details>/<summary> renderer branch in BrowserAdapter.section()
  - in-renderer detailsOpenSnapshot + sectionKeyCounter preservation pair
  - .vms-section__summary + .vms-section--collapsible CSS
  - viewmodel-shell 1.2.0 (npm + NuGet, lockstep)
affects:
  - HelpDesk Agent ticket detail page (.NET + bun)
key-files:
  created:
    - viewmodel-shell/test/section-collapsible.test.ts
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell-dotnet/ViewModels.cs
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/styles/default.css
    - demo/HelpDesk/AspNetCore/AgentController.cs
    - demo/HelpDesk-bun/server.ts
    - demo/HelpDesk/AspNetCore.Tests/AgentControllerTests.cs
    - viewmodel-shell/package.json
    - viewmodel-shell/package-lock.json
    - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
    - CHANGELOG.md
    - MIGRATION.md
    - AGENTS.md
decisions:
  - server never round-trips collapsible open state (mirrors draft-text preservation)
  - preservation key = id ?? heading ?? "vms-section-anon", disambiguated by per-render ordinal
  - headingless fallback summary label is the constant "Show details"
  - :focus-visible uses outline-offset: 2px (positive — disclosure triangle sits at the inline edge); 1.1.0 row-click uses -2px because the table row is inside a border
  - no forceExpand / defaultOpen wire field; rare server-driven expansion handled by re-keying the section
metrics:
  duration: ~12 minutes
  completed-date: 2026-06-13
  tasks: 5/5
  commits: 5
---

# Phase quick-260613-w4z Plan 01: SectionNode.collapsible Summary

A single optional `collapsible?: boolean` wire field on `SectionNode` ships as the framework's client-side disclosure primitive — native `<details>`/`<summary>` rendering, open state preserved across server-driven re-renders by an in-renderer snapshot/restore pair, no server involvement at all. Lockstep npm + NuGet 1.1.0 → 1.2.0 release.

## What landed

### Wire (Task 1 — commit `5977da1`)

`SectionNode` gains two optional fields, mirrored byte-for-byte across TS + .NET:

- `collapsible?: boolean` — when true, the renderer emits `<details>`/`<summary>` instead of `<section>`/`<h2>`.
- `id?: string` — optional stable preservation key, used by the renderer's open-state snapshot when `collapsible: true` and `heading` isn't unique within a page or is absent.

The .NET parameters are appended at the END of the positional list with `JsonIgnore` null-omission attributes per the `ViewModels.cs` maintainer rule. Existing call sites (positional or named) compile and serialize byte-identically — the wire stays additive.

### Renderer + preservation + CSS (Task 2 — commit `4a4e7a9`)

`BrowserAdapter.section()` now branches on `n.collapsible`:

- **`collapsible !== true`** — emits the pre-1.2.0 `<section class="vms-section">…<h2 class="vms-section__heading">…</h2>…children…</section>` tree byte-identically. No new className, no new attribute.
- **`collapsible === true`** — emits `<details class="vms-section vms-section--collapsible{…existing modifiers}" data-section-key="{key}"><summary class="vms-section__summary">{heading ?? "Show details"}</summary>…children…</details>`. The `open` attribute is OMITTED on initial render (default closed); the post-render restore loop re-applies it for keys the user had open.

Preservation seam:

- `BrowserAdapter.detailsOpenSnapshot: Map<string, boolean>` captured BEFORE `this.container.innerHTML = ""` by walking `[data-section-key]` elements and reading `<details>.open`.
- `BrowserAdapter.sectionKeyCounter: Map<string, number>` reset at the top of every `render()` so snapshot keys and restore keys compute identically across the two walks.
- After `this.node(…)` and after the existing focus/scroll restore, walk the new tree's `[data-section-key]` elements and set `open = true` for any whose key has a `true` entry in the snapshot.
- Both Maps are cleared at the bottom of `render()` so the snapshot doesn't leak across renders that don't have collapsible sections.

Preservation key: `id ?? heading ?? "vms-section-anon"`, with a per-render ordinal suffix (`:0`, `:1`, …) so multiple collapsibles with identical base keys still get distinct final keys.

CSS additions (immediately after `.vms-section--card`):

```css
.vms-section--collapsible { /* native <details> block layout is correct; .vms-section flex inheritance still applies. */ }
.vms-section__summary {
  font-size: var(--vms-text-xs);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--vms-text-muted);
  cursor: pointer;
  list-style: revert;
}
.vms-section__summary:focus-visible {
  outline: 2px solid var(--vms-accent);
  outline-offset: 2px;
}
```

Typography mirrors `.vms-section__heading` exactly so the summary reads as a heading. `:focus-visible` matches the 1.1.0 `.vms-table__row--clickable` idiom (`var(--vms-accent)`) — already AA-clean across all 12 shipped themes. `outline-offset: 2px` (positive) was used here because the disclosure triangle sits at the inline edge; the row-click rule uses `-2px` because the table row sits inside a bordered table.

### Tests (Task 3 — commit `353818f`)

New `viewmodel-shell/test/section-collapsible.test.ts` (13 jsdom cases):

- Render shape: `<details>` + classes; first child `<summary>` with correct text; default-closed; headingless ⇒ summary text `"Show details"`; no double `<h2>`.
- Byte-identical fallthrough: `collapsible` omitted/false ⇒ `<section>`/`<h2>` with no `--collapsible` class and no `data-section-key`.
- Preservation matrix (all share a single `BrowserAdapter` instance per test so the snapshot field survives between renders):
  - Open state survives same-key re-render.
  - Heading change drops preserved state (fresh closed).
  - Removal + re-add drops preserved state.
  - `id`-based keying disambiguates two sections sharing a heading.
  - Ordinal-based keying disambiguates anonymous (no id, no heading) collapsibles.
- Keyboard: clicking `<summary>` toggles `<details>.open`. (jsdom in this repo implements it natively; no skip.)

Full TS suite goes 250 + 1 skipped → 263 + 1 skipped (exactly +13).

### Demo wiring + .NET regression guard (Task 4 — commit `09cc924`)

HelpDesk Agent ticket-detail page (`BuildTicketPage`) now marks **only** "Agent Notes" as collapsible — in both backends:

- `demo/HelpDesk/AspNetCore/AgentController.cs` uses the named-argument form `new SectionNode("Agent Notes", […], Collapsible: true)` because `Collapsible` sits past the two positional defaults `Variant`/`Layout`.
- `demo/HelpDesk-bun/server.ts` adds `collapsible: true` to the Agent Notes section object.
- "Ticket Info" and "Actions" are deliberately left non-collapsible.

New `AgentControllerTests.TicketPage_AgentNotesSection_IsCollapsible` test guards both halves of the contract:

```csharp
Assert.True(sections.First(s => s.Heading == "Agent Notes").Collapsible == true);
Assert.True(sections.First(s => s.Heading == "Ticket Info").Collapsible != true);
Assert.True(sections.First(s => s.Heading == "Actions").Collapsible    != true);
```

`AgentControllerTests` goes 25/25 → 26/26.

### Release (Task 5 — commit `766902a`)

Lockstep version bump 1.1.0 → 1.2.0:

- `viewmodel-shell/package.json` `"version": "1.2.0"`.
- `viewmodel-shell/package-lock.json` — only the two `1.1.0` → `1.2.0` flips for OUR package on lines 3 and 9; transitive deps untouched (verified via `git diff`).
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>1.2.0</Version>`.

Docs:

- `CHANGELOG.md` — new 1.2.0 entry at the TOP, above the existing 1.1.0 section. Explains the new fields, the client-side-only contract, the preservation mechanism, the demo migration, the a11y posture (native `<details>` gives keyboard + SR for free; `:focus-visible` AA-clean), and the new test files.
- `MIGRATION.md` — new 1.2.0 section at the TOP. Covers "what changed" in one paragraph, "not breaking" (existing call sites byte-identical, TUI unaffected, parity green), and the explicit "Escape hatch — server-driven expansion" sub-section (re-key the section; no `forceExpand` / `defaultOpen` wire field by design).
- `AGENTS.md` — new bullet in "Non-obvious framework behaviors" right after "Focus and scroll preservation.", documenting the open-state preservation seam and the re-keying escape hatch.

## Verification

All four gates green, run from the final state:

| Gate | Command | Baseline | Result |
| --- | --- | --- | --- |
| Full TS suite | `cd viewmodel-shell && npx vitest run` | 250 passed + 1 skipped (after 1.1.0) | **263 passed + 1 skipped** (+13 new section-collapsible cases) |
| .NET HelpDesk AgentController | `cd demo/HelpDesk/AspNetCore.Tests && dotnet test --filter "FullyQualifiedName~AgentControllerTests"` | 25/25 | **26/26** (+1 new `TicketPage_AgentNotesSection_IsCollapsible`) |
| Cross-backend parity | `bun run parity/run.ts` (repo root) | all backends agree | **all backends agree** — both .NET and bun helpdesk emit identical wire shape with `collapsible: true` on Agent Notes |
| CI guards | `cd viewmodel-shell && npm run check:core-globals && npm run check:aa-contrast` | green | **AGNOSTIC-03 green** (`src/index.ts` references zero platform globals); **D-07 green** (all 13 pairs AA-clean across default + 12 themes) |

The single jsdom skip is unchanged from the 1.1.0 baseline — not collapsible-related.

## Decisions made during execution

- Task 1 is `tdd="true"` in the plan, but the actual content is a pure type-level change with `npx tsc --noEmit` + `dotnet build` as the verification step (no behavior to drive via RED/GREEN). Shipped as a single atomic commit; the type contract IS the implementation.
- Bun demos and the parity runner had no `node_modules/` in this fresh worktree — ran `bun install` in `parity/`, all `demo/*-bun/` dirs, and `viewmodel-shell/` (npm) before the parity sweep. No upstream changes; pure environment setup.
- The plan's `<action>` for Task 5 said to verify in the noted CI/test output, which I did. Some jsdom "Not implemented: window.scrollTo" stderr noise is unchanged from the pre-1.2.0 baseline (pre-existing render() preservation code; not introduced by this work).

## Self-Check: PASSED

- File `viewmodel-shell/test/section-collapsible.test.ts` exists.
- File `viewmodel-shell/src/index.ts` carries `collapsible?: boolean` + `id?: string` on SectionNode.
- File `viewmodel-shell-dotnet/ViewModels.cs` carries `bool? Collapsible = null` + `string? Id = null` with `JsonIgnore` attributes on SectionNode.
- File `viewmodel-shell/src/browser.ts` carries `detailsOpenSnapshot`, `sectionKeyCounter`, and the `<details>` branch in `section()`.
- File `viewmodel-shell/styles/default.css` carries `.vms-section--collapsible` + `.vms-section__summary` after `.vms-section--card`.
- Commits `5977da1`, `4a4e7a9`, `353818f`, `09cc924`, `766902a` all present in `git log`.
- `viewmodel-shell/package.json` reports `1.2.0`; `AshleyShrok.ViewModelShell.csproj` reports `1.2.0`.
- No new branch; no push.
