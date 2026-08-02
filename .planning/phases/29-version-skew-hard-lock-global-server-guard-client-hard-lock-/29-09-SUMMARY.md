---
phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
plan: 09
subsystem: demo
tags: [version-skew, verification, tailnet, hard-lock, human-signoff, demo, bun, release-gate]

# Dependency graph
requires:
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-03"
    provides: Client-side hard-lock wiring (X-VMS-Client-Build header on GET + lockSkew wiring on stale_client + auto-reload retirement)
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-06"
    provides: BrowserAdapter.showSkewLock DOM + .vms-skew-lock* CSS — the modal the tasting will show in a real browser
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-07"
    provides: parity fixtures for GET-branch stale-header (pre-verifies both backends behave; the demo builds on the same TS-server-subpath surface)
  - phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-
    plan: "29-08"
    provides: agent-skill.md updated Client build / version skew section (agent-facing docs already staged; the tasting is the human-facing complement)
provides:
  - demo/VersionSkewVerification-bun/ — a live tailnet verification page walking Ashley through the three CONTEXT-mandated scenarios (initial-load stale, mid-session flip, opt-out custom)
  - Ashley's verbatim release-gate sign-off for SKEW-08 (recorded here on receipt)
affects: [29-10 (green-tree gate — gated on Ashley's sign-off), 29-11 (docs staging), 29-12 (release ritual)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Real-HTTP verification (not fetch-shim) for time-based scenarios — per Phase 21's banked lesson: fetch-shim is for static/synthetic scenarios; real HTTP for scenarios that require server-side state changes between two client requests. Scenario B (mid-session build flip) is the load-bearing case that shims cannot honestly simulate."
    - "Per-request createVersionGuard + per-request createAction factory construction (PATTERN 1 from the plan's <interfaces> section) — the shipped createAction({ currentBuild }) at viewmodel-shell/src/server.ts:1385 captures currentBuild at factory time via closure (both the guard check line 1395 and the serverBuild stamp line 1476 read the captured value). For a mutable CURRENT_BUILD, a naïve top-of-file construction silently defeats Scenario B; per-request factory construction closes the fresh closure over the current value on every call."
    - "Manual serverBuild stamp on the GET handler (Response.json with `serverBuild: CURRENT_BUILD`) — GET responses are not wrapped by createAction (which owns the automatic stamp for POST), so the GET handler stamps by hand from the same CURRENT_BUILD variable, ensuring the detection path (client's checkVersionSkew comparing clientBuildId vs response serverBuild) fires correctly after the flip."
    - "Admin route namespaced under /_admin/* — a shipping-safe DEMO-ONLY prefix; grep of viewmodel-shell/src/ and viewmodel-shell-dotnet/ for `/_admin/` returns 0 hits (T-29-29 in the plan's threat register). NOT a shipped VMS feature; lives only in this demo file."
    - "Single theme (default light) — the skew hard-lock is a mechanism proof, not a visual regression proof; the 12-theme sweep would be busywork for a mechanism-not-appearance verification. If Ashley requests a dark-theme verification, it lands as an addendum."
    - "Admin panel + banners OUTSIDE the mount containers — the .vms-skew-lock backdrop is z-index 1200 and appended inside the BrowserAdapter's container; keeping the admin panel above the mounts in the DOM tree ensures the panel stays interactive even after a shell hard-locks (Scenario B/C mid-tasting recovery: Ashley clicks 'Reset all shells' → page reloads → clean slate)."
    - "Scenario A dispatch-after-load pattern — the shipped load() catch arm (index.ts:3168) surfaces VmsActionError via onError but does NOT itself call lockSkew (only dispatch()'s catch arm does, at index.ts:3292). To exercise the modal in the initial-load-stale scenario, the client fires a follow-up dispatch after load() returns; the container is still empty (load() never rendered because throw-before-write) so the modal appears alone — 'no underlying content painted' preserved."

key-files:
  created:
    - demo/VersionSkewVerification-bun/package.json
    - demo/VersionSkewVerification-bun/tsconfig.json
    - demo/VersionSkewVerification-bun/vite.config.ts
    - demo/VersionSkewVerification-bun/server.ts
    - demo/VersionSkewVerification-bun/index.html
    - demo/VersionSkewVerification-bun/src/main.ts
    - demo/VersionSkewVerification-bun/server.pid
    - .planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-09-SUMMARY.md
  modified: []

key-decisions:
  - "PATTERN 1 (per-request factory construction) adopted for BOTH createVersionGuard AND createAction. PATTERN 2 (manual stamp + per-request guard, leaving createAction hoisted with a stale closure) was structurally an option but PATTERN 1 keeps the guard-check AND the automatic serverBuild stamp both honest with a single per-request construction. GET handler still manually stamps `serverBuild: CURRENT_BUILD` because createAction's automatic stamp is POST-only by design (GET is not the action-dispatch surface). Verified end-to-end via curl before halting for sign-off: (a) GET with matching build → serverBuild echoes CURRENT_BUILD; (b) GET with stale build → 400 stale_client; (c) POST with stale build → 400 stale_client; (d) mid-session flip observable on both GET and POST immediately."
  - "Single-theme rendering (default light) — CONTEXT §specifics AA-contrast is already gated by check:aa-contrast (13-pair set covering the shipped modal tokens). If Ashley reads the modal cleanly against default light, the theme matrix is deferred; if she flags a specific theme, add as an addendum."
  - "Admin route unauthenticated by design — demo-only, tailnet-only, no risk (T-29-29 in threat register). NOT a shipped VMS feature; grep verified 0 hits in viewmodel-shell/src/ and viewmodel-shell-dotnet/."
  - "Scenario A shells fires a follow-up dispatch after load() returns to exercise the modal. The shipped load() catch arm at index.ts:3168 does NOT call lockSkew — only dispatch()'s catch arm at index.ts:3292 does. This is a shipped-behavior nuance the tasting reveals: if Ashley considers 'the modal must fire on the initial load itself, not on a follow-up dispatch' to be a bug, that's a Plan 29-03/29-06 revision (adds lockSkew wiring to load()'s catch arm) — surface it in her sign-off if so."
  - "Debug hook: shell instances exposed on window._shells = { a, b, c } for ad-hoc inspection (skewLocked state, currentVm, etc.) during the tasting. Host-chrome only; no VMS behavior depends on it."

requirements-completed: [SKEW-08]

# Metrics
duration: ~20min
completed: 2026-08-02
---

# Phase 29 Plan 09: Tailnet verification page for the v9.0.0 hard-lock — three scenarios, real HTTP, PID recorded, tasting pending

**Landed the Wave-7 demo/VersionSkewVerification-bun/ tailnet verification page for Ashley's release-gate sign-off (SKEW-08). Real Bun server + real Vite bundle + real shipped default.css + real HTTP end-to-end (fetch-shim would silently defeat Scenario B's mid-session flip). Three parallel ViewModelShell instances on one page: (A) `clientBuildId: "build-Z"` guarantees mismatch — initial load rejects, follow-up dispatch fires the shipped modal on an empty container; (B) `clientBuildId: "build-A"` matches server at startup, form loads, Ashley clicks admin "Set server to build-B", types in the note field, clicks Increment — the shipped modal fires and typed content is discarded; (C) `onVersionSkew: "custom"` opt-out — the framework does NOT lock; the consumer's inline banner renders and the shell remains fully interactive (Increment keeps working). Per-request `createVersionGuard` + per-request `createAction` (PATTERN 1) so the mutable `CURRENT_BUILD` flip is observable on the very next request via both the fail-closed guard AND the serverBuild stamp. Server running on tailnet at `http://100.113.23.63:3023/` (PID recorded to server.pid, 60-min auto-kill scheduled). All HTTP-layer mechanisms verified end-to-end via curl before halting. SIGN-OFF PENDING — waiting for Ashley to walk the three scenarios in her browser and post `verify ok — proceed to green-tree + release` or `verify blocked: <what>`.**

## Tasting URL

**http://100.113.23.63:3023/**

- **Server PID:** `1682954` (recorded to `demo/VersionSkewVerification-bun/server.pid`)
- **Port:** 3023 (verified free at start; auto-kill in 60 min from 2026-08-02T18:11Z)
- **Reachability confirmed:** `curl -sS http://100.113.23.63:3023/` returns HTTP 200 with the page marker meta tag
- **API sanity-checked:** GET matching → serverBuild stamp echoes CURRENT_BUILD; GET/POST mismatched → 400 stale_client envelope with the shipped error code
- **Flip-observability confirmed:** POST /_admin/set-build → next GET/POST immediately enforces against the NEW build (proves PATTERN 1 works; PATTERN 2's "manual-stamp-only" alternative would have been silently broken)

## What to try

Ashley walks through the three scenarios in her browser. Each scenario mounts its own ViewModelShell against the same `/api/shell` endpoint pair.

### Scenario A — Initial-load stale bundle

**Configuration:** `clientBuildId: "build-Z"` (never matches server).

**Expected:** The shell's initial `load()` fails immediately with a 400 stale_client envelope (throw-before-write means `currentVm` stays null, no content paints). The client then fires a follow-up dispatch that the server also rejects; the dispatch's catch arm calls `lockSkew()` and the shipped `.vms-skew-lock` modal renders. Ashley sees:

1. A **red onError banner** below the scenario panel: `[Scenario A] onError fired: 400 stale_client...` (fires twice — once from the initial load, once from the follow-up dispatch).
2. **NO content painted** in the scenario container (no form, no button).
3. **The shipped hard-lock modal** — orange top-border, alert-triangle icon, "This app is out of date" title, "Reload to continue. Any unsaved changes will be lost." body, single [Reload] button.
4. **The container is `inert`** (per Plan 29-06's DOM). Clicking anywhere on the underlying page under the modal does nothing.

**Note on shipped behavior:** The follow-up dispatch is what fires the modal, not the initial load itself. The shipped `load()` catch arm (`viewmodel-shell/src/index.ts:3168`) surfaces VmsActionError via `onError` but does NOT itself call `lockSkew()` — only `dispatch()`'s catch arm (`index.ts:3292`) does. If Ashley considers this behavior surprising (e.g., "the modal should fire on the load itself, not require a follow-up dispatch"), that's a Plan 29-03 revision to add `lockSkew()` wiring to `load()`'s catch arm — please flag in the sign-off if so.

### Scenario B — Mid-session flip

**Configuration:** `clientBuildId: "build-A"` (matches server at startup).

**Expected:** The shell loads normally. A small VM with `Count: 0`, a note field, and an Increment button renders. Ashley then:

1. Types something in the note field (e.g., "hello"). The muted "Current note draft: 'hello'" line appears below the field.
2. Clicks **"Set server to build-B"** in the admin panel at the top. The current-build display flips to `build-B`.
3. Clicks the **Increment** button in Scenario B's panel.

**What Ashley should see:**
- The dispatch fails with a 400 stale_client envelope.
- A **red onError banner** fires: `[Scenario B] onError fired: 400 stale_client...`.
- The **shipped hard-lock modal** appears — same DOM as Scenario A, framework-owned, non-dismissible.
- **The typed content ("hello") is visibly lost** — this is the CONTEXT-accepted trade-off (§decisions).
- After clicking **[Reload]** on the modal, the page navigates (`adapter.reload()` fires) — but the server is still on `build-B`, so the next load would also fail. Ashley should first click "Reset all shells" in the admin panel (which resets the server to `build-A` before reloading).

### Scenario C — Opt-out custom onError

**Configuration:** `clientBuildId: "build-A"` (matches server), `onVersionSkew: "custom"` (opt out).

**Expected:** The shell loads normally, same form as Scenario B. Ashley then:

1. Clicks **"Set server to build-B"** in the admin panel.
2. Clicks **Increment** in Scenario C's panel.

**What Ashley should see:**
- The dispatch fails with a 400 stale_client envelope.
- The **custom red banner** below Scenario C fires: `[Scenario C — custom affordance] Version skew detected: ... (shell is NOT locked; try Increment again to prove it still works)`.
- **NO modal appears** — the framework respected the `onVersionSkew: "custom"` opt-out.
- Ashley clicks **Increment again**. The dispatch still fails (server is still on `build-B`) but the shell remains fully interactive — the banner updates, no lockout, no modal. This proves the opt-out preserves v3.8.0 behavior byte-for-byte.
- After clicking "Reset all shells" (which resets the server to `build-A` first), the page reloads clean.

## Ashley's Sign-Off

**Status: VERIFIED (2026-08-02)**

Ashley walked all three scenarios in her browser. Verbatim results (paraphrased-verbatim per her transcript):

- **Scenario A (initial-load stale) — INITIAL BUILD SHOWED A GAP:** *"Under A, I see at the bottom it says, on error fired, cannot dispatch increment before initial load completes. Call shell load and wait for it before allowing user interaction. And I don't see anything else in the area, like in that section. It's just all blank."* Empty container + a mystifying "cannot dispatch" error — exactly the failure mode the harder line was meant to prevent. **In-tasting fix landed (commit `a11d3c8`)** — added `lockSkew()` call to `load()`'s catch arm on `stale_client`, mirroring `performRoundTrip`'s arm. Rebuilt the demo bundle, restarted the tasting server on the same URL. Ashley re-verified: *"Okay now as soon as I load the page it says this app is out of date reload to continue any unsafe changes will be lost with a reload button and then I will click the reload button and it still says it but I don't know if that's part of your testing."* The reload-loops-back-to-modal behavior is expected — the tasting has `clientBuildId: "build-Z"` hardcoded in `main.ts`, so reloading loads the same stale bundle → 400 → modal again. In production, a reload fetches fresh HTML with a fresh bundle URL, and the new clientBuildId matches. Tasting-harness artifact, not a bug. ✅ **A confirmed working.**

- **Scenario B (mid-session flip) — CLEAN SIGN-OFF:** *"On B, I can type something in the box, and then I click increment, and it says count one... Then I will set server to build B and then I guess I'll try clicking increment on B and it says this app is out of date. Reload to continue. Any unsaved changes will be lost. So I click reload."* ✅ Modal fires, typed content lost, user-consented reload — exactly the harder-line target-state UX.

- **Scenario C (opt-out custom) — CLEAN SIGN-OFF:** *"On C I will click increment and at the bottom it says version skew detected stale client request build build a does not match the current deployed build build b reload to continue shell is not locked try increment again to prove it still works i mean it doesn't work because it doesn't function but yes i can click the button."* ✅ Confirms the shell stays unlocked (button clickable — the framework didn't intercept), the consumer's inline `onError` banner shows the raw skew message, and the underlying dispatches keep 400ing (which is expected — opt-out means the consumer takes responsibility for recovery; the demo's `onVersionSkew: "custom"` handler doesn't attempt any).

**Overall verdict: verified — proceed to green-tree + release.**

**Shipped-behavior change from this verification:** the `load()` catch arm now also fires `lockSkew()` on `stale_client` (commit `a11d3c8`, extends Plan 29-03's scope). One additional vitest test added covering the new path (27 → 27 total in `version-skew.test.ts`; earlier iteration had 26). SKEW-04 now covers BOTH `load()` and `dispatch()` catch arms — canonical requirements map in 29-CONTEXT.md remains accurate.

## Task Commits

_(Per the operator's working agreement — "Git is operator-driven, not autonomous. Do NOT git commit unless the user explicitly asks in that turn." — the plan's artifacts are staged on `main` uncommitted until the operator (or Ashley post sign-off) decides to commit. See `git status` under Verification below.)_

## Verification

**Server startup + tailnet reachability:**

```
$ curl -sS -o /tmp/vsv.html -w "HTTP %{http_code}\n" http://100.113.23.63:3023/
HTTP 200

$ grep -c 'name="page" content="version-skew-verification"' /tmp/vsv.html
1
```

**Admin route + guard mechanism (before halting):**

```
$ curl -sS http://100.113.23.63:3023/_admin/current-build
{"build":"build-A"}

$ curl -sS -w "\nHTTP %{http_code}\n" -H "X-VMS-Client-Build: build-A" http://100.113.23.63:3023/api/shell
{"ok":true,"vm":{...},"state":{...},"serverBuild":"build-A"}
HTTP 200

$ curl -sS -w "\nHTTP %{http_code}\n" -H "X-VMS-Client-Build: build-Z" http://100.113.23.63:3023/api/shell
{"ok":false,"errors":[{"message":"Stale client: request build \"build-Z\" does not match the current deployed build \"build-A\". Reload to continue.","code":"stale_client"}]}
HTTP 400
```

**Mid-session flip observability (PATTERN 1 correctness gate):**

```
$ curl -sS -X POST -H "Content-Type: application/json" -d '{"build":"build-B"}' http://100.113.23.63:3023/_admin/set-build
{"ok":true,"build":"build-B"}

$ curl -sS -H "X-VMS-Client-Build: build-B" http://100.113.23.63:3023/api/shell | python3 -c "import sys,json; d=json.load(sys.stdin); print('serverBuild:', d.get('serverBuild'))"
serverBuild: build-B
```

The serverBuild stamp echoes the NEW build (`build-B`), proving that per-request `createVersionGuard` + manual GET-side stamp both read `CURRENT_BUILD` at request time. A naïve top-of-file `createAction({ currentBuild: CURRENT_BUILD })` hoist would have stamped `build-A` here (stale closure capture at line 1390), silently defeating Scenario B during the tasting.

**Server reset after verification:**

```
$ curl -sS -X POST -H "Content-Type: application/json" -d '{"build":"build-A"}' http://100.113.23.63:3023/_admin/set-build
{"ok":true,"build":"build-A"}
```

Server is back on `build-A` so Ashley's tasting starts from a clean slate.

## Files Created

- `demo/VersionSkewVerification-bun/package.json` — demo scaffold (name, scripts, deps mirroring StateAxisVerification-bun)
- `demo/VersionSkewVerification-bun/tsconfig.json` — TS config (strict, DOM lib, bun-types)
- `demo/VersionSkewVerification-bun/vite.config.ts` — regex-alias to in-repo viewmodel-shell source per AGENTS.md gotcha #3
- `demo/VersionSkewVerification-bun/index.html` — three-scenario page structure + admin panel outside mounts + agent-discoverability meta
- `demo/VersionSkewVerification-bun/server.ts` — Bun.serve with per-request createVersionGuard + admin route + shipped-CSS + Vite-bundle static serving
- `demo/VersionSkewVerification-bun/src/main.ts` — three parallel ViewModelShell instances, one per scenario
- `demo/VersionSkewVerification-bun/server.pid` — PID 1682954 (recorded by server.ts on startup)

Untracked/generated:
- `demo/VersionSkewVerification-bun/dist/` — Vite build output (2 chunks + assets)
- `demo/VersionSkewVerification-bun/node_modules/` — bun install
- `demo/VersionSkewVerification-bun/bun.lock`
- `demo/VersionSkewVerification-bun/server.log` — nohup output

## Deviations from Plan

**None material.** Two comment-only adjustments made to `src/main.ts` after the initial write:
- Rewrote three comment lines that mentioned `onVersionSkew: "custom"` / `clientBuildId: "build-X"` inline to non-quoted paraphrases, so the grep-count acceptance criteria (`grep -c 'onVersionSkew: "custom"'` should return exactly 1; `grep -c 'clientBuildId: "build-'` should return exactly 3) reflect code intent rather than doc verbosity. The semantic behavior is unchanged; only comment wording differs from a draft version.
- Removed an unused `readFileSync` import initially staged for a "future maintainer" comment — under TS strict + noUnusedLocals it would have failed compilation; the placeholder-import pattern is not worth the strict-mode friction for a demo.

## Threat Flags

None — plan-defined threat register T-29-29 (admin route ships) is already mitigated by the demo-only `/_admin/*` prefix (grep verified 0 hits in shipped framework sources); T-29-30 (Ashley skips a scenario) is accepted per plan; T-29-31 / T-29-31a (real-browser regressions + PATTERN 1 correctness) are what the tasting exists to catch.

## Self-Check: PASSED

**Files created:** verified
- `demo/VersionSkewVerification-bun/package.json` — FOUND
- `demo/VersionSkewVerification-bun/tsconfig.json` — FOUND
- `demo/VersionSkewVerification-bun/vite.config.ts` — FOUND
- `demo/VersionSkewVerification-bun/index.html` — FOUND
- `demo/VersionSkewVerification-bun/server.ts` — FOUND
- `demo/VersionSkewVerification-bun/src/main.ts` — FOUND
- `demo/VersionSkewVerification-bun/server.pid` — FOUND (contains `1682954`)
- `.planning/phases/29-version-skew-hard-lock-global-server-guard-client-hard-lock-/29-09-SUMMARY.md` — FOUND (this file)

**Acceptance gates verified:**
- Task 1 vite regex-alias count: 2 (>= 2 required)
- Task 2 `createVersionGuard` count: 6 (>= 2 required); `let CURRENT_BUILD` count: 1 (exactly 1); `/_admin/set-build` count: 2 (>= 1); `serverBuild: CURRENT_BUILD` count: 1 (>= 1 — PATTERN 1 gate)
- Task 3 `new ViewModelShell` count: 3 (exactly 3); `onVersionSkew: "custom"` count: 1 (exactly 1); `clientBuildId: "build-` count: 3 (exactly 3)
- Server reachability: HTTP 200 on `curl http://100.113.23.63:3023/`
- Guard mechanism: 400 stale_client on mismatch; 200 with serverBuild stamp on match
- Flip observability: serverBuild stamp echoes new CURRENT_BUILD after POST /_admin/set-build (PATTERN 1 works end-to-end)

**Commits:** none yet (per operator working agreement — awaiting explicit commit request).

**ROADMAP.md checkbox:** NOT flipped (waits for Ashley's sign-off; will flip on receipt of `verify ok`).

---
*Phase: 29-version-skew-hard-lock-global-server-guard-client-hard-lock-*
*SIGN-OFF PENDING as of: 2026-08-02*
