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

4a. **Markdown link scheme sanitization (shipped default, Plan 28-06 / v8.2.0).** `viewmodel-shell/src/markdown.ts` and the `AshleyShrok.ViewModelShell.Markdown` NuGet twin both ship a WHITELIST-based URL scheme sanitizer at every href emission site (regular `[label](href)` links + `<scheme:...>` autolinks). Allowed: `http`, `https`, `mailto`, `tel`, `ftp` + no-scheme relative URLs. Everything else — including `javascript:`, `data:`, `vbscript:`, `file:`, and any scheme this framework hasn't heard of — produces an EMPTY href (`""`), which the plain-collapse path then absents entirely from the emitted `InlineRun` (matching gotcha #8's "an option not set is absent" posture). The sanitizer runs BEFORE the opt-in `linkHrefRewrite` / `LinkHrefRewrite` hook, so a consumer hook can never see a raw dangerous scheme regardless of how the consumer wrote its rewrite function. Case-insensitive; leading whitespace stripped before matching. The two backends use IDENTICAL scheme lists, trim before scheme extraction, and lowercase before whitelist lookup — any change on one side MUST be mirrored on the other, enforced by 19 byte-parallel adversarial tests on each side (regular links + autolinks × 4 dangerous schemes × case-mixing + whitespace bypasses). **Consumers who need to allow an additional scheme** (e.g. a custom app-internal `myapp:` protocol) currently CANNOT — the whitelist is hard-coded. If that requirement materializes, the shape to add is a `MarkdownOptions.additionalAllowedSchemes: string[]` that extends the built-in list. **Consumers who want the OPPOSITE (an even stricter whitelist)** can implement it in their existing `linkHrefRewrite` hook — that hook receives the already-sanitized href, so e.g. `linkHrefRewrite: h => h.startsWith("ftp:") ? "" : h` further rejects `ftp:`. **Autolink fallback:** a sanitized autolink retains the RAW label as visible text (dead href, honest failure — the user sees the URL was dropped rather than a silent empty span). This is the same posture as gotcha #4: validation happens on the READ side of the wire, framework-owned, no consumer opt-in required to get the safe default. See Plan 28-06 SUMMARY for the full before/after audit table.

5. **`UnknownActionError` / `UnknownActionException` is the `default:` arm.** Don't `return BadRequest(...)` or `throw new BadRequestError(...)` from your `default:` switch arm — throw `new UnknownActionException(payload.Name)` (.NET) or `throw new UnknownActionError(name)` (TS). The framework catches it and emits `{ok: false, errors: [{message: "Unknown action: ...", code: "unknown_action"}]}` at 400. `BadRequest` / `BadRequestError` is reserved for the structurally-invalid path (gotcha #4 above).

6. **Check `body.ok` ONCE at the response edge — don't branch on HTTP status.** The framework sets `ok` on every response (normal render, redirect, poll, sideEffects, busy, preventUnload — all `ok: true`; every framework-detected failure — `ok: false`). The shell surfaces `ok: false` responses as `VmsActionError` via the existing `onError` callback. Apps check `if (err instanceof VmsActionError)` in `onError` — not HTTP status codes, which are framework-internal routing signals.

7. **Tests need `global using Xunit;` in `GlobalUsings.cs`** (not auto-imported even with `ImplicitUsings`) and `<FrameworkReference Include="Microsoft.AspNetCore.App" />` to access `DefaultHttpContext`.

8. **Null omission is now intrinsic — you no longer need to configure anything.** The wire contract ("an unset optional is *absent*, never `"field": null`") is baked into the published NuGet types: every nullable (`T?`) member carries `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]`, which System.Text.Json honors **regardless of host `JsonSerializerOptions`** — so even default ASP.NET web JSON options emit the correct wire. ⚠️ **But `DefaultIgnoreCondition = WhenWritingNull` in your `Program.cs` is still LOAD-BEARING — do NOT omit it.** (Corrected 2026-07-16; this section previously called it "redundant defense-in-depth… safe to omit", which is false and was actively dangerous advice.) The intrinsic `JsonIgnore` attributes cover the framework's **own `ViewNode` types** — they do NOT cover **your app's state record**, which is your type and carries no attributes unless you add them. A `string? SelectedId` on your state emits `"selectedId": null` the moment that line is gone, which is exactly the drift-from-the-TS-twin + strict-`tsc` footgun this gotcha exists to prevent. Demonstrated: `demo/ContactManager`'s `ContactsState.SelectedId` depends on that single line and nothing else. So: intrinsic for `vm`, config-dependent for `state`. Keep the line, or attribute every nullable on your own state record. **Optional non-nullable bools drop their `false` default** via `[JsonIgnore(Condition = WhenWritingDefault)]` so they're ABSENT (matching the TS optional `external?`/`required?`/`sortable?` posture) — this applies to `LinkNode.External`, `SectionLink.External`, `FieldNode.Required`/`Disabled`/`Readonly`, `ButtonNode.Disabled`, `TableColumn.Sortable`/`Filterable`/`LinkExternal`, and the response-level `PreventUnload`/`Busy` (3.3.0 F2; forms bools added 3.4.0). A non-nullable bool that is *semantically* meaningful as `false` and must ALWAYS serialize (e.g. `ShellErrorResponse.Ok`, always `false` on an error envelope) deliberately carries NO ignore condition. *Maintainer rule: a new nullable wire field MUST carry `WhenWritingNull`; a new optional non-nullable bool whose `false` means "absent/unset" MUST carry `WhenWritingDefault` (see the header comment in `ViewModels.cs`) — otherwise it silently re-introduces null/false-vs-absent drift from the TS twin.*

9. **Cross-backend parity testing lives in `parity/`.** Any new official backend must implement the fixtures listed in `parity/backends.json` and pass `bun run parity/run.ts`. The harness spins up every backend in parallel, runs the same action sequences against each, and diffs normalized responses step-for-step. Any wire-format drift fails the run. ⚠️ The diff is only *half* the gate: it also asserts **per-response invariants** (`findNulls`, `expectBodyContains`) that a comparison structurally cannot make — and a fixture proves nothing about a branch its own configuration never runs. Read "Know what a diff can and cannot prove" under *Conventions for evolving the framework* before adding or reconfiguring a fixture. ⚠️ `dotnet` lives at `~/.dotnet/dotnet` and the harness **spawns it as a child** — `export PATH="$HOME/.dotnet:$PATH"` first or the run dies with a bare `spawn` stack trace naming no cause.

   - **v9.0.0 postscript (Phase 29):** the pre-9.0.0 server-side version-skew guard was per-controller opt-in — a class-1 gotcha #9 defect where controllers using the plain `Parse(actionJson, stateJson)` overload silently accepted stale-client requests. v9.0.0's global filter (`ShellVersionGuardFilter` on .NET; `createVersionGuard` on TS server subpath) closes it. Parity fixture `agt-get-build-stale` in `parity/fixtures/helpdesk.json` is the tripwire per this gotcha's class-3 lesson — a substring-check on the response body proves the guard fires on GET (the branch the pre-9.0.0 fixture could not reach).

10. **Version-skew is a HARD LOCK on the client since v9.0.0, and the server-side guard is GLOBAL, not per-controller opt-in.** Two gotchas fold into one:

    - **Server-side:** `AddVmsShellVersioning(...)` (and the equivalent `createVersionGuard({ currentBuild })` TS-server factory) now enforces on BOTH GET + POST via a global filter. The per-controller `ActionPayload<T>.Parse(HttpRequest, currentBuild)` overload continues to compile + work (defense-in-depth) but the plain `Parse(actionJson, stateJson)` overload — which pre-v9.0.0 silently accepted stale-client requests when used from a controller lacking the guard — now ALSO fail-closes because the global filter short-circuits first. The change is transparent for the consumer's happy path; the RISK is if you were RELYING on the pre-9.0.0 silent-accept for some workflow, that workflow now fails with 400 stale_client. Reload to fresh bundle; nothing was applied.

    - **Client-side:** the shipped `BrowserAdapter` fires a non-dismissible hard-lock modal on any skew signal (detection via `VmsVersionSkewError` OR fail-closed via `VmsActionError code:"stale_client"`). Silent `adapter.reload()` is retired — the user clicks [Reload] to consent. **Consumer opt-out for pre-existing custom affordances:** set `ShellOptions.onVersionSkew: "custom"` — the shell still surfaces the signals via `onError` (byte-parallel to v3.8.0) but does NOT lock, NOT stop polling, and NOT call `showSkewLock`. Consumers with their own affordance (Kitsune, PBMInvoices) set this and keep their own path.

    See CHANGELOG v9.0.0 + MIGRATION v9.0.0 for wiring examples.

