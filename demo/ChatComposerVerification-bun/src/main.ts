// ChatComposerVerification (Phase 30 v9.1.0 ChatComposerNode Route B composite
// sign-off page — Plan 30-09) per-panel mount. Runs INSIDE each iframe
// (/panels/panel-N.html); window.__PANEL_INDEX__ tells us which panel to
// render.
//
// Deliberately imports NO CSS: the shipped default.css + the active theme
// are loaded by each panel HTML via runtime <link> tags (served verbatim
// from viewmodel-shell/styles by server.ts). The parent chrome broadcasts
// theme changes via postMessage; each iframe's inline <script> handles the
// theme <link> href swap. Ashley's sign-off is against the REAL shipped
// CSS + the REAL shipped renderer, with a runtime 13-option theme swap
// (default + 12 themes) that needs no rebuild.
//
// The per-panel tree + initial state is fetched from server.ts, which builds
// each panel VM via PANELS[N] then runs it through the REAL shipped tree
// validators (validateActionNames + validateSectionAction from
// viewmodel-shell/src/server) BEFORE returning. If validation throws, the
// server response's VM contains an inline error banner so the failure is
// VISIBLE at load — a permissive shim accepting invalid trees would hide
// validator bugs (banked lesson from Phase 21/24 real-validator shim).
//
// The per-panel afterMount hooks (fake-paste for panel 12, etc.) live in
// this client bundle because they operate on the DOM after mount — the
// server-shipped VM has no DOM-side hook mechanism.

import { ViewModelShell } from "@ashley-shrok/viewmodel-shell";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";

declare global {
  interface Window {
    __PANEL_INDEX__?: number;
  }
}

const container = document.getElementById("app");
if (!container) {
  throw new Error(
    "ChatComposerVerification: #app mount point missing from panel HTML",
  );
}

const panelIndex = window.__PANEL_INDEX__;
if (typeof panelIndex !== "number" || panelIndex < 1 || panelIndex > 12) {
  throw new Error(
    "ChatComposerVerification: window.__PANEL_INDEX__ missing / invalid — " +
      "the panel HTML must set it before loading this module.",
  );
}

// ─── After-mount hooks (client-only DOM manipulation) ────────────────────────

/**
 * Panel 12 — fake-paste two files into the composer so the framework's chip
 * strip renders above the consumer's headerSlot "Editing message #42"
 * content. Uses the REAL ingress path (paste event → adapter's ingest
 * handler) rather than a test-only setter, so the composition demonstrated
 * here is exactly what a real paste produces.
 */
function fakePasteTwoFiles(rootEl: HTMLElement): void {
  setTimeout(() => {
    const ta = rootEl.querySelector<HTMLTextAreaElement>(
      ".vms-chat-composer__textarea",
    );
    if (!ta) {
      console.warn(
        "[ChatComposerVerification] panel 12: textarea not found; " +
          "fake-paste skipped. The framework chip strip will not appear.",
      );
      return;
    }
    const mockImage = new File(["fake png bytes"], "screenshot.png", {
      type: "image/png",
    });
    const mockPdf = new File(["fake pdf bytes"], "notes.pdf", {
      type: "application/pdf",
    });
    // DataTransfer + ClipboardEvent — the real paste ingress path.
    const dt = new DataTransfer();
    dt.items.add(mockImage);
    dt.items.add(mockPdf);
    try {
      ta.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: dt,
          bubbles: true,
          cancelable: true,
        }),
      );
    } catch (err) {
      console.warn(
        "[ChatComposerVerification] panel 12: fake-paste failed — the " +
          "framework chip strip demonstration relies on DataTransfer + " +
          "ClipboardEvent, both required for real paste handling anyway.",
        err,
      );
    }
  }, 250);
}

const AFTER_MOUNT: Record<number, (root: HTMLElement) => void> = {
  12: fakePasteTwoFiles,
};

// ─── Mount ───────────────────────────────────────────────────────────────────

const endpoint = `/api/panel/${panelIndex}/tree`;

const shell = new ViewModelShell({
  endpoint,
  actionEndpoint: endpoint,
  adapter: new BrowserAdapter(container),
  onError: (err) => {
    console.error(
      `[ChatComposerVerification] panel ${panelIndex} shell error:`,
      err,
    );
    const banner = document.createElement("div");
    banner.setAttribute(
      "style",
      "padding:.5rem .75rem;background:#fee;border:1px solid #c33;color:#900;font:13px system-ui,sans-serif;margin:.5rem 0;border-radius:.375rem;",
    );
    banner.textContent = `Shell error: ${err.message ?? String(err)}`;
    container.insertBefore(banner, container.firstChild);
  },
});

shell
  .load()
  .then(() => {
    const hook = AFTER_MOUNT[panelIndex];
    if (hook) hook(container);
  })
  .catch((err: unknown) => {
    console.error(
      `[ChatComposerVerification] panel ${panelIndex} initial load failed:`,
      err,
    );
    container.textContent = `Initial load failed: ${
      err instanceof Error ? err.message : String(err)
    }`;
  });
