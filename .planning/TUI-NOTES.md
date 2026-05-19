# TUI Front-End — Notes: environment landmines + verification recipes

Hard-won knowledge that is NOT in commits or the roadmap and costs hours to
relearn. Append (don't rewrite) as later phases discover more. Read this
before doing anything in a fresh-context resume.

## Environment landmines

- **Foreground `sleep` is BLOCKED by the Bash tool** (command aborts, exit 1,
  no output). Any wait/poll must live inside a `run_in_background` script
  (sleep works there) or use the `Monitor` tool. This caused two wrong early
  diagnoses ("sandbox", then mis-attributed) — the actual rule is just this.
- `script`, `pkill`, `pgrep` all WORK (not sandbox-denied). But:
  - `pgrep -f <pat>` self-matches the checking command's own cmdline (the
    pattern string is in argv) → false "orphans". Disambiguate with
    `/proc/<pid>/comm` or `pgrep -x <exact-name>`.
  - A foreground command that `pkill`s a harness-tracked background server
    exits **144** (the killed bg task notifies). Expected, not a failure.
- `bun` = `~/.bun/bin/bun`; on PATH via `.bashrc` but the tool's non-login
  shell usually needs `export PATH="$HOME/.bun/bin:$PATH"`. `dotnet` =
  `~/.dotnet/dotnet` (on PATH via `.bashrc`); NOT needed for TUI phases
  (only full cross-backend parity needs it; TUI changes are client-only and
  cannot affect the wire → parity unaffected by construction).
- The Edit tool requires a prior **Read tool** call on a file (a `cat` via
  Bash does not count).

## Commands

- Build: `cd viewmodel-shell && npm run build` (= `tsc -b tsconfig.tui.json`).
- Tests: `cd viewmodel-shell && npx vitest run`. Guard:
  `npm run check:core-globals`.
- `test/tui.test.ts` starts with `// @vitest-environment node` (Ink needs
  Node, not jsdom); `vitest.config.ts` has an additive JSX-only
  `esbuild:{jsx:"automatic",jsxImportSource:"react"}`.
- Live proof backend (background):
  `cd demo/Tasks-fullstack-bun && PORT=3000 bun run server.ts`
  then `node viewmodel-shell/dist/tui-cli.js http://localhost:3000/api/tasks`.

## Verification recipes

- **Byte-identity gate (invariant 5).** BEFORE any edit, from current HEAD:
  `cd viewmodel-shell && npm run build && sha256sum dist/index.js
  dist/index.d.ts dist/browser.js dist/browser.d.ts dist/server.js
  dist/server.d.ts > /tmp/vms-baseline.txt`. After edits+rebuild, re-hash and
  diff — all 6 MUST be identical (project-references isolation keeps core a
  separate program). If it ever differs: stop, the addon is disturbing core.
- **Web-bundle-unaffected:** `cd demo/Tasks-fullstack-bun && bun run build`;
  the Vite content hash must be unchanged (a leak of ink/react changes it).
- **Interactive teardown (TTY signal handling)** is only headlessly testable
  via **`python3` `pty.fork` holding the master open**. `script` and
  `pty.spawn` both fail here: no controlling terminal / parent-stdin EOF →
  the CLI takes the non-TTY path or exits before a signal lands. Recipe:
  python forks, child `os.execvp`s node, parent NEVER closes `master`
  (so child tty stdin never EOFs → stays interactive), drains output, waits
  for the render marker, `os.kill(child, SIGINT/SIGTERM)`, `os.waitpid`,
  reports `os.waitstatus_to_exitcode`. Expect SIGINT→130, SIGTERM→143,
  `ESC[?25h` (cursor restore) present, no hang. Also check non-TTY paths:
  piped→0, unreachable URL→1, no-arg→2, bad-url→2.
