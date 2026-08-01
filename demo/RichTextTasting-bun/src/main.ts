// Parent-page bootstrap for the Route B tasting page (Phase 28 Plan 28-04).
// Deliberately imports NO VMS renderer and mounts NO ViewModelShell — the
// parent page is host-chrome ONLY. The two panels each mount their own
// BrowserAdapter inside their own iframe document per the banked v8.0.3
// iframe-scoping lesson (2026-07-30): a shared parent-level asset would
// cross-contaminate the A/B comparison.
//
// This module does two things:
//   (1) Populates the theme <select> from /api/themes (server-enumerated so
//       the option list matches viewmodel-shell/styles/themes/ verbatim).
//   (2) On theme change, broadcasts the picked theme name to BOTH iframes
//       via postMessage({ type: "vms-theme", name }). Each iframe swaps its
//       OWN #theme-css <link> href in response (see the listener in each
//       panel-*.ts). NOTE: we do NOT swap a shared <link> at parent level —
//       that would defeat the iframe-scoping rule.

interface ThemeMessage {
  type: "vms-theme";
  name: string | null; // null = revert to no theme override
}

const select = document.getElementById("theme-select") as HTMLSelectElement | null;
const label = document.getElementById("theme-name") as HTMLSpanElement | null;
const iframePrim = document.getElementById("iframe-primitives") as HTMLIFrameElement | null;
const iframeComp = document.getElementById("iframe-composite") as HTMLIFrameElement | null;

async function loadThemes(): Promise<void> {
  if (!select) return;
  try {
    const r = await fetch("/api/themes");
    if (!r.ok) return;
    const payload = (await r.json()) as { themes?: string[] };
    for (const name of payload.themes ?? []) {
      const opt = document.createElement("option");
      opt.value = name;
      opt.textContent = name;
      select.appendChild(opt);
    }
  } catch {
    // Non-fatal — the switcher just stays with only "Default".
  }
}

function broadcastTheme(picked: string): void {
  const msg: ThemeMessage =
    picked === "__default__" ? { type: "vms-theme", name: null } : { type: "vms-theme", name: picked };
  // Broadcast to BOTH iframes. Each iframe's own inline listener swaps its
  // OWN #theme-css link — parent NEVER touches an iframe's DOM directly.
  iframePrim?.contentWindow?.postMessage(msg, "*");
  iframeComp?.contentWindow?.postMessage(msg, "*");
  if (label) label.textContent = msg.name ?? "Default";
}

select?.addEventListener("change", () => broadcastTheme(select.value));

// When iframes finish loading, re-broadcast the currently-picked theme so a
// late-loading iframe doesn't miss the last theme change.
function rebroadcastCurrent(): void {
  if (select) broadcastTheme(select.value);
}
iframePrim?.addEventListener("load", rebroadcastCurrent);
iframeComp?.addEventListener("load", rebroadcastCurrent);

loadThemes();
