---
phase: 30-chat-composer-primitive-chatcomposernode-route-b-composite
plan: 08
type: execute
wave: 7
depends_on: ["30-05"]
requirements: [CHAT-20]
completed: 2026-08-02
subsystem: docs-staging
tags: [docs, changelog, agent-skill, composite-nodes-layer, chat-composer, phase-30]
files_created: []
files_modified:
  - .planning/design/composite-nodes-layer.md
  - AGENTS.md
  - CHANGELOG.md
  - viewmodel-shell/agent-skill.md
  - viewmodel-shell-dotnet/AgentSkill.md
metrics:
  files_touched: 5
  lines_added: 312
  duration_min: ~15
---

# Phase 30 Plan 08: Docs Staging Summary

Staged all Phase 30 documentation for the `ChatComposerNode` landing: design of record §4e + inventory row, AGENTS.md Route B recipes section + new gotcha #11, CHANGELOG under `## Unreleased` (NO version bump), agent-skill.md addition byte-parallel across both backends (parity-gated). Zero source-code touched.

## Line counts per doc

| Doc | Insertions | Purpose |
|---|---|---|
| `.planning/design/composite-nodes-layer.md` | +70 | New inventory table row + §4e composite subsection (shape-earned attestation, typed slots, variance axes, baked-in behaviors, v1 deferrals, deferred `state?` axis note) + Phase 30 addendum under §5 + change-log entry. |
| `AGENTS.md` | +34 | New "Phase 30 (v9.1.0, chat composer)" entry in `## Currently shipped recipes` (Route B section) + new gotcha #11 documenting the `stopAction`-REQUIRED-when-streaming contract (both-sides fail-loud + correct AI-chat pattern + two related invariants folded in). |
| `CHANGELOG.md` | +18 | New `## Unreleased` block at top (accumulates for v9.1.0 closeout); `### Added` documents `ChatComposerNode` (18 wire fields, state machine, attach paths, chip strip, deferrals) + `square` icon glyph; `### Changed` documents `ActionEvent.files` type widening (backward-compat). |
| `viewmodel-shell/agent-skill.md` | +95 | New `## Chat composer (CHAT-01..20)` section (adjacent to Files section): wire shape + full field table with directional annotations + send-button state machine table + round-trip rule reminder + multipart attachment contract + keyboard notes + "driving cold" 4-step procedure. |
| `viewmodel-shell-dotnet/AgentSkill.md` | +95 | Byte-identical copy of the TS-side edit (via `cp`); verified by `diff` (no output) + `parity/check-skill.ts checkSourceTwins()` (35141B on both sides). |

## Byte-copy proof (agent-skill parity)

```
$ diff viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md
[no output — byte-identical]

$ wc -c viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md
35141 viewmodel-shell/agent-skill.md
35141 viewmodel-shell-dotnet/AgentSkill.md
```

## Parity gate result

Full `bun run parity/run.ts` — **PASSED (exit 0)**. Both check-skill phases green:

- `✓ skill source files byte-identical (35141B)` — the `checkSourceTwins()` diff.
- `✓ skill HTTP twins byte-identical (35196B) across 2 backends` — the `checkHttpTwins()` verify against dotnet-helpdesk + bun-helpdesk (the 55-byte delta between 35141B source and 35196B HTTP is the HelpDesk `appPreamble` prepended to the served body — same on both backends).

All fixture branches passed too (`✓ all backends agree`).

