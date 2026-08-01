---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 08
subsystem: agent-discoverability
tags: [viewmodel-shell, agent-skill, rich-text, docs, wave-6, phase-28]

# Dependency graph
requires:
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 01
    provides: TS RichTextFieldNode + RichTextToolbarNode + RichTextTool closed union — the shipped types that the new skill section documents.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 02
    provides: .NET RichTextFieldNode + RichTextToolbarNode records + RichTextTool enum with byte-aligned wire — the byte-symmetric grounding for the "wire value is markdown" claim.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 05
    provides: RichTextToolbarNode renderer + shipped-inventory row — the composite is now the visible-in-the-wild shape the skill documents.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 07
    provides: FeatureProbe cross-backend byte-parity coverage — parity now proves both twins emit the same JSON for the RICH-01/02 nodes, so the skill documents the wire with confidence.

provides:
  - "viewmodel-shell/agent-skill.md gains a new `## Rich text fields (RICH-01, RICH-02)` section (70 lines) documenting the wire shape agents drive: two node types, markdown-string bind format, per-node field references, 11 D-08 tool names, five-step driving-cold walkthrough."
  - "viewmodel-shell-dotnet/AgentSkill.md byte-identical copy of the extended canonical source (via `cp`; the .NET path is a mirror, never edited directly)."
  - "Both files byte-identical (26622B, 321 lines). The parity gate (`checkSourceTwins()` + `checkHttpTwins()`) verifies both source files AND the served HTTP bodies on the HelpDesk twins."

affects: [28-11 (v8.2.0 release ritual — the aligned npm+NuGet publish now has a durable agent-facing wire manual for the rich text primitives, so consumers driving VMS apps via the JSON wire have the operating knowledge they need without decoding it from source)]

# Tech tracking
tech-stack:
  added: []  # Pure documentation additions — no new deps, no new code.
  patterns:
    - "Per-node reference section pattern: a new node type earns a documented section in agent-skill.md with (1) wire-value contract, (2) field reference table, (3) example JSON, (4) closed-union enumerations with forward-compat rule. Follows the Chart data (`type:\"chart\"`) section's structure verbatim; Route B composite adds parallel toolbar reference."
    - "Byte-copy discipline: viewmodel-shell/agent-skill.md is the CANONICAL source; viewmodel-shell-dotnet/AgentSkill.md is a mirror produced only by `cp`. Never edit the .NET file directly. Parity's `checkSourceTwins()` diffs both files; `checkHttpTwins()` diffs the HTTP bodies served at /.well-known/vms-skill.md from the two HelpDesk backends. Any drift fails the build."
    - "Field-name grep audit: after drafting the section, greppedd every documented field name against the shipped `viewmodel-shell/src/index.ts` type declarations byte-for-byte. Ground truth is the shipped code, NOT the CONTEXT/PATTERNS docs. All 8 rich-text-field fields (name, bind, label, placeholder, toolbar, required, disabled, state), all 4 rich-text-toolbar fields (tools, size, tone, state), and all 11 D-08 tool names match verbatim."

key-files:
  created:
    - ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-08-SUMMARY.md (this file)"
  modified:
    - "viewmodel-shell/agent-skill.md (+70 lines: new `## Rich text fields (RICH-01, RICH-02)` section between line 216 `## Lookup...` close and line 217 `## Files` — the natural per-node cluster location adjacent to other field types). 251 → 321 lines."
    - "viewmodel-shell-dotnet/AgentSkill.md (+70 lines: byte-copy of the above via `cp`). 251 → 321 lines."

