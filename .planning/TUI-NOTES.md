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
