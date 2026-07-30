---
phase: 26-v8-0-0-release-closeout-comprehensive-verification-aligned-m
plan: 6
status: complete
completed: 2026-07-30
---

# 26-06 SUMMARY — v8.0.0 milestone CLOSED (announce escalated)

## (i) Announce state — ESCALATED to operator

**Membership check:** vicky's relay account (`@vicky:thenasty.taild9b663.ts.net`) is a member of exactly ONE Matrix room:

```
!zceXPujmIzsDkRuaUQ:thenasty.taild9b663.ts.net  (@ashley ↔ @vicky (tg-bridge))
```

That's the DM with Ashley, not `#vms-changelog`. Target room `!E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU` is not in the joined-rooms list, and a probe `POST /rooms/.../join` returned `M_UNKNOWN: Can't join remote room because no servers that are in the room have been provided.` (Matrix federation requires either an invite or a `via` server hint — vicky has neither.)

Per plan Task 1(a) escalation clause: **STOP + surface state + provide copy-ready text.**

**Ashley — two options:**
1. **Invite `@vicky:thenasty.taild9b663.ts.net` to `!E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU`.** Then I re-run Task 1 and post the announce; the SUMMARY gets updated with the returned event id.
2. **Post the announce text below yourself** (copy-paste from the block). No further vicky action needed on this plan.

### Copy-ready announce text (single message, Continuwuity Markdown):

````
🚀 **viewmodel-shell v8.0.0** — aligned major release (npm + NuGet)

The Route B composite-nodes layer ships in full — 10 composite recipes across 3 phases, all aligned as one major bump.

**Added (all additive — no consumer action needed):**
- **4 foundations** (COMP-01..04): TextNode `style:"caption"` tier + `weight` axis, CheckboxNode `variant:"switch"`, AvatarNode
- **10 composite recipes** (COMP-05..13a): ListRow + ListNode `variant:"rows"`, Message + MessageList (with `followTail` scroll-pin), Alert, EmptyState (see BREAKING), UserRow, DetailRow + DetailList (`<dl>/<dt>/<dd>`), TimelineEntry + Timeline (new `::before` rail-and-dot CSS mechanism), SettingRow + SettingList (natural pairing with switch), Chip + ChipList (with caller-supplied `dismissAction`)
- **1 new primitive**: DividerNode
- **3 wire tweaks**: additive fields on foundations + discriminator additions per composite

**⚠️ SOLE BREAKING — `EmptyStateNode` field rename (COMP-08):**
Old: `{ heading, message?, action? }` → New: `{ icon?, title, description?, action? }`. Every internal fleet callsite already migrated in Phase 24. See MIGRATION.md for the 1-line sed for TS + .NET consumers.

**Install:**
- `npm install @ashley-shrok/viewmodel-shell@8.0.0`
- `dotnet add package AshleyShrok.ViewModelShell --version 8.0.0`

**Details:** CHANGELOG.md `## v8.0.0 — 2026-07-30` section + MIGRATION.md `## Upgrading to v8.0.0`.

Tag: `v8.0.0` (release commit `2e31dca`; `git checkout v8.0.0` for backlog recovery).

Green-tree at release commit: vitest 1250/1 skipped, framework .NET Tests 428, all demo Tests projects 191, cross-backend parity + check-skill all green (see 26-03-SUMMARY.md).
````

## (ii) v8.0.0 milestone rollup

| Plan | Objective | Result | SUMMARY |
|---|---|---|---|
| 26-01 | Comprehensive tailnet verification page | ✓ Vite served `100.113.23.63:8186`; killed in 26-05 | [26-01-SUMMARY.md](./26-01-SUMMARY.md) |
| 26-02 | agent-skill.md audit + byte-copy verify | ✓ Single §Versioning example refresh (1.5.x/1.6.x → 7.x/8.x); parity/check-skill.ts green both source + HTTP twins | [26-02-SUMMARY.md](./26-02-SUMMARY.md) |
| 26-03 | Full green-tree gate + Ashley visual sign-off | ✓ 1250 vitest / 428 framework .NET / 191 demo .NET / parity byte-identical; Ashley **APPROVED** at `/id reset` | [26-03-SUMMARY.md](./26-03-SUMMARY.md) |
| 26-04 | CHANGELOG/MIGRATION heading finalize + version bump to 8.0.0 | ✓ 4-file atomic staging; post-bump verify green | [26-04-SUMMARY.md](./26-04-SUMMARY.md) |
| 26-05 | Operator publish + tag + advance main | ✓ Both registries serve 8.0.0; tag `v8.0.0` at `2e31dca`; `merge-base --is-ancestor v8.0.0 main` exit 0 | [26-05-SUMMARY.md](./26-05-SUMMARY.md) |
| 26-06 | Announce + phase SUMMARY | ⏳ Announce ESCALATED — Ashley to invite vicky OR post herself; rollup + ROADMAP closed | this file |

## (iii) Milestone-scope state (from 26-05)

| Fact | Value |
|---|---|
| Release commit | `2e31dca6faf875d451fc4447150b6046b590e521` (on `main`) |
| npm registry-latest | `8.0.0` (direct-curl to `registry.npmjs.org/@ashley-shrok/viewmodel-shell`) |
| NuGet registry-latest | `8.0.0` (direct-curl to `api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json`; indexed at attempt 17 ≈ 340s post-push) |
| Annotated tag | `v8.0.0` (local + `origin`) — object SHA `6aedd2a8...`, dereferences to `2e31dca6...` |
| Main-ancestor gate | ✓ `git merge-base --is-ancestor v8.0.0 main` exits 0 (missed-2-releases footgun closed) |
| Verification page | Served on `100.113.23.63:8186` through Wave 2 approval; killed in Wave 4 |

## (iv) v8.0.0 fully closed

The v8.0.0 milestone is officially **CLOSED**. Every future v8.0.x patch or v8.x.0 minor opens as its own new phase per the phased-milestone convention. Route B composite-nodes layer (Phases 23-25) is consumer-installable in an aligned major on both packages.

The one open item on this plan is the announce (Task 1) — pending Ashley's choice of path (invite vicky OR post herself). Every other phase-scope deliverable is on disk + on-registry + on-`main`.

## Plan 26 announce path — pending Ashley

Post-decision update: this SUMMARY gets an `announce_event_id: <event>` line added under Section (i) if Ashley invites vicky and vicky posts. If Ashley posts herself, this SUMMARY stays as-is + closes clean.
