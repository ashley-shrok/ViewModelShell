import { ViewModelShell } from "viewmodel-shell";
import { BrowserAdapter } from "viewmodel-shell/browser";

const tabId = Math.random().toString(36).slice(2, 10);

const container = document.getElementById("app")!;
const adapter = new BrowserAdapter(container);

const shell = new ViewModelShell({
  endpoint: `/api/tasks?tab=${tabId}`,
  actionEndpoint: `/api/tasks/action?tab=${tabId}`,
  adapter,
  onLoading(loading) {
    document.body.classList.toggle("is-loading", loading);
  },
  onError(err) {
    console.error("Shell error:", err);
    const msg = err.message.replace(/[&<>"']/g, c =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c)
    );
    container.insertAdjacentHTML(
      "afterbegin",
      `<div class="vms-error" role="alert">
        ${msg}
        <button onclick="this.parentElement.remove()">&#x2715;</button>
      </div>`
    );
  },
});

shell.load();
