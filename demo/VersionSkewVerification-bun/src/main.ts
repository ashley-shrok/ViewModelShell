// VersionSkewVerification client — three parallel ViewModelShell instances,
// one per CONTEXT-mandated scenario. Deliberately imports NO CSS: the
// shipped default.css is loaded by index.html via a runtime <link> tag,
// so Ashley eyeballs the REAL shipped renderer + REAL shipped CSS AND the
// REAL shipped .vms-skew-lock modal (Plan 29-06's DOM+CSS) firing in a
// real browser against real HTTP.
//
// Three scenarios:
//   A. Initial-load stale bundle (client build id set to a never-matching
//      value, so every request rejects)
//   B. Mid-session server flip (client build id matches at startup; server
//      is flipped via admin panel between load and next dispatch)
//   C. Opt-out custom onError (skew opt-out active — no modal, no shell
//      lock; consumer's custom banner fires instead)

import { ViewModelShell, VmsActionError, VmsVersionSkewError } from "@ashley-shrok/viewmodel-shell";
import { BrowserAdapter } from "@ashley-shrok/viewmodel-shell/browser";

// ─── SCENARIO A: initial-load stale bundle ─────────────────────────────────
//
// The client build id below is set to a value that will never match the
// server's initial "build-A". The shipped `load()` catch arm (index.ts:3168) surfaces the
// VmsActionError via onError but does NOT itself call lockSkew — the load
// path returns without rendering (currentVm stays null) and no modal is
// shown yet. To exercise the modal in this scenario, after the load fails
// we programmatically fire a dispatch, whose catch arm (index.ts:3292) DOES
// call lockSkew() and the shipped modal fires. The container is still
// empty at that point (load never rendered), so Ashley sees the modal
// alone — no content painted underneath.

const containerA = document.getElementById("scenario-a")!;
const bannerA = document.getElementById("scenario-a-banner")!;
const shellA = new ViewModelShell({
  endpoint: "/api/shell",
  actionEndpoint: "/api/shell/action",
  adapter: new BrowserAdapter(containerA),
  clientBuildId: "build-Z", // guaranteed mismatch on every request
  onError: (err) => {
    bannerA.style.display = "block";
    bannerA.textContent =
      "[Scenario A] onError fired: " +
      (err instanceof Error ? err.message : String(err));
    console.log("[Scenario A] onError", err);
  },
});

(async () => {
  await shellA.load();
  // Load will have failed with VmsActionError (code: stale_client). The
  // shipped load() catch arm doesn't lock; only the dispatch() catch arm
  // does. Fire a dispatch to trigger the modal — the container is still
  // empty (currentVm never wrote) so the modal appears alone.
  await shellA.dispatch({ name: "increment" });
})();

// ─── SCENARIO B: mid-session server roll-forward ───────────────────────────
//
// The client build id below matches the server's initial CURRENT_BUILD.
// Load succeeds, form renders. Ashley then clicks "Set server to build-B"
// on the admin panel, types in the note field, and clicks Increment. The
// dispatch hits the server, the server's per-request createVersionGuard
// enforces against the new CURRENT_BUILD ("build-B"), returns 400
// stale_client — the shell's dispatch() catch arm calls lockSkew() and
// the shipped modal fires. Typed content in the note field is visibly
// discarded (matching CONTEXT accepted trade-off).

const containerB = document.getElementById("scenario-b")!;
const bannerB = document.getElementById("scenario-b-banner")!;
const shellB = new ViewModelShell({
  endpoint: "/api/shell",
  actionEndpoint: "/api/shell/action",
  adapter: new BrowserAdapter(containerB),
  clientBuildId: "build-A", // matches server at startup
  onError: (err) => {
    bannerB.style.display = "block";
    bannerB.textContent =
      "[Scenario B] onError fired: " +
      (err instanceof Error ? err.message : String(err));
    console.log("[Scenario B] onError", err);
  },
});
shellB.load();

// ─── SCENARIO C: opt-out custom onError affordance ─────────────────────────
//
// The client build id matches server, and the skew opt-out is set to
// "custom" — opt out of the shipped hard-lock. On skew, the framework:
//   - fires the signal via onError (as v3.8.0 always did)
//   - does NOT set skewLocked
//   - does NOT stop polling
//   - does NOT call showSkewLock (no modal)
// The consumer's onError renders its own inline banner instead. Ashley
// verifies that after the flip, the banner appears but Increment KEEPS
// WORKING — proving the opt-out preserves v3.8.0 behavior byte-for-byte.

const containerC = document.getElementById("scenario-c")!;
const bannerC = document.getElementById("scenario-c-banner")!;
const shellC = new ViewModelShell({
  endpoint: "/api/shell",
  actionEndpoint: "/api/shell/action",
  adapter: new BrowserAdapter(containerC),
  clientBuildId: "build-A",
  onVersionSkew: "custom", // ── the opt-out flag ──
  onError: (err) => {
    // Custom affordance: inline banner + let the shell keep going. We
    // detect the two skew signals (VmsActionError code:"stale_client" for
    // the fail-closed path; VmsVersionSkewError for the detection path)
    // and render our own message; other errors fall through to console.
    const isSkew =
      (err instanceof VmsActionError && err.code === "stale_client") ||
      err instanceof VmsVersionSkewError;
    if (isSkew) {
      bannerC.style.display = "block";
      bannerC.textContent =
        "[Scenario C — custom affordance] Version skew detected: " +
        (err instanceof Error ? err.message : String(err)) +
        " (shell is NOT locked; try Increment again to prove it still works)";
    }
    console.log("[Scenario C] onError", err);
  },
});
shellC.load();

// Expose the shell references on window for ad-hoc debugging during the
// tasting — Ashley or the operator can inspect skewLocked state, etc.
// This is host-chrome only; no VMS behavior depends on it.
(window as unknown as { _shells: unknown })._shells = {
  a: shellA,
  b: shellB,
  c: shellC,
};
