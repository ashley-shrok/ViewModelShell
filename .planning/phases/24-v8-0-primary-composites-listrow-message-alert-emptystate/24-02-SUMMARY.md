---
phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate
plan: 02
subsystem: ui
tags: [viewmodel-shell, composite-nodes, message, chat, follow-tail, tree-invariant, polymorphic-discriminator, whenwritingdefault, kebabenum, wcag-aa]

# Dependency graph
requires:
  - phase: 23-v8-0-composite-nodes-foundations
    provides: TextNode.style:"caption" + TextNode.weight axis + AvatarNode primitive
  - phase: 24-01
    provides: ListRowNode + ListNode.variant:"rows" (shared files touched)
provides:
  - MessageNode wire type ("message") — TS + .NET byte-identical
  - MessageListNode wire type ("message-list") — TS + .NET byte-identical
  - MessageRole closed enum (user / assistant / system) — .NET real enum + KebabEnum
  - Tree invariant on MessageListNode.children (byte-identical error across backends)
  - REUSE proof of SectionNode.followTail data-follow-tail mechanism for a second consumer
affects: [24-07 (Showcase adoption), 24-08 (FeatureProbe parity extension), 25-* (future composites consuming MessageNode.avatar slot), any /ai chat consumer]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Polymorphic-slot preservation: every ViewNode-typed list on .NET is typed IReadOnlyList<ViewNode>? (not narrow) so System.Text.Json emits the type discriminator — applied to MessageNode.Actions AND MessageListNode.Children (both would otherwise silently drop 'type':'message' / 'type':'button' from the wire). Banked from FormNode.Buttons at :1155-1159."
    - "REUSE-not-rebuild for cross-cutting adapter mechanisms: MessageListNode.followTail sets one line (`div.dataset.followTail = ''`) and inherits SectionNode's shipped snapshot/restore at browser.ts:239-246 + :362-372 — proven by a code-search test that asserts no scrollHeight/scrollTop= inside messageList() and a per-file count invariant across browser.ts. Establishes the template for future feeds (activity log, live tracker)."
    - "Byte-identical cross-backend tree-invariant messages: `MessageListNode.children must all be MessageNodes (found: <type>)` fires in both TS collectActions and .NET ViewTreeValidation.Collect. Verified end-to-end via runtime probe (TS) and xUnit fact (.NET)."

key-files:
  created:
    - viewmodel-shell/test/message.test.ts
    - viewmodel-shell/test/message-followtail.test.ts
    - viewmodel-shell-dotnet/Tests/MessageNodeSerializationTests.cs
    - viewmodel-shell-dotnet/Tests/MessageListNodeSerializationTests.cs
  modified:
    - viewmodel-shell/src/index.ts
    - viewmodel-shell/src/browser.ts
    - viewmodel-shell/src/server.ts
    - viewmodel-shell/styles/default.css
    - viewmodel-shell-dotnet/ViewModels.cs

key-decisions:
  - "MessageNode.Actions typed IReadOnlyList<ViewNode>? on .NET (widened from IReadOnlyList<ButtonNode>?): a narrow list drops the polymorphic 'type':'button' discriminator, matches FormNode.Buttons banked posture."
  - "MessageListNode.Children typed IReadOnlyList<ViewNode> on .NET (widened from IReadOnlyList<MessageNode>): same discriminator reason. Tree invariant migrates from compile-time to runtime enforcement in ViewTreeValidation.Collect."
  - "MessageListNode.followTail reuses SectionNode.followTail's shipped data-follow-tail mechanism verbatim. One line of new adapter code: `if (n.followTail === true) div.dataset.followTail = ''`. No parallel snapshot/restore. Code-search test + per-file scrollHeight/scrollTop-count invariant enforce it."
  - "TS MessageListNode.children stays typed MessageNode[] (compile-time narrow) while .NET widens; the runtime validator in server.ts collectActions casts through unknown so hostile deserialization tripping the same guard produces the same error message."

