# Migration Guide

This document tells downstream app maintainers exactly what (if anything) to update,
what is explicitly **NOT breaking** and why, and the two non-obvious silent behaviors
to be aware of. It is copy-pasteable — every command and version string is concrete.

---

## Upgrading to `3.3.0` / `3.3.0` (npm + NuGet) — no action for apps

**Nothing to do** for normal app code — same node types, same wire token (`viewmodel-shell/1.0`), same public API. It's a correctness/a11y/parity hardening release (see CHANGELOG 3.3.0): the `fits` validation blind spot is closed, focus/caret survives re-render on table-filter/tab/checkbox controls, a `vm`-less non-redirect response no longer blanks the page, a `state`-less JSON action returns a clean 400 `parse_error` instead of a 500, and `ProgressNode`/`ImageNode`/unknown-node handling got a11y + fail-loud fixes.

**One non-breaking wire normalization (.NET only), relevant ONLY if you parse the raw .NET JSON:** the optional booleans `LinkNode.External`, `SectionLink.External`, `FieldNode.Required`, and `TableColumn.Sortable`/`Filterable`/`LinkExternal` now drop their `false` default — they are **absent on the wire when false** instead of `"field": false`, matching the TypeScript backend and the framework's "unset optional = absent" rule. Absent and `false` are semantically identical for these fields, and the `@ashley-shrok/viewmodel-shell` browser client + the TUI already treat them so — **no code change needed** unless you string-matched a literal `"external": false` (etc.) in the raw .NET response. The `*-bun` demos that previously hand-wrote `external: false`/`required: false` to mirror the old .NET output had those compensations removed.

---

## Upgrading to `3.1.0` / `3.1.0` (npm + NuGet) — additive, no action

