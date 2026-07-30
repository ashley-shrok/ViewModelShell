---
phase: 26-v8-0-0-release-closeout-comprehensive-verification-aligned-m
plan: 2
subsystem: docs / agent-skill
tags: [audit, skill, wire-manual, parity, v8.0.0, release-closeout]
dependency_graph:
  requires:
    - "viewmodel-shell/agent-skill.md (source of truth per AGENTS.md maintainer rule)"
    - "viewmodel-shell-dotnet/AgentSkill.md (byte-mirror)"
    - "parity/check-skill.ts (source + HTTP-twins gate)"
  provides:
    - "26-02-SUMMARY.md — on-the-record audit of agent-skill.md against v8.0.0 wire deltas"
  affects:
    - "viewmodel-shell/agent-skill.md — one line refreshed (§Versioning example)"
    - "viewmodel-shell-dotnet/AgentSkill.md — byte-copied to match"
tech_stack:
  added: []
  patterns:
    - "audit-then-edit-then-copy-then-gate — Task 1 read-only, Task 2 applies + byte-copies + parity-gates"
key_files:
  created:
    - ".planning/phases/26-v8-0-0-release-closeout-comprehensive-verification-aligned-m/26-02-SUMMARY.md"
  modified:
    - "viewmodel-shell/agent-skill.md"
    - "viewmodel-shell-dotnet/AgentSkill.md"
decisions:
  - "§Versioning example package numbers refreshed from 1.5.x/1.6.x → 7.x/8.x — the RULE is unchanged (the example is illustrative), but the v8.0.0 aligned major-line publish is the natural moment to refresh dated example package numbers. Plan L100-102 calls this out explicitly as an optional refresh."
  - "Every other of the 14 skill sections passed unchanged. Route B composite-node additions (Phase 24-25: 10 composites + 1 primitive + 3 wire tweaks) are node-tree additions the skill by convention does NOT enumerate — the skill covers wire seams only (dispatch, envelope, side-effects, errors, polling, non-blocking, lookup, files, chart)."
  - "EmptyStateNode's v8.0 field rename (heading→title, message→description) is a NODE-level shape change the skill does NOT describe — the discriminator `{type:\"empty-state\", ...}` is unchanged on the wire, only sibling fields renamed. Skill's concern-to-source rule per AGENTS.md keeps node-inventory out of the manual by design."
metrics:
  duration: "~10min (single-agent execution)"
  completed_date: "2026-07-30"
---

# Phase 26 Plan 02: Agent-Skill Audit + Byte-Copy + Parity Gate Summary

Audit of `viewmodel-shell/agent-skill.md` against the v8.0.0 wire deltas concluded: one minor `§Versioning` example-refresh (dated package numbers), byte-copied to the .NET twin, parity gate GREEN across source (22086B) + both HTTP twins (22267B).

## Audit result table — 15 skill sections walked

