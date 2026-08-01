---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 01
subsystem: ui
tags: [viewmodel-shell, composite-nodes, wire-types, typescript, rich-text, tiptap, route-b, phase-28]

# Dependency graph
requires:
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    provides: The `state?: string` uniformity axis pattern that RichTextFieldNode + RichTextToolbarNode adopt (Phase 27 landed the axis across 9 row/composite types; this plan adds a 10th and 11th).
  - phase: 24-v8-0-composite-nodes-layer-route-b-primary-composites-and-1-wir
    provides: The Route B composite typed-slots pattern + MessageNode as the composite TSDoc golden template that RichTextToolbarNode mirrors; the `case "avatar":` exhaustive-switch leaf-arm shape in server.ts that Task 2 mirrors.
  - phase: 12-chart-node-and-tui-chart-degradation
    provides: The Chart.js lazy-import precedent (D-04) that RichTextFieldNode's renderer will consume in later Phase 28 plans; the closed-widen-later `ChartNode.kind` union pattern that `RichTextTool` mirrors.

provides:
  - Two new wire interfaces in `viewmodel-shell/src/index.ts`: `RichTextFieldNode` (leaf-input primitive, D-01) and `RichTextToolbarNode` (Route B composite, D-02) with full TSDoc mirroring the AvatarNode + MessageNode golden templates.
  - One new closed union `RichTextTool` (11 values — D-08 Slack/GitHub floor: bold, italic, link, bullet-list, ordered-list, heading-1..3, inline-code, code-block, blockquote); widening is additive per gotcha #9's forward-compat posture (mirrors ChartNode.kind).
  - Two new union arms on `ViewNode` (`| RichTextFieldNode | RichTextToolbarNode`) placed between `MessageListNode` and `AlertNode`.
  - Two new exhaustive-switch defense-in-depth leaf arms in `viewmodel-shell/src/server.ts`'s `collectActions` walker, immediately after the existing `case "avatar":` no-op arm (per Analog D — both rich-text nodes are action-name-collision-safe leaves because their tool tokens are enum values resolved client-side by TipTap, never framework-side dispatches).
  - The TS wire contract that Plans 28-02 (.NET twin), 28-03 (renderer), 28-05 (composite renderer + tasting-gated CSS), 28-07 (parity fixture), and 28-08 (agent-skill) all depend on.

affects: [28-02 (mirrors these 2 interfaces + 1 enum on the .NET side), 28-03 (browser.ts renderer arms will dispatch on `type: "rich-text-field"` / `"rich-text-toolbar"`), 28-05 (composite renderer + tasting-gated CSS lands the shipped-inventory row for RichTextToolbarNode), 28-07 (FeatureProbe parity fixture emits both nodes with `expectBodyContains` tripwires), 28-08 (agent-skill.md gains a rich-text section keying off the discriminator strings)]

# Tech tracking
tech-stack:
  added: []  # No new deps in this plan — TipTap/turndown adoption is Plan 28-03's scope.
  patterns:
    - "Wire-first contract-landing: types + walker arms ship in Wave 1 before any renderer, so downstream Waves (renderer, .NET twin, parity) can parallelize against a committed contract."
    - "Route B composite governance applied to a wire-type-only plan: the RichTextToolbarNode interface lands NOW under the D-03 caveat that the composite's shipped-inventory row + renderer are gated on a served before/after tasting + Ashley visual sign-off (per composite-nodes-layer.md §2); the wire contract is the CONTRACT, not the earning."
    - "Closed-widen-later union pattern (RichTextTool mirrors ChartNode.kind): 11 values ship at v8.2.0; additive additions later stay MINOR bumps; consumers/agents key off the string, never assume a fixed set."
    - "Exhaustive-switch defense-in-depth on new leaf nodes: both new discriminators get `case ... return;` no-op arms in the collectActions walker so a future refactor that adds a dispatch-bearing slot to either node fails the TypeScript exhaustiveness check first (per banked 2026-07-16 Nelly finding on TrackerNode's .NET-side gap)."

key-files:
  created:
    - ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-01-SUMMARY.md (this file)"
  modified:
    - "viewmodel-shell/src/index.ts (+182 lines: 2 new interfaces + 1 closed union type + 2 union arms; insertion sites documented below)"
    - "viewmodel-shell/src/server.ts (+17 lines: 2 leaf-arm no-op case statements in collectActions immediately after `case \"avatar\":` at line 500)"