key-decisions:
  - "SECTION PLACEMENT — between Lookup fields (line 148) and Files (line 217) rather than after Chart data. The plan's placement hint said 'adjacent to the existing Fields section' (there is no `## Fields` per se; the closest thing is Lookup fields at line 148 which is a field-related per-node reference). Placing rich-text between Lookup and Files clusters all per-node field references (Lookup → Rich text → Files → Chart data) in a natural top-to-bottom read, mirroring how the Chart data section sits at the end of the per-node cluster. Existing 15 anchor sections are preserved unchanged; verified via `grep -c '^## '` before/after edit (was 15, now 16 = +1 new section, no removals)."
  - "GROUND TRUTH IS THE SHIPPED CODE, NOT THE CONTEXT DOCS. Every field name in the new section was audited against `viewmodel-shell/src/index.ts:1825-1937` (the RichTextFieldNode + RichTextToolbarNode + RichTextTool declarations shipped in Plans 28-01 and 28-05). All 12 field names (8 field + 4 toolbar) and all 11 tool names match byte-for-byte. The CONTEXT doc's D-08 tool list and the shipped closed union were also cross-checked — they agree, but the grep against the shipped code is what actually locked in the correctness. Deliberate hedge against 'skill drift from shipped wire' (threat T-28-22 in the plan's threat model)."
  - "MARKDOWN-STRING WIRE IS THE HEADLINE. The section opens with a bold 🚨 rule: 'The `bind` path carries a plain markdown string. No HTML crosses this interface — ever.' This is the single most important thing an agent driving the wire needs to know, because it means the agent NEVER needs TipTap, NEVER renders the editor, NEVER dispatches toolbar clicks — the wire is a plain string a language model can produce directly. Explicitly named in step form ('never render the editor, never dispatch toolbar clicks, never need TipTap') so the reader can't miss the entailment of D-06."
  - "FIVE-STEP DRIVING-COLD WALKTHROUGH — anchors the section in the wire, not the editor. The plan spec wanted 5 steps: GET → locate field → read state[bindPath] → update state[bindPath] → POST action envelope. Kept it terse and numbered so an agent reading the manual can execute each step without ambiguity. The walkthrough is deliberately the LAST subsection so it's the takeaway."
  - "FORWARD-COMPAT RULE APPLIED TO TOOL NAMES. Mirrored the 'silently ignore unknown verbs' rule already established in the Side-effect verbs section — a new tool name added to the D-08 closed union is a MINOR bump, not a break, so agents should key off string values and ignore names they don't recognize. Cross-referenced ChartNode.kind's identical closed-widen-later posture (per index.ts:2462-2465, per the plan's must_haves.truths[5])."

patterns-established:
  - "Skill maintainer rule reinforced: any wire-shape change in a phase gets its skill section in the same phase, byte-copied to the .NET twin in the next commit, parity-gated on the next `bun run parity/run.ts`. This plan is the first application of that rule to a phase adding NEW node types (Phase 27 added `state?: string` to existing types and updated the skill implicitly through the state-axis section; Phase 28 adds two entirely new discriminators and gets a dedicated section). Template for the next 'new node type' phase to follow."

requirements-completed: [RICH-08]

# Metrics
duration: ~15 min
completed: 2026-08-01
---

# Phase 28 Plan 08: Agent skill extension — Rich text fields section Summary

**Extended `viewmodel-shell/agent-skill.md` (the canonical wire operating manual served to agents) with a `## Rich text fields (RICH-01, RICH-02)` section documenting the v8.2.0 wire additions — `rich-text-field` (leaf-input primitive) and `rich-text-toolbar` (Route B composite) — with the markdown-string bind format as the headline, per-node field references audited byte-for-byte against `viewmodel-shell/src/index.ts:1825-1937`, all 11 D-08 tool names, and a five-step driving-cold walkthrough. Byte-copied to `viewmodel-shell-dotnet/AgentSkill.md` per the AGENTS.md canonical-source discipline; parity gate green (both files byte-identical at 26622B / 321 lines; both HelpDesk backends serve byte-identical HTTP bodies at `/.well-known/vms-skill.md`).**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-01T05:20Z
- **Completed:** 2026-08-01T05:35Z
- **Tasks:** 2 (both `type="auto"`, `autonomous: true`)
- **Files modified:** 2 (agent-skill.md, AgentSkill.md)
- **Files created:** 1 (this SUMMARY.md)
- **Commits:** 2 task commits + 1 upcoming docs commit

## Accomplishments

### Task 1 — Draft + insert `## Rich text fields (RICH-01, RICH-02)` section (commit `a15a07a`)

