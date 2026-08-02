---
phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
plan: 12
subsystem: release
tags: [viewmodel-shell, rich-text, tiptap, turndown, route-b, composite, release, publish, phase-28, v8.2.0]

# Dependency graph
requires:
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 11
    provides: v8.2.0 doc staging complete — CHANGELOG.md v8.2.0 section with `<YYYY-MM-DD>` placeholder preserved for this plan's date substitution; MIGRATION.md v8.2.0 section dateless per existing shape; AGENTS.md Phase 28 addendum + gotcha #4a landed; design-doc §4 inventory + §5 addendum + §9 change log landed.
  - phase: 28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b
    plan: 10
    provides: Full green-tree gate GREEN at commit `3de7f2e` — the load-bearing prerequisite (AGENTS.md "Never publish or push anything broken"). Re-verified at this plan's Task 1 gate.
  - phase: 27-composite-state-axis-uniformity-close-the-state-gap-across-a
    plan: 11
    provides: The byte-aligned release template — this plan mirrors 27-11 with 8.1.0 → 8.2.0 substitution, corrected announce room (`#vms-announcements` per banked directive), and inline auth precheck (no theatrical human-action checkpoint per Ashley banked 2026-07-30).

provides:
  - npm registry serves `@ashley-shrok/viewmodel-shell@8.2.0` (verified via direct curl to `registry.npmjs.org` — dist-tags.latest = `8.2.0`).
  - NuGet registry accepted `AshleyShrok.ViewModelShell.8.2.0` (push receipt `Your package was pushed` — authoritative per AGENTS.md; flat-container indexer lag ~5-15 min normal).
  - Annotated tag `v8.2.0` at release commit `248147e361aff27d04eaff02c7378171127b1283`, pushed to `origin/v8.2.0`.
  - `main` advanced to release commit; `git merge-base --is-ancestor v8.2.0 main` CONFIRMED.
  - `#vms-announcements` posted (event `$i5XS9J4pViPcsp0HM1Aq1XYV0zN4zVVSl-ZBDjnTZBw`).
  - Angel DM sent (event `$YAtH95yNjjV4FqMM-FZhsc6_cELowo3HcLKra-b24J4`) — composition-swap unblocked.
  - Molly DM sent (event `$Z2MSMSshT3e7S4xHkl_JQ2PMoQQLQvlEdkfO1S1hbGw`) — mention-picker future consumer field now ships.
  - Tasting + verification server PIDs cleaned (both `.pid` files not present at plan close; process cleanup no-op).

affects: [29 (next-phase planning — v8.2.0 is now the consumer floor; RichTextFieldNode + RichTextToolbarNode are shipped Route B surface for any future composite plan that consumes them)]

# Tech tracking
tech-stack:
  added: []  # No new deps at release-plan level — Task 3 shipped what Plans 28-01..11 built
  patterns:
    - "Inline auth precheck (banked Ashley 2026-07-30 directive) — the release ritual's mechanical `.env` sync + `npm whoami` + `$NUGET_API_KEY` presence check runs INSIDE the executor session, NOT as a `checkpoint:human-action` before Task 2. Halt-on-failure preserved; only the theatrical handshake removed."
    - "Announce room preflight (banked 2026-07-31 lesson) — vicky's `/joined_rooms` verified for `#vms-announcements` BEFORE the PUT, so a stale room ID or lost membership halts loudly instead of silently misrouting the announcement (Phase 27's misroute is what banked this)."
    - "Surgical package-lock.json edit — 2 slots verified before edit (`grep -cE '\"version\": \"8.1.0\"'` == 2); replace_all against the 6-space-indented slot picked up 1; the 2-space root slot required a separate contextual Edit. Both slots landed at 8.2.0; JSON validated; count == 2 post-edit."
    - "NuGet push receipt as authoritative signal — the `Your package was pushed` line is the release confirmation per AGENTS.md; the `flat-container/index.json` indexer's ~5-15 min lag is normal and NOT a release failure (the AGENTS.md runbook explicitly documents this)."
    - "Non-ASCII-safe Matrix bodies — announce + DMs written to JSON files via Write tool, PUT via `curl --data-binary @file` (not `-d` inline, which loses/mangles the 📝 emoji + em-dashes)."

