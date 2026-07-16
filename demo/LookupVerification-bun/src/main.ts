// The verification client. Deliberately imports NO CSS: the shipped default.css
// + the active theme are loaded by index.html via runtime <link> tags (served
// verbatim from viewmodel-shell/styles by server.ts), so the human sign-off is
// against the real shipped CSS AND the real shipped renderer, with a runtime
// theme swap across all 12 themes that needs no rebuild.
import { ViewModelShell } from "@ashley-shrok/viewmodel-shell";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";

const container = document.getElementById("app")!;
const adapter = new BrowserAdapter(container);

// Same-origin wiring: this client is served by the very Bun process that also
// exposes /api/lookup, so the endpoints are plain relative paths.
const shell = new ViewModelShell({
  endpoint: `/api/lookup`,
  actionEndpoint: `/api/lookup/action`,
  adapter,
  onLoading(loading) {
    // NOTE the debounced searchAction is renderer-forced NON-BLOCKING (D11), so
    // this must NOT fire on every keystroke — if the page visibly greys out
    // while typing, that is a bug worth flagging.
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