patterns-established:
  - "Composite tree invariants use the byte-identical-message contract: emit exactly `<NodeType>.children must all be <ChildType>s (found: <other-type>)` in both backends. The <other-type> is a wire-type string (server.ts uses `child.type`; .NET uses ViewNodeWireName)."
  - "AA-contrast hand-check for a tinted-info surface × body text: 6% color-mix on top of --vms-surface leaves the base surface × text contrast almost fully intact (16.05:1 light / 13.39:1 dark; both clear AAA-normal 7:1 with margin). No deepening needed."

requirements-completed: [COMP-06, COMP-06a]

# Metrics
duration: 20min
completed: 2026-07-29
---

# Phase 24 Plan 02: MessageNode + MessageListNode Summary

**MessageNode (author + timestamp + role-tinted content + always-visible actions) and MessageListNode (follow-tail transcript reusing SectionNode.followTail's shipped scroll-pin mechanism) shipped byte-identical across TS + .NET with tree-invariant enforcement and 48 tests.**

## Performance

- **Duration:** 20 min
- **Started:** 2026-07-29T19:20:24Z
- **Completed:** 2026-07-29T19:40:30Z
- **Tasks:** 4
- **Files modified:** 5 + 4 new test files = 9 files touched

## Accomplishments

- MessageNode + MessageListNode wire types shipped byte-identical (TS + .NET), consumed by /ai chat + every comment/thread/message/activity-feed app.
- MessageListNode.followTail REUSES SectionNode.followTail's data-follow-tail mechanism VERBATIM — one line of new adapter code (`div.dataset.followTail = ""`), zero parallel snapshot/restore. Plan-checker C-4 reuse mandate satisfied and enforced by two mutation-testable tests.
- Tree-validator descent + MessageListNode child-type rejection wired on both backends with byte-identical error message: `MessageListNode.children must all be MessageNodes (found: <type>)`.
- Full test coverage: 26 vitest tests (18 message + 8 followtail) + 22 .NET xUnit facts (13 MessageNode + 9 MessageListNode). AA-contrast hand-check for assistant tinted-info surface × body text × 13 themes recorded in the message.test.ts header (all clear AAA-normal 7:1 with margin — no deepening needed).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add MessageNode + MessageListNode wire types (TS + .NET) + CSS block** — `7c546b0` (feat)
2. **Task 2: Wire MessageNode + MessageListNode renderers in browser.ts (REUSE data-follow-tail)** — `94820fc` (feat)
3. **Task 3: Wire tree-validator walker arms + MessageListNode child-type rejection (TS + .NET)** — `cbcd199` (feat)
4. **Task 4: vitest render tests + follow-tail reuse test + AA hand-check + .NET serialization tests** — `a3f7168` (test)

## Files Created/Modified

**Created:**
- `viewmodel-shell/test/message.test.ts` — 18 vitest tests: DOM shape, role variance, string-lift content, avatar dispatch, timestamp presence/absence, actions always-visible + no hover-reveal, click dispatch. AA-contrast hand-check header for 13 themes.
- `viewmodel-shell/test/message-followtail.test.ts` — 8 vitest tests using the byte-aligned scrollHeight/clientHeight jsdom stub pattern from test/follow-tail.test.ts. Attribute emission, at-bottom/scrolled-up pin behavior, and TWO mutation-testable REUSE proofs: (a) messageList() body contains ONLY `dataset.followTail` and NO scrollHeight / scrollTop-= / querySelectorAll(follow-tail), and (b) total browser.ts scrollHeight|scrollTop-= regex-match count is UNCHANGED from Task-1 baseline (6 occurrences).
- `viewmodel-shell-dotnet/Tests/MessageNodeSerializationTests.cs` — 13 xUnit facts: discriminator, class-2 findNulls bare-node shape, MessageRole KebabEnum round-trip (all 3 members), polymorphic Avatar/Content/Actions[] emission, per-field presence + absence, AllFieldsSet.
- `viewmodel-shell-dotnet/Tests/MessageListNodeSerializationTests.cs` — 9 xUnit facts: discriminator, empty children array shape, polymorphic message discriminator on children, FollowTail_False_SerializedAsAbsent (WhenWritingDefault verification), FollowTail_True_SerializedAsTrue, TreeInvariant_MessageListWithNonMessageChild_ThrowsInvalidTree (byte-identical error to TS twin) + positive control.

**Modified:**
- `viewmodel-shell/src/index.ts` — MessageNode + MessageListNode interfaces (both with LOCKED slot schemas from CONTEXT §3/§4); union grown; TSDoc explicitly names the data-follow-tail REUSE and cross-references browser.ts line ranges.
- `viewmodel-shell/src/browser.ts` — Imports updated; renderNode switch arms added; private message() emits the [avatar | body] grid with string-lift TextNode wrapping + always-visible actions; private messageList() sets `data-follow-tail` as the ONE new adapter line and dispatches children through the shipped node() walk. Verified via `npm run check:core-globals` (no new platform globals).
- `viewmodel-shell/src/server.ts` — Imports updated; collectActions case "message" descends into avatar + content (typeof-guarded) + actions[]; case "message-list" enforces the tree invariant AND descends into every child; walkForSectionAction has passthrough arms so a future SectionNode nested in a message avatar/content is caught by the same nested-interaction guard.
- `viewmodel-shell/styles/default.css` — Full .vms-message* + .vms-message-list block appended after the ListRowNode block: grid layout, header baseline alignment, tinted-info assistant surface via color-mix(--vms-info 6%, --vms-surface), always-visible actions bar (no hover-reveal class ever emitted).
- `viewmodel-shell-dotnet/ViewModels.cs` — MessageRole enum + [JsonDerivedType] registrations + MessageNode record + MessageListNode record + walker arms in both Collect + WalkForSectionAction + ViewNodeWireName extended. WhenWritingDefault on FollowTail matches SectionNode.FollowTail posture at :999 exactly.

## Decisions Made

- **Widen MessageNode.Actions to `IReadOnlyList<ViewNode>?` on .NET** — a narrow `IReadOnlyList<ButtonNode>?` silently drops the polymorphic `"type":"button"` discriminator (verified via probe: `Actions_SerializesAsPolymorphicArray` failed before the widening). The FormNode.Buttons posture at :1155-1159 is the banked template. Runtime cast in the Collect walker matches the FormNode.Buttons `OfType<ButtonNode>()` handling.
- **Widen MessageListNode.Children to `IReadOnlyList<ViewNode>` on .NET** — same polymorphic-discriminator reason. The tree invariant migrates from compile-time (`IReadOnlyList<MessageNode>`) to runtime enforcement in ViewTreeValidation.Collect. Byte-identical error message across backends.
- **Keep TS MessageListNode.children narrowly typed `MessageNode[]`** — the TS compile-time type provides authoring safety for honest callers; the runtime validator (which casts through `unknown`) catches hostile deserialization. Different type-system posture per backend is the cost of the polymorphic-discriminator preservation on the .NET side.
- **AA-contrast: no deepening required.** The 6% info-tinted assistant surface preserves ~93% of the base contrast (16.05:1 light / 13.39:1 dark), both well above AAA-normal 7:1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Polymorphic discriminator lost on `MessageNode.Actions`**
- **Found during:** Task 4 (running .NET serialization tests).
- **Issue:** Plan specified `IReadOnlyList<ButtonNode>?` (per PATTERNS.md §5 with a claimed grep-verified analog). The claim was incorrect — `grep "IReadOnlyList<ButtonNode>"` returns nothing in ViewModels.cs; every existing action-bearing list is typed `IReadOnlyList<ViewNode>?` specifically to preserve the polymorphic `"type":"button"` discriminator (FormNode.Buttons at :1155-1159 with an explicit comment naming this rule). Narrow ButtonNode typing silently drops the discriminator — a cross-backend WIRE DRIFT with the TS twin (TS emits `type` unconditionally).
- **Fix:** Widened `MessageNode.Actions` to `IReadOnlyList<ViewNode>?`. Kept the collect walker's iteration since it doesn't type-check button.Action anyway (matches FormNode.Buttons handling).
- **Files modified:** viewmodel-shell-dotnet/ViewModels.cs (`MessageNode` record + `Collect` walker comment update).
- **Verification:** `Actions_SerializesAsPolymorphicArray` now passes; assertion `Assert.Contains("\"type\":\"button\"", json)` green.
- **Committed in:** `a3f7168` (Task 4 commit).

**2. [Rule 1 - Bug] Polymorphic discriminator lost on `MessageListNode.Children`**
- **Found during:** Task 4 (running .NET serialization tests).
- **Issue:** Same class as deviation 1 — narrow `IReadOnlyList<MessageNode>` typing silently drops `"type":"message"` on each child. Verified by test: `Children_WithMessages_SerializesPolymorphically` expected 2 occurrences of `"type":"message"` and got 0 before the fix.
- **Fix:** Widened `MessageListNode.Children` to `IReadOnlyList<ViewNode>`. Moved the tree invariant from compile-time enforcement to runtime enforcement in ViewTreeValidation.Collect (was already there defensively; now it is the sole enforcement path). Runtime test uses the constructor directly (no reflection back-door needed post-widening) — closer twin of the TS runtime probe.
- **Files modified:** viewmodel-shell-dotnet/ViewModels.cs (MessageListNode record + Collect walker comment); viewmodel-shell-dotnet/Tests/MessageListNodeSerializationTests.cs (rewrote the tree-invariant test without reflection).
- **Verification:** `Children_WithMessages_SerializesPolymorphically` + `TreeInvariant_MessageListWithNonMessageChild_ThrowsInvalidTree` + newly-added positive control `TreeInvariant_MessageListWithMessageChildren_Passes` all green.
- **Committed in:** `a3f7168` (Task 4 commit).

**3. [Rule 1 - Bug] Duplicate `ListRowNode => "list-row"` arm in `ViewNodeWireName`**
- **Found during:** Task 3 (initial .NET build).
- **Issue:** The initial edit to `ViewNodeWireName` appended a `ListRowNode` entry without noticing the existing entry a few lines above; C# CS8510 caught it as an unreachable-pattern error.
- **Fix:** Removed the duplicate.
- **Files modified:** viewmodel-shell-dotnet/ViewModels.cs.
- **Verification:** `dotnet build` green.
- **Committed in:** `cbcd199` (Task 3 commit — caught pre-commit, one-line fix).

---

**Total deviations:** 3 auto-fixed (Rule 1 bugs — 2 wire-drift, 1 build-blocking duplicate).
**Impact on plan:** Deviations 1 + 2 are load-bearing corrections to the plan's polymorphic-typing directive; without them the .NET twin would ship WIRE-DRIFTED (missing `"type":"button"` on message actions and `"type":"message"` on message-list children). The plan-checker's AGENTS.md-quoted policy in PATTERNS.md §5 Analog B is what actually governs, and the plan's own §5 code block also said "typed IReadOnlyList<ButtonNode>?" which contradicts Analog B. This was the right call to fix per Rule 1 discipline — the tests caught it structurally rather than the plan's grep-check catching it. Deviation 3 is a trivial build fix. No scope creep.

## Issues Encountered

None. The plan's `<interfaces>` section was accurate on the followTail REUSE mechanism (browser.ts line references verified verbatim), the CSS block was verbatim from PATTERNS.md §4, and the .NET tree-invariant machinery was exactly as documented. The only friction was the narrow-typed slot claim in PATTERNS.md §1 code blocks, which the deviation rules automatically corrected on first .NET test run.

## Follow-Tail REUSE Proof (plan-checker C-4 mandate confirmation)

The critical directive: MessageListNode.followTail:true MUST reuse SectionNode's shipped data-follow-tail mechanism at browser.ts:53-58 (constant), :227-231 (skip generic scroll-map), :239-246 (pre-render snapshot), :362-372 (post-render restore), :1063 (SectionNode's own dataset write).