| # | Section (line range) | Verdict |
|---|---|---|
| 1 | `## What this is` (L5-7) | **PASS unchanged** — `(state, action) → (newState, view)` pure-function statement unchanged in v8.0. |
| 2 | `## Endpoints` (L9-20) | **PASS unchanged** — discoverability meta-tag protocol token stays `viewmodel-shell/1.0` (v8.0 additions are all additive node types + one field rename; the wire envelope shape did not break). |
| 3 | `## Action dispatch shape` (L22-40) | **PASS unchanged** — `{name}` action + `_state` round-trip + files-multipart form entries unchanged. |
| 4 | `## The round-trip rule` (L42-44) | **PASS unchanged** — `bind` path semantics unchanged. |
| 5 | `## Response envelope` (L46-85) | **PASS unchanged** — `ok`/`vm`/`state`/`redirect`/`sideEffects`/`nextPollIn`/`busy`/`preventUnload`/`rejected`/`serverBuild` set unchanged in v8.0 (no new envelope fields per CHANGELOG). |
| 6 | `## Side-effect verbs` (L87-107) | **PASS unchanged** — `set-local-storage` / `set-session-storage` / `download` / `toast` verb set unchanged in v8.0; forward-compat rule already present. |
| 7 | `## Errors` (L109-121) | **PASS unchanged** — `parse_error` / `unknown_action` / `invalid_tree` / `uncaught_exception` / `stale_client` code vocabulary unchanged in v8.0. |
| 8 | `## Client build / version skew` (L123-128) | **PASS unchanged** — `X-VMS-Client-Build` header + `serverBuild` response field + `stale_client` code unchanged. |
| 9 | `## Auth` (L130-132) | **PASS unchanged** — wire-agnostic auth statement unchanged. |
| 10 | `## Polling` (L134-136) | **PASS unchanged** — `nextPollIn`/`{name:"poll"}` cadence contract unchanged. |
| 11 | `## Non-blocking actions` (L138-146) | **PASS unchanged** — `blocking:false` client-side hint semantics unchanged (matches AGENTS.md banked non-blocking rule). |
| 12 | `## Lookup / reference fields` (L148-215) | **PASS unchanged** — `inputType:"lookup"`/`"lookup-multiple"` contract (Phase 21 / v5.2) unchanged in v8.0. |
| 13 | `## Files` (L217-221) | **PASS unchanged** — multipart form-entry-per-file + `uploadOn` contract unchanged. |
| 14 | `## Chart data` (L223-247) | **PASS unchanged** — `ChartNode` shape (Phase 18-19 / v5.0) unchanged in v8.0. |
| 15 | `## Versioning` (L249-251) | **EDIT: refresh example package numbers from "1.5.x or 1.6.x" → "7.x or 8.x"** — the RULE ("protocol token tracks the wire shape, NOT the package version") is unchanged; only the illustrative package numbers refresh at the v8.0 major-line boundary. Single-seam edit; line count preserved (251/251). |

## Edits applied

Single edit at `viewmodel-shell/agent-skill.md:251`, then byte-copied to `viewmodel-shell-dotnet/AgentSkill.md`:

```diff
-...a 1.5.x or 1.6.x package release may still carry protocol `viewmodel-shell/1.0`...
+...a 7.x or 8.x package release may still carry protocol `viewmodel-shell/1.0`...
```

Rationale: the RULE the sentence teaches (protocol token vs package version are independent) survives v8.0 by design — the wire has not undergone a breaking change since the protocol token was introduced, so the token is still `viewmodel-shell/1.0`. However, the illustrative package numbers named in the example (1.5.x, 1.6.x) are now seven majors stale at the v8.0.0 aligned publish moment; a reader consuming this manual against a v7.x / v8.x installation will find the dated numbers distracting/confusing. Refreshing them at this milestone boundary is precisely what plan L100-102 calls out as "a fine opportunity" for the v8.0 audit.

Every other v8.0.0 addition (per CHANGELOG Unreleased v8.0.0):
- Phase 23 foundations (COMP-01..04): `TextNode.style:"caption"`, `TextNode.weight?`, `CheckboxNode.variant?:"switch"`, `AvatarNode` — node-tree additions.
- Phase 24 primary composites (COMP-05..08): `ListRowNode`+`ListNode.variant:"rows"`, `MessageNode`+`MessageListNode`, `AlertNode`, `EmptyStateNode` rename — node-tree additions + one node-level field rename.
- Phase 25 secondary composites (COMP-09..13): `UserRowNode`, `DetailRowNode`+`DetailListNode`, `TimelineEntryNode`+`TimelineNode`, `SettingRowNode`+`SettingListNode`, `ChipNode`+`ChipListNode` — node-tree additions.

...are all node-tree additions and thus fall under the AGENTS.md concern-to-source rule ("the node set + every prop / enum value" → `viewmodel-shell/src/index.ts` + `viewmodel-shell-dotnet/ViewModels.cs`, NOT the skill). The skill by convention documents the wire PROTOCOL (dispatch shape, response envelope, side-effect verbs, error codes, polling, non-blocking, lookup, files, chart) — not the node inventory. So none of Phase 23-25's additions requires a skill edit.

