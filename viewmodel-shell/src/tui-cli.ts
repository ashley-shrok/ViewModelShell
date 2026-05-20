#!/usr/bin/env node
// vms-tui — drive any ViewModel Shell backend from a terminal.
//
//   bunx vms-tui <endpoint-url>
//   e.g.  bunx vms-tui http://localhost:3000/api/tasks
//
// Convention: actions POST to `<endpoint>/action` (matches the demos:
// GET /api/tasks  +  POST /api/tasks/action).
//
// Runtime requirement (0.6.0+): Bun. The shebang above is Node so that an
// accidental `npx vms-tui …` prints a clear "needs Bun" message instead of
// crashing inside an FFI-laden OpenTUI import. Under `bunx`, `typeof Bun`
// is defined and the script proceeds normally.

declare const Bun: unknown;

// Type-only import so we can annotate `currentShell` without forcing a
// top-level eager value-import of the framework core (it stays a dynamic
// import inside main() to keep the Bun guard above as the first effect).
type ViewModelShellInstance = import("./index.js").ViewModelShell;

const USAGE =
  "Usage: vms-tui <endpoint-url>\n" +
  "  e.g.  bunx vms-tui http://localhost:3000/api/tasks\n" +
  "  Actions POST to <endpoint>/action.\n" +
  "  Requires Bun runtime: https://bun.sh/install";

