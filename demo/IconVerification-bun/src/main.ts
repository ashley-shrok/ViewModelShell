// The verification client. Deliberately imports NO CSS: the shipped default.css
// + the active theme are loaded by index.html via runtime <link> tags (served
// verbatim from viewmodel-shell/styles by server.ts), so the human sign-off is
// against the real shipped CSS AND the real shipped renderer, with a runtime
// theme swap across the shipped default + all 12 themes that needs no rebuild.
import { ViewModelShell } from "@ashley-shrok/viewmodel-shell";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";

const container = document.getElementById("app")!;
const adapter = new BrowserAdapter(container);

// Same-origin wiring: this client is served by the very Bun process that also
// exposes /api/icons, so the endpoints are plain relative paths.
const shell = new ViewModelShell({
  endpoint: `/api/icons`,
  actionEndpoint: `/api/icons/action`,
  adapter,
  onLoading(loading) {
    document.body.classList.toggle("is-loading", loading);
  },
  onError(err) {
    // The ICON-05 rejection surface — clicking "Trigger the ICON-05 walker
    // rejection" causes the server to build an invalid tree, the shipped
    // validators throw, `createAction` returns 500 with the structured error
    // envelope, and this callback fires. If the banner never appears when the
    // button is clicked, the walker isn't rejecting — halt and reopen ICON-05.
    console.error("Shell error:", err);
    // Build the banner with real DOM (no innerHTML — the check-no-demo-style
    // gate covers frontend HTML, but the AGENTS.md .vms-*-only proxy is on the
    // Showcase's main.ts; verification harness client code uses createElement
    // for safety here rather than to satisfy a gate).
    const banner = document.createElement("div");
    banner.className = "vms-error";
    banner.setAttribute("role", "alert");
    banner.textContent = err.message;
    const dismiss = document.createElement("button");
    dismiss.textContent = "✕";
    dismiss.addEventListener("click", () => banner.remove());
    banner.appendChild(dismiss);
    container.prepend(banner);
  },
});

shell.load();
