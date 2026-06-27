---
quick_id: 260626-urz
slug: add-sectionnode-alignself-maxwidth-child
target_release: 3.2.0 (npm + NuGet, lockstep)
status: in-progress
---

# Quick Task: SectionNode `alignSelf` + `maxWidth` (3.2.0)

Two additive per-child layout modifiers on `SectionNode`. Fresh feature on the 3.1.0
codebase (NOT the long-shipped v1.12 milestone). Motivating case: chat-bubble
transcripts; general for prose columns + centered narrow groups. Substantially
satisfies the deferred CENTER-01 by composition (`alignSelf:"center"` + `maxWidth:"prose"`).

## Locked design
- `alignSelf?: "start" | "center" | "end"` → CSS `align-self` (per-child counterpart to parent `align`). Emits `.vms-self--{v}`. Omitted = inherit = byte-identical.
- `maxWidth?: "half" | "two-thirds" | "three-quarters" | "prose"` → `max-inline-size` (50% / 66.6667% / 75% / min(65ch,100%)). Emits `.vms-maxw--{v}`. Omitted = no cap = byte-identical.
- Closed enums (P2), intrinsic, zero @media (P1). SectionNode ONLY (v1). No ChatBubble node.

## Surfaces (lockstep)
- [ ] TS types: `viewmodel-shell/src/index.ts` — SectionNode interface, 2 fields + TSDoc
- [ ] TS emission: `viewmodel-shell/src/browser.ts` — all 3 section className chains (collapsible/linked/plain)
- [ ] CSS: `viewmodel-shell/styles/default.css` — `.vms-self--*` + `.vms-maxw--*` (after the align block)
- [ ] .NET: `viewmodel-shell-dotnet/ViewModels.cs` — SectionNode record, 2 params w/ `[JsonIgnore(WhenWritingNull)]`
- [ ] Parity: FeatureProbe `buildVm` in `demo/FeatureProbe-bun/handler.ts` (bun+node) AND `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (.NET) — static view-shape: bare (omitted) + each alignSelf + each maxWidth; update `parity/fixtures/feature-probe.json` `$comment`
- [ ] Demo: Showcase chat-transcript composition (zero app CSS)
- [ ] Docs: CHANGELOG `## 3.2.0 / 3.2.0`; bump `package.json` + `.csproj` to 3.2.0; AGENTS.md pointer if needed

## Green-tree gate (all must pass before done)
- [ ] vitest (framework + demo frontends)
- [ ] `bun run parity/run.ts` byte-identical
- [ ] `npm run check:core-globals` (+ other static guards)
- [ ] every demo `*.Tests.csproj`

## Operator-gated (NOT done here per repo working agreement)
- git commit / tag / publish npm+NuGet / advance main — handed back to operator.