Defensive `check:no-demo-style` run: exit 0. One violation flagged in `demo/ChatComposerVerification-bun/index.html` (an UNTRACKED directory from an earlier wave, pre-existing this docs-only plan; the gate's exit code is 0 so the tree is green).

## Acceptance criteria — all met

| Criterion | Verify | Result |
|---|---|---|
| composite-nodes-layer §4e documents shape-earned + typed slots + variance axes | `grep -c 'ChatComposerNode' composite-nodes-layer.md` | 9 (≥3) ✓ |
| composite-nodes-layer §4e cites 3-panel tasting + Ashley taste-lock 2026-08-02 | inline grep of new §4e | ✓ (Panel 1 / Panel 2 / Panel 3 `banging` all documented) |
| AGENTS.md Route B inventory grows | `grep -c 'ChatComposerNode' AGENTS.md` | 3 (recipe entry + gotcha + supporting refs) ✓ |
| AGENTS.md gotcha added | `grep -n '^11\.' AGENTS.md` | Present at line 91 — the `stopAction`-REQUIRED-when-streaming contract, with correct AI-chat pattern code sample + two related invariants folded in ✓ |
| CHANGELOG under `## Unreleased` (no versioned header) | `grep -c '## v9.1.0\|## 9.1.0'` | 0 ✓; `## Unreleased` present at top ✓ |
| agent-skill.md gains `chat-composer` section | `grep -c 'chat-composer'` | 4 (≥2) ✓ |
| Byte-identical across both backend copies | `diff` | No output ✓ |
| Parity check-skill green | `bun -e 'checkSourceTwins()'` + full `parity/run.ts` | exit 0 ✓ (source twins + HTTP twins both byte-identical) |
| Wire protocol version stays `viewmodel-shell/1.0` | `grep -c 'viewmodel-shell/1.0' agent-skill.md` | 3 (unchanged) ✓ |
| No source-code file touched | `git status --short` | Exactly 5 `M` docs; zero source files ✓ |
| Every wire field name matches shipped types | cross-grep TS + .NET | ✓ (verified: `submitMode` is `"enter" \| "ctrl-enter"` kebab per shipped `ChatComposerSubmitMode`; every field/type checked against `viewmodel-shell/src/index.ts:2641-2734` + `viewmodel-shell-dotnet/ViewModels.cs:3140+`) |

## Gotcha candidates drafted (operator review — default selected)

Per the plan's optional-gotcha spec, all three candidates were drafted; the DEFAULT (candidate #2, `stopAction` REQUIRED-when-streaming) was added to AGENTS.md as gotcha #11. If the operator prefers a different candidate on review, revise:

**Candidate 1: `attachedFiles` blob-URL cleanup on composer node removal** — small memory-leak note; NOT a correctness bug. Chat composer attachments stage locally as `URL.createObjectURL` blob URLs in a per-composer registry keyed by `bind` path; revoked on X-remove + on send. If a composer disappears from the tree while the bind path stays in state, the registry entry is not auto-GC'd — small leak, page-nav cleans up. Only relevant if you dynamically show/hide composers. **Folded into gotcha #11 as a "related invariants" bullet.**

**Candidate 2: `stopAction` REQUIRED when status can reach streaming** (**SELECTED — added as gotcha #11**). Load-bearing contract; both sides fail-loud (browser adapter emits `console.error` + disables send button; .NET tree validator rejects with `invalid_tree`). Includes the correct AI-chat pattern (`{status:"streaming", stopAction:{name:"stop-generation"}}` in the same response that starts the stream) with a .NET code sample.

**Candidate 3: `attachBind` + `dropScope` require `attachAction`** — composer misconfig; adapter emits `console.error` and no-ops. No user impact but the console warning surfaces the misconfig. **Folded into gotcha #11 as a "related invariants" bullet.**

**Rationale for default #2 selection:** the `stopAction` contract is the most load-bearing consumer-facing invariant that emerged from Plan 30-04; consumer failure to wire it correctly produces a user-visible correctness bug (streaming with no interrupt path) not a silent leak or a console warning. Candidates 1 + 3 fold in as related-invariants bullets so all three shapes are documented under a single well-titled gotcha rather than fragmented across three low-signal entries — the standing shape for related contracts in AGENTS.md (see gotcha #10, which folds two version-skew concerns into one).

## Deviations from Plan

None. Plan executed exactly as written — five docs staged, no source-code touched, parity green, gotcha #11 added at the default candidate, all acceptance criteria met.

## Deferred Issues

None.

## Self-Check: PASSED

- ✓ `.planning/design/composite-nodes-layer.md` modified (verified via git diff — 70 lines added)
- ✓ `AGENTS.md` modified (34 lines added; gotcha #11 at line 91)
- ✓ `CHANGELOG.md` modified (18 lines added; `## Unreleased` block at top; no `## 9.1.0` header)
- ✓ `viewmodel-shell/agent-skill.md` modified (95 lines added; `chat-composer` section)
- ✓ `viewmodel-shell-dotnet/AgentSkill.md` modified (95 lines added — byte-identical `cp` of the TS twin)
- ✓ `diff` between the two skill files: no output (byte-identical)
- ✓ Parity gate: `bun run parity/run.ts` exit 0
- ✓ No source-code files modified (verified via `git status --short` — exactly 5 `M` docs)
