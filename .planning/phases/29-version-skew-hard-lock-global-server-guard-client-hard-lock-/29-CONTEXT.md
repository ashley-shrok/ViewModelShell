# Phase 29: Version-skew hard-lock — Context

**Gathered:** 2026-08-02
**Status:** Ready for planning
**Source:** PRD Express Path (bounty `version-skew-recovery-affordance` mechanism sketch v0 + Ashley post-tasting adjustments)

<domain>
## Phase Boundary

Close two fleet-foundational failure modes in the v3.8.0 version-skew primitive:

1. **Silent partial coverage on the server** — the fail-closed guard is per-controller opt-in (`ActionPayload<T>.Parse(HttpRequest, currentBuild)` overload); controllers using the plain `Parse(actionJson, stateJson)` overload silently accept AND execute stale-client requests against stale `_state` (data-integrity risk). Convert the guard to a GLOBAL SERVER FILTER on both backends (.NET result-filter twin of `ShellVersionResultFilter`; TS equivalent in the `createAction` / server subpath layer) that rejects any request (GET + POST) with a mismatched `X-VMS-Client-Build` header BEFORE any controller runs.

2. **Silent recovery on the client** — the current `adapter.reload()` on `stale_client` auto-reloads with no UX affordance (Ashley's "clicked a row and the page refreshed"); the detection path fires `VmsVersionSkewError` via `onError` with no shipped affordance either. Ship a hard-lock modal in `BrowserAdapter` (framework-owned DOM + styling, non-dismissible, single `[Reload]` button) that replaces the silent auto-reload and covers BOTH signals; further dispatches drop, no re-renders paint. Client also attaches `X-VMS-Client-Build` on GETs (currently POST-only) so the server can enforce on every request.

**Result:** Adopting versioning is ONE line (`AddVmsShellVersioning()` on the server; `clientBuildId` in `ShellOptions`); once adopted, no stale bundle can execute an action or read a fresh view without user-consented reload. Lost-in-flight-work cost accepted (typing/scroll lost when modal fires → user clicks Reload). Wire is additive (no new envelope fields). BEHAVIOR change on both server-default (guard now global, not opt-in) and client-default (auto-reload retired) — likely major semver bump.

**Out of scope:** New primitive node types (no wire schema changes). TUI adapter changes (TUI has no version-skew semantic in the settled direction). Consumer-app updates (Metis and other Pantheon consumers pick up the fix via VMS package upgrade).

</domain>

<decisions>
## Implementation Decisions (LOCKED with Ashley post-tasting 2026-08-02)

### Server-side global filter (BOTH backends)

- **Convert per-controller opt-in guard to a global filter.** On .NET, sibling to `ShellVersionResultFilter` (see `viewmodel-shell-dotnet/Versioning.cs`) — an `IActionFilter` or middleware that runs on every incoming request BEFORE any controller. On TS server subpath (`viewmodel-shell/src/server.ts` / `createAction`), the equivalent global guard fires before the action handler runs.
- **Enforcement scope: BOTH GET and POST.** Any request with a mismatched `X-VMS-Client-Build` header → 400 `stale_client` envelope, same error shape as today (no new error codes; reuse `ErrorCodes.StaleClient`).
- **When header is ABSENT:** pass through unchanged (fail-closed only for a mismatching client that DID advertise a build — matches current v3.8.0 semantics; a header-less curl still works for agent-driven testing).
- **When `AddVmsShellVersioning()` is not called (no `currentBuild`):** filter is inert; behavior byte-identical to versioning-off apps. Additive posture preserved.
- **Existing per-controller `Parse(HttpRequest, currentBuild)` calls MUST continue to compile and work** — they become a redundant defense-in-depth layer under the global filter. No consumer breakage on the "you had it wired the old way" path.

### Client-side

- **Attach `X-VMS-Client-Build` on GETs too.** Currently `load()` at `viewmodel-shell/src/index.ts:3081` does not merge the header; `performRoundTrip()` at ~3148 already does. Unify: both paths attach the header when `clientBuildId` is configured.
- **Hard-lock modal in `BrowserAdapter`.** New adapter verb (name TBD in planner — suggestion: `showSkewLock(info?)` for symmetry with existing shipped affordances like `toast`, `setBusy`, `setPreventUnload`). Framework-owned DOM (parallels the shipped toast-region pattern at `viewmodel-shell/src/browser.ts:494`); framework-owned styling matching VMS `tone:"warning"` visual language (matches the tasting draft at bounty `tasting/panels/panel3.html`).
- **Modal fires on BOTH signals:**
  - `VmsVersionSkewError` from `checkVersionSkew` (detection path — successful response with mismatched `serverBuild`)
  - `VmsActionError` with `code:"stale_client"` (fail-closed path — 400 from server global filter)
- **Modal is non-dismissible.** Only `[Reload]` button; no X-close; escape/click-outside do NOT dismiss. This is the point.
- **Retire silent auto-reload.** Currently `processResponse`'s catch arm at `viewmodel-shell/src/index.ts:3247` fires `adapter.reload?.()` immediately on `stale_client`. Change: no auto-reload — the modal fires and the user clicks `[Reload]` which calls `adapter.reload()`. The `adapter.reload()` capability stays; only the timing changes from immediate+silent to user-consented.
- **Hard-lock is shell-level state, not just DOM.** Once the modal fires, all subsequent dispatches drop (guard on both blocking and non-blocking lanes) AND no re-renders paint. The shell tracks a `skewLocked` boolean; `dispatch()` returns early when set; `processResponse()` skips render when set. This means poll stops firing after lock too.
- **Modal copy (recommended defaults; planner may refine but shape is locked):**
  - Title: *"This app is out of date"*
  - Body: *"Reload to continue. Any unsaved changes will be lost."*
  - Button: *"Reload"*
  - Brief and honest; no countdown; no lengthy explanation. Matches the tasting draft signed off by Ashley.

### App-side override seam

- **`ShellOptions.onVersionSkew?: "default" | "custom"` (recommended shape — planner may refine).** Default = `"default"` (new hard-lock behavior). `"custom"` restores current v3.8.0 behavior: fires signals via `onError` and does nothing else. Consumers with pre-existing custom affordances (Kitsune, PBMInvoices, others — see follow-up sweep) set `"custom"` and keep their own path.
- Alternative considered: infer from `onError` return value. **Rejected** — too implicit; explicit opt-out matches the `getRequestHeaders`/`onRedirect` seam pattern.

### Semver

- **Likely MAJOR bump (v9.0.0 aligned).** Auto-reload retirement + global-guard default are documented behavior changes. Opt-out seam preserves backwards-compatibility for the "custom onError" cohort, but the DEFAULT behavior changes for every non-opt-out consumer.
- Planner should surface this explicitly for Ashley's confirmation at plan-time (per banked precedent: v6.0.0 enum migration, v8.0.0 composites — Ashley decides major vs minor).

### What stays unchanged

- Wire envelope shape (no new fields, no new error codes).
- The `serverBuild` stamp continues to fire on every response.
- `AddVmsShellVersioning()` adoption remains one line (`services.AddVmsShellVersioning()` or `services.AddVmsShellVersioning("<build-id>")`) — the new global guard self-registers alongside `ShellVersionResultFilter`.
- `checkVersionSkew` still fires `VmsVersionSkewError` — but now the shell wires that error into the modal instead of just surfacing it.
- The `adapter.reload()` capability stays (called by the modal's button; existing overrides work unchanged).
- TUI adapter untouched.

### Claude's Discretion (planner decides)

- Exact DOM structure of the shipped modal (`.vms-skew-lock__backdrop` + `.vms-skew-lock__dialog` from the tasting is a reasonable starting point but planner may pick a shape better aligned with existing `.vms-toast-region` / `.vms-*` conventions).
- Adapter verb name (`showSkewLock` vs `versionSkew` vs `skewLock` — pick per `Adapter` interface conventions in `viewmodel-shell/src/index.ts:105`).
- Whether the `onVersionSkew: "custom"` seam belongs in `ShellOptions` or somewhere else structurally.
- Placement of the .NET global filter (result filter, action filter, middleware) — pick per whichever composes cleanest with `ShellVersionResultFilter`.
- TS-server-subpath global-guard shape (currently `createAction` wraps action handlers; there's no framework-owned request pipeline in the same sense as .NET's filter pipeline — planner picks the equivalent shape).
- Test coverage — adapter tests for the modal, primitive tests for shell-level lock state, .NET tests for the global filter, TS-server tests for the wrapping guard, parity fixture with expectBodyContains asserting 400 on stale-header GET.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design of record

- `/home/thenasty/.claude/identities/vicky/bounties/version-skew-recovery-affordance/mechanism-sketch.md` — Vicky's v0 proposal (mechanism sketch pre-Ashley-lock; some of it superseded by post-tasting decisions in this CONTEXT.md's `<decisions>` — this CONTEXT.md wins on any conflict)
- `/home/thenasty/.claude/identities/vicky/bounties/version-skew-recovery-affordance/bounty.json` — Full bounty record with timeline of shape evolution
- `/home/thenasty/.claude/identities/vicky/bounties/version-skew-recovery-affordance/tasting/` — Live tailnet tasting (3 iframe panels: unguarded/current, guarded/current, target-state) — Ashley "let's go" sign-off 2026-08-02. Served at http://100.113.23.63:34243/ (~90 min TTL from 2026-08-02 15:35 UTC; may still be live).

### Primitive source (what we are changing)

- `viewmodel-shell/src/index.ts` — Core shell: `checkVersionSkew` (line ~3497), `VmsVersionSkewError` (line ~2961), `VmsActionError` (line ~2937), `load()` (line ~3081 — GET path; needs `X-VMS-Client-Build` header attachment), `performRoundTrip()` (line ~3148 — POST path; already attaches header), `processResponse()` (line ~3220 — error branch at ~3247 has the silent adapter.reload() to retire), `Adapter` interface (line ~50-127 — `reload?` at ~115).
- `viewmodel-shell/src/browser.ts` — `BrowserAdapter`: `reload()` at line ~484 (window.location.reload — stays; called by modal's button), `.vms-toast-region` pattern at ~494 (reference for how the modal DOM should attach).
- `viewmodel-shell-dotnet/ViewModels.cs` — .NET wire types + `ActionPayload<TState>.Parse(HttpRequest, currentBuild)` overload (~line 602 — becomes redundant-but-kept), `StaleClientException` (~line 3976), `ErrorCodes.StaleClient` (~line 738), `ShellErrorResponse.OfStaleClient` (~line 786).
- `viewmodel-shell-dotnet/Versioning.cs` — Server-side versioning: `AddVmsShellVersioning` extension (both overloads), `ShellVersionResultFilter` (~line 51 — twin the new global GUARD alongside), `VmsVersioningOptions` (~line 34 — read `CurrentBuild` in the new filter same way).
- `viewmodel-shell/src/server.ts` — TS server subpath: `createAction` (~line 1323 — has `{ currentBuild }` option, does STAMP; needs matching GUARD hook), `ShellResponse.serverBuild` (~line 1075).

### Framework conventions (patterns to match)

- `AGENTS.md` — Framework doctrine. Especially:
  - "Nothing important fails quietly" (fail-loud rule) — the whole rationale for this phase
  - "Apps describe, they don't decorate" — the shipped modal IS a framework surface (correct posture)
  - Gotcha #8 (null omission) — must maintain on any new wire field (but this phase adds none)
  - Gotcha #9 (parity testing) — new fixture with `expectBodyContains` for the GET-stale-header 400 path
  - "Working agreement for agents" — green-tree gate + operator-gated publish
- `viewmodel-shell/agent-skill.md` + `viewmodel-shell-dotnet/AgentSkill.md` — Agent-facing wire manual. If the primitive's DOCUMENTED behavior changes (auto-reload retirement, GET-guard, global filter default), update both byte-identically. Parity check-skill in `parity/check-skill.ts` enforces byte-parity.
- `parity/run.ts` + `parity/backends.json` + `parity/fixtures/` — Cross-backend parity harness. Add a fixture that exercises stale-header on GET (currently no fixture does — Phase 26's helpdesk-seeded fixture is a precedent for adding branch coverage).

### Consumer-side awareness (NOT scope of this phase; sweep after ship)

- Post-ship sweep: Metis (Molly's), Kitsune (Nelly's or similar), PBMInvoices (Kara's), any Pantheon apps using version-skew. Check whether each consumer has custom `onError` handling for `VmsVersionSkewError`/`stale_client`; if yes, notify to opt-out via `onVersionSkew: "custom"`. That sweep is a follow-up thread (bounty TBD post-ship), not this phase's scope.

</canonical_refs>

<specifics>
## Specific Ideas

- **Modal visual language** — matches VMS `tone:"warning"` (existing convention on `AlertNode`, `Section`, `Button`). Tasting used: orange `#d97706` top-border + tinted circle icon background + alert-triangle Lucide icon + centered layout. Planner may adopt VMS's shipped icon system (Lucide subset from Phase 22 IconNode work) rather than hand-embedding SVG.
- **CSS class prefix** — follow existing `.vms-*` conventions (parallel to `.vms-toast-region`, `.vms-toast`, `.vms-toast--warning`). Suggested: `.vms-skew-lock`, `.vms-skew-lock__backdrop`, `.vms-skew-lock__dialog`, `.vms-skew-lock__reload-btn` (but final class name is planner's call, subject to AA-contrast + existing-convention alignment).
- **`inert` attribute on container** — the tasting uses `container.setAttribute("inert", "")` when the modal fires. Modern browsers respect this; makes the underlying page unfocusable/uninteractable without JS. Preserve this pattern.
- **AA-contrast** — modal text/backgrounds must clear WCAG AA against every shipped theme (12 themes). Existing `check:aa-contrast` gate covers a fixed 13-pair set; if the modal introduces new fg/bg pairs, update the gate per the banked "fixed enumeration can never gate an open-ended property" lesson (may not be needed if we reuse tone:warning tokens).

</specifics>

<deferred>
## Deferred Ideas (out of scope for Phase 29)

- **Countdown-before-reload UX** — "Reload in 30 seconds — copy any unsaved work now" affordance. Ashley explicitly accepted the lost-in-flight-work cost; no countdown. If a consumer requests this later, treat as a separate phase.
- **Read-only banner mode** — my v0 mechanism sketch proposed a two-tier escalation (advisory banner → blocking modal). Ashley chose the harder line: hard-lock immediately on any signal. If empirical evidence later suggests the harder line is too disruptive, revisit as a separate phase.
- **Post-ship consumer sweep** — notify Metis / Kitsune / PBMInvoices / other Pantheon consumers about the semver + opt-out. Track in a separate follow-up bounty after this phase ships.
- **TUI version-skew semantic** — currently the TUI has no equivalent; skew behavior on `TuiAdapter` is undefined. If we ever revisit TUI as a maintained target (currently `@experimental`, not-invested-per-Ashley), figure out the appropriate no-op or terminal-native affordance. Not this phase.

</deferred>

---

*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock*
*Context gathered: 2026-08-02 via PRD Express Path (mechanism sketch + Ashley post-tasting adjustments)*