- **Instrument, don't guess.** When behavior is surprising, write a tiny
  diagnostic that logs state (isTTY, branch taken, handler fired, exit code)
  with child **stderr redirected to a file** via `os.dup2` (keeps it clean of
  Ink's screen control codes). Two diagnoses were wrong before instrumenting;
  the instrumented run found the real cause immediately.

## Ink behavior gotchas (load-bearing)

- **Ink does NOT hold the Node event loop open when the view tree has no
  input hooks** (`useInput`/`useFocus`). Without an active handle Node finds
  the loop empty and exits (code 0) the instant `load()` returns — before any
  Ctrl-C. `tui-cli.ts` has an explicit TTY keep-alive (`setInterval` no-op)
  for exactly this. Phases 0–1 have no input hooks → the keep-alive is
  load-bearing; do NOT remove it until an interaction phase adds real input
  handles, and re-verify teardown when you do.
- Ink registers `signal-exit` (`ink.js`) and resolving its `waitUntilExit()`
  (which `adapter.dispose()`→Ink unmount does) lets the awaited tail resume.
  Teardown is centralized in `tui-cli.ts`'s idempotent guarded `shutdown()`:
  set `process.exitCode` FIRST, restore terminal, exit; first caller wins so
  the resumed tail can't reset the code. Don't reintroduce a separate
  exit-code path.
- `TuiAdapter.dispose()` is idempotent (Ink `unmount()` restores cursor/raw
  mode — emits `ESC[?25h`). `inkRender(tree,{exitOnCtrlC:false})` so Ink
  doesn't race the CLI's signal ownership. Subsequent `render()` calls use
  `instance.rerender()` (one instance; never re-mount).

## Phase 1 learnings (read before Phase 2)

- **OSC 8 vs `string-width` (load-bearing).** `string-width` does NOT strip
  OSC 8 hyperlink escapes, so emitting `ESC]8;;href BEL label ESC]8;; BEL`
  inside a wrapping/multi-child `<Text>` makes Ink over-count the line width
  and corrupt Yoga layout of *siblings*. Mitigation in `tui.tsx` `link`: the
  OSC string is the SOLE child of its own `<Box>` with
  `<Text wrap="truncate-end">` (over-count contained to that line); empty/blank
  href degrades to a plain `<Text>{label}</Text>` (no dangling OSC opener).
  Verified: ink-testing-library `lastFrame()` keeps the raw `]8;;` bytes — Ink
  writes Text content verbatim, it does not sanitize OSC.
- **`density` is a `page`-only wire field.** It is threaded DOWN the recursion
  (`renderNode(node,key,density,inherited)`); `section`/`list` inherit it (the
  wire type has no `section.density`). An inherited `{color?,dim?,bold?}` tint
  is the 4th recursion arg (list-item variant → child text/button/link).
- **Fail-loud placeholder tests must be retargeted when a node graduates.**
  Phase 0's test "B" fed `progress` and asserted `phase 0`; Phase 1 implements
  `progress`, making that assertion wrong. Rule for every later phase: when you
  implement a previously-deferred node, grep the test suite for its
  `[unsupported: …]` assertion and retarget it to a STILL-deferred node + bump
  the phase string. (B now targets `table`.)
- **Web-bundle byte oracle (concrete).** Pre/post Phase 1, `cd
  demo/Tasks-fullstack-bun && bun run build` emits the SAME Vite content
  hashes: `assets/index-UzlLPlgm.css` + `assets/index-B7l5XdRz.js`. Future
  phases: if either hash changes, ink/react leaked into the web graph — stop.
- **Non-TTY render width.** Piped (`| cat`) the CLI renders the whole tree
  ONCE at Ink's default 80 cols and exits 0. At 80 cols the sidebar + nested
  borders fit, but long text WRAPS (not truncates) → multi-word phrases can
  split across lines. Live-E2E greps must use short distinctive tokens
  (`"Views"`, `"33%"`, `"[x]"`, `"✓"`), never long phrases; the unit tests use
  a controlled fixture so phrase asserts are safe there.
- **Phase 1 blast radius (verified at VCS level).** `git status` after Phase 1
  shows ONLY `src/tui.tsx` + `test/tui.test.ts` modified; the 6 core dist
  hashes are byte-identical to `/tmp/vms-baseline.txt`; all 52 vitest tests +
  core-globals guard green; `tui-cli.ts` untouched so Phase-0 PTY teardown
  holds by construction (no input hooks added — still input-free).

## Phase 2 learnings (read before Phase 3)

- **Raw-mode kills keyboard SIGINT (the load-bearing Phase-2 fact).** The
  first `useInput` makes Ink call `setRawMode(true)` → ISIG cleared → a
  *keyboard* Ctrl-C is delivered as input byte `0x03`, NOT SIGINT. With
  `inkRender(...,{exitOnCtrlC:false})` Ink won't self-exit either, so without
  wiring Ctrl-C hangs the terminal. Fix: `TuiAdapter.setRequestExit(fn)` (a
  TUI-internal seam between our two leaf files, NOT the core Adapter
  interface); the App's `useInput` maps `key.ctrl && input==="c"` →
  `requestExit(130)` → the CLI's existing idempotent `shutdown(130)`.
  **SIGTERM and *programmatic* `kill -INT` are unaffected by raw mode** (only
  terminal-generated signals are) — the `process.once("SIGINT"/"SIGTERM")`
  handlers still fire for those. The `setInterval` keep-alive is now redundant
  on the TTY path (Ink's resumed raw stdin holds the loop) but is harmless;
  kept as belt-and-suspenders. Re-verified the full teardown matrix.
- **ink-testing-library input timing (every interaction test depends on it).**
  Ink attaches its stdin `data` listener in a POST-MOUNT effect; a
  `stdin.write` before that attaches is silently dropped (raw EventEmitter, no
  buffering — NOT recoverable by waiting longer afterward). Recipe: `render()`
  → `await tick(~30ms)` BEFORE the first write → `stdin.write(seq)` →
  `await tick(~20ms)` before asserting (input→setState→rerender is async).
  `useStdin().isRawModeSupported === true` under ink-testing-library, so
  `useInput(h,{isActive:isRawModeSupported})` IS active in tests (no
  force-active opt needed). Key decoding: Tab=`key.tab`,
  Shift-Tab=`key.tab&&key.shift`, arrows=`key.downArrow/upArrow`,
  Enter=`key.return`, Space=`input===" "` (no key flag), Ctrl-C=`key.ctrl &&
  input==="c"`. Ink does NOT swallow Tab when `useFocus` is unused.
- **App must be a stable root component.** `instance.rerender()` reconciles
  the SAME `<App>` instance, so its `useState` focus survives the shell's
  full-tree re-renders (that IS the continuity mechanism). The shell passes a
  NEW `onAction` closure every render/poll → keep it in a ref updated each
  render or the input handler dispatches stale.
- **focusWrap key collision.** A focus wrapper that renders `[caret, el]` must
  give them FIXED structural keys (`"caret"`/`"el"`), never a literal that can
  equal a node's `keyOf` (a node named `"c"` collided → React "two children
  with the same key" warning + possible child drop). Wrapped `el` is the sole
  child of its own `<Box key="el">` so its own key is irrelevant there.
- **PTY E2E: drain AFTER Ctrl-C or you’ll false-fail cursor-restore.** Ink
  emits the cursor-restore (`ESC[?25h`) during unmount AFTER you send Ctrl-C;
  those bytes sit unread in the pty buffer until you read them (parent never
  closes master). The interaction sessions must `drain(master,…)` *after*
  sending Ctrl-C (the `pty_signal` cases already drained-after, which is why
  they passed while the first interaction-session pass false-failed). Also set
  a wide `TIOCSWINSZ` (~140 cols) on the master — the Phase-1 wrap pitfall
  applies under a PTY too, so long task titles wrap and break substring greps
  at the default width.
- **Fail-loud phase string is single-sourced** in `unsupported()`; bump it
  every phase and retarget the test assertions. Phase 2: string is now
  `phase 2`; test B → `table`, the deferred test → `modal`/`table`/
  `field(<it>)`, all asserting `phase 2`. (No node graduated in Phase 2 —
  interaction was added to already-rendered nodes.)
- **Phase 2 blast radius (verified).** `git status` shows ONLY
  `src/tui.tsx`, `src/tui-cli.ts`, `test/tui.test.ts` modified (+ `.planning/*`
  in the commit). 6 core dist hashes byte-identical to baseline; web-bundle
  Vite hashes unchanged (`index-UzlLPlgm.css` + `index-B7l5XdRz.js`); 66
  vitest tests + core-globals green; PTY matrix 9/9 (filter/delete/toggle
  reflected; Ctrl-C-input→130, SIGINT→130, SIGTERM→143, piped→0,
  unreachable→1, no-arg→2, bad-url→2; cursor restored on every exit).

## Phase 3 learnings (read before Phase 4)

- **ink-text-input@6.0.0 source facts (read `node_modules/ink-text-input/
  build/index.js` — they make the design trivial).** Its internal `useInput`
  **explicitly early-returns Up/Down/Tab/Shift-Tab/Ctrl-C** (`if (key.upArrow
  || key.downArrow || (key.ctrl && input==='c') || key.tab || (key.shift &&
  key.tab)) return;`). So those keys reach App's root handler untouched —
  Ctrl-C teardown + ring traversal "just work" while editing, no precedence
  hacks. `Enter`→`onSubmit(value)`; `Left/Right`→an internal `cursorOffset`
  (`useState`); a `useEffect` clamps it when the controlled value shrinks.
  Multi-char input inserts verbatim (paste = accepted as-is). Peers
  `ink>=5`/`react>=18`, ESM, ships `build/index.d.ts` (resolves under
  NodeNext — no tsconfig change).
- **Editing-mode gate (the Phase-3 input-arbitration core).** `editing =
  interactive && focusedDesc.kind==="field" && isEditableSingleLine(it)`.
  Only the focused editable field mounts `<TextInput focus>` (one
  input-active editor; unfocused fields are the static box). App's root
  `useInput`: Ctrl-C always → requestExit; in editing mode handle ONLY
  Tab/Shift-Tab and `return` for everything else (ink-text-input owns
  char/Backspace/Left/Right; Enter→its onSubmit). Ring mode = unchanged
  Phase-2. NO_CTX/`renderTree`/non-TTY ⇒ `interactive:false` ⇒ never an
  editor ⇒ byte-identical to P1/P2 (invariant 5 holds; all static tests
  unmodified).
- **Draft model = BrowserAdapter's rule, re-implemented.** App
  `useState<Record<focusKey,string>>`. `draftFor(k)` returns the draft ONLY
  if the key is present, the field still exists, and `prevServerRef.current[k]
  === fieldServerNow[k]` (server hasn't changed that field's value). A
  guarded `useEffect` prunes stale drafts + snapshots `fieldServerNow` for the
  next render (guard returns the same map ref when nothing pruned → no extra
  render). `collectForm`/`submitOf` take a `FieldValue` resolver (draft else
  server, default = server) so **untyped == Phase 2** → every P2 payload test
  passes unmodified.
- **Caret continuity is a stable-key guarantee, and it's testable.** The
  focused `<TextInput key="input">` under the stable App root keeps the SAME
  instance across the shell's `instance.rerender()`, so ink-text-input's
  internal `cursorOffset` survives — the Phase-2 "stable root" mechanism one
  level down. Prove it by: type, **Left Left**, rerender same vm, insert a
  char → it lands at the preserved caret (a cursor-at-end test would pass
  even without continuity — useless).
- **chalk is DISABLED under ink-testing-library (no TTY).** ink-text-input's
  inverse fake-cursor therefore emits NO SGR in tests; `lastFrame()` is plain
  text. Consequences: (1) `stripAnsi` is a harmless no-op in tests (still
  correct/needed for real terminals — keep it); (2) you CANNOT assert "an
  editor is mounted" via an ANSI artifact — assert **behavior** (typing
  mutates the displayed value). This cost the only red test on first run.
- **form-`checkbox` is ring-mode, not an editor.** Space toggles its draft
  `"true"/"false"`; Enter submits the enclosing form. `activate(d, trigger)`
  now takes `"enter"|"space"` to split these.
- **package.json IS edited this phase (first time) and the byte gate still
  held.** `ink-text-input` → optionalDependencies + devDependencies; project
  references keep the 6 core dist files byte-identical (a package.json dep
  never feeds the core compile). `npm install` regenerated
  `package-lock.json` (+20 lines incl. transitive `type-fest`) — committed;
  CI uses `npm install` so lockfile churn is fine.
- **`tui-cli.ts` UNCHANGED; teardown safe by construction.** ink-text-input
  early-returns Ctrl-C → still reaches App→`requestExit(130)`; programmatic
  SIGINT/SIGTERM are raw-mode-immune. Re-verified: **PTY matrix 11/11**
  including **Ctrl-C WHILE EDITING → 130 + ESC[?25h**, SIGINT→130,
  SIGTERM→143, piped→0, unreachable→1, no-arg→2, bad-url→2. The headline
  (`type a title in the inline form + Enter → new task row`) passed live
  against `Tasks-fullstack-bun` — Tasks now operates 100% in the terminal,
  zero backend changes.
- **Fail-loud string bumped 2→3** (single-source `unsupported()`); test B +
  the deferred test retargeted. **No node graduated** — the single-line
  family was already *rendered* statically in P2; P3 only made it *editable*.
  Phase-4 rule reaffirmed: still no graduation (modal/table/textarea/code/
  select/select-multiple/file remain deferred); just bump 3→4 + retarget.
- **Phase 3 blast radius (verified at VCS level).** `git status` = ONLY
  `src/tui.tsx`, `package.json`, `package-lock.json`, `test/tui.test.ts`
  (+ `.planning/*` in the commit). 6 core dist hashes byte-identical to
  `/tmp/vms-baseline.txt`; web-bundle Vite hashes unchanged
  (`index-UzlLPlgm.css` + `index-B7l5XdRz.js`); 77 vitest + core-globals
  green; PTY matrix 11/11.

## Phase 4 learnings (read before Phase 5)

- **Core `push()` is NOT try/caught** (`index.ts:348-351`); `dispatch()` IS
  (337-340); `load()` never calls `processResponse` and **ignores
  `response.redirect`** (277-297). ⇒ a throwing `storage`/`navigate` is
  uncaught on the push path. Decision (load-bearing): `TuiAdapter.storage`
  surfaces I/O failure LOUDLY (stderr + `showInterstitial`) and **never
  re-throws**; `navigate` never throws. A corrupt EXISTING `storage.json` is
  surfaced loud and NOT clobbered (XDG path may collide with a user file —
  fail-loud beats silent destruction).
- **Core drops a falsy redirect**: `if (body.redirect)` (`index.ts:382`) —
  `redirect:""` is treated as NO redirect (falls to vm render; with vm
  omitted that's `render(undefined)` → Ink crash → clean exit 0, pre-existing,
  NOT Phase 4). So the invalid-redirect interstitial branch is reachable ONLY
  via a **truthy-but-unparseable** string. The PTY "invalid" mock MUST return
  e.g. `{redirect:"http://"}` (truthy; `new URL("http://"[,base])` throws →
  `classify` → invalid). A `{redirect:""}` mock tests nothing.
- **`ViewModelShell.endpoint` is immutable, `load()` takes no URL** → a
  same-origin redirect is followed by a NEW `ViewModelShell` reusing the ONE
  adapter (Ink `rerender`s in place — no remount). `connect()`'s options carry
  the same `onRedirect` so redirects chain; `currentShell.stopPolling()`
  before the swap (no timer armed today — `grep -E 'nextPollIn|pollInterval'`
  empty in the demo + cli — but defends a future one).
- **Non-TTY redirect is unreachable-by-construction**: `load()` ignores
  `response.redirect` and the non-TTY path performs no dispatch, so a redirect
  only fires from a TTY dispatch (or `push()` in tests). The `redirectFailed`
  funnel in `tui-cli.ts` is defensive only. Don't build a piped-redirect PTY
  case — it can't fire; push()-driven unit tests cover that logic.
- **Interstitial = single-Ink-instance `rerender` via an `interstitial` prop
  on the SAME `App`** — never a 2nd `inkRender`, never raw stdout. App's sole
  existing `useInput` stays mounted so the unconditional Ctrl-C→`requestExit
  (130)` still quits; an added `interstitialActiveRef` guard (NOT a new hook —
  mirrors `editingRef`) makes the ring inert so a stray key can't dispatch
  behind the notice. NO new input hook ⇒ Phase 0-3 teardown topology
  unchanged. `showInterstitial`/`navigate` early-return when `disposed`
  (kills the redirect-during-teardown rerender-after-unmount race).
- **`openExternal` failure is ASYNC**: `spawn` reports a missing opener via an
  async `error` event, not a sync throw — so it returns `true` even when
  `xdg-open` is absent; the caller passes an `onSpawnError` that shows the
  interstitial. This box has NO opener + empty `$BROWSER`, so the interstitial
  fallback is the PRIMARY exercised path (a strength — the default-tested one).
  Zero new deps: `node:child_process/fs/os/path` only, in the two leaf files
  (the core-globals guard scans only `index.ts`, so this is out of scope).
- **Unit-test isolation gotcha**: `shell.push({sideEffects:[…]})` with NO
  redirect falls through to `adapter.render()` (`index.ts:392-394`) → a real
  Ink mount (raw-mode stderr + leaked handle) under node-env. Storage tests
  MUST `vi.spyOn(adapter,"render").mockImplementation(()=>{})` (mirrors the
  carried test C). Storage runs in the side-effects loop BEFORE render, so
  stubbing render doesn't affect the assertion. `vi.mock("node:child_process",
  spread + override spawn)` via `vi.hoisted` keeps spawn deterministic for the
  whole file (Phase 1-3 never call spawn → harmless).
- **PTY headline staging**: the simple one-shot-`keyA` harness CANNOT stage
  Tab-focus-then-type (focus changes need inter-key rerenders — the Phase-2
  timing rule); a single burst deadline-kills (`-9`, NOT a regression). Use a
  PACED harness (`Tab; pump 0.5s` ×3, then type, then Enter). Prove the server
  round-trip by the nav COUNT (`All (3)`→`All (4)`), NOT the typed text (it
  shows in the editor pre-submit anyway). Tasks focus order: All, Active,
  Completed (3 nav buttons) → the title field is the 4th focusable (3 Tabs
  from the auto-focused "All").
- **No node graduated** (modal/table/textarea/code/select/select-multiple/file
  still deferred). Fail-loud string single-sourced, bumped 3→4 at
  `tui.tsx unsupported()`; retargeted test B (`table`) + the deferred test
  (`modal` + `field(<it>)`) to `phase 4`. **Phase-5 rule:** 5a-5d each
  graduate a node → bump 4→5 AND DELETE that node's `[unsupported]`
  placeholder + retarget the assertions to a still-deferred node.
- **Phase 4 blast radius (verified at VCS level).** `git status` = ONLY
  `src/tui.tsx`, `src/tui-cli.ts`, `test/tui.test.ts` (+ `.planning/*` in the
  commit). **NO `package.json`/`package-lock.json` change — zero new deps**
  (Node builtins only; distinct from Phase 3 which added `ink-text-input`). 6
  core dist hashes byte-identical to `/tmp/vms-baseline.txt`; web-bundle Vite
  hashes unchanged (`index-UzlLPlgm.css` + `index-B7l5XdRz.js`); **86 vitest**
  (77→86, +9) + core-globals green. **PTY matrix (all cursor-restored):**
  standard vs LIVE `:3000` SIGINT→130 / SIGTERM→143 / Ctrl-C→130;
  no-arg→2, bad-url→2, unreachable→1, piped→0; NEW diff-origin→interstitial→
  SIGINT 130 / SIGTERM 143; invalid(truthy-unparseable)→interstitial→Ctrl-C
  130 / SIGINT 130; live headline add via real bun `All(3)→All(4)`→Ctrl-C
  130. Tasks emits no redirect/sideEffects ⇒ Phase-4 paths are dormant for it
  (no-regression by construction + the live headline).

## Phase 5a learnings (read before Phase 5b)

- **No mature Ink-5/React-18 multi-line editor exists (settled — do NOT
  re-research).** Registry-vetted: `ink-multiline-input@0.1.0` (peer
  ink≥6/react≥19), `react-ink-textarea@0.1.2` (ink^7) — both force the
  forbidden Ink/React major bump; `ink-text-area@0.0.1` (single 2024 release,
  abandoned, hard-pins ink/react → dep-dup trap); `@inkjs/ui@2.0.0` has NO
  multiline. ⇒ Phase 5a is a CONTAINED `MultilineEditor` (tui.tsx) on Ink
  primitives only, ZERO new deps. **For 5b: `ink-select-input@6.2.0`
  (2025-04-29) IS the mature Ink-5/React-18 pick the roadmap locks — confirm
  its peer range at 5b time, but it is a real maintained lib (unlike the
  multiline options).**
- **Nested-`<Text>` caret-split layout bug (LOAD-BEARING — the only red).**
  A focused line as `<Text>{a}<Text inverse>{c}</Text>{b}</Text>` renders
  fine IN ISOLATION but inside the LIVE focusWrap + bordered-box + gap-column
  tree corrupts Ink/Yoga width measurement → wraps the line char-per-char
  (`hello`→`h`/`e`/…). Same class as Phase-1 OSC8/string-width over-count.
  **Fix: every editor line is ONE flat `<Text>`; no nested styled span
  mid-string.** ⇒ NO rendered caret glyph (focus = focusWrap's `▸`; caret
  tracked internally only). An inline caret glyph also fragments the
  value-substring test asserts — double reason to omit (documented deferred
  polish; any future caret must be non-nesting AND re-verified in the LIVE
  adapter tree). **Isolation repros LIED**; a `VMS_DEBUG` stderr line in the
  component + an adapter-level repro found it (instrument, don't guess —
  three wrong theories first).
- **`stdin.write("hello")` = ONE `useInput` call** (`input="hello"`,
  verified) — not 5. Printable branch handles multi-char + splits embedded
  `\n` (paste). Per-char and burst both correct.
- **Editing-gate broadened**: `editing = … && (isEditableSingleLine(it) ||
  isEditableMultiLine(it))` (new `isEditableMultiLine` = textarea|code).
  App's editing branch already only acts on Tab/Shift-Tab + returns → correct
  for multi-line UNCHANGED. `MultilineEditor`'s own useInput MIRRORS
  ink-text-input: early-return Ctrl-C + Tab + Shift-Tab (App owns
  teardown+ring), owns char / Enter→`\n` / Backspace+Delete / Left/Right /
  Up/Down. Ink calls EVERY useInput (no bubbling) → collision-free; teardown
  unaffected (`tui-cli.ts` UNCHANGED, PTY-verified).
- **Caret inits at END of value** (lazy `useState` initializer — once at
  mount, NOT on rerenders → continuity; mirrors ink-text-input UX; makes the
  server-wins / draft-survival tests analogous to Phase-3).
- **collectFocusables/collectForm: textarea+code REMOVED from the
  exclusion/skip lists** (now focusable & collected); `isEditableSingleLine`
  still excludes them. Tab-always-traverses (locked Q2): `code` == textarea
  editor + a dim ` [<language>]` label; literal-tab deferred & documented.
- **Fail-loud string bumped 4→5 ONCE in 5a; it STAYS `phase 5` for ALL of
  Phase 5.** PATTERN CHANGE vs Phases 0–4 (each integer phase bumped). 5b/5c/
  5d MUST NOT bump to `phase 6` — only DELETE the graduated node's
  `[unsupported]` placeholder + retarget the deferred-list / "string is now
  phase 5" / "B" asserts to a still-deferred node, all still `phase 5`. 5a
  graduated textarea+code (dropped from the deferred-list test);
  still-deferred = select / select-multiple / file / modal / table.
- **Zero new deps** — `package.json`/`package-lock.json` UNCHANGED
  (Phase-4-like, NOT Phase-3). `code` has no backend demo (only the
  backend-less Showcase) ⇒ `code` is unit-test-only (Phase-4-style); textarea
  is live-proven. Don't hunt a `code` backend in 5b+.
- **Phase 5a blast radius (VCS-verified).** `git status` = ONLY `src/tui.tsx`,
  `test/tui.test.ts` (+ `.planning/*` in commit). 6 core dist hashes
  byte-identical to `/tmp/vms-baseline.txt`; web-bundle Vite hashes unchanged
  (`index-UzlLPlgm.css` + `index-B7l5XdRz.js`); **97 vitest** (86→97, +11) +
  core-globals green; `tui-cli.ts` untouched. **PTY 12/12** vs an EPHEMERAL
  textarea fixture (`demo/ContactManager-bun/_fixture.ts`, created+removed
  in-run; first focusable = textarea → deterministic auto-focus, no nav):
  real-HTTP multi-line round-trip (`AAA`⏎`BBB`→Tab→submit→server echoed
  `SAVED=[AAA\nBBB]`), Ctrl-C-while-editing-textarea→130+ESC[?25h,
  SIGINT→130, SIGTERM→143, piped→0, unreachable→1, no-arg→2, bad-url→2. Real
  `ContactManager-bun` non-TTY smoke renders its textarea over real wire
  (exit 0). The brittle 12-contact ring made scripted nav to ContactManager's
  notes impractical → the deterministic ephemeral fixture is the cleaner
  proof (Phase-4-style fixture pattern); don't fight the demo ring in 5b+.

## Phase 5b learnings (read before Phase 5c)

- **`ink-select-input@6.2.0` is source-verified (read `node_modules/
  ink-select-input/build/SelectInput.js` — the HARD GATE).** Its `useInput`
  acts on ONLY: `k`/upArrow, `j`/downArrow, digits `1-9`, `key.return`. It
  NEVER references `key.tab`/`key.shift`/Ctrl-C → those pass through (Ink calls
  every useInput, no bubbling — Phase-2 fact) so App keeps ring + teardown
  with **no wrapper/contingency**. Default export `SelectInput`; props
  `items:{label,value,key?}[]` / `isFocused` / `initialIndex` / `limit` /
  `onSelect(item)` / `onHighlight(item)`. Internal index resets ONLY when the
  items' VALUES deep-change (its own useEffect) — same `options` across the
  shell's rerenders does NOT reset it.
- **No mature Ink-5/React-18 MULTI-select lib with the required keyboard
  contract (settled — do NOT re-research).** ink-select-input is single-only;
  `ink-multi-select` is dead (ink^3/react^16, 2020); `@inkjs/ui` MultiSelect's
  Tab/Ctrl-C pass-through is UNDOCUMENTED. ⇒ `select-multiple` = a contained
  `MultiSelectInput` on Ink primitives (the exact Phase-5a `MultilineEditor`
  precedent), **zero extra dep for the multi case** (one new dep total:
  `ink-select-input` for single). CONTROLLED by `props.value` (comma-joined,
  the wire shape) — selected SET derived every render ⇒ server-authoritative
  by construction; only the highlight index is internal. Keyboard contract
  MIRRORS MultilineEditor: early-return Ctrl-C + Tab/Shift-Tab; owns Up/Down +
  Space(toggle); Enter inert (App editing branch also returns on Enter).
- **THE select draft contract = the INVERSE of text/textarea (load-bearing).**
  AGENTS.md: "Selects are excluded from draft preservation — can't tell
  'server set this' from 'user changed it'." Mechanism: `isServerRender =
  prevVmRef.current !== undefined && prevVmRef.current !== vm` (a server
  re-render ⟺ a NEW vm object identity; a local setState re-render keeps the
  SAME `vm` prop) + `selectKeysNow`. `draftFor` drops a select draft when
  `isServerRender` **even if that field's server value is unchanged** (the
  inverse of the text "keep unless server changed it" rule); the prune effect
  drops them too and updates `prevVmRef.current = vm`. The pick STILL
  round-trips because `collectForm` runs synchronously at submit BEFORE the
  server re-render. Single `<SelectInput key={`sel:${resolvedValue}`}>`:
  remounts at the right index on a value change (fresh pick OR server-
  authority after the prune); pure navigation doesn't change the resolved
  value ⇒ no mid-nav remount. The dedicated test "select draft does NOT
  survive a server re-render" is the exact inverse of Phase-5a textarea #6 —
  keep both; they pin the contract from both sides.
- **Edit sites (mirrors 5a):** `isSelect(it)=select|select-multiple` added;
  editing gate broadened `… || isSelect(it)`; `isEditableSingleLine`
  UNCHANGED (a picker is not a text editor); App's editing branch UNCHANGED
  (only Tab/Shift-Tab + return → correct for pickers). `collectFocusables`:
  removed select/select-multiple from the exclusion (now focusable;
  hidden/file still excluded). `collectForm`: removed from the skip (now
  collected via the generic `out[name]=resolve(f)`; `file` still skipped) —
  select = chosen value, select-multiple = comma-joined (the draft/server
  value already IS comma-joined; no special join in collectForm).
- **Dep phase (Phase-3 shape, NOT 5a).** `ink-select-input@^6.2.0` →
  optionalDependencies + devDependencies; `npm install` regenerated
  `package-lock.json` (committed; CI uses `npm install`). **Byte gate STILL
  held** (project-references keep core a separate program — a package.json dep
  never feeds the core compile; re-proven: 6 dist files byte-identical).
- **Fail-loud string UNCHANGED `phase 5`** (Phase-5 rule — 5b graduated nodes,
  did NOT bump). select/select-multiple `[unsupported]` DELETED; **`file` is
  now the LAST still-deferred FIELD type**; still-deferred nodes =
  `file`(field)/`modal`/`table`. Retargets: deferred-list loop →
  `["file"]`; Phase-5a graduation test #11 `select`→`file` (title now
  "textarea/code graduated; file remains"); "string is now phase 5" test
  UNCHANGED (table/modal still deferred). New `describe("Phase 5b …")` = 8
  tests incl. the inverse-draft test.
- **`tui-cli.ts` UNCHANGED; teardown safe by construction** (pickers cede
  Ctrl-C → App `requestExit(130)`; programmatic SIGINT/SIGTERM raw-mode
  -immune). **PTY 15/15** vs an EPHEMERAL select fixture
  (`demo/Tasks-bun/_fixture.ts`, created+removed in-run, first focusable =
  `select` → deterministic auto-focus): live real-HTTP round-trip
  (Down→Enter pick→Tab→submit → server echoed `PICKED=b`),
  Ctrl-C-while-picker-focused→130+ESC[?25h, SIGINT→130, SIGTERM→143,
  piped→0 (renders the select statically), unreachable→1, no-arg→2,
  bad-url→2; cursor restored every exit. `select-multiple` is unit-proven
  (no backend demo emits it; same as 5a `code`) — its contract is fully
  covered by the Phase-5b unit block.
- **Phase 5b blast radius (VCS-verified).** `git status` = ONLY `src/tui.tsx`,
  `package.json`, `package-lock.json`, `test/tui.test.ts` (+ `.planning/*` in
  commit) = the Phase-3 shape (dep phase), NOT 5a's. 6 core dist hashes
  byte-identical to `/tmp/vms-baseline.txt`; web-bundle Vite hashes unchanged
  (`index-UzlLPlgm.css` + `index-B7l5XdRz.js`); **105 vitest** (97→105, +8) +
  core-globals green; `tui-cli.ts` untouched. For 5c (`modal`): the
  contained-component + `isServerRender` + ephemeral-fixture-PTY patterns are
  now well-trodden; modal needs a compositing/z-layer + focus trap (no lib —
  contained, like 5a/5b). Don't fight demo rings; ephemeral fixture
  (first-focusable=target, never committed) stays the live-proof tool.

## Phase 5c learnings (read before Phase 5d)

- **PTY `ICRNL` gotcha (LOAD-BEARING, NEW — costs hours; mandatory for any
  Enter-driven PTY proof incl. 5d sortable headers).** Under `pty.fork` the
  slave's default termios has `ICRNL` set, so a written `\r` (CR) is
  translated to `\n` (NL) before the child reads it; Ink decodes a bare `\n`
  as `input="\n", key.return=false` (NOT return) → an "Enter activates a
  focused button" PTY scenario silently no-ops while **Esc / arrows /
  signals all work** (they contain no CR). Ink/libuv raw mode did NOT clear
  ICRNL in this env. Fix is in the HARNESS, never the framework: after
  `pty.fork`, `a=termios.tcgetattr(fd); a[0]&=~(termios.ICRNL|termios.INLCR|
  termios.IGNCR); termios.tcsetattr(fd,termios.TCSANOW,a)` on the pty fd so
  CR reaches Ink as `key.return`. Found by instrument-don't-guess: a
  `VMS_DEBUG` stderr line at the top of App's `useInput` + child stderr→file
  via `os.dup2` showed `input="\n" key.return:false` on the very first run
  (the PRE-frame already proved trap+focus correct → isolated to key
  decoding). The debug line was added, used, then REMOVED and byte-gate +
  113 tests re-verified before commit.
- **Modal = first STRUCTURAL node graduated** (not a `field` input-type like
  5a/5b). Shape that worked: `renderNode` `case "modal"` (bordered box,
  EVERY line ONE flat `<Text>` — P1/5a width pitfall) serving BOTH the
  static (`renderTree`/`frame`) and interactive paths; App-level `findModal`
  (interactive-only) → `collectFocusables(modal ?? vm)` IS the focus trap.
  **A `case "modal"` had to be ADDED to `collectFocusables` (recurse
  children+footer) — REQUIRED, else the trapped ring is empty and Tab/Enter
  are dead.** Esc lives in a `modalActiveRef`+`dismissActionRef` ref-gated
  branch INSIDE the existing root `useInput` (the Phase-4 interstitial
  precedent — **NO new hook ⇒ `tui-cli.ts` UNCHANGED ⇒ teardown safe by
  construction**, PTY-verified incl. Ctrl-C-while-modal-open→130).
- **Screen-ownership = the honest terminal "z-layer".** App returns ONLY the
  centered modal when `interactive && findModal(vm)`; base suppressed. The
  non-interactive path (renderTree / non-TTY / unit) renders the whole tree
  INLINE (modal box among siblings) → Phase-1 non-TTY contract +
  deterministic static tests preserved. Invariant-5 byte-identity is about
  CORE dist, NOT tui output (tui output legitimately changes as a node
  graduates — same as 5a/5b).
- **Esc placement (load-bearing):** after the interstitial gate, BEFORE
  `if(ring.length===0) return;` (a text-only dismissible modal has an empty
  trapped ring — Esc must still fire) and before the `editingRef` branch
  (Esc cancels even from inside a modal-body field; ink-text-input /
  MultilineEditor don't consume Esc — P3/5a). Non-dismissible honored: no
  `dismissAction` ⇒ Esc swallowed-as-noop while the modal is open (never
  synthesize a close — AGENTS).
- **AGENTS reconciliation (recorded so a reviewer doesn't flag it):** AGENTS
  "modal: no focus management — intentional" describes the *BrowserAdapter*;
  the TUI roadmap locks a focus *trap* — a per-adapter rendering decision,
  no wire/contract change. Not a contradiction.
- **Phase-5 rule held (no string bump):** single-sourced `unsupported()`
  UNCHANGED `phase 5`. `modal`'s `[unsupported]` DELETED (real `case
  "modal"`). Test retargets: deferred-list test `modal`→`table`;
  "fail-loud string is now phase 5" dropped the `modal` half (kept `table`);
  "B" UNCHANGED (`table`). Still-deferred after 5c = `file`(field) /
  `table`. **5d graduates `table` (the LAST) → still `phase 5`; delete
  `table`'s placeholder + retarget the remaining asserts to `field(file)`.**
- **Zero new deps** — `package.json`/`package-lock.json`/`tui-cli.ts`
  UNCHANGED (Phase-4/5a shape, NOT 3/5b). Byte gate held (project-references;
  `tui.tsx`-only change). **113 vitest** (105→113, +8) + core-globals green;
  web-bundle Vite hashes unchanged (`index-UzlLPlgm.css` +
  `index-B7l5XdRz.js`). **PTY 9/9** vs an ephemeral /tmp modal fixture (GET
  returns an OPEN modal — deterministic, no nav: footer `Close`→{close},
  `dismissAction` {dismiss}; action endpoint echoes `CLOSED=<which>`):
  footer-Close round-trip (`CLOSED=close`), Esc-dismiss round-trip
  (`CLOSED=dismiss`), Ctrl-C-while-modal-open→130+ESC[?25h, SIGINT→130,
  SIGTERM→143, piped→0 (modal inline), unreachable→1, no-arg→2, bad-url→2;
  cursor restored every exit.
- **Phase 5c blast radius (VCS-verified).** `git status` = ONLY
  `src/tui.tsx`, `test/tui.test.ts` (+ `.planning/*` in commit). 6 core
  dist hashes byte-identical to `/tmp/vms-baseline.txt`; fixture + PTY
  harness in `/tmp` (never committed). For 5d (`table`): contained-render +
  ephemeral-fixture-PTY patterns hold; table adds Unicode-width column
  solving (the flat-`<Text>`-per-cell discipline applies) + sortable-header
  / filter-row / clickable-row Enter — the ICRNL harness fix above is
  MANDATORY for that Enter-driven live proof.

## Phase 5d learnings (final node phase — read before Phase 6)

- **Link-cell = plain underlined `linkLabel`, NO OSC 8 (plan DEVIATION,
  load-bearing).** The plan said "table link cell = OSC 8 as sole child of
  its own fixed-width Box+truncate" — that is WRONG: the cell box HAS a fixed
  width (column alignment), so `wrap:"truncate-end"` fires, and string-width
  over-counts the OSC 8 escape → the hyperlink is truncate-mangled (the
  Phase-1/5a width landmine is fundamentally incompatible with a fixed column
  width). Fix: render `col.linkLabel` as underlined TEXT (information-honest,
  aligned). Standalone `link` nodes keep full OSC 8 (their Box is
  content-sized, not width-bounded — that's why Phase-1's discipline works
  THERE and not here). Do NOT re-add OSC 8 to table cells.
- **`editing` gate EXTENDED to `kind==="table-filter"` (plan DEVIATION,
  load-bearing).** The plan asserted the filter input could stay a
  contained component with App in ring mode (kind≠field ⇒ gate untouched).
  WRONG: in ring mode App maps Left/Right→goPrev/goNext and Down/Right→focus
  jump, colliding with the text editor's cursor mid-type. Correct fix: the
  `editing` predicate gained `|| focusedDesc?.kind==="table-filter"`; the
  `field` disjunct is byte-identical (zero field/form behavior change — every
  existing field/draft test unmodified). The EXISTING editing branch (only
  Tab/Shift-Tab act; Enter inert in App; ink-text-input owns
  char/Left/Right + fires onSubmit) is exactly right for the filter. NO new
  input hook ⇒ `tui-cli.ts` UNCHANGED ⇒ teardown safe by construction
  (PTY-verified incl. Ctrl-C while a filter is focused).
- **Dual focus identity for a sortable+filterable column.** The `TableColumn`
  object is the header's focus identity (`map.set(col,k)`); the filter input
  needs a DISTINCT one → a module-level `filterIdent` WeakMap(col→sentinel),
  same sentinel in collectFocusables and the renderer within one render; a
  fresh col object each server re-render → new sentinel (continuity is
  key-string + reconcile(), never object identity). A `case "table"` in
  collectFocusables was REQUIRED (the 5c modal lesson) or the ring is empty.
  Order = sortable headers L→R, filter inputs L→R, action rows T→B (browser
  DOM order). Keys via uniq() keep multi-table global uniqueness.
- **Draft set GENERALIZED, not duplicated.** `fieldDescs`→`draftableDescs`
  (`field` + `table-filter`); `serverValOf` branches (filter server value =
  `col.filterValue`); `selectKeysNow` re-narrowed to `kind==="field" &&
  isSelect`. Field path byte-identical (purely additive). Filter draft = the
  TEXT rule (survives a local rerender; server-wins when `filterValue`
  changes) — NOT the select inverse. `tableFilter()` builds `filters` over
  EVERY filterable column (draft else `filterValue`), `value`=this column's,
  `column`=col.key, base `filterAction.context` merged — exact browser.ts
  (599-667) parity for sort/filter/row(verbatim)/linkLabel.
- **Phase-5 rule held: fail-loud string STILL `phase 5`** (5d did NOT bump —
  single-sourced `unsupported()` unchanged). `table`'s `[unsupported]`
  deleted (real `case "table"`); the 3 table asserts (test "B" /
  deferred-list / "string is now phase 5") retargeted to `field(file)` — the
  LAST still-deferred type. **No node phases remain after 5d**; `file` is
  permanently out of scope (browser/XHR upload).
- **Live proof split (the 5a/5b/5c pattern, reaffirmed).** Real shipped
  backend = render-over-real-wire ONLY: `ExpenseTracker-bun /api/expenses`
  (a real seeded 4-col ledger `table`; non-TTY exit 0). HelpDesk-bun
  `/api/agent`'s queue table is NOT a good live vehicle — a fresh
  `HELPDESK_DB` shows "No tickets in queue." (no seed-on-empty; tickets come
  from the requester flow), and its ring has 4 `tabs` BEFORE the rows
  (brittle — don't fight it). ALL interaction round-trips + teardown via the
  EPHEMERAL `demo/Tasks-bun/_fixture.ts` (`createAction` echo; THREE GET
  paths `/api/{sort,filter,row}` so each scenario's target is the FIRST
  focusable → no Tab-pacing). Created+removed in-run, NEVER committed (the
  commit step asserts `git status` clean of it). **PTY 15/15**: sort
  asc→desc toggle, filter `{column,value,filters over all filterable}`, row
  verbatim `{id}`, Ctrl-C/SIGINT→130, SIGTERM→143, piped→0, unreachable→1,
  no-arg/bad-url→2, cursor restored (`ESC[?25h`) every exit. **ICRNL
  termios fix MANDATORY** (every Enter scenario) — proven again.
- **Phase 5d blast radius (VCS-verified).** `git status` = ONLY
  `src/tui.tsx`, `test/tui.test.ts` (+ `.planning/*` in commit). NO
  `package.json`/`package-lock.json` change — **ZERO new deps**
  (`ink-text-input` is a Phase-3 dep; Phase-4/5a/5c shape, NOT 3/5b).
  `tui-cli.ts` UNTOUCHED. 6 core dist hashes byte-identical to
  `/tmp/vms-baseline.txt`; web-bundle Vite hashes unchanged
  (`index-UzlLPlgm.css` + `index-B7l5XdRz.js` — a broad `createElement`
  grep is a KNOWN false positive: it's the framework's own DOM code; the
  real oracle is the unchanged content-hash filename + a narrow
  ink/react/yoga grep). **121 vitest** (113→121, +8 Phase-5d) +
  core-globals green.

## Phase 6 learnings (TUI effort COMPLETE — terminal phase, no successor)

- **Conformance env conflict is real and unavoidable in one file.**
  BrowserAdapter uses the GLOBAL `document`/`window` ~62× and does NOT accept
  an injected doc ⇒ it needs the jsdom vitest env; Ink/ink-testing-library
  need the node env (the `tui.test.ts` docblock). They cannot coexist in one
  file. Solution = a SHARED `test/conformance-fixtures.ts` (`{name,vm,expect,
  ordered?}[]`) asserted by TWO env-appropriate files:
  `conformance.browser.test.ts` (default jsdom, mirrors theme-modifiers.test.ts
  `freshContainer`) and `conformance.tui.test.ts` (`// @vitest-environment
  node`, mirrors tui.test.ts `render(...renderTree).lastFrame()`). Same
  fixtures + same declared info satisfied INDEPENDENTLY by both = info parity
  (not bytes). 22/22 first run — the design was right; don't merge the files.
- **"Information, not bytes" scoping (load-bearing).** Compare only TEXTUAL
  info. Visual-only signals are DELIBERATELY out of scope (presentation, and
  already covered elsewhere): progress fill / checkbox glyph → tui.test.ts;
  layout/density/variant classes → theme-modifiers.test.ts; link href →
  adapter-internal. Browser "info" = `textContent` PLUS `input/textarea.value`
  + `placeholder` + selected `<option>` + `a[href]` — a field VALUE lives in
  `input.value`, NOT textContent (miss this → false fail on the form fixture).
  Tokens MUST be SHORT single distinct words: the tui half renders `renderTree`
  via ink-testing-library at Ink's default 80 cols where long phrases WRAP
  (the Phase-1 non-TTY landmine) and split substring matches.
- **conformance.tui SGR/OSC-8 strip — control bytes in the regex literal are
  CORRECT, don't "fix" them.** Typing ``/`` in file content gets
  collapsed by the write pipeline into LITERAL ESC/BEL bytes; `cat -A` shows
  `/^[?\[[0-9;]*m/g` and `/^[?\]8;;[^^G]*^G/g`. A JS regex literal MAY contain
  literal control bytes and matches them; the OSC-8 pattern is BOUNDED at BEL
  (`[^^G]*^G`) so it can NEVER swallow the frame (an early greedy `[^]*` draft
  WOULD have — rejected). Verified with `node -e` (`"…Oscar…Echo…" → "Oscar
  Echo"`). If you must touch it: re-verify via `cat -A` + a `node -e` strip
  sanity; never retype `` expecting text. Presence asserts pass even if
  the strip no-ops (labels are written literally into the frame anyway).
- **Byte-identity held trivially (confirms the Phase-3/5b model).** Phase 6
  compiles ZERO changed src — only docs, 3 NEW test files, and `package.json`
  `version`. `npm pkg set version=0.4.3` + `npm install` ALSO reordered
  `devDependencies` alphabetically (npm normalization — benign, committed).
  6 core dist files byte-identical to `/tmp/vms-baseline.txt`. A package.json
  change never feeds the core compile (project references) — reproven.
- **Web-bundle oracle reaffirmed:** post-Phase-6 `bun run build` of
  `demo/Tasks-fullstack-bun` emits the SAME `index-UzlLPlgm.css` +
  `index-B7l5XdRz.js` content hashes ⇒ no ink/react leak by construction (the
  authoritative oracle; the narrow `yoga-layout|react-reconciler|"ink"` grep
  is secondary, and a broad `createElement` grep is a KNOWN false positive).
- **Versioning model applied.** npm `0.4.2 → 0.4.3` (PATCH, client-only,
  additive); NuGet UNCHANGED `0.4.2`; shared major.minor `0.4` preserved —
  the documented model + the `0.4.1` npm-only-patch precedent. NOT `0.5.0`
  (a SemVer-minor would break the shared-major.minor alignment). **CHANGELOG
  is newest-first** (insert right after the top `---`, before `## 0.4.2`).
  **MIGRATION is ALSO newest-first** (`## Upgrading to 0.4.0` at L9,
  `## Upgrading to npm 0.3.13` at L115 — newest at TOP, before 0.4.0; 0.4.1/
  0.4.2 have NO section because nothing to do — a brand-new public surface
  still warrants a "Nothing to do" stub). `npm publish` is NEVER automated —
  prepared here, run manually by the owner.
- **V6 scoped by construction (plan + NOTES sanctioned).** `tui.tsx` &
  `tui-cli.ts` are byte-unchanged vs HEAD ⇒ the Phase-5d PTY matrix (15/15)
  holds by construction — the exact rule reused in Phases 1/4/5a/5c. Live
  proof = NON-TTY render over REAL bun `Tasks-fullstack-bun` HTTP (`node
  dist/tui-cli.js http://localhost:3000/api/tasks | cat` → exit 0, `Views`
  present); the shipped 0.4.3 `dist` works end-to-end. No full PTY matrix run
  (no input/teardown code changed). Foreground-kill of the harness-tracked
  backend exits **144** = expected (the documented landmine), not a failure.
- **Phase 6 blast radius (VCS-verified).** `git status` (in the commit) =
  ONLY: `viewmodel-shell/README.md`, `AGENTS.md`, `CHANGELOG.md`,
  `MIGRATION.md`, `viewmodel-shell/package.json` + `package-lock.json`
  (version + dep reorder), 3 NEW `viewmodel-shell/test/conformance*.ts`,
  `.planning/TUI-ROADMAP.md` (STATUS), `.planning/TUI-NOTES.md`. **NO `src/`
  change.** 6 core dist byte-identical; web-bundle hashes unchanged;
  **143 vitest** (121→143, +22 conformance) + core-globals green. The TUI
  effort is COMPLETE: no further phases, no rewind.

## Post-0.4.3 hotfix — npm 0.4.4 (non-TTY raw-mode crash)

- **Ink `isRawModeSupported` is `true | undefined`, NEVER `false`
  (LOAD-BEARING; the canonical "read the dep's source, the obvious fix is
  wrong" case).** `node_modules/ink/build/components/App.js:35`:
  `isRawModeSupported() { return this.props.stdin.isTTY }` → on a non-TTY
  stdin (pipe / `</dev/null` / CI / agent) that is **`undefined`**, not
  `false`. `node_modules/ink/build/hooks/use-input.js:33`: useInput skips
  raw mode ONLY `if (options.isActive === false)` — a STRICT `=== false`.
  So `{ isActive: undefined }` is NOT skipped → Ink `setRawMode(true)` →
  `App.js:108` throws `Raw mode is not supported` → a react-reconciler
  error frame on the non-TTY path. The App's gate was ALREADY
  `{ isActive: interactive }` with `interactive = isRawModeSupported`, so
  it passed `undefined` and crashed anyway. **Fix = strict-boolean coercion
  at the source: `const interactive = isRawModeSupported === true;`
  (tui.tsx).** The bug-reporter's proposed
  `useInput(h,{isActive:isRawModeSupported})` would NOT have fixed it
  (same `undefined`). Instrument/read source — do not trust the obvious fix.
- **CLI `nonInteractive = !process.stdout.isTTY || !process.stdin.isTTY`
  (stdin too).** After the isActive fix, App's useInput is correctly inert
  on non-TTY stdin → nothing holds the event loop. If stdout were a TTY but
  stdin a pipe (`vms-tui url </dev/null` from an interactive shell), a
  stdout-only guard falls through to keep-alive + `waitUntilExit()` and
  HANGS forever. Both `!process.stdout.isTTY` sites (handleRedirect + the
  run-body static guard) now use the `nonInteractive` const.
- **Optional deps are NOT transitive.** `tui.tsx` statically imports
  `ink-text-input` + `ink-select-input` too, so the missing-deps hint must
  list all four (`npm i ink react ink-text-input ink-select-input`), and
  the README must say programmatic / `bun install` consumers add all four
  explicitly (npm pulls optionalDependencies for `npx`, but they are not
  fetched transitively when another project depends on the package).
- **PTY-harness gotcha (NEW; same class as the ICRNL discovery — the
  harness lied, not the code).** On a pty *master*, child exit surfaces as
  `OSError(EIO)` (or an empty read) — that IS the exit signal. A drain loop
  that `break`s on `OSError` and then `SIGKILL`s before a blocking
  `waitpid` reports a false **"HANG"** even though the buffer already
  contains `^C` + `ESC[?25h` (teardown DID run). Correct recipe: drain to
  EOF (EIO/empty), THEN blocking `os.waitpid(pid,0)` for the real status,
  THEN evaluate exit code + cursor-restore. Cost two wrong "still broken"
  reads before fixing the harness.
- **Verification (0.4.4).** Byte-identity core 6/6 (fix is leaf
  `tui.tsx`/`tui-cli.ts` only — core dist UNCHANGED; invariant 5 holds —
  tui *behavior* legitimately changes, that is the bugfix). **143 vitest**
  green (ink-testing-library `isRawModeSupported===true` ⇒ `=== true` ⇒
  `true` ⇒ every interaction test unchanged — no test edits needed).
  PTY **3/3** (Ctrl-C→130, SIGINT→130, SIGTERM→143, cursor restored every
  exit) — proves a real pty's `stdin.isTTY===true` ⇒ `interactive` true ⇒
  useInput stays ACTIVE ⇒ teardown topology fully preserved. non-TTY
  **5/5** (`</dev/null`→0, `| cat`→0, unreachable→1, no-arg→2, bad-url→2).
  Web-bundle Vite hashes unchanged (`index-UzlLPlgm.css` +
  `index-B7l5XdRz.js`). Shipped npm **`0.4.4`** PATCH (client-only bugfix;
  NuGet UNCHANGED `0.4.2`; major.minor `0.4`). Commit is `fix(tui): …`
  (NOT a phase — the `feat(tui): Phase` ledger intentionally does not match
  it; the ROADMAP STATUS records the hotfix instead).

## 0.4.5 — terminal full-viewport + alternate screen

- **Ink does NOT size its root to the terminal (the reporter was right).**
  Ink uses `stdout.columns` only as a TEXT-WRAP bound; a `<Box>` with no
  width is content-sized, so `flexGrow` children (e.g. `layout:"sidebar"`
  main) have no space to grow → "small box in the corner". Fix: wrap App's
  interactive return in `<Box width={cols} height={rows}>` + alt-screen.
  This is adapter medium-adaptation — the terminal analog of BrowserAdapter
  filling the viewport via CSS — NOT a wire concern. A `page` wire field was
  offered and DECLINED: it would force NuGet/parity/all-backend churn for a
  terminal-only presentation flag (wrong layer; appearance≠arrangement).
- **Gate on the REAL `process.stdout.isTTY && process.stdin.isTTY`, NOT
  Ink's `isRawModeSupported`.** ink-testing-library forces
  `isRawModeSupported` true AND its fake Stdout has `isTTY=true` — neither
  distinguishes test from prod. The real `process.stdout.isTTY` is false
  under vitest ⇒ gate off ⇒ all existing App + conformance frames
  byte-identical BY CONSTRUCTION (renderTree never reaches the wrap). Same
  "not a real interactive TTY ⇒ static" invariant every phase relied on.
- **ink-testing-library fake Stdout:** `columns` getter = 100 (fixed), **NO
  `rows`**, `isTTY=true`, EventEmitter. `render()` returns `.stdout` (the
  instance) → `Object.defineProperty(r.stdout,'columns'|'rows',{get})` +
  `r.stdout.emit('resize')` simulates a resize. `rows` absent ⇒ height auto
  until you install a getter.
- **Ink trims trailing whitespace per line ⇒ frame WIDTH is NOT
  unit-observable** (a wider parent Box → same trailing-trimmed width when
  children don't stretch). **Height IS: Ink emits blank lines for a fixed
  `height`** (probed: `<Box height=20>` → 20 lines, maxWidth=2). Assert
  LINE-COUNT, not width, for "fills the viewport". (Two red tests on the
  width approach first — instrument/probe, don't guess. Again.)
- **Alt-screen lifecycle (teardown-critical, ZERO tui-cli.ts change).**
  ENTER `ESC[?1049h` in `render()` first-mount, BEFORE `inkRender`, gated
  (realTTY && viewport!=="content" && !altEntered). LEAVE `ESC[?1049l` in
  `dispose()` AFTER `instance.unmount()`, idempotent (`altEntered` +
  `disposed` guards). `dispose()` is the CLI's single funnel (shutdown /
  SIGINT / SIGTERM / uncaught / unhandledRejection / process 'exit' all call
  it) ⇒ restore on EVERY exit incl. crash, with tui-cli.ts UNTOUCHED.
  Non-TTY never enters ⇒ never leaves ⇒ 0.4.4 static one-shot stays
  byte-clean (no escape emitted). PTY harness extended to assert
  `?1049h`+`?1049l` presence per exit (mandatory for any alt-screen change;
  reuse the 0.4.4 drain-to-EOF-then-blocking-waitpid recipe).
- **`viewport` option = the FIRST TuiAdapter constructor** (there was none).
  `new TuiAdapter({ viewport?: "fill" | "content" })` default `"fill"`;
  existing `new TuiAdapter()` unchanged (non-breaking); threaded as an
  `<App viewport>` prop.
- **Verification (0.4.5).** Byte-identity core 6/6 (leaf-only: `tui.tsx` +
  the test). **146 vitest** (143→146, +3 viewport). core-globals; web-bundle
  hashes unchanged. **Extended PTY 3/3**: Ctrl-C→130 / SIGINT→130 /
  SIGTERM→143, each `altEnter=altLeave=cursor=True`. Non-TTY
  `</dev/null`/`|cat` emit NO `?1049[hl]`, exit 0; unreachable→1, no-arg→2,
  bad-url→2. **tui-cli.ts UNCHANGED.** Shipped npm `0.4.5` PATCH
  (client-only feature; NuGet untouched `0.4.2`); commit `feat(tui): …`.

## 0.4.6 — viewport fill must reach the content (0.4.5 follow-up)

- **0.4.5's terminal-sized root did NOT propagate to content (4th report,
  correct).** Ink/Yoga `align-stretch` does NOT reliably fill a nested
  content column in this tree. PROBED (instrument, don't guess — 2 probes
  pinned it): the basic root→page→sidebar-row chain DOES fill at 120 in
  isolation, but a card `section` inside the pane's inner content column
  stays content-sized (36 @ root 120) — the break is the **pane content
  wrapper**. **Minimal proven lever: explicit `width:"100%"` on the
  layout-spine content wrappers** (page container `+flexGrow:1`;
  layoutContainer split/sidebar/stack outer; sidebar main inner column;
  split per-pane inner `width:"100%"` column wrap). `section` needs NO
  change (it stretches once its parent column is width:100%). Gated on a
  new `RCtx.fill` (=fillViewport; `NO_CTX`/static/non-TTY = false ⇒
  byte-identical). `cards` DELIBERATELY excluded — a uniform small-tile
  grid by design; filling it defeats the preset.
- **process.std*.isTTY test isolation — 3rd time bitten, now solved
  properly.** A per-call capture/restore of `process.stdout/stdin.isTTY`
  is ORDER-FRAGILE: a prior test's restore left isTTY truthy → a later
  "non-TTY" test rendered filled (false `100`-vs-`30`). FIX pattern (reuse
  for ANY global-process-attr toggling test): capture the real descriptors
  ONCE at describe collection, HARD-restore to that baseline in `afterEach`,
  and have each test set the flag EXPLICITLY (true/false) — never rely on
  ambient/order.
- **Width observability (carried 0.4.5 fact, reaffirmed).** Ink trims
  trailing whitespace, so a filled pane's width is observable in
  `lastFrame()` ONLY when a full-width border is drawn ⇒ the 0.4.6
  width-scale unit test uses `section variant:"card"`. Plain borderless
  panes fill correctly but won't *show* width via lastFrame — measurement
  constraint, not a bug; use card sections or the PTY to observe.
- **Verification (0.4.6).** Core dist byte-identical 6/6 (leaf `tui.tsx` +
  test only). **147 vitest** (146→147, +1 width-scale; the 3 0.4.5
  viewport tests + 143 unchanged — fill gate off ⇒ byte-stable). core-
  globals; web-bundle Vite hashes unchanged. **PTY** (ephemeral sidebar
  card-rail+detail fixture — NOTES pattern, created+removed in-run, never
  committed): content width SCALES with winsize (cols 100 vs 160 differ,
  track terminal — was constant pre-fix) AND alt-screen enter/leave +
  Ctrl-C→130 + cursor restored at BOTH sizes; non-TTY `</dev/null` emits
  no `?1049[hl]`, exit 0. **tui-cli.ts UNCHANGED** (render-only; teardown
  rides the existing dispose funnel). Shipped npm `0.4.6` PATCH
  (client-only; NuGet untouched `0.4.2`); commit `fix(tui): …`.

## 0.4.7 — fill must reach section-wrapped content (0.4.5/0.4.6 completion)

- **0.4.6's `width:"100%"` strategy was fundamentally fragile.** It resolves
  against an uncertain parent and CONTENT-falls-back when a `flexShrink:0`
  fixed-basis rail is present; `flexGrow` does not distribute past such a
  rail. The reporter's proposed "add width:100% to `case section`" was
  DISPROVEN on the real path. REWORK = **explicit numeric-width threading**
  via `RCtx.fillCols` (terminal cols when filling; undefined otherwise).
- **Hand-built Ink probes LIED every single time** (≥4 rounds). The ONLY
  trustworthy oracle is the REAL adapter: `render(new
  TuiAdapter().createApp(vm,…))` under ink-testing-library with forced
  `process.std*.isTTY` + a `columns` getter override + `emit("resize")`,
  measuring `widthOf(lastFrame)` at two widths. ALWAYS iterate layout fixes
  against the real renderNode, never an approximation. (Built into
  `test/tui.test.ts` as the 0.4.7 multi-preset scaling test.)
- **The oracle-proven lever map:** (1) page container + the page's TOP
  `layoutContainer` get an explicit NUMERIC `width` (= cols). (2) NESTED
  `layoutContainer` (a section's own children) gets NO width — a global
  numeric cols there overflows a narrower pane; it fills via align-stretch
  from the now-numeric ancestors (proven: a top-level card scales via pure
  align-stretch). (3) sidebar = fixed numeric rail (24) + main pane =
  `Math.max(1, cols-24-gap)` as a SINGLE numeric-width column directly
  holding the detail sections — an extra auto-width wrapper between the
  sized pane and the section BREAKS the align-stretch chain (oracle: card
  detail stuck at 38 until the wrapper was collapsed). (4) single-child
  sidebar needs `flexDirection:"column"` so the lone section
  width-stretches (a default-row box won't). (5) `cards` NEVER gets numeric
  width — uniform small-tile grid by design (oracle: stays ~37 at 80 & 160).
- **Measurement landmine reaffirmed:** Ink trims trailing whitespace, so
  ONLY bordered (`variant:"card"`) content reveals width. A plain section
  looks unchanged even when correctly filled — do NOT conclude "broken"
  from a plain-section measurement (it cost a wrong diagnosis here). Use
  card sections or the PTY to observe.
- **Stray-temp-test hygiene (NEW):** a leftover `test/_probe.test.ts` with
  a print-via-assertion hack false-failed the whole suite once. Any
  `_probe`/`_real`/`_fix` scratch file in `test/` or a demo dir MUST be
  removed before the gate; the commit step greps for `_probe|_real|_fix`.
- All gated on `rctx.fillCols` (undefined ⇒ no width prop ⇒ byte-identical
  static/non-TTY). **tui-cli.ts UNCHANGED** ⇒ teardown safe by construction
  (PTY re-verified anyway). **Verification:** core dist byte-identical 6/6;
  **148 vitest** (replaced the misleading 0.4.6 width test with a
  real-adapter multi-preset scaling + cards-bounded test; 143 + 3 0.4.5 +
  conformance unchanged); core-globals; web-bundle hashes unchanged. PTY
  (ephemeral reporter-shape fixture: `page sidebar density:compact`,
  `section card` rail + detail): content SCALES 100→160, alt-screen
  enter/leave + Ctrl-C→130 + cursor restored, non-TTY no `?1049[hl]`.
  Shipped npm `0.4.7` PATCH (client-only; NuGet untouched `0.4.2`); commit
  `fix(tui): …`.