Added a new 70-line section to `viewmodel-shell/agent-skill.md` (line 217, between `## Lookup / reference fields` and `## Files`). Section contents (matching the plan's content spec):

1. **Two new node types (v8.2.0)** — `rich-text-field` (leaf-input primitive) and `rich-text-toolbar` (composite for the editor's tool strip). Announced up-front.

2. **Wire value is a MARKDOWN STRING** — 🚨-flagged headline rule opening the section. Explicit five-clause consequence: agent never sees HTML, never renders the editor, never dispatches toolbar clicks, never needs TipTap, toolbar buttons are client-side UX (their effect is to mutate the markdown string, which an agent can produce directly). This is the most important consumer-facing implication of D-06.

3. **`rich-text-field` field reference** — full field table (name REQUIRED, bind REQUIRED, label?, placeholder?, toolbar?, required?, disabled?, state?) plus a JSON example showing all-fields-populated shape with a full-tool toolbar. Note that providing a `toolbar` slot REPLACES the framework's default toolbar.

4. **`rich-text-toolbar` field reference** — full field table (tools REQUIRED, size? with closed enum, tone? with closed enum, state?) plus a JSON example. Compact/expanded and tone unions match the shipped closed unions byte-for-byte.

5. **11 D-08 tool names** — listed once in kebab-case: `bold`, `italic`, `link`, `bullet-list`, `ordered-list`, `heading-1`, `heading-2`, `heading-3`, `inline-code`, `code-block`, `blockquote`. Forward-compat rule stated: silently ignore unknown tool names (widening later is additive, a MINOR bump not a break — cross-referenced ChartNode.kind's identical posture).

6. **Five-step driving-cold walkthrough** — numbered 1-5: GET endpoint → locate field in vm → read state[bindPath] → update state[bindPath] → POST action envelope. Anchored in the wire, not the editor.

Grep audit results (all pass Task 1's automated verify + acceptance criteria):

| Grep | Count | Required |
|------|-------|----------|
| `## Rich text fields` | 1 | present ✓ |
| `rich-text-field` | 6 | >= 3 ✓ |
| `rich-text-toolbar` | 6 | >= 3 ✓ |
| `markdown string` | 4 | >= 1 ✓ |
| `RICH-01` | 1 | >= 1 ✓ |

**Field-name audit against shipped types** (`viewmodel-shell/src/index.ts:1825-1937`):

- **RichTextFieldNode** — 8 documented fields (`name`, `bind`, `label`, `placeholder`, `toolbar`, `required`, `disabled`, `state`) match the shipped interface declaration verbatim.
- **RichTextToolbarNode** — 4 documented fields (`tools`, `size`, `tone`, `state`) match. Closed unions: `size?: "compact" | "expanded"` (matches shipped), `tone?: "danger" | "warning" | "success" | "info"` (matches shipped).
- **RichTextTool closed union** — 11 documented values (`bold`, `italic`, `link`, `bullet-list`, `ordered-list`, `heading-1`, `heading-2`, `heading-3`, `inline-code`, `code-block`, `blockquote`) match the shipped `export type RichTextTool = …` union verbatim.

Existing 15 anchor sections preserved unchanged (verified: `grep -c '^## '` was 15 before edit, is 16 after edit — pure additive change).

### Task 2 — Byte-copy to .NET AgentSkill.md + parity check-skill green (commit `05450b4`)

Three-step execution:

1. **Byte-copy:** `cp viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md`.
2. **Byte-identity verified:** `diff -q viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md` returned empty (both files 321 lines, 26622 bytes). No standalone edits to the .NET file — all content came from the `cp`.
3. **Parity check-skill green:**
   - Standalone `checkSourceTwins()` invocation: `✓ skill source files byte-identical (26622B)`
   - Full `bun run parity/run.ts` — passes at all four gates:
     - `Skill parity: ✓ skill source files byte-identical (26622B)` (source-twin phase)
     - `✓ skill HTTP twins byte-identical (26777B) across 2 backends` (HTTP-twin phase — both HelpDesk backends serve identical body, both include the app preamble `"This is a help-desk ticketing app."`, both have `text/markdown` content-type)
     - All fixture backends agree (all FeatureProbe rich-text tripwires from Plan 28-07 still green — the skill edit didn't affect the wire itself)
     - Final line: `✓ Parity tests passed`

## Task Commits

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Draft + insert Rich text fields section | `a15a07a` | `viewmodel-shell/agent-skill.md` (+70 lines) |
| 2 | Byte-copy to .NET + parity check-skill | `05450b4` | `viewmodel-shell-dotnet/AgentSkill.md` (+70 lines) |

## Verification

All plan-listed automated verifications green:

| Check | Result |
|-------|--------|
| `grep -c '## Rich text fields' viewmodel-shell/agent-skill.md` | 1 (required: 1) |
| `grep -c 'rich-text-field' viewmodel-shell/agent-skill.md` | 6 (required: >= 3) |
| `grep -c 'rich-text-toolbar' viewmodel-shell/agent-skill.md` | 6 (required: >= 3) |
| `grep -c 'markdown string' viewmodel-shell/agent-skill.md` | 4 (required: >= 1) |
| `grep -c 'RICH-01' viewmodel-shell/agent-skill.md` | 1 (required: >= 1) |
| All 11 D-08 tool names listed | ✓ (bold, italic, link, bullet-list, ordered-list, heading-1, heading-2, heading-3, inline-code, code-block, blockquote) |
| Field-name grep audit vs shipped `viewmodel-shell/src/index.ts` types | ✓ 12/12 field names match verbatim (8 field + 4 toolbar); 11/11 tool names match |
| Existing 15 anchor sections preserved | ✓ (16 total = 15 original + 1 new; none removed) |
| `diff -q viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md` | (empty — byte-identical) |
| `wc -l` line counts | 321 = 321 |
| `checkSourceTwins()` standalone | ✓ skill source files byte-identical (26622B) |
| `bun run parity/run.ts` full harness | ✓ Parity tests passed (source-twin + HTTP-twin + all fixture backends) |
| HTTP-twin bodies contain HelpDesk preamble | ✓ (both dotnet-helpdesk + bun-helpdesk serve 26777B bodies with `This is a help-desk ticketing app.` present) |
| HTTP-twin content-type | ✓ (both serve `text/markdown; charset=utf-8`) |

## Deviations from Plan

None. Plan executed exactly as written; both tasks passed automated verify + acceptance criteria on first attempt. No Rule 1-4 deviations, no auth gates, no architectural escalations. The plan's threat model (T-28-22 skill drift from shipped wire, T-28-23 .NET copy drift from canonical) is mitigated exactly as designed: Task 1's grep audit against `viewmodel-shell/src/index.ts` proves no drift from the shipped types; Task 2's `diff -q` + parity check-skill proves no drift between source + .NET copy.

## Threat Flags

None. This plan adds pure documentation to the canonical wire manual served to agents; it introduces no new network endpoints, no new auth paths, no new file access patterns, no new schema changes at trust boundaries. All modifications are inside the framework's own canonical + mirror skill markdown files. Both files are already served in production (via `MapVmsAgentSkill` on .NET + `createAgentSkillHandler` on TS) — this edit updates the content, not the surface.

## Self-Check

**1. Created files exist:**

- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-08-SUMMARY.md` → FOUND (this file).

**2. Modified files exist and contain the expected additions:**

- `viewmodel-shell/agent-skill.md` → FOUND. `grep -c '## Rich text fields' = 1`, `grep -c 'rich-text-field' = 6`, `grep -c 'rich-text-toolbar' = 6`, `grep -c 'markdown string' = 4`, `grep -c 'RICH-01' = 1`; all 11 tool names present; 321 lines.
- `viewmodel-shell-dotnet/AgentSkill.md` → FOUND. Byte-identical to canonical source: `diff -q` empty, 321 lines.

**3. Commits exist:**

- `a15a07a` → FOUND (`docs(28-08): add Rich text fields (RICH-01, RICH-02) section to canonical agent-skill.md`).
- `05450b4` → FOUND (`docs(28-08): byte-copy Rich text fields section to .NET AgentSkill.md`).

**4. Parity gate green:**

- `checkSourceTwins()` — `✓ skill source files byte-identical (26622B)`
- `checkHttpTwins()` (via full parity run) — `✓ skill HTTP twins byte-identical (26777B) across 2 backends`
- `bun run parity/run.ts` — `✓ Parity tests passed`

## Self-Check: PASSED
