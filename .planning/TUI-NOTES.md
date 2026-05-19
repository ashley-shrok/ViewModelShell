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
