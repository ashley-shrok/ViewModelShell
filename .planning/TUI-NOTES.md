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
