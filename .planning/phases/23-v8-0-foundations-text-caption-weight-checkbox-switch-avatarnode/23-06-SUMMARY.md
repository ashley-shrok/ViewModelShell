# Plan 23-06 — AGENTS.md Route B composite-nodes layer governance section (SUMMARY)

**Completed:** 2026-07-29
**Wave:** 2 (autonomous, doc-only)
**Depends on:** 23-05 (design of record, landed on main as `de2564a`)
**Requirements:** COMP-01, COMP-02, COMP-03, COMP-04 (cross-cutting — this plan lands the milestone-wide governance section in AGENTS.md; the four requirements are the wire tweaks + new primitive whose composite consumers are governed by the earn-a-composite rule).
**Atomic commit:** `docs(23-06): AGENTS.md gains Route B composite-nodes-layer governance section`

## What was built

A new dedicated subsection titled `### Route B composite-nodes layer (v8.0.0)` in `AGENTS.md`, inserted under the existing top-level `## Conventions for evolving the framework` section, between the "Don't add features the framework doesn't have a clean place for" clause and the "🚨 Survey by CAPABILITY CATEGORY proactively" clause. Bracketed by `---` separators (matching the AGENTS.md convention of `---` between major topic blocks — see the "Design system" subsection headers).

**58 net lines added to AGENTS.md**, zero lines deleted (verified via `git diff --stat` and `git diff | grep -c "^-[^-]"` = 0).

**Section content — every plan must_have satisfied:**

1. **Route A / Route B split, both coexist.** Route A = primitives + closed-enum axes (tone/emphasis/size/state/layout/density) — what VMS shipped through v7.0. Route B = pre-made composite recipes with typed slots — what v8.0.0 adds. Consumers with unforeseen shapes drop to primitives; recipes never deprecate primitives.

2. **The governance rule — earn a composite.** Reproduced verbatim from `.planning/design/composite-nodes-layer.md` §2 in an emphasis blockquote so the two documents stay copy-consistent:

   > **A shape earns a composite node when the best-effort with today's primitives is a "pretty bad approximation" of the common shape. The bar is visual — the after has to look right; the before has to look wrong enough to justify the primitive earning a promotion. Judgment per shape; eyeballed against a served tasting before it earns the composite.**

   Followed by the three operational properties (bar is visual, not theoretical; judgment per shape; every proposed composite requires a served tasting before wire entry).

3. **Two failure modes to guard against**, with mitigations:
   - **Bloated grab-bag** → high bar per recipe; served tasting non-negotiable; earn, not propose; the design doc's "not yet included" ledger records intentionally-not-promoted shapes so the ceiling is documented.
   - **Too-rigid recipe** → typed slots stay unconstrained-content ViewNode subtrees; variance stays in closed-enum axes.

4. **The typed-slots pattern** — the structural shape every composite obeys, reproduced as a code block matching the design doc:
   ```
   { leading?, primary/heading, secondary/description?, meta?, trailing?, tone?, state?, action? }
   ```
   With the three governing rules (semantic-name typing not node-type typing; closed-enum axes never raw CSS; every slot optional except the semantically-primary one) named as `1./2./3.` numbered items — same numbering as the design doc §3, so a reader who has read one can navigate the other.

5. **The precedent — every surveyed server-driven peer ships this layer.** Named explicitly: MUI `ListItemText`, Ant `List.Item.Meta`, Chakra `Card`/`CardBody`/`CardFooter`, Phoenix LiveView function-component slots (`<:actions>`), Blazor Razor typed `ChildContent`, Bootstrap card composites, Rails Hotwire + ViewComponent slots, Laravel Livewire + Filament recipes. VMS was the outlier in shipping only Route A; Route B closes the gap. The closest analog for our shape-fit is Phoenix's slot pattern.

6. **Design of record cited by exact path** — `.planning/design/composite-nodes-layer.md`, with an explicit "read it before proposing any addition to the Route B layer" and a note that §2 and §3 of that doc are the copy-consistent source of truth for the rule + pattern reproduced in AGENTS.md.

7. **Current recipe inventory intentionally empty.** The section closes with an italicized placeholder note ("To be populated as Phases 24-26 land composite recipes. The initial version omits the inventory table by design so it doesn't drift ahead of what actually ships; grows as composites land.") — matching plan 23-06 must_have #9 ("the 'current recipe inventory' table will grow as Phases 24-26 land, but is NOT populated in this initial version").

## Files changed

- `AGENTS.md` (+58 lines, -0 lines).
- `.planning/phases/23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode/23-06-SUMMARY.md` (this file, new).

## Deviations from plan

None. Every must_have in plan 23-06 is satisfied:

