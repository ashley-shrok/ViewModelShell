# Deferred items — Phase 26

Items discovered mid-execution that are out of scope for the current plan.

## 2026-07-30 — plan 26-01

- Untracked pre-existing dir `.vite/vitest/` at repo root (dates from Jul 23, before Phase 26 started; a vitest cache left by an earlier test run). Not caused by this plan's serve (Vite dev-server writes its cache inside `demo/Showcase/frontend/node_modules/.vite/`, not repo-root). Consider adding `.vite/` to `.gitignore` as a housekeeping pass in Plan 26-06 or later.