**Nothing to do.** Three additive features (#22): `ButtonNode.width?: "auto" | "full"` (the standard full-width button — `"full"` stretches to fill its container), the new `DividerNode { orientation? }` (a thematic-break/separator → `<hr class="vms-divider">` or a vertical `role="separator"` div), and `FormNode.submitButton?: ButtonNode` (provide your own submit button — e.g. `width:"full"` — instead of the auto-generated one; when set, it takes precedence over `submitLabel`/`submitAction`). Omitting all three is byte-identical to 3.0.x.

---

## Upgrading to `3.0.0` / `3.0.0` (npm + NuGet) — BREAKING: unified appearance axes

The overloaded `variant` field is split into orthogonal axes so no field does two jobs. If your app never set `variant`/`style` beyond defaults, this is a bump-and-go. Otherwise, rename per this table — the TypeScript compiler and `tsc` flag every call site, and the .NET records no longer have the old members (compile errors point you to each one):

| Old | New |
|---|---|
| Button/CopyButton `variant:"primary"` / `"secondary"` | `emphasis:"primary"` / `"secondary"` |
| Button/CopyButton `variant:"danger"` | `tone:"danger"` |
| (new) make a button smaller/larger | `size:"sm"` / `"lg"` (omit = the default md size) |
| TextNode `style:"error"` | `tone:"danger"` (keep `style` for typography) |
| TextNode `style:"warning"` | `tone:"warning"` |
| ListItem/TableRow `variant:"active"/"done"/"moving"/"running"/"disabled"/"high"` | `state:"…"` |
| ListItem/TableRow `variant:"critical"` | `tone:"danger"` |
| ListItem/TableRow `variant:"warning"/"success"` | `tone:"warning"/"success"` |
| Section `variant:"card"` | **unchanged** (and now also accepts `tone`) |

The axes compose, which the old single field couldn't express: a prominent destructive button is `emphasis:"primary" + tone:"danger"` (filled red), and a status card is `variant:"card" + tone:"warning"`.

**Custom CSS callers:** `.vms-text--error` is renamed to `.vms-text--danger`; the `.vms-table__row--critical` alias is gone (use `--danger`). New classes: `.vms-button--{sm,lg}`, `.vms-button--{danger,warning,success,info}`, `.vms-section--{danger,warning,success,info}`. Per the framework's design system you shouldn't be authoring these in app CSS — but if you targeted `.vms-text--error` in an override, update it.

**Visual change to expect:** buttons are now uniformly sized within a size tier (the old `--primary`/`--secondary` size drift is gone — emphasis only changes fill/color), and all buttons hug-left consistently (base `align-self: flex-start`, which only `--primary` had before). Re-check any layout that relied on a secondary/danger button stretching full-width.

**NOT breaking / unchanged:** the dispatch + state + response-envelope wire contract (protocol token stays `viewmodel-shell/1.0`); `LinkNode.active`; the entire layout vocabulary; every other node and field. An agent that only reads `{vm, state}` and dispatches actions keeps working — these are presentational node fields, not the driving contract.

---

## Upgrading to `2.1.0` / `2.1.0` (npm + NuGet) — additive, no action

**Nothing to do.** This release adds **`LinkNode.active`** (`active?: boolean` in TS, `bool? Active` in .NET) — set it `true` on the nav link that represents the current page to get a "you are here" highlight (`.vms-link--active` + `aria-current="page"`). It's server-owned and optional; omitting it is byte-identical to 2.0.0.

**One cosmetic change to be aware of:** the `row` layout preset now uses a larger inter-item gap (`--vms-space-lg` = 1.5rem, was the inherited 0.75rem) so navbars/toolbars aren't cramped. This is CSS-only and affects every `layout:"row"` section. If you specifically want the old tighter spacing back, set `--vms-space-lg` on that row through the `--vms-*` token seam (a tiny `:root`/scoped stylesheet — never an HTML `<style>` block).

---

## Upgrading to `2.0.0` / `2.0.0` (npm + NuGet) — BREAKING: `flyout` removed

**The only breaking change: `SectionNode.flyout` is gone.** If you never used it (the overwhelming common case — it was a one-release-old hover-overlay primitive), this upgrade is a no-op: bump and go, nothing else changed.

**If you DID set `flyout: true` on a section**, the TS type / .NET record no longer has the field (a compile error points you to each call site). Replace it with whichever fits:

| You were using flyout for… | Use instead |
|---|---|
| An inline "show more" disclosure | **`collapsible: true`** — robust on touch + keyboard, open-state preserved across re-renders. |
| Overlay content (dialog-ish) | A **`modal`** node. |
| A navbar dropdown / submenu | A **`link`** (or `variant:"card"` link) to a **sub-page** — what the original consumer settled on after the flyout hover-gap bug. |

**NOT breaking / unchanged:** the dispatch + state + response-envelope wire contract (protocol token stays `viewmodel-shell/1.0`); every other ViewNode and field; the entire 1.12 layout vocabulary (`arrange`/`align`, `switcher`, `cards minItem`, `fits`). An agent that only reads `{vm, state}` and drives actions is unaffected — `flyout` was a presentational section flag, not part of the driving contract.

---

## Upgrading to `1.11.0` / `1.9.0` (npm + NuGet)

Additive — **nothing required.**

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.10.0` | **`1.11.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.8.0` | **`1.9.0`** |

### What changed

Two additive `SectionNode`/`PageNode` primitives, both opt-in:

- **`layout: "row"`** — a new value in the layout closed union (Page + Section): a left-aligned wrapping horizontal row. Omitting it is byte-identical to before.
- **`SectionNode.flyout?: boolean`** (.NET `Flyout`) — an overlay (hover/focus) disclosure, the sibling of the existing inline `collapsible`. Pure CSS, no JS. Omitting it is byte-identical to before.

No wire-shape change; protocol token stays `viewmodel-shell/1.0`. Old agents/apps that don't use the new fields are unaffected.

### Do I need to do anything?

No. **To adopt them**, compose a navbar from primitives instead of hand-rolling one — a `row` section of links plus a `flyout` section for a menu:

```ts
// a simple top nav, zero app CSS
{ type: "section", layout: "row", children: [
    { type: "link", label: "Home", href: "/" },
    { type: "link", label: "Invoices", href: "/invoices" },
    // a hover/focus menu — overlays instead of pushing the bar open
    { type: "section", flyout: true, heading: "Admin", children: [
        { type: "link", label: "Users", href: "/admin/users" },
        { type: "link", label: "Settings", href: "/admin/settings" },
    ] },
] }
```

Notes:
- Reach for **`flyout`** (overlay) rather than **`collapsible`** (inline `<details>`) when the revealed content should float over siblings — e.g. a menu inside a `row` bar, where an inline disclosure would shove the bar open.
- Section modes are mutually exclusive with a fixed precedence — **`collapsible` > `flyout` > `link` > `action`** — so don't set more than one; a lower-precedence mode is silently ignored if a higher one is also set.
- **TUI:** `flyout` has no terminal overlay, so it degrades to a plain labeled section (children shown inline). `layout:"row"` lays children in a row.

---

## Upgrading to NuGet `1.8.0` (NuGet only)

Additive — **nothing required.**

| Package | From | To |
|---|---|---|
| `AshleyShrok.ViewModelShell` (NuGet) | `1.7.0` | **`1.8.0`** |
| `@ashley-shrok/viewmodel-shell` (npm) | `1.10.0` | unchanged (`1.10.0`) |

### What changed

New `IApplicationBuilder` extension **`app.UseVmsShellStaticFiles(options?, noCacheSuffixes?)`** — a drop-in replacement for `app.UseStaticFiles()` that adds `Cache-Control: no-cache` to SPA shell HTML (default suffix `.html`), so a deploy is never masked by a browser-cached shell pinning an old asset bundle. No wire/type/protocol change.

### Do I need to do anything?

No. **To adopt it**, swap one line in `Program.cs`:

```csharp
// before
app.UseStaticFiles();
// after — shell HTML revalidates every load; hashed assets keep default caching
app.UseVmsShellStaticFiles();
```

Pass `noCacheSuffixes` (e.g. `["html", "sw.js", "config.json"]`) to cover other non-hashed, stable-URL files. A caller-supplied `StaticFileOptions.OnPrepareResponse` is preserved and runs first.

---

## Upgrading to `1.10.0` / `1.7.0` (npm + NuGet)

Additive — **nothing required.**

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.9.0` | **`1.10.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.6.0` | **`1.7.0`** |

### What changed

New optional **`rejected: { violations: [{ path?, message, code? }] }`** field on the `ok:true` response envelope — a soft/domain-validation rejection that still re-renders (vm/state preserved). It does **not** touch the `ok:false` / `errors[]` failure channel, so existing `onError` consumers are unaffected, and the browser shell ignores it harmlessly. Old agents that don't check `rejected` keep working. Protocol token stays `viewmodel-shell/1.0`.

### Do I need to do anything?

No. Two optional notes:

- **To adopt it:** when an action is refused but you want to keep the user's input, attach a rejection to the normal re-render. npm: `return { vm, state, ...shellRejection([{ path: "field", message: "…" }]) };`. .NET: `new ShellResponse<T>(BuildVm(state), state).WithRejection([new ErrorEntry("…", Path: "field")])`. Omit `path` for a form/action-level rejection with no single field.
- **If you drive a VMS app over the JSON wire as an agent:** on an `ok:true` response, also check for `rejected` — its presence means the action did **not** take effect (the violations tell you why; vm/state still hold the typed input).

---

## Upgrading to `1.9.0` / `1.6.0` (npm + NuGet)

Two changes, both **non-breaking — nothing required**.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.8.0` | **`1.9.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.5.0` | **`1.6.0`** |

### What changed

1. **New opt-in `FormNode.submitOnEnter`** (TS `submitOnEnter?: boolean` / .NET `bool? SubmitOnEnter`, appended as the last positional record param with a `null` default). Defaults to off, so existing forms are unaffected and existing `new FormNode(...)` positional call sites compile unchanged. Set it `true` on a form with a `submitAction` to make a bare `Enter` in a `<textarea>` submit (Shift/Ctrl/Meta/Alt+Enter and IME composition stay newlines).
2. **Modal backdrop no longer animates on open.** The `vms-in` entry animation was removed from `.vms-modal-backdrop` because it replayed on every in-modal dispatch (the renderer rebuilds the DOM each action), making modals re-flash. Modals now appear instantly.

### Do I need to do anything?

No. Two optional notes:

- To adopt Enter-to-send on a composer, set `submitOnEnter: true` on the form (it only acts when `submitAction` is present).
- If you *want* the modal fade-in back, re-add the rule **after** importing the stylesheet:

```css
/* app-tokens.css — imported after viewmodel-shell styles/theme */
@keyframes vms-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
.vms-modal-backdrop { animation: vms-in 0.15s ease; }
```

---

## Upgrading to `1.8.0` (npm @ashley-shrok/viewmodel-shell only)

Input placeholders now render as a **faint hint** (theme text color at 50% opacity) instead of the higher-contrast `--vms-text-muted`. **Nothing to do** — it's an automatic stylesheet change with no wire, type, or API impact.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.7.0` | **`1.8.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.5.0` | unchanged (`1.5.0`) |

### What changed (one paragraph)

`.vms-field__input::placeholder` was `color: var(--vms-text-muted)` (≈5.1:1 on white — readable enough to be mistaken for real entered text in an empty field). It is now `color: var(--vms-text); opacity: 0.5` (≈3.5:1), matching the browser-default / Bootstrap convention so a placeholder reads as a hint, not committed content. Because it fades the theme's own text color rather than using a fixed gray, it adapts across all 12 themes automatically.

### Do I need to do anything?

No. If you *want* the old high-contrast placeholders back, override the single rule **after** importing the stylesheet:

```css
/* app-tokens.css — imported after viewmodel-shell styles/theme */
.vms-field__input::placeholder { color: var(--vms-text-muted); opacity: 1; }
```

Note the trade-off you'd be re-opting into: high-contrast placeholders are more legible but read as real text. The framework's stance is that placeholders should never be the sole label — pair inputs with a `label`.

---

## Upgrading to `1.7.0` (npm @ashley-shrok/viewmodel-shell only)

Per-row table checkboxes now render in a **leading** (left) column instead of the trailing actions cell. This is a client-side rendering change in the BrowserAdapter — there is no wire-format, type, or API change.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.6.0` | **`1.7.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.5.0` | unchanged (`1.5.0`) |

### What changed (one paragraph)

`TableRow.actions[]` is a mix of `ButtonNode` and `CheckboxNode`. Previously the renderer placed all of them in one trailing `vms-table__td--actions` cell, so selection checkboxes sat on the far right. The renderer now partitions by `entry.type`: `CheckboxNode`s render in a dedicated leading `vms-table__td--select` column (with a matching leading `vms-table__th--select` header so columns stay aligned), `ButtonNode`s stay in the trailing actions cell. This matches the data-grid / Gmail convention (selection leads the row).

### Consumer action required: none.

Existing apps re-render automatically — no code change. Backends keep emitting `actions[]` exactly as before; nothing on the wire changed.

### Not breaking

- No `ViewNode` field added or removed; no JSON wire shape change; protocol token stays `viewmodel-shell/1.0`.
- No HTTP response envelope change.
- No stylesheet change — the renderer reuses the already-shipped `.vms-table__th--select` / `.vms-table__td--select` classes.
- The .NET package is unchanged at `1.5.0` (only a doc-comment was updated in the repo source, which ships with the next functional .NET release).

### Heads-up (visual only)

If you have screenshot/visual-regression baselines of tables with per-row checkboxes, regenerate them — the checkbox column moved from right to left. Functional/DOM-structure tests that select `.vms-table__td--select input[type=checkbox]` are correct; ones that assumed the checkbox lived under `.vms-table__td--actions` need updating.

---

## Upgrading to `1.6.0` / `1.5.0` (lockstep — npm @ashley-shrok/viewmodel-shell + NuGet AshleyShrok.ViewModelShell)

1.6.0 / 1.5.0 ships a canonical agent skill — a self-contained markdown operating manual for the VMS wire protocol that an external agent (curl, WebFetch, an LLM) can `GET` over HTTP to learn how to drive a VMS app without a browser. New helper APIs (`MapVmsAgentSkill` on .NET, `createAgentSkillHandler` on TS) make mounting the endpoint a one-liner. The existing `<meta name="viewmodel-shell">` discoverability tag gains an optional `skill` field pointing at the served URL. Both packages move in lockstep because the canonical markdown is shipped from both (npm `files` array; NuGet logical resource), kept byte-identical by a parity gate.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.5.0` | **`1.6.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.4.0` | **`1.5.0`** |

### What changed (one paragraph)

Today, the BrowserAdapter encapsulates the entire wire protocol (multipart `_action` + `_state`, JSON-body opt-in, state round-trip rules, bind paths, response envelope, side-effect verbs, polling, dispatch guard, file persistence) for human visitors who load the app in a browser; an agent driving the API cold (curl, WebFetch, an LLM) sees a JSON tree but none of the operating knowledge. The canonical agent skill closes that gap with a tight, imperative ~1-3-page operating manual mounted at `/.well-known/vms-skill.md` (or wherever you choose) and advertised via the meta tag's new `skill` field. Apps may prepend an optional preamble (auth specifics, domain context) above the canonical body.

### Consumer action required: none.

The skill is additive — apps that don't mount the endpoint and don't add the `skill` field behave exactly as 1.5.0 / 1.4.0. Old agents that don't know about the field ignore it. No wire-shape change.

### Not breaking

- No `ViewNode` field added or removed; no JSON wire shape change.
- No HTTP response envelope change.
- No CSS or DOM change.
- The existing `<meta name="viewmodel-shell">` JSON content is forward-compatible with the new optional field — old agents skip unknown fields.
- Every existing demo's controllers and routes compile and run unchanged.

### New capability — opt-in mount

To advertise a skill to agents driving your VMS app:

**.NET (ASP.NET Core minimal API or controllers):**
```csharp
using ViewModelShell;

app.MapControllers();
app.MapVmsAgentSkill(appPreamble: "This is the foo app. Auth: Bearer JWT in Authorization."); // optional preamble
app.MapFallbackToFile("index.html");
```

Mount the skill BEFORE `MapFallbackToFile` so the explicit `MapGet` route claims `/.well-known/vms-skill.md` before the SPA fallback. The body is built ONCE at mount time; if the embedded resource is somehow missing, the call throws `InvalidOperationException` immediately (fail-loud, not on first request).

**TypeScript (Bun shown; same shape for Deno/Hono/Cloudflare Workers):**
```typescript
import { createAgentSkillHandler } from "@ashley-shrok/viewmodel-shell/server";

const skillHandler = createAgentSkillHandler({
  appPreamble: "This is the foo app. Auth: Bearer JWT in Authorization.",
});

Bun.serve({
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/.well-known/vms-skill.md" && req.method === "GET") {
      return skillHandler(req);
    }
    // ... your existing routes
  },
});
```

Then add the `skill` field to your app's `<meta name="viewmodel-shell">` tag:
```html
<meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/x","actionEndpoint":"/api/x/action","skill":"/.well-known/vms-skill.md"}'>
```

Agents that fetch the meta tag will see the skill URL, fetch it, and read the canonical protocol manual — or your preamble prepended above it under a `## App-specific notes` heading.

### What's new at the meta-tag level

- New optional `skill` field on the meta-tag JSON content. Pointing it at the URL where you mounted the helper is the entire integration. Old agents not aware of the field ignore it.
- The `protocol` token still tracks the **wire shape** (currently `viewmodel-shell/1.0`), not the package version. A package can be 1.6.0 while the protocol token is `viewmodel-shell/1.0` because the wire shape hasn't broken.

### Working example

`demo/HelpDesk/AspNetCore/Program.cs` (and its bun twin `demo/HelpDesk-bun/server.ts`) mount the skill at `/.well-known/vms-skill.md` with a short preamble naming the app's domain. Both `agent.html` and `requester.html` carry the `skill` field. The parity gate (`parity/check-skill.ts`) GETs the URL from both backends and asserts byte-identical bodies + correct content-type + preamble plumbing — a useful reference for verifying your own mount.

---

## Upgrading to '1.5.0' / '1.4.0' (lockstep — npm @ashley-shrok/viewmodel-shell + NuGet AshleyShrok.ViewModelShell)

1.5.0 / 1.4.0 adds `SectionNode.link` — a URL-link navigator variant of the clickable-card primitive. Mirrors `SectionNode.action` (1.4.0 / 1.3.0 — see entry below) but emits a wrapping `<a href>` instead of a dispatcher `<section role="button">`, so every native browser link affordance works for free (middle-click new tab, Ctrl/Cmd-click, right-click context menu, drag-to-bookmarks, status-bar URL preview, accessible link semantics). Both packages move in lockstep because it is an additive wire field on both backends; the wire stays byte-identical when `link` is omitted, so a server upgraded ahead of its clients is fully back-compatible (and vice versa).

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.4.0` | **`1.5.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.3.0` | **`1.4.0`** |

### What changed (one paragraph)

`SectionNode.action` (the 1.4.0 / 1.3.0 dispatcher primitive) covers the case where clicking a card runs server-side work. When a card is conceptually a NAVIGATIONAL link (docs tile, gallery item, launcher tile), nesting a `LinkNode` inside loses click-anywhere ergonomics, and using `.action` + server redirect loses every modifier-click behavior browsers grant anchor elements (middle-click new tab, Ctrl/Cmd-click new tab, right-click context menu, drag-to-bookmarks, status-bar URL preview). `SectionNode.link` is the navigator sibling: set `link: { url, external? }` and the BrowserAdapter emits a wrapping `<a href>` so every one of those affordances works natively. Closes [issue #21](https://github.com/ashley-shrok/ViewModelShell/issues/21).

### Consumer action required: none.

The field is additive and optional. A `SectionNode` without `link` renders byte-identical to 1.4.0 / 1.3.0 (no `<a>` wrapper, no class drift, no `href` / `target` / `rel`, no listeners; the wire stays absent via the existing `JsonIgnore(WhenWritingNull)` posture).

### Not breaking

- The JSON wire is unchanged for every existing section — `link` is omitted on serialization when null. Old clients talking to new servers (and vice versa) work byte-identically; cross-backend parity is green.
- The TUI experimental adapter treats a focused-pane `section.link` as link-actionable so Enter dispatches `navigate(url)` — additive, no removal, no behavior change for existing TUI consumers.
- Every existing demo's .NET call sites compile unchanged — `Link` is a trailing positional param with default `null` so positional `new SectionNode(heading, children, Variant: "card", Action: ...)` keeps working.

### New capability — minimal linked card

**TypeScript (any backend):**
```typescript
const tile: SectionNode = {
  type: "section",
  variant: "card",
  heading: "Read the docs",
  link: { url: "https://example.com/docs", external: true },
  children: [
    { type: "text", value: "Architecture, gotchas, runnable demos.", style: "muted" },
  ],
};
```

**C# (ASP.NET Core controller):**
```csharp
var tile = new SectionNode(
    Heading: "Read the docs",
    Children: new ViewNode[]
    {
        new TextNode("Architecture, gotchas, runnable demos.", "muted"),
    },
    Variant: "card",
    Link: new SectionLink("https://example.com/docs", External: true));
```

The wrapper `<a href>` gives every native browser link affordance for free — middle-click new tab, Ctrl/Cmd-click new tab, right-click context menu, drag-to-bookmarks, status-bar URL preview, accessible link semantics. No `role`, no `tabindex`, no `aria-label` needed; the anchor element provides them natively.

### What the framework rejects (and how to fix)

If you build a tree that violates any rule below, the framework throws at the server edge and the response carries `{ ok: false, errors: [{ code: "invalid_tree", message: "..." }] }` at HTTP 500. This is a hard failure by design — silent rendering of these patterns produces broken click-ownership or invalid HTML.

1. **`action` + `link` on the same section.** A `SectionNode` is either a dispatcher (action) or a navigator (link); they create different user expectations of what a click means. Pick one — drop either `action` or `link`.
2. **`link` + `collapsible: true` on the same section.** A collapsible section's `<summary>` IS the click target; a linked card makes the whole section the click target. Pick one.
3. **`link` nested inside another `link`.** HTML5 prohibits nested `<a>` elements. Restructure so only the outer (or only the inner) section carries `link`.
4. **`link` nested inside `action` (or vice versa).** Click-ownership in the overlap is ambiguous — a linked card inside a dispatcher card, or vice versa, creates two competing primary interactions. Restructure so the outer card alone owns the affordance (refactor the inner to a styling-only `variant: "card"` with no `link` / no `action`).

A styling-only `variant: "card"` inner section (no `link`, no `action`) inside a linked or clickable outer card is explicitly VALID:

```typescript
// VALID — outer card is linked; inner is styling-only.
{
  type: "section",
  variant: "card",
  link: { url: "https://example.com/outer", external: true },
  children: [
    {
      type: "section",
      variant: "card",
      children: [
        { type: "text", value: "Inner styling-only card content" },
      ],
    },
  ],
}
```

---

## Upgrading to '1.4.0' / '1.3.0' (lockstep — npm @ashley-shrok/viewmodel-shell + NuGet AshleyShrok.ViewModelShell)

1.4.0 / 1.3.0 adds `SectionNode.action` — a click-anywhere clickable-card primitive that mirrors `TableRow.action` (1.1.0) at the section level. Both packages move in lockstep because it is an additive wire field on both backends; the wire stays byte-identical when `action` is omitted, so a server upgraded ahead of its clients is fully back-compatible (and vice versa).

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.3.0` | **`1.4.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.2.0` | **`1.3.0`** |

> NuGet catches up from being unchanged in CSS-only npm 1.3.0; this is the first lockstep MINOR for both since [1.2.0](#upgrading-to-120--npm--nuget).

### What changed (one paragraph)

A `SectionNode { variant: "card" }` is styling-only today — making the whole card clickable required an inner `ButtonNode` that split the affordance from the surface. `SectionNode.action` adds the missing primitive: set it and the BrowserAdapter makes the entire section clickable AND keyboard-activatable (Enter / Space; Tab does NOT dispatch) AND accessible (`role="button"`, `tabindex=0`, `aria-label` derived from heading or descendant text or fallback `"Card"`). Clicks on nested ButtonNode / CheckboxNode / LinkNode inside a clickable card stop propagation, so per-card "Close" buttons never double-fire the card action. Tree validation rejects two invalid combos at the server edge (with `code: "invalid_tree"`): (a) `action` + `collapsible: true` on the same section, and (b) a clickable section nested inside another clickable section.

### Consumer action required: none.

The field is additive and optional. A `SectionNode` without `action` renders byte-identical to 1.3.0 (no class drift, no extra attrs, no listeners; the wire stays absent via the existing `JsonIgnore(WhenWritingNull)` posture).

### Not breaking

- The JSON wire is unchanged for every existing section — `action` is omitted on serialization when null. Old clients talking to new servers (and vice versa) work byte-identically; cross-backend parity is green.
- The TUI adapter has no equivalent for click-anywhere cards at this release; it ignores the new field gracefully (no error, no rendering difference).
- Every existing demo's call sites compile unchanged on .NET — `Action` is a trailing positional param with default `null` so positional `new SectionNode(heading, children, Variant: "card")` keeps working.

### New capability — minimal clickable card

**TypeScript (any backend):**
```typescript
const tile: SectionNode = {
  type: "section",
  variant: "card",
  heading: "Open ticket #42",
  action: { name: "select-ticket-42" },
  children: [
    { type: "text", value: "Outlook crash · in progress", style: "muted" },
  ],
};
```

**C# (ASP.NET Core controller):**
```csharp
var tile = new SectionNode(
    Heading: "Open ticket #42",
    Children: new ViewNode[]
    {
        new TextNode("Outlook crash · in progress", "muted"),
    },
    Variant: "card",
    Action: new ActionDescriptor("select-ticket-42"));
```

Identity per card is encoded in the action name (`select-ticket-42`), not a `context` field — consistent with the Phase-6 wire and identical to the `TableRow.action` idiom.

### What the framework rejects (and how to fix)

If you build a tree that violates either rule below, the framework throws at the server edge and the response carries `{ ok: false, errors: [{ code: "invalid_tree", message: "..." }] }` at HTTP 500. This is a hard failure by design — silent rendering of these patterns produces broken accessibility or ambiguous click ownership.

1. **`action` + `collapsible: true` on the same section.** A collapsible section's `<summary>` IS the click target; a clickable card makes the whole section the click target. Pick one — drop either `action` or `collapsible: true`.
2. **Nested `action` inside another `action`.** Nested `role="button"` elements are an a11y violation, and click-ownership in the overlap is ambiguous. Refactor the inner section to a styling-only `variant: "card"` (no `action`) with internal buttons — that case is explicitly VALID:

```typescript
// VALID — outer card is clickable; inner is styling-only with its own buttons.
{
  type: "section",
  variant: "card",
  action: { name: "select-outer" },
  children: [
    {
      type: "section",
      variant: "card",
      children: [
        { type: "button", label: "Close", action: { name: "close-outer" } },
      ],
    },
  ],
}
```

### Issue resolved

- Closes the unfixed half of [#19](https://github.com/ashley-shrok/ViewModelShell/issues/19) via [#20](https://github.com/ashley-shrok/ViewModelShell/issues/20). 1.3.0 addressed the type-scale framing portion ("text feels small"); 1.4.0 / 1.3.0 addresses the structural-hierarchy half ("this card IS the action") by making `SectionNode { variant: "card" }` itself click-bearing, no inner button required.

---

## Upgrading to '1.3.0' (npm @ashley-shrok/viewmodel-shell only)

1.3.0 is a visible default shift in the shipped stylesheet — no wire/API change. The `--vms-text-*` token scale moves up one rung to align with modern web-density norms; `--vms-text-base` is now `0.875rem` (14px) instead of `0.8125rem` (13px). The NuGet package is NOT republished — this change has no .NET surface.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.2.0` | **`1.3.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.2.0` | (unchanged) |

### What changed (one paragraph)

The shipped `default.css` type scale was a desktop-app-density set — buttons, body text, checkboxes, and validation messages all rendered at 13px (`--vms-text-base: 0.8125rem`). That read as small on web/launcher pages where users expect web-scale type. The whole scale shifts up one rung — `xs` 11→12px, `sm` 12→13px, `base` 13→**14**px, `md` 14→16px, `lg` 16→18px, `xl` 22→24px; `2xl` stays at 36px. Spacing tokens (`--vms-space-*`) are unchanged — the complaint was about type, not gaps. None of the shipped themes redefine `--vms-text-*`, so every theme picks up the new scale automatically. No `ViewNode` types, action payloads, or emitted class names change; the parity suite emits byte-identical JSON.

### Not breaking

- The JSON wire is unchanged — old clients talking to new servers (and vice versa) work byte-identically. Cross-backend parity is green.
- The `--vms-*` override seam is unchanged — apps that retuned `--vms-text-base` (or any other token) via the documented per-app `:root{}` override seam keep their override; per-app values still win.
- The TUI adapter is unaffected — terminals have no font-size, so the scale shift is a no-op there.

### Most apps: nothing to do

Bump the npm dep, rebuild, ship. Buttons/body/inputs render ~1 rem rung larger; tables and forms feel slightly more spacious; nothing changes structurally.

### Optional — pin the prior (pre-1.3.0) scale

For apps that deliberately want the old desktop-app-density look (e.g. a dense internal admin tool whose users prefer 13px body), add an `app-tokens.css` to your frontend and import it AFTER your theme:

```css
/* app-tokens.css — pin the pre-1.3.0 type scale */
:root {
  --vms-text-xs:    0.6875rem; /* 11px */
  --vms-text-sm:    0.75rem;   /* 12px */
  --vms-text-base:  0.8125rem; /* 13px */
  --vms-text-md:    0.875rem;  /* 14px */
  --vms-text-lg:    1rem;      /* 16px */
  --vms-text-xl:    1.375rem;  /* 22px */
  --vms-text-2xl:   2.25rem;   /* 36px */
}
```

```typescript
// main.ts
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/light-amber.css"; // your chosen theme
import "./app-tokens.css"; // pin the prior scale — AFTER the theme
```

This is the documented `--vms-*` override seam (see AGENTS.md § Design system), not a workaround.

### Issue resolved

- Closes the framing portion of [#19](https://github.com/ashley-shrok/ViewModelShell/issues/19) (ButtonNode.size — per-button font/padding scale). The presentational `size` prop is **not** added. The original use case (a couple of prominent launcher buttons that should read larger) splits cleanly into two existing concerns: (1) "text feels small" — addressed at the scale level by this release; (2) "this button is structurally more important" — addressed by wrapping the action in a `SectionNode variant:"card"` tile with a heading + short blurb, which is how VMS expresses hierarchy semantically. See `demo/Showcase/` archetype views for the canonical card-tile idiom.

---

## Upgrading to '1.2.0' (npm @ashley-shrok/viewmodel-shell + NuGet AshleyShrok.ViewModelShell)

1.2.0 is purely additive. A new client-side aesthetic disclosure primitive lands on `SectionNode`; no consumer code changes are required to upgrade.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.1.0` | **`1.2.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.1.0` | **`1.2.0`** |

### What changed (one paragraph)

`SectionNode` gains two optional wire fields: `collapsible?: boolean` and `id?: string`. With `collapsible: true`, the browser adapter renders the section as a native `<details>`/`<summary>` widget (closed on first render); the heading becomes the summary label. The open/closed state is DOM-local — the server does NOT round-trip it (intentional, mirrors the framework's existing draft-text preservation precedent). The adapter snapshots `<details>.open` before each re-render and restores it after, keyed by `id ?? heading ?? "vms-section-anon"` (disambiguated by per-render ordinal when keys collide). With `collapsible` omitted/false, the section renders byte-identical to 1.1.0. The .NET side gains the lockstep `Collapsible: bool?` + `Id: string?` parameters at the END of the `SectionNode` positional list (both with `JsonIgnore` null-omission) so existing positional call sites compile unchanged.

### Not breaking

- All existing `SectionNode` call sites — TypeScript or .NET, positional or named — keep working byte-identically. `collapsible` and `id` default to omitted, the wire stays additive, and the renderer's `collapsible !== true` branch is the pre-1.2.0 `<section>` code path verbatim.
- The TUI adapter is unaffected: it destructures only the `SectionNode` fields it uses, so new optional fields are naturally ignored.
- Cross-backend parity is green: the new wire field flows identically through both the .NET and bun helpdesk backends in the canonical fixture.

### Escape hatch — server-driven expansion

For the rare case an app legitimately needs server-driven open state (e.g. auto-expand the section containing a server-rendered validation error after a re-render): **re-key the section.** Change the heading, change the `id`, or wrap the section in an additional node — any of those changes the snapshot key the renderer derives, the preserved open state is dropped, and the section re-renders in its (closed) default. This is the documented rare-case escape hatch; the framework deliberately ships **no `forceExpand` / `defaultOpen` wire field**. If a section needs to start open every time, don't mark it collapsible.

---

## Upgrading to '1.1.0' (npm @ashley-shrok/viewmodel-shell + NuGet AshleyShrok.ViewModelShell)

1.1.0 is additive. Two related `TableNode` bug fixes ship as one minor bump; no consumer code changes are required to upgrade. The optional cleanup below is for apps that worked around either bug.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `1.0.0` / `1.0.1` | **`1.1.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `1.0.0` | **`1.1.0`** |

### What changed (one paragraph)

`TableRow.action` is back — set it to an `ActionEvent` (TS) or `ActionDescriptor` (.NET) and the entire row becomes click-anywhere with full keyboard (Enter / Space — Space preventDefaults page scroll) and ARIA (`role="button"`, `tabindex=0`, `aria-label` from cell text). Per-row buttons, checkboxes, and cell `linkLabel` anchors `stopPropagation` so they don't also fire the row action. Separately, `TableRow.actions[]` is now `(ButtonNode | CheckboxNode)[]` on TS (was `ButtonNode[]`); the renderer dispatches by `entry.type`, so a `CheckboxNode` entry actually renders as `<input type="checkbox">` instead of silently rendering as an empty button. The .NET side stays `IReadOnlyList<ViewNode>` for polymorphic-discriminator emission. See `demo/HelpDesk/AspNetCore` and `demo/HelpDesk-bun` for the canonical pattern (row.action for navigation, row.actions[] for the selection checkbox).

### Optional cleanup (apps that worked around the broken renderer)

If you avoided putting non-`ButtonNode` entries in `row.actions[]` because they rendered as empty buttons — you can stop. Drop the workaround:

- Per-row selection checkboxes that were rendered in a `cells[…]` column to dodge the broken renderer can move back into `row.actions[]` as `CheckboxNode` entries; they will render correctly now.
- Per-row "Open"/navigation buttons whose only job was to dispatch a `select-row-{id}` action can be replaced by setting `row.action = { name: "select-row-{id}" }` (TS) or `Action: new ActionDescriptor("select-row-{id}")` (.NET). You get the click-anywhere UX plus keyboard + ARIA for free.

### Not breaking

- All existing `row.actions[]` arrays of pure `ButtonNode` entries keep working byte-identically.
- Rows without `row.action` get no `--clickable` class, no `tabindex`, no `role`, no `aria-label` — backward-compatible.
- Wire is additive: a 1.0.x backend not setting `Action` produces JSON with no `action` field (the `[JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` rule applies); a 1.1.0 client renders it as a non-clickable row.

---

## Upgrading to '1.0.0' (npm @ashley-shrok/viewmodel-shell + NuGet AshleyShrok.ViewModelShell)

1.0.0 is the milestone where the wire becomes truly self-describing: an agent reading only `{vm, state}` from a GET response and walking the tree can drive any VMS app end-to-end identically to the browser renderer. Two breaking changes ship together: the `context` payload is GONE from the wire, and every response now carries a framework-set `ok` flag with a uniform `{ok: false, errors: [...]}` envelope for failures.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.16.0` | **`1.0.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.16.0` | **`1.0.0`** |

### What changed (consolidated across Phase 6 + Phase 7)

1. **Context payload eliminated.** The dispatch wire is now `{action: {name}, state, files?}`. Every input node declares a `bind` path naming where its value lives in state; the renderer reads/writes through the path. The seven distinct context-assembly code paths in the renderer collapsed into one bind-path interpreter. WIRE-01..WIRE-08.

2. **Action-name uniqueness rule.** Every dispatch-bearing node carries an action name only. Per-row identity is encoded IN the action name (`delete-row-42`, not `delete-row` with context). The framework enforces "one action name = one operation" at tree-build time; `ValidateActionNames` throws on violations. WIRE-04, WIRE-05.

3. **Framework-owned `ok` flag on every response.** Every framework-rendered response now carries `ok: true | false` at the top level. Normal renders, redirects, sideEffects-only responses, polls — all uniformly carry `ok: true`. Framework-detected failures (malformed payload, unknown action, uncaught exception) carry `ok: false` with a structured `errors[]` array. Agents check one field. ERROR-03.

4. **`{ok: false, errors: [{path?, message, code?}]}` envelope.** Replaces the old `{error: msg}` body shape on framework failures. `errors` is always an array; entries always have `message`; `path` and `code` are optional and ABSENT from the wire when not set (no `"path": null` etc.). Initial `code` vocabulary is small + stable + framework-only: `"parse_error"`, `"unknown_action"`, `"invalid_tree"`, `"uncaught_exception"`. App handlers never set `code`. ERROR-01, ERROR-02.

5. **`UnknownActionError` (TS) / `UnknownActionException` (.NET).** New public exception classes — your dispatch `default:` arm throws this with the unknown name; the framework catches and surfaces `code: "unknown_action"`. No framework-shipped router primitive; you keep your switch-or-startsWith convention.

6. **`VmsActionError` on the client side.** New exported class extending `Error` with `errors: ErrorEntry[]`, `status: number`, and a `code?` shortcut. Surfaced via the existing `onError` callback — non-VMS apps that wired `onError` for fetch failures keep working unchanged. Apps that want structured failure handling do `if (err instanceof VmsActionError) { ... err.errors ... }`.

7. **`BadRequestError` / `BadRequest("...")` semantic split.** Stays in the public API on both backends, but the wire shape changes: the framework now wraps it into `{ok: false, errors: [{message: ...}]}` (no `code`). Reserved for structurally-invalid requests the user can't see (missing required action field); NOT for routine app validation. State-based validation (TextNode error + ValidationError state field — gotcha #4) is unchanged — those responses are still `ok: true`.

### Migration recipe (single end-to-end pass for any consumer on 0.4.x or 0.16.x)

For each VMS app you maintain:

**Step 1 — Inputs.** Every input node now declares a `bind` path. Audit `FieldNode`, `CheckboxNode`, `TextareaNode`, `SelectNode`, `FileInputNode`, etc. — add `bind: "path.to.field"` matching where the value lives in your state record. Remove any code that harvests field values out of the DOM on submit.

**Step 2 — Action names.** Every per-row / per-operation action name must be unique. Replace `{name: "delete-row", context: {id: 42}}` patterns with `{name: "delete-row-42"}`. The convention is yours — slashes (`row/42/delete`), dashes (`delete-row-42`), or anything else you like; the framework only checks uniqueness. Run a build / GET against your dev server — `ValidateActionNames` will throw on the first violation with a precise diagnostic.

**Step 3 — Dispatch handlers.** Read your action handlers — anywhere they pull from `payload.context` becomes `payload.state` (the state record carries the values now). Switch on `payload.name`; if you need to extract a per-row id, parse the action name (`name.startsWith("delete-row-")` -> `parseInt(name.slice("delete-row-".length))`).

**Step 4 — `default:` arm.** Replace:
- `.NET`: `return BadRequest($"Unknown action: {name}")` → `throw new UnknownActionException(name)`.
- `TS`: `throw new BadRequestError(\`Unknown action: ${name}\`)` → `throw new UnknownActionError(name)`.

Add the new exception class to your import block (`using ViewModelShell;` already covers .NET; on TS, add `UnknownActionError` to your `@ashley-shrok/viewmodel-shell/server` import).

**Step 5 — .NET only: register the framework exception filter.** In each `Program.cs`, add `options.Filters.Add<ShellExceptionFilter>()` to your `AddControllers(...)` lambda. This wires the envelope-construction edge — without it, .NET apps won't emit envelope responses on thrown exceptions.

**Step 6 — Client `onError`.** Optional: if you want to branch on failure class, change your `onError` handler from `(err) => { console.error(err.message) }` to:
```typescript
onError: (err) => {
  if (err instanceof VmsActionError) {
    // err.errors[] has structured info; err.code === "unknown_action" / "parse_error" / etc.
  } else {
    // network/parse failure — plain Error
  }
}
```

**Step 7 — Side effects.** No changes needed: redirects, sideEffects, polling, busy, preventUnload, and the multipart file channel are unchanged.

### What you DON'T need to change

- State-based validation (TextNode + ValidationError state field — gotcha #4): unchanged, still `ok: true`.
- Frontend wiring: same `ViewModelShell(...)` constructor, same `BrowserAdapter`, same imports — only behavior change is `onError` now optionally receiving `VmsActionError`.
- CSS / themes / layout presets / density / card variants: unchanged.
- Polling, redirects, side effects, busy, preventUnload, file uploads: unchanged.

### Backwards-compat policy

None. No compatibility shims, no legacy-context reader, no deprecation warnings. The framework ships the corrected protocol; apps migrate; this doc is the upgrade path. This is by design per the milestone charter.

---

## Upgrading to `0.16.0` (busy lockout + generic per-round-trip lock — npm + NuGet)

**Nothing to do for compatibility.** Every existing response renders byte-identically. The new `busy` field is opt-in for the explicit long-action lockout, and the implicit per-round-trip lock applies to your app automatically (it makes the dispatch guard's behavior visually honest — rapid clicks during a round-trip no longer flip checkboxes / depress buttons before being dropped).

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.15.0` | **`0.16.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.15.0` | **`0.16.0`** |

### What changed automatically (no opt-in)

The shell now applies `.vms-busy` to the `BrowserAdapter` container for the duration of every user-initiated dispatch. Default CSS (`cursor: wait` + `pointer-events: none` on interactive descendants) makes the lock visually honest — clicks during the round-trip never reach inputs. **If your app has its own custom CSS that depends on interactive descendants being clickable during a brief moment after click**, you may notice a slight UX change. The behavior is correct; just be aware.

Polls (silent dispatches) don't trigger the class, so background polling doesn't flicker.

### Opting into the explicit lockout (long-running server actions)

Same pattern as `PreventUnload`. While server-side work is pending, return `Busy = true` from each render; clear when done:

```csharp
case "start-report":
    state = state with { ReportPending = true /* + kick off work */ };
    return new ShellResponse<MyState>(BuildVm(state), state) {
        PreventUnload = true,
        Busy = true,
        NextPollIn = 1000,
    };

case "poll":
    state = state with { ReportPending = !ReportDoneByNow() };
    return new ShellResponse<MyState>(BuildVm(state), state) {
        PreventUnload = state.ReportPending,
        Busy = state.ReportPending,
        NextPollIn = state.ReportPending ? 1000 : null,
    };
```

TypeScript mirrors with conditional spread (matches C#'s `WhenWritingDefault`):

```ts
return {
    vm: buildVm(state),
    state,
    ...(state.reportPending
        ? { preventUnload: true, busy: true, nextPollIn: 1000 }
        : {}),
};
```

The result: while the work is pending, the page is **continuously** locked (cursor wait + interactive elements non-clickable) — no per-poll flicker — until the next response that clears the flag.

### Worked example

`demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (+ bun twin) — the "Start long action" button pairs `Busy + PreventUnload + NextPollIn` for the whole 3-tick lifecycle. Parity-tested.

---

## Upgrading to `0.15.0` (remove `TableSelection.action` — npm + NuGet)

**Almost certainly nothing to do.** The 0.13.0 release deprecated this path in favor of `selection.buttons[]`, and the only worked example using it (HelpDesk-Agent) was already migrated in 0.13.0. If you happened to wire `selection.action` somewhere yourself, see the diff below.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.14.0` | **`0.15.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.14.0` | **`0.15.0`** |

### If you were using `selection.action`

The whole point of removing it: it had a UX foot-gun (rapid clicks silently dropped under the dispatch guard, in-flight re-render wiped DOM). Swap to `selection.buttons[]` — the bulk-action button(s) harvest the checked rows on click, exactly the pattern HelpDesk-Agent has used since 0.13.0:

```diff
- // Before (0.14.0 and earlier)
- // state: IReadOnlyList<string> SelectedIds
- new TableNode(
-     Columns: [...], Rows: rows,
-     Selection: new TableSelection(state.SelectedIds, new ActionDescriptor("toggle-select")));
- // + a per-toggle handler maintaining SelectedIds
- // + bulk handlers reading state.SelectedIds

+ // After (0.15.0)
+ // state: NO SelectedIds field
+ new TableNode(
+     Columns: [...], Rows: rows,
+     Selection: new TableSelection(
+         SelectedIds: [],
+         Buttons: [
+             new ButtonNode("Archive", new ActionDescriptor("bulk-archive"), "secondary"),
+         ]));
+
+ case "bulk-archive":
+     foreach (var id in StrList("selectedIds")) _store.Archive(id);
+     break;
```

TypeScript backend mirrors. See `demo/HelpDesk/AspNetCore/AgentController.cs` (+ bun twin) for the worked diff.

### Why this is OK as a pre-1.0 minor

`TableSelection.action` shipped in 0.12.0, was made optional in 0.13.0 alongside the recommended `selection.buttons[]` path, stayed optional through 0.14.0. By 0.15.0 we had direct visibility that no app in the framework's orbit was using it. Pre-1.0 semver tolerates this kind of pruning; the alternative was carrying a known-buggy code path with no users for an unknown amount of time.

### If we ever bring it back

It will come back through a redesigned wire shape with dispatch queueing + optimistic DOM preservation — not as the old `action` field. The current name is reserved for that future work.

---

## Upgrading to `0.14.0` (warn-before-leave guard via `preventUnload` — npm + NuGet)

**Nothing to do for compatibility.** Every existing response renders byte-identically — the new `preventUnload` field is opt-in.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.13.0` | **`0.14.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.13.0` | **`0.14.0`** |

### When to use it

Any long-running server action where an accidental tab-close (or refresh, or cross-origin nav) would lose in-flight work. The classic case: user clicks "Generate report"; the server kicks off something that takes 20s; while that's pending, the browser should warn before letting the user leave the page.

### Pattern

Server state tracks whether the work is pending; every render response includes `PreventUnload = isPending`. Mirrors how `NextPollIn` drives the poll cadence — set it on every response while you want the guard, omit/clear when done.

```csharp
case "start-report":
    state = state with { ReportPending = true /* + kick off work */ };
    return new ShellResponse<MyState>(BuildVm(state), state) {
        PreventUnload = true,
        NextPollIn = 1000,    // poll until done
    };

case "poll":   // auto-fired by the framework while NextPollIn is set
    state = state with { ReportPending = !ReportDoneByNow() };
    return new ShellResponse<MyState>(BuildVm(state), state) {
        PreventUnload = state.ReportPending,
        NextPollIn = state.ReportPending ? 1000 : null,    // omit to stop polling
    };
```

TypeScript backend mirrors:
```ts
return {
    vm: buildVm(state),
    state,
    ...(state.reportPending ? { preventUnload: true, nextPollIn: 1000 } : {}),
};
```

The conditional spread on the bun side matches C#'s `WhenWritingDefault` (which drops `false` from the wire). Both sides emit `preventUnload: true` while pending and omit the field when done.

### Honest constraint

**Modern browsers don't let you customize the dialog text** (privacy / UX reasons — they show their own "Leave site? Changes you made may not be saved"). The API only signals *whether* to warn; the dialog itself is browser-controlled. For your case this is fine — you want *a* warning, not a custom message.

### TUI

The TUI doesn't implement `setPreventUnload` (terminals have no unload concept). The shell fail-quiets — sending `preventUnload: true` from a TUI-rendered backend is a no-op, not an error.

### Worked example

`demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (and its bun twin at `demo/FeatureProbe-bun/handler.ts`) — the "Start long action" button kicks off a 3-tick lifecycle: the `start-long-action` handler sets `LongActionPolls = 3` + returns `PreventUnload = true`, each `long-action-poll` tick decrements, the final tick clears both. Parity-tested.

---

## Upgrading to `0.13.0` (`TableNode` local-mode selection + bulk-action toolbar — npm + NuGet)

**Nothing to do for compatibility.** Every existing table that sets `selection.action` renders byte-identically. **You will almost certainly want to switch**, though — see below.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.12.0` | **`0.13.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.12.0` | **`0.13.0`** |

### When to switch

If your app has a table with selection checkboxes + bulk-action buttons (delete-selected, archive-selected, …), the 0.12.0 server-truth pattern has a real UX bug: when a user clicks checkboxes in quick succession, the framework's dispatch guard silently drops the second click and the in-flight server response wipes the visually-flipped checkbox on re-render. The user sees "I clicked it, why's it unchecked?" — and there's no consistent way to fix it from app-side in 0.12.0.

Local mode in 0.13.0 fixes this by removing the round-trip per click. Toggles live in the DOM until a bulk-action button fires, which harvests the checked rows and dispatches once with `selectedIds` in context. **Recommended for every bulk-action workflow that doesn't need cross-page selection persistence.**

### How to switch (minimal diff)

Before (0.12.0 server-truth mode):
```csharp
// state: IReadOnlyList<string> SelectedIds
new TableNode(
    Columns: [...], Rows: rows,
    Selection: new TableSelection(state.SelectedIds, new ActionDescriptor("toggle-select")));
// + per-toggle action handler maintaining SelectedIds
// + conditional bulk toolbar above the table, reading state.SelectedIds
```

After (0.13.0 local mode):
```csharp
// state: NO SelectedIds field — selection lives in the DOM
new TableNode(
    Columns: [...], Rows: rows,
    Selection: new TableSelection(
        SelectedIds: [],         // server doesn't pre-select; user toggles in DOM
        Buttons: [               // adapter renders ABOVE the table; each click harvests
            new ButtonNode("Archive Selected", new ActionDescriptor("bulk-archive"), "secondary"),
            new ButtonNode("Delete Selected",  new ActionDescriptor("bulk-delete"),  "danger"),
        ]));

// Action handlers read selectedIds from CONTEXT, not state:
case "bulk-archive":
    foreach (var id in StrList("selectedIds")) _store.Archive(id);
    break;
```

Where `StrList` is a small helper (see `demo/HelpDesk/AspNetCore/AgentController.cs`):
```csharp
List<string> StrList(string key) =>
    payload.Context?.TryGetValue(key, out var v) == true && v.ValueKind == JsonValueKind.Array
        ? v.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).ToList()
        : new List<string>();
```

**TypeScript backend** mirrors the same shape — `selection: { selectedIds: [], buttons: [...] }` on the table node; the action handler reads `selectedIds` from `payload.context` as a string array.

### What you give up (be honest)

- **Live "N selected" indicator.** Server doesn't see selection until a bulk button fires. The visual is row-tint via `.vms-table__row--selected` (driven by the DOM in local mode).
- **Conditional bulk-toolbar render.** Buttons are always visible. Bulk handlers should be no-ops on empty selection (or return a "nothing selected" message).
- **Cross-page selection persistence.** Paginating or filtering rebuilds the table → DOM resets → selection gone. Most bulk-action workflows select within a page anyway; if yours genuinely needs sweep-select-across-pages, stay in `selection.action` mode (the 0.12.0 behavior).

### What you gain

- **No dropped clicks ever.** No dispatch per toggle → the dispatch guard can't drop anything.
- **Instant visual feedback.** DOM updates synchronously with no round-trip.
- **Per-row validity feedback on click is natural.** Your bulk handler iterates `selectedIds` and returns a view tree that can say "processed 5, row 7 was protected because…" — no framework knowledge of per-row validity needed.

### Worked example

`demo/HelpDesk/AspNetCore/AgentController.cs` (+ bun twin at `demo/HelpDesk-bun/server.ts`) is the migrated reference — the same demo, switched from 0.12.0 server-truth to 0.13.0 local mode. Diff is small.

---

## Upgrading to `0.12.0` (`TableNode` selection + pagination — npm + NuGet)

**Nothing to do** beyond taking the bump. `0.12.0` adds two optional fields to `TableNode` — `selection` and `pagination`. Every existing table renders byte-identically; you opt in per table.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.11.0` | **`0.12.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.11.0` | **`0.12.0`** |

**Bulk row selection** — add `selection` to a `TableNode`, keep the selected ids in your state record, and put the bulk-action buttons *outside* the table:

```csharp
// state: IReadOnlyList<string> SelectedIds
new TableNode(
    Columns: [...], Rows: rows,
    Selection: new TableSelection(state.SelectedIds, new ActionDescriptor("toggle-select")));
// action handler:
case "toggle-select":
    var set = new HashSet<string>(state.SelectedIds);
    if (Bool("all")) { /* add/remove the current page's row ids */ }
    else { var id = Str("id"); if (Bool("checked")) set.Add(id!); else set.Remove(id!); }
    state = state with { SelectedIds = /* materialize in a stable order */ };
    break;
case "bulk-archive":
    foreach (var id in state.SelectedIds) _store.Archive(id);
    state = state with { SelectedIds = [] };
    break;
```

The adapter merges `{ id, checked }` per row and `{ all: true, checked }` for the header select-all (where "all" = the rendered page). `TableRow.action` is untouched — rows stay click-to-open *and* selectable. Keep `selectedIds` in a **deterministic order** (e.g. sorted) if you have a TypeScript backend twin that must match a C# one under parity. The "select all N matching, not just this page" pattern is your own node composed above the table.

**Pagination** — add `pagination` and slice `rows` **server-side** (the adapter does not slice):

```csharp
new TableNode( Columns: [...], Rows: pageRows,   // already sliced to the page
    Pagination: new TablePagination(page, pageSize, totalRows, new ActionDescriptor("page")));
// action handler:
case "page": state = state with { Page = Int("page", state.Page) }; break;
// and reset Page = 1 inside your sort/filter handlers (the row window shifts).
```

The adapter renders "X–Y of N" + prev/next from these numbers and dispatches `{ page }`. For a DB-backed table this is just `LIMIT/OFFSET` + a `COUNT(*)` — see `demo/HelpDesk/AspNetCore/AgentController.cs` (and its bun twin) for the worked SQL example.

**TypeScript backend** is the mirror shape: `selection: { selectedIds, action }`, `pagination: { page, pageSize, totalRows, action }` on the table node. **TUI** renders `[x]`/`[ ]` checkboxes and a text prev/next footer with the same dispatch payloads.

---

## Upgrading to `0.11.0` (`ImageNode` + `TextNode` "warning" style + AA hardening — npm + NuGet)

**Nothing to do** beyond taking the bump. `0.11.0` adds the `ImageNode` type, adds `"warning"` to the `TextNode.style` union, and darkens the `--vms-warning` token (default + light themes) so warning text clears WCAG-AA. Purely additive.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.10.0` | **`0.11.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.10.0` | **`0.11.0`** |

- **New `ImageNode`:** render images with `{ type: "image", src, alt?, size?, shape? }` (TS) / `new ImageNode(src, Alt: …, Size: …, Shape: …)` (C#). `size` ∈ `small|medium|large|full`, `shape` ∈ `circle` — both are design-system classes, not free-form CSS. The browser renders `<img class="vms-image">`; the TUI degrades to `[image: <alt>]`. Always provide `alt` for accessibility and non-browser targets.
- **New inline warning text:** use `style: "warning"` on a `TextNode` (TS) / `new TextNode("…", "warning")` (C#) instead of wrapping a one-line caveat in a `ListItemNode{variant:"warning"}`. Emits `.vms-text--warning` in the browser, amber foreground in the TUI.
- **`TextNode.Style` was already a free `string?` in C#**, so code that passed `"warning"` *compiled* on ≤0.10.0 but rendered **unstyled** (the value wasn't in the renderer's recognized set). After 0.11.0 that same code renders correctly — a silent visual fix, not a breaking change. (The `"warning"` style adds no C# type; the NuGet package changes in 0.11.0 only because of the new `ImageNode` record.)
- **`--vms-warning` is now a touch darker** (`#8a630d`, was `#a37510` default / `#c89610` light themes). If you read that token for a custom warning border/badge, expect a slightly deeper amber. Dark themes are unchanged. No action required.
- **Custom themes:** if you ship your own theme stylesheet and use `--vms-warning` for *text*, verify it clears 4.5:1 on your surface/bg — the shipped `check:aa-contrast` now enforces this for the bundled themes, but your own files are yours to check.

---

## Upgrading to `0.10.0` (Multi-action forms — npm + NuGet)

**Nothing to do** beyond taking the bump. `0.10.0` adds `FormNode.buttons?: ButtonNode[]` and relaxes `submitAction` from required to optional. Both changes are forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.9.0` | **`0.10.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.9.0` | **`0.10.0`** |

- **Existing single-submit forms:** unchanged — keep using `submitAction` + `submitLabel`.
- **Multi-action forms:** add `buttons: [...]` (each a full `ButtonNode`). Each button harvests the form's current field values into its action context, then dispatches. Set `submitAction: null` (C#) / omit it (TS) for a buttons-only form with no default submit.
- **`variant` + `pendingLabel` on form buttons:** apply automatically, since `buttons[]` entries are real `ButtonNode`s.
- **A plain `ButtonNode` in `children`** still does NOT harvest — only `buttons[]` entries do.

Closes [#15](https://github.com/ashley-shrok/ViewModelShell/issues/15).

---

## Upgrading to `0.9.0` (`CopyButtonNode.variant` — npm + NuGet)

**Nothing to do** beyond taking the bump on whichever side you use. `0.9.0` adds one additive optional field on `CopyButtonNode` (`variant?: "primary" | "secondary" | "danger"`), mirroring `ButtonNode.variant`. Wire is forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.8.0` | **`0.9.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.8.0` | **`0.9.0`** |

- **Existing copy-buttons:** unchanged. Omit `variant` for the default look (byte-identical to `0.8.0`).
- **Copy-buttons near regular buttons:** set `Variant: "secondary"` (C#) / `variant: "secondary"` (TypeScript) to make the copy affordance read distinctly. `"primary"` and `"danger"` also available, same as `ButtonNode.variant`.
- **No CSS work:** the existing `.vms-button--primary` / `.vms-button--secondary` / `.vms-button--danger` rules already apply to whichever `<button>` the framework emits.

Closes [#14](https://github.com/ashley-shrok/ViewModelShell/issues/14).

---

## Upgrading to `0.8.0` (`ButtonNode.pendingLabel` — npm + NuGet)

**Nothing to do** beyond taking the bump on whichever side you use. `0.8.0` adds one additive optional field on `ButtonNode` (`pendingLabel?: string`) and changes dispatch-error behavior to re-render `currentVm` (previously it only fired `onError`). Both changes are forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.7.1` | **`0.8.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.7.0` | **`0.8.0`** |

- **Existing buttons:** unchanged. Omit `pendingLabel` for instant-click behavior (byte-identical to `0.7.x`).
- **Slow-action buttons:** set `PendingLabel: "Loading…"` (C#) / `pendingLabel: "Loading…"` (TypeScript) on the `ButtonNode`. The framework swaps the visible label + dims the button on click; reverts on response (success path replaces the button entirely; error path re-renders `currentVm`).
- **Adapters that mutate the DOM on click:** the error-path re-render now reverts client-side ephemeral state automatically. If you had a custom adapter implementing analogous pending logic via your own cleanup hook, you can drop that hook — the framework re-render handles it.
- **TUI consumers:** the `TuiAdapter` mirrors the BrowserAdapter behavior (label swap + `dimColor` while pending). Same wire field; no separate opt-in.

Closes [#11](https://github.com/ashley-shrok/ViewModelShell/issues/11).

---

## Upgrading to npm `0.7.1` (Browser scroll preservation — npm only)

**Nothing to do** beyond taking the patch. `0.7.1` fixes [#7](https://github.com/ashley-shrok/ViewModelShell/issues/7): the window scroll position is now preserved across action-driven re-renders, and `el.focus()` no longer yanks the viewport to the focused element. NuGet unchanged at `0.7.0`; major.minor stays `0.7`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.7.0` | **`0.7.1`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.7.0` | `0.7.0` (unchanged) |

- **Browser consumers with long, scrollable pages:** the page no longer jumps on every action. If you explicitly want scroll-to-top after an action, navigate via `ShellResponse.redirect` — that's the existing wire affordance for app-driven navigation.
- **Server / TUI consumers:** nothing to do — no wire/type/API change.

---

## Upgrading to `0.7.0` (`PageNode.width` override seam — npm + NuGet)

**Nothing to do** beyond taking the bump on whichever side you use. `0.7.0` adds one additive `PageNode` field (`width?: "wide" | "full"`). No existing consumer code requires changes; the wire is forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.6.0` | **`0.7.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.6.0` | **`0.7.0`** |

- **Existing pages:** unchanged behavior. Omitting the new field renders the same as `0.6.0` (1080px max-width).
- **Wider pages for data-heavy views:** set `Width: "wide"` (C#) / `width: "wide"` (TypeScript) on the page; the framework emits `.vms-page--wide` and the page extends to `var(--vms-page-max-wide)` (1440px default).
- **Full-bleed pages:** `Width: "full"` removes the max-width cap entirely.
- **Host retune of the wide value:** add `:root { --vms-page-max-wide: 1280px }` to your app's stylesheet (imported after the theme).
- **Global retune of the default cap (also valid):** `:root { --vms-page-max: 1280px }`. This was already a sanctioned seam (`AGENTS.md`); `0.7.0` annotates it in the inline `default.css` comment to match.
- **TUI consumers:** the `width` field is ignored — terminals fill naturally; width caps are a browser concept. No code change.

Closes [#13](https://github.com/ashley-shrok/ViewModelShell/issues/13).

---

## Upgrading to `0.6.0` (Terminal substrate rewrite — OpenTUI + Bun runtime)

**No wire change. NuGet contents identical to `0.5.0`** — it bumps to `0.6.0` only to keep shared major.minor with npm.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.5.0` | **`0.6.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.5.0` | **`0.6.0`** *(alignment-only; no functional change)* |

### What changed and what didn't

- **Wire format:** unchanged. `ViewNode` types, `ShellSideEffect`, `ShellResponse`, anti-forgery / `getRequestHeaders()` plumbing — all identical to `0.5.0`. The cross-backend parity suite passes byte-for-byte against the same 14 backends.
- **`BrowserAdapter` (`./browser` subpath):** unchanged. No code change, no behavior change, no install change.
- **Backend types (`./server` subpath + NuGet):** unchanged.
- **`TuiAdapter` (`./tui` subpath + `vms-tui` CLI):** **rewritten on OpenTUI**, which is currently Bun-only. The visual layout is meaningfully different (per-pane borders + focused-pane highlight + persistent status bar at the bottom); functionally it now ships mouse support throughout (click any button/checkbox/link/copy-button/table header/table row), wheel scroll, Tab/Shift-Tab focus cycle across panes, and Enter/Space keyboard activation of the focused pane's primary actionable.

### What you need to do

- **If you're a browser-only consumer or a server-only consumer:** nothing. The npm bump is harmless; you can take it or pin to `0.5.0` (the wire is identical).
- **If you use the `vms-tui` CLI** (e.g. `npx vms-tui http://localhost:3000/api/tasks`):
  1. Install Bun if you don't have it: `curl -fsSL https://bun.sh/install | bash` (see [bun.sh](https://bun.sh/install) for other installers).
  2. Swap `npx vms-tui …` → `bunx vms-tui …` (or `bun install -g @ashley-shrok/viewmodel-shell && vms-tui …`). The Node entry still runs — it now prints a clear "needs Bun" message and exits 1 before any FFI import attempts.
- **If you import `TuiAdapter` programmatically** (i.e. `import { TuiAdapter } from "@ashley-shrok/viewmodel-shell/tui"`):
  1. Update your `package.json` `optionalDependencies` / `dependencies`: remove `ink`, `ink-text-input`, `ink-select-input`, and any `react@18` pin; add `@opentui/core`, `@opentui/react`, `react@19`. Or just install via the new README snippet: `bun add @ashley-shrok/viewmodel-shell @opentui/core @opentui/react react`.
  2. Your host process must run under Bun (not Node) for the TUI render path. Side-channel verbs (`storage`, `saveFile`, `navigate`) still work under Node, but mounting the renderer (`adapter.render(vm, onAction)`) requires Bun's FFI.
  3. Public API surface — constructor (`new TuiAdapter({ viewport?, sidebarFraction? })`), `render(vm, onAction)`, and the optional `Adapter` capability verbs — is byte-identical to `0.5.0`. No code changes to your integration.

### Why the version is aligned even with no NuGet-side change

`AGENTS.md` (top of file) states the two packages "share major.minor; bumping a `ViewNode` type or wire-format change bumps both sides." This wasn't a wire change, but a major.minor on npm with the existing rule means NuGet ticks too. The alternative — letting npm hit `0.6` while NuGet stays at `0.5` — would diverge major.minor and silently break the rule. Going forward, if the TUI work needs another bump without a wire change, that's another no-op alignment release on NuGet; once OpenTUI's Node support lands and we drop the Bun requirement, the alignment story stays clean.

---

## Upgrading to `0.5.0` (Authenticated downloads — npm + NuGet)

**Nothing to do** beyond taking the bump on whichever side you use. `0.5.0` adds one additive `ShellSideEffect` type (`"download"`) and one optional `Adapter` capability verb (`saveFile?`). No existing consumer code requires changes; the existing wire is forward-compatible.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.9` | **`0.5.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | **`0.5.0`** |

- **Browser / server consumers (no `"download"` side-effect emitted):** nothing to do — existing `ShellSideEffect` JSON is unchanged (new `Url`/`Filename` fields are optional and null-omitted).
- **Backends that want to offer authenticated downloads:** use the new factory in your action handlers — the shell will fetch the URL with `getRequestHeaders()` merged and save the response:
  ```csharp
  return new ShellResponse<MyState>(BuildVm(state), state)
      .WithEffect(ShellSideEffect.Download("/api/invoices/42/pdf", "invoice-42.pdf"));
  ```
  ```typescript
  return { vm: buildVm(state), state,
    sideEffects: [shellSideEffect.download("/api/invoices/42/pdf", "invoice-42.pdf")] };
  ```
- **Custom `Adapter` implementations:** to support `"download"` side-effects, implement the new optional `saveFile?(data: Blob, filename: string, contentType: string): void | Promise<void>` verb on your adapter. Without it, an arriving `"download"` side-effect surfaces a loud `onError` (no silent swallow). `BrowserAdapter` and `TuiAdapter` ship the verb out of the box.
- **Static / non-interactive output (TUI `renderTree`):** byte-identical to `0.4.9`.

---

## Upgrading to npm `0.4.9` (Terminal sidebar rail proportional — npm only)

**Nothing to do** beyond taking the patch. `layout:"sidebar"`'s rail is
now proportional (~⅓ of the terminal, clamped [24,56]) instead of a
hardcoded 24 cols — usable for master/detail on wide terminals. NuGet
unchanged at `0.4.2`; major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.8` | **`0.4.9`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire/type/API change.
- **Terminal master/detail apps:** the sidebar rail now scales with the
  terminal. Tune it with `new TuiAdapter({ sidebarFraction: 0.3 })`
  (0.15–0.6; default ⅓). `split` is still a fixed 50/50.
- **Non-interactive / static render:** byte-identical to `0.4.8`.

---

## Upgrading to npm `0.4.8` (Terminal link OSC 8 fix — npm only)

**Nothing to do** beyond taking the patch. `0.4.8` fixes a long-latent bug
where terminal `link` nodes emitted `]8;;…` garbage text (the ESC
introducer + ST terminator were missing) instead of a real OSC 8
hyperlink — broken in every terminal. NuGet unchanged at `0.4.2`;
major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.7` | **`0.4.8`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire/type/API change.
- **Terminal consumers using `link` nodes:** `0.4.8` is required —
  `0.4.7` and earlier render them as raw `]8;;…` text. Empty-href links
  still degrade to plain text (unchanged).
- **Non-interactive / static render:** now carries a proper OSC 8 escape
  (terminals ignore it if unsupported) rather than literal `]8;;` text.

---

## Upgrading to npm `0.4.7` (Terminal fill reaches section content — npm only)

**Nothing to do** beyond taking the patch. Completes `0.4.5`/`0.4.6`:
section-wrapped content (the idiomatic norm — e.g. a sidebar with card
sections) now scales with the terminal instead of rendering at a fixed
width inside an otherwise-filled surface. NuGet unchanged at `0.4.2`;
major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.6` | **`0.4.7`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire/type/API change.
- **Terminal consumers:** `sidebar`/`split`/`stack` and section content now
  fill and re-flow with the terminal. `cards` stays a uniform small-tile
  grid by design. Opt-out unchanged:
  `new TuiAdapter({ viewport: "content" })`.
- **Non-interactive (pipe / CI / agent / `</dev/null`) & static render:**
  byte-identical to `0.4.4`–`0.4.6`.

---

## Upgrading to npm `0.4.6` (Terminal viewport fill reaches the content — npm only)

**Nothing to do** beyond taking the patch. `0.4.6` completes `0.4.5`: the
terminal-sized root introduced in `0.4.5` now actually propagates through the
layout spine, so `sidebar`/`split`/`stack` content fills the terminal and
re-flows with it (previously the surface grew but content stayed a fixed
width). NuGet unchanged at `0.4.2`; major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.5` | **`0.4.6`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire/type/API change.
- **Terminal consumers:** the full-screen UI now genuinely fills the
  terminal (the intended `0.4.5` behavior). `cards` stays a uniform
  small-tile grid by design. Opt-out unchanged:
  `new TuiAdapter({ viewport: "content" })`.
- **Non-interactive (pipe / CI / agent / `</dev/null`) & static render:**
  byte-identical to `0.4.5`/`0.4.4`.

---

## Upgrading to npm `0.4.5` (Terminal full-viewport + alternate screen — npm only)

**Behavior change on an interactive terminal only.** `TuiAdapter` /
`vms-tui` now fill the screen via the alternate-screen buffer (vim/htop
style; your terminal is restored verbatim on every exit — quit, Ctrl-C,
SIGTERM, crash) and re-flow on resize, instead of rendering at intrinsic
content size. NuGet unchanged at `0.4.2`; major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.4` | **`0.4.5`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

- **Browser / server consumers:** nothing to do — no wire, type, or API
  change.
- **Terminal consumers who want the old look:**
  `new TuiAdapter({ viewport: "content" })` — intrinsic content size, no
  screen takeover (pre-`0.4.5` behavior).
- **Non-interactive (pipe / CI / agent / `</dev/null`):** unchanged from
  `0.4.4` — one static frame, no alternate screen.

---

## Upgrading to npm `0.4.4` (Terminal non-TTY crash fix — npm only)

**Nothing to do** beyond taking the patch. `0.4.4` fixes a `0.4.3` bug where
`vms-tui` crashed (Ink "Raw mode is not supported") on non-TTY stdin (pipes,
`</dev/null`, CI, agent shells) instead of rendering one static frame and
exiting. NuGet unchanged at `0.4.2`; major.minor stays `0.4`.

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.3` | **`0.4.4`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

No wire, type, API, or behavior change for browser/server consumers. If you
drive an app from a terminal in a non-interactive shell (agents, CI, cron),
`0.4.4` is required — `0.4.3` errors there. `npx vms-tui@latest <url>` picks
it up automatically.

---

## Upgrading to npm `0.4.3` (Terminal/TUI front-end — npm only)

**Nothing to do.** This is an additive, client-only npm release. NuGet
`AshleyShrok.ViewModelShell` is **unchanged at `0.4.2`**; major.minor stays
aligned at `0.4` (client-only changes take an npm-only patch — the same model
as `0.4.1`).

| Package | From | To |
|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | `0.4.2` | **`0.4.3`** |
| `AshleyShrok.ViewModelShell` (NuGet) | `0.4.2` | `0.4.2` (unchanged) |

No wire, type, API, or behavior change. Existing browser and server apps are
unaffected and do not need to upgrade. The new
`@ashley-shrok/viewmodel-shell/tui` export and the `vms-tui` bin are purely
additive; Ink is an optional dependency that web/server consumers never load.

**Optional, if you want it** — drive any existing ViewModel Shell backend from
a terminal, no backend change:

```bash
npx vms-tui https://your-app.example/api/tasks
```

---

## Upgrading to 0.4.0 (Design system: theme + layout + canonical examples)

This is **one consolidated milestone**: a serviceable shipped default look + density/card,
an additive `layout` preset enum, the default-palette re-baseline, and the de-chromed
canonical examples. There are no separately-migratable intermediate `0.3.x` dev states —
treat the whole thing as a single `0.4.0` upgrade.

### 1. Exact versions

| Package | Source | From | To |
|---|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | frontend renderer + `/server` subpath | `0.3.14` | **`0.4.0`** |
| `AshleyShrok.ViewModelShell` (NuGet) | .NET backend `ViewNode` types | `0.3.10` | **`0.4.0`** |

#### Why this is a MINOR (`0.3.x → 0.4.0`), aligned across both packages

The project's own governing rule, documented in [`AGENTS.md`](./AGENTS.md):

> *"The two packages share major.minor — bumping a `ViewNode` type or wire-format
> change bumps both sides."*

This release **does** carry a wire-format change: the additive `layout?: "stack" |
"split" | "cards"` closed-union enum on `PageNode`/`SectionNode` (plus the additive
`density?` and `variant?` closed-union fields). A wire-format change moves the
`major.minor`, so both packages bump together to **`0.4.0`**.

This is the **same rule, opposite outcome** to `0.3.13`: that release had *zero*
wire-format change, so the rule held `major.minor` fixed and it shipped as a npm-only
PATCH. This release *does* change the wire format, so the same rule **requires** an
aligned minor on both npm and NuGet. The rule text in `AGENTS.md` is unchanged — only
the version numbers move.

### 2. What is explicitly NOT breaking (and why)

| Area | Why it is NOT breaking |
|---|---|
| **The new wire fields** (`layout`, `density`, `variant`) | All three are **additive optional closed unions**. Omitting them (or sending the default `"stack"`/`"comfortable"`) is **byte-identical** to prior behavior — proven by the cross-backend parity suite staying 100% green (the FeatureProbe fixture was widened to exercise all three across .NET/Bun/Node). Existing apps render unchanged unless they explicitly opt in. |
| **Every existing `ViewNode` type** | No type added, removed, or changed in a breaking way. The additions are optional fields on the existing `PageNode`/`SectionNode`. |
| **The `--vms-*` override seam** | Every `--vms-*` variable name still exists; the 11 pre-existing theme files are byte-identical; overriding `:root` still fully reskins. The seam mechanism is unchanged. |
| **`themes/light-purple.css`** | Byte-unchanged. It used to be a real override; it is now a harmless no-op (its values are the new default) — importing it is still valid and still produces exactly its documented look (`--vms-warning` `#c89610` included). |

#### The one intentional default-appearance change (NOT a wire/API break)

The unthemed shipped `default.css` `:root` was **re-based dark→light** onto the
existing `light-purple` value set (`--vms-bg #f7f7f9`, `--vms-surface #fff`,
`--vms-accent #5a4ad7`, `--vms-color-scheme light`). This is an **intentional change to
the shipped default appearance** — it is **not** a wire-format, API, or `ViewNode`
break, and it does **not** affect any app that already sets its own `:root` or imports
a theme (the default never applied to those apps).

Additionally, **one** value of the unthemed default was tightened for accessibility:
the shipped default's `--vms-warning` is **`#a37510`** (a slightly darker amber than
`light-purple.css`'s `#c89610`) so the shipped default clears the WCAG-AA non-text
contrast floor (≥3.0:1 on `--vms-bg`/`--vms-surface`/`--vms-surface-2`; it was
2.51/2.68/2.36:1, it is now 3.84/4.11/3.62:1 — CI-enforced). This applies **only** to
the unthemed shipped default: if you `import
"@ashley-shrok/viewmodel-shell/themes/light-purple.css"` explicitly, you still get the
original `#c89610` (that theme file is byte-unchanged). This is the same
one-value-tighten-to-pass-AA precedent as the `0.3` `--vms-text-muted` fix — the
variable still exists and themes still override it, so it is not a seam behavior change.

**Restoring the exact prior dark look (one line).** If you relied on the prior dark
default and set **no** theme and **no** `:root`, the prior look — pixel-for-pixel — is
one import away:

```ts
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css";
```

`themes/dark-purple.css` is a **byte-exact capture of the prior (pre-0.4.0) dark
default**, shipped specifically so the prior appearance is recoverable with a single
import (it fills the previously-missing dark-purple slot alongside dark-blue/green/rose/
amber/teal). Same honest-framing discipline as the `0.3.13` silent-behavior caveats: if
something visible changes by default, here is exactly what changed and exactly how to
put it back.

### 3. Recommended upgrade steps

**npm (frontend / `/server` subpath consumers):**

```bash
npm update @ashley-shrok/viewmodel-shell
```

(or pin `"@ashley-shrok/viewmodel-shell": "^0.4.0"` in `package.json`).

If you do nothing else, your app keeps working — the new wire fields are opt-in. If you
relied on the prior **dark** default look and set no theme, add the one-line
`dark-purple.css` import shown above to keep it pixel-identical. To adopt the new
design-system features, set `layout`/`density` on `PageNode`/`SectionNode` or
`variant: "card"` on a `SectionNode` (see [`AGENTS.md`](./AGENTS.md) "Design system"
for the when-to-use guide and the live Showcase worked example).

**.NET (NuGet `AshleyShrok.ViewModelShell`) consumers:**

```bash
dotnet add package AshleyShrok.ViewModelShell --version 0.4.0
```

The new fields are additive optional members on the existing `PageNode`/`SectionNode`
records — existing backends compile and emit byte-identical wire output unless they set
the new fields.

---

## Upgrading to npm `0.3.13` (Upload Progress, MIGRATE-01)

### 1. Exact versions

| Package | Source | From | To |
|---|---|---|---|
| `@ashley-shrok/viewmodel-shell` (npm) | frontend renderer + `/server` subpath | `0.3.12` | **`0.3.13`** |
| `AshleyShrok.ViewModelShell` (NuGet) | .NET backend `ViewNode` types | `0.3.9` | **`0.3.9` — unchanged** |

#### Why this is a PATCH (`0.3.12 → 0.3.13`), not a minor

The project's own governing rule, documented in
[`AGENTS.md`](./AGENTS.md):

> *"The two packages share major.minor — bumping a `ViewNode` type or wire-format
> change bumps both sides."*

This release has **zero wire-format and zero `ViewNode` change**: Phase 1 only
relocated *where* browser bindings execute (out of core, behind the capability
seam — not *what* the protocol does), and this upload-progress release is a pure
**client-side transport** addition. By the rule above, the `major.minor` stays
fixed at `0.3`, so the change ships as a PATCH.

This also matches the established patch cadence — every prior client-relevant
feature shipped as a patch:

- server-initiated redirect → `v0.3.4`
- client side-effects → `v0.3.5`
- polling / push → `v0.3.6`
- npm-only tooling/backend-subpath changes → `0.3.10`, `0.3.11`, `0.3.12`

Consumers tracking that cadence will notice the number; the reason is the
`AGENTS.md` `major.minor`-alignment rule above plus this zero-wire-change release.

#### Why there is NO NuGet bump

`AshleyShrok.ViewModelShell` stays at `0.3.9` and **.NET-only consumers need to do
nothing**. There is no wire-format change and no .NET API change — upload progress
is browser-runtime only. Both packages remain on the `0.3` `major.minor`, so
*not* bumping NuGet **preserves** the documented npm/NuGet alignment invariant
(it is not divergence — bumping NuGet to a number with no corresponding change
would be the divergence).

### 2. The single public-API addition

One new **optional** field on `ShellOptions`:

```typescript
onUploadProgress?: (sent: number, total: number) => void;
```

That is the entire public-API surface delta. Its signature is byte-identical to
the already-documented `Adapter.transport` hook (`hooks.onUploadProgress`). It is
purely additive — existing `ShellOptions` consumers are unaffected.

### 3. What is explicitly NOT breaking (and why)

Nothing in this release is a breaking change. Specifically, all of the following
are **NOT breaking**:

| Area | Why it is NOT breaking |
|---|---|
| **Wire format** | No new/changed request or response field. The XHR upload path sends the *exact same* `multipart/form-data` (`_action`, `_state`, file fields), the same headers, and resolves a real `Response` so the shared `processResponse()` path is byte-identical regardless of transport. Cross-backend parity (7 fixtures) stays 100% green. |
| **Server-initiated redirect** (`redirect`) | Untouched. Phase 1 relocated *where* the binding runs, not *what* it does; this release adds nothing to the redirect path. |
| **Client side-effects** (`set-local-storage` / `set-session-storage`) | Untouched — unchanged behavior and ordering. |
| **Polling & push** (`pollInterval`, `NextPollIn`, `shell.push()`) | Untouched. |
| **Every existing `ViewNode` type** (page, section, list, form, field, checkbox, button, text, link, stat-bar, tabs, progress, modal, table) | No type added, removed, or changed. Zero `ViewNode`/wire change is exactly why this is a PATCH. |
| **Existing custom `Adapter` implementations** | `transport?` is and remains **optional**. A custom `Adapter` that implements only `render` (or `render` + `navigate`/`storage` but not `transport`) **still compiles and behaves exactly as before** — it transparently uses the core `fetch` path. No adapter must be changed. |

In one line: Phase 1 relocated *where* bindings run, not *what* they do; this
release only **adds an optional client-side send path** — it removes or changes
nothing.

### 4. Recommended upgrade steps

**npm (frontend / `/server` subpath consumers):**

```bash
npm update @ashley-shrok/viewmodel-shell
```

(or pin `"@ashley-shrok/viewmodel-shell": "^0.3.13"` in `package.json`).

Optionally, if you want byte progress on file uploads, set `onUploadProgress`
in your `ShellOptions`:

```typescript
const shell = new ViewModelShell({
  endpoint:       "/api/your-feature",
  actionEndpoint: "/api/your-feature/action",
  adapter:        new BrowserAdapter(container),
  onUploadProgress: (sent, total) => {
    const pct = total > 0 ? Math.round((sent / total) * 100) : null;
    // pct === null → indeterminate (no content length); show a spinner, not a bar
    updateProgressUi(pct);
  },
});
```

If you do nothing, uploads behave exactly as before — `onUploadProgress` is
opt-in.

**.NET (NuGet `AshleyShrok.ViewModelShell`) consumers:** **No action.** The NuGet
package is unchanged at `0.3.9`.

### 5. Two non-obvious silent behaviors — read these before relying on progress

These are intentional design decisions, not bugs. A consumer that does not know
about them will otherwise ship a broken or misleading upload UI.

#### (5a) Progress fires ONLY if the adapter implements `transport`

`onUploadProgress` fires **only when the plugged-in `Adapter` implements
`transport`**. The default `BrowserAdapter` does, so the common path works.

But a **custom adapter without `transport` silently falls back** to the core
`fetch` path: **the upload still succeeds, but NO progress events fire** — and
**no error is raised**. This is *intentional graceful degradation* (the
`transport` verb is the one asymmetric capability with a safe universal default;
progress is a soft enhancement, not a correctness/security guarantee), **not** an
error and **not** the fail-loud behavior of `navigate`/`storage`.

Implication: if you supply a custom adapter and set `onUploadProgress` but your
progress UI never updates, the cause is a missing `transport` on your adapter —
the upload itself is fine. Do **not** assume "the callback was set, therefore
progress fired."

#### (5b) `total` may be `0` — guard before dividing

The `total` argument may be **`0`**, meaning **"indeterminate"** — the server or
stream did not report a content length. **Consumers MUST guard `total > 0`
before computing `sent / total`**, or a percentage calculation yields `NaN` /
`Infinity` and your progress bar breaks.

Copy-pasteable guard:

```typescript
onUploadProgress: (sent, total) => {
  const pct = total > 0 ? Math.round((sent / total) * 100) : null;
  // pct === null  → indeterminate: render an indeterminate spinner, not "0%"
  // pct is 0..100 → render a determinate bar
};
```

(The framework also never reports `(0, 0)` at completion — an indeterminate
upload completes with `(finalLoaded, finalLoaded)` so a guarded UI lands on a
sensible terminal state — but the in-flight `total === 0` sentinel still requires
the `total > 0` guard above.)

---

*Migration guide for npm `@ashley-shrok/viewmodel-shell` `0.3.13` (NuGet
`AshleyShrok.ViewModelShell` unchanged at `0.3.9`). See
[`AGENTS.md`](./AGENTS.md) for the full wire format and the capability-seam
architecture.*
