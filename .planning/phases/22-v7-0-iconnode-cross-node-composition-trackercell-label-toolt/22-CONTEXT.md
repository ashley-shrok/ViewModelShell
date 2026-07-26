# Phase 22: v7.0 Icons Primitive — Context

**Gathered:** 2026-07-26
**Status:** Ready for planning
**Source:** Design-doc-first Express Path — `.planning/design/icons-primitive.md` is the **design of record, LOCKED pending Ashley review 2026-07-26 → SIGNED OFF 2026-07-26**. Run `--skip-ui`: the design doc IS the design contract for this framework-drawn primitive.

> ⚠️ **PLANNER: READ `.planning/design/icons-primitive.md` FIRST AND IN FULL.** It is the rationale of record in the same role `lookup-field.md` served for Phase 21. Every decision below is there with its evidence. Do not re-derive, do not re-litigate, do not "improve" a LOCKED decision. Also read AGENTS.md's "Working agreement" section (green-tree gate, git-operator-driven rule, credential precheck) — every publish gate applies.

<domain>
## Phase Boundary

Close VMS's **oldest capability gap**: the framework ships **zero** icon primitive today. The source itself comments *"the framework ships no icon set"* at `viewmodel-shell/src/index.ts:1255-1256` and `viewmodel-shell-dotnet/ViewModels.cs:1666-1667`. Apps that need visual target identification (Pixie's Hestia launcher card grid; Angel's `/ai` chat surface) currently reach for emoji-in-TextNode-label — platform-inconsistent, un-configurable, un-a11y-able. Every mature UI framework (Material, Chakra, Ant, shadcn/Lucide) ships icons as first-class. VMS has been the outlier.

Ship as an aligned **npm + NuGet `7.0.0` major** — major forced by the ONE breaking wire change (`TrackerCell.label` → `tooltip` rename); icons themselves are additive. ONE tailnet verification page + ONE publish per Ashley's batch-then-ship preference.

**In scope:**
- `IconNode` wire type on both backends (closed-union `name`, optional `size`/`tone`/`label`).
- Cross-node `icon?: IconName` prop on 5 hosts: `ButtonNode`, `LinkNode`, `SectionNode`, `Badge`, `ListItem`.
- Curated **Lucide** subset (~102 icons, design-doc §6) inline-bundled in the browser adapter.
- Both tree-validators descend into `IconNode` + reject unknown-name.
- Icon-only ButtonNode validator rule: `icon && !label && !tooltip` → `invalid_tree` (both backends).
- `TrackerCell.label` → `tooltip` rename (both backends) + renderer swap from `el.title = ...` to the TOOL-01 body-appended `.vms-tooltip-host` singleton + JS positioning (the exact 6.12.1 infrastructure).
- Parity FeatureProbe `buildVm` extended in all backends (v5.1 pattern — extend not new fixture; `$comment` clause appended) + `expectBodyContains` coverage tripwires per branch.
- Showcase demo (icon gallery + Hestia-style card grid) + interactive tailnet verification page (real bundle, real CSS, real tree-validator in the fetch-shim).
- Aligned npm + NuGet `7.0.0` release closeout (CHANGELOG + MIGRATION + operator-gated publish + tag + advance main + `#vms-changelog`).

**Out of scope (deferred — do NOT build):**
- **Multiple icon sets.** Bundle Lucide only; consumers pick names from that set. Framework grows by addition (bounty new names as needed).
- **Custom SVG upload / arbitrary SVG on the wire.** Violates apps-describe; not now, likely not ever.
- **Icon variants** (filled/outlined). Lucide is stroke-only — deliberate. Not adding a "variant" axis.
- **Icon animations** (spinning loader, pulse). If needed later, scoped additive prop; not v1.
- **TUI unicode fallback.** TUI drops icons entirely for v1 per @experimental / not-invested-in directive.
- **Trailing icons** on Button/Link. Leading-only for v1. Trailing (MUI `endIcon`) adds a lead-vs-trail axis; defer until asked.
</domain>

