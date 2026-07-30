---
phase: 26-v8-0-0-release-closeout-comprehensive-verification-aligned-m
status: complete
completed: 2026-07-30
milestone: v8.0.0
---

# Phase 26 SUMMARY — v8.0.0 release closeout milestone

## Milestone shipped

**v8.0.0** is live on both registries as an aligned major, closing the Route B composite-nodes layer (Phases 23-25).

| Package | Version | Registry |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` | **8.0.0** | https://registry.npmjs.org/@ashley-shrok/viewmodel-shell |
| `AshleyShrok.ViewModelShell` | **8.0.0** | https://www.nuget.org/packages/AshleyShrok.ViewModelShell/8.0.0 |

Release commit: **`2e31dca6faf875d451fc4447150b6046b590e521`** on `main`.
Annotated tag: **`v8.0.0`** (local + origin; dereferences to release commit).
Main-ancestor gate: ✓ `git merge-base --is-ancestor v8.0.0 main` exit 0.

## Wave-by-wave rollup

| Wave | Plan | Objective | Outcome |
|---|---|---|---|
| 1 (parallel) | [26-01](./26-01-SUMMARY.md) | Comprehensive tailnet verification page | Vite served `100.113.23.63:8186` (Showcase, all 10 composites + 4 foundations + 1 new primitive + BREAKING rewrite); killed in Wave 4 |
| 1 (parallel) | [26-02](./26-02-SUMMARY.md) | agent-skill.md audit + byte-copy verify | Single §Versioning example refresh; parity/check-skill.ts green both source + HTTP twins |
| 2 | [26-03](./26-03-SUMMARY.md) | Full green-tree gate + Ashley visual sign-off | 1250 vitest / 428 framework .NET / 191 demo .NET / parity byte-identical. Ashley APPROVED via `/id reset` |
| 3 | [26-04](./26-04-SUMMARY.md) | CHANGELOG/MIGRATION heading finalize + 7.1.0/7.0.0 → 8.0.0 bump | 4-file atomic staging; post-bump verify green; HEAD unchanged |
| 4 | [26-05](./26-05-SUMMARY.md) | Operator publish + tag + advance main | Release commit `2e31dca` on main; both registries at 8.0.0 via direct-curl verify; tag pushed; main-ancestor gate exit 0; Vite killed |
| 5 | [26-06](./26-06-SUMMARY.md) | Announce + phase SUMMARY | Announce ESCALATED (vicky not member of `!E211Rrs...`); Ashley to invite OR post herself; phase rollup + ROADMAP closed |

## What v8.0.0 shipped

**4 foundations** (Phase 23, COMP-01..04):
- TextNode `style:"caption"` — third typographic tier (text-xs muted, opacity 0.85)
- TextNode `weight` axis — orthogonal `"regular"|"medium"|"bold"`
- CheckboxNode `variant:"switch"` — visual switch-slider render, wire semantics unchanged
- AvatarNode — new primitive; circular slot with image > initials > icon fallback

**10 composite recipes** (Phase 24 primary + Phase 25 secondary, COMP-05..13a):
- ListRowNode + ListNode `variant:"rows"` — dense list row with 3-tier typography
- MessageNode + MessageListNode — chat/comment with follow-tail (reuses SectionNode's shipped scroll-pin)
- AlertNode — status message with tone→icon default map; RESERVED `{name:"dismiss"}` on `dismissible`
- EmptyStateNode — v8.0 BREAKING rewrite (see below)
- UserRowNode — person entity with avatar + name + meta + status dot
- DetailRowNode + DetailListNode — key-value via `<dl>/<dt>/<dd>` semantic HTML
- TimelineEntryNode + TimelineNode — activity feed with baked-in `::before` rail + tone-encoded dot
- SettingRowNode + SettingListNode — label + description + trailing control (pairs with switch)
- ChipNode + ChipListNode — tinted-pill cluster with caller-supplied `dismissAction` (identity-carrying)

**1 new primitive**: DividerNode (thematic-break / vertical separator)

**3 wire tweaks**: additive fields on foundations + discriminator additions + FormNode.submitButton slot

**⚠️ SOLE BREAKING — EmptyStateNode field rename (COMP-08):**
Old: `{ heading, message?, action? }` → New: `{ icon?, title, description?, action? }` (`title` now REQUIRED). .NET record additionally drops legacy `Tooltip` (never in TS twin — dropped for byte-alignment). Every other v8.0 change is additive.

## Cross-phase evidence

- **Design of record**: `.planning/design/composite-nodes-layer.md` §2 (governance rule) + §3 (typed-slots pattern)
- **Consumer docs**: `CHANGELOG.md ## v8.0.0 — 2026-07-30` + `MIGRATION.md ## Upgrading to v8.0.0 — ONE break: EmptyStateNode field rename`
- **Backlog recovery**: `git checkout v8.0.0` retrieves the release tree byte-for-byte

## Milestone officially CLOSED

Every phase deliverable is on disk + on `main` + on the registries + on tag. The single open item is the Continuwuity announce, pending Ashley's routing decision (invite vicky OR post herself); the announce text is copy-ready in 26-06-SUMMARY.md. Future v8.0.x patches / v8.x.0 minors open as new phases per the phased-milestone convention.