Even the ONE v8.0 wire break — `EmptyStateNode` field rename `heading→title`, `message→description`, plus new optional `icon?` slot — is a NODE-LEVEL shape change (the discriminator `{type:"empty-state", ...}` is unchanged on the wire; only the sibling fields renamed). The skill does not describe individual node shapes, so this break too is out of scope for a skill edit.

## Byte-identity proof

```
$ diff -q viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md
(empty — byte-identical)

$ wc -l viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md
  251 viewmodel-shell/agent-skill.md
  251 viewmodel-shell-dotnet/AgentSkill.md
  502 total
```

Both source files remain **byte-identical** after the single edit + copy.

## Parity gate output — `bun run parity/check-skill.ts` GREEN

Standalone invocation of both check-skill phases (Phase 1: source diff; Phase 2: HTTP twins on freshly-started dotnet-helpdesk :5009 + bun-helpdesk :5010 backends):

```
$ cd parity && bun -e "
    import { checkSourceTwins, checkHttpTwins } from './check-skill.ts';
    console.log('Skill parity:');
    checkSourceTwins();
    await checkHttpTwins([
      { name: 'dotnet-helpdesk', url: 'http://localhost:5009' },
      { name: 'bun-helpdesk', url: 'http://localhost:5010' },
    ]);
    console.log('✓ Parity skill gate GREEN');
  "

Skill parity:
  ✓ skill source files byte-identical (22086B)
  ✓ skill HTTP twins byte-identical (22267B) across 2 backends
✓ Parity skill gate GREEN
```

Both source files (22086B on disk each) AND both served HTTP bodies (22267B — 181B of HelpDesk preamble prepended by `MapVmsAgentSkill` / `createAgentSkillHandler` above the canonical manual body) are byte-identical across the dotnet + bun HelpDesk twins. My edit to the `§Versioning` example was proven to be present on both served copies via curl inspection before the gate run.

Backends were spun up on ports 5009 (dotnet-helpdesk) + 5010 (bun-helpdesk) explicitly for this gate run and torn down immediately after — no shared state with 26-01's vite server on :8186 (which remains alive for 26-03's checkpoint).

## Rationale of the (near-)no-op result

Per AGENTS.md concern-to-source rule: "the node set + every prop / enum value" lives in the type sources (`viewmodel-shell/src/index.ts` + `viewmodel-shell-dotnet/ViewModels.cs`), NOT in the skill. The skill covers wire seams — dispatch shape, response envelope, side-effect verbs, error codes, polling, non-blocking dispatch, lookup, files, chart. So the entire v8.0.0 Route B composite-nodes layer (10 composites + 1 new primitive `AvatarNode` + 3 wire tweaks on existing nodes) — all of which are node-vocabulary additions — is out of scope for the skill by convention.

The protocol token stays `viewmodel-shell/1.0` because the wire ENVELOPE shape did not break in v8.0. The one true wire break (`EmptyStateNode.heading` → `title`, `message` → `description`, plus REMOVED legacy `.NET` `Tooltip`) is a per-node field-name change: the discriminator `{type:"empty-state", ...}` is unchanged, only sibling fields renamed. That is a per-node schema change the skill does not describe — the type source and the parity FeatureProbe (Phase 25-08's Secondary Composites section) are the authoritative catalog.

The only visible-to-a-reader consequence of v8.0.0 for the skill was the dated `§Versioning` example naming pre-v8 package numbers; that is what got refreshed.

## Self-Check: PASSED

- `viewmodel-shell/agent-skill.md`: **FOUND** (22086B, 251 lines)
- `viewmodel-shell-dotnet/AgentSkill.md`: **FOUND** (22086B, 251 lines; byte-identical to TS twin)
- `26-02-SUMMARY.md`: **FOUND** (this file)
- Parity `checkSourceTwins()`: **GREEN** (byte-identical, 22086B)
- Parity `checkHttpTwins()`: **GREEN** (byte-identical, 22267B, 2 HelpDesk backends)
- 15 skill sections walked with explicit PASS/EDIT verdict: **YES** (audit table above)
