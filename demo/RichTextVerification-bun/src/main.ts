// RichTextVerification (Phase 28 v8.2.0 rich text primitive sign-off page)
// mount. Deliberately imports NO CSS: the shipped default.css + the active
// theme are loaded by index.html via runtime <link> tags (served verbatim
// from viewmodel-shell/styles by server.ts), so Ashley's sign-off is against
// the REAL shipped CSS AND the REAL shipped renderer, with a runtime
// 13-option theme swap (default + 12 themes) that needs no rebuild.
//
// This is a REAL round-trip mount (NOT a static one-shot render like Phase
// 27's demo): RichTextFieldNode is an interactive input primitive — typing
// into the editor writes to bind → state round-trips on any dispatch. We
// use the full ViewModelShell + BrowserAdapter mount so the TipTap editor's
// lazy-import fires (Plan 28-03 Chart.js-precedent pathway), the editor
// instance persists across renders via the mark-sweep (Plan 28-03 pattern),
// and any dispatch (e.g. a toolbar button click that somehow triggers a
// dispatch, though the D-08 floor tools are all client-side chain commands)
// round-trips through the tree validator that server.ts's fetch handler
// invokes before returning any response.

import { ViewModelShell } from "@ashley-shrok/viewmodel-shell";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";

const container = document.getElementById("app");
if (!container) {
  throw new Error("RichTextVerification: #app mount point missing from index.html");
}

const shell = new ViewModelShell({
  endpoint: "/api/probe/tree",
  actionEndpoint: "/api/probe/tree",
  adapter: new BrowserAdapter(container),
  onError: (err) => {
    // Surface any dispatch / render / validator failure visibly at the top
    // of the page so a broken sign-off doesn't get quietly missed. This is
    // the same fail-loud posture as the framework's capability seam.
    console.error("[RichTextVerification] Shell error:", err);
    const banner = document.createElement("div");
    banner.setAttribute(
      "style",
      "padding:.75rem 1rem;background:#fee;border:1px solid #c33;color:#900;font:14px system-ui,sans-serif;margin:1rem;border-radius:.5rem;",
    );
    banner.textContent = `Shell error: ${err.message ?? String(err)}`;
    container.insertBefore(banner, container.firstChild);
  },
  onLoading: (loading) => {
    // Non-blocking loading indicator (unobtrusive) — helpful when a slow
    // theme swap coincides with a stray dispatch.
    document.title = loading
      ? "⋯ Phase 28 rich text verification — Tailnet sign-off (v8.2.0)"
      : "Phase 28 rich text verification — Tailnet sign-off (v8.2.0)";
  },
});

// Initial load — fetches /api/probe/tree, which returns the 8-scenario
// verification VM + initial state (both run through the REAL shipped tree
// validators server-side per the banked lesson from Phase 21/24). The
// BrowserAdapter renders it; RichTextFieldNode instances lazy-import TipTap
// on first render per the Chart.js precedent (Plan 28-03).
shell.load().catch((err: unknown) => {
  console.error("[RichTextVerification] Initial load failed:", err);
  container.textContent = `Initial load failed: ${
    err instanceof Error ? err.message : String(err)
  }`;
});
