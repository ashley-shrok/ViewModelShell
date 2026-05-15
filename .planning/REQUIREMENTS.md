# Requirements: ViewModel Shell — Milestone "Restore & Enforce Core Platform-Agnosticism"

**Defined:** 2026-05-15
**Core Value:** The core is a platform-agnostic transformer of a structured wire protocol — testable with no browser runtime, portable to any front-end.

## v1 Requirements

Requirements for this milestone. Each maps to exactly one roadmap phase.

### Capability Seam (Phase 1)

- [x] **AGNOSTIC-01**: Core `src/index.ts` references zero platform globals; a generic capability seam delegates `navigate(url)`, `storage(scope,key,value)`, and a progress-capable transport to the plugged-in front-end (same way `render()` is already delegated to the adapter)
- [x] **AGNOSTIC-02**: Existing browser bindings (`window.location.href` for redirect; `localStorage`/`sessionStorage` for side-effects) relocated out of core into `BrowserAdapter` behind the seam, with zero change to observable behavior
- [x] **AGNOSTIC-03**: A CI guard fails the build if core source references a platform global (`window`, `document`, `localStorage`, `sessionStorage`, `XMLHttpRequest`, etc.) — the claimed invariant becomes an enforced, checkable one
- [ ] **AGNOSTIC-04**: AGENTS.md and README updated to document the capability-seam pattern and the CI-enforced "core references zero platform globals" invariant (ships with the phase, not after)

### Upload Progress Through The Seam (Phase 2)

- [ ] **UPLOAD-01**: `ShellOptions.onUploadProgress(sent,total)` implemented as the first feature built *through* the transport capability — the XHR binding lives in `BrowserAdapter`, never in core; activates only when a dispatch carries files AND the callback is set; response funnels through the shared `processResponse()` so only the send differs

### Milestone Closeout (Phase 2)

- [ ] **MIGRATE-01**: Consumer-maintainer migration blurb — a clear, copy-pasteable message stating exactly what downstream app maintainers must update (npm/NuGet versions, any API or behavior deltas, what is NOT breaking and why) and how to handle the change

## v2 Requirements

(None — milestone is tightly scoped.)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Drag-and-drop / `DraggableNode` / `DropTargetNode` (issue #2) | Declined — browser-runtime-dependent (breaks no-browser-test promise), unsolved keyboard a11y, foreign structural pattern. Reorder solved via click-to-place pattern (Reorder demo). |
| `reorderable` ListNode convenience | Deferred — add only if per-app reorder boilerplate proves painful across many real apps. |
| Global `*` box-sizing reset | Rejected — opt-in stylesheet must not stomp host-app page elements. Scoped reset already shipped (issue #3). |
| Cross-runtime parity beyond Bun+Node | Deferred — same Web Fetch surface; low marginal value until a consumer needs Deno/Workers. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AGNOSTIC-01 | Phase 1 | Complete |
| AGNOSTIC-02 | Phase 1 | Complete |
| AGNOSTIC-03 | Phase 1 | Complete |
| AGNOSTIC-04 | Phase 1 | Pending |
| UPLOAD-01 | Phase 2 | Pending |
| MIGRATE-01 | Phase 2 | Pending |

**Coverage:**
- v1 requirements: 6 total
- Mapped to phases: 6
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-15*
*Last updated: 2026-05-15 after roadmap creation*
