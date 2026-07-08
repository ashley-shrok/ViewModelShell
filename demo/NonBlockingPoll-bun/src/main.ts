import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css";
import { ViewModelShell } from "@ashley-shrok/viewmodel-shell";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";

const container = document.getElementById("app")!;
const adapter = new BrowserAdapter(container);

// Same-origin wiring: this client is served by the very Bun process that also
// exposes /api/poll, so the endpoints are plain relative paths — no CORS, no
// second port, no dev-proxy. That is the whole point of the full-stack demo.
const shell = new ViewModelShell({
  endpoint: `/api/poll`,
  actionEndpoint: `/api/poll/action`,
  adapter,
  // NBA-05: the client auto-dispatches {name:"poll"} on this cadence, always
  // via the non-blocking lane — a blocking user click fired while a poll
  // round trip is in flight is honored immediately, never queued behind it.
  pollInterval: 1200,
  onLoading(loading) {
    document.body.classList.toggle("is-loading", loading);
  },
  onError(err) {
    console.error("Shell error:", err);
    const msg = err.message.replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c),
    );
    container.insertAdjacentHTML(
      "afterbegin",
      `<div class="vms-error" role="alert">
        ${msg}
        <button onclick="this.parentElement.remove()">&#x2715;</button>
      </div>`,
    );
  },
});

shell.load();