- ✓ New section under "Conventions for evolving the framework" titled "Route B composite-nodes layer (v8.0.0)".
- ✓ Route A / Route B split stated (Route A = primitive axes + open composition; Route B = pre-made composite recipes with typed slots).
- ✓ Governance rule copy-consistent with `.planning/design/composite-nodes-layer.md` §2 (blockquote reproduced verbatim, including the "pretty bad approximation" phrase).
- ✓ Typed-slots pattern named — the `{ leading?, primary/heading, secondary/description?, meta?, trailing?, tone?, state? }` shape with unconstrained-content ViewNode subtrees per slot and framework-owned layout/typography/spacing.
- ✓ Two failure modes named (bloated grab-bag; too-rigid recipe) with mitigations.
- ✓ Precedent named — MUI, Ant, Chakra, Bootstrap, Phoenix LiveView, Livewire/Filament, Hotwire/ViewComponent, Blazor Razor.
- ✓ Recipes coexist with primitives — "Recipes never deprecate primitives" stated explicitly.
- ✓ Design doc cited by exact path (`.planning/design/composite-nodes-layer.md`).
- ✓ Initial section — no recipe inventory table; explicit placeholder note that it grows in Phase 24-26.

**Insertion-point respected.** The plan directed the insertion AFTER the "Don't add features…" bullet and BEFORE the "Survey by CAPABILITY CATEGORY…" bullet. Both anchors verified intact after the edit; both surrounding bullets read cleanly with the new subsection between them, bracketed by `---` separators.

**No touching of unrelated content.** `git diff --stat` reports `AGENTS.md | 58 ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++` (58 insertions, 0 deletions). No other file modified.

## Gate results

Doc-only plan; no code changes, no compilation risk. Green-tree gate not strictly required per plan (doc-only). All acceptance-criteria grep checks pass:

| Check | Result |
|---|---|
| `grep -c 'Route B composite-nodes layer' AGENTS.md` ≥ 1 | ✓ 1 |
| `grep -c 'typed slots' AGENTS.md` ≥ 1 | ✓ 2 |
| `grep -c 'earn a composite' AGENTS.md` ≥ 1 | ✓ 2 |
| `grep -c 'pretty bad approximation' AGENTS.md` ≥ 1 | ✓ 1 |
| `grep -c 'composite-nodes-layer.md' AGENTS.md` ≥ 1 | ✓ 2 |
| `grep -c 'Non-blocking dispatch' AGENTS.md` ≥ 1 (existing content preserved) | ✓ 1 |
| `grep -c "Don't add features the framework doesn't have a clean place" AGENTS.md` ≥ 1 (pre-existing clause intact) | ✓ 1 |
| `grep -c 'MUI \`ListItemText\`' AGENTS.md` ≥ 1 (precedent named) | ✓ 1 |
| `grep -c 'Route A' AGENTS.md` ≥ 1 (both tracks named) | ✓ 2 |
| No recipe inventory table in the new section | ✓ (italicized placeholder note only) |
| `git diff --stat AGENTS.md` reports only additions | ✓ (58 insertions, 0 deletions) |
| `git diff AGENTS.md \| grep -c "^-[^-]"` = 0 | ✓ 0 |

## Wave-2 coordination

This plan runs in Wave 2 alongside 23-07/23-08/23-09 (Phase 23's composite implementations). It touches only `AGENTS.md`; the other Wave 2 plans touch source, tests, styles, and demos. No file-level overlap; wave parallel-safety preserved.

## What this unblocks

- **Phase 24-26 planners** cite AGENTS.md's Route B section (in addition to the design doc) as the canonical governance rule for proposing new composites. The rule + pattern now live in two places (AGENTS.md for maintainer policy, `composite-nodes-layer.md` for milestone design of record), kept copy-consistent.
- **Future composite proposals** — whether during v8.0.0 (Phase 24-25) or after (v8.1+) — inherit a single, unambiguous "when does a shape earn a composite?" answer without re-litigating the tasting-page approval flow.
- **Recipe inventory** grows in Phase 24-26 as composites land; the placeholder line in AGENTS.md is the anchor Phase 26's release close-out amends to name every shipped composite by its wire type.

## References

- **The plan file:** `.planning/phases/23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode/23-06-PLAN.md`
- **The design of record** (source for the governance-rule blockquote and typed-slots pattern reproduced in AGENTS.md): `.planning/design/composite-nodes-layer.md` §2-§3 (specifically the emphasis blockquote at §2 and the code block at §3)
- **The upstream 23-05 SUMMARY** (context on what the design doc landed): `.planning/phases/23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode/23-05-SUMMARY.md`
- **The AGENTS.md insertion point:** `AGENTS.md` under `## Conventions for evolving the framework` (currently line 687 in HEAD), the new subsection now spans approximately lines 691-746 (bracketed by `---` separators between the "Don't add features…" and "🚨 Survey by CAPABILITY CATEGORY…" bullets).

---

*Phase: 23-v8-0-foundations-text-caption-weight-checkbox-switch-avatarnode*
*Plan 06 of 09. Wave 2. Doc-only. No release ship (v8.0.0 batches at Phase 26).*