key-decisions:
  - "PLACEMENT: The two new interfaces were placed AFTER MessageListNode (line 1755) and BEFORE AlertNode (line 1757), NOT literally between MessageNode and MessageListNode. Rationale: MessageNode and MessageListNode are a conceptually paired composite (message + its list container); inserting Rich-Text between them would orphan the pair. The plan's location hint 'immediately after the existing MessageNode block' is honored in spirit — the interfaces sit in the Route B composites section, right after the Message* pair, so composite recipes cluster together in source order. Task 1 acceptance-criteria greps (interface counts, discriminator counts, union-arm counts) all pass regardless of placement, so this is a cosmetic ordering choice."
  - "TSDoc RE-USES the deferred-field vocabulary (mentionsProvider, plainTextValueBind, allowedMarks/Nodes, heightMin, heightMax, sanitizeConfig, imageUpload) as PROSE per the plan's explicit Task 1 instruction ('the TSDoc must include ... the ANTICIPATED CUSTOMIZATION block enumerating deferred fields'). This intentionally moves the pre-existing grep count for those tokens from 0 to a higher value in TSDoc comments only — no interface field with those names is added. This is a benign departure from the acceptance-criterion `grep -q '^0$'` safety tripwire because the plan's own body instructs the enumeration; verifiable by inspecting the code that no `mentionsProvider: ...` / `plainTextValueBind: ...` / `allowedMarks: ...` / `heightMin: ...` interface field exists (only backtick-quoted mentions in TSDoc)."
  - "COMMENT SAFETY: The pattern `.planning/phases/28-*/28-CONTEXT.md` when written inside a JSDoc `/** */` block prematurely closes the comment because the literal `*/` (from the `-*/`) is a valid JSDoc terminator. Fixed by writing the path as `.planning/phases/28-.../28-CONTEXT.md` throughout the two rich-text-field TSDoc blocks. Detected at Task 1 build with 20 cascading `TS2304 Cannot find name 'signal'` errors starting at line 1924, root-caused by grepping for `*/` in the new section. This is a load-bearing gotcha for future TSDoc that references phase glob paths."
  - "WALKER SCOPE: Only `collectActions` (the first walker at server.ts:141) got the new arms per the plan's explicit instruction 'Do NOT add arms to walkers whose switch does NOT already carry the `case \"avatar\":` no-op'. The second walker `walkForSectionAction` at server.ts:679 uses `default: return` for leaf nodes (documented explicitly in its comment at lines 949-956) and does NOT carry `case \"avatar\":`. Verified with `grep -c 'case \"avatar\"' server.ts` = 1; new arm counts also = 1 each."

patterns-established:
  - "TSDoc paths that reference phase glob directories MUST be written as `.planning/phases/28-.../28-CONTEXT.md` (or similar sanitized form), NOT `.planning/phases/28-*/28-CONTEXT.md`, because the literal `*/` inside the phase glob prematurely closes a JSDoc `/** */` block and cascades into unrelated syntax errors far below. Load-bearing for any future doc block that references glob paths."
  - "Wire-first plan-sequencing pattern for a new node type spanning renderer + .NET twin + parity + agent-skill: Wave 1 lands the TS contract (interfaces + validator arms) so downstream plans parallelize against a committed shape. Precedent for Plan 28-01's shape."

requirements-completed: [RICH-01, RICH-04]

# Metrics
duration: ~15 min
completed: 2026-08-01
---

# Phase 28 Plan 01: Rich text WYSIWYG wire types Summary

**Added `RichTextFieldNode` leaf-input primitive + `RichTextToolbarNode` Route B composite + `RichTextTool` closed union (11-value Slack/GitHub floor) to `viewmodel-shell/src/index.ts`, and added exhaustive-switch defense-in-depth leaf arms for both new discriminators to `collectActions` in `viewmodel-shell/src/server.ts` — establishing the v8.2.0 TS wire contract that Plans 28-02 through 28-08 build against.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-01T02:35Z (approx — orchestrator dispatch)
- **Completed:** 2026-08-01T02:50Z
- **Tasks:** 2
- **Files modified:** 2
- **Files created:** 1 (this SUMMARY.md)

## Accomplishments

### Task 1 — Wire types + union arms in `index.ts` (commit `23205be`)

Three new exports added:

1. **`RichTextFieldNode`** interface — leaf-input primitive with `type: "rich-text-field"`, REQUIRED `name` + `bind` (markdown-string round-trip target per D-06), and 6 optional fields (`label?`, `placeholder?`, `toolbar?: RichTextToolbarNode`, `required?`, `disabled?`, `state?: string`). TSDoc covers D-01 (why a dedicated node), D-06 (markdown-string wire, zero XSS on the wire), D-08 (Slack/GitHub feature-surface floor), D-Q4 (sanitization posture — display-side through existing markdown.ts pipeline), and enumerates the D-01 anticipated customization surface (allowedMarks/allowedNodes, mentionsProvider, plainTextValueBind, heightMin/heightMax, sanitizeConfig, imageUpload) as PROSE only — no interface fields with those names are added (deferred per CONTEXT §Deferred).