**Evidence of reuse:**

1. **One line of new adapter code.** `viewmodel-shell/src/browser.ts:1332` (inside `private messageList`):
   ```typescript
   if (n.followTail === true) div.dataset.followTail = "";
   ```
   Verbatim from browser.ts:1063 (SectionNode's own emission).

2. **NO parallel snapshot/restore logic.** Code-search test (`message-followtail.test.ts` "messageList() body contains ONLY dataset.followTail") extracts the `private messageList()` body via regex and asserts:
   - It contains `dataset.followTail = ""`.
   - Its code (comments stripped) contains NO `scrollHeight`.
   - Its code contains NO `scrollTop =` or bare `scrollTop`.
   - Its code contains NO `querySelectorAll(...data-follow-tail...)`.

3. **File-wide grep-count invariant.** Second code-search test asserts total browser.ts occurrences of `scrollHeight` OR `scrollTop\s*=` = **6 (unchanged from Task-1 landing time)**. Baseline verified via `git show 7c546b0:viewmodel-shell/src/browser.ts | node -e "..." → 6`. If a future edit tries to add a parallel implementation, this count grows and the test fails loudly.

4. **Mutation verification.** Commented out the single `if (n.followTail === true) div.dataset.followTail = "";` line; ran `npx vitest run test/message-followtail.test.ts` → **4 of 8 tests failed** (attribute emission, all three pin-to-bottom cases, code-search REUSE proof). Reverted line; all 8 pass. Documents that the assertion actually gates the reuse.

**Byte-identical tree-invariant error message (verified end-to-end):**
- TS runtime probe: `validateActionNames({ type: "message-list", children: [{ type: "text", value: "not a message" }] })` throws `Error: MessageListNode.children must all be MessageNodes (found: text)`.
- .NET xUnit fact: `TreeInvariant_MessageListWithNonMessageChild_ThrowsInvalidTree` calls `ViewTreeValidation.ValidateActionNames(...)` on a `MessageListNode` with a `TextNode` child → throws `InvalidOperationException` with the identical string.

## Green-Tree Gate

Full gate before landing (per AGENTS.md working agreement):

- `npm run build` — GREEN (tsc -b tsconfig.tui.json)
- `npm run check:core-globals` — GREEN (AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals)
- `npm run check:test-types` — GREEN (tsc -p tsconfig.test.json --noEmit)
- `npm run check:demo-types` — GREEN (21 demo projects type-check clean)
- `npm run check:aa-contrast` — GREEN (all 13 pairs meet WCAG-AA on default + 12 themes)
- `npm run check:no-demo-style` — GREEN (17 hand-edited frontend HTML files zero-<style>)
- `npx vitest run` — GREEN (1093 tests, 1 skipped)
- `dotnet test viewmodel-shell-dotnet/Tests` — GREEN (291 tests)
- `bun run parity/run.ts` — GREEN (cross-backend byte-diff + per-response invariants + skill parity)

No release ship (per Phase 24 CONTEXT §11 — batch-then-ship; v8.0.0 publishes at Phase 26 closeout).

## Self-Check

Files created (verified via `[ -f ... ]`):
- FOUND: viewmodel-shell/test/message.test.ts
- FOUND: viewmodel-shell/test/message-followtail.test.ts
- FOUND: viewmodel-shell-dotnet/Tests/MessageNodeSerializationTests.cs
- FOUND: viewmodel-shell-dotnet/Tests/MessageListNodeSerializationTests.cs

Commits present in git log:
- FOUND: 7c546b0 (Task 1)
- FOUND: 94820fc (Task 2)
- FOUND: cbcd199 (Task 3)
- FOUND: a3f7168 (Task 4)

## Self-Check: PASSED

## Next Phase Readiness

- Wave 2 landed (both 24-02 + 24-06). Wave 3 (24-03 AlertNode) can begin.
- Downstream consumers ready: 24-07 (Showcase Primary-Composites section can adopt MessageNode + MessageListNode); 24-08 (FeatureProbe fixture extension can add the message + message-list branches with tripwires).
- No blockers; no CHANGELOG bump (batch-then-ship — Phase 24 stays at 7.1.0/7.0.0).

## Threat Flags

No new threat surface introduced. MessageNode + MessageListNode are passive rendering nodes; MessageNode.actions carries ButtonNode dispatch shapes that already flow through the shipped action-name uniqueness walker (extended in Task 3). The followTail REUSE mandate specifically prevented the T-24-02-03 tampering surface documented in the plan's threat model (a parallel data-follow-tail rebuild with subtle bugs) — the grep-count + code-search invariants are the mitigation-in-place.

---
*Phase: 24-v8-0-primary-composites-listrow-message-alert-emptystate*
*Completed: 2026-07-29*