11. **`ChatComposerNode.stopAction` is REQUIRED when `status` can reach `"streaming"` — both sides fail-loud.** New in v9.1.0 (staged in CHANGELOG `## Unreleased`; landing at Phase 30 closeout). The AI-elements send-button state machine (`status: "idle" | "sending" | "streaming"` — see composite-nodes-layer.md §4e) drives what happens on button click: `idle` → send-icon fires `sendAction`; `sending` → spinner disabled (no dispatch); `streaming` → square/stop-icon fires **`stopAction`**. A `ChatComposerNode` rendered with `status:"streaming"` but no `stopAction` is a broken tree — the stop button has nothing to fire.

    **Both backends fail-loud on this misconfiguration (do NOT silently no-op):** the .NET tree validator rejects at render with `invalid_tree`; the browser adapter emits `console.error` + disables the send button (the user cannot interrupt a stream that has no stop path — surfacing the misconfig immediately is the correctness requirement). Non-AI consumers who never set `status` past `sending` never hit this — they get send-with-spinner at zero cost.

    **The correct AI-chat pattern:** your action handler that starts a stream returns `{status:"streaming", stopAction:{name:"stop-generation"}}` in the SAME response — never `status:"streaming"` alone. A subsequent `poll` (or an out-of-band `shell.push()`) completes the stream and returns `{status:"idle"}` — omit `stopAction` at that point (or keep it; the idle path ignores it).

    ```csharp
    // .NET action handler that starts a stream
    case "send-message":
        var streamId = _ai.StartStream(state.Draft);
        state = state with { Draft = "", StreamId = streamId, Status = ChatComposerStatus.Streaming };
        return new ShellResponse<ChatState>(BuildVm(state), state) { NextPollIn = 500 };

    // BuildVm — status:"streaming" MUST provide stopAction
    private static ViewNode BuildVm(ChatState state) => new ChatComposerNode(
        Bind: "draft",
        SendAction: new ActionEvent("send-message"),
        Status: state.Status,
        // ✅ stopAction wired whenever status can reach streaming — do NOT omit
        StopAction: state.Status == ChatComposerStatus.Streaming
            ? new ActionEvent("stop-generation")
            : null,
    );
    ```

    **Two related invariants** (same shape; failure modes to know about but they don't need separate gotchas):

    - `attachedFiles` blob-URL lifecycle. Attachments stage locally as `URL.createObjectURL` blob URLs in a per-composer registry keyed by the composite's `bind` path; the framework revokes them on X-remove and on successful send. If a composer disappears from the tree (server-side render drops it) while the bind path stays in state, the registry entry is not auto-GC'd — small leak, page-nav cleans up. Not a correctness bug; only relevant if you dynamically show/hide composers.
    - `attachBind` + `dropScope` require `attachAction`. A composer with attach-related config but no attach button is a misconfig — the browser adapter emits `console.error` and no-ops the extra config at runtime (no user impact, but the console warning surfaces the misconfig).

12. **`PageNode.title` renders a VISIBLE `<h1 class="vms-page__title">` at the top of the page — it is NOT just document metadata.** `BrowserAdapter` in `browser.ts` emits it as a real DOM heading. A page that composes its own header row (e.g. a `row` layout with a `TextNode(style:"heading")` first child) must **omit `title`** or it draws a second, redundant top heading above the app's own header. If you want the browser tab title without a visible page heading, set it via `document.title` in the app entrypoint instead. Same "grep the renderer before assuming a field is invisible" family as gotcha #1.

13. **NEVER import from the server bundle (`@ashley-shrok/viewmodel-shell/server`, i.e. `dist/server.js`) in a browser page.** The server bundle carries Node built-ins (`node:fs`/`node:url`/`node:path` — it reads the agent-skill file for `createAgentSkillHandler`) and a browser **cannot load `node:` scheme modules** → CORS/`ERR_FAILED` on the import → the ENTIRE ES-module graph fails to execute → blank page with zero interactive elements. A browser page may import ONLY `index.js` + `browser.js`. Server-only helpers (`validateActionNames`, `createAction`, `createAgentSkillHandler`, tree validator) must be **inlined or ported** into browser pages — do not reach across the seam. ⚠️ **`curl`-ing every asset for HTTP 200 does NOT prove the page renders** — the `node:` imports fail at browser runtime, not at the static-serve layer, so all assets return 200 while the page is dead. Same "a green that isn't proof" family as gotcha #9 — asset-availability ≠ module-graph-executes. A real render check needs a browser (or jsdom loading the exact module graph). Fast smoke test: grep the served HTML/JS for any `server.js` or `node:` import before handing anyone the link.

14. **CSS Containment: a `container-type` element CANNOT be restyled by its OWN container-query rules — only descendants can.** Per the CSS Containment spec (not a browser quirk), `container-type` establishes a containment context for **descendants**, and `@container` rules resolve against the **nearest ancestor** container. A rule targeting the same class that carries `container-type` matches no ancestor and is silently ignored. Concrete: v8.0.1 put `container-type: inline-size` on `.vms-list-row-standalone` AND wrote `@container (max-width: 28rem) { .vms-list-row { grid-template-areas: ... } }` — the rule was dead code for standalone rows, and Metis prod ran the un-fixed collapse for a week. **The fix pattern (v8.0.3):** introduce a NEW outer wrapper whose sole job is to carry `container-type`; the queried grid becomes a descendant. Renderer now emits `<div class="vms-list-row-standalone-container"><div class="vms-list-row vms-list-row-standalone">…</div></div>` — outer owns the CQ context, inner is a descendant CQ can restyle. Rule for every future `@container` addition: verify the `container-type` element and the element the CQ rule *restyles* are DIFFERENT elements — one must be an ancestor of the other. If they're the same, the rule is dead.

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

**`TableNode.selection` — the visible-scoped bulk-action toolbar (npm 6.4.0 / NuGet 6.5.0).** For the common "check some rows, then act on them" case, the framework ships a first-class affordance so you don't hand-roll it — and can't hand-roll the footgun below. Set `TableNode.selection = { buttons, harvestBind }` (exact shape in `viewmodel-shell/src/index.ts` / `ViewModels.cs`): the adapter renders `buttons[]` as a toolbar above the table, and a **header "select all" checkbox** auto-renders in the leading select cell whenever rows carry per-row `CheckboxNode`s (tri-state all/none/indeterminate; a pure client DOM toggle over the *rendered* rows). On a bulk-button click the adapter **harvests the currently-checked, currently-rendered row ids**, writes that `string[]` to `harvestBind` (overwriting), then dispatches name-only — so the server reads `state.{harvestBind}` and acts on **exactly the rows on screen**. This is visible-scoped *by construction*: a bulk action can never touch a row the operator can't see, even if the app's own `selectedIds` map still holds it. (It revives the old `selection.buttons[]` harvest — removed with the `context` wire in Phase 6 — adapted to write a bind; it carries **none** of the per-*toggle* dispatch that got the 0.15.0 `selection.action` mode removed, so selection stays a pure client concern until a bulk click.) Per-row checkboxes stay app-composed (a `CheckboxNode` bound to `selectedIds.{id}` in `row.actions`); the block only adds the toolbar + header box. Worked example: `demo/HelpDesk` (both twins).

**"Select all N matching" pattern** — for "act on *everything* matching the filter, including rows past the cap or on other pages" (the Gmail "select all 1,247" affordance), no framework primitive is needed, and `selection`'s harvest is the wrong tool (it only sees rendered rows). Compose a regular `ButtonNode` that dispatches a bulk action; the **current filter is already in state** (round-tripped via its bind — actions are name-only since Phase 6; there is no `context`), so the handler queries by the filter server-side and acts. No row-ids on the wire.

**Two independent facts about selection — don't conflate them.** (a) **The bulk ACTION is visible-scoped automatically when you use `TableNode.selection`.** The harvest only ever sends rendered rows, so a row selected under filter A and then filtered/paginated out of view is never acted on — you do **not** need to reconcile anything for action-safety; the framework guarantees it. (b) **Whether the check-STATE (the visual ticks) persists across a view change is an app policy.** The per-row checkboxes write the app's own `selectedIds` map, which the framework treats as opaque `TState` and cannot prune (the filtered-out rows aren't in `TableNode.rows`, so their binds aren't in the tree — there is nothing for the framework to reach). The safe, expected default for a server-driven app is **reset-on-nav**: clear your selection map when the filter or page changes (a one-line `state = state with { SelectedIds = new(), BulkSelection = [] }` in the filter/paginate handler — see `demo/HelpDesk/AspNetCore/AgentController.cs`), so no ticks linger from a view you've left. An app that genuinely wants cross-page accumulation simply doesn't clear — the framework forces neither (default, not enforce). **If you are NOT using the `selection` primitive** (hand-rolled bulk buttons that read the `selectedIds` map directly), then you own action-safety too: either dispatch "select all N matching" against the filter, or **reconcile `selection ∩ currently-visible-row-ids`** in the pure `buildVm` pass (derived-from-state, so always correct after any action) rather than carrying an independent accumulator that drifts from what's shown. (Bug class surfaced by PBMInvoices — "SelectedMap invisible carryover", Kara 2026-07-14; the `selection` harvest closes it by construction for the common case.)

**Per-row navigation: `row.action` (the click-anywhere primitive, re-added in 1.1.0).** Set `TableRow.action` to an `ActionEvent` (TS) / `ActionDescriptor` (.NET) and the renderer makes the entire row clickable AND keyboard-activatable AND accessible — full keyboard support (`Enter` dispatches; `Space` `preventDefault`s page scroll then dispatches; `Tab` does NOT dispatch) and ARIA (`role="button"`, `tabindex=0`, `aria-label` derived from non-empty cell text joined by ` · `). Per-row identity is encoded in the action name (e.g. `select-ticket-42`), consistent with the Phase-6 wire — no `context` field. Pair it with `row.actions[]`, which now accepts a mix of `ButtonNode` and `CheckboxNode` (renderer dispatches by `entry.type`); clicks on those interactive descendants and on cell `linkLabel` anchors `stopPropagation` so they never double-fire `row.action`. **Reach for this over a per-row "Open" button** — the row is the affordance, the renderer adds keyboard + ARIA automatically, and it sidesteps the silently-broken empty-button rendering that the `actions[]` bug (also fixed in 1.1.0) used to cause.

**Worked example:** `demo/HelpDesk/AspNetCore/AgentController.cs` (+ bun twin at `demo/HelpDesk-bun/server.ts`) is the canonical reference. It seeds ~80 tickets so the cap actually fires; tabs narrow by status; the Title column has a free-text filter input; matches ≤ cap render with `selection.buttons[]` for bulk close/start/reopen; matches > cap render a "narrow further" message with the filter input still accessible. The three zero-row paths each carry a distinct, unambiguous signal so the user can never confuse one with a broken render: **over cap** → the "narrow further" warning above an empty table; **filter matches 0 against a non-empty DB** → muted `"No tickets match your filter."` above an empty table (filter input still reachable to edit/clear); **DB itself empty** → `"No tickets in queue."` with no table.

### Typed column-filter primitive (v10.0.0)

Typed per-column filters ship as two orthogonal wire additions — a column declaration and a table-level bind map — plus a reference truth function consumers call in their action handlers. The browser adapter owns all UI (always-visible inline input + escalation popover + icon state grammar); apps never hand-roll filter HTML.

**Authoritative sources (don't copy here — they drift):**
- Wire types (`FilterSpec`, `FilterDescriptor`, `FilterRule`, `ValueKind`, operator aliases): `viewmodel-shell/src/index.ts` and `viewmodel-shell-dotnet/ViewModels.cs`
- Browser adapter UI rendering (inline input, popover DOM, icon state grammar): `viewmodel-shell/src/browser.ts`
- Reference truth function (`matchesFilter` / `FilterHelper.MatchesFilter`): `viewmodel-shell/src/server.ts` / `viewmodel-shell-dotnet/ViewModels.cs`
- Migration guide (before/after diff, 8 removed fields): `MIGRATION.md` § Migrating to v10.0.0

**Wire shape (concept map):**

| Field | Where | Meaning |
|-------|-------|---------|
| `filter?: FilterSpec` | `TableColumn` | Declares this column is filterable; specifies `kind` (text/number/date/fixed-set/yes-no), optional `options[]` (fixed-set list), optional `matchingHints[]` |
| `filterDescriptorBinds?: Record<string,string>` | `TableNode` | Maps each filterable column key to the state bind path holding its `FilterDescriptor` |
| `FilterDescriptor` | in state at bind path | `{ rules: FilterRule[], joiner: "all-of" \| "any-of" }` |
| `FilterRule` | inside `FilterDescriptor.rules[]` | `{ operator: string, value?: unknown }` — operator is a closed TS union per kind; `value` absent for no-value operators (is-empty, is-true, etc.) |

**Reference truth function:**

```typescript
// TypeScript server subpath — call in your action handler
import { matchesFilter } from "@ashley-shrok/viewmodel-shell/server";

// Returns true if the row cell satisfies the descriptor; false otherwise
const passes = matchesFilter(descriptor, rawValue, displayString, kind, matchingHints?);
```

```csharp
// .NET — call in your action handler
using ViewModelShell;
bool passes = FilterHelper.MatchesFilter(descriptor, rawValue, displayString, kind, matchingHints?);
```

The truth function covers every operator × kind combination: `contains` (case-insensitive, against `displayString`, honors `ignore-punctuation`); `equals`/`starts-with`/`ends-with` (text); numeric comparisons including `between`; ISO-8601 date comparisons including `in-range`; `is`/`is-not` (fixed-set); `is-true`/`is-false` (yes-no); `is-empty`/`is-not-empty` (all kinds — `null`/`undefined`/`""` = empty; whitespace-only = non-empty). Multi-rule with `all-of`/`any-of`. **Consumers call it; the framework never calls it implicitly.**

**C# wiring example:**

```csharp
// State record: one FilterDescriptor? per filterable column
public record AgentState(
    // ...
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    FilterDescriptor? TitleFilterDescriptor,
    // ...
)

// BuildVm: declare filter kind + bind path
new TableColumn("title", "Title", Filter: new FilterSpec("text")),
// ...
FilterDescriptorBinds: new Dictionary<string, string> { ["title"] = "titleFilterDescriptor" },

// Action handler: apply in-memory via FilterHelper
var descriptor = state.TitleFilterDescriptor;
var rows = allRows.Where(r =>
    FilterHelper.MatchesFilter(descriptor, r.Title, r.Title, "text")).ToList();
```

**TypeScript wiring example:**

```typescript
// Column declaration
{ key: "title", header: "Title", filter: { kind: "text" } }

// Table declaration
{ filterDescriptorBinds: { title: "filterDescriptors.title" } }

// Row evaluation (server subpath — not in browser pages, see Gotcha #13)
import { matchesFilter } from "@ashley-shrok/viewmodel-shell/server";
const visible = rows.filter(r =>
  matchesFilter(state.filterDescriptors?.title, r.title, r.title, "text"));
```

**UI grammar (adapter-owned — not on the wire):**

The browser adapter renders a filter row in the table header for every table with `filterDescriptorBinds` + at least one `filter`-bearing column. Per filterable column:

- **Always-visible inline `<input type="text">`** — the user types a plain contains value. Enter (or blur) commits: the adapter writes a single `{operator:"contains", value:"..."}` rule descriptor to the bind path via `sa.write`. No named action is dispatched; the descriptor arrives at the server on the next regular action (any button click, form submit, poll).
- **Filter-icon button** — opens the escalation popover. Icon state: `filter-slash` (empty descriptor), `filter` (exactly one "contains" rule = "simple"), `filter` + dot (any other configuration = "escalated").
- **Escalation popover** — mounted in a portal div (sibling of the table wrapper, escaping `overflow-x` clip). Contains: operator picker (closed enum for the column's kind), typed value input (text input / number / date / fixed-set select / yes-no select), "Add rule" button, all-of/any-of joiner toggle, Apply / Clear / Remove-rule affordances. **Apply** commits the draft descriptor to state. **Outside-click / Escape** discards the draft without committing — the filter state is unchanged.
- **Inline read-only summary** — for nontrivial descriptors (more than one rule or a non-contains operator), the inline `<input>` is replaced by a compact read-only text summary ("contains 'foo' AND > 100", max 40 chars).

**The key non-obvious behaviors:**

1. **Filter commits are state-writes, not named actions.** The adapter writes `FilterDescriptor` to state via the bind path directly — no `filterAction`-style named dispatch. The server picks up the updated descriptor on the next regular user action. This means a filter change followed immediately by clicking a row (select-ticket-42) is ONE round trip that carries both the new filter descriptor AND the row action — there's no intermediate filter-only round trip.

2. **Contains works on every kind.** A user typing "2026" into a date-column filter applies a contains rule against the display string (what they see in the cell). Numeric and date operators via the popover are in addition to, not instead of, contains. `matchesFilter` evaluates against `displayString` for contains and against `rawValue` for typed operators.

3. **"Is empty" treats null, undefined, and `""` as empty; whitespace-only is NOT empty.** A cell containing `"   "` (spaces) is not empty by this rule. Consistent with the framework's "an option not set is absent" posture — `null`/`undefined`/`""` are the three representations of "nothing".

4. **`filterDescriptorBinds` keys are column keys, not column headers.** The map key is the `TableColumn.key` value (e.g. `"title"`, `"status"`), not the display header string. The bind-path value must point to a `FilterDescriptor?` field in the state record — the adapter reads and writes to that path on every filter interaction.

5. **Browser-only pages cannot import `matchesFilter` from the server subpath (Gotcha #13).** The server subpath carries Node built-ins (`node:fs`, `node:url`, `node:path`) and a browser page that imports it will have a blank page with no error. Browser-only front-ends must apply filter logic inline against `FilterDescriptor.rules` directly — see `demo/Showcase/frontend/src/main.ts` for the reference pattern.

**Worked examples:** `demo/HelpDesk/AspNetCore/AgentController.cs` + `demo/HelpDesk-bun/server.ts` (typed text filter on the Title column); `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` + `demo/FeatureProbe-bun/handler.ts` (typed text filter on the Name column).

### In-modal success feedback (modal-swap-to-success)

The idiomatic way to confirm a completed action that happened *inside a modal* (a file import, a bulk add, a multi-field create) is **not a toast** — it's to keep the **same `ModalNode` open and swap its body** from the entry form to a success card (a `tone:"success"` `TextNode` + a single `[Done]` button that dismisses). Only `title` + `children` change across the render; there is no "close + reopen".

**Why this is the recommended shape, not a toast:** a toast is a foreground-only ~4s transient with no page-visibility awareness — if the operator kicks off the action and steps away (another tab, away from the desk), the toast fires and vanishes before they return, and they miss it. The in-modal success card is **state-driven and round-trips**, so it is still there when they come back. This is the general *outcome-in-view* principle (a view piece derived from state is always correct on the next render; a transient is not) applied to modals — the durable confirmation lives in the tree, not in a disappearing notification.

**It just works because the renderer is declarative.** A modal's presence *is* "there's a `ModalNode` in the tree"; the whole subtree re-renders from scratch each dispatch (the modal is not preserved/animated across renders, and there are no CSS enter animations to re-fire), so flipping the body is seamless — no flicker, no identity bookkeeping. The server story is one nullable "success message" (or a bool) on the state record: the action handler sets it and keeps the modal open; the view-builder branches on it; `[Done]`/dismiss clears it. Routine input validation on the same form rides the state record too (a `ValidationError` field → a `tone:"danger"` `TextNode`), **not** `BadRequest` — see gotcha #4.

**Worked example:** `demo/ExpenseTracker/AspNetCore/ExpensesController.cs` (+ the bun twin `demo/ExpenseTracker-bun/server.ts`) — the Add-Transaction modal swaps form → "Added $X to Category." success card on a valid submit, and shows an inline validation error (staying on the form) on an invalid one. **One a11y caveat to know:** the modal does no autofocus/focus-trap, so on the swap `[Done]` is not auto-focused and a screen reader will not auto-announce the success card — fine for a pointer user, a rough edge for keyboard/SR. (If that matters for your app, raise it — whether `ModalNode` should autofocus its first control is an open framework question, not something to work around per-app.)

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

- **🚨 On any VMS core MAJOR bump, every companion NuGet is rebuilt + republished with a bumped floor dep on the new major, in the same session.** Adding a positional parameter to a C# `record`'s primary ctor is **binary-breaking** regardless of the default value — the "trailing-append zero-retype convention" that governs in-tree source recompiles says NOTHING about downstream compatibility with previously-packed companion assemblies. A companion packed against core vN carries baked `newobj` opcodes referencing the vN ctor arities; under core v(N+1) with any changed positional arity, the JIT raises `MissingMethodException` at first-real-use. The in-tree gates (framework Tests, Markdown Tests, demo Tests, parity) all reach the core via `<ProjectReference>` (source rebuild) and are structurally blind to this — the `parity/check-companion-binary-compat.sh` gate is what actually exercises packed IL against a packed core. The rule: (a) at the end of the major-bump plan, rebuild every companion csproj under `viewmodel-shell-dotnet/*/` that carries a `<ProjectReference>` to the core; (b) bump each companion's patch version; (c) publish alongside the core in the same release session; (d) update the CHANGELOG with the affected consumers' action ("on core v(N+1), upgrade companion to X.Y.Z"). Precedent: Markdown 0.2.1 rebuild after 8.0.0 (this cost Amelia's Athena migration a day; the rule exists so no downstream is the discovery mechanism again).

---

### Route B composite-nodes layer (v8.0.0)

VMS ships two parallel tracks and both coexist.

- **Route A — primitives + axes.** Section/TextNode/Button/Field/… plus closed enums (tone/emphasis/size/state/layout/density). Consumers with shape-variance the framework didn't foresee drop to primitives and compose. This is what VMS shipped through v7.0.
- **Route B — pre-made composite recipes with typed slots.** For common web shapes with shared visual convention (list rows, chat messages, alerts, empty states, user rows, key-value details, timeline entries, settings toggles, dismissable chip clusters), the framework ships a NAMED recipe with typed slots and closed-enum variance axes. The recipe owns layout/typography/spacing; apps own the content. This is what v8.0.0 adds.

**Recipes never deprecate primitives.** A consumer with an unforeseen shape still drops to primitives; the recipes coexist with the axes, they don't replace them.

**The governance rule — earn a composite.** Adopted verbatim from Ashley's canonicalization at the 2026-07-29 tasting (`.planning/design/composite-nodes-layer.md` §2 is the copy-consistent source of truth):

> **A shape earns a composite node when the best-effort with today's primitives is a "pretty bad approximation" of the common shape. The bar is visual — the after has to look right; the before has to look wrong enough to justify the primitive earning a promotion. Judgment per shape; eyeballed against a served tasting before it earns the composite.**

Three properties of the rule that matter operationally:

- **The bar is visual, not theoretical.** A shape does not earn a composite because it *could* be a composite, or because a peer framework ships one. It earns it when the primitives-only render is bad and the recipe render is right, side-by-side. The tasting page is that eyeballing surface; every composite in v8.0.0 was approved through it, and new composites proposed later follow the same discipline: served tasting → visual sign-off → doc entry → plan.
- **Judgment per shape.** There is no rubric. Some shapes clear the bar dramatically (a timeline: primitives can't draw the vertical rail without app CSS, breaking "apps don't decorate"). Some clear it modestly (a key-value detail row: primitives give two texts on a line, but no aligned label column and no `<dl>` semantics). Some sit outside the bar entirely and are held pending signal. The governance is *judgment against the visual bar*, not a checklist.
- **Every proposed composite requires a before/after tasting served for review** BEFORE the composite earns its place in the wire.

**Two failure modes to guard against:**

- **Bloated grab-bag** — the recipe layer accumulates shapes that don't earn their weight, and the framework becomes a catalog of near-duplicates ("did you want ListRow, UserRow, or SettingRow?" for a shape that would be one row-primitive plus different content). **Mitigation:** high bar per recipe; every proposed recipe requires a served tasting before it enters the design doc; the rule is *earn*, not *propose*. The design-of-record's "not yet included" ledger records shapes intentionally NOT promoted, so the ceiling is documented, not just the floor.
- **Too-rigid recipe** — a recipe boxes in the consumer by making its slots or its variance too narrow ("I want the avatar to be a Badge, or my ChipList to include a numeric counter, or my Timeline entry to have a secondary line"), and consumers escape into workarounds again. **Mitigation:** typed slots stay **unconstrained-content `ViewNode` subtrees**, and variance stays in **closed-enum axes** (see typed-slots pattern below).

**The typed-slots pattern (uniform across every composite).** Every composite obeys the same structural shape — a deliberately small, semantically-consistent slot vocabulary so a reader of any composite recognizes the shape immediately:

```
{
  leading?     : ViewNode              // an icon, avatar, badge, checkbox — the row's leading affordance
  primary /
  heading      : string | ViewNode     // the composite's semantically-primary content
  secondary /
  description? : string | ViewNode     // typographically-subordinate second line
  meta?        : (string | ViewNode)[] // trained: text-xs, muted, opacity 0.85
  trailing?    : ViewNode              // right-aligned: timestamp, count, actions
  tone?        : "danger"|"warning"|"success"|"info"
  state?       : string                // freeform lifecycle axis (active/done/disabled/high/…)
  action?      : ActionEvent           // whole-row click (same shape as TableRow.action)
}
```

Three rules govern the pattern, and together they defeat the "too-rigid recipe" failure mode:

1. **Slots are typed by SEMANTIC NAME, not by node type.** A slot called `leading` accepts *any* ViewNode subtree — an IconNode, an AvatarNode, a BadgeNode, a CheckboxNode, a Section with nested children. The recipe doesn't say "leading must be an IconNode"; it says "leading is what goes at the front of the row, and here's the layout / alignment / gap the framework guarantees around it." The consumer drops in whatever ViewNode the shape needs. **The framework owns the recipe; the app owns the content.**
2. **Variance is expressed through CLOSED-ENUM AXES, never raw CSS or free-form fields.** The tone axis is `"danger" | "warning" | "success" | "info"`. The state axis is freeform lowercase strings (freeform because state vocabulary is app-lifecycle-specific, but still a single field, still one word per row). A consumer NEVER hands the recipe raw color, raw padding, or raw font size; they pick a tone value and the framework's design tokens do the rest. This closes the escape hatch that would let apps re-decorate through recipes.
3. **Every slot is optional except the one that names what the composite IS.** A ListRow without `primary` is not a list row; a Message without `content` is not a message; an Alert without `message` is not an alert. Exactly one slot per composite is required — the semantically-primary one — and every other slot is `?`. This is principle 7 ("an option not set is absent") applied at the composite level.

**The precedent — every surveyed server-driven peer ships this layer.** MUI `ListItemText` (typed `primary`/`secondary` slots), Ant `List.Item.Meta` (typed `avatar`/`title`/`description`), Chakra `Card` + `CardBody` + `CardFooter` composites, Phoenix LiveView function-component slots (`<:actions>`), Blazor Razor typed `ChildContent`, Bootstrap card composites, Rails Hotwire + ViewComponent slots, Laravel Livewire + Filament recipes. VMS was the outlier in shipping only Route A; Route B closes the gap. The closest analog for our shape-fit (server-authoritative, wire-driven) is Phoenix's slot pattern.

**Design of record.** `.planning/design/composite-nodes-layer.md` is the design of record for the v8.0.0 Composite-Nodes Layer milestone (Phases 23-26). Read it before proposing any addition to the Route B layer. §2 (the governance rule) and §3 (the typed-slots pattern) of that doc are the copy-consistent source of truth for the rule + pattern reproduced above — the two documents must stay aligned.

**Currently shipped recipes.** *(Updated as Phase 24-26 land. Docs describe SHIPPED recipes only — an entry appears here only after its plan's SUMMARY lands on `main`.)*

Phase 24 (v8.0.0, primary composites):
- **`ListRowNode` (COMP-05) + `ListNode.variant:"rows"` (COMP-05a)** — dense list row with 3-tier typography (`primary` body-weight-medium, `secondary` muted, `meta[]` caption); single-surface `rows` container with per-row dividers; bidirectional tree invariant (Rows list rejects non-list-row children; Items list rejects list-row children) with byte-identical error wording across TS + .NET. Whole-row `action?` follows `TableRow.action` shape verbatim (`role="button"`, `tabindex=0`, `aria-label` derived from flattened cell text, Enter/Space dispatches, `stopPropagation` on interactive descendants).
- **`MessageNode` (COMP-06) + `MessageListNode` (COMP-06a)** — chat/comment message with follow-tail transcript. **`MessageListNode.followTail` REUSES `SectionNode.followTail`'s shipped mechanism VERBATIM** — the pre-render snapshot / post-render restore at `browser.ts:227-246 + 362-372` walks EVERY `[data-follow-tail]` element, so the new consumer is a one-line renderer addition `el.dataset.followTail = ""`; **no new adapter code, ever**. Same posture will apply to any future "growing feed" composite (activity feed, live log, notification stream). Message content consumes AvatarNode (COMP-04) for the avatar slot + TextNode caption (COMP-01) for the timestamp + TextNode weight (COMP-02) for the author.
- **`AlertNode` (COMP-07)** — prominent status message with tone-appropriate icon. Tone→icon default map BAKED into `browser.ts:ALERT_TONE_ICON`: `danger`→`x-circle`, `warning`→`alert-triangle`, `success`→`check-circle`, `info`→`info` (overridable via `icon?`). `dismissible:true` dispatches the RESERVED `{name:"dismiss"}` action name — apps needing a distinct name compose their own dismiss button in `actions[]` instead of setting `dismissible`.
- **`EmptyStateNode` (COMP-08)** — friendly "nothing here" recipe. **v8.0 WIRE BREAKING:** field rename `heading`→`title`, `message`→`description`; new `icon?` slot. NOT a new node — a pre-existing shipped node whose schema was tightened at the v8.0.0 milestone boundary to match the typed-slots pattern above. This is the ONLY breaking wire change in the v8.0.0 composite-nodes layer; every other composite is additive. See `MIGRATION.md`.

Phase 25 (v8.0.0, secondary composites):
- **`UserRowNode` (COMP-09)** — person entity display: avatar + name + meta + right-aligned status dot. `status?: {label, kind}` uses a closed 4-value `StatusKind` enum (`online`→success, `away`→warning, `offline`→muted, `busy`→danger). Whole-row `action?` follows `TableRow.action` / `ListRowNode.action` shape verbatim (`role="button"`, Enter/Space dispatch, `stopPropagation` on interactive descendants) for the member-picker pattern.
- **`DetailRowNode` + `DetailListNode` (COMP-10 + 10a)** — key-value with aligned label column via CSS grid on `<dl>/<dt>/<dd>` (proper screen-reader term/definition semantics — impossible with row-wise `Section(arrange:"space-between")`). `labelWidth?: "sm"|"md"|"lg"` closed enum on the list (8/10/12rem). Trained typography: label = `text-xs uppercase weight:500 muted`; value = body.
- **`TimelineEntryNode` + `TimelineNode` (COMP-11 + 11a)** — activity feed with baked-in rail-and-dot CSS mechanism. **`::before` rail on the container + `::before` dot per entry with tone-encoded border — apps CANNOT compose this from primitives** (the composite exists specifically to bake it in, per "apps describe, never decorate"). This is the ONE genuinely new CSS pattern in Phase 25; every other Phase 25 composite is grid/flex/color-mix over existing primitives. Trained typography: time = caption (COMP-01); description = body (string or ViewNode).
- **`SettingRowNode` + `SettingListNode` (COMP-12 + 12a)** — label + description + trailing control. Grid: `[body | control]` = `1fr auto`, `align-items: center`. **Natural pairing with `CheckboxNode(variant:"switch")` from COMP-03** in the trailing slot; also common: `ButtonNode`, `LinkNode`. Optional list `heading?: string`. Whole-row `action?` opts into row-activation (same shape as `ListRowNode.action`).
- **`ChipNode` + `ChipListNode` (COMP-13 + 13a)** — tinted-pill cluster (filter chips, selected tags, categories); `ChipListNode` auto-wraps at container width. **`dismissAction?: ActionEvent` DEVIATES from `AlertNode.dismissible`** — it's a caller-supplied ActionEvent slot (identity-carrying: `remove-filter-42`), not a fixed-name boolean. Chip needs the app to name the action because chips typically operate on specific identities (mirrors `ModalNode`'s per-instance action shape, NOT Alert's reserved-name `{name:"dismiss"}` shape). If BOTH `action` and `dismissAction` are set, the X's click does `stopPropagation` so it doesn't double-fire the whole-chip click.

Phase 26 release ritual: TBD (aligned v8.0.0 npm + NuGet publish; comprehensive tailnet verification page across all 10 composites + 3 wire tweaks + 1 new primitive; see `.planning/design/composite-nodes-layer.md` §5).

Phase 27 (v8.1.0, state axis uniformity):

- **`state?: string` wire axis closed uniformly** across all row/composite types. Added to the 6 composites lacking it — `UserRowNode`, `MessageNode`, `DetailRowNode`, `TimelineEntryNode`, `SettingRowNode`, `ChipNode` — with `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]` on the .NET twin per gotcha #8. Field is freeform per the Ashley-locked Q1=B decision at the Phase 27 tasting (2026-07-30); framework ships styling for `active` (STYLE-3) and `done`/`disabled` (opacity 0.72 / 0.55) where applicable. Unrecognized values render an unstyled `.vms-{composite}--{state}` class (still round-trips cleanly for app-specific vocabulary).
- **Shipped `--active` rendering unified to STYLE-3** across all 8 non-Chip composites carrying the axis: `border-left: 3px solid var(--vms-accent)` on the composite's wrapper + `font-weight: 600` on the composite's semantic primary text slot. The 2 REPLACED rules (`ListItemNode` + `ListRowNode` — pre-8.1.0 used border-color+bg-glow and bg-glow-only respectively) are documented as visual changes for `state:"active"` consumers in MIGRATION.md v8.1.0. `TableRow` gains its first shipped `--active` rule (border-only variant; a multi-cell row has no single semantic primary text slot to weight). `ListItemNode` also ships the border-only variant because its renderer emits no dedicated primary-text slot class. `ListRowNode` ships a color-only mutation (`border-left-color`) because its base rule already reserved a transparent 3px border for the Phase 24 tone-axis mechanism — the diff stays minimum-touch. `ChipNode` ships the wire field only — NO shipped `--active` rule (out-of-scope per `.planning/design/composite-nodes-layer.md`; the tinted-pill shape doesn't map to STYLE-3's border-left + bold-primary convention; the pill IS the primary).
- **Consequence for the typed-slots governance rule** (§3): the `state?: string` axis's uniform presence across the 8 row-shaped composites is now the framework's precedent for lifecycle-axis coverage — future composites that earn the row/list shape MUST carry the axis. The earned-a-composite bar itself remains eyeball-per-visual (unchanged); this note only says that when a new row-shaped composite ships, the axis comes with it as a matter of course rather than as a per-composite design decision.

Phase 28 (v8.2.0, rich text WYSIWYG):

- **`RichTextFieldNode` leaf-input primitive (per D-01).** New dedicated input node — NOT `FieldNode(inputType:"rich")`. Rationale: anticipated customization surface (`allowedMarks`/`allowedNodes`, `mentionsProvider`, `plainTextValueBind`, `heightMin`/`heightMax`, `sanitizeConfig`) would ONLY apply to rich fields and would bloat FieldNode with a section every other inputType ignores. Fields: `name`, `bind`, `label?`, `placeholder?`, `toolbar?`, `required?`, `disabled?`, `state?`. Wire value is a **markdown STRING** on the field's bind path (per D-06) — zero XSS surface on the wire (no HTML crosses); display flows through the existing `markdown.ts` → InlineRuns pipeline with zero new render code. Feature-surface floor is Slack/GitHub level (D-08): bold, italic, link, ordered/unordered lists, headings h1–h3, inline code, code block, blockquote. Everything else (mentions, embeds, tables, image upload, comment-only mode) is deferred.
- **`RichTextToolbarNode` Route B composite (per D-02).** New composite with a typed `tools: RichTextTool[]` slot + closed-enum variance axes (`size`, `tone`, `state`). Framework owns TipTap chain wiring, button styling, keyboard shortcuts, focus management, and a11y (aria-labels + shortcut hints); the app declares WHICH tools appear. **When `RichTextFieldNode.toolbar` is OMITTED, the framework renders the DEFAULT toolbar (the full 11-tool D-08 floor) automatically** — an explicit `RichTextToolbarNode` is only needed to customize. Composite shape approved via before/after tasting served on the tailnet at `http://100.113.23.63:3021/`; Ashley signed off 2026-07-31 (`taste ok — with: fix code-block + quote editor-host rendering`, folded into Plan 28-05's CSS scope). Fifth composite adopting the Phase 27 `state?: string` axis uniformity rule — the axis is now a matter of course for row/list-shaped composites when they ship.
- **TipTap 2.x + turndown bundled into main `@ashley-shrok/viewmodel-shell` package (per D-04), lazy-imported from `browser.ts` following the Chart.js precedent.** Consumers who never render a `RichTextFieldNode` ship ZERO TipTap/turndown bytes — verified by adapter test asserting the modules are not in the initial bundle graph and by Vite's chunk split (the TipTap chunk is `index-*.js` ≈ 273 KB and only produced on first rich-text render). No opt-in subpath, no companion package, no consumer install step required. **Fail-loud on load failure** per the capability-seam rule: if TipTap or turndown fails to load at runtime (offline, network-restricted, corrupted bundle), the framework surfaces a hard `Error` via `console.error("[ViewModelShell]", …)`. No silent no-op, no automatic fallback to a plain textarea.
- **The shipped whitelist sanitizer (Plan 28-06; see gotcha #4a below).** v8.2.0 ships a WHITELIST URL-scheme sanitizer at every markdown → `InlineRun.href` emission site on BOTH backends. This closes the pre-8.2.0 stored-XSS gap where the opt-in `linkHrefRewrite` hook was the only sanitization surface. Not rich-text-specific — every consumer of the markdown → InlineRuns pipeline (including `TextNode(style:"markdown")`) inherits the protection on rebuild. See gotcha #4a for the shipped contract.

Phase 30 (v9.1.0, chat composer — staged in CHANGELOG `## Unreleased`; landing at closeout):

- **`ChatComposerNode` (CHAT-01..20)** — chat-app compose bar Route B composite: unified pill surface with growable-center textarea + fixed 34px circular leading (attach `+`/paperclip) / trailing (send / stop) icon buttons. Framework owns the intrinsic growable-center-fixed-ends layout that `Section(row)+heterogeneous-siblings` cannot reach even with a Route A `FieldNode(inputType:"file", variant:"icon-only")` addition — Ashley taste-locked Panel 3 at the 2026-08-02 3-panel tasting (`banging`); Panel 2 failed the visual bar for the substantive reason that the send button wraps under the attach button + textarea and there is no unified pill surface reachable from primitives. Design of record at `.planning/design/composite-nodes-layer.md §4e` + `RESEARCH.md` 825-line survey under `.planning/phases/30-.../`. **Send-button state machine** (Vercel AI Elements shape): `status: idle | sending | streaming` closed enum drives icon + click routing (`idle` → send-icon fires `sendAction`; `sending` → spinner disabled; `streaming` → square/stop-icon fires `stopAction`). Non-AI consumers never set past `sending` and pay ZERO cost. **IME `isComposing` guard baked-in NON-OPTIONAL** (CJK correctness per CHAT-12; adversarial jsdom test in Plan 30-06 is the regression gate — CJK Enter during composition never fires send). **Three converged attach ingress paths** (click / drag-drop / paste-image; universal industry mechanism per RESEARCH.md §Q1). Drag-drop `dropScope: "composer" | "global"` closed enum (Stream Chat `WithDragAndDropUpload` precedent; guarded by `dataTransfer.types.includes("Files")` so text drops don't fire). Framework-owned attachment preview chip strip renders in `headerSlot` position (consumer's own `headerSlot` content composes with it — both render). Per-item X-remove; blob-URL image thumbs + MIME-typed file icons. **Backspace-on-empty removes last attachment** (~5 adapter lines; AI-elements precedent; universal UX polish). Enter=send/Shift+Enter=newline default; `submitMode:"ctrl-enter"` (kebab per KebabEnum convention) opt-in flip for persistent-chat patterns. Attachments ride shipped multipart wire on `sendAction` dispatch under `attachBind` (default `"attachments"`) — VMS's server-side wire is a NET SIMPLIFICATION vs client-only SDKs (Stream Chat, AI Elements) that must invent presigned URLs + chunked uploads + per-attachment progress. Typed slots (`headerSlot`, `inputSlot`, `leadingSlot`, `trailingSlot`, `footerSlot`) accept ViewNode subtrees per Route B typed-slots rule; `attachAction` is NOT a slot — it's a first-class ActionEvent-that-triggers-an-attach-ingress (same pattern as `TableRow.action`, `ChipNode.dismissAction`). `ActionEvent.files` type widened from `Record<string, File>` to `Record<string, File | File[]>` for multi-file (backward-compat; single-file callers unchanged). **v1 EXPLICITLY DEFERS** (each a separate primitive/conversation, not a v1 gap to close inline): emoji picker, @mention / /command autocomplete, voice recording, dictation, screenshot capture, model selector, typing indicator, reply-preview / edit-mode indicators as first-class fields (consumer composes in `headerSlot`). Composer is the first Route B composite that is NOT row-shaped (single-instance compose bar, not a list); the `state?: string` axis uniformity precedent from Phase 27 is deferred here — `disabled` is already a first-class bool; `active`/`done` have no obvious compose-bar semantic. Ships one new shipped icon glyph (`square`, drives the streaming stop-icon).

---

### Design policy — build / don't-build guardrails (permanent)

The durable "what NOT to build (and why)" ledger + deferred-conditional decisions. Read before proposing a new primitive; a request that maps to a REJECTED item does not get re-litigated without a genuinely new argument.

#### REJECTED — do not revisit (they violate the philosophy)

- **Pointer drag-and-drop reorder** — not agent-drivable, which breaks principle 2 (the structured description must be sufficient). The compliant substitute is action-based `move` (up/down, server-CLAMPED, + a Move-to→modal relocate); the canonical pattern is blessed in `demo/Reorder/README.md`. Only ever add DnD as *sugar* over those actions, if revisited at all.
- **Any generic `style` / `css` escape hatch on nodes** — apps describe, never decorate (principle 4). If a needed appearance can't be expressed by the axes or a Route B composite, that's a gap to surface — not a hatch to add.
- **12-col span grid / viewport-breakpoint objects (`{xs,md,lg}`, `colSpan`)** — violates layout policy P1 (intrinsic/container-relative, zero viewport breakpoints) + P2 (closed enums / bounded scalars, never raw CSS).
- **`frame` / `reel` nodes** and **skeleton / shimmer loaders** — no clean philosophy fit.
- **`DrawerNode` / edge-anchored overlay panel** (asked 2026-07-16, right-side agent-info panel; Ashley rejected same day: *"I don't really see the point when you can do a modal."*). DECIDED, not deferred-pending-design. `ModalNode` is the answer for side/detail panels, and it is a *permanent* path for consumers. The overlay-vs-push + narrow-screen delta is real but does not earn a primitive. Also worth remembering the zero-primitive alternative: `open` is just state, so a server can render `layout:"sidebar"` when open and omit the aside when closed. A future ask must bring something genuinely beyond "a modal is centered and blocking."
- **App-controlled hover-reveal** (`SectionNode.hoverReveal?: bool`, `HoverActionsNode` — asked 2026-07-16, message action bars). Rejected on three independent grounds, the first decisive: **(1) we already built it and deleted it for cause.** `SectionNode.flyout` — a hover-reveal overlay — shipped in 1.11.0 and was REMOVED in **2.0.0 as the sole breaking change**: its only consumer abandoned it over an unfixable CSS hover-gap bug (moving the pointer to the revealed panel across a gap closed it). Re-adding the same mechanism re-buys the same bug. **(2)** Hover is a visual-presentation concern, so an app-facing toggle for it is the app decorating — if VMS ever decides row/message action bars are hover-revealed, that's the framework's own CSS decision (fine per "the framework ships a serviceable look"), NOT a wire field an app flips. **(3)** Hover doesn't exist on touch, and hover-only controls are a known a11y failure. ⚠️ Be precise about the objection: the actions ARE in the tree, so this is NOT a wire-sufficiency or agent-drivability break (don't overclaim it as one — that's the DnD objection, not this one). The always-visible action row is the correct, doctrine-safe answer.
- **Alternate front-end adapters (TUI/mobile) are not on the roadmap.** The `Adapter` seam + its fail-loud/agnosticism guarantees STAY (they're core philosophy and keep the door open); the existing TUI keeps its `@experimental` tag. But there is no investment in additional targets — do not propose them as roadmap items. VMS stays focused on the browser target + the agent/wire story.

#### Deferred / conditional (design-gated — build only on a real signal)

- **`menu-node`** — the first transient overlay beyond `modal`; REJECTED-**pending-design** (needs a design pass before any build).
- **Non-blocking Phase 17 (admission barrier, Stage 2)** — UNBUILT/CONDITIONAL. Only build if transient intent-drift actually bites in real consumer UX after Stage 1.
- **Replays: client-side companion for exact lane apply-order / discards** — deferred pure-addition; gated on whether anyone needs frame-exact non-blocking fidelity.
- **URL-state primitive (`ShellSideEffect { url-replace | url-push }` + deep-link read seam)** — asked 2026-07-18 (URL filter persistence). Ashley's bar: *"it's polish, not getting into it now; if it can't be done in a **standard framework way** we're not going to do it."* Assessment: the WRITE half is standard (drops into the existing side-effect family) but the READ half (parse URL on load → restore state for a bookmark) needs a **novel load-time seam** — VMS side-effects are write-only by contract — so a *complete* primitive is NOT standard-framework-clean today ⇒ not built. **The sanctioned answer is app-entry-point code:** an app reading the URL on load + calling `history.replaceState` after dispatch (public APIs, no rendering, state still in the round-tripped blob so agents are unaffected) IS the standard app-side way to layer URL sync — not a bypass, not an interim owing migration. **Revisit ONLY if a fully-standard shape for BOTH halves surfaces, or multiple consumers hit it.** Generalizes the rule: a primitive that's half-standard / half-novel-seam fails Ashley's "standard framework way" bar — don't build half a primitive.
- **`StepItem.tone` — per-step semantic status on StepsNode** — deferred pure-addition. StepsNode derives done/current/upcoming from `current`; a step can't show an attention/error/blocked status. Optional `tone?` on StepItem (mirroring TableRow/ListItem/Badge tone), orthogonal to the derived state. Build on a 2nd real signal or explicit greenlight.

#### Durable design-model note (keep server-side accumulators server-side)

A view piece **derived** from state (recomputed every render — e.g. a selection→action-bar) is always correct after any action. An independent **running total** fed by only one background action (e.g. a poll counter carried in round-tripped state) can visibly *stall* when a user action supersedes it — so keep such accumulators server-side. (Documented in `demo/NonBlocking-VERIFICATION.md`.)

---

- **🚨 Survey by CAPABILITY CATEGORY proactively, not just reactively.** "Borrow from mature frameworks before inventing" is stated as a design method for when we already *know* we need something; alone, that method is reactive and can only close gaps whose absence a consumer has tripped over. Complement it with a periodic, category-first audit that fixes an axis of ~9 categories (layout, typography/content, data display, data entry/forms, navigation, feedback/status, overlay, media, disclosure), surveys what the mature frameworks in each ship, and cross-references against VMS's own inventory. Because the axis is fixed, the audit finds the same gaps regardless of which consumer request happened to arrive first — the layout-scoped survey of 2026-06-28 could not surface the rich-text-output gap that later fired via Poppy because rich text was never in scope; a category-first audit would have caught it in the same pass. The template is `.planning/design/framework-capability-gap-survey.md` (2026-07-23; supersedes `layout-system-research.md` in scope, extends it in method). ⚠️ **Survey the RIGHT population for the question:** for INVENTORY completeness ("does everyone ship this?") the witnesses are the four flagship component libraries (Bootstrap, MUI, Ant Design, Chakra) — they compete on breadth, so their union is the ceiling. For SHAPE-FIT ("how should we express this on the wire?") the witnesses are the server-driven peers that share our constraints (Phoenix LiveView, Rails Hotwire + ViewComponent, Laravel Livewire + Filament, Blazor Server, Streamlit, HTMX + DaisyUI) — a client-only editor's answer is often an artifact of them having no server to ask, not a design decision. Both populations run per category; neither alone is enough. This is the direct extension of the banked lookup lesson (*"a survey's unanimity is only evidence if you know what constraint produced it"*), applied category-by-category rather than to a single design question. Re-run per major-line as the framework grows.
- **🚨 Non-blocking dispatch (`ActionEvent.blocking: false`) is ALWAYS the app's explicit, opt-in choice. The framework never forces, infers, or upgrades a dispatch onto the non-blocking lane — not for a node type, not for a "background-ish" action, not ever.** The reason is semantic, not stylistic: `blocking: false` means *this response may be discarded, may arrive out of order, and may coexist with another round trip in flight*. An app that didn't ask for those semantics can have its logic broken by them, silently. The framework's job is to **honor** the app's choice, not to make it. (Established 2026-07-16 by the operator, after the v5.2 lookup design forced `searchAction` non-blocking and had to be reversed.) **Corollary — treat it as a design smell:** if a feature seems to *need* forcing (e.g. "an app that forgets `blocking:false` here would busy-lock the page on every keystroke"), that is the signal **the feature's shape is wrong**, not that the app needs the choice taken away. In that case the real fix was to stop making typing trigger round-trips at all. Any argument of the form "the app can't be trusted with this dispatch semantic" is an argument that you built the wrong dispatch.
- **The .NET `ViewNode` types live in ONE place — `viewmodel-shell-dotnet/ViewModels.cs`.** Every .NET demo consumes it via `<ProjectReference>` to `AshleyShrok.ViewModelShell.csproj` (there are **no** hand-copied `ViewModels.cs` files under `demo/` — verify with `find demo -name ViewModels.cs`, which returns nothing). So a node-type / wire-format change is a single edit there; it propagates to every demo on rebuild. The TypeScript twin is `viewmodel-shell/src/{index,server}.ts`. The two backends are kept byte-aligned by the cross-backend parity suite (`parity/`) — run it; it's what actually enforces no-drift. ⚠️ **Know what a diff can and cannot prove:** parity compares the backends *to each other*, so three classes of defect are structurally invisible to it, no matter how strict the diff gets. **(1) A violation both backends SHARE** — two backends emitting the same wrong thing agree perfectly and pass. **(2) Anything the diff normalizes away before comparing** — verified real: `parity/normalize.ts` drops nulls *before* diffing, so the entire null-omission contract of gotcha #8 (the thing that section exists to protect) was un-gated, and a sweep on 2026-07-16 found ~130 live violations while parity printed "passed" over every one of them. **(3) 🚨 Any branch the fixture's own configuration never RUNS** — the diff isn't broken here, it is never *shown* the data. Verified real: `backends.json` set `HELPDESK_SEED=0` on both helpdesk twins (a sane-looking call, for stable fixture ticket ids), which leaves 2 tickets instead of ~80, so `matching <= Cap(25)` is always true and the agent queue's over-cap "refine the filter" branch **cannot execute**. The twins emitted `style:"warning"` vs `tone:"warning"` on that node for *releases* while parity printed "all backends agree" over every run — and the same diff flags it instantly once handed the two real responses. The sting: AGENTS.md documents that the demo "seeds ~80 tickets **so the cap actually fires**" — the seed exists precisely so that branch is real, and the gate was the one place it was turned off. That's why `parity/run.ts` also asserts **per-response invariants** that need no comparison — `findNulls` (class 2) and `expectBodyContains` (class 3), each checked on every backend's raw body independently, which is *stronger* than any strict-diff mode could be. **When you find a property a diff structurally cannot see, add an invariant, not a stricter diff.**

  🚨 **The generalization — a gate can only prove things about code it actually RUNS.** When a gate is green, don't only ask *"what property did it check?"* — ask *"what code did it never run?"* An env var that disables a demo's seed doesn't merely skip rows; it deletes whole **behaviours** from the comparison. So of every fixture, ask: **which branches can this configuration never enter?** If a step exists to cover a documented behaviour, give it an `expectBodyContains` naming a substring only that branch emits (`parity/fixtures/helpdesk-seeded.json` is the worked example) — then a step that stops exercising its branch fails **loudly** instead of silently going vacuous. A fixture whose branch quietly stopped firing is indistinguishable from one that passes.

  ⚠️ **The known live instance of class (1): closed unions are enforced on ONE side only.** Every closed TS union (`tone`, `emphasis`, `size`, `style`, `layout`, `arrange`, …) is typed `string?` in `ViewModels.cs` — audited 2026-07-16: **37 of 37 are open on the .NET side**, so the .NET compiler accepts any string for a field whose valid set is a closed list in `index.ts`. The TS union is the only definition of validity and it does not bind the .NET twin; if both twins emitted the same invalid value they would agree and parity would pass. **This hole is currently unexploited** — the same audit scanned every .NET demo and found **zero** invalid values — so this is a documented risk, not an active bug. Do not "fix" it by copying an invalid value into the TS side to make a diff green; if you need to close it, the shape that fits is a per-response invariant validating emitted values against the `index.ts` unions (it binds BOTH backends and needs no .NET type change).
- **`CHANGELOG.md` + `MIGRATION.md` are release-gated, not HEAD-synced.** They are append-only, version-specific history and are intentionally *not* kept in lockstep with `main` — they may lag between releases, and that's fine. The only rule: whenever you bump a package version / publish (npm or NuGet), add the matching `CHANGELOG.md` entry — and a `MIGRATION.md` note if consumers must do anything — in that same change. Never retro-edit old entries when a node is added.
- **🚨 GREEN-TREE GATE (precondition for everything below):** never push or publish on top of a broken tree — full framework tests, parity, core-globals guard, the demo type-check (`npm run check:demo-types`), the framework's OWN .NET test project (`viewmodel-shell-dotnet/Tests`), AND every `demo/**/*.Tests.csproj` must pass first, with NO exception for "pre-existing" or "unrelated" or "just a demo" failures. See the **Working agreement** rule "NEVER PUBLISH OR PUSH ANYTHING BROKEN" below for the exact suite + procedure. A pre-existing red test you find mid-release gets fixed (or explicitly waived by the operator) before you bump versions.
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

### Adding new primitives — additional rules beyond the Route B "earn a composite" bar

- **The "easy yes" rule for new primitives — capability-gap + containment beats signal-count.** Two questions, in order, before "how many consumers have asked?": **(1)** Is there a real *capability gap* — a fundamental way of displaying/expressing information the framework has no way to do today? The honest test is the composition-test: *does existing composition give a functional fallback?* If yes, the primitive is polish, not gap. **(2)** Is the addition *contained* — a self-contained node that solves its rendering problem without fanning out, or does it drag a design pass with it and multiply combinatorically? **Both yes → EASY YES, even at one signal. Both no → HOLD regardless of signal count.** Worked cuts (2026-07-19): DiffNode was both yes (aligned side-by-side is uncomposable; self-contained diff renderer) → shipped at one signal. CodeBlockNode was both no (uncolored `pre + card + copy` composition is a working fallback; syntax highlighting pulls a whole design pass — highlighter choice, ~130 token/theme AA-contrast pairs, bundle size) → held. Signal-count is tie-breaker only.
- **Design method — borrow from mature frameworks before inventing, but survey the RIGHT population for the question.** Highest-value first move on a new primitive is to see how established frameworks have solved it — Every-Layout / Compose / Flutter / SwiftUI (intrinsic primitives + declarative-native vocabularies), Tailwind / Braid (token systems), MUI / Chakra / Ant (component appearance axes). ⚠️ **For INVENTORY completeness ("does everyone ship this?") the witnesses are the four flagship component libraries** (Bootstrap, MUI, Ant, Chakra) — they compete on breadth. **For SHAPE-FIT ("how should we express this on the wire?") the witnesses are the server-driven peers** (Phoenix LiveView, Rails Hotwire + ViewComponent, Laravel Livewire + Filament, Blazor Server, Streamlit, HTMX + DaisyUI) — a client-only editor's answer is often an artifact of them having no server to ask, not a design decision. Unanimity among peers who share a limitation VMS doesn't have is not evidence for us. **Corollary — borrow the PROPERTY THAT MAKES IT SAFE, not just the shape.** Citing a system as precedent requires naming the mechanism that makes its version work AND checking you're carrying that mechanism over. Notion's `plain_text` alongside rich runs is safe *because Notion generates it server-side and never lets an author write it*; a shape borrowed without that property is a worse design than not borrowing at all, because the citation makes it feel validated.
- **"Provide-your-own-X" embedded slots are divergence risks — share BEHAVIOR code, never re-render the SHAPE.** When VMS adds a slot where a consumer supplies their own node into an embedded context (`FormNode.submitButton` is the archetype: a `ButtonNode` used AS a form's submit), the embedded render path is a **standing divergence risk**. It's easy to re-implement the node's SHAPE (className/label) while silently dropping its BEHAVIOR (click handler's disabled guard, confirm dialog, pendingLabel swap). Exactly the 5.0.1 bug: `submitButton` rendered *like* a button but didn't *behave* like one, and the types promised behavior the impl lacked. **Rules:** (1) any "provide your own X" slot must route through the SAME behavior code as the standalone X — factor a shared helper (`applyButtonBehavior`), never a parallel render. (2) When a node gains a NEW behavior (e.g. `confirm`), **grep every embedded/wrapped use of that node** — the new behavior almost certainly didn't reach the embedded paths. (3) When reviewing such a slot, diff it against the standalone renderer feature-by-feature.
- **A "one-call does everything" convenience API must actually REGISTER everything — don't let the doc claim outpace the code.** 3.11.1 bug: `AddVmsShellVersioning()` was sold as "one-line server side" and said so in the CHANGELOG + fleet broadcast — but the call registered only the `VmsVersioningOptions` singleton, NOT `ShellVersionResultFilter`, so the Phase-1 `serverBuild` stamp silently no-op'd. Invisible in demos (they added the filter separately); Poppy/PBMInvoices caught it in prod within minutes. Rules: **(1)** when a convenience wrapper is sold as "this one call wires the whole feature," verify it registers EVERY part — the pipeline/filter/middleware, not just the options object — and add a test that asserts the pipeline piece lands (e.g. the filter is in `MvcOptions.Filters`). A demo that wires the piece by hand will hide the gap. **(2)** Don't let a MIGRATION/CHANGELOG/broadcast "one line" claim ship before the code delivers it — the over-promise is worse than an honest "two lines," because adopters wire against the doc.
- **A helper the framework's OWN DEMOS don't adopt is a helper consumers won't adopt either — the demos ARE the wiring reference.** 2026-07-20 PBMInvoices stale-shell prod fire: `UseVmsShellStaticFiles` (1.8.0) existed and was documented as solving stale-shell-on-deploy. Reality when the fire hit: **every framework demo `Program.cs` used raw `app.UseStaticFiles()`, not the helper.** Every consumer who read the demos as the reference wired around the primitive. **Rule — the atomic ship for any host-wiring helper is: (1) the primitive itself, (2) every framework demo `Program.cs` updated to use it, (3) the CHANGELOG / broadcast — in one commit, one release.** Not "the primitive shipped, adoption is up to consumers." Adoption is up to the demos, which are up to the maintainer. A helper without demo adoption isn't shipped; it's stranded.
- **Parity-type safety — prefer `string` over a `number`/union for cross-backend wire fields.** When adding a wire field that *could* be `string | number` (e.g. input `min`/`max`/`step`), type it `string` in BOTH backends, not a union and not TS-`number`/.NET-`int`. A TS `number` ↔ .NET `int`/`double` pair drifts on the parity diff for fractional or formatting-edge values (the latent F1/F5 drift class); a union reintroduces the same absent-vs-present asymmetry F2 fixed. Strings are HTML-attribute-faithful (`"0"`, `"2020-01-01"`, `"any"`) and byte-identical across STJ and `JSON.stringify`. (Did this for `FieldNode.min/max/step` in 3.4.0; `maxLength` stays `int`/`number` because it's integer-only → no drift.)
- **Subtle-concurrency / dispatch / lane / timing code needs adversarial interleaving verification — the first implementation is almost never right.** Phase 14/15 non-blocking build caught THREE ship-blocking defects that reading the code missed, all silent-failure class, all only visible under a specific interleaving of two in-flight round-trips: (1) coalesce refire re-used the caller's silent flag instead of the queued dispatch's own → a poll could halt into the blocking lane; (2) a single *symmetric* epoch discarded a slow blocking response when a later non-blocking one resolved first → the user's click silently vanished (fixed by lane-aware epochs); (3) a rapid double-toggle let a stale in-flight response revert the user's latest optimistic write. None found by reading code — all found by *tracing specific two-round-trip interleavings* and writing a test that reproduces each. **Rule: for any dispatch/epoch/lane/timing change, do NOT trust the first implementation — enumerate the adversarial interleavings (user-action-races-background, background-resolves-first, rapid-fire-supersede, stale-arrives-late) and demand a FAIL-before/PASS-after test for each before calling it done.** A green unit suite that doesn't script the interleaving proves nothing about the race. **Corollary — before verifying a race exhaustively, ask whether the race should EXIST.** A rigorous suite testing the properties of a mechanism that shouldn't be there is not rigor. v5.2's live-query lane had four scripted interleavings, all passing, all mutation-proved — Ashley then hit a real stale-response race in ~2 minutes of clicking. She reversed the cadence (Enter-to-search, blocking) and the entire race category became structurally impossible via the dispatch guard. A correctness argument from structure beats a test suite.
- **View-side rendering primitives can coexist with envelope-level signals — they're complementary, not duplicative.** Settled 2026-06-27 re `FieldNode.error` vs the `rejected` envelope: `rejected.violations[]` is the wire/agent signal (on the response envelope; the browser shell does NOT auto-render it); `FieldNode.error` is the view-side rendering baked onto the node. An agent reads the entire response (envelope + tree), so it can't "miss" either regardless of where it looks — a view-side primitive that overlaps an envelope signal is fine. Precedent for future "is this a duplicate mechanism?" calls: if both ride the wire and serve different consumers (agent vs renderer), coexistence is OK.

### Version + release discipline

- **Version-pair discipline is WIRE PARITY, not identical version numbers — frontend-newer-than-backend is the safe asymmetry.** The canonical-pair invariant is that renderer and backend agree on the wire, NOT that npm and NuGet share a number; the two packages legitimately drift (e.g. 6.3.0 vs 6.4.0) via asymmetric CSS-only / .NET-only releases. **Frontend-newer-than-backend is safe** — a newer renderer is a superset that renders every node an older backend emits (additive-optional fields it doesn't send are just absent; protocol token still 1.0). **Backend-newer-than-frontend is risky** (backend emits a node/field the old renderer can't draw). Two corollaries for answering consumer sanction questions: **(1)** a NEW node type needs the BACKEND package to construct it — a frontend-only bump gives the renderer the ability to DRAW it but the backend can't emit one (TrackerNode needed NuGet 6.4.0, not just npm 6.3.0). **(2)** To judge whether a specific breaking change bites a consumer, check the ACTUAL emitting side at the tag, don't reason from the changelog headline (the 6.0.0 StatBar `string|number→string` narrowing couldn't bite any .NET backend because .NET's `StatItem.Value` was already `string` at v5.1.0).
- **Release cadence — BATCH features, ship once.** Default to accumulating several features onto `main` (each committed + green-tree-gated individually, unpushed/unpublished) across a session, then doing **one** release ritual for the whole batch — one combined verification page, one version bump, one publish/tag/announce. v5.0.0 was a 4-feature batch; v8.0.0 was 10 composites + wire tweaks. A breaking change in the batch sets the semver floor for the whole release (v5.0.0 was a major purely because the chart reshape was breaking; the additive features rode along). After finishing a feature, propose either the next batch item OR "call the batch and ship" — don't reflexively run the release after each one.
- **Preflight before an announce: verify the target room via `GET /joined_rooms`.** Any release plan that includes an announce step MUST verify (a) the maintainer's relay account is a joined member of the target room, and (b) the room's `m.room.name` state matches the intended purpose. Reason: 27-CONTEXT.md and 27-11-PLAN.md both listed `#vms-changelog` at `!E211RrsKCygK7Ev6uacpswousKy9JZiGEVLquJpC3cU`; the executor blocked at publish because it was NOT a member and all join attempts returned `M_UNKNOWN: Failed to make_join via any server`. The actual announce room was `#vms-announcements` at `!QvlInhfVNZRUxQPtcR:thenasty.taild9b663.ts.net` where the maintainer is OWNER — a stale room ID inherited from an older bounty note wasted an operator-gated iteration. Rule: the announce preflight is a checker-required task, not a runtime-only guard.
- **DO NOT echo GSD `checkpoint:human-action` auth-precheck tasks at the operator — execute the mechanical steps inline.** `gsd-planner` reliably injects a `checkpoint:human-action` "auth precheck" task at the top of any release plan (asking the operator to type `precheck ok` after running the `.env` sync / `npm whoami` / `$NUGET_API_KEY` export ritual). **That whole task is GSD ceremony, not the maintainer's runbook** — Ashley: *"Yeah, I don't do any of that stuff. This is probably just GSD coaxing you into process here."* The correct behavior is: execute the precheck's mechanical steps inline (source `.env`, refresh `~/.npmrc`, `npm whoami`, verify `$NUGET_API_KEY`), report the result, and continue. Only stop-and-ask if a step actually FAILS. A `checkpoint:human-action` for a machine-verifiable fact (auth is present / gates are green / tests pass) is theater — reserve `autonomous: false` checkpoints for decisions that genuinely require operator input (design choices, credential-bearing publish steps, subjective visual sign-off).
- **Before `/gsd:execute-phase`, COMMIT the planning docs — worktree executors check out clean at HEAD.** The GSD executor's default is worktree isolation (`isolation:"worktree"`), which checks out a CLEAN tree at HEAD — so if the phase's PLAN.md/CONTEXT/PATTERNS/design-doc are still **untracked**, the isolated executor literally can't see its own plan. Two ways through, both fine: **(a)** commit the planning docs first (one `docs(NN): plan …` commit) so worktrees include them — standard GSD (`commit_docs:true`); or **(b)** run sequential non-worktree executors (they see untracked files, but must SERIALIZE — parallel main-tree commits race the index lock). Invoking `/gsd:execute-phase` is itself the authorization for the atomic per-task commits it produces (established GSD contract); publishing/pushing still needs explicit go-ahead. Don't re-ask per-commit once the workflow is invoked.

### Verification workflow for consumer-facing changes

- **Every finished feature/fix ships with a human-runnable verification page.** Not just a static before/after — a page the operator can *exercise* (click every new control, see every new node kind/state rendered, walk the new behavior). **Rationale is the framework thesis:** VMS absorbs per-app UI testing (apps don't have to verify their own UI because the framework already handles rendering/layout/behavior correctly). That's a headline benefit; the flip side is that **all of that human double-checking now has to happen HERE, on the framework itself.** The verification page is the compensating discipline that makes the "apps don't test their UI" promise safe. For a visual change it gates the publish; for a behavioral change it's still delivered so the operator can exercise it. When in doubt, produce the page.
- **How to build the run-through page — serve the REAL bundle over the tailnet.** Stage a scratch dir: copy `viewmodel-shell/dist/browser.js` + `styles/default.css` + all theme files + (for charts) the real `node_modules/chart.js/dist/` tree and `@kurkle/color`'s ESM. In the HTML: link `default.css` + a swappable `<link id="theme-css">` (empty = light default), and an **import map** resolving the renderer's dynamic `import("chart.js")` + its `@kurkle/color` dep to the vendored files (this is what lets raw-served ESM work with no bundler). Then `import { BrowserAdapter } from "./browser.js"` and `adapter.render(vm, onAction)` — one adapter per feature area. **For INTERACTIVE features** (confirm, reorder), give the adapter an `onAction` callback that is a small **in-page reducer mirroring the demo's server logic** (port `buildVm` + the action handling to JS), calling `adapter.render(...)` again each action — that exercises real button/modal/disabled rendering + the real dispatch path (e.g. `window.confirm` fires before `onAction`). Add a theme `<select>` that swaps `#theme-css` and re-renders all mounts. Rebuild `dist` first so the served bundle carries the latest fix; smoke-test every asset returns 200 over the `100.` IP before sending the link. Serve via `python3 -m http.server <port> --bind 100.113.23.63`; hand over `http://100.113.23.63:<port>/`. Rendering host-chrome (checklist/theme bar) as plain HTML outside the view tree is the sanctioned exception; FEATURE nodes must go through the real adapter.
- **SECURE-CONTEXT features (clipboard, and anything gated on `isSecureContext`) CANNOT be verified over plain `http://<100.IP>` — serve self-signed HTTPS instead.** Insecure-context browsers hide the *entire* `navigator.clipboard` object → the async Clipboard API (the only path that writes `text/html`) silently degrades to the legacy `execCommand` plain-text copy, and EVERY paste comes out flat — the delivery mechanism looks like a feature bug. Fix: `openssl` self-signed cert (SAN with the `100.` IP + MagicDNS name) + a tiny Python `ssl`-wrapped `http.server`; the operator clicks through the one cert warning, and the page is a secure context → clipboard works. (Tailscale account has NO managed certs — `tailscale cert`/`serve --https` fail/hang; self-signed is the path.) Before serving a verification page, ask: *does this feature need a secure context?* — clipboard, service workers, some media/crypto APIs do — and if so, HTTPS from the start. **Also surface it as a real adopter constraint in CHANGELOG/MIGRATION** (rich copy only works over HTTPS/localhost).
- **⚠️ Reproduce the FULL real class structure of the SURROUNDING elements, not just the component under review — or the CSS silently won't apply.** VMS styling is class-scoped (`.vms-table__td`, `.vms-table__th`, `.vms-table__row`, …), so bare tags render unstyled. If a verification harness hand-builds a table *body* with bare `<tr>`/`<td>` while faithfully classing only the pagination footer under review, `.vms-table__row` padding never hits and the operator sees "funky, padding-less rows" — a mockup that only classes the component-under-test misrepresents everything around it. Fix: class every element the way `browser.ts` emits it (grep the renderer for the exact `.className =` on rows/cells/wrappers, not just the feature's nodes) — or drive the REAL renderer/bundle.
- **A contenteditable box on the SAME page as the shipped CSS is a LYING paste target — verify against a FOREIGN app.** A same-page contenteditable re-applies the copied elements' classes against the page's own stylesheet, so a harvested card looks pixel-identical to the original ("is that amazing or wrong?"). The honest test is a foreign app (LibreOffice / Gmail / Word / any non-VMS destination) with no VMS stylesheet, where the theme falls away and only structure survives — which is the actual thesis. Put a real foreign-destination step in the verification checklist, not just an on-page contenteditable.
- **A/B verification-page panels that compare DIFFERENT asset versions MUST be scoped via iframes — a shared parent `<script>`/`<link>` defeats the comparison.** 2026-07-30, v8.0.3 verification page: a three-panel A/B/C tasting had ONE `<script src="./browser.js">` at the parent-page top, so swapping the shared asset to "prove" the fix contaminated every panel and "all three of them look the same." Fix: each panel becomes an `<iframe src="./pre-fix/section.html">` (or `./post-fix/...`) pointing at a self-contained sub-page with ITS OWN `<link>` and `<script>` tags pulling from ITS OWN asset dir. Cross-iframe asset scoping is airtight. **Rule — anytime a verification-page A/B (or wider) exists BECAUSE the panels differ in which asset version they load, use iframes.** A shared parent-page `<script>`/`<link>` is a footgun waiting to fire. **Corollary — before shipping any A/B, ask "is my mechanism able to cross-contaminate what I'm comparing?"** UI panels: shared assets, shared CSS variables set by parent, shared JS state (localStorage/sessionStorage/cookies scoped to origin). Wire comparisons: shared server state, shared cache keys. If yes for any axis the comparison depends on, isolate that axis (iframes, distinct origins, distinct cache keys).
- **Interactive mock harnesses MUST run each `buildVm(state)` result through the REAL tree validator — the fetch-shim silently skips it.** The interactive-mock methodology (real bundle + shipped CSS + in-page reducer + fetch-shim faking the network hop) has a blind spot: the fetch-shim synthesizes the `{ok,vm,state}` response directly, so it **bypasses the real server-side tree validation** that `createAction` / the .NET filter run. Trees the real server would REJECT (→ `invalid_tree`, 500) sail through the mock. Concrete catch: the same action name on both a BreadcrumbItem and a back/cancel ButtonNode — duplicate action names anywhere in one tree are a hard validator failure — the mock rendered fine and 500'd the moment the tree hit the real controller. Fix: **run `buildVm(state)` through the real validator inside the fetch-shim before handing it to `adapter.render`.** Import from `@ashley-shrok/viewmodel-shell/server` if the harness runs on Node; **INLINE a browser-safe copy** if it runs in the browser (per gotcha #13 — never import `server.js` into a browser page). Two follow-ons: (1) unique-action-name-across-the-whole-tree is a real framework invariant designs must respect up front, not just the harness; (2) same GREP-before-asserting family — a mock that skips a real guard proves less than it looks like it proves.
- **Headless-chrome screenshots: `file://` + inline is reliable; a real-bundle ES-module `http://` page flakes.** `google-chrome --headless --screenshot` works reliably for `file://` pages with INLINE scripts (design mockups + real-CSS+exact-DOM previews shoot fine). Screenshotting a page that loads the REAL bundle as an **ES module over `http://`** fails repeatedly (shm/descriptor errors after many chrome runs; `--dump-dom` shows 0 cells because the async module hadn't executed). The real-bundle page STILL WORKS in a real browser — only headless *capture* flakes. So: serve the real-bundle interactive page for hands-on (`100.` link), and for a STATIC preview image build a `file://` page with the real shipped CSS + the exact emitted DOM and screenshot THAT. The renderer is already proven by jsdom unit tests, so a failed screenshot is never a correctness gap. (⚠️ never `pkill` chrome — trips exit 144 per the box rule; kill by PID via `ss`.)
- **The aa-contrast gate covers a FIXED pair-set — hand-check any NEW fg/bg combo.** `check:aa-contrast` validates a fixed 13-pair set across the default + all themes. It does NOT auto-cover a *new* foreground/background combination a new primitive introduces. When adding a filled/colored surface (a badge fill, a toast fill, a button-on-tone, anything with text on a tone token), **compute the white-on-tone (or text-on-fill) WCAG ratio by hand** — the gate passing is NOT proof the new pair clears AA. Concrete catch (3.5.0 toasts): white body text on the pure `--vms-success` (#2da359) and `--vms-info` (#2277dd) fills sat at 3.2 / 4.4:1 — below AA-normal 4.5 for 14px — while `--vms-error`/`--vms-warning` passed on their pure tokens. Fix pattern: deepen only the failing tones via `color-mix(in srgb, var(--vms-X) N%, #000)` (success 80%, info 88% cleared it), leave the passing ones pure. Quick ratio check: a tiny node WCAG-luminance snippet over the candidate hexes. Threshold: 14px non-bold body text needs 4.5:1; only ≥18.66px-bold / ≥24px-normal drops to 3:1. **Two techniques banked from the v5.1 steps marker:** (1) **the `--vms-surface` KNOCKOUT glyph** — for a glyph/mark sitting on an accent/tone fill, `#fff` fails WCAG on most DARK themes; drawing the glyph in `var(--vms-surface)` instead is polarity-adaptive (white-ish on light themes, dark on dark themes) and cleared ≥3:1 on ALL 13 targets with ZERO per-theme fill deepening — prefer it over `color-mix` deepening when the mark is a shape/icon. (2) **the 3:1-vs-4.5:1 call:** a glyph that's a *graphical state indicator* (WCAG 1.4.11) only needs 3:1 — but ONLY legitimately so when the state is ALSO carried by non-color channels (`aria-label` + position + fill-vs-outline shape). Don't claim the 3:1 bar for text.
- **A DENSE, color-ONLY primitive must bake a colorblind-safe palette — verify by SIMULATION, not assertion.** A status strip / heatmap reads all-at-once — you can't hover every cell and cells are too thin for shapes/patterns — so **color is the primary channel and must survive colorblindness by color alone.** That makes it DIFFERENT from a labeled control (button/badge) where text carries meaning: those can use the global `success`=green / `danger`=red tones; a dense color-only primitive CANNOT (green/red is the classic deuteranopia/protanopia trap). The right move: **bake a fixed, colorblind-safe palette** (blue=good, not green — `--vms-tracker-*` tokens), so "blue means good" is learned once and NO colorblind *mode* is ever needed. Sanctioned local divergence from the global tones (framework owns appearance; heatmap primitives conventionally own their palette — GitHub graph, Grafana). State *name* stays semantic on the wire so it's still agent-legible. **Verify separability with a deltaE simulation under deuteranopia + protanopia + tritanopia (a 3×3 feColorMatrix sim → Lab → deltaE), on BOTH light and dark — target ≥15; TrackerNode shipped ≥28.** Gotcha the sim caught: pass↔fail (blue/red) is trivially huge, but **fail↔warn (red/amber) CONVERGES under red-green colorblindness** (both shift to yellow-brown) — fix by separating them on LIGHTNESS (deep red + bright amber), which the achromatic channel preserves. Pair color with a text channel (per-cell `label` → tooltip + aria-label) so it degrades gracefully AND stays agent-drivable.
- **🚨 A prod-fire fix gets tested against the SAME REPRODUCTION as the fire itself — not against a proxy for it.** Not "a test that would fail under the same class of bug." The literal reproduction: a curl (or whatever mechanism the operator hit it with), against a real host, checking the specific response the operator saw. Anything short of that is testing a MODEL of the bug, not the bug. 6.7.0 shipped a stale-shell fix with 4 tests asserting SUFFIX matching through `OnPrepareResponse` (`.html`, `manifest.json`) and ZERO tests hitting `/` on a live Kestrel host — Poppy's local verification against a fresh PBMInvoices build found the gap in three minutes: `MapFallbackToFile("index.html")` serves through its own file-sending pipeline that bypasses `StaticFilesMiddleware` entirely, so the `OnPrepareResponse` hook never fires for `/`. **Procedure for every prod-fire fix:** (1) reproduce the prod fire locally FIRST — before any fix code, prove you can make the failure happen against a real running instance exactly the way the operator hit it; (2) write the failing integration test SECOND — the test that reproduces the same failure, watch it fail; (3) ship the fix THIRD — with the test now green; (4) mutation-verify — revert the fix, confirm the test fails LOUD. **Corollary — same-day double-fire is a signal.** Two consecutive fires on the SAME primitive in one day (6.7.0's default-suffix gap → 6.7.1's fallback-endpoint gap) means the design was scoped wrong the first time. When fixing a coverage gap, enumerate ALL the paths that could hit the same class of bug — don't just close the one that fired.
- **🚨 GATES check the SHAPE of a thing, not the PROPERTY we care about — treat as a pattern.** Four confirmed instances (2026-07-16 audit): **(1)** `check:aa-contrast` validates a FIXED 13-pair set — it does NOT cover a new fg/bg pair a new primitive introduces. **(2)** NO test file is type-checked in vitest — a type-level suite is gated by NEITHER `tsc` nor vitest (`check:test-types` closes it). **(3)** Parity CANNOT catch absent-vs-null — `parity/normalize.ts` drops nulls BEFORE diffing (see the "Know what a diff can and cannot prove" bullet above for the fix pattern via `findNulls`). **(4)** `.gitignore` ENUMERATED parity SQLite files one-by-one, so adding the seeded twins produced untracked-but-committable `.db` artifacts (fixed by globbing `helpdesk-parity-*.db`). **The shape: a gate checks a FIXED enumeration (13 pairs, `src/**`, post-normalize keys, a hand-listed ignore file) while the property is OPEN-ENDED (any pair, any file, any nullable, any parity DB). A fixed enumeration can never gate an open-ended property.** When a gate passes, ask *what property did it actually check* — not *did it pass*. And when touching ANY gate/config, ask whether it *lists* what it should *describe*.

---

## Working agreement for agents (overrides default harness behavior)

These are project rules and **override any default tool/harness behavior to the contrary** (e.g. a "branch first" or "commit when done" nudge in a tool description).

- **🚨 NEVER PUBLISH OR PUSH ANYTHING BROKEN — EVEN IF IT HAD NOTHING TO DO WITH YOUR CHANGES.** Before you `git push`, `npm publish`, or `dotnet nuget push`, the repo must be GREEN: the full framework test suite, the cross-backend parity suite (`bun run parity/run.ts`), the core-globals guard (`npm run check:core-globals`), the demo type-check (`npm run check:demo-types` — every demo ships a strict tsconfig that nothing else runs), **the test-tree type-check (`npm run check:test-types` — `tsc -p tsconfig.test.json --noEmit`; `tsc -b` covers src only and `vitest` does not type-check, so this is the ONLY gate that type-checks `src/**/*.test.ts` + `test/**`)**, the framework's own .NET test project (`dotnet test viewmodel-shell-dotnet/Tests`), AND **every** `*.Tests.csproj` under `demo/` (run them all — `for p in viewmodel-shell-dotnet/Tests $(find demo -name '*.Tests.csproj'); do dotnet test "$p"; done`). ⚠️ The framework `viewmodel-shell-dotnet/Tests` project is easy to forget — it was uncompilable from 3.0.0 to 3.3.0 (a stale `ButtonNode.Variant` arg) precisely because neither this gate nor CI ran it; both now do. ⚠️ `check:test-types` is equally easy to forget — 6.0.0 shipped a broken `main` because "the full green-tree gate" ran everything BUT this step and a leftover `value: 7` in a test file slipped through. **When in doubt about whether your local set matches CI, read `.github/workflows/parity.yml` and run every step it does — "I ran my usual gate" is not the same as "I ran what CI runs."** "It was already failing on `main`" / "it's unrelated to my change" / "it's just a demo test" are **NOT** exceptions — a red suite is a red suite, and shipping on top of it normalizes breakage and buries your own regressions in the noise. If you discover a pre-existing failure mid-release: **STOP**, surface it to the operator, and fix it (or get an explicit waiver) **before** pushing/publishing. Do not bump versions on top of a broken tree. (`dotnet` lives at `~/.dotnet/dotnet` — put it on PATH first.)
- **Git is operator-driven, not autonomous.** Do **not** create branches. Do **not** push. Do **not** `git commit` unless the user explicitly asks in that turn. When asked to commit, commit to the **current branch** as-is — never auto-branch, even on `main`/`master`. Pushing and opening PRs happen only on an explicit, in-turn request. If a workflow seems to call for a branch or push, ask — don't infer.
- **No running state/ledger file.** This repo deliberately has **no** maintained narrative state file (the former `.planning/STATE.md` was removed for exactly this reason: a hand-updated status cache drifts and costs more than it's worth). Do not recreate one, and do not treat any file as a live status cache to keep in sync. Append-only history under `.planning/milestones/**` and `.planning/ROADMAP.md` may be **read** for context, but is not to be maintained as session bookkeeping. Track in-session work with the task tools, not a file.