// ── Bun runtime guard ─────────────────────────────────────────────────────
// vms-tui's TUI substrate (OpenTUI) uses Bun's FFI APIs and is not yet
// Node-compatible. Failing fast with a clear message here beats a confusing
// ESM resolution stack trace deeper in the import chain.
if (typeof Bun === "undefined") {
  process.stderr.write(
    "vms-tui requires the Bun runtime.\n" +
      "  Install:   curl -fsSL https://bun.sh/install | bash\n" +
      "  Then run:  bunx vms-tui <endpoint-url>\n" +
      "(see https://bun.sh for other installers)\n",
  );
  process.exit(1);
}

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
    void new URL(arg);
  } catch {
    process.stderr.write(`vms-tui: invalid URL: ${arg}\n${USAGE}\n`);
    process.exitCode = 2;
    return;
  }

  const endpoint = arg;

  // Dynamic import — under Bun, this resolves to the OpenTUI-backed adapter.
  // Under Node we'd never get here (the Bun guard above exits first).
  let TuiAdapter: typeof import("./tui.js").TuiAdapter;
  try {
    ({ TuiAdapter } = await import("./tui.js"));
  } catch (err) {
    process.stderr.write(
      "vms-tui: failed to load the TUI adapter — make sure '@opentui/core' " +
        "and '@opentui/react' are installed.\n" +
        "  bun install @opentui/core @opentui/react react\n" +
        `(load error: ${(err as Error).message})\n`,
    );
    process.exitCode = 1;
    return;
  }

  // Dynamically import ViewModelShell (the framework core; not Bun-specific)
  // alongside, to keep the import topology clean.
  const { ViewModelShell } = await import("./index.js");

  const adapter = new TuiAdapter();

  let loadFailed = false;
  let exiting = false;

  const shutdown = (code: number): void => {
    if (exiting) return;
    exiting = true;
    process.exitCode = code;
    try { adapter.dispose(); } catch { /* idempotent */ }
    process.exit(code);
  };

  process.once("SIGINT", () => shutdown(130));
  process.once("SIGTERM", () => shutdown(143));
  process.once("uncaughtException", (err) => {
    try { adapter.dispose(); } catch { /* idempotent */ }
    process.stderr.write(`vms-tui: ${(err as Error)?.stack ?? String(err)}\n`);
    shutdown(1);
  });
  process.once("unhandledRejection", (reason) => {
    try { adapter.dispose(); } catch { /* idempotent */ }
    process.stderr.write(`vms-tui: ${String(reason)}\n`);
    shutdown(1);
  });
  process.once("exit", () => {
    try { adapter.dispose(); } catch { /* idempotent */ }
  });

  // Non-interactive: render one frame, then exit. Either stream not being a
  // TTY is the signal — a stdout TTY with a piped stdin would hang forever
  // (no input can ever arrive), so we check both.
  const nonInteractive = !process.stdout.isTTY || !process.stdin.isTTY;

  // ── Redirect handling (B1: minimal) ────────────────────────────────────
  // Same-origin: rebuild the shell against the new endpoint and reload, so
  // the polling/state cycle continues seamlessly. Different-origin or
  // invalid: delegate to adapter.navigate (which spawns xdg-open / open
  // / start), or, on non-TTY, print a loud stderr line. B5 will re-add
  // the in-app interstitial UX the Ink CLI had.
  let currentShell: ViewModelShellInstance;

  const handleRedirect = (url: string, fromEndpoint: string): void => {
    const c = classifyRedirect(url, fromEndpoint);
    if (c.kind === "same-origin") {
      currentShell.stopPolling();
      currentShell = connect(c.endpoint);
      void currentShell.load();
      return;
    }
    if (nonInteractive) {
      process.stderr.write(`vms-tui: cannot follow redirect (${c.kind}): ${url}\n`);
      loadFailed = true;
      return;
    }
    if (c.kind === "different-origin") {
      adapter.navigate(c.url);
    } else {
      process.stderr.write(`vms-tui: invalid redirect URL: ${JSON.stringify(url)}\n`);
    }
  };

  const connect = (ep: string): ViewModelShellInstance =>
    new ViewModelShell({
      endpoint: ep,
      actionEndpoint: `${ep.replace(/\/+$/, "")}/action`,
      adapter,
      onError: (err) => {
        loadFailed = true;
        process.stderr.write(`vms-tui: ${err.message}\n`);
      },
      onRedirect: (url) => handleRedirect(url, ep),
    });

  currentShell = connect(endpoint);

  try {
    await currentShell.load();
  } catch (err) {
    loadFailed = true;
    process.stderr.write(`vms-tui: ${(err as Error).message}\n`);
  }

  if (nonInteractive) {
    // Let OpenTUI's renderer flush one frame, then exit. 100ms is generous;
    // OpenTUI's render pipeline is microtask-fast.
    await delay(100);
    return shutdown(loadFailed ? 1 : 0);
  }

  if (loadFailed) {
    return shutdown(1);
  }

  // TTY + rendered: keep the frame up until the user quits (Ctrl-C / SIGTERM).
  // OpenTUI's renderer owns the keep-alive (its async event loop holds the
  // process), so we just await a never-resolving promise — SIGINT/SIGTERM
  // handlers funnel into shutdown().
  await new Promise<void>(() => { /* held by OpenTUI's event loop */ });
}

// ── classifyRedirect — pure URL routing decision ──────────────────────────
// Mirrors the Ink CLI's `classify` helper inlined here (small, no deps;
// avoids a tui.tsx re-export). Determines whether a redirect target is
// same-origin (the shell can transparently reconnect) or external (browser
// handoff via adapter.navigate).

type Classification =
  | { kind: "same-origin"; endpoint: string }
  | { kind: "different-origin"; url: string }
  | { kind: "invalid"; reason: string };

function classifyRedirect(target: string, fromEndpoint: string): Classification {
  let from: URL;
  try {
    from = new URL(fromEndpoint);
  } catch {
    return { kind: "invalid", reason: "current endpoint is not a valid URL" };
  }
  let to: URL;
  try {
    to = new URL(target, from);
  } catch {
    return { kind: "invalid", reason: "redirect target is not a valid URL" };
  }
  if (to.protocol !== "http:" && to.protocol !== "https:") {
    return { kind: "invalid", reason: `unsupported protocol: ${to.protocol}` };
  }
  if (to.origin === from.origin) {
    return { kind: "same-origin", endpoint: to.toString() };
  }
  return { kind: "different-origin", url: to.toString() };
}

void main();