<decisions>
## Locked Decisions (all in design-doc — cross-referenced)

The design doc is authoritative. Summarized here so the planner has the shape without re-reading the full 218 lines every task:

### Set choice — Lucide (design-doc §2, LOCKED)
- MIT, uniform 24×24 / 2px stroke, tree-shakeable SVG package (`lucide-static`).
- All 8 of Pixie's Hestia concept anchors are literal Lucide names (`sparkles`, `wrench`, `shield-check`, `route`, `book-open`, `activity`, `workflow`, `receipt`).
- Rejected: Heroicons (three variants complicate the wire); Material (Google-branded, font-based traditionally); Feather (abandoned).

### IconNode wire shape (design-doc §3, LOCKED)
```typescript
{ type: "icon", name: IconName, size?: "xs"|"sm"|"md"|"lg"|"xl", tone?: Tone, label?: string }
```
- `name` is a **closed union** — TS union of ~102 string literals; .NET **enum** with a converter (per closed-union-must-be-enum maintainer rule).
- `size` default `md` (20px). Size mapping: xs=12, sm=16, md=20, lg=24, xl=32.
- `tone` optional; absent = inherit `currentColor` from surrounding text.
- `label` optional; absent = decorative (`aria-hidden="true"`); present = meaning-carrying (`role="img"` + `aria-label`).
- Both TS/.NET carry `[JsonIgnore(WhenWritingNull)]` on every optional nullable.
- Framework emits `<svg class="vms-icon vms-icon--{size} vms-icon--{tone}" ...>` with `stroke="currentColor"` so tone/text color drives visual color.

### Cross-node `icon?: IconName` (design-doc §4, LOCKED)
Name-only prop, NOT a full `IconNode` child (avoids two-ways-to-say-the-same-thing). Host owns appearance; icon prop carries content.

| Host | Icon rendered at | Tone inheritance |
|---|---|---|
| `ButtonNode` | leading, size `sm` inline with button | button's `tone` |
| `LinkNode` | leading, size `sm` | inherits `currentColor` |
| `SectionNode` | prominent card icon, size `xl` | section's `tone` if set, else `currentColor` |
| `Badge` | leading inside pill, size `xs` | badge's `tone` |
| `ListItem` | leading before content, size `sm` | item's `tone` |

### Icon-only ButtonNode a11y rule (design-doc §5, LOCKED)
- `button.icon != null && (!button.label || button.label === "") && button.tooltip == null` → `invalid_tree` on tree-validation.
- The shipped 6.12.0 `tooltip` field double-duties as `aria-label` on icon-only buttons.
- Rationale: an icon-only button almost invariably wants hover-text explaining what it does (a11y + discoverability). Reusing `tooltip` is compact + prevents `tooltip` vs `ariaLabel` drift.

### Initial curated set (design-doc §6, LOCKED)
~102 Lucide icons categorized as: Actions (24), Status (10), Navigation (14), Content (14), Communication (5), People (5), Objects (10), Data/system (16), Magic/accents (4). Full list in design-doc §6. All 8 of Pixie's Hestia concept anchors included.

### TrackerCell.label → tooltip rename (design-doc §7, LOCKED — Ashley 2026-07-26 authorized)
- Wire field: `label?: string` → `tooltip?: string` (same type, same semantics).
- Renderer: replace `el.title = cell.label` at `browser.ts:4161` with the TOOL-01 body-appended `.vms-tooltip-host` singleton + JS positioning (exact 6.12.1 infrastructure).
- `aria-label` derivation: `tooltip ?? state` (unchanged from current `label ?? state`).
- Molly (single fleet consumer of `TrackerCell` — Metis) is DM'd BEFORE publish with the rename + MIGRATION excerpt so Metis integration is uninterrupted.
- This is the ONE break; forces v7.0.0 major.

