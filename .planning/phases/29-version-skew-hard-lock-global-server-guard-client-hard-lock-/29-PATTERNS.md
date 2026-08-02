# Phase 29: Version-skew hard-lock — Pattern Map

**Mapped:** 2026-08-02
**Files analyzed:** 8 source files + 3 test analogs + 1 parity fixture + 2 docs
**Analogs found:** 8 / 8 (all analogs in-tree — this is a tightening-of-shipped-primitive phase)

## Reading guide for the planner

This phase modifies **existing files only** — no new files are created. Every file has a strong analog either in the file itself (a shipped shape being tightened) or in a sibling shipped verb / filter. Read this map alongside `29-CONTEXT.md`; the CONTEXT locks the shape, this map shows the exact lines to model the diff against.

Two shape guardrails already baked into the CONTEXT that this map reinforces:

1. **The new global GUARD .NET filter is a byte-for-byte twin of `ShellVersionResultFilter`** — same DI shape, self-registered from the same `AddVersionResultFilter` helper, same "inert when `CurrentBuild` is null/empty" posture. Copying that structure verbatim IS the pattern.
2. **The new adapter `showSkewLock` verb is modeled on `toast` + `setBusy` + `reload`**, NOT on `navigate` / `storage` / `saveFile`. Fail-quiet by absence in the core: the modal is the UX affordance, but `VmsActionError` / `VmsVersionSkewError` still surface via `onError` regardless (adapters without the verb still learn of the skew). Do NOT call `failCapability` when the verb is absent.

## File Classification

| Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `viewmodel-shell/src/index.ts` — Adapter interface additions | adapter capability verb interface | client dispatch loop | `Adapter.toast` / `Adapter.reload` (same file, lines 106-127) | exact |
| `viewmodel-shell/src/index.ts` — `load()` header attachment | request-header merger | GET request | `performRoundTrip()` header block (same file, lines 3165-3171) | exact |
| `viewmodel-shell/src/index.ts` — shell-level `skewLocked` state | dispatch/render gating flag | client dispatch loop | `serverBusy` / `blockingInFlight` gating (same file, lines 3072-3078, 3273-3274) | role-match |
| `viewmodel-shell/src/index.ts` — retire silent `adapter.reload()` on stale_client | error-branch behavior swap | client error handling | current catch arm at lines 3237-3260 (same file — this IS the code being replaced) | exact (self-replacement) |
| `viewmodel-shell/src/index.ts` — wire `checkVersionSkew` to modal | shell → adapter dispatch | client detection loop | `checkVersionSkew` at lines 3497-3504 (same file — this IS the code being modified) | exact (self-replacement) |
| `viewmodel-shell/src/index.ts` — `ShellOptions.onVersionSkew` seam | opt-out configuration flag | shell configuration | `ShellOptions.onRedirect` / `getRequestHeaders` (same file, ~line 2871 region) | role-match |
| `viewmodel-shell/src/browser.ts` — `showSkewLock` DOM affordance | adapter DOM builder + framework-owned modal | client render pipeline | `toast()` (same file, lines 487-518) + `modal()` (same file, lines 4702-4747) | exact (dual analog: attachment pattern from toast, DOM shape from modal) |
| `viewmodel-shell/styles/default.css` — `.vms-skew-lock*` classes | framework-owned CSS | render styling | `.vms-modal-backdrop` + `.vms-modal` (same file, lines 2355-2405) + `.vms-alert--warning` (lines 1361-1395) + `.vms-toast--warning` (lines 2618-2648) | exact |
| `viewmodel-shell-dotnet/Versioning.cs` — new global GUARD filter | ASP.NET action-filter middleware | server request pipeline | `ShellVersionResultFilter` (same file, lines 51-76) | exact (byte-for-byte twin) |
| `viewmodel-shell-dotnet/Versioning.cs` — GUARD filter self-registration | DI extension helper | app startup | `AddVersionResultFilter` (same file, lines 171-179) | exact (extend the same helper) |
| `viewmodel-shell/src/server.ts` — TS global guard hoist | server subpath request-pipeline hoist | server request handling | `createAction` guard block at lines 1342-1358 (same file — this IS the code being hoisted) | exact (self-refactor: hoist guard OUT of per-action wrapper into a global-guard factory) |
| Adapter test additions | vitest unit tests | test-time | `test/version-skew.test.ts` (same shape; strong reuse) | exact |
| .NET filter tests | xUnit unit tests | test-time | `Tests/VersioningTests.cs` (~line 128-167 for filter-context construction pattern) | exact |
| Parity fixture — GET-stale-header | parity fixture step | parity-time | `parity/fixtures/helpdesk.json` step `agt-build-stale` (lines 41-42) + `helpdesk-seeded.json` `expectBodyContains` posture | exact |

## Pattern Assignments

### `viewmodel-shell/src/index.ts` — Adapter interface: add `showSkewLock` (or planner-chosen name)

**Analog:** the same file's shipped `toast?` / `reload?` verb declarations (lines 106-127). Both are fail-quiet-by-absence verbs modeled on `setBusy` — NOT the fail-loud triad (`navigate` / `storage` / `saveFile`). This distinction is load-bearing per CONTEXT `<decisions>`: the modal is a UX affordance, but the `VmsActionError` / `VmsVersionSkewError` signals ALSO surface via the existing `onError` seam, so an adapter without the verb (TUI, custom) still learns of the skew.

**Verb-declaration pattern** (lines 106-114 — the exact TSDoc structure to mirror):

```typescript
/** Show a transient confirmation toast, driven by a `{ type: "toast" }`
 *  ShellSideEffect. `BrowserAdapter` stacks toasts in a single fixed-corner
 *  host region and auto-dismisses each after `opts.durationMs` (default
 *  ~4000ms). FAIL-QUIET BY ABSENCE — modeled on setPreventUnload/setBusy,
 *  NOT on navigate/storage/saveFile: a dropped toast is a missed UX nicety,
 *  never a correctness/security bug, so the core MUST NOT call failCapability
 *  when this verb is absent (non-browser targets like the TUI simply have no
 *  toast surface and the effect is a no-op). */
toast?(message: string, opts?: { tone?: string; durationMs?: number }): void;
```

**Also mirror** `reload?()` (lines 115-127) — its TSDoc explicitly names the "fail-quiet by absence, modeled on setBusy/toast, NOT on navigate/storage/saveFile" rule. The new verb's TSDoc should carry the same clause almost verbatim.