key-files:
  created:
    - ".planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-12-SUMMARY.md (this file)"
  modified:
    - "viewmodel-shell/package.json — 8.1.0 → 8.2.0 (single-line edit at L3)."
    - "viewmodel-shell/package-lock.json — 8.1.0 → 8.2.0 in exactly 2 slots (root `\"version\"` L3 + `packages.\"\".version` L9); JSON re-validated post-edit."
    - "viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj — <Version>8.1.0</Version> → <Version>8.2.0</Version> (single-line edit at L13)."
    - "CHANGELOG.md — `<YYYY-MM-DD>` placeholder in v8.2.0 heading substituted with `2026-08-02` (single-line edit at L9)."

key-decisions:
  - "MIGRATION.md NOT modified this plan — Plan 28-11 wrote the v8.2.0 upgrade section without a date placeholder (matches the existing v8.1.0 shape). Verified via `grep -n '<YYYY-MM-DD>' MIGRATION.md` returning nothing at plan start; MIGRATION.md is dateless by design."
  - "Release commit staged 4 files atomically (CHANGELOG.md + package.json + package-lock.json + .csproj), NOT the 6 the plan spec listed. AGENTS.md + `.planning/design/composite-nodes-layer.md` were already committed by Plan 28-11 (commits `6fdc2e4`, `50f3176`) — attempting to re-add them at Task 2's stage would have been a no-op (nothing modified locally). Adding `git add` for a file that is not modified is a benign no-op, but the release commit accurately captures 'what this plan changes' rather than false-listing files unchanged since 28-11's SUMMARY landed."
  - "`.planning/ROADMAP.md` M mark + 15 Phase 27 untracked files + `.vite/` + top-level `server.pid` intentionally NOT staged with the release commit — pre-existing per Plan 28-11's git-status snapshot; unrelated to Phase 28's v8.2.0 release; would pollute the release commit's diff. The Phase 27 planning files remain untracked (they were shipped in that phase's v8.1.0 release; committing them here would be off-plan)."
  - "NuGet flat-container index still shows 8.1.0 at plan close (~5 min post-push); this is NORMAL per AGENTS.md's documented indexer lag (5-15 min). The push receipt `Your package was pushed` at 15:15Z is the authoritative signal that NuGet accepted the package. A retry-verification will show 8.2.0 within the next ~10 min; a persistent 404 after 30 min would indicate a real registry issue (not observed)."
  - "Matrix DMs sent to Angel + Molly using DM room IDs from vicky's identity file (`vicky.md` §Membership: Angel DM `!cTFWdfBcWIXexJroXn`, Molly DM `!JecRElxNGAhCCLRWjg`). Both rooms verified in vicky's `/joined_rooms` output before PUT. No unreachable notes required — both events accepted with real event IDs."
  - "Announce room preflight passed with vicky STILL OWNER of `#vms-announcements` (`!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net`). No room-ID drift; no reconciliation required. This is the exact pre-flight banked from Phase 27's misroute (Phase 27 shipped to `#vms-changelog` by mistake; the rule is now baked)."

patterns-established:
  - "Aligned MINOR release ritual (v8.X.0) closes in ~15 min of executor time (auth precheck to Matrix DMs), given (a) a fully-staged docs plan preceded it (Plan 28-11's `<YYYY-MM-DD>` placeholder + everything else in place), (b) a GREEN gate held from the prior plan, and (c) no auth-token expiry / room membership issues. The template is now byte-aligned with Phase 27's 27-11 pattern for future 8.X.0 releases."
  - "Inline-precheck-and-execute mode (no `checkpoint:human-action` for auth) is now the operator-preferred release shape — banked directive from 2026-07-30 as reinforced in the Phase 28 prompt. Future release-plan authors should NOT insert a `checkpoint:human-action` for the auth precheck; the executor runs it and halts loudly on failure. The theatrical handshake is deprecated."
  - "Post-release NuGet indexer lag is a documented normal condition, NOT a release failure. Recording the push receipt in the SUMMARY (`Your package was pushed`, both .nupkg + .snupkg) is the ceremonially-correct evidence; the curl-to-flat-container verification is a bonus check that may need retry ~5-15 min later. Do not halt the release on an indexer-lag 404."

