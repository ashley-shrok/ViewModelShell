# Phase 5: Canonical Examples + 0.4.0 Release Closeout - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-17
**Phase:** 5-canonical-examples-0-4-0-release-closeout
**Areas discussed:** Default palette re-baseline, Showcase canonical set structure, Demo de-chroming policy, AGENTS.md doc depth, RELEASE-02 parity scope, RELEASE-04 + structural-gate test scope, RELEASE-03 doc structure

---

## Default palette re-baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Light, reuse light-purple values | New :root default = existing light-purple.css values; accent stays purple | ✓ |
| Light, fresh neutral accent | Neutral-light shell + new accent; fresh AA work | |
| Keep dark-purple default | Reject D-16 | |

**User's choice:** Light, reuse light-purple values (D-01)

| Option | Description | Selected |
|--------|-------------|----------|
| New dark-purple.css, leave light-purple.css untouched | Byte-exact dark capture; light-purple.css no-op but seam-safe | ✓ |
| New dark-purple.css + delete light-purple.css | Cleaner list; deletes a shipped theme (seam break) | |
| New dark-purple.css + light-purple.css re-points | Repurpose light-purple.css; new color + AA work | |

**User's choice:** New dark-purple.css, leave light-purple.css untouched (D-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Mechanism-invariant, not value-frozen | THEME-05 = seam mechanism + theme-file byte-invariance, not default-value identity | ✓ |
| Full seam exception, audit every var | Per-variable ledger gate | |
| Freeze default values — ship light as theme | Keep dark default, light as opt-in theme | |

**User's choice:** Mechanism-invariant, not value-frozen (D-03) — with refinement: pin the three concrete CI-checkable assertions (var-name existence, 11-file byte-identity + byte-exact dark-purple.css, :root override still reskins); record D-16 as one explicit decision paragraph (D-04) to capture option 2's traceability at near-zero cost without the per-variable gate.

| Option | Description | Selected |
|--------|-------------|----------|
| Intentional default change, not a wire/API break, one-line restore | Documented, NOT breaking; import dark-purple.css to restore | ✓ |
| Treat as a breaking visual change | Flag BREAKING | |
| Minimal mention | One changelog line | |

**User's choice:** Intentional default change, not a wire/API break, one-line restore (D-05)

| Option | Description | Selected |
|--------|-------------|----------|
| Boot in the new light default | Switcher implicit slot → light-purple; real dark-purple entry; boot light | ✓ |
| Keep booting dark-purple | First view mismatches new default | |
| You decide | Claude picks mapping/boot | |

**User's choice:** Boot in the new light default (D-06)

| Option | Description | Selected |
|--------|-------------|----------|
| Scripted CI assertion | AA contrast check gated like core-globals | ✓ |
| Document computed ratios once | No automated gate | |
| Reuse Phase 3 assumption | Trust light-purple AA without re-check | |

**User's choice:** Scripted CI assertion (D-07)

| Option | Description | Selected |
|--------|-------------|----------|
| Each demo pins a distinct shipped theme | Canonical set doubles as theme gallery; HelpDesk roles = 2 themes | ✓ |
| All demos ride the new light default | Uniform; loses theme-variety signal | |
| You decide per demo | Claude assigns | |

**User's choice:** Each demo pins a distinct shipped theme (D-08)

**Notes:** Carried a verification flag — Phase 3 D-17 verified AA only on the dark default; the new light default must be re-confirmed (D-07 makes it a CI gate). Plus a RESEARCH ITEM: confirm default.css rule bodies hold no hardcoded dark hex outside :root.

---

## Showcase canonical set structure

| Option | Description | Selected |
|--------|-------------|----------|
| Augment: gallery + 3 archetype views, navigable | Keep gallery, add Dashboard/Form-heavy/List-detail via tabs nav | ✓ |
| Replace gallery with the 3 archetypes | Drop kitchen-sink | |
| One scrolling page, archetypes as sections | No nav | |

**User's choice:** Augment, navigable (D-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — fixed teaching mapping | Dashboard=cards, List/detail=split, Form-heavy=stack | ✓ |
| Cover all presets, mapping Claude's discretion | All appear, mapping flexible | |
| Claude's full discretion | No constraint | |

**User's choice:** Yes — fixed teaching mapping (D-10)

| Option | Description | Selected |
|--------|-------------|----------|
| Client-only, not a parity fixture | Visual artifact; parity via 7 fixtures + FeatureProbe | ✓ |
| Backend-backed (≥1 archetype) | New server + parity surface | |
| You decide | Claude picks | |

**User's choice:** Client-only, not a parity fixture (D-11)

| Option | Description | Selected |
|--------|-------------|----------|
| Named-page mapping + structural gates + reviewer sign-off | CI proxies + explicit documented sign-off | ✓ |
| Screenshot comparison artifact | Browser/screenshot pipeline | |
| Subjective sign-off only | No structural proxy | |

**User's choice:** Named-page mapping + structural gates + reviewer sign-off (D-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Dashboard→Dashboard, Form-heavy→Checkout, List/detail→Album | Closest official Bootstrap 1:1s | ✓ |
| …List/detail→Blog | Blog instead of Album | |
| Claude picks closest per archetype | Defer the ambiguous one | |

**User's choice:** Dashboard→Dashboard, Form-heavy→Checkout, List/detail→Album (D-13)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep switcher on gallery view only; archetypes fixed-theme | Stable benchmark target; gallery keeps switcher | ✓ |
| Keep global switcher across all views | Moving benchmark target | |
| Remove the switcher entirely | Lose the all-themes reference | |