**Verb signature:** likely `showSkewLock?(info?: { clientBuild?: string; serverBuild?: string }): void` (planner's call — CONTEXT `<decisions>` explicitly says "name TBD"). The info arg is optional so the adapter's default modal can render without it; when supplied, a custom adapter could surface build ids for debugging.

---

### `viewmodel-shell/src/index.ts` — `load()`: attach `X-VMS-Client-Build` on GET

**Analog:** the SAME file's `performRoundTrip()` header-merge block at lines 3165-3171 (Phase-2 shipped POST path). The GET path in `load()` at lines 3081-3088 currently misses the header; the fix is a symmetric merge in `load()`.

**POST header-merge pattern to mirror** (`performRoundTrip`, lines 3165-3176):

```typescript
const extraHeaders = this.options.getRequestHeaders ? await this.options.getRequestHeaders() : {};
const adapter = this.options.adapter;
// 3.8.0 — Phase 2 fail-closed guard: advertise the running bundle id so the
// server can reject a mutation from a stale client BEFORE deserializing
// _state. Merged AFTER getRequestHeaders() so app headers can't clobber it.
const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
if (this.options.clientBuildId) headers["X-VMS-Client-Build"] = this.options.clientBuildId;
const init = {
  method: "POST",
  headers,
  body: form,
};
```

**Current GET path missing the header** (`load`, lines 3086-3088 — this is the code being fixed):

```typescript
const url = params ? `${endpoint}?${new URLSearchParams(params)}` : endpoint;
const extraHeaders = this.options.getRequestHeaders ? await this.options.getRequestHeaders() : {};
const res = await fetch(url, { headers: { Accept: "application/json", ...extraHeaders } });
```

**Fix shape:** hoist the same `if (this.options.clientBuildId) headers["X-VMS-Client-Build"] = ...` line into `load()`'s `headers` object. Keep the "merged AFTER getRequestHeaders() so app headers can't clobber it" ordering — that comment applies verbatim.

---

### `viewmodel-shell/src/index.ts` — shell-level `skewLocked` state

**Analog:** `serverBusy` field + `syncBusy()` gate pattern (lines 3072-3078, 3273) — the shipped precedent for a shell-level boolean that gates `dispatch()` entry.

**Existing `serverBusy` gate pattern** (line 3273 in `dispatch()`):

```typescript
// 0.16.0 — drop user-initiated dispatches while server-busy.
if (this.serverBusy) return;
if (this.blockingInFlight) return;
```

**Existing `serverBusy` field declaration** (lines 3068-3073):

```typescript
// 0.16.0 — busy = serverBusy OR a user-initiated dispatch is in flight.
// Polls (silent=true dispatches) don't flip userDispatching so they never
// toggle the busy class — that's how a server-busy state stays continuously
// locked across many ticks without flicker.
private serverBusy = false;
private userDispatching = false;
```

**New `skewLocked` shape:**
- Declared as `private skewLocked = false;` alongside `serverBusy`.
- Set to `true` in ONE place: the branch that fires the modal (both `checkVersionSkew` mismatch AND the `error.code === "stale_client"` arm — see next two assignments).
- Guarded in `dispatch()`: the CONTEXT says "drops on BOTH blocking and non-blocking lanes". So the guard runs BEFORE the lane split at line 3269 (`if (!nonBlocking) {`) — a single early return `if (this.skewLocked) return;` at the very top of `dispatch()`.
- Guarded in `processResponse()` (line 3425): early return before the render — but AFTER the `checkVersionSkew` fire path, if the response that TRIGGERS the lock arrives while `skewLocked` is still false. Alternative: set `skewLocked` FIRST, then let `processResponse`'s early-return skip the render. Planner's call on ordering, but the semantic is "once locked, no re-renders paint".
- Consequence CONTEXT calls out explicitly: "poll stops firing after lock too" — since `schedulePoll` calls `dispatch({name:"poll"}, true)` at line 3524, and the early return above catches both lanes, polls are dropped by construction. No separate `stopPolling()` call needed, but planner may choose to call it explicitly for clarity.

---

### `viewmodel-shell/src/index.ts` — retire silent `adapter.reload()` on stale_client + wire modal

**Analog:** the current catch arm at lines 3237-3260 (this IS the code being replaced). Read this to understand what changes.

**Current shape (lines 3240-3250 — the block to REPLACE):**

```typescript
// 3.8.0 — Phase 2 fail-closed recovery. The server rejected this mutation
// because the tab is running a stale bundle (nothing was applied). Order
// per the locked design: surface via onError FIRST (done above), THEN
// force a reload to the fresh bundle — the only safe recovery. reload is
// fail-quiet by absence (the VmsActionError already surfaced), so this is
// a plain optional-chain call, and we return before the below re-render
// (the page is reloading; re-rendering the stale tree is pointless).
if (error instanceof VmsActionError && error.code === "stale_client") {
  this.options.adapter.reload?.();
  return;
}
```

**Replacement shape (planner writes):**

```typescript
if (error instanceof VmsActionError && error.code === "stale_client") {
  // Set shell-level lock BEFORE firing the modal so subsequent dispatches
  // (e.g. an in-flight non-blocking poll response arriving after this)
  // drop rather than paint over the modal.
  this.skewLocked = true;
  this.stopPolling(); // explicit belt-and-braces even though dispatch() early-returns
  if (this.options.onVersionSkew !== "custom") {
    this.options.adapter.showSkewLock?.({ /* optional info */ });
  }
  // Note: adapter.reload() is NO LONGER called here. The modal's [Reload]
  // button is what calls adapter.reload() (framework-owned button wiring
  // in BrowserAdapter.showSkewLock — see browser.ts pattern below).
  return;
}
```

**Also modify `checkVersionSkew` (lines 3497-3504) — the detection path:**

```typescript
private checkVersionSkew(body: ShellResponse): void {
  const clientBuild = this.options.clientBuildId;
  const serverBuild = body.serverBuild;
  if (clientBuild && serverBuild && serverBuild !== clientBuild) {
    const err = new VmsVersionSkewError(serverBuild, clientBuild);
    // Same onError surface as today — signal preserved for consumer opt-out.
    this.options.onError ? this.options.onError(err) : console.error("[ViewModelShell]", err);
    // NEW: also lock + fire modal unless the consumer opted out.
    if (this.options.onVersionSkew !== "custom") {
      this.skewLocked = true;
      this.stopPolling();
      this.options.adapter.showSkewLock?.({ clientBuild, serverBuild });
    }
  }
}
```

---

### `viewmodel-shell/src/index.ts` — `ShellOptions.onVersionSkew` opt-out seam

**Analog:** `ShellOptions.onRedirect?: (url: string) => void` and `getRequestHeaders?: () => ...` — both are optional callback/config seams on the same options bag. The CONTEXT explicitly locks the shape: `"default" | "custom"` string enum (recommended), NOT a callback.

**Existing shape to mirror** (from ShellOptions region, ~line 2862 — the `clientBuildId` declaration):

```typescript
/** 3.8.0 — the id of the client bundle this shell instance is running (the app
 *  injects it at build time, e.g. from a Vite `define`/env — VMS never derives
 *  it, staying platform-agnostic). When set, the shell (1) attaches it as the
 *  `X-VMS-Client-Build` header on every action POST so the server can
 *  fail-closed on a stale mutation, and (2) compares it against a response's
 *  `serverBuild` and fires a `VmsVersionSkewError` via `onError` when they
 *  differ (AFTER rendering — detection never swallows the render). Absent =
 *  the whole version-skew feature is off; behavior is byte-identical to a
 *  build without it. */
clientBuildId?: string;
```

**New seam shape** (planner writes):

```typescript
/** 9.0.0 — opt-out from the shipped hard-lock modal behavior. Default =
 *  "default" (or omitted): on either version-skew signal
 *  (VmsVersionSkewError from checkVersionSkew, or a stale_client
 *  VmsActionError from a dispatch), the shell (1) sets an internal
 *  skewLocked flag that drops all further dispatches AND skips renders,
 *  (2) stops polling, and (3) calls adapter.showSkewLock() to display the
 *  framework-owned non-dismissible modal whose [Reload] button calls
 *  adapter.reload(). Set to "custom" to preserve pre-9.0.0 behavior: the
 *  signals still surface via onError (unchanged), but the shell does NOT
 *  lock, does NOT stop polling, and does NOT call showSkewLock — consumers
 *  with their own affordance (Kitsune, PBMInvoices) keep their own path. */
onVersionSkew?: "default" | "custom";
```

---

### `viewmodel-shell/src/browser.ts` — `showSkewLock` framework-owned modal DOM

**Analogs:** TWO analogs, both in the same file:

1. **`toast()` (lines 487-518)** — the attachment pattern (append to `document.body`, NOT `this.container`, so the modal survives `render()`'s `container.innerHTML = ""` wipe). Key idiom: `let region = document.querySelector<HTMLElement>(".vms-skew-lock"); if (!region) { region = document.createElement(...); document.body.appendChild(region); }` — idempotent; a second `showSkewLock` call finds and no-ops rather than double-mounting.

2. **`modal()` (lines 4702-4747)** — the DOM structure (backdrop + inner dialog with header/body/footer, `role="dialog"` + `aria-modal="true"`). BUT the CONTEXT specifies critical DEVIATIONS from `modal()`:
   - **Non-dismissible:** NO `.vms-modal__close` X button; NO backdrop-click handler; NO Escape key handler. Only path out is `[Reload]` → `this.reload()`.
   - **Not part of the render pipeline:** unlike `modal()` (which is called from `this.node()`'s `case "modal"` dispatch), this modal is imperatively created by the `showSkewLock` VERB. It attaches to `document.body`, not to a render-supplied `parent: HTMLElement`.
   - **Adds `inert` attribute to `this.container`** per CONTEXT `<specifics>`: `this.container.setAttribute("inert", "");` — makes the underlying page unfocusable/uninteractable.

**Attachment idiom to copy from `toast()` (lines 494-500):**

```typescript
toast(message: string, opts?: { tone?: string; durationMs?: number }): void {
  let region = document.querySelector<HTMLElement>(".vms-toast-region");
  if (!region) {
    region = document.createElement("div");
    region.className = "vms-toast-region";
    document.body.appendChild(region);
  }
  const el = document.createElement("div");
  el.className = `vms-toast${opts?.tone ? ` vms-toast--${opts.tone}` : ""}`;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = message;
  region.appendChild(el);
  // ... setTimeout auto-dismiss cut for this pattern; skew-lock never dismisses
}
```

**Modal DOM structure to copy shape (but modify) from `modal()` (lines 4702-4747):**

```typescript
private modal(n: ModalNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
  const backdrop = document.createElement("div");
  backdrop.className = "vms-modal-backdrop";

  const modal = document.createElement("div");
  modal.className = `vms-modal${n.size ? ` vms-modal--${n.size}` : ""}`;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  const header = document.createElement("div");
  header.className = "vms-modal__header";

  if (n.title) {
    const title = document.createElement("span");
    title.className = "vms-modal__title";
    title.textContent = n.title;
    header.appendChild(title);
  }
  // ... dismissAction path — OMIT in the skew-lock version
  modal.appendChild(header);

  const body = document.createElement("div");
  body.className = "vms-modal__body";
  this.kids(n.children, body, on);
  modal.appendChild(body);
  // ... footer path
  backdrop.appendChild(modal);
  parent.appendChild(backdrop);
}
```

**Icon pattern to mirror for the tone:warning visual language** — `alert()` at lines 2308-2318 shows the `renderIconSvg` seam. The CONTEXT `<specifics>` says the tasting used `alert-triangle`:

```typescript
const iconName = n.icon ?? BrowserAdapter.ALERT_TONE_ICON[n.tone]; // ALERT_TONE_ICON.warning = "alert-triangle"
const iconWrap = document.createElement("div");
iconWrap.className = "vms-alert__icon";
iconWrap.appendChild(this.renderIconSvg(iconName, "md", undefined, undefined));
```

**New verb shape** (planner writes — sketch):

```typescript
showSkewLock(info?: { clientBuild?: string; serverBuild?: string }): void {
  // Idempotent: a second call while the lock is up finds the existing DOM and no-ops.
  if (document.querySelector<HTMLElement>(".vms-skew-lock")) return;

  // Make the underlying page unfocusable (CONTEXT <specifics>).
  this.container.setAttribute("inert", "");

  const backdrop = document.createElement("div");
  backdrop.className = "vms-skew-lock"; // sole backdrop; NOT reusing .vms-modal-backdrop

  const dialog = document.createElement("div");
  dialog.className = "vms-skew-lock__dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");
  dialog.setAttribute("aria-labelledby", "vms-skew-lock-title");

  // Warning-tone icon (Lucide alert-triangle via renderIconSvg — same seam as AlertNode)
  const iconWrap = document.createElement("div");
  iconWrap.className = "vms-skew-lock__icon";
  iconWrap.appendChild(this.renderIconSvg("alert-triangle", "lg", undefined, undefined));
  dialog.appendChild(iconWrap);

  const title = document.createElement("div");
  title.id = "vms-skew-lock-title";
  title.className = "vms-skew-lock__title";
  title.textContent = "This app is out of date";  // CONTEXT locked copy
  dialog.appendChild(title);

  const body = document.createElement("div");
  body.className = "vms-skew-lock__body";
  body.textContent = "Reload to continue. Any unsaved changes will be lost."; // CONTEXT locked copy
  dialog.appendChild(body);

  const reloadBtn = document.createElement("button");
  reloadBtn.type = "button";
  reloadBtn.className = "vms-skew-lock__reload-btn";
  reloadBtn.textContent = "Reload"; // CONTEXT locked copy
  reloadBtn.addEventListener("click", () => this.reload()); // reuse existing verb
  dialog.appendChild(reloadBtn);

  backdrop.appendChild(dialog);
  document.body.appendChild(backdrop);

  // Auto-focus the Reload button for keyboard/SR accessibility (learned gap from
  // ExpenseTracker's in-modal success card — AGENTS.md "In-modal success feedback"
  // section flags this as a known rough edge to avoid perpetuating).
  reloadBtn.focus();
}
```

---

### `viewmodel-shell/styles/default.css` — `.vms-skew-lock*` classes

**Analogs:** THREE analogs in the same file:

1. **`.vms-modal-backdrop` + `.vms-modal` (lines 2355-2405)** — the backdrop-plus-centered-dialog geometry. Same `position: fixed; inset: 0;` backdrop, same `z-index` scheme (modal is 1000; toast-region is 1100; skew-lock should be ABOVE both since it locks everything — likely 1200).

2. **`.vms-alert--warning` (line 1371)** — the tone-tinted surface pattern using `color-mix`. Matches CONTEXT `<specifics>` "orange `#d97706` top-border + tinted circle icon background". The token to use is `--vms-warning` (dark border/text on light themes) or `--vms-warning-fill` (bright yellow for prominent fills). AGENTS.md `styles/default.css` lines 31-45 explains the split.

3. **`.vms-toast--warning` (line 2644)** — the "prominent tone-filled surface for a can't-miss message" precedent (uses `--vms-warning-fill` + `--vms-on-warning-fill` for AA-passing bright yellow).

**Backdrop geometry to copy from `.vms-modal-backdrop` (lines 2356-2365):**

```css
.vms-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--vms-space-md);
  z-index: 1000;
}
```

**Dialog geometry to copy from `.vms-modal` (lines 2366-2380):**

```css
.vms-modal {
  background: var(--vms-surface);
  border: 1px solid var(--vms-border);
  border-radius: var(--vms-radius);
  width: 100%;
  max-width: 520px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
```

**Warning-tone surface to copy from `.vms-alert--warning` (line 1371):**

```css
.vms-alert--warning { background: color-mix(in srgb, var(--vms-warning) 10%, var(--vms-surface)); border-color: color-mix(in srgb, var(--vms-warning) 30%, var(--vms-border)); }
.vms-alert--warning .vms-alert__icon { color: var(--vms-warning); }
```

**Suggested class shape** (planner refines):

```css
/* ── Skew-lock (9.0.0) — framework-owned non-dismissible reload modal ──
   Fires when the shell detects client/server version skew. Attached to
   <body>, above every other layer. Container gets `inert` while up. */
.vms-skew-lock {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--vms-space-md);
  z-index: 1200; /* above .vms-toast-region (1100) which is above .vms-modal-backdrop (1000) */
}
.vms-skew-lock__dialog {
  background: var(--vms-surface);
  border: 1px solid var(--vms-border);
  border-top: 3px solid var(--vms-warning); /* orange top-border per tasting */
  border-radius: var(--vms-radius);
  width: 100%;
  max-width: 420px;
  padding: var(--vms-space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--vms-space-sm);
  text-align: center;
}
.vms-skew-lock__icon {
  color: var(--vms-warning);
  /* Optional tinted circle behind the icon per tasting */
  background: color-mix(in srgb, var(--vms-warning) 15%, transparent);
  border-radius: 50%;
  padding: var(--vms-space-sm);
}
.vms-skew-lock__title {
  font-family: var(--vms-font-head);
  font-size: var(--vms-text-xl);
  font-weight: 600;
}
.vms-skew-lock__body {
  color: var(--vms-text-muted);
  font-size: var(--vms-text-base);
}
.vms-skew-lock__reload-btn {
  /* Reuse Button semantic — mirror .vms-button--warning.vms-button--primary
     (default.css lines 1006-1008): bright-fill warning + dark foreground for AA. */
  background: var(--vms-warning-fill);
  color: var(--vms-on-warning-fill);
  border: 1px solid var(--vms-warning-fill);
  border-radius: var(--vms-radius);
  padding: var(--vms-space-sm) var(--vms-space-lg);
  font-weight: 500;
  cursor: pointer;
  margin-top: var(--vms-space-sm);
}
```

**AA-contrast note:** CONTEXT `<specifics>` says "the modal must clear WCAG AA against every shipped theme (12 themes)". Reusing `--vms-warning` / `--vms-warning-fill` / `--vms-on-warning-fill` inherits the shipped AA-tested pairs from the toast / button warning surfaces — no new fg/bg pairs are introduced, so the `check:aa-contrast` gate should not need to grow. Verify at implementation time.

---

### `viewmodel-shell-dotnet/Versioning.cs` — new global GUARD filter

**Analog:** `ShellVersionResultFilter` (SAME file, lines 51-76) — the shipped stamp filter. The new GUARD filter is its BYTE-FOR-BYTE STRUCTURAL TWIN: same DI shape, same VmsVersioningOptions consumption, same "inert when CurrentBuild is null/empty" posture, same "self-registered by AddVmsShellVersioning" plumbing.

**Structural template to copy (lines 51-76):**

```csharp
/// <summary>
/// 3.8.0 — global result filter that stamps <see cref="ShellResponse{TState}.ServerBuild"/>
/// onto every controller-returned shell response when a current build is configured, so a
/// long-lived (never-reloaded) client can detect that the server has rolled forward. Reads
/// <see cref="VmsVersioningOptions"/> via constructor DI. As of 3.11.1 this filter is
/// self-registered by <see cref="VmsVersioningExtensions.AddVmsShellVersioning"/> (which
/// also puts the options in DI), so an app does not add it by hand.
/// </summary>
public sealed class ShellVersionResultFilter : IResultFilter
{
    private readonly VmsVersioningOptions _options;

    public ShellVersionResultFilter(VmsVersioningOptions options)
    {
        _options = options;
    }

    public void OnResultExecuting(ResultExecutingContext context)
    {
        var build = _options.CurrentBuild;
        if (string.IsNullOrEmpty(build)) return;

        // A controller returning ShellResponse<T> (from a GET, or via
        // ActionResult<ShellResponse<T>> on a POST) is wrapped in an ObjectResult
        // before result filters run. Error envelopes (from ShellExceptionFilter)
        // are ContentResults, not ObjectResults, so they never get stamped.
        if (context.Result is ObjectResult obj && obj.Value is IShellResponse sr)
        {
            obj.Value = sr.WithServerBuild(build);
        }
    }

    public void OnResultExecuted(ResultExecutedContext context) { }
}
```

**Guard-filter interface choice — pick per what runs BEFORE controller execution:** the current opt-in guard runs inside `ActionPayload.Parse` (in the controller body) — the CONTEXT wants this hoisted to run before the controller. The ASP.NET options are:

| Filter type | When it runs | Fit for this guard |
|-------------|--------------|--------------------|
| `IActionFilter.OnActionExecuting` | Before controller action method | ✓ Best fit — same DI shape, natural short-circuit via `context.Result = ...` |
| `IAsyncActionFilter` | Same, async version | Also fits; use if async work needed (none anticipated) |
| Middleware | Before MVC runs at all | Wrong layer — bypasses the exception-filter shape below |

**Recommended shape** (planner writes):

```csharp
/// <summary>
/// 9.0.0 — global ACTION filter (twin of <see cref="ShellVersionResultFilter"/>)
/// that fail-closes any incoming request (GET + POST) whose
/// <c>X-VMS-Client-Build</c> header does not match the server's current-deployed
/// build, BEFORE any controller runs. Twin the per-controller Parse(HttpRequest,
/// currentBuild) guard's semantics: absent header → pass through; empty
/// currentBuild → inert. Self-registered by
/// <see cref="VmsVersioningExtensions.AddVmsShellVersioning"/> alongside
/// <see cref="ShellVersionResultFilter"/>.
/// </summary>
public sealed class ShellVersionGuardFilter : IActionFilter
{
    private readonly VmsVersioningOptions _options;

    public ShellVersionGuardFilter(VmsVersioningOptions options)
    {
        _options = options;
    }

    public void OnActionExecuting(ActionExecutingContext context)
    {
        var current = _options.CurrentBuild;
        if (string.IsNullOrEmpty(current)) return; // versioning off → inert
        var advertised = context.HttpContext.Request.Headers["X-VMS-Client-Build"].ToString();
        if (string.IsNullOrEmpty(advertised)) return; // absent header → pass through
        if (advertised == current) return; // match → pass through
        // Mismatch → short-circuit with the same StaleClientException the per-
        // controller Parse overload throws, so ShellExceptionFilter maps it to
        // the byte-identical 400 stale_client envelope with no new code path.
        throw new StaleClientException(advertised, current);
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
```

**Why throw StaleClientException rather than set `context.Result` directly:** the shipped `ShellExceptionFilter.OnExceptionAsync` (`ShellExceptionFilter.cs` lines 80-87) ALREADY has the mapping `StaleClientException → 400 + stale_client`. Reusing that pathway means the wire envelope is byte-identical between the new global guard and the pre-existing per-controller guard — no new envelope shape to maintain, no drift risk. Confirmed at:

```csharp
// ShellExceptionFilter.cs lines 80-87 (pre-existing pathway to reuse):
if (ex is StaleClientException staleEx)
{
    context.Result = MakeJsonResult(
        400,
        ShellErrorResponse.OfStaleClient(staleEx.Message));
    context.ExceptionHandled = true;
    return Task.CompletedTask;
}
```

**Order of filters** — the guard should run BEFORE the result-filter (which stamps `serverBuild` on the response). ASP.NET runs action filters before result filters by construction; no ordering hint needed.

---

### `viewmodel-shell-dotnet/Versioning.cs` — extend `AddVersionResultFilter` to co-register the guard

**Analog:** the SAME file's `AddVersionResultFilter` helper (lines 171-179) — the current dedup-guarded self-registration for `ShellVersionResultFilter`. Extend this to ALSO register `ShellVersionGuardFilter`, or rename to `AddVersionFilters` (planner's call — a smaller diff keeps the current method name and just adds a second dedup-guarded block).

**Existing helper to extend (lines 162-179):**

```csharp
/// <summary>
/// 3.11.1 — self-register <see cref="ShellVersionResultFilter"/> on
/// <see cref="MvcOptions"/> so the Phase-1 <c>serverBuild</c> stamp is part of
/// "registering versioning" (previously the app had to add it by hand, and if
/// forgotten Phase-1 skew detection silently no-op'd). Dedup-guarded so a
/// legacy caller that still adds it manually doesn't register it twice; a
/// double-registration would be harmless anyway (the stamp is idempotent), but
/// this keeps exactly one filter in the pipeline.
/// </summary>
private static void AddVersionResultFilter(IServiceCollection services)
{
    services.Configure<MvcOptions>(o =>
    {
        bool already = o.Filters.OfType<TypeFilterAttribute>()
            .Any(f => f.ImplementationType == typeof(ShellVersionResultFilter));
        if (!already) o.Filters.Add<ShellVersionResultFilter>();
    });
}
```

**Extension pattern** (planner writes):

```csharp
private static void AddVersionFilters(IServiceCollection services)
{
    services.Configure<MvcOptions>(o =>
    {
        // Result filter (Phase-1 stamp — unchanged).
        bool resultAlready = o.Filters.OfType<TypeFilterAttribute>()
            .Any(f => f.ImplementationType == typeof(ShellVersionResultFilter));
        if (!resultAlready) o.Filters.Add<ShellVersionResultFilter>();

        // Action filter (Phase-2 global guard — new in 9.0.0). Same dedup shape
        // so a caller that added it manually before upgrading gets exactly one.
        bool guardAlready = o.Filters.OfType<TypeFilterAttribute>()
            .Any(f => f.ImplementationType == typeof(ShellVersionGuardFilter));
        if (!guardAlready) o.Filters.Add<ShellVersionGuardFilter>();
    });
}
```

Then update both `AddVmsShellVersioning(string)` and `AddVmsShellVersioning()` (lines 120-127, 151-160) to call `AddVersionFilters(services)` instead of `AddVersionResultFilter(services)`. Two-line diff; adoption stays one-line for the consumer.

---

### `viewmodel-shell/src/server.ts` — TS-side global guard hoist

**Analog:** the SAME file's `createAction` guard block at lines 1342-1358 — this is the code being REFACTORED. The CONTEXT `<decisions>` says: "on TS server subpath (`createAction`), the equivalent global guard fires before the action handler runs." The current guard is INSIDE `createAction`, so it already fires before the handler for a single action route; the CONTEXT wants it to be a GLOBAL guard.

**Current shape (lines 1340-1358 — the block being hoisted):**

```typescript
const currentBuild = options?.currentBuild;
return async (request: Request): Promise<Response> => {
  // 3.8.0 — fail-closed stale-client guard. Runs FIRST, before any body parse,
  // so a stale client's `_state` is never deserialized. Only when the app
  // configured `currentBuild` AND the header is present AND it mismatches.
  if (currentBuild) {
    const clientBuild = request.headers.get("x-vms-client-build");
    if (clientBuild !== null && clientBuild !== currentBuild) {
      return jsonResponse(
        errorEnvelope([{
          message:
            `Stale client: request build "${clientBuild}" does not match the ` +
            `current deployed build "${currentBuild}". Reload to continue.`,
          code: ERR_CODES.STALE_CLIENT,
        }]),
        400,
      );
    }
  }
```

**Design question the planner must resolve:** the TS server subpath doesn't have an ASP.NET-style filter pipeline. The CONTEXT `<decisions>` explicitly flags this: "TS-server-subpath global-guard shape (currently `createAction` wraps action handlers; there's no framework-owned request pipeline in the same sense as .NET's filter pipeline — planner picks the equivalent shape)."

**Two viable shapes (planner picks):**

1. **Hoist into a shared factory helper.** Export a `createVersionGuard({ currentBuild })` helper that wraps ANY `(Request) => Promise<Response>` — including a GET handler and any non-createAction routes. Consumers wire it around all their VMS routes (including the GET). The current in-createAction guard becomes a call to the same helper for defense-in-depth.

2. **Add a `wrapVmsRoutes` middleware-shape helper** that consumers apply to a whole app-router subtree. More idiomatic for Bun/Hono users but adds a per-framework adaptation burden.

**Suggested shape (option 1 — smaller diff, same one-line consumer adoption):**

```typescript
/**
 * 9.0.0 — Global version-skew guard. Wrap this around ANY route (GET or POST)
 * that serves a VMS endpoint, and the request is fail-closed with a 400
 * stale_client envelope BEFORE the handler runs when the X-VMS-Client-Build
 * header mismatches. Consumers pair it with createAction on POST routes and
 * apply it to their GET route too (this is what closes the pre-9.0.0 gap where
 * GETs bypassed the guard entirely).
 *
 * Consumer wiring:
 *   const guard = createVersionGuard({ currentBuild });
 *   app.get("/api/tasks", guard(async (req) => { ... GET handler ... }));
 *   app.post("/api/tasks/action", guard(createAction<TasksState>(async (p) => {...})));
 */
export function createVersionGuard(
  options: { currentBuild?: string }
): <T extends (req: Request) => Promise<Response>>(handler: T) => T {
  const currentBuild = options.currentBuild;
  return ((handler) => (async (request: Request): Promise<Response> => {
    if (currentBuild) {
      const clientBuild = request.headers.get("x-vms-client-build");
      if (clientBuild !== null && clientBuild !== currentBuild) {
        return jsonResponse(
          errorEnvelope([{
            message:
              `Stale client: request build "${clientBuild}" does not match the ` +
              `current deployed build "${currentBuild}". Reload to continue.`,
            code: ERR_CODES.STALE_CLIENT,
          }]),
          400,
        );
      }
    }
    return handler(request);
  })) as never;
}
```

**Then `createAction`'s in-body guard becomes redundant defense-in-depth** — but per CONTEXT `<decisions>` ("Existing per-controller `Parse(HttpRequest, currentBuild)` calls MUST continue to compile and work — they become a redundant defense-in-depth layer under the global filter"), it STAYS. The TS twin should follow the same shape: leave the guard inside `createAction` for consumers who don't apply `createVersionGuard` yet. Zero breaking change for existing consumers.

---

### Adapter tests — extend `test/version-skew.test.ts`

**Analog:** the SAME file (`test/version-skew.test.ts`) — the existing v3.8.0 skew test suite. Extend with new `describe` blocks for:

- **`describe("9.0.0 — X-VMS-Client-Build header on GET")`** — mirror the existing POST-header test (lines 158-176) but on `load()` instead of `dispatch()`. Inspect `fetchSpy.mock.calls[0]` (the GET) rather than `[1]` (the POST).
- **`describe("9.0.0 — hard-lock modal on VmsVersionSkewError")`** — assert `spy.adapter.showSkewLock` is called on skew detection; assert subsequent `dispatch()` calls are dropped (fetch mock not called); assert polling stops.
- **`describe("9.0.0 — hard-lock modal on stale_client")`** — assert `showSkewLock` is called INSTEAD of `reload`; assert `reload` is NOT auto-called (the button in the DOM calls it, not the shell).
- **`describe("9.0.0 — onVersionSkew: 'custom' opt-out")`** — assert `showSkewLock` is NOT called; assert dispatches still succeed; assert `onError` still fires with the same signal.

**Test scaffolding pattern to copy (lines 30-48 — the shared `makeAdapter` + `stubFetch` helpers):**

```typescript
interface SpyAdapter {
  adapter: Adapter;
  renders: number;
  reloads: number;
}

function makeAdapter(withReload = true): SpyAdapter {
  const spy: SpyAdapter = { adapter: null as never, renders: 0, reloads: 0 };
  spy.adapter = {
    render: () => { spy.renders++; },
    ...(withReload ? { reload: () => { spy.reloads++; } } : {}),
  };
  return spy;
}

function stubFetch(queue: Array<{ body: ShellResponse; status?: number }>): ReturnType<typeof vi.fn> {
  const responses = queue.slice();
  return vi.fn(async () => {
    const next = responses.shift()!;
    return new Response(JSON.stringify(next.body), {
      status: next.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as ReturnType<typeof vi.fn>;
}
```

**Extend `SpyAdapter` to track skew-lock calls:** add `skewLocks: number` and a `showSkewLock: () => { spy.skewLocks++; }` in `makeAdapter`. Follow the same pattern.

**Header-on-GET assertion pattern (mirror lines 158-176):**

```typescript
it("attaches the header on load (GET) when clientBuildId is configured", async () => {
  const fetchSpy = stubFetch([{ body: { vm: emptyVm, state: {} } }]);
  vi.stubGlobal("fetch", fetchSpy);
  const spy = makeAdapter();
  const shell = new ViewModelShell({
    endpoint: "/api/x", actionEndpoint: "/api/x/action",
    adapter: spy.adapter, clientBuildId: "build-7",
  });
  await shell.load();
  // The load() call is the 1st (only) fetch. Inspect its headers.
  const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
  const headers = init.headers as Record<string, string>;
  expect(headers["X-VMS-Client-Build"]).toBe("build-7");
});
```

**Drop-dispatches-after-lock pattern:**

```typescript
it("drops subsequent dispatches after the skew lock fires", async () => {
  const fetchSpy = stubFetch([
    { body: { vm: emptyVm, state: {}, serverBuild: "build-2" } }, // load → skew
    // no further responses queued — if a dispatch actually fires fetch, this test throws
  ]);
  vi.stubGlobal("fetch", fetchSpy);
  const spy = makeAdapter();
  const shell = new ViewModelShell({
    endpoint: "/api/x", actionEndpoint: "/api/x/action",
    adapter: spy.adapter, clientBuildId: "build-1",
    onError: () => {},
  });
  await shell.load(); // triggers skew → lock
  await shell.dispatch({ name: "go" } as ActionEvent);
  expect(fetchSpy).toHaveBeenCalledTimes(1); // dispatch dropped, no 2nd fetch
  expect(spy.skewLocks).toBe(1);
});
```

---

### .NET tests — extend `Tests/VersioningTests.cs`

**Analog:** the SAME file (`Tests/VersioningTests.cs`) — the existing .NET version-skew test suite. Extend with:

- **`ShellVersionGuardFilter_HeaderMismatch_ThrowsStaleClient`** — mirror the existing `Parse_HeaderMismatch_ThrowsStaleClient_AndDoesNotDeserializeState` test (lines 53-65) but exercise the new `ShellVersionGuardFilter.OnActionExecuting` instead of `ActionPayload.Parse`.
- **`ShellVersionGuardFilter_NoHeader_PassesThrough`** — mirror `Parse_NoHeader_PassesThrough` (lines 78-88).
- **`ShellVersionGuardFilter_EmptyCurrentBuild_SkipsGuard`** — mirror `Parse_EmptyCurrentBuild_SkipsGuardEntirely` (lines 90-99).
- **`AddVmsShellVersioning_String_SelfRegistersGuardFilter`** — mirror `AddVmsShellVersioning_String_SelfRegistersResultFilter` (lines 262-270).

**Filter-context construction pattern (lines 125-140 — reuse verbatim):**

```csharp
private static ResultExecutingContext MakeResultContext(IActionResult result) =>
    new(MakeActionContext(), [], result, controller: new object());

[Fact]
public void VersionResultFilter_StampsServerBuild_OnShellResponseObjectResult()
{
    var filter = new ShellVersionResultFilter(new VmsVersioningOptions { CurrentBuild = "build-9" });
    var response = new ShellResponse<DemoState>(new TextNode("hi"), new DemoState("x"));
    var objResult = new ObjectResult(response);
    var ctx = MakeResultContext(objResult);
    filter.OnResultExecuting(ctx);
    var stamped = Assert.IsType<ShellResponse<DemoState>>(objResult.Value);
    Assert.Equal("build-9", stamped.ServerBuild);
}
```

**New `ActionExecutingContext` builder (planner writes — nudge parallel to `MakeResultContext`):**

```csharp
private static ActionExecutingContext MakeActionExecutingContext(HttpContext? httpCtx = null)
{
    var actionCtx = new ActionContext(
        httpCtx ?? new DefaultHttpContext(),
        new RouteData(),
        new MvcActionDescriptor());
    return new ActionExecutingContext(
        actionCtx,
        [],
        new Dictionary<string, object?>(),
        controller: new object());
}

[Fact]
public void VersionGuardFilter_HeaderMismatch_ThrowsStaleClient()
{
    var http = new DefaultHttpContext();
    http.Request.Headers["X-VMS-Client-Build"] = "old-build";
    var ctx = MakeActionExecutingContext(http);
    var filter = new ShellVersionGuardFilter(new VmsVersioningOptions { CurrentBuild = "new-build" });
    Assert.Throws<StaleClientException>(() => filter.OnActionExecuting(ctx));
}

[Fact]
public void VersionGuardFilter_NoHeader_PassesThrough()
{
    var ctx = MakeActionExecutingContext(); // no header
    var filter = new ShellVersionGuardFilter(new VmsVersioningOptions { CurrentBuild = "new-build" });
    filter.OnActionExecuting(ctx); // must not throw
}
```

**Self-registration test (mirror lines 257-269):**

```csharp
private static bool HasVersionGuardFilter(IServiceProvider sp) =>
    sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MvcOptions>>().Value.Filters
        .OfType<TypeFilterAttribute>()
        .Count(f => f.ImplementationType == typeof(ShellVersionGuardFilter)) == 1;

[Fact]
public void AddVmsShellVersioning_String_SelfRegistersGuardFilter()
{
    var services = new ServiceCollection();
    services.AddControllers();
    services.AddVmsShellVersioning("build-x");
    using var sp = services.BuildServiceProvider();
    Assert.True(HasVersionGuardFilter(sp), "AddVmsShellVersioning(string) must self-register ShellVersionGuardFilter");
}
```

---

### Parity fixture — new fixture for GET-stale-header 400

**Analog:** `parity/fixtures/helpdesk.json` steps `agt-build-match` + `agt-build-stale` (lines 41-42) — the existing shipped POST version-skew fixture steps.

**Existing POST-stale step pattern to mirror:**

```json
{ "id": "agt-build-match", "method": "POST", "actionEndpoint": "/api/agent/action",
  "action": { "name": "filter-all" },
  "stateMutations": [{ "path": "filter", "value": "all" }],
  "clientBuild": "helpdesk-build-1",
  "$comment": "3.8.0 — matching X-VMS-Client-Build header passes; response carries serverBuild (both backends stamp identically)." },
{ "id": "agt-build-stale", "method": "POST", "actionEndpoint": "/api/agent/action",
  "action": { "name": "filter-all" },
  "clientBuild": "OLD-BUILD-999",
  "expectStatus": 400,
  "compareIgnoreFields": ["errors.0.message"],
  "$comment": "3.8.0 — mismatched header → 400 ok:false stale_client, rejected BEFORE _state is deserialized. Message wording differs per backend so it's ignored; errors.0.code (stale_client) is diffed." },
```

**Coverage-tripwire pattern to mirror from `helpdesk-seeded.json`:** every step MUST carry `expectBodyContains` so a config that skips the guard's execution fails LOUDLY (the "class 3" gate lesson from AGENTS.md's gotcha #9 — "a diff can only prove things about code it actually runs").

**Where the harness reads `clientBuild`** (`parity/run.ts` lines 270-272):

```typescript
// 3.8.0 — version-skew: attach the X-VMS-Client-Build header when the step declares one.
const headers: Record<string, string> = {};
if (step.clientBuild != null) headers["X-VMS-Client-Build"] = step.clientBuild;
init = { method: "POST", body: form, headers };
```

**GAP the planner must close:** the current `parity/run.ts` only reads `step.clientBuild` on the POST branch (lines 245-272). To exercise GET-stale-header, the GET branch (lines 242-244) also needs a `clientBuild`-to-header hoist:

```typescript
// Current GET branch (lines 242-244):
if (step.method === "GET") {
  url = `${cfg.baseUrl}${step.endpoint ?? fixture.endpoint}`;
  init = { method: "GET" };
}
// Needs to become:
if (step.method === "GET") {
  url = `${cfg.baseUrl}${step.endpoint ?? fixture.endpoint}`;
  const headers: Record<string, string> = {};
  if (step.clientBuild != null) headers["X-VMS-Client-Build"] = step.clientBuild;
  init = { method: "GET", headers };
}
```

**New fixture steps** (planner writes — extend `helpdesk.json` or add a dedicated `version-skew-guard.json` fixture; the CONTEXT `<decisions>` and `<canonical_refs>` name Phase 26's helpdesk-seeded as the precedent for adding coverage as a separate file):

```json
{ "id": "agt-get-build-match", "method": "GET", "endpoint": "/api/agent",
  "clientBuild": "helpdesk-build-1",
  "expectBodyContains": ["\"ok\":true"],
  "$comment": "9.0.0 — GET path with matching X-VMS-Client-Build header passes; response is normal." },
{ "id": "agt-get-build-stale", "method": "GET", "endpoint": "/api/agent",
  "clientBuild": "OLD-BUILD-999",
  "expectStatus": 400,
  "expectBodyContains": ["stale_client"],
  "compareIgnoreFields": ["errors.0.message"],
  "$comment": "9.0.0 — GET path with mismatched header → 400 stale_client. This is the branch the pre-9.0.0 fixture COULD NOT REACH (GETs bypassed the guard entirely); the expectBodyContains 'stale_client' is the coverage tripwire that fails loudly if the global guard regresses to opt-in per-controller only." },
```

**Backend prerequisite:** both HelpDesk twins (dotnet + bun) must call `AddVmsShellVersioning("helpdesk-build-1")` (they already do per the shipped POST-side fixture steps working). No new backend config needed.

---

## Shared Patterns

### Null-omission (AGENTS.md gotcha #8)

**Source:** AGENTS.md gotcha #8. **Apply to:** any new .NET record field.

Phase 29 adds NO new wire fields (CONTEXT `<decisions>` locks: "Wire is additive (no new envelope fields)"). No `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` decisions required — the phase modifies behavior, not schema. The `expectBodyContains` on the parity steps still passes through `findNulls` (which is what would surface an accidental null on the wire), so any regression is caught for free.

### Fail-loud vs fail-quiet capability posture

**Source:** `viewmodel-shell/src/index.ts` lines 3413-3423 (`failCapability` helper) and `Adapter` interface lines 61-127. **Apply to:** the new `showSkewLock` verb.

The verb is FAIL-QUIET BY ABSENCE (per CONTEXT `<decisions>` and Adapter interface conventions). Do NOT call `failCapability` when it is absent — the `VmsActionError` / `VmsVersionSkewError` already surface via `onError`, so an adapter without the modal verb still learns of the skew. This mirrors the shipped `toast?` / `reload?` / `setBusy?` posture, NOT the shipped `navigate?` / `storage?` / `saveFile?` posture.

**Concrete decision rule** (from Adapter interface line 111, `toast` TSDoc):

> "FAIL-QUIET BY ABSENCE — modeled on setPreventUnload/setBusy, NOT on navigate/storage/saveFile: a dropped [X] is a missed UX nicety, never a correctness/security bug, so the core MUST NOT call failCapability when this verb is absent"

Reuse this clause almost verbatim in the new verb's TSDoc.

### Documentation twins (AGENTS.md convention)

**Source:** `viewmodel-shell/agent-skill.md` + `viewmodel-shell-dotnet/AgentSkill.md` + `parity/check-skill.ts`. **Apply to:** the "Client build / version skew" section (lines 66, 119, 125-128 of agent-skill.md).

The documented behavior changes materially in Phase 29: auto-reload retirement (line 128 currently says "Do not retry the same request against the same build; reload first" — this stays true, but the client-side mechanic changes from silent auto-reload to a user-consented modal button). Update BOTH `viewmodel-shell/agent-skill.md` AND the byte-identical `viewmodel-shell-dotnet/AgentSkill.md` in the same change; `parity/check-skill.ts` will fail the build on drift (this is the enforcement gate — verified at line 27 of that file: `if (tsBytes.length !== dotnetBytes.length || !tsBytes.equals(dotnetBytes)) throw new Error(...)`).

**Existing skill copy to modify:**

- Line 125-128 "Client build / version skew" section — update to describe the hard-lock + the GET-guard.
- Line 119 `stale_client` table row — currently says "The fix is to reload to the current app (re-`GET` the endpoint for a fresh `vm`/`state`), not to retry the same request" — the agent-facing behavior is unchanged (agents STILL reload on stale_client); the browser-facing behavior IS what changed. Agent-skill copy may need only a small update.

### Test scaffolding reuse (SpyAdapter + stubFetch)

**Source:** `viewmodel-shell/test/version-skew.test.ts` lines 24-48. **Apply to:** all new adapter tests for the skew-lock behavior.

The existing `SpyAdapter` + `makeAdapter` + `stubFetch` helpers are already generic. Extend `SpyAdapter` with `skewLocks: number` and add `showSkewLock` to the adapter constructor. Every new test in the file can then use the same helpers — no new scaffolding file needed.

## No Analog Found

None. Every file modified in Phase 29 is an EXISTING file with a strong in-tree analog (usually the shipped predecessor being tightened, or a sibling shipped verb on the same interface). This is a maintenance-of-shipped-primitive phase, not a new-subsystem phase — the tables above never have a "no analog" row.

## Metadata

**Analog search scope:**
- `viewmodel-shell/src/` (core shell + browser adapter + server subpath)
- `viewmodel-shell/styles/default.css` (framework-owned CSS)
- `viewmodel-shell/test/` (framework vitest suite)
- `viewmodel-shell/agent-skill.md` (agent-facing doc)
- `viewmodel-shell-dotnet/*.cs` (.NET framework source + tests)
- `parity/` (harness + fixtures + skill parity gate)

**Files scanned (Read tool):** 13
- `viewmodel-shell/src/index.ts` (targeted line ranges: 50-180, 2855-2975, 3010-3080, 3075-3260, 3410-3510)
- `viewmodel-shell/src/browser.ts` (targeted: 1-50, 66-95, 470-518, 2282-2360, 4700-4750)
- `viewmodel-shell/src/server.ts` (targeted: 1315-1432)
- `viewmodel-shell/styles/default.css` (targeted: 2355-2405, 2595-2650, alert/warning grep)
- `viewmodel-shell-dotnet/Versioning.cs` (full: 180 lines)
- `viewmodel-shell-dotnet/ViewModels.cs` (targeted: 585-615, 3960-3990)
- `viewmodel-shell-dotnet/ShellExceptionFilter.cs` (full: 193 lines)
- `viewmodel-shell-dotnet/Tests/VersioningTests.cs` (full: 294 lines)
- `viewmodel-shell/test/version-skew.test.ts` (full: 242 lines)
- `parity/fixtures/helpdesk.json` (full: 48 lines)
- `parity/fixtures/helpdesk-seeded.json` (full: 31 lines)
- `parity/fixtures/feature-probe-envelope.json` (full: 47 lines)
- `parity/run.ts` (targeted: 240-330)
- Grep-only: `parity/check-skill.ts`, `viewmodel-shell/agent-skill.md`

**Pattern extraction date:** 2026-08-02