requirements-completed: [RICH-09]

# Metrics
duration: ~15 min (executor time; excludes green-tree gate re-run at Task 1 which took ~4 min)
completed: 2026-08-02
---

# Phase 28 Plan 12: v8.2.0 aligned release Summary

**v8.2.0 SHIPPED end-to-end.** Aligned MINOR release of `@ashley-shrok/viewmodel-shell@8.2.0` (npm) + `AshleyShrok.ViewModelShell 8.2.0` (NuGet). Auth precheck ran inline (no theatrical human handshake per banked Ashley directive); full green-tree gate re-verified GREEN pre-bump; 4-file surgical release commit (`248147e`) staged atomically; both registries received the package under the operator's credentials; annotated tag `v8.2.0` created + pushed; `main` advanced to release commit and `git merge-base --is-ancestor v8.2.0 main` CONFIRMED; `#vms-announcements` posted with vicky's OWNER identity (preflight-verified); Angel + Molly DMs sent with event IDs recorded; tasting + verification server PIDs cleaned (already gone). Ashley's greenlight ("let's go") delivered as a receipt.

## Performance

- **Duration:** ~15 min (executor time; excludes ~4 min for green-tree gate re-run at Task 1)
- **Started:** 2026-08-02T15:02Z
- **Completed:** 2026-08-02T15:20Z
- **Tasks:** 5 (all executed inline; the plan-spec's `checkpoint:human-verify` for announce/DMs was executed inline per the executor prompt's autonomous-flow directive)
- **Files created:** 1 (this SUMMARY)
- **Files modified:** 4 (CHANGELOG.md + package.json + package-lock.json + .csproj — release commit)

## Per-step audit trail

### Task 1 — Auth precheck + pre-bump green-tree re-run

**Auth precheck (inline, no operator handshake):**
- `.env` present at `$(git rev-parse --show-toplevel)/.env` ✓
- `NPM_TOKEN=` line present ✓; `NUGET_API_KEY=` line present ✓
- `~/.npmrc` synced from `NPM_TOKEN`; permissions 600 ✓
- `npm whoami` → `ashley-shrok` (expected) ✓
- `set -a; source .env; set +a` — `$NUGET_API_KEY` present in shell (46 chars; value NEVER logged) ✓
- Recorded: `PRECHECK OK: npm=ashley-shrok, NUGET_API_KEY=<present, 46 chars>` at 15:02Z

**Green-tree gate re-run** (all exit 0):
- `viewmodel-shell` scripts: `build`, `check:test-types`, `check:core-globals`, `check:aa-contrast`, `check:no-demo-style`, `check:demo-types`, `check:theme-byte-identity`, `check:theme-function` — all GREEN
- `npx vitest run` — **82 files, 1348 passed | 1 skipped, 2.99s**
- `dotnet test viewmodel-shell-dotnet/Tests` — **Passed! 451 tests**
- Demo `.Tests.csproj` × 5 + Markdown Tests — **all Passed!** (Tasks 28, ContactManager 39, RetroBoard 33, HelpDesk 61, ExpenseTracker 30, Markdown 53 = 244 tests total)
- Markdown companion build — **Build succeeded, 0 errors, 0 warnings**
- `bun run parity/run.ts` — **✓ Parity tests passed** (skill parity + wire diffs across all backends)

### Task 2 — Bump versions + finalize CHANGELOG date + commit

