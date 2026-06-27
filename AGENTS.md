# ViewModel Shell

A server-driven UI framework where the wire format is structured enough that agents can build full-stack apps without ever opening a browser and all UI tests are pure unit tests with no browser runtime. The server is a stateless transformer: it takes the client's current UI state plus an action and returns the next state plus a fresh view tree. The client (a thin TypeScript adapter) renders that tree to DOM with no app-specific code, holds the state opaquely, and round-trips it on every dispatch. Persistent/shared data (databases, files) lives server-side; transient UI state lives client-side.

The framework ships as two version-aligned packages:

| Package | Source | Use |
|---|---|---|
| [`@ashley-shrok/viewmodel-shell`](https://www.npmjs.com/package/@ashley-shrok/viewmodel-shell) (npm) | `viewmodel-shell/src/{index,browser}.ts` + `styles/` | Frontend renderer + themes |
| [`@ashley-shrok/viewmodel-shell/server`](https://www.npmjs.com/package/@ashley-shrok/viewmodel-shell) (npm subpath) | `viewmodel-shell/src/server.ts` | Backend types + helpers for TypeScript/Node/Bun/Deno/Workers backends |
| [`AshleyShrok.ViewModelShell`](https://www.nuget.org/packages/AshleyShrok.ViewModelShell) (NuGet) | `viewmodel-shell-dotnet/ViewModels.cs` | Backend `ViewNode` types under the `ViewModelShell` namespace |

The two packages share major.minor — bumping a `ViewNode` type or wire-format change bumps both sides. Source for both lives in this repo; demos here consume them via local `ProjectReference`/Vite alias to keep the dev loop tight.

The framework is actively developed. **If your app needs a node type, input type, text style, or interaction that doesn't exist — ask rather than working around it.** Workarounds accumulate technical debt and usually indicate a gap worth closing properly.

---

## Design philosophy

The framework exists to make one thing true: **an agent can build, test, and operate a complete application end-to-end — with no human in the loop and no browser anywhere in sight.** That capability isn't bolted on; it falls out of a few deliberate choices about where state lives, what crosses the wire, and who is allowed to know about pixels. Everything here is the *why*. When a decision is unclear, decide by these — and by whether the choice keeps that one thing true.

### What the philosophy buys

Because the entire interface is structured data rather than code, three capabilities come for free — and they are the whole point:

- **Agents build it blind.** An app is just a server that maps the current interface state and an action to the next state and a description of the screen. There is nothing to *look at* to get it right — the description is the truth — so an agent can author a complete, correct UI without ever rendering one.
- **Agents test it through the interface, in-process, with no browser.** Every interaction is a plain function from input to output: hand the server a state and an action, assert on the view it returns. The very interface a user would click through is the one the tests drive — so *every* behavior the app has is verifiable through it, with ordinary unit tests and nothing else.
- **Agents use it like an API.** A finished app is already a clean, self-describing wire protocol. The same structure that lets one agent build and test it lets a *different* agent drive it — read the screen, take an action, read the next screen — as if it were an API, because it is one.

**The testing story is the quiet giant.** Most UI frameworks can only really verify behavior by driving a live browser — slow, flaky, and heavy enough that teams end up testing a fraction of what they ship. Here the interface *is* data, so exhaustively asserting every screen and every transition is just unit testing: it runs in milliseconds, in-process, on every single CI run, with no headless browser, no Playwright, no running server, no flake, and nothing to install. The full-coverage, test-everything-through-the-UI regime that's usually aspirational becomes the default — and it's a direct consequence of the structured-wire philosophy, not a separate test harness someone had to build.

A human gets a serviceable, responsive app with zero design effort. An agent gets an app it can write, verify, and operate entirely on its own. Both come from the same fact: the interface is honest, structured data from end to end.

### The ideas that make it true

1. **The server remembers nothing between requests.** It takes the current interface state and an action and returns the next state and a fresh view; the entire interface state travels with every exchange. Because nothing is held per-client, the server restarts or scales without losing anything, and two windows of the same app are independent with no bookkeeping. Lasting, shared things — records, files — live on the server; only the moment-to-moment interface state rides along.

2. **The structured description must always be enough on its own** — enough to build from, to test against, and to act on. Any behavior that only works through a real, running client, or any shortcut the data doesn't capture, quietly breaks the promise that makes the whole thing valuable. Guarding the sufficiency of the data is guarding the product.

3. **The client is dumb on purpose, and universal.** It knows how to turn a view description into something on a screen, and nothing about any particular app — no app logic, no app-specific styling, no special cases. That is why a whole new kind of front-end (a terminal, a phone) becomes possible by teaching one small, well-defined seam how to draw and how to perform a handful of side effects — and why the heart of the framework knows nothing about any specific platform at all.

4. **Apps describe; they don't decorate.** An app composes from the framework's vocabulary of view pieces and, at most, nudges a shared design token; it never writes its own styling and never reaches in to override the framework's. This cuts both ways: the framework is never edited to patch around an app's need, and the app is never bent to work around the framework's limits. A missing piece is a request *to* the framework — and until it arrives, the honest, slightly imperfect rendering is simply accepted.

5. **The layout responds to the space it is in, not to a guess about the device.** The server never knows how wide the screen is, so it never tries to; making content reflow and collapse is the framework's job. An app expresses *intent* — "these are cards," "this is a header row" — from a closed set of choices, never raw style, and the framework makes that intent work at every size.

6. **One description of a view, shared by both backends, with the code as its only authority.** Documentation points at that source rather than recopying it, because a second copy is just drift waiting to happen. The two server languages stay perfectly in step — the same app shape means the same data on the wire, or the build fails.

7. **An option not set is simply absent** — never sent as an empty placeholder. "Missing" and "nothing" mean the same thing and are treated as equal, which is what keeps the two backends honest with each other and keeps strict consumers happy.

8. **Nothing important fails quietly.** A capability invoked without the means to honor it raises a hard error rather than doing nothing — a dropped redirect or a swallowed credential write is a security failure, not a graceful degradation. The same instinct runs throughout: a broken test blocks a release, a mismatch fails the build, an unknown action answers with a clear error. Silence is the bug.

9. **The framework grows by addition, and you ask before adding.** New capabilities are additive, so existing apps and agents keep working untouched; and when something can only be done by working *around* the framework, that is the signal a piece is missing — surface it, don't paper over it.

---

## Critical gotchas (read first)

These are the bugs that take hours to find:

1. **Always `return BuildVm(state)` (or a `ShellResponse<TState>` wrapping it) directly — never `return Ok(...)`.** `Ok()` leaves `DeclaredType = null` on the `ActionResult<T>`; the serializer falls back to the runtime type, skips `[JsonPolymorphic]`, omits `"type"` from the root node, and the page renders blank with no error.

2. **Never name a local variable `checked`** — it's a reserved C# keyword. Use `isChecked`.

3. **Use regex aliases, not string keys, in `vite.config.ts`.** A string key `"viewmodel-shell"` prefix-matches `"viewmodel-shell/browser"` and breaks the subpath import. Always use `/^viewmodel-shell$/` and `/^viewmodel-shell\/browser$/`.

4. **Inline validation goes in the state record (or the `rejected` envelope), not `BadRequest`.** Add a `ValidationError` field to your state record, set it on failure, clear on success, and include `new TextNode(state.ValidationError, Tone: "danger")` in the view when non-null (the old `"error"`/`"warning"` *style* values were removed in 3.0.0 — severity is the `tone` axis now). The validation message round-trips with the state — those responses are `ok: true` (state-based validation is NOT a framework failure). See `demo/HelpDesk/AspNetCore/RequesterController.cs`. **First-class soft rejection (since npm 1.10.0 / NuGet 1.7.0):** for structured, field-addressable validation, return your normal render response and attach violations via `ShellResponse<TState>.WithRejection(...)` (.NET) / `shellRejection(...)` (TS) — this populates the `rejected: { violations: [{ path?, message }] }` envelope field alongside `ok: true`, so wire-driving agents read it directly while browser apps still see the kept `vm`/state. `agent-skill.md` documents the `rejected` shape. `BadRequest`/`BadRequestError` IS correct for structurally-invalid requests the user can't see (missing required action field, action name missing from the form entirely) — the framework wraps those into `{ok: false, errors: [{message: ...}]}` (no `code`) at the framework edge. Never use it for routine app-level validation.

5. **`UnknownActionError` / `UnknownActionException` is the `default:` arm.** Don't `return BadRequest(...)` or `throw new BadRequestError(...)` from your `default:` switch arm — throw `new UnknownActionException(payload.Name)` (.NET) or `throw new UnknownActionError(name)` (TS). The framework catches it and emits `{ok: false, errors: [{message: "Unknown action: ...", code: "unknown_action"}]}` at 400. `BadRequest` / `BadRequestError` is reserved for the structurally-invalid path (gotcha #4 above).

6. **Check `body.ok` ONCE at the response edge — don't branch on HTTP status.** The framework sets `ok` on every response (normal render, redirect, poll, sideEffects, busy, preventUnload — all `ok: true`; every framework-detected failure — `ok: false`). The shell surfaces `ok: false` responses as `VmsActionError` via the existing `onError` callback. Apps check `if (err instanceof VmsActionError)` in `onError` — not HTTP status codes, which are framework-internal routing signals.

7. **Tests need `global using Xunit;` in `GlobalUsings.cs`** (not auto-imported even with `ImplicitUsings`) and `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to access `DefaultHttpContext`.

8. **Null omission is now intrinsic — you no longer need to configure anything.** The wire contract ("an unset optional is *absent*, never `"field": null`") is baked into the published NuGet types: every nullable (`T?`) member carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`, which System.Text.Json honors **regardless of host `JsonSerializerOptions`** — so even default ASP.NET web JSON options emit the correct wire. The `DefaultIgnoreCondition = WhenWritingNull` line in every demo's `Program.cs` is now **redundant defense-in-depth, not load-bearing** (kept as the canonical pattern; safe to omit). This used to be a critical footgun (skip the config → `"field": null` everywhere → drift from TypeScript backends + strict-`tsc` consumer failures); it is no longer. **Optional non-nullable bools drop their `false` default** via `[JsonIgnore(Condition = WhenWritingDefault)]` so they're ABSENT (matching the TS optional `external?`/`required?`/`sortable?` posture) — this applies to `LinkNode.External`, `SectionLink.External`, `FieldNode.Required`, `TableColumn.Sortable`/`Filterable`/`LinkExternal`, and the response-level `PreventUnload`/`Busy` (3.3.0, F2). A non-nullable bool that is *semantically* meaningful as `false` and must ALWAYS serialize (e.g. `ShellErrorResponse.Ok`, always `false` on an error envelope) deliberately carries NO ignore condition. *Maintainer rule: a new nullable wire field MUST carry `WhenWritingNull`; a new optional non-nullable bool whose `false` means "absent/unset" MUST carry `WhenWritingDefault` (see the header comment in `ViewModels.cs`) — otherwise it silently re-introduces null/false-vs-absent drift from the TS twin.*

9. **Cross-backend parity testing lives in `parity/`.** Any new official backend must implement the fixtures listed in `parity/backends.json` and pass `bun run parity/run.ts`. The harness spins up every backend in parallel, runs the same action sequences against each, and diffs normalized responses step-for-step. Any wire-format drift fails the run.

---

## Architecture

The server is a pure function `(state, action) → (newState, view)`. Every request carries the entire UI state; the server never holds per-client state in memory. This means:

- **No per-tab registries**, no `ConcurrentDictionary<string, TState>`, no tab-id query parameter
- **Server can be stateless and horizontally scaled** — restarts don't lose anything (UI state lives client-side until page refresh)
- **Two browser tabs of the same app are naturally independent** — each holds its own state blob
- **Persistent data still lives server-side** — anything multi-user, authorized, or stored (database rows, files) stays in singletons. Only transient UI state (current view, filter, selected ID, validation error) round-trips with each request.

### Wire format

**GET (page load)** — server returns initial state alongside the initial view (carries `ok: true`, same as a POST render):
```json
{ "ok": true, "vm": <ViewNode tree>, "state": <app-defined state record> }
```

**POST (action dispatch)** — `multipart/form-data` with three kinds of entries:
| Field | Purpose |
|---|---|
| `_action` | JSON: `{ "name": "..." }` — action name only; no `context` field |
| `_state` | JSON: the current state record (carries all input values via `bind` paths) |
| any file-input `name` | the `File` object (when forms have file fields) |

Response is the same `{ "ok": true, "vm", "state" }` shape as GET (plus `ok: true`). On framework-detected failures: `{ "ok": false, "errors": [{"message": "...", "code": "..."}] }`. The shell stores `state` internally and sends it with the next dispatch automatically — apps don't manage state plumbing.

### The capability seam

**The core never references `HTMLElement`, `document`, or any platform type.** It is a pure wire-protocol transformer: it speaks the JSON contract and delegates every platform side-effect to the `Adapter` — exactly the way `render()` is already delegated. This is no longer an aspiration: it is a **CI-enforced, checkable invariant** (see *Enforcement* below).

**The verbs.** Platform side-effects are optional methods on the existing `Adapter` interface (`viewmodel-shell/src/index.ts`). `render` is the only required method; the three capability verbs are optional — a target opts into the capabilities it can serve:

```typescript
export interface Adapter {
  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void;     // required
  navigate?(url: string): void;                                            // redirect target
  storage?(scope: "local" | "session", key: string, value: string): void;  // write-only side-effect
  transport?(
    input: string,
    init: { method?: string; headers?: Record<string, string>; body?: FormData | string },
    hooks?: { onUploadProgress?: (sent: number, total: number) => void }
  ): Promise<Response>;                                                     // optional override; fetch is the default
}
```

- **`navigate?(url)`** — hand the platform off to a URL. `BrowserAdapter` implements it as `window.location.href = url` (relocated *verbatim* out of core — the binding moved where it executes, not what it does).
- **`storage?(scope, key, value)`** — write a client side-effect to platform storage. **Write-only**: the wire contract has no storage *read*. `BrowserAdapter` writes to `localStorage`/`sessionStorage` accordingly.
- **`transport?(input, init, hooks?)`** — optional transport override. **Asymmetric from the other two:** the core's own `fetch` is the universal default (browsers, Node 18+, Deno, Bun), so omitting `transport` is always safe — `load()`/`dispatch()` are *not* routed through a mandatory transport indirection. It exists as the extension point for the Phase 2 upload-progress XHR binding (`hooks.onUploadProgress`), which will be built *through* this seam with no further wire/API change.

**Optional-methods shape & non-breaking guarantee.** All three verbs are optional, so any existing custom `Adapter` that implements only `render` still compiles unchanged. Conversely, a new front-end target (mobile, terminal, …) becomes a *complete* target by implementing exactly one interface — that is the property this seam exists to create. The terminal target is no longer hypothetical: it ships in-repo as `@ashley-shrok/viewmodel-shell/tui` (drive any backend from a terminal with `npx vms-tui <url>`) — built solely on the `Adapter` interface, proof the seam delivered. **The terminal target is `@experimental`** (incomplete; scrolling, keyboard ergonomics, and layout coverage need more work) — it carries an `@experimental` TSDoc tag, emits a one-time runtime notice on `TuiAdapter` construction (silence: `VMS_TUI_SILENCE_EXPERIMENTAL=1`), and may change/be removed without a major bump. The seam itself and the browser/server/core packages are stable; only the TUI is provisional.

**Redirect resolution order.** When a response carries `redirect`, the shell resolves in this order:

1. `ShellOptions.onRedirect` if set — its signature is **unchanged** (`(url: string) => void`). Any consumer that sets `onRedirect` sees byte-identical behavior to before the refactor.
2. else `adapter.navigate(url)` — consumers relying on the old in-core default now get it from `BrowserAdapter.navigate` instead of core (still byte-identical, since every real consumer uses `BrowserAdapter`).
3. else a **loud error** (see fail-loud rule).

**Fail-loud rule.** Unlike `onError`/`onLoading`, `navigate`, `storage`, and `saveFile` have **no safe core default** — there is no sane no-op. If a redirect, storage side-effect, or download side-effect arrives and the capability is absent (no `onRedirect` and no `adapter.navigate`; or no `adapter.storage`; or no `adapter.saveFile`), the shell **fails loudly** — it surfaces an `Error` via `ShellOptions.onError` (or `console.error` if unset), **never a silent no-op**. This is a correctness/security requirement: a `set-local-storage` of an auth JWT (e.g. `hecate_jwt`) silently swallowed, a post-login redirect silently no-op'd, or an authenticated download silently dropped, is a security failure, not a soft degradation. An adapter author who omits `storage`/`navigate`/`saveFile` gets a hard, debuggable failure — not a swallowed auth token, a missed redirect, or a vanished download.

**Enforcement.** The "core references zero platform globals" invariant is enforced by a grep-based CI guard, scoped to **core `src/index.ts` only** (`viewmodel-shell/src/browser.ts` legitimately owns all DOM bindings and is *excluded*; `server.ts` is out of this guard's scope). The guard (`viewmodel-shell/scripts/check-core-platform-globals.mjs`, run locally via `npm run check:core-globals`) fails the build if `src/index.ts` references any of `window`, `document`, `localStorage`, `sessionStorage`, or `XMLHttpRequest`. It runs as a gating step in `.github/workflows/parity.yml` (the `Enforce core platform-agnosticism (AGNOSTIC-03)` step), alongside a framework-level jsdom adapter test that proves the relocated bindings actually fire. Universals deliberately kept in core (`fetch`, `FormData`, `setTimeout`, `URLSearchParams`, `console`) are not on the denylist. The guard scans **code only**: it strips line/block comments and string/template literals before the denylist match, so a clarifying doc comment or string in `index.ts` that *names* one of the five tokens (e.g. JSDoc explaining why `window` is intentionally absent) is allowed and will not false-fail CI — only a real code reference fails the build.

---

## Node types, action payloads & emitted CSS classes

The view tree is a discriminated union of typed nodes (a `type` string discriminator), shared by both backends. **This doc deliberately does not enumerate the node set, their props, the per-interaction action payloads, or the CSS classes each node emits.** A hand-copied catalog is exactly the drift that caused [issue #9](https://github.com/ashley-shrok/ViewModelShell/issues/9); the typed source is the single source of truth and cannot fall out of sync, because the build compiles it and CI parity-checks it:

| When you need… | Authoritative, always-current source |
|---|---|
| The node set + every prop / enum value | `viewmodel-shell/src/index.ts` (the `ViewNode` union + per-node interfaces), mirrored 1:1 in `viewmodel-shell-dotnet/ViewModels.cs` (.NET records + `[JsonDerivedType]` discriminators) |
| What `_action` / `_state` / file payload each interaction produces | the renderer in `viewmodel-shell/src/browser.ts`, exercised end-to-end by the fixtures under `parity/` |
| The exact CSS classes a node emits, and how they're styled | `viewmodel-shell/src/browser.ts` (emission) + `viewmodel-shell/styles/default.css` (the shipped styling of every class) |

This concern→source table is fixed: it does **not** grow when a node is added, so it cannot go stale. The two backend type sources are kept byte-aligned by the cross-backend parity suite (`parity/`, CI-gated) — a node or wire shape present in one backend and not the other fails the build. Behavior that isn't obvious from a node's type alone (immediate-dispatch vs. form-collected inputs; intentional omissions like the modal having no backdrop-dismissal) is documented at the type's definition in source and, where it cuts across nodes, in *Non-obvious framework behaviors* below. Runnable usage of every node lives in `demo/`. The wire stays multipart `_action` + `_state` + file entries (the stable contract in *Wire format* above); how to consume the emitted classes with zero app CSS is *Design system* below. **If your app needs a node / input type / text style / interaction you can't find in the source — ask; don't work around it.**

---

## Design system

The framework ships a serviceable look. The app does **not** hand-roll page CSS — it imports the stylesheet, optionally pins a theme, and (rarely) overrides a token. The live `demo/Showcase/` is the single source of truth for this section; every demo under `demo/` is a worked example of the real-app pattern below.

### Serviceable by default

Import the shipped stylesheet plus, optionally, one theme. The `.vms-page` shell + the `default.css` body rule own reset, centering, `--vms-page-max` width, background, and font — no app CSS, no `<style>` block, zero `@media`:

```typescript
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css"; // optional — pick one
```

The shipped themes are the files under `viewmodel-shell/styles/themes/` — one file = one import; that directory **is** the current, authoritative set (this doc doesn't list them, so it can't go stale as themes are added). The shipped **default** (no theme import) is the light value set; the prior dark default is preserved byte-for-byte as `themes/dark-purple.css`, one import away (`import "@ashley-shrok/viewmodel-shell/themes/dark-purple.css";`). A theme is one static import in your entrypoint (see `demo/ContactManager/frontend/src/main.ts`); multi-role apps import a distinct theme per role through the same seam (see `demo/HelpDesk/frontend/src/agent.ts` vs `requester.ts`).

### Appearance axes — one job per field (3.0.0)

A node's appearance is expressed through **orthogonal, composable axes** — each field carries exactly one concept, and they combine rather than multiplying into a grab-bag of named variants. This is the synthesis of how mature design systems (MUI, Chakra, Ant) model component appearance, and the rule that even the "fused" systems honor: *size is never baked into color or emphasis.* The authoritative value sets live in the type source (`viewmodel-shell/src/index.ts`, mirrored in `ViewModels.cs`); this is the *concept map*, not a drift-prone catalog.

| Axis | Field | Means | On |
|---|---|---|---|
| **tone** | `tone` | semantic intent / severity (the universal status color) | Button, CopyButton, Section, TextNode, ListItem, TableRow |
| **emphasis** | `emphasis` | visual weight — filled vs outline | Button, CopyButton |
| **size** | `size` | box geometry (padding/font); the ONLY axis that changes metrics | Button, CopyButton |
| **width** | `width` | `"full"` = stretch to fill the container (the standard full-width/"block" button) | Button, CopyButton |
| **variant** | `variant` | a section's structural surface kind (`card`) | Section |
| **style** | `style` | text typography (heading/body/muted/…) | TextNode |
| **state** | `state` | a row/item's lifecycle or selection (active/done/running/…); freeform, app-extensible | ListItem, TableRow |

They compose: a prominent destructive action is `emphasis:"primary" + tone:"danger"` (a filled red button); a status tile is `variant:"card" + tone:"warning"`; a row can be `state:"active"` and `tone:"danger"` at once. **The word "variant" means exactly one thing** (a section's surface kind) — it is NOT a place to put status or emphasis. When you reach for a "variant" on a button or row, you want `emphasis`/`tone`/`size` or `state`/`tone` instead. If a needed appearance can't be expressed by these axes, that's a gap to surface (see "Conventions for evolving the framework"), not a reason to overload one.

Two more standard primitives live alongside these (3.1.0, #22): **`DividerNode { orientation? }`** (a thematic-break/separator → `<hr>` or a vertical `role="separator"` div) and **`FormNode.submitButton?: ButtonNode`** (provide your own submit button — fully styled, e.g. `width:"full"` — instead of the auto-generated one; takes precedence over `submitLabel`/`submitAction`).

### The `--vms-*` override seam — override the token, don't hand-roll

The **only** sanctioned per-app deviation: a tiny per-app stylesheet with a single `:root{}` setting `--vms-*` tokens, imported in your entrypoint **after** the theme — **never** an HTML `<style>` block. Use it for a width retune (`--vms-page-max` — *global* default; `--vms-page-max-wide` — what `.vms-page--wide` expands to), branded fonts (`--vms-font-body` / `--vms-font-head` / `--vms-font-mono`), or any `--vms-*` color var for a full reskin. **For per-page width opt-in, prefer the `PageNode.width: "wide" | "full"` wire field** (added in 0.7.0) over a `:root` retune — the wire field expresses page-level intent without changing the global default. The theme files under `viewmodel-shell/styles/themes/` are the reskin reference; this seam is additive — never remove or rename a `--vms-*` var.

```typescript
import "@ashley-shrok/viewmodel-shell/styles.css";
import "@ashley-shrok/viewmodel-shell/themes/light-amber.css";
import "./app-tokens.css"; // :root{ --vms-page-max: 1280px; } — after the theme, never <style>
```

Live example: `demo/RetroBoard/frontend/src/app-tokens.css` (a single `:root{ --vms-page-max }` retune, imported after the pinned theme in `main.ts`).

### When to use which layout preset / density / card

Layout *arrangement* is server intent on the existing `page`/`section` nodes (appearance is 100% CSS). Decide from the tree, not the browser:

- **`stack`** (default — omit the field): vertical flow. Forms, single-column content. Byte-identical to today's output.
- **`split`**: two equal columns on wide, collapses to stacked on narrow with **zero app breakpoints**. List ↔ detail, content + aside.
- **`cards`**: auto-fit grid (`repeat(auto-fit, minmax(min(var(--vms-card-min),100%),1fr))`, default min 16rem), collapses to one column intrinsically. Dashboards, tile/summary grids. **`minItem` field** (1.12.0): a closed size token (`xs|sm|md|lg|xl` → 10/13/16/20/24rem) overrides the auto-fit min track per node — smaller packs more/narrower columns, larger fewer/wider.
- **`row`** (1.11.0): a left-aligned wrapping horizontal cluster; items hug content. The general horizontal primitive (a navbar/header composes from it). **`arrange` / `align` fields** (1.12.0) set main-axis distribution (`justify-content`) and cross-axis alignment (`align-items`) — closed unions from Compose/Flutter; the canonical header bar is `row` + `arrange:"space-between"` + a heading `TextNode` first child + a nested `row` nav cluster.
- **`sidebar`** (0.x): fixed-aside + fluid-main app shell that collapses by content width (the Holy Albatross), zero breakpoints.
- **`switcher`** (1.12.0): N equal items flip **all-row ↔ all-stack atomically** at a content-width `threshold` (`sm|md|lg|xl` → 20/30/40/48rem; default md), never a partial "2-then-1" — the distinction from `cards` auto-fit. Optional `limit` (`2..8`) caps items-per-row. Wizard steps, equal CTAs, evenly-split toolbars.
- **`fits` node** (1.12.0): the responsive-*selection* primitive (SwiftUI `ViewThatFits`) — renders the first child whose **intrinsic** size fits the container, else the next, else the last. The ONE non-pure-CSS layout primitive (client-side measurement). Use it to pick between layouts of **bounded** intrinsic width (toolbar ↔ menu, compact ↔ full controls); NOT for text-heavy multi-column panes (use `split`/`sidebar`'s own collapse). See its TSDoc in `index.ts`.
- **`density: "compact"`** on `page`: tightens the spacing rhythm tokens globally — no app CSS.
- **`section variant:"card"`**: a grouped surface (background / border / padding / radius). Dashboard tiles, detail panes.
- **`page width: "wide"`** (0.7.0): widens the page cap from `--vms-page-max` (1080px) to `--vms-page-max-wide` (1440px) for data-heavy views (wide tables, dense list+detail). `width: "full"` removes the cap entirely. Omit for the framework default. TUI ignores it (terminals fill naturally).

The exact field/enum values live in the type source (`viewmodel-shell/src/index.ts`); the live **Showcase "Layouts" tab** (`demo/Showcase/`) is the visual reference for every preset above.

### Layout policy

**The governing test for every future layout change.** When a request would add a layout knob to the wire, do not debate it — run it against the two principles below. A field joins the layout vocabulary **iff it passes BOTH**; a field that fails either is rejected, no exceptions. These are the synthesis of four mature framework families (CSS-grid, component libraries, first-principles primitives, declarative-native UI); the rationale of record is `.planning/design/layout-system-research.md` (read it before proposing any layout addition).

- **P1 — responsiveness must be intrinsic / container-relative, with ZERO viewport breakpoints.** Collapse and reflow come from the mechanisms that are placement-agnostic by construction: auto-fit `minmax(min(X,100%),1fr)` grid, flex-wrap + flex-basis, negative-flex-basis axis-flip (Switcher), the Holy-Albatross coupled wrap (Sidebar), `min`/`max`/`clamp` sizing, and — as the **only** escape hatch — **CSS container queries**. A viewport `@media` rule is **never** acceptable: the server doesn't know the viewport, where a node will sit, or how wide its slot is, so a breakpoint object (`{xs,md,lg}`) or a 12-column `colSpan` that re-places per tier structurally violates the contract. The framework owns responsiveness; the app emits zero breakpoints.

- **P2 — every layout knob crossing the wire is a closed enum or bounded scalar, never raw CSS.** A layout field is a closed union (e.g. `arrange`/`align`'s value sets) or a bounded token (a spacing-scale rung, a `cards` min-item width), never a CSS value, span, track, area, or breakpoint map. Layout fields are allowed to be more mechanism-flavored than the rest of the tree *because they're ignorable* — but "ignorable" buys richer flow knobs, NOT raw CSS or mobile-breaking placement.

`arrange:"space-between"` passes both (intrinsic main-axis distribution; closed union) — it is in. A 12-col `colSpan` fails both (needs breakpoints to re-place; an open-ish int against a placement grid) — it is out. Container-query reflow against a small framework-defined threshold set passes; a viewport `{xs,md,lg}` object fails P1.

**Two layouts a grid provably cannot express** — the genuine flexbox idioms that earn their own node rather than folding into the auto-fit grid: **`sidebar`** (fixed-aside + fluid-main collapsing by content width, not viewport — the Holy Albatross) and **`switcher`** (N equal items flipping all-row ↔ all-stack atomically, never an awkward "2-then-1" — negative-flex-basis). VMS ships both `sidebar` and `switcher`. Everything else surveyed is either a grid/flex configuration (foldable into the existing presets) or a different concern (overlay → `modal`, surface → `section variant:"card"`).

Per the existing concern→source convention, the authoritative enum value sets for layout fields live in the type source (`viewmodel-shell/src/index.ts`, mirrored in `ViewModels.cs`) — this section states the *policy*, not a drift-prone catalog of values.

### The canonical worked example (single source of truth)

The Showcase's three archetype views are the locked teaching mapping — point an agent at the live `demo/Showcase/frontend/src/main.ts`, do not re-invent snippets:

| Archetype | Layout preset | Bootstrap benchmark |
|---|---|---|
| Dashboard | `cards` (stat/summary tiles via `section variant:"card"`) | "Dashboard" |
| Form-heavy | `stack` (default vertical; multi-section form) | "Checkout" |
| List/detail | `split` (list ↔ detail pane, collapses on narrow) | "Album" |

These three views render the fixed shipped light default; the gallery view keeps the runtime 12-theme switcher. Docs and the Showcase reinforce each other — they cannot drift.

---

## Non-obvious framework behaviors

These are already implemented — you don't need to do anything to get them, but you should know they exist:

- **Automatic state round-tripping.** The shell holds the current state internally, sends it with every dispatch as the `_state` form field, and updates from the response. Apps never touch state plumbing — `getCurrentState()` exists if you need to inspect it.
- **Draft value preservation.** Drafts ARE state under the bind model: every input reads its value from its `bind` path and writes back on input/change, so a field's value survives a re-render as long as the server returns the same value for that path (it disappears only if the field disappears from the new tree, or the server returns new state for that path — the server is always authoritative). This covers text inputs, textareas, **and selects** (selects write to their bind on change, so they're preserved like any other bound input). **File inputs are the one exception**: their binary can't ride in JSON state, so the picked `File` is held in the adapter's `fileRegistry` and re-applied to newly rendered file inputs via `DataTransfer` (see below), travelling with the eventual multipart submission. (Historical note: pre-Phase-6 a DOM value-snapshot mechanism preserved typed text and explicitly *excluded* selects — that mechanism is gone; the bind model supersedes it.)
- **File-input persistence.** When the user picks a file, the `File` object is held in the adapter's `fileRegistry` and re-applied to newly rendered file inputs on each render. Files survive intermediate dispatches and travel with the eventual form submission.
- **Dispatch guard.** A second action can't be dispatched while a round trip is in flight. Concurrent clicks are silently dropped. `onLoading` fires around every dispatch.
- **Focus and scroll preservation.** Focused element + caret position + scrolled containers are restored after each re-render.
- **Collapsible-section open state.** `SectionNode.collapsible: true` renders a native `<details>`/`<summary>` (closed by default; the heading is the summary label, or `"Show details"` if headingless). The open/closed state is DOM-local — the server does NOT round-trip it (same conceptual model as draft text two bullets above). The renderer snapshots `<details>.open` by a stable key (`SectionNode.id ?? heading ?? "vms-section-anon"`, disambiguated by per-render ordinal) before re-rendering and restores it after, the same pattern used for focus and scroll. **Rare-case escape hatch for server-driven expansion** (e.g. auto-expand the section containing a validation error): re-key the section by changing its heading, changing its `id`, or adding/removing a wrapping node — the renderer drops the preserved state and the section re-renders in its (closed) default. The framework ships no `forceExpand` / `defaultOpen` wire field by design.
- **`getRequestHeaders` hook.** `ShellOptions.getRequestHeaders?: () => Record<string, string> | Promise<Record<string, string>>` is called before every `load()` and `dispatch()` request and merged into the headers. Use this for auth tokens, ASP.NET anti-forgery tokens (`RequestVerificationToken` header), or any other custom headers.
- **Uniform `ok` flag.** Every framework-rendered response — normal render, redirect, sideEffects-only, poll, busy/preventUnload toggle — carries `ok: true`. Every framework-detected failure carries `ok: false` with structured `errors[]`. Apps don't set `ok`; the framework does.
- **`VmsActionError` on existing `onError`.** A 4xx/5xx response with a parseable `{ok: false, errors: [...]}` body surfaces as a `VmsActionError` via your existing `onError` callback (status, errors, code shortcut). Apps that wired `onError` for fetch failures keep working unchanged; apps that want structured branching add `if (err instanceof VmsActionError)`.
- **`UnknownActionError` / `UnknownActionException`.** Throw this from your dispatch `default:` arm; the framework's catch produces `{ok: false, errors: [{message: "Unknown action: ...", code: "unknown_action"}]}` at 400.

---

## Patterns

### State record

Define a JSON-round-trippable record per controller. Use `IReadOnlyList<T>` for collections so `with` expressions and collection-expression spreads compose naturally:

```csharp
public record TasksState(
    IReadOnlyList<TaskRecord> Items,
    string Filter
)
{
    public static TasksState Initial() => new(
        Items: [/* seed data */],
        Filter: "all"
    );
}
```

For apps with **persistent data** (e.g. SQLite, files), keep that in a singleton service injected into the controller — the state record holds only UI state (current view, filter, selected ID, validation error). See `demo/HelpDesk/AspNetCore/` for SQLite + UI state coexisting.

### Controller pattern

```csharp
[ApiController]
[Route("api/your-feature")]
public class YourController : ControllerBase
{
    [HttpGet]
    public ShellResponse<YourState> Get()
    {
        var state = YourState.Initial();
        return new(BuildVm(state), state);
    }

    [HttpPost("action")]
    [Consumes("multipart/form-data")]
    public ActionResult<ShellResponse<YourState>> Action()
    {
        var payload = ActionPayload<YourState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());

        var state = payload.State;
        // Switch on payload.Name, produce new state via `with`:
        switch (payload.Name)
        {
            case "your-action":
                state = state with { /* changes */ };
                break;
            default: throw new UnknownActionException(payload.Name);
        }

        return new ShellResponse<YourState>(BuildVm(state), state);
    }

    private static ViewNode BuildVm(YourState state) => /* pure function of state */;
}
```

`BuildVm` is a pure function of state — no controller-level mutable fields, no registry lookup. Files travel as additional form entries; read them with `Request.Form.Files` and persist however the app needs.

Full examples: `demo/Tasks/AspNetCore/TasksController.cs`, `demo/HelpDesk/AspNetCore/AgentController.cs`.

### Server-initiated redirect

When an action needs to hand the browser off to a different URL (login completion, OAuth callback, post-onboarding routing), return `ShellResponse<TState>.RedirectTo(url)` instead of a normal render response. The shell will navigate the browser instead of re-rendering.

**C# (controller action):**
```csharp
case "login":
    var ok = _auth.Validate(Str("username"), Str("password"));
    if (!ok) { state = state with { Error = "Invalid credentials" }; break; }
    return ShellResponse<LoginState>.RedirectTo(returnUrl ?? "/app");
```

**TypeScript (optional override):** By default the shell does `window.location.href = url`. Override via `ShellOptions.onRedirect` when the default isn't right (e.g. SPA router, test environment):
```typescript
const shell = new ViewModelShell({
  // ...
  onRedirect: (url) => router.navigate(url),
});
```

Wire format — when the server returns a redirect, `vm` and `state` are omitted:
```json
{ "redirect": "/dashboard" }
```
Normal responses that don't include `redirect` are unaffected.

### Client side-effects

When a server action needs to reach past the render loop and touch something on the client environment — writing to storage, seeding a flag — return a `sideEffects` array. The shell applies effects in order before the redirect or re-render fires.

**C#:**
```csharp
// Redirect + write a JWT to localStorage (e.g. auth login)
return ShellResponse<LoginState>.RedirectTo(returnUrl ?? "/app")
    .WithEffect(ShellSideEffect.SetLocalStorage("hecate_jwt", token));

// Side effect without redirect (re-renders normally after applying effects)
return new ShellResponse<SomeState>(BuildVm(state), state)
    .WithEffect(ShellSideEffect.SetSessionStorage("draft_id", id));
```

Built-in effect types:

| Factory | `type` string | What it does |
|---|---|---|
| `ShellSideEffect.SetLocalStorage(key, value)` | `"set-local-storage"` | `localStorage.setItem(key, value)` |
| `ShellSideEffect.SetSessionStorage(key, value)` | `"set-session-storage"` | `sessionStorage.setItem(key, value)` |
| `ShellSideEffect.Download(url, filename?)` | `"download"` | Shell fetches `url` with `getRequestHeaders()` merged, parses `Content-Disposition` + `Content-Type`, hands the bytes to `Adapter.saveFile`. `BrowserAdapter` triggers a Save-As; `TuiAdapter` writes to `~/Downloads`. Filename precedence: `Content-Disposition` > side-effect `filename` > URL basename > `"download"`. Missing the `saveFile` capability fails loud (see fail-loud rule). |

Unknown `type` values are silently ignored by the shell — forward-compatible if new effect types are added later.

Wire format:
```json
{
  "sideEffects": [
    { "type": "set-local-storage", "key": "hecate_jwt", "value": "eyJ..." },
    { "type": "download", "url": "/api/invoices/42/pdf", "filename": "invoice-42.pdf" }
  ],
  "redirect": "/app"
}
```

**`"download"` design note.** Authenticated file downloads were the gap that motivated this side-effect type ([#10](https://github.com/ashley-shrok/ViewModelShell/issues/10)): `LinkNode { external: true }` is a top-level browser navigation that carries no shell headers, so every header-auth consumer (Bearer JWT via `getRequestHeaders()`) was forced into per-backend signed-URL machinery. The side-effect path reuses the existing header seam — the shell's own download fetch re-presents the merged headers to the file endpoint — and the server authorizes *in the action handler* with the real auth context. No new authorization lane; no per-backend token signing.

### Polling and push

Two mechanisms for server-initiated updates without user input:

**Built-in polling.** Set `pollInterval` on the TypeScript shell, and the framework dispatches a `"poll"` action on that cadence after every load/dispatch. The server handles `poll` like any other action — read current state, return updated state + view. Polls run silently (no `onLoading` fires).

```typescript
new ViewModelShell({ pollInterval: 1000, /* ... */ });
```

```csharp
case "poll":
    state = state with { Messages = _db.GetMessages() };
    break;
```

**Server-controlled cadence.** `NextPollIn` on the response overrides the next interval, or stops polling entirely:

```csharp
return new ShellResponse<JobState>(BuildVm(state), state) { NextPollIn = 2000 };
```

**External push (`shell.push(response)`).** Feed a pre-parsed response into the shell from outside the action loop — for SSE/WebSocket integrations:

```typescript
new EventSource("/api/chat/stream").onmessage = e => shell.push(JSON.parse(e.data));
```

**Critical pattern — drive stop/continue from a state field, not a server-side check.**

The natural-seeming approach for one-shot tasks is "return `NextPollIn` while the row's status is non-terminal, omit it when terminal." This works for slow-completing tasks but breaks silently for fast-completion paths: if the task finishes inside the request that started it, the first response carries the terminal state but no `NextPollIn` — so the client never starts polling, never re-renders, and the page freezes on the pre-completion view. Add a `PollingDone` (or similar) boolean to the state record, drive `NextPollIn` from that, and make sure the server emits `NextPollIn` at least once even when the task completes synchronously — the client needs that one tick to render the terminal state.

```csharp
state = state with { Job = job, PollingDone = job.Status is "complete" or "failed" };
return new ShellResponse<MyState>(BuildVm(state), state)
{
    NextPollIn = state.PollingDone ? 100 : 2000  // one final tick to render terminal state
};
```

Draft text, focus, caret position, and scroll positions are all preserved across poll/push re-renders — same as user-action re-renders.

### Tables in VMS — the canonical workflow pattern

`TableNode` is composable enough to express several UX shapes. The framework supports them all, but **for workflow apps — the dominant case VMS targets — there is one canonical shape, and demos / new code should follow it.** Naming the shapes explicitly so consumers (and agents helping them) know which to reach for:

| Mode | Shape on `TableNode` | When to use | Selection? |
|---|---|---|---|
| **A. Workflow (canonical)** — filter narrows to ≤ cap, show all matches, act on the chunk | `filterAction` set (status tabs + a free-text column filter via `TableColumn.filterable: true`); **no** `pagination`; `selection.buttons[]` set when matches are within the cap; the controller renders a `TextNode("Refine your filter — N matches, max is X")` when matches exceed the cap and emits an empty `rows: []` so the filter input stays accessible | Workflow / queue / admin tools where the user almost always knows what they're looking for. **This is the default to reach for.** | ✓ yes |
| **B. Browse + pagination** — page through everything, no selection | `pagination` set; `filterAction` optional; **no** `selection` | Pure browse without a selection step (a tickets list a user just reads through, an archived-records search results page) | ✗ no |
| **C. Browse + selection** (rare) | Not first-class. Apps compose `pagination` + `selection.buttons[]` and accept the cross-page-selection cost (paginating wipes the local selection set; document the limitation in the UI or work around it with an explicit "select all N matching" button — see below). | Gmail-style "select all 1,247 conversations" workflows. Rare in workflow apps. | partial, app-built |

**Why filter-narrow is canonical** — it sidesteps a whole class of UX bugs by construction. The old per-toggle round-trip `selection.action` (removed in 0.15.0) had the rapid-click + DOM-wipe bug specifically *because* selection had to survive across re-renders; with mode A there's no pagination, no re-renders that lose selection, no cross-page sweep. Users select within the visible chunk and act. If they need to act on rows they haven't narrowed to, their UX is probably wrong.

**The cap is the app's choice.** A claims-investigation tool might cap at 200; a quick-pick admin tool at 25; a tool with very lightweight rows might cap at 500. The framework doesn't have an opinion — pick what makes sense for your row weight and the user's working memory. The controller enforces it server-side (`if (matches > cap) renderTooBroadMessage()`).

**"Select all N matching" pattern** — when an app needs the Gmail affordance, **no framework primitive is needed.** Compose a regular `ButtonNode` (or `selection.buttons[]` entry) that dispatches a bulk action with **the current filter** in its context. The server runs the bulk against the filter query server-side, not against a row-id list. The framework already gives you everything: the filter is in state (round-tripped), the button is just a button, the action handler queries by filter and acts. No row-ids on the wire.

**Per-row navigation: `row.action` (the click-anywhere primitive, re-added in 1.1.0).** Set `TableRow.action` to an `ActionEvent` (TS) / `ActionDescriptor` (.NET) and the renderer makes the entire row clickable AND keyboard-activatable AND accessible — full keyboard support (`Enter` dispatches; `Space` `preventDefault`s page scroll then dispatches; `Tab` does NOT dispatch) and ARIA (`role="button"`, `tabindex=0`, `aria-label` derived from non-empty cell text joined by ` · `). Per-row identity is encoded in the action name (e.g. `select-ticket-42`), consistent with the Phase-6 wire — no `context` field. Pair it with `row.actions[]`, which now accepts a mix of `ButtonNode` and `CheckboxNode` (renderer dispatches by `entry.type`); clicks on those interactive descendants and on cell `linkLabel` anchors `stopPropagation` so they never double-fire `row.action`. **Reach for this over a per-row "Open" button** — the row is the affordance, the renderer adds keyboard + ARIA automatically, and it sidesteps the silently-broken empty-button rendering that the `actions[]` bug (also fixed in 1.1.0) used to cause.

**Worked example:** `demo/HelpDesk/AspNetCore/AgentController.cs` (+ bun twin at `demo/HelpDesk-bun/server.ts`) is the canonical reference. It seeds ~80 tickets so the cap actually fires; tabs narrow by status; the Title column has a free-text filter input; matches ≤ cap render with `selection.buttons[]` for bulk close/start/reopen; matches > cap render a "narrow further" message with the filter input still accessible. The three zero-row paths each carry a distinct, unambiguous signal so the user can never confuse one with a broken render: **over cap** → the "narrow further" warning above an empty table; **filter matches 0 against a non-empty DB** → muted `"No tickets match your filter."` above an empty table (filter input still reachable to edit/clear); **DB itself empty** → `"No tickets in queue."` with no table.

### Action payload — JSON body (curl/agent ergonomics)

The TypeScript shell always submits actions as `multipart/form-data` (because of file uploads). For human-driven or agent-driven callers using curl/PowerShell, multipart's two-layer escaping (JSON inside form field inside multipart) is friction. Controllers can opt into accepting `application/json` as a fallback content-type using `ActionPayload<TState>.ParseJson(jsonBody)`:

```csharp
[HttpPost("action")]
[Consumes("multipart/form-data", "application/json")]
public async Task<ActionResult<ShellResponse<MyState>>> Action()
{
    ActionPayload<MyState> payload;
    if (Request.HasJsonContentType())
    {
        using var reader = new StreamReader(Request.Body);
        payload = ActionPayload<MyState>.ParseJson(await reader.ReadToEndAsync());
    }
    else
    {
        payload = ActionPayload<MyState>.Parse(
            Request.Form["_action"].ToString(),
            Request.Form["_state"].ToString());
    }
    // ... rest of action
}
```

JSON body shape — flat, no nested escaping:
```json
{ "name": "add", "state": { ... } }
```

No `context` field. All input values travel in `state` (via bind paths). `curl --json '{"name":"poll","state":{...}}' /api/your/action` just works. File-bearing actions still need multipart — JSON support is an opt-in convenience, not a replacement.

On failure, the response body is `{ok: false, errors: [{path?, message, code?}]}` at 4xx/5xx — the same shape regardless of whether the failure was a parse error (400), unknown action (400), invalid tree (500), or uncaught exception (500). Agents check `body.ok`; framework-classified failures carry a `code` from the stable vocabulary (`parse_error`, `unknown_action`, `invalid_tree`, `uncaught_exception`).

### ShellResponse&lt;TState&gt; reference

Every field except `Vm` and `State` is optional. The combination determines what the shell does on receipt:

| Field | Type | Effect |
|---|---|---|
| `Vm` | `ViewNode?` | The view tree to render. Omit (null) when redirecting. |
| `State` | `TState?` | The new client state. Omit (null) when redirecting. |
| `Redirect` | `string?` | When set, the shell navigates to this URL instead of re-rendering. `Vm` and `State` are ignored. |
| `SideEffects` | `IReadOnlyList<ShellSideEffect>?` | Applied in order before redirect/render. Built-in types: `"set-local-storage"`, `"set-session-storage"`, `"download"`. Unknown types are silently ignored (forward-compatible). |
| `NextPollIn` | `int?` (ms) | Schedules the next poll at this delay. Falls back to `ShellOptions.pollInterval` if omitted. **Omit on a response with no `pollInterval` set to stop polling.** See the polling section for the fast-completion footgun. |
| `PreventUnload` | `bool` (0.14.0) | When `true`, the shell asks the adapter to install a "warn before navigating away" guard (browser shows the native "Leave site?" dialog on tab-close / refresh / cross-origin nav). When `false` / omitted, the guard is cleared. **Idempotent on every response** — set it on each render while a long-running server action is pending; the next response that omits it (or sets it `false`) clears the guard. `BrowserAdapter` ships the implementation via `beforeunload`; the TUI is a no-op (terminals have no unload). Modern browsers control the dialog text; it is not customizable. |
| `Busy` | `bool` (0.16.0) | When `true`, the shell **drops user-initiated dispatches** (polls bypass — they're how the server clears the state) and the `BrowserAdapter` toggles `.vms-busy` on its container. Default CSS makes every interactive descendant non-clickable (`cursor: wait` + `pointer-events: none`) so a rapid click during an in-flight round-trip can't visually flip a checkbox or depress a button — the lock is honest. Same idempotent on-every-response shape as `PreventUnload`; the two are naturally paired for long-running server actions ("Working…" modal + Busy + PreventUnload). The framework **also** applies `.vms-busy` implicitly for the duration of any single user-initiated dispatch (using the existing dispatching flag), so the rapid-click-during-round-trip problem is solved generically without consumers having to set `Busy` for every action. |
| `Ok` | `bool` (defaults to `true`) | Framework-set on every response. Apps don't set this. Present in the wire as `"ok": true` on all normal responses (render, redirect, poll, sideEffects, busy, preventUnload). Framework-detected failures (parse error, unknown action, invalid tree, uncaught exception) emit `"ok": false` with structured `errors[]` instead of a normal response. Single check across every response shape; the shell surfaces `ok: false` responses as `VmsActionError` via the existing `onError` callback. |

Factory methods on `ShellResponse<TState>`:
- `ShellResponse<T>.RedirectTo(url)` — redirect response with `Vm`/`State` null.
- `response.WithEffect(ShellSideEffect.SetLocalStorage(key, value))` — fluent side-effect append.

`ShellSideEffect` factories: `SetLocalStorage(key, value)`, `SetSessionStorage(key, value)`, `Download(url, filename?)`.

### TypeScript backend pattern

For Node/Bun/Deno/Cloudflare Workers backends, the `@ashley-shrok/viewmodel-shell/server` subpath mirrors the C# NuGet package — same wire format, same shapes, written in TypeScript. Use this when your team is end-to-end TypeScript and prefers a single language over the .NET reference backend.

```typescript
import {
  createAction,
  shellRedirect,
  shellSideEffect,
  UnknownActionError,
  type ActionPayload,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface TasksState {
  items: Array<{ id: string; title: string; completed: boolean }>;
  filter: "all" | "active" | "done";
}

function buildVm(state: TasksState): ViewNode { /* pure function of state */ }

// Hono / Bun.serve / Deno.serve / Cloudflare Workers — anything Web Fetch native:
app.post("/api/tasks/action", createAction<TasksState>(async (payload) => {
  let state = payload.state;
  switch (payload.name) {
    case "add":
      state = { ...state, items: [...state.items, /* ... */] };
      break;
    case "login":
      return shellRedirect("/dashboard");
    case "save-jwt":
      return {
        vm: buildVm(state),
        state,
        sideEffects: [shellSideEffect.setLocalStorage("jwt", (payload.state as { token: string }).token)],
      };
    default:
      throw new UnknownActionError(payload.name);
  }
  return { vm: buildVm(state), state };
}));
```

`createAction` auto-detects content-type (JSON vs multipart) so shell-driven submissions and curl/agent callers both work without per-route code. Files in multipart submissions are surfaced on `payload.files` as `Record<string, File>`.

For Express, wrap with a small adapter that turns `(req, res)` into a `Request` and writes the `Response` back. The framework stays Web Fetch native to avoid maintaining a matrix of framework-specific adapters.

The subpath ships under the same npm package (no separate version to manage) and the types literally cannot drift because they're in the same source tree.

### Frontend wiring

```typescript
import { ViewModelShell } from "viewmodel-shell";
import { BrowserAdapter } from "viewmodel-shell/browser";

const container = document.getElementById("app")!;
const shell = new ViewModelShell({
  endpoint: `/api/your-feature`,
  actionEndpoint: `/api/your-feature/action`,
  adapter: new BrowserAdapter(container),
  onLoading: (loading) => { /* app-level hook — e.g. toggle a spinner. No shipped dim affordance. */ },
  onError: (err) => { /* show error banner */ },
});

shell.load();
```

No tab ID, no query parameters — multi-tab isolation comes from each tab carrying its own state.

### Agent discoverability

Every backend-bearing demo page in this repo carries a one-line HTML comment + a `<meta name="viewmodel-shell">` tag in `<head>` that announces "this is a VMS app — drive it via the JSON wire" and names the endpoint pair. Visible to any agent that reads the page's HTML, **including JS-less ones** (`curl`, `WebFetch`, basic crawlers) — which matters, because "agents can drive this without a browser" is the framework's pitch.

```html
<!-- Agent discoverability — this is a ViewModel Shell app: agents can drive it via the JSON wire
     (GET endpoint → {vm, state}; POST actionEndpoint multipart {_action, _state}). Docs: https://github.com/ashley-shrok/ViewModelShell -->
<meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/<x>","actionEndpoint":"/api/<x>/action","skill":"/.well-known/vms-skill.md"}'>
```

The `protocol` token is `viewmodel-shell/<major.minor>` of the **wire shape**, NOT the npm/NuGet package version — bump only when the wire itself changes shape (additive wire changes within a minor don't require a bump because old agents still work). As of npm 3.3.0 / NuGet 3.3.0 the wire shape is still at `viewmodel-shell/1.0` — the wire has not undergone a breaking change since the protocol token was introduced (the 3.0.0 appearance-axes unification and later additions were all additive optional fields, not wire-shape breaks). So the package can be 3.x while the protocol token stays 1.0; that is correct.

**Agent skill (1.6.0 / 1.5.0):** the optional `skill` field on the same meta tag points at a markdown operating manual for the VMS wire protocol. Agents driving the API cold — `curl`, `WebFetch`, an LLM reading the page — can `GET` that URL to obtain a self-contained protocol manual (action dispatch shape, state round-trip rules, response envelope vocabulary, side-effect verbs, polling, errors, file uploads). Old agents that don't know about the field simply ignore it; old apps without the field continue to work.

**Mount the skill endpoint.** Both backends ship a one-liner helper that serves the canonical markdown at any URL you pick (recommended: `/.well-known/vms-skill.md`), with an optional `appPreamble` prepended under a `## App-specific notes` heading + `---` separator. Body is built once at mount / handler-creation time; per-request cost is just a `Response.WriteAsync`.

**.NET** (any `IEndpointRouteBuilder` host — typically `app` in Program.cs):
```csharp
using ViewModelShell;
app.MapVmsAgentSkill(appPreamble: "App-specific context for agents.");
// or with a custom path:
app.MapVmsAgentSkill("/.well-known/vms-skill.md", appPreamble: "...");
```

**TypeScript** (Bun / Deno / Hono / Cloudflare Workers — anything Web Fetch native):
```typescript
import { createAgentSkillHandler } from "@ashley-shrok/viewmodel-shell/server";
const skillHandler = createAgentSkillHandler({ appPreamble: "App-specific context for agents." });
// mount on /.well-known/vms-skill.md per your router; the handler is (Request) => Response.
```

Both helpers serve `Content-Type: text/markdown; charset=utf-8`. Missing-resource is fail-loud — the .NET helper throws `InvalidOperationException` at mount time (not at first request) if the embedded resource is absent, and the TS helper throws at module-init if the markdown file is absent from the package. This mirrors the capability-seam fail-loud rule above.

**Canonical skill source:** `viewmodel-shell/agent-skill.md` (npm-side, single source of truth). The .NET package embeds a byte-identical copy at `viewmodel-shell-dotnet/AgentSkill.md` as a logical resource (`AshleyShrok.ViewModelShell.AgentSkill.md`); the parity gate in `parity/check-skill.ts` diffs both source files AND the served HTTP bodies on the HelpDesk twins, so the .NET copy cannot silently drift. **Maintainer rule:** any change to the wire shape, response envelope, side-effect verb set, error code vocabulary, or polling semantics MUST update `viewmodel-shell/agent-skill.md` in the same change, then re-copy to `viewmodel-shell-dotnet/AgentSkill.md`. The parity gate fails the build on drift, so this isn't optional — but updating the skill in the same change is what keeps it useful.

**Convention rule:** any new demo page that mounts a VMS shell MUST include this meta (`grep -L 'viewmodel-shell"' demo/**/*.html` should return nothing among backend-bearing pages). Chooser/landing pages with no shell mount (e.g. `demo/HelpDesk/frontend/index.html`) and the pure-frontend `demo/Showcase/` don't carry it — they have no endpoint to advertise. The parity suite doesn't check it (it's an out-of-band discoverability signal, not part of the wire); reviewers do.

### MSBuild target

Runs `npm run build` automatically before every `dotnet build` / Visual Studio F5:

```xml
<Target Name="NpmInstall" BeforeTargets="BuildFrontend"
        Condition="!Exists('$(MSBuildProjectDirectory)/../frontend/node_modules')">
  <Exec Command="npm install" WorkingDirectory="$(MSBuildProjectDirectory)/../frontend" />
</Target>
<Target Name="BuildFrontend" BeforeTargets="Build">
  <Exec Command="npm run build" WorkingDirectory="$(MSBuildProjectDirectory)/../frontend" />
</Target>
```

Full example: `demo/Tasks/AspNetCore/ViewModelShell.csproj`.

---

## Testing

Both layers are testable with normal unit tests — no browser, no Playwright, no running server.

**Frontend / adapter:** `cd viewmodel-shell && npx vitest run`. The renderer + shell-loop tests use `BrowserAdapter` directly with jsdom — no browser, no running server. Pattern: `viewmodel-shell/src/adapter.test.ts` and the focused suites under `viewmodel-shell/test/` (demo frontends ship no tests of their own; the framework suite covers the adapter).

**Backend:** `cd <test-project-dir> && dotnet test`. Tests call controller methods directly with a real `DefaultHttpContext` — no HTTP stack. The action endpoint reads from `Request.Form`, so the `Act` helper serializes both action and state into form fields:

```csharp
private static ActionResult<ShellResponse<YourState>> Act(
    YourController ctrl, YourState state, string name)
{
    var actionJson = JsonSerializer.Serialize(new { name });
    var stateJson  = JsonSerializer.Serialize(state);
    ctrl.ControllerContext.HttpContext.Request.Form = new FormCollection(
        new Dictionary<string, StringValues>
        {
            ["_action"] = actionJson,
            ["_state"]  = stateJson,
        });
    return ctrl.Action();
}
```

Multi-step tests thread state explicitly:
```csharp
var step1 = Ok(Act(ctrl, YourState.Initial(), "first-action"));
var step2 = Ok(Act(ctrl, step1.State, "second-action"));
```

For DB-backed apps, use a named in-memory SQLite connection shared across test methods (anchor connection kept open for the test class lifetime to keep the in-memory DB alive). See `demo/HelpDesk/AspNetCore.Tests/RequesterControllerTests.cs`.

---

## Demo apps

Worked, runnable examples live under `demo/` — read the ones nearest your app's shape before writing new code; the patterns are consistent across them, and each demo's source/entrypoint shows what it exercises. No catalog here on purpose: the demo set grows and a list would drift discover them yourself instead: `ls demo/` is the live set (`<Name>-bun/` is the TypeScript-backend twin of `<Name>/`), and `parity/backends.json` is the machine-checked registry of every backend — it *can't* go stale, because CI fails the moment it drifts from reality.

---

## Conventions for evolving the framework

- **Don't add features the framework doesn't have a clean place for.** When a request would require a workaround, that's usually a signal that the framework needs a new primitive — ask before patching around it.
- **The .NET `ViewNode` types live in ONE place — `viewmodel-shell-dotnet/ViewModels.cs`.** Every .NET demo consumes it via `<ProjectReference>` to `AshleyShrok.ViewModelShell.csproj` (there are **no** hand-copied `ViewModels.cs` files under `demo/` — verify with `find demo -name ViewModels.cs`, which returns nothing). So a node-type / wire-format change is a single edit there; it propagates to every demo on rebuild. The TypeScript twin is `viewmodel-shell/src/{index,server}.ts`. The two backends are kept byte-aligned by the cross-backend parity suite (`parity/`) — run it; it's what actually enforces no-drift.
- **`CHANGELOG.md` + `MIGRATION.md` are release-gated, not HEAD-synced.** They are append-only, version-specific history and are intentionally *not* kept in lockstep with `main` — they may lag between releases, and that's fine. The only rule: whenever you bump a package version / publish (npm or NuGet), add the matching `CHANGELOG.md` entry — and a `MIGRATION.md` note if consumers must do anything — in that same change. Never retro-edit old entries when a node is added.
- **🚨 GREEN-TREE GATE (precondition for everything below):** never push or publish on top of a broken tree — full framework tests, parity, core-globals guard, the framework's OWN .NET test project (`viewmodel-shell-dotnet/Tests`), AND every `demo/**/*.Tests.csproj` must pass first, with NO exception for "pre-existing" or "unrelated" or "just a demo" failures. See the **Working agreement** rule "NEVER PUBLISH OR PUSH ANYTHING BROKEN" below for the exact suite + procedure. A pre-existing red test you find mid-release gets fixed (or explicitly waived by the operator) before you bump versions.
- **🚨 A version bump is NOT a release — the registries are. Publishing is mandatory and manual.** Bumping `version` in `viewmodel-shell/package.json` or `Version` in `AshleyShrok.ViewModelShell.csproj` and pushing to git **does not release anything**. Consumers `npm install` / `dotnet add package` from the **registries**, not from this repo. Every version bump MUST be accompanied — in the same operator session — by the publish command(s) below. There is **no** CI publish workflow by design (npm auth-token expiry makes automated publishing more trouble than it's worth); the operator runs these by hand.
  - **🔑 Publishing is operator-gated — the registry credentials are NOT documented in this repo.** The npm + NuGet publish secrets live outside version control, held by the maintainer (gitignored, never committed). The exact credential location, the `~/.npmrc` token-sync ritual, and the "never `npm login`" / token-minting gotchas live in the **maintainer's own runbook** — not in this file. Before the publish commands below, the maintainer performs an auth precheck that activates the npm token and makes `$NUGET_API_KEY` available in the shell. A non-maintainer agent should NOT attempt to publish: make the change + bump versions, and defer the registry publish + tag to the operator.
  - **npm** (if `viewmodel-shell/package.json` version changed) — after the precheck above:
    ```bash
    cd "$(git rev-parse --show-toplevel)/viewmodel-shell"
    npm publish  # prepublishOnly runs `npm run build` first
    curl -s https://registry.npmjs.org/@ashley-shrok/viewmodel-shell \
      | python3 -c "import sys,json; print(json.load(sys.stdin)['dist-tags']['latest'])"  # confirm
    # NOTE: `npm view ... version` is cached; use the curl-to-registry form above for an authoritative read.
    ```
  - **NuGet** (if `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` `<Version>` changed) — after the maintainer's auth precheck (`$NUGET_API_KEY` is available in the shell):
    ```bash
    cd "$(git rev-parse --show-toplevel)/viewmodel-shell-dotnet"
    dotnet pack -c Release  # emits bin/Release/AshleyShrok.ViewModelShell.<version>.nupkg
    dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.<version>.nupkg \
      --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json
    curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json \
      | python3 -c "import sys,json; print(json.load(sys.stdin)['versions'][-1])"  # confirm
    ```
  - **CSS-only / non-.NET releases skip NuGet.** Asymmetric bumps are allowed (e.g. 1.3.0 was npm-only) — the CHANGELOG entry names the moving package(s) explicitly so the next operator knows what to publish.
  - **Tag the release after a successful publish.** Annotated tag at the release commit so `git checkout v1.X.Y` works for backlog recovery and the version is browsable on GitHub:
    ```bash
    git tag -a v<version> <release-commit-sha> -m "viewmodel-shell <version>"
    git push origin v<version>
    ```
    Tag NAMING is `v<semver>` (matches the existing v1.0.0 / v1.0.1 tags). Tagging is part of the release, not optional — untagged releases break `git checkout v1.X.Y`-based backlog recovery and are invisible to anyone browsing tags on GitHub. **We deliberately do NOT cut GitHub *Releases*** (the Releases page is intentionally left at its old state) — distribution is npm + NuGet, and `CHANGELOG.md` is the canonical per-version log, so a parallel GitHub Releases changelog would just be a second copy to keep in sync. Tags + CHANGELOG + the registries are the source of truth.
  - **🚨 Advance `main` to the release commit — a tag is NOT enough, and forgetting this stranded two releases.** A tag and a branch are both just pointers at a commit; tagging `v1.X.Y` and publishing does NOT move `main`. If the release work was done on a worktree/throwaway branch, you MUST also fast-forward/merge `main` up to the release commit and push `main` — otherwise the released commits are reachable *only* via the tag, dangling off a `main` that's still pointing at the previous version. A fresh `git clone` checks out `main`, so it silently gets the OLD code while npm/NuGet serve the new code. **Verify after every release: `git merge-base --is-ancestor v<version> main && echo "on main"`** — if that prints nothing, `main` is stranded; reconcile it (`git rebase v<version> main` to replay any main-only commits onto the release, or merge the tag in) and push. ⚠️ **This actually happened:** `v1.5.0` + `v1.6.0` were tagged and published to npm/NuGet on 2026-06-14 but never merged into `main`, leaving `origin/main` at `1.4.0` for two days — a clone made 2026-06-16 got 1.4.0 while npm served 1.6.0; the 1.5.0/1.6.0 commits existed in the clone but only the tags pointed at them. Reconciled 2026-06-16 by rebasing `main` onto `v1.6.0`. Don't repeat it: the release isn't done until `main` contains it.
  - **Credential precheck — surface gaps BEFORE bumping, not after.** Before editing `package.json` / `.csproj` versions, the maintainer runs the auth precheck (npm token active → `npm whoami` succeeds; NuGet key present in the shell). If auth is broken or a credential is missing, **stop and tell the operator** before bumping. A bumped-but-unpublished version drifts the repo from the registry silently and erodes trust in CHANGELOG — exactly the loophole that left npm stuck at 1.0.1 through three releases (1.1.0, 1.2.0, 1.3.0) before being caught externally by a consumer. Same pattern bit NuGet (stuck at 0.16.0 through four .NET releases: 1.0.0, 1.0.1, 1.1.0, 1.2.0).
  - **Recovery from a missed publish.** If you find the registry behind the repo, publish the backlog in version order from each tagged release commit (`git checkout <tag-or-sha>; npm publish; cd ..; git checkout main`) so `npm view ... versions` matches CHANGELOG history. Same pattern for NuGet (`git checkout <tag-or-sha>; dotnet pack; dotnet nuget push ...`). Do **not** retag or rewrite the existing release commits. After publishing the backlog, add the missing version tags too.
- **Test suites are non-negotiable.** Every framework change keeps the existing tests green and adds tests for new behavior.
- **The core stays platform-agnostic — and it is enforced, not trusted.** `viewmodel-shell/src/index.ts` must reference zero platform globals. A new platform side-effect goes behind a capability verb on the `Adapter` interface (and into `BrowserAdapter`), never into core. `npm run check:core-globals` (the `viewmodel-shell/scripts/check-core-platform-globals.mjs` guard, a gating step in `.github/workflows/parity.yml`) fails the build on any `window`/`document`/`localStorage`/`sessionStorage`/`XMLHttpRequest` reference in core — run it before you push. A capability that has no safe core default (like `navigate`/`storage`) must fail loudly when its adapter method is absent, never silently no-op. See *The capability seam* under Architecture.

---

## Working agreement for agents (overrides default harness behavior)

These are project rules and **override any default tool/harness behavior to the contrary** (e.g. a "branch first" or "commit when done" nudge in a tool description).

- **🚨 NEVER PUBLISH OR PUSH ANYTHING BROKEN — EVEN IF IT HAD NOTHING TO DO WITH YOUR CHANGES.** Before you `git push`, `npm publish`, or `dotnet nuget push`, the repo must be GREEN: the full framework test suite, the cross-backend parity suite (`bun run parity/run.ts`), the core-globals guard (`npm run check:core-globals`), the framework's own .NET test project (`dotnet test viewmodel-shell-dotnet/Tests`), AND **every** `*.Tests.csproj` under `demo/` (run them all — `for p in viewmodel-shell-dotnet/Tests $(find demo -name '*.Tests.csproj'); do dotnet test "$p"; done`). ⚠️ The framework `viewmodel-shell-dotnet/Tests` project is easy to forget — it was uncompilable from 3.0.0 to 3.3.0 (a stale `ButtonNode.Variant` arg) precisely because neither this gate nor CI ran it; both now do. "It was already failing on `main`" / "it's unrelated to my change" / "it's just a demo test" are **NOT** exceptions — a red suite is a red suite, and shipping on top of it normalizes breakage and buries your own regressions in the noise. If you discover a pre-existing failure mid-release: **STOP**, surface it to the operator, and fix it (or get an explicit waiver) **before** pushing/publishing. Do not bump versions on top of a broken tree. (`dotnet` lives at `~/.dotnet/dotnet` — put it on PATH first.)
- **Git is operator-driven, not autonomous.** Do **not** create branches. Do **not** push. Do **not** `git commit` unless the user explicitly asks in that turn. When asked to commit, commit to the **current branch** as-is — never auto-branch, even on `main`/`master`. Pushing and opening PRs happen only on an explicit, in-turn request. If a workflow seems to call for a branch or push, ask — don't infer.
- **No running state/ledger file.** This repo deliberately has **no** maintained narrative state file (the former `.planning/STATE.md` was removed for exactly this reason: a hand-updated status cache drifts and costs more than it's worth). Do not recreate one, and do not treat any file as a live status cache to keep in sync. Append-only history under `.planning/milestones/**` and `.planning/ROADMAP.md` may be **read** for context, but is not to be maintained as session bookkeeping. Track in-session work with the task tools, not a file.
