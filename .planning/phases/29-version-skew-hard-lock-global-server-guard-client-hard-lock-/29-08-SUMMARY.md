---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 08
subsystem: docs
tags: [version-skew, agent-skill, docs, byte-parity, twin, v9.0.0, class-2-gotcha, viewmodel-shell]

# Dependency graph
requires:
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-03"
    provides: Client attaches X-VMS-Client-Build on GETs + silent auto-reload retired + lockSkew wired into checkVersionSkew + stale_client arm — the SHIPPED client-side behavior the doc now describes
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-06"
    provides: BrowserAdapter.showSkewLock non-dismissible modal DOM + .vms-skew-lock CSS + jsdom adapter tests — the SHIPPED browser affordance the doc's new "Browser hard-lock" bullet documents
provides:
  - Revised viewmodel-shell/agent-skill.md Client build / version skew section reflecting Phase 29's shipped GET+POST guard scope + hard-lock modal + onVersionSkew opt-out
  - Revised errors-table stale_client row: guard now enforces on GET + POST (was POST-only in v3.8.0); pre-guard timing rephrased GET-coherently
  - Byte-identical viewmodel-shell-dotnet/AgentSkill.md (parity check-skill green; load-bearing string cross-parity equal on both sides)
affects: [29-11 (docs staging — CHANGELOG can reference the shipped agent-skill copy as evidence), 29-12 (release ritual — the .NET twin ships alongside the core NuGet republish per AGENTS.md maintainer rule)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "The 'documented-behavior change updates the skill in the SAME change' maintainer rule (AGENTS.md §Agent discoverability). Phase 29 adds no new wire field but CHANGES documented behavior of the shipped stale_client code (GETs fail-close now; client sends header on GETs; browser gets a hard-lock modal). This plan is the discharge of the maintainer rule for Phase 29 — the doc reflects shipped code, byte-copied to the .NET twin, parity gate green."
    - "The 'load-bearing string cross-parity as class-2 gotcha #9 defense' pattern: byte-diff catches ANY change, but explicit grep counts on load-bearing tokens (`GET + POST` + `onVersionSkew` + `BrowserAdapter`) catch DRIFT on load-bearing tokens specifically. Both are checked — the diff proves general byte-parity; the counts prove the specific tokens agents grep for stay equal on both sides. First explicit application of the pattern in a docs-twin plan (previously implicit in the parity check-skill.ts byte-diff)."
    - "The 'GET-coherent pre-guard timing phrasing' pattern: a POST-specific phrase dangling on a GET-covered section confuses a GET reader (they have no `_state` to be deserialized). The revised phrasing anchors on 'before any controller runs' (universal) with the POST-specific consequence bracketed in a parenthetical — parses cleanly for both GET and POST readers. The 'GET-coherence check' acceptance-criteria gate (grep -c 'before your `_state` was read' returns 0 AND grep -c 'before any controller runs' returns ≥ 1) is the shipped enforcement of this pattern."

key-files:
  created:
    - .planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-08-SUMMARY.md
  modified:
    - viewmodel-shell/agent-skill.md
    - viewmodel-shell-dotnet/AgentSkill.md
    - .planning/ROADMAP.md

key-decisions:
  - "Chose the literal phrase 'GET + POST' (with spaces around +) as the load-bearing token, used in BOTH the errors-table row and the intro sentence of the Client build / version skew section — so `grep -c 'GET + POST'` returns exactly 2 (matching the acceptance criteria). The alternative 'both GET and POST' was used in the errors-table row initially but the plan required the literal 'GET + POST' phrasing for grep-verifiability; the intro sentence was tightened to use the literal token."
  - "Chose to keep the section heading `## Client build / version skew` byte-identical to pre-plan (no rename to `## Client build / version skew (v9.0.0)` or similar) — preserves the heading anchor for any existing cross-reference from other docs (CONTEXT/PATTERNS docs, external agents linking to this section)."
  - "Chose to bracket the POST-specific consequence in a parenthetical clause 'before any controller runs (so on a POST, your `_state` is never deserialized and nothing is applied)' rather than making it two sentences. Single-sentence form flows cleaner and keeps the pre-guard timing statement scannable as one clause; the parenthetical is unambiguous for both GET and POST readers."
  - "Chose to add ONE new bullet (Browser hard-lock) rather than folding the modal + opt-out into the existing Fail-closed bullet. Rationale: the modal is a distinct affordance layer with its own semantics (BrowserAdapter DOM + non-dismissibility + onVersionSkew opt-out); a wire-driving agent scanning the section for actionable guidance can skip the entire bullet ('an agent driving the wire cold never sees the modal') rather than parsing a paragraph that mixes wire and browser semantics."

patterns-established:
  - "The 'skill-doc revision → byte-copy → parity gate' three-step workflow for any documented-behavior change: (1) edit canonical viewmodel-shell/agent-skill.md; (2) `cp` to viewmodel-shell-dotnet/AgentSkill.md (true byte-copy, not hand re-edit); (3) invoke checkSourceTwins() from parity/check-skill.ts to gate byte-parity. This is now the shipped convention documented in Phase 29's SUMMARY set — future docs-twin plans should replicate."
  - "The 'load-bearing string cross-parity grep' pattern as a class-2 gotcha #9 defense in docs-twin plans: name the specific tokens that carry semantic load (here: `GET + POST` for the guard-scope note; `onVersionSkew` for the opt-out affordance; `BrowserAdapter` for the modal owner) and grep-count them equal on both sides. The diff proves general byte-parity; the counts prove the specific tokens agents grep for stay equal — a subtle diff-configuration change on either side cannot silently drift the load-bearing tokens."

requirements-completed: [SKEW-10]

# Metrics
metrics:
  duration_minutes: 8
  completed_date: 2026-08-02
  files_modified: 3
  commits: 2
---

# Phase 29 Plan 08: agent-skill.md revised Client build / version skew section + byte-copy to .NET AgentSkill.md Summary

**One-liner:** Revised the canonical `viewmodel-shell/agent-skill.md` Client build / version skew section (guard now enforces on GET + POST as of v9.0.0; new Browser hard-lock modal bullet documenting `BrowserAdapter.showSkewLock` + `onVersionSkew` opt-out; wire behavior for agents UNCHANGED) plus errors-table `stale_client` row revision; byte-copied to `viewmodel-shell-dotnet/AgentSkill.md`; parity `checkSourceTwins()` green; load-bearing string cross-parity equal on both sides (`GET + POST` × 2, `onVersionSkew` × 1, `BrowserAdapter` × 1).

## What shipped

### Task 1 — Revised agent-skill.md errors-table stale_client row + Client build / version skew section

Two edits to `viewmodel-shell/agent-skill.md`:

**(a) Errors-table `stale_client` row (line 119 of the canonical source, single-line row within the errors table).** Before: "The mutation was rejected before your `_state` was read — nothing was applied." After: "The request was rejected **before any controller runs — on a POST, your `_state` is never deserialized and nothing is applied.** As of v9.0.0 the guard enforces on **both GET and POST** (was POST-only in v3.8.0), so a GET refresh with a stale header also fails-closed." Three notable revisions: "mutation" → "request" (GET requests are not mutations); pre-guard timing rephrased GET-coherently ("before any controller runs — on a POST, ..."); one new clause added ("As of v9.0.0 the guard enforces on both GET and POST"). Fix-action clause preserved verbatim ("The fix is to reload to the current app ..., not to retry the same request. See *Client build / version skew*.").

**(b) `## Client build / version skew` section (lines 123-128 of the canonical source, 3-bullet section).** Intro sentence tightened to state header attachment on **GET + POST** (was "every action POST"). Fail-closed guard bullet rephrased GET-coherently ("before any controller runs (so on a POST, your `_state` is never deserialized and nothing is applied)") and gained a new clause ("As of v9.0.0 the guard enforces on **GET + POST** (was POST-only in v3.8.0): a GET refresh with a stale header also fails-closed"). NEW third bullet — **Browser hard-lock** — documents the shipped `BrowserAdapter.showSkewLock` non-dismissible modal (both signals: `serverBuild` mismatch AND `stale_client` rejection; single [Reload] button) and the `ShellOptions.onVersionSkew: "custom"` opt-out for browser consumers with pre-existing custom affordances (restores v3.8.0 behavior). Explicitly notes the modal is a browser affordance — "an agent driving the wire cold never sees the modal; the actionable behavior on `stale_client` is the same as v3.8.0 (reload, don't retry)."

**Commit:** `09c0c0d` — `docs(29-08): revise agent-skill.md Client build / version skew section for v9.0.0 (SKEW-10)`

### Task 2 — Byte-copy edited agent-skill.md to viewmodel-shell-dotnet/AgentSkill.md + parity gate + load-bearing string cross-parity

Straight `cp viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md` (true byte-copy, not hand re-edit). Verified via:

- `diff viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md` — exit 0, zero output
- `wc -c` — both files 27633B (identical byte counts)
- `bun -e 'import("./parity/check-skill.ts").then(m => m.checkSourceTwins())'` — `✓ skill source files byte-identical (27633B)` — parity gate green
- Load-bearing string cross-parity per AGENTS.md gotcha #9 class-2 defense: `grep -c 'GET + POST'` = 2 on both sides; `grep -c 'onVersionSkew'` = 1 on both sides; `grep -c 'BrowserAdapter'` = 1 on both sides — all equal.

**Commit:** (see final commit below — Task 2 files + ROADMAP + SUMMARY grouped)

## Grep verification (post-plan)

| Token | TS count | .NET count | Acceptance criterion |
|---|---|---|---|
| `GET + POST` | 2 | 2 | ≥ 2 ✓ |
| `onVersionSkew` | 1 | 1 | = 1 ✓ |
| `v9.0.0` | 3 | 3 | ≥ 2 ✓ |
| `POST-only in v3.8.0` | 2 | 2 | ≥ 1 ✓ |
| `## Client build / version skew` | 1 | 1 | = 1 ✓ (heading anchor preserved) |
| `before your `_state` was read` (old phrasing) | 0 | 0 | = 0 ✓ (GET-coherence gate) |
| `before any controller runs` (new anchor phrase) | 2 | 2 | ≥ 1 ✓ (GET-coherence gate) |
| `BrowserAdapter` | 1 | 1 | equal ✓ (cross-parity) |
| `^## ` (section-header count) | 16 | 16 | unchanged (no accidental header edits) |

`diff viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md` → exit 0, zero output. `wc -c` → 27633B both.

## Deviations from Plan

None — plan executed exactly as written. Task 1's initial intro-sentence phrasing ("GET and POST alike") did not satisfy the `grep -c 'GET + POST' ≥ 2` acceptance criterion (only the Fail-closed bullet had the literal `GET + POST`); tightened to "**GET + POST** alike" during Task 1 verification per acceptance criteria, before committing. No rule-based deviation invoked.

## Verification results

- **Task 1 acceptance criteria:** all 7 pass (see grep table above).
- **Task 2 acceptance criteria:** `diff` exit 0; `wc -c` identical; `checkSourceTwins()` green; load-bearing string cross-parity equal on all three tokens (`GET + POST`, `onVersionSkew`, `BrowserAdapter`).
- **Threat register:** T-29-26 (doc describes behavior that doesn't ship) mitigated by read-first workflow — Task 1 read `viewmodel-shell/src/index.ts` (shipped `checkVersionSkew` at ~3497, load() GET-side header attachment at ~3081, processResponse's stale_client arm at ~3247 no longer auto-reloading), `viewmodel-shell-dotnet/Versioning.cs` (shipped `ShellVersionGuardFilter` from Plan 29-02), and Plan 29-06's `BrowserAdapter.showSkewLock` DOM before revising the doc. T-29-27 (byte-parity drift) mitigated by `diff` + `wc -c` + `checkSourceTwins()` all green. T-29-27a (silent drift on ONE load-bearing token while diff shows byte-parity everywhere else) mitigated by the load-bearing string cross-parity grep on all three tokens.

## Self-Check: PASSED

- `viewmodel-shell/agent-skill.md` — FOUND (27633B, modified with 4 insertions + 3 modifications per Task 1 commit diffstat).
- `viewmodel-shell-dotnet/AgentSkill.md` — FOUND (27633B, byte-identical to TS twin).
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-08-SUMMARY.md` — FOUND (this file).
- `.planning/ROADMAP.md` — MODIFIED (29-08 row checkbox [ ] → [x]).
- Commit `09c0c0d` (Task 1) — FOUND in `git log --oneline` at HEAD~1.