**User's choice:** Switcher scoped to the gallery view only (D-14)

**Notes:** Archetype views render the new shipped light default as the stable D-12 benchmark target.

---

## Demo de-chroming policy

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal scaffold, zero <style> | styles.css + theme via main.ts; shell owns chrome; drop is-loading + log gap | ✓ |
| Minimal + a tiny allowed non-chrome <style> | Slippery line | |
| Per-demo judgement | Least falsifiable | |

**User's choice:** Minimal scaffold, zero <style> (D-15)

| Option | Description | Selected |
|--------|-------------|----------|
| Express via model, else drop + log gap | Model where possible; else default + deferred-gap; no new wire | ✓ |
| Keep as a scoped functional <style> | Demos still ship hand-rolled CSS | |
| Drop all, no gap log | Silent gap | |

**User's choice:** Express via model, else drop + log gap (D-16)

| Option | Description | Selected |
|--------|-------------|----------|
| Allow as the taught seam (one-line :root token) | --vms-page-max / --vms-font-* only, after theme | ✓ |
| Strip to pure shipped default | No per-app overrides | |
| Claude's discretion per demo | Per-demo | |

**User's choice:** Allow as the taught seam (D-17)

| Option | Description | Selected |
|--------|-------------|----------|
| Deliberate spread incl. ≥1 dark + the demoted dark-purple | Range + reinforce migration story; bun mirrors match twins | ✓ |
| Light themes only | Uniform; no dark/dark-purple showcase | |
| Specific assignment I'll dictate | User-named | |

**User's choice:** Deliberate spread incl. ≥1 dark + demoted dark-purple (D-18)

| Option | Description | Selected |
|--------|-------------|----------|
| Per-app stylesheet imported after the theme in main.ts | One :root{} token file, post-theme import | ✓ |
| Inline :root injected via main.ts | Mixes config into app code | |
| Claude's discretion | Planner picks | |

**User's choice:** Per-app stylesheet imported after the theme in main.ts (D-19)

**Notes:** Two deferred framework-gap ideas recorded (dispatch loading affordance; form-field-direction).

---

## AGENTS.md doc depth

| Option | Description | Selected |
|--------|-------------|----------|
| Focused 'Design system' section + fix stale bits | One tight section + de-stale | ✓ |
| Minimal-correct only | Just fix wrong lines | |
| Full design-system guide | Sprawling, scope creep | |

**User's choice:** Focused 'Design system' section + fix stale bits (D-20)

| Option | Description | Selected |
|--------|-------------|----------|
| Bounded accuracy pass over styling/demo claims | Whole doc reviewed, only invalidated claims changed | ✓ |
| Targeted line fixes only | Smallest; leaves other stale sections | |
| Whole-doc review | Largest blast radius | |

**User's choice:** Bounded accuracy pass over styling/demo claims (D-21)

| Option | Description | Selected |
|--------|-------------|----------|
| AGENTS.md only; README accuracy-touch if needed | EXAMPLES-03 scope | ✓ |
| AGENTS.md + README parity | AGNOSTIC-04 style; drift risk | |
| You decide | Per-file | |

**User's choice:** AGENTS.md only; README accuracy-touch if needed (D-22)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — single source of truth, docs mirror the Showcase | Mapping = canonical set's; point to Showcase | ✓ |
| Independent doc examples | Two example sets, drift risk | |
| You decide | Planner picks | |

**User's choice:** Yes — single source of truth, docs mirror the Showcase (D-23)

---

## RELEASE-02 parity scope

| Option | Description | Selected |
|--------|-------------|----------|
| Pure regression-green gate, zero new parity surface | 7 fixtures incl. widened FeatureProbe, byte-identical green | ✓ |
| Add a new parity fixture/surface | Tests nothing the wire carries | |
| Claude's discretion | Planner decides | |

**User's choice:** Pure regression-green gate, zero new parity surface (D-24)

---

## RELEASE-04 + structural-gate test scope

| Option | Description | Selected |
|--------|-------------|----------|
| Static CI guards for invariants + inherited jsdom for behavior | AA script + repo-scan guards; Phase 3/4 jsdom inherited; no new jsdom behavior tests | ✓ |
| Everything as jsdom unit tests | Misuses jsdom for static invariants | |
| Document/manual-verify the invariants | No CI enforcement | |

**User's choice:** Static CI guards for invariants + inherited jsdom for behavior (D-25)

---

## RELEASE-03 doc structure

| Option | Description | Selected |
|--------|-------------|----------|
| One consolidated 0.4.0 milestone entry | Single CHANGELOG/MIGRATION section, whole milestone, why-aligned | ✓ |
| Per-phase breakdown within 0.4.0 | Documents internal process externally | |
| Claude's discretion | Planner decides | |

**User's choice:** One consolidated 0.4.0 milestone entry (D-26)

**Notes:** RESEARCH ITEM recorded — enumerate every version-string location before bumping; the AGENTS.md major.minor-alignment rule TEXT stays byte-unchanged (numbers only).

## Claude's Discretion

Archetype content/composition (D-10); per-demo theme assignments (D-18); token-override file path (D-19); Form-heavy stack-vs-split (D-10); AGENTS.md "Design system" section wording (D-20); AA-script implementation + exact color-pair list (D-07/D-25).

## Deferred Ideas

- Dispatch loading affordance (`body.is-loading`) — no framework expression; dropped, usage-driven candidate.
- Form-field-direction / horizontal-form model expression — no 0.4.0 wire field; dropped, usage-driven candidate.
- README / standalone design-system guide — out of EXAMPLES-03 scope.