### A11y + colorblindness (design-doc §8, LOCKED)
- Decorative vs meaning-carrying dispatch on `label` presence.
- `stroke="currentColor"` inherits contrast from text.
- New icon-on-tone / icon-on-fill pairs: **hand-check WCAG ratio** across default + all 12 themes (fixed 13-pair `check:aa-contrast` gate does NOT auto-cover new pairs — banked lesson). Deepen only failing tones via `color-mix` per shipped v3.5.0 pattern.
- Icons inherently colorblind-safe (shape + aria-label channels).

### TUI degradation (design-doc §9, LOCKED)
Drop icons entirely for v1. `@experimental` scope, not-invested-in per standing directive. No unicode-fallback mapping.

### Cross-backend / release rules (LOCKED — from AGENTS.md)
- Byte-identical wire across TS + .NET. Every optional nullable ⇒ `[JsonIgnore(Condition = WhenWritingNull)]`. Optional non-nullable bools whose `false` means absent ⇒ `WhenWritingDefault` (not applicable here — icons have no bool fields).
- Closed-union `name` ⇒ TS union + .NET **enum** with converter (per maintainer rule; my own 2026-07-16 lesson about the closed-union gate).
- Prefer `string` over number/union for any wire field that could drift (not applicable — icons carry only enum + string).
- Parity: EXTEND FeatureProbe `buildVm` in the 3 backends + append to `$comment` clause. NOT a new fixture file. NOT a `backends.json` change. Per the v5.1 pattern.
- `expectBodyContains` coverage tripwires per branch (banked lesson: a diff can only prove things about code it actually RUNS — an env var disabling a demo's seed deletes whole behaviours from the comparison).
- **Verification page** must drive the REAL shipped bundle AND its fetch-shim MUST run `buildVm` output through the REAL tree validator (banked lesson: the shim otherwise bypasses server-side validation and accepts trees the real server rejects).
- **A "known v1 limitation" that fires on FIRST USE is a defect ratified in prose** (banked lesson from v6.12.0 tooltip ship). One-hover-test any documented limitation on the verification page BEFORE ship. If the load-bearing use case fires the limit, it's a defect, not a limitation.

</decisions>

<constraints>
## Hard constraints (from AGENTS.md Working Agreement)

- **Green-tree gate before ANY push/publish** — full framework suite (`npx vitest run`) + all 5 `check:*` (`build`, `check:test-types`, `check:core-globals`, `check:aa-contrast`, `check:no-demo-style`, `check:demo-types`) + `bun run parity/run.ts` (17+ backends) + `viewmodel-shell-dotnet/Tests` + EVERY `demo/**/*.Tests.csproj`. No exceptions for "pre-existing" or "unrelated" or "just a demo" failures.
- **`dotnet` lives at `~/.dotnet/dotnet`** — `export PATH="$HOME/.dotnet:$PATH"` before parity/`.NET` tests.
- **Never `return Ok(...)`** from a .NET controller — return `BuildVm(state)` / a `ShellResponse<TState>` directly (gotcha #1).
- **The core stays platform-agnostic** — `src/index.ts` references ZERO platform globals; `check:core-globals` gates it. All DOM work belongs in `browser.ts`.
- **Apps describe, never decorate** — zero appearance on the wire. Icon `name` is content; `size`/`tone` are closed enums; SVG payloads stay bundled in the browser adapter.
- **Additive** for icons; **ONE break** for TrackerCell rename. Wire protocol token stays `viewmodel-shell/1.0` (additive changes don't bump; the rename is a NODE-field rename not a wire-envelope change).
- **`agent-skill.md` maintainer rule:** icons are new NODE types + host-node prop additions — NOT new wire-protocol verbs. The skill enumerates the protocol envelope, not the node catalog. **No `agent-skill.md` change expected for icons.** Verify.
- **Git is operator-driven.** Do NOT create branches. Do NOT push. Publishing/tagging is a separate, explicitly-authorized step. Ashley's greenlight on `/gsd:plan-phase 22` authorizes only the plan-phase commits, NOT publish.
- **Credential precheck BEFORE bumping versions.** The `.env` at repo root (gitignored) holds `NPM_TOKEN` (bypass-2FA GAT) + `NUGET_API_KEY`. Never `npm login`. If auth is broken, stop and tell Ashley BEFORE bumping — a bumped-but-unpublished version silently drifts repo↔registry.
- **Post-publish verification: `git merge-base --is-ancestor v7.0.0 main`** — a tag alone is NOT enough; `main` must be advanced to the release commit (banked lesson: v1.5.0/v1.6.0 stranded `main` at v1.4.0 for two days).

</constraints>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design of record
- `.planning/design/icons-primitive.md` — LOCKED design contract. Read in full.

### AGENTS.md (project instructions, checked into codebase)
- `AGENTS.md` §"Critical gotchas" — #1 (BuildVm not Ok), #8 (null omission + closed-union enum discipline).
- `AGENTS.md` §"Design system" — appearance axes (tone/emphasis/size), layout policy P1/P2.
- `AGENTS.md` §"Conventions for evolving the framework" — the `expectBodyContains` coverage-not-comparison rule, closed-union-must-be-enum, "grow by addition."
- `AGENTS.md` §"Working agreement" — green-tree gate, publish ritual, git-operator-driven, credential precheck.

### Related prior primitives (patterns to follow)
- `.planning/design/lookup-field.md` — Phase 21 design of record; same "design-doc-first" pattern this phase follows.
- `.planning/design/diff-node.md` — comparable-scope self-contained primitive; requirement-ID structure to mirror.
- `.planning/design/nav-primitives.md` — comparable-scope additive primitive pass.

### Source anchor points
- `viewmodel-shell/src/index.ts:1255-1256` — the "no icon set" comment being closed.
- `viewmodel-shell-dotnet/ViewModels.cs:1666-1667` — the .NET twin comment.
- `viewmodel-shell/src/browser.ts:4160-4161` — the TrackerCell `el.title = ...` line being replaced.
- `viewmodel-shell/src/browser.ts` — the TOOL-01 `.vms-tooltip-host` infrastructure (6.12.1 ship) that ICON-05 + ICON-06 both build on.
- `parity/backends.json` — FeatureProbe backends that need `buildVm` extended.
- `viewmodel-shell/styles/default.css` — where the `.vms-icon--{size}` + `.vms-icon--{tone}` CSS classes will live.

</canonical_refs>

<success_criteria>
## What must be TRUE (from ROADMAP Phase 22 — 8 criteria)

See ROADMAP.md "Phase 22" section for the full text. Summary:
1. `IconNode` renders byte-identically across TS/.NET; closed-union `name`; both tree-validators descend; unknown-name fails `invalid_tree`.
2. Cross-node `icon?: IconName` on Button/Link/Section/Badge/ListItem, rendered at host-appropriate size (§4 table).
3. Icon-only ButtonNode validator rule enforced on both backends; test coverage FAIL-before/PASS-after by mutation.
4. `TrackerCell.label` → `tooltip` rename + render-path swap to TOOL-01 styled tooltip; Molly DM'd BEFORE publish; MIGRATION carries the one-line note.
5. Parity green with `expectBodyContains` tripwires per branch; FeatureProbe `buildVm` extended (v5.1 pattern), NOT new fixture.
6. AA-contrast hand-check for new icon-on-tone / icon-on-fill pairs across default + 12 themes.
7. TUI drops icons for v1 (@experimental scope).
8. Aligned npm + NuGet `7.0.0` published, tagged `v7.0.0`, `main` advanced, CI green, `#vms-changelog` announced — after Ashley signs off on the tailnet verification page.

</success_criteria>

---

*Phase: 22-v7-0-iconnode-cross-node-composition-trackercell-label-toolt*
*Context gathered: 2026-07-26 via design-doc-first Express Path (design of record locked)*
