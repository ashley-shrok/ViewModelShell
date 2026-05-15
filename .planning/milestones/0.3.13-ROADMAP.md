# Roadmap: ViewModel Shell — Milestone "Restore & Enforce Core Platform-Agnosticism"

**Milestone:** Restore & Enforce Core Platform-Agnosticism
**Granularity:** Coarse
**Phases:** 2
**Coverage:** 6/6 requirements mapped

---

## Phases

- [x] **Phase 1: Capability Seam Refactor** - Purge all platform globals from core and enforce the invariant with a CI guard; zero observable behavior change
- [x] **Phase 2: Upload Progress + Milestone Closeout** - Implement onUploadProgress as the first feature through the seam and ship the consumer migration blurb

---

## Phase Details

### Phase 1: Capability Seam Refactor
**Goal**: Core src/index.ts references zero platform globals; all browser bindings live behind a generic capability seam in BrowserAdapter; the invariant is CI-enforced and documented
**Depends on**: Nothing (first phase)
**Requirements**: AGNOSTIC-01, AGNOSTIC-02, AGNOSTIC-03, AGNOSTIC-04
**Success Criteria** (what must be TRUE):
  1. Running the project's core source through the CI guard produces zero platform-global violations (window, document, localStorage, sessionStorage, XMLHttpRequest are absent from core)
  2. The cross-backend parity suite (parity/run.ts) stays 100% green — all 7 fixtures, including the FeatureProbe redirect and side-effect fixtures — proving no observable behavior change from the refactor
  3. A new CI step exists that fails the build whenever core source introduces a platform global reference
  4. AGENTS.md and README contain a documented description of the capability-seam pattern (navigate, storage, transport verbs) and the CI-enforced "core references zero platform globals" invariant
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Relocate the 3 platform-global violations out of core behind the BrowserAdapter capability seam (AGNOSTIC-01/02, behavior-preserving)
- [x] 01-02-PLAN.md — CI guard for the invariant + net-new vitest/jsdom adapter test + run the D-12 dual verification gate (AGNOSTIC-03)
- [x] 01-03-PLAN.md — Document the capability seam + CI-enforced invariant in AGENTS.md and README.md (AGNOSTIC-04)

### Phase 2: Upload Progress + Milestone Closeout
**Goal**: onUploadProgress(sent,total) is delivered as the first feature built through the transport capability seam, and downstream app maintainers receive a clear, copy-pasteable migration blurb
**Depends on**: Phase 1
**Requirements**: UPLOAD-01, MIGRATE-01
**Success Criteria** (what must be TRUE):
  1. Calling shell.dispatch() with a FormData payload and ShellOptions.onUploadProgress set invokes the callback with (sent, total) bytes during transfer; the callback is never invoked when no files are present or the option is not set
  2. The XHR upload binding is locatable only inside BrowserAdapter — a grep of core src/index.ts for XMLHttpRequest returns no matches
  3. The full parity suite (parity/run.ts, all 7 fixtures) remains 100% green, confirming the response path through processResponse() is shared and behavioral parity is preserved
  4. A migration blurb exists as a concrete, copy-pasteable artifact stating: the exact npm and NuGet version numbers to update to, any public-API additions (onUploadProgress option), what is explicitly NOT breaking (wire format, redirect, side-effects, polling, all existing ViewNode types), and the recommended upgrade steps for downstream app maintainers
**Plans**: 3 plans

Plans:
- [x] 02-01-PLAN.md — Implement UPLOAD-01: ShellOptions.onUploadProgress + dispatch() transport-routing branch (core, additive) + BrowserAdapter.transport XHR upload-progress binding
- [x] 02-02-PLAN.md — Net-new mock-XHR jsdom/vitest test proving D-14 (a)-(e) (UPLOAD-01 verification)
- [x] 02-03-PLAN.md — MIGRATE-01: npm 0.3.13 patch bump + copy-pasteable MIGRATION.md + README pointer + full parity/milestone gate

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Capability Seam Refactor | 3/3 | Complete | 2026-05-15 |
| 2. Upload Progress + Milestone Closeout | 3/3 | Complete | 2026-05-15 |

---

*Roadmap created: 2026-05-15*
*Last updated: 2026-05-15 after 02-03 execution (MIGRATE-01 milestone closeout — Phase 2 complete, all 6 requirements done, full parity gate green)*
