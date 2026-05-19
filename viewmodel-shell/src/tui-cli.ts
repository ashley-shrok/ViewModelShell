#!/usr/bin/env node
// vms-tui — drive any ViewModel Shell backend from a terminal.
//
//   vms-tui <endpoint-url>
//   e.g.  vms-tui http://localhost:3000/api/tasks
//
// Convention: actions POST to `<endpoint>/action` (matches the demos:
// GET /api/tasks  +  POST /api/tasks/action). A future flag can override it.
//
// Pure entrypoint — never imported as a library (the importable surface is
// TuiAdapter via the "./tui" export), so no import.meta.main guard is needed.

import { ViewModelShell } from "./index.js";

const USAGE =
  "Usage: vms-tui <endpoint-url>\n" +
  "  e.g.  vms-tui http://localhost:3000/api/tasks\n" +
  "  Actions POST to <endpoint>/action.";

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function main(): Promise<void> {
  const arg = process.argv[2];

  if (!arg || arg === "-h" || arg === "--help") {
    process.stderr.write(USAGE + "\n");
    process.exitCode = arg ? 0 : 2;
    return;
  }

  try {
    // Validate; rejects garbage early instead of failing deep in fetch.
    void new URL(arg);
  } catch {
    process.stderr.write(`vms-tui: invalid URL: ${arg}\n${USAGE}\n`);
    process.exitCode = 2;
    return;
  }

  const endpoint = arg;
  const actionEndpoint = `${endpoint.replace(/\/+$/, "")}/action`;

  // Guarded dynamic import: if the optional `ink`/`react` deps are absent,
  // fail loud with an install hint instead of an ESM resolution stack trace.
  let TuiAdapter: typeof import("./tui.js").TuiAdapter;
  try {
    ({ TuiAdapter } = await import("./tui.js"));
  } catch (err) {
    process.stderr.write(
      "vms-tui requires the optional 'ink' and 'react' packages.\n" +
        "Install them:  npm i ink react\n" +
        `(load error: ${(err as Error).message})\n`,
    );
    process.exitCode = 1;
    return;
  }

  const adapter = new TuiAdapter();
  let loadFailed = false;
  let exiting = false;

  // Single, idempotent teardown owned by the CLI.
  //
  // Ink registers `signal-exit` and resolving its waitUntilExit() promise
  // (which adapter.dispose() → Ink unmount does) lets main()'s tail resume.
  // Without the `exiting` guard that tail would set process.exitCode = 0 and
  // race the real signal code away (observed: SIGINT exited 0, not 130).
  // So: set the code FIRST, restore the terminal, then exit — and let the
  // first caller win; any later caller (incl. the resumed await-tail) no-ops.
  const shutdown = (code: number): void => {
    if (exiting) return;
    exiting = true;
    process.exitCode = code;
    try {
      adapter.dispose(); // Ink unmount → cursor/raw-mode restored
    } catch {
      /* best-effort, idempotent */
    }
    process.exit(code);
  };

  process.once("SIGINT", () => shutdown(130));
  process.once("SIGTERM", () => shutdown(143));
  process.once("uncaughtException", (err) => {
    try {
      adapter.dispose(); // restore BEFORE printing so the message is readable
    } catch {
      /* idempotent */
    }
    process.stderr.write(`vms-tui: ${(err as Error)?.stack ?? String(err)}\n`);
    shutdown(1);
  });
  process.once("unhandledRejection", (reason) => {
    try {
      adapter.dispose();
    } catch {
      /* idempotent */
    }
    process.stderr.write(`vms-tui: ${String(reason)}\n`);
    shutdown(1);
  });
  // Final safety net: any other exit path still restores the terminal.
  process.once("exit", () => {
    try {
      adapter.dispose();
    } catch {
      /* idempotent */
    }
  });

  // Phase 2: the adapter now uses Ink input hooks → Ink puts stdin in raw
  // mode, which clears ISIG, so a *keyboard* Ctrl-C is delivered as input
  // byte 0x03 and never raises SIGINT (the process.once("SIGINT") above only
  // fires for a *programmatic* kill -INT). Route that keyboard Ctrl-C, caught
  // in the adapter's input handler, into this same idempotent shutdown so the
  // terminal is always restored. SIGTERM and programmatic SIGINT are
  // unaffected by raw mode and keep working via the handlers above. (The
  // keep-alive below is now redundant on the TTY path — Ink's resumed raw
  // stdin holds the loop — but is harmless and kept as belt-and-suspenders.)
  adapter.setRequestExit((code) => shutdown(code));

  const shell = new ViewModelShell({
    endpoint,
    actionEndpoint,
    adapter,
    onError: (err) => {
      loadFailed = true;
      // A stderr line guarantees visibility even before the first render.
      process.stderr.write(`vms-tui: ${err.message}\n`);
    },
  });

  try {
    await shell.load();
  } catch (err) {
    loadFailed = true;
    process.stderr.write(`vms-tui: ${(err as Error).message}\n`);
  }

  if (!process.stdout.isTTY) {
    // Non-TTY (piped / CI): Phase 0 has nothing to interact with — emit one
    // static frame and exit instead of hanging waiting for a Ctrl-C that can
    // never come. The delay lets Ink flush its throttled render.
    await delay(80);
    return shutdown(loadFailed ? 1 : 0);
  }

  // Load/connection failure → nothing rendered; exit now rather than wait for
  // a Ctrl-C the user has no reason to send.
  if (loadFailed) {
    return shutdown(1);
  }

  // TTY + rendered: keep the frame up until the user quits (Ctrl-C). Phase 0's
  // tree has no input hooks (useInput/useFocus arrive in Phase 2), so Ink does
  // NOT hold the event loop open — without an active handle Node finds the loop
  // empty and exits (code 0) the instant load() returns, before any signal can
  // arrive. Hold the loop ourselves with a no-op timer; the SIGINT/SIGTERM
  // handlers own the actual exit + terminal restore. (waitUntilExit() still
  // wins the race if Ink unmounts for another reason, e.g. future phases.)
  const keepAlive = setInterval(() => {}, 1 << 30);
  await adapter.waitUntilExit();
  clearInterval(keepAlive);
  shutdown(0);
}

void main();