2. **`RichTextToolbarNode`** interface — Route B composite with `type: "rich-text-toolbar"`, REQUIRED `tools: RichTextTool[]` (the composite's semantically-primary slot per typed-slots §3), plus 3 closed-enum variance axes (`size?: "compact" | "expanded"`, `tone?: "danger" | "warning" | "success" | "info"`, `state?: string`). NO raw CSS/style fields — variance is closed-enum only per composite-nodes-layer.md §3. TSDoc covers D-02 (why a composite, not `SectionNode(row) + ButtonNode` composition), D-03 (the tasting-before-ship rule that gates the composite's shipped-inventory row + renderer in later plans), the typed-slots pattern, and the D-02 anticipated customization surface (visibleTools, headings-dropdown, position variants, compact/expanded, overflow-to-kebab) as PROSE.

3. **`RichTextTool`** closed union — 11 values (`"bold" | "italic" | "link" | "bullet-list" | "ordered-list" | "heading-1" | "heading-2" | "heading-3" | "inline-code" | "code-block" | "blockquote"`) matching the D-08 Slack/GitHub floor. TSDoc mirrors the ChartNode.kind closed-widen-later posture (index.ts:2462-2465): widening later is additive; consumers/agents key off the string, never assume a fixed set.

Two new arms added to the `ViewNode` discriminated union at lines 214-215, placed between `MessageListNode` and `AlertNode`.