**Bump edits (surgical):**
- `viewmodel-shell/package.json` L3: `"version": "8.1.0"` → `"8.2.0"` ✓
- `viewmodel-shell/package-lock.json`: 2 slots at 8.1.0 pre-edit (verified via `grep -cE '"version": "8.1.0"' package-lock.json` == 2). Post-edit: 2 slots at 8.2.0 (root L3 + `packages.""` L9), 0 stragglers at 8.1.0, JSON validates via `python3 -c "import json; json.load(open(...))"` ✓
- `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` L13: `<Version>8.1.0</Version>` → `<Version>8.2.0</Version>` ✓
- `CHANGELOG.md` L9: `## 8.2.0 — <YYYY-MM-DD> (npm + NuGet aligned)` → `## 8.2.0 — 2026-08-02 (npm + NuGet aligned)` ✓
- MIGRATION.md: `grep -n '<YYYY-MM-DD>' MIGRATION.md` returns nothing (no placeholder present; matches existing v8.1.0 shape — MIGRATION uses only version numbers per Plan 28-11's design)

**Post-bump build check:**
- `viewmodel-shell/npm run build` → `@ashley-shrok/viewmodel-shell@8.2.0 build` — GREEN ✓
- `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` — `Build succeeded, 0 Warning(s), 0 Error(s)` ✓

**Release commit:**
- Staged 4 files: `git add CHANGELOG.md viewmodel-shell/package.json viewmodel-shell/package-lock.json viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`
- Commit message (HEREDOC-formatted per AGENTS.md convention): `release: npm 8.2.0 + NuGet 8.2.0 — rich text WYSIWYG input primitive` + 3-paragraph body
- **Commit SHA: `248147e361aff27d04eaff02c7378171127b1283`** (short: `248147e`)
- `git log --oneline -1` confirms `248147e release: npm 8.2.0 + NuGet 8.2.0 — rich text WYSIWYG input primitive`
- Delta stat: `4 files changed, 5 insertions(+), 5 deletions(-)` — clean surgical diff

### Task 3 — Publish npm + publish NuGet + verify

**npm publish** (`cd viewmodel-shell && npm publish`):
- prepublishOnly hook rebuilt dist ✓
- Package tarball: `ashley-shrok-viewmodel-shell-8.2.0.tgz` — 297.6 kB packed / 1.0 MB unpacked / 33 files
- Shasum: `a8f09d28158a0e7a91585f31085f8cec56847452`
- Integrity: `sha512-7EW5d84Bj18Ku[...]8gHeSHpTX61tA==`
- Published to `https://registry.npmjs.org/` with tag `latest` and default access
- Terminal receipt: `+ @ashley-shrok/viewmodel-shell@8.2.0` ✓
- **Registry verification via curl:** `curl -s https://registry.npmjs.org/@ashley-shrok/viewmodel-shell | python3 -c "import sys,json;print(json.load(sys.stdin)['dist-tags']['latest'])"` → `8.2.0` ✓

**NuGet publish** (`dotnet pack -c Release && dotnet nuget push ...`):
- `dotnet pack -c Release` — created `bin/Release/AshleyShrok.ViewModelShell.8.2.0.nupkg` + `.snupkg` ✓
- `dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.8.2.0.nupkg --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json`:
  - `Pushing AshleyShrok.ViewModelShell.8.2.0.nupkg to 'https://www.nuget.org/api/v2/package'...`
  - `PUT https://www.nuget.org/api/v2/package/`
  - `Created https://www.nuget.org/api/v2/package/ 477ms`
  - **`Your package was pushed.`** ← authoritative per AGENTS.md
  - `.snupkg` (symbols) also pushed and Created (127ms)
- **Registry verification via curl:** `curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json` at 15:15Z + 15:19Z returns `[..., "7.0.0", "8.0.0", "8.1.0"]` (8.2.0 not yet indexed). Per AGENTS.md, this is **NORMAL indexer lag (5-15 min)**; the push receipt is authoritative. A follow-up curl in ~10 min will show 8.2.0 as the tip.

### Task 4 — Tag + push tag + verify main advance

- `git tag -a v8.2.0 248147e361aff27d04eaff02c7378171127b1283 -m "viewmodel-shell 8.2.0"` — annotated tag object created ✓
- `git push origin v8.2.0` → `* [new tag]         v8.2.0 -> v8.2.0` ✓
- `git ls-remote --tags origin | grep 'refs/tags/v8.2.0$'` → `64311119d567a7a79aad21187c79042424b1b490	refs/tags/v8.2.0` ✓ (tag object SHA differs from release commit SHA — expected for annotated tags)
- `git rev-parse v8.2.0^{}` → `248147e361aff27d04eaff02c7378171127b1283` — dereferenced tag points to release commit ✓
- `git cat-file -p v8.2.0` confirms `object 248147e...  type commit  tag v8.2.0`
- `git push origin main` → `5696565..248147e  main -> main` ✓
- **`git merge-base --is-ancestor v8.2.0 main` → exit 0 → `MAIN ADVANCED`** ✓ (the load-bearing gate per AGENTS.md's missed-2-releases-2026-06-14 lesson)

### Task 5 — Announce + DM Angel + DM Molly + PID cleanup

**Announce room preflight** (banked 2026-07-31 lesson):
- Vicky login: fresh token minted via `POST /login` with password from `~/.claude/identities/vicky/relay.json`
- `curl "$BASE/account/whoami?access_token=$TOK"` returned `{ "user_id": "@vicky:thenasty.taild9b663.ts.net", "is_guest": false, "device_id": "BBCXNHUPJW" }` — token valid ✓
- `curl "$BASE/joined_rooms"` — 7 rooms listed; `!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net` (announce room) present → **PREFLIGHT OK: vicky is a member of #vms-announcements** ✓
- Angel DM room `!cTFWdfBcWIXexJroXn:thenasty.taild9b663.ts.net` present ✓
- Molly DM room `!JecRElxNGAhCCLRWjg:thenasty.taild9b663.ts.net` present ✓

**Announce PUT to `#vms-announcements`:**
- Body written to `/tmp/vms-8.2.0-announce.json` (non-ASCII safe: 📝, em-dashes, backticks)
- `PUT /rooms/!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net/send/m.room.message/vms-8.2.0-announce-<epoch>?access_token=<TOK>` — Content-Type: application/json, `--data-binary @/tmp/vms-8.2.0-announce.json`
- **Event ID: `$i5XS9J4pViPcsp0HM1Aq1XYV0zN4zVVSl-ZBDjnTZBw`** ✓
- Message text (verbatim):
```
v8.2.0 shipped — rich text WYSIWYG input primitive 📝

- `RichTextFieldNode` (leaf-input primitive) — wire value is a markdown string on the field's `bind` path; the editor is a bundled TipTap 2.x, lazy-imported from browser.ts (Chart.js precedent). Consumers who never render one ship ZERO TipTap/turndown bytes.
- `RichTextToolbarNode` (Route B composite) — typed slot on RichTextField OR standalone. Closed-enum variance axes: size (compact/expanded), tone (danger/warning/success/info), state (Phase 27 uniformity). Approved via before/after tasting served on tailnet.
- Feature-surface floor (Slack/GitHub level): bold, italic, link, ordered/unordered lists, headings h1-h3, inline code, code block, blockquote.
- Display on the read side flows through the existing markdown.ts → InlineRuns pipeline (no new render code).
- Security fix: markdown link/autolink pipeline now sanitizes href schemes at the emission site (both backends). Previous versions emitted raw javascript:/data:/vbscript:/file: schemes into InlineRun.href — real XSS surface for any consumer trusting app-supplied markdown. Now whitelisted to http/https/mailto/tel/ftp + relative; anything else drops the href, label survives as text.
- Additive on the wire; MINOR bump; wire protocol token stays viewmodel-shell/1.0.

npm: https://www.npmjs.com/package/@ashley-shrok/viewmodel-shell
NuGet: https://www.nuget.org/packages/AshleyShrok.ViewModelShell/8.2.0
CHANGELOG: repo CHANGELOG.md v8.2.0
```

**Angel DM PUT to `!cTFWdfBcWIXexJroXn:thenasty.taild9b663.ts.net`:**
- **Event ID: `$YAtH95yNjjV4FqMM-FZhsc6_cELowo3HcLKra-b24J4`** ✓
- Message text (verbatim):
```
Angel — v8.2.0 shipped rich text WYSIWYG (RichTextFieldNode + RichTextToolbarNode). Composition-swap in /ai is unblocked: rich compose area is `RichTextFieldNode(bind:'draft')`, feature-floor toolbar comes for free via the shipped default when RichTextField's toolbar slot is OMITTED. Full details in #vms-announcements.
```

**Molly DM PUT to `!JecRElxNGAhCCLRWjg:thenasty.taild9b663.ts.net`:**
- **Event ID: `$Z2MSMSshT3e7S4xHkl_JQ2PMoQQLQvlEdkfO1S1hbGw`** ✓
- Message text (verbatim):
```
Molly — v8.2.0 shipped RichTextFieldNode + RichTextToolbarNode. When mention-picker-primitive lands, rich text will consume it via a future `mentionsProvider?` slot on RichTextFieldNode — the slot design for this v8.2.0 does not preclude your eventual integration. Full details in #vms-announcements.
```

**PID cleanup:**
- `demo/RichTextTasting-bun/server.pid` — not present at plan close (already cleaned or never left running); no-op ✓
- `demo/RichTextVerification-bun/server.pid` — not present at plan close; no-op ✓
- Top-level `server.pid` at repo root remains untracked (pre-existing per Plan 28-11's git-status snapshot; unrelated to Phase 28's tasting/verification servers per plan spec)

## Task Commits

| # | Task | Commit    | Files |
|---|------|-----------|-------|
| 1 | Auth precheck + pre-bump green-tree re-run | — | (runtime verification; no commit — all gates exit 0) |
| 2 | Bump versions + finalize CHANGELOG date + release commit | `248147e` | CHANGELOG.md, viewmodel-shell/package.json, viewmodel-shell/package-lock.json, viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj (4 files, 5+/5- clean surgical diff) |
| 3 | npm publish + NuGet publish + registry verification | — | (registry ops; no repo commit — package tarball + .nupkg + .snupkg pushed to public registries) |
| 4 | Tag v8.2.0 + push tag + push main + verify main advance | — | (git-object ops; no file commit — tag object `6431111...` created and pushed, main advanced from `5696565` to `248147e`) |
| 5 | Announce + Angel DM + Molly DM + PID cleanup | — | (Matrix ops + filesystem cleanup; no repo commit) |

## Files Created/Modified

See `key-files.modified` in the frontmatter for the full per-file diff summary. This SUMMARY is the sole new file (`key-files.created`).

## Decisions Made

See `key-decisions` in the frontmatter for the six interpretive decisions: MIGRATION.md not modified this plan, staging 4 files (not 6) atomically, ROADMAP + untracked files intentionally left out of release commit, NuGet indexer lag not a failure, DM room IDs from identity file, announce preflight passed with vicky still OWNER.

## Deviations from Plan

**None material.** Two minor plan-spec deltas noted:

1. **Task 2 stage list said 6 files (+ AGENTS.md + composite-nodes-layer.md).** Those two docs were already committed by Plan 28-11 (commits `6fdc2e4`, `50f3176`) — attempting to include them at Task 2 would have been a no-op (nothing modified locally). Stagged the 4 actually-modified files, which is what the plan's `<files_modified>` frontmatter listed. No functional deviation.

2. **Task 5 was `checkpoint:human-verify` in the plan spec** but the executor prompt explicitly said `Autonomous flow — do NOT insert checkpoint:human-action for the auth precheck` and the plan's `must_haves.truths` listed inline execution of every announce/DM step. Executed inline; all evidence captured in this SUMMARY. Ashley's greenlight ("let's go") authorized the autonomous flow before Task 1 started.

No architectural changes. No auth failures. No pre-existing red gates (Plan 28-10's GREEN verdict held). No `checkpoint:decision` triggers. No package-install failures. The release ritual executed byte-aligned with Phase 27's 27-11 template.

## Threat Flags

None. This plan is release ops — no new wire, no new code, no new security surface. Threat model dispositions from the plan's `<threat_model>`:

- **T-28-30** (Elevation of Privilege on registry publish credentials) — MITIGATED. Auth precheck ran inline; `~/.npmrc` sourced from `.env` (never committed); `$NUGET_API_KEY` presence-checked only (value never logged; 46-char length noted); publish commands run under the operator's shell where the credentials are loaded per AGENTS.md operator-gated rule.
- **T-28-31** (Repudiation via missed publish / stranded main) — MITIGATED. Task 3's curl verification (`8.2.0` on npm) + Task 4's `merge-base --is-ancestor v8.2.0 main` gate (exit 0) both green. No STRANDED reconciliation needed — main advanced cleanly from `5696565` to `248147e`.
- **T-28-32** (Repudiation via announcement to wrong room) — MITIGATED. Announce preflight verified vicky is a member of `#vms-announcements` (`!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net`) via `/joined_rooms` output BEFORE the PUT. No room-ID drift; no reconciliation needed. Phase 27's misroute-to-#vms-changelog banked lesson held.
- **T-28-33** (Tampering via rushed publish with green-tree stale) — MITIGATED. Task 1's pre-bump green-tree re-run explicitly re-verified Plan 28-10's verdict AT BUMP TIME (all 82 vitest files + 695 .NET tests + parity + all check:* scripts GREEN). Any drift would have halted; none observed.

## Issues Encountered

None. The release ritual is now well-rehearsed (byte-aligned across v7.0.0, v8.0.0, v8.1.0, v8.2.0 — with continuous small refinements banked). The inline-precheck-and-execute pattern (banked 2026-07-30) removed the sole friction point (theatrical human-action handshake). Ashley's greenlight in the executor prompt authorized the autonomous flow.

## Next Phase Readiness

**Phase 28 SHIPPED.** v8.2.0 is live on both registries; `main` and `v8.2.0` both contain the release; the Pantheon has been notified via `#vms-announcements` + Angel + Molly DMs; tasting + verification servers cleaned up.

For the next phase:
- **v8.2.0 is now the consumer floor** — any Phase 29 plan that consumes RichTextFieldNode or RichTextToolbarNode can assume both are available.
- **Angel is unblocked** on his `/ai` composition-swap; his 1-line composition change can now land against a real published `RichTextFieldNode`.
- **Molly's mention-picker-primitive bounty** is preserved for a future phase; the DM has closed the loop that the future consumer's field now ships.
- **AGENTS.md is up-to-date** — the Phase 28 addendum in §Route B composite-nodes layer + gotcha #4a (link scheme sanitization) landed with Plan 28-11's docs staging.

Plan 28-11's Next-Phase-Readiness §note about substituting `<YYYY-MM-DD>` in the CHANGELOG heading is now discharged (this plan did that).

## Self-Check

**1. Created files exist:**
- `.planning/phases/28-rich-text-wysiwyg-input-primitive-fieldnode-inputtype-rich-b/28-12-SUMMARY.md` → will be written by this Write call.

**2. Modified files show expected changes:**
- `grep -c '"version": "8.2.0"' viewmodel-shell/package.json` == **1** ✓
- `grep -cE '"version": "8.2.0"' viewmodel-shell/package-lock.json` == **2** (root L3 + `packages.""` L9 surgical slots) ✓
- `grep -c '<Version>8.2.0</Version>' viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` == **1** ✓
- `grep -c '<YYYY-MM-DD>' CHANGELOG.md` == **0** ✓ (placeholder replaced with `2026-08-02`)
- `grep -c '^## 8.2.0 — 2026-08-02' CHANGELOG.md` == **1** ✓

**3. Commits exist:**
- `248147e` → FOUND (`release: npm 8.2.0 + NuGet 8.2.0 — rich text WYSIWYG input primitive`) via `git log --oneline -3`

**4. Tag + registry + Matrix:**
- `git tag -l v8.2.0` returns `v8.2.0` ✓
- `git rev-parse v8.2.0^{}` returns `248147e361aff27d04eaff02c7378171127b1283` (release commit) ✓
- `git ls-remote --tags origin | grep 'refs/tags/v8.2.0$'` returns one match ✓
- `git merge-base --is-ancestor v8.2.0 main` exits 0 ✓
- npm registry `dist-tags.latest` == `8.2.0` ✓
- NuGet push receipt: `Your package was pushed` for both .nupkg + .snupkg ✓
- NuGet flat-container index will show `8.2.0` within 5-15 min (documented normal indexer lag; not a release failure)
- Announce event `$i5XS9J4pViPcsp0HM1Aq1XYV0zN4zVVSl-ZBDjnTZBw` accepted ✓
- Angel DM event `$YAtH95yNjjV4FqMM-FZhsc6_cELowo3HcLKra-b24J4` accepted ✓
- Molly DM event `$Z2MSMSshT3e7S4xHkl_JQ2PMoQQLQvlEdkfO1S1hbGw` accepted ✓

## Self-Check: PASSED
