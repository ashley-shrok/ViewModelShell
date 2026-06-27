---
quick_id: 260626-urz
slug: add-sectionnode-alignself-maxwidth-child
target_release: 3.2.0 (npm + NuGet, lockstep)
status: complete
release_status: operator-gated (NOT committed/published/tagged)
---

# Summary: SectionNode `alignSelf` + `maxWidth` (3.2.0)

Two additive per-child layout modifiers on `SectionNode`, implemented to a green tree.
Release (commit/publish/tag/advance-main) is intentionally left to the operator per the
repo working agreement.

## Shipped (working tree)
- `alignSelf?: "start" | "center" | "end"` → CSS `align-self`; emits `.vms-self--{v}`.
- `maxWidth?: "half" | "two-thirds" | "three-quarters" | "prose"` → `max-inline-size`
  (50% / 66.6667% / 75% / `min(65ch,100%)`); emits `.vms-maxw--{v}`.
- Both on `SectionNode` only; closed enums (P2), intrinsic/zero-@media (P1); omitted = byte-identical.
- No `ChatBubble` node — chat composes from these primitives.

## Files changed
- `viewmodel-shell/src/index.ts` — 2 SectionNode fields + TSDoc
- `viewmodel-shell/src/browser.ts` — emission in all 3 section chains (collapsible/linked/plain)
- `viewmodel-shell/styles/default.css` — `.vms-self--*` + `.vms-maxw--*`
- `viewmodel-shell-dotnet/ViewModels.cs` — 2 record params w/ `[JsonIgnore(WhenWritingNull)]`
- `demo/FeatureProbe-bun/handler.ts` + `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` — byte-identical parity view-shape
- `parity/fixtures/feature-probe.json` — `$comment` documents the 3.2.0 coverage
- `demo/Showcase/frontend/src/main.ts` — chat-transcript + alignSelf/maxWidth/prose demo (zero app CSS)
- `viewmodel-shell/test/theme-modifiers.test.ts` — 11 new CHILD-01/02 emission tests
- `CHANGELOG.md` — `## 3.2.0 / 3.2.0` entry
- `viewmodel-shell/package.json` + `.csproj` — version bump 3.1.0 → 3.2.0

## Green-tree gate — ALL PASS
- tsc build ✓ · vitest 412 passed/1 skipped (incl. 11 new) ✓
- `bun run parity/run.ts` byte-identical across .NET/bun/node ✓
- guards: core-globals ✓ · no-demo-style ✓ · aa-contrast ✓ · theme-byte-identity ✓ · theme-function ✓
- all 5 demo `*.Tests.csproj` (181 tests) ✓ · Showcase `vite build` ✓

## Operator-gated (NOT done)
Per the working agreement (operator-driven git): commit, `npm publish` + `dotnet nuget push`
(3.2.0, creds from repo-root `.env`), annotated tag `v3.2.0`, advance `main`.