Every optional field uses `?:` (intrinsic side of gotcha #8 for the TS twin — no `null` on the wire).

### Task 2 — Validator arms in `server.ts` (commit `c1e9d0b`)

Two `case ... return;` leaf-arm no-op statements added to `collectActions` at lines 507 and 516, immediately after the existing `case "avatar":` no-op arm at line 500. Comments cite v8.2.0 (RICH-01) / (RICH-02) provenance and the Analog D rationale (both new nodes are leaves for action-name uniqueness — RichTextFieldNode has no action-bearing descendants; its `toolbar?` slot's `tools[]` are enum tokens naming TipTap chain commands resolved CLIENT-SIDE, never framework-side dispatches; RichTextToolbarNode's `tools[]` are the same enum tokens).

Only the first walker (`collectActions`) gets the arms — the second walker (`walkForSectionAction` at server.ts:679) uses `default: return` for leaf nodes and does not carry `case "avatar":` (verified by `grep -c 'case "avatar"' server.ts` = 1). Task 2's acceptance criterion `count of new arms == count of existing avatar arms` is satisfied: 1 = 1 = 1.

## Task Commits

| # | Task                                                                          | Commit    | Files                                     |
|---|-------------------------------------------------------------------------------|-----------|-------------------------------------------|
| 1 | Add RichTextFieldNode + RichTextToolbarNode interfaces + RichTextTool union + union arms in index.ts | `23205be` | viewmodel-shell/src/index.ts (+182 lines) |
| 2 | Add exhaustive-switch defense-in-depth walker arms in server.ts               | `c1e9d0b` | viewmodel-shell/src/server.ts (+17 lines) |

## Insertion sites (post-edit line numbers)

`viewmodel-shell/src/index.ts`:

| Export                                 | Line   |
|----------------------------------------|-------:|
| `\| RichTextFieldNode` (ViewNode arm)  |    214 |
| `\| RichTextToolbarNode` (ViewNode arm)|    215 |
| `export interface RichTextFieldNode {` |   1825 |
| `export interface RichTextToolbarNode {`|  1894 |
| `export type RichTextTool =`           |   1926 |

`viewmodel-shell/src/server.ts`:

| Arm                             | Line  |
|---------------------------------|------:|
| `case "avatar":` (existing)     |   500 |
| `case "rich-text-field":`       |   507 |
| `case "rich-text-toolbar":`     |   516 |

## Verification

All plan-listed automated verifications green:

| Check                                                                | Result |
|----------------------------------------------------------------------|--------|
| `cd viewmodel-shell && npm run build`                                | exit 0 |
| `cd viewmodel-shell && npm run check:test-types`                     | exit 0 |
| `cd viewmodel-shell && npm run check:core-globals`                   | exit 0 (`AGNOSTIC-03: src/index.ts references zero platform globals`) |
| `cd viewmodel-shell && npx vitest run`                               | 79 test files pass, 1315 tests pass, 1 skipped |
| `grep -c 'export interface RichTextFieldNode' src/index.ts`          | 1 (required: 1) |
| `grep -c 'export interface RichTextToolbarNode' src/index.ts`        | 1 (required: 1) |
| `grep -c 'export type RichTextTool' src/index.ts`                    | 1 (required: 1) |
| `grep -c '\| RichTextFieldNode' src/index.ts`                        | 1 (required: 1) |
| `grep -c '\| RichTextToolbarNode' src/index.ts`                      | 1 (required: 1) |
| `grep -cE '"rich-text-field"\|"rich-text-toolbar"' src/index.ts`     | 2 (required: ≥ 2) |
| `grep -c 'case "avatar"' src/server.ts` (baseline)                   | 1 |
| `grep -c 'case "rich-text-field"' src/server.ts`                     | 1 (matches baseline) |
| `grep -c 'case "rich-text-toolbar"' src/server.ts`                   | 1 (matches baseline) |

## Deviations from Plan

**1. [Rule 3 — Blocking issue] JSDoc premature-close via `28-*/28-CONTEXT.md` path**

- **Found during:** Task 1 build after first Write of the TSDoc.
- **Issue:** Two references to `.planning/phases/28-*/28-CONTEXT.md` inside `/** ... */` JSDoc blocks broke the comment: the literal `*/` inside `28-*/` closes the JSDoc block prematurely, cascading into 20+ `TS2304 Cannot find name 'signal'` errors starting at line 1924 (deep inside what should have been the RichTextTool TSDoc).
- **Fix:** Wrote the path as `.planning/phases/28-.../28-CONTEXT.md` in both occurrences (RichTextFieldNode TSDoc D-01 section and RichTextTool TSDoc D-08 section).
- **Files modified:** `viewmodel-shell/src/index.ts` (2 in-TSDoc path edits before commit)
- **Commit:** Rolled into `23205be` — the fix landed pre-commit, no separate hash.

**2. [Placement discretion] Interfaces placed AFTER MessageListNode, not between MessageNode and MessageListNode**

- **Found during:** Task 1 planning.
- **Issue:** Plan's location hint says "immediately after the existing MessageNode block (~line 1687-1723)" — literal reading would insert between MessageNode and MessageListNode, orphaning that natural pair.
- **Fix:** Inserted AFTER MessageListNode (line 1755) and BEFORE AlertNode (line 1757), keeping the Message* composite pair intact. All acceptance-criteria greps pass regardless of placement.
- **Files modified:** none (this is where the initial Write landed).

**3. [Interpretive] TSDoc enumeration of deferred fields lifts `grep -cE 'mentionsProvider|...' src/index.ts` from 0**

- **Found during:** Reviewing Task 1 acceptance criteria pre-commit.
- **Issue:** The plan's Task 1 acceptance criterion says `grep -cE 'mentionsProvider|plainTextValueBind|allowedMarks|heightMin' viewmodel-shell/src/index.ts | grep -q '^0$'` OR the pre-existing count is unchanged. Baseline was 0. The plan's Task 1 body ALSO instructs enumerating those exact tokens in the TSDoc `ANTICIPATED CUSTOMIZATION` block. The two directives conflict.
- **Fix:** Followed the plan's body instruction (more specific, semantically-load-bearing) — enumerated the deferred fields in TSDoc prose. Verified NO interface field with those names is added; the tokens only appear in `/** */` documentation comments. The safety tripwire fires false-positive because the plan's own body requests the mentions.
- **Files modified:** none (this is the intended TSDoc content).

No other deviations. No Rule 4 architectural-decision escalations. No authentication gates. No pre-existing test failures encountered.

## Self-Check

**1. Created files exist:**

- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-01-SUMMARY.md` → FOUND (this file).

**2. Modified files exist and contain the expected additions:**

- `viewmodel-shell/src/index.ts` → FOUND. Contains all 5 grep-targets (2 interfaces + 1 union type + 2 union arms + 2 discriminator strings).
- `viewmodel-shell/src/server.ts` → FOUND. Contains both `case "rich-text-field":` and `case "rich-text-toolbar":` arms.

**3. Commits exist:**

- `23205be` → FOUND (`feat(28-01): add RichTextFieldNode + RichTextToolbarNode wire types`).
- `c1e9d0b` → FOUND (`feat(28-01): add rich-text tree-validator arms in server.ts`).

## Self-Check: PASSED
