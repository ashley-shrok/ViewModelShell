// The verification client. Deliberately imports NO CSS: the shipped
// default.css + the active theme are loaded by index.html via runtime <link>
// tags (served verbatim from viewmodel-shell/styles by server.ts), so the
// human sign-off is against the REAL shipped CSS AND the REAL shipped
// renderer, with a runtime 13-theme swap that needs no rebuild.
//
// Static page: GETs /api/probe/tree once, renders. No dispatch loop, no
// state round-tripping — the tree is the same on every request.
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";
import type { ViewNode } from "@ashley-shrok/viewmodel-shell";

const container = document.getElementById("app")!;
const adapter = new BrowserAdapter(container);

async function load(): Promise<void> {
  const r = await fetch("/api/probe/tree");
  if (!r.ok) {
    container.textContent = "Failed to fetch verification tree: HTTP " + r.status;
    return;
  }
  const body = (await r.json()) as { vm: ViewNode };
  adapter.render(body.vm, () => {
    // No-op — the page carries no interactive dispatches. If a stray action
    // fires (e.g. from a table row click), we swallow it silently rather
    // than crash. Sign-off page purpose is visual, not interactive.
  });
}

load().catch((err) => {
  container.textContent = "Error: " + (err && err.message ? err.message : String(err));
});
