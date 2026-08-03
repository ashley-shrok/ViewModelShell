# ViewModel Shell — agent operating manual

This is the protocol manual for an agent driving a ViewModel Shell (VMS) app over its JSON wire. It is operational, not historical. Follow each section as a rule.

## What this is

VMS is a server-driven UI framework. The server is a pure function `(state, action) → (newState, view)`. Every response carries the entire UI state as an opaque blob and a fresh `vm` view tree. You do not have to render the tree to drive the API — you can read its node types and dispatch actions directly.

## Endpoints

Read the page's `<meta name="viewmodel-shell">` tag for the endpoint pair:

```json
{ "protocol": "viewmodel-shell/1.0", "endpoint": "/api/x", "actionEndpoint": "/api/x/action", "skill": "/.well-known/vms-skill.md" }
```

- `GET <endpoint>` → returns the initial `{ "ok": true, "vm": <ViewNode tree>, "state": <opaque state blob> }`.
- `POST <actionEndpoint>` → dispatches an action. See the next section for the body shape.

The `skill` field is optional and points at this manual (or an app-specific preamble + this manual).

## Action dispatch shape

Two body forms are accepted. Use JSON when you can; multipart only when uploading files.

**JSON (recommended for agents).** Set `Content-Type: application/json` and POST a flat envelope:

```json
{ "name": "save-ticket-42", "state": { "...": "round-tripped state blob from the last response" } }
```

There is no `context` field — per-row / per-tab identity is encoded in the action name itself (e.g. `delete-row-42`, `filter-active`). File uploads are NOT supported in this form.

**Multipart (browser-style and file-bearing).** Set `Content-Type: multipart/form-data` and post three kinds of entries:

| Field | Value |
|---|---|
| `_action` | JSON: `{"name": "<action-name>"}` |
| `_state` | JSON: the current state blob |
| any file-input `name` | the binary file content (one entry per file input) |

## The round-trip rule

The `state` blob from the last response goes back unchanged on the next dispatch, EXCEPT for the fields the user changed. Input nodes carry a `bind` property whose value is a dotted path inside `state` where the input's value lives (e.g. `"bind": "form.title"`). Before dispatching an action that depends on user input, write your value at the bound path inside the state blob; leave every other field as you received it. The server is authoritative for everything else and may rewrite any field in the response.

## Response envelope

Every response carries `ok: boolean`.

**Success:**

```json
{ "ok": true, "vm": { /* ViewNode tree */ }, "state": { /* opaque blob */ } }
```

Optional success-path fields, which may appear alone or alongside `vm`/`state`:

| Field | Meaning |
|---|---|
| `redirect` | A URL string. Navigate to it (or hand control off). When `redirect` is present, `vm` and `state` may be omitted. |
| `sideEffects` | An array of side-effect verbs (see next section). Applied in order before any redirect or re-render. |
| `nextPollIn` | Milliseconds. Schedule a `{"name": "poll"}` dispatch after this delay. |
| `busy` | Boolean. While `true`, drop user-initiated dispatches. Polls bypass. The next response that omits or sets `false` clears the lock. |
| `preventUnload` | Boolean. While `true`, treat the page as having unsaved work — warn before navigating away. |
| `rejected` | A SOFT (domain/validation) rejection — see below. The action was refused, but `vm`/`state` are still returned. |
| `serverBuild` | A string id of the client bundle the server currently deploys. Present only when the app enables versioning. If you advertise your own build via the `X-VMS-Client-Build` request header and it differs from `serverBuild`, you are running against a rolled-forward server — see *Client build / version skew*. |

**Failure:**

```json
{ "ok": false, "errors": [ { "message": "...", "code": "parse_error", "path": "form.title" } ] }
```

`errors[].path` and `errors[].code` are optional. HTTP status is 4xx or 5xx on failure. Check `ok` once at the response edge; do not branch on HTTP status.

**Soft rejections (`rejected`) — important for wire-driving agents.** `ok:false` means the framework could not give you a view. A *domain/validation* rejection is different: the app refused the action (e.g. "targets must be non-negative", "can't remove the only person") but it is still a normal `ok:true` render that preserves the user's input. So `ok` alone does NOT tell you the action succeeded — **on an `ok:true` response, also check for `rejected`.** When present:

```json
{ "ok": true, "vm": { /* … */ }, "state": { /* … */ },
  "rejected": { "violations": [ { "path": "targets.protein", "message": "must be non-negative" } ] } }
```

- The write **did not take effect.** Do not treat it as success. Surface the violation(s); `vm`/`state` still hold the input the user typed, so you can correct and re-dispatch.
- Each violation reuses the `errors[]` entry shape (`{ path?, message, code? }`). **`path` is optional**: present → the violation is bound to that field; **absent → it's a form/action-level rejection** with no single field (like the "only person" case).
- `rejected` only appears on `ok:true`. It never coexists with `ok:false` (that channel carries no view).

## Side-effect verbs

`sideEffects[]` entries each carry a `type` discriminator. Built-in verbs as of `viewmodel-shell/1.0`:

```json
{ "sideEffects": [
  { "type": "set-local-storage", "key": "auth_jwt", "value": "eyJ..." },
  { "type": "set-session-storage", "key": "draft_id", "value": "42" },
  { "type": "download", "url": "/api/invoices/42/pdf", "filename": "invoice-42.pdf" },
  { "type": "toast", "message": "Ticket #4012 closed.", "tone": "success" }
] }
```

| Verb | Effect |
|---|---|
| `set-local-storage` | Write `key`/`value` to platform localStorage (or your agent's equivalent persistent store). |
| `set-session-storage` | Same as above for session-scoped storage. |
| `download` | Fetch `url` (re-presenting your auth headers — see *Auth*) and save the bytes. Filename precedence: `Content-Disposition` > side-effect `filename` > URL basename > `"download"`. |
| `toast` | Show a transient confirmation: `message` (required) + optional `tone` (`danger`\|`warning`\|`success`\|`info`) + `durationMs`. A UX nicety — **fail-quiet**: an agent/adapter with no toast surface simply ignores it (nothing to persist or act on), so it carries no state and needs no acknowledgement. |

**Forward-compat rule — silently ignore unknown verbs.** A future minor release may add new verbs. If you see a `type` you do not recognize, skip it; do not error. Honor or ignore per your policy.

## Errors

`ok: false` responses always carry `errors[]`. The framework uses a stable code vocabulary at the protocol edge:

| Code | Meaning |
|---|---|
| `parse_error` | The request body could not be parsed (malformed JSON, missing required field). |
| `unknown_action` | The `name` in your action envelope does not match any handler in the current tree. |
| `invalid_tree` | The server built a tree that violates a wire invariant (this is a server bug, not yours). |
| `uncaught_exception` | The action handler threw. Treat as a 500-class failure. |
| `stale_client` | Your request advertised an `X-VMS-Client-Build` header that no longer matches the server's current deployed build. The request was rejected **before any controller runs — on a POST, your `_state` is never deserialized and nothing is applied.** As of v9.0.0 the guard enforces on **both GET and POST** (was POST-only in v3.8.0), so a GET refresh with a stale header also fails-closed. The fix is to reload to the current app (re-`GET` the endpoint for a fresh `vm`/`state`), not to retry the same request. See *Client build / version skew*. |

Stop on `ok: false`. Surface the message to the user. Do not retry blindly — most of these are deterministic.

## Client build / version skew

Optional, opt-in. When the app enables versioning, every response carries a `serverBuild` string (the client bundle the server currently deploys), and you may advertise the build you are running by sending an `X-VMS-Client-Build: <your-build-id>` header on **every** request — **GET + POST** alike (as of v9.0.0; v3.8.0 shipped POST-only).

- **Detection.** On any successful response, if you sent a build and `serverBuild` differs from it, the server has rolled forward while you kept running an old bundle. Reload to the current app (re-`GET` the endpoint) so you are driving the current tree.
- **Fail-closed guard.** If you send a mismatching `X-VMS-Client-Build`, the request is rejected with `ok: false`, HTTP 400, `code: "stale_client"` — **before any controller runs** (so on a POST, your `_state` is never deserialized and nothing is applied). As of v9.0.0 the guard enforces on **GET + POST** (was POST-only in v3.8.0): a GET refresh with a stale header also fails-closed. Do not retry the same request against the same build; reload first. If you do NOT send the header, no request is ever rejected on this basis (the guard only fires for a client that advertised a stale build).
- **Browser hard-lock.** The shipped `BrowserAdapter` renders a non-dismissible modal on skew (both signals — a `serverBuild` mismatch on any response AND a `stale_client` rejection on any request) with a single [Reload] button. Browser consumers with a pre-existing custom skew affordance can opt out via `ShellOptions.onVersionSkew: "custom"` (restores v3.8.0 behavior: signal via `onError`, no framework modal). This is a browser-only affordance — an agent driving the wire cold never sees the modal; the actionable behavior on `stale_client` is the same as v3.8.0 (reload, don't retry).

## Auth

The wire does not mandate an auth shape. If the app needs credentials, the app preamble above (or its own README) names them. Common patterns: a `Bearer` token in `Authorization`, a CSRF/anti-forgery token in a custom header, a session cookie. Send the same headers on every request, including polls and downloads. The `download` side-effect re-presents your auth headers when the agent fetches the file.

## Polling

If a response carries `nextPollIn: N`, schedule a POST `{ "name": "poll", "state": <last state> }` against the same `actionEndpoint` after `N` milliseconds. The server may continue returning `nextPollIn` until the workflow reaches a terminal state, at which point the field will be absent. Polls run silently — they are not user-initiated.

## Non-blocking actions (`blocking:false`)

Some node action descriptors in the `vm` tree (a `CheckboxNode.action`, `ButtonNode.action`, a `TableRow.action`, etc.) may carry `"blocking": false` alongside the action's `name`. This is a CLIENT-SIDE scheduling hint for the browser `ViewModelShell` instance: it selects a non-blocking dispatch lane that coexists with an in-flight blocking action instead of queuing behind it, and coalesces rapid repeated triggers of the same action to "latest wins."

It never appears in the `_action` POST payload you send. The request body shape stays `{"name": "<action-name>"}` (JSON form) or `{"name":"<action-name>"}` (multipart `_action` field) regardless of whether the descriptor you read it from said `blocking:true` (the default, typically omitted) or `blocking:false`.

**For you (a wire-driving agent with no client-side dispatch loop): `blocking` is INFORMATIONAL ONLY. Dispatch the action exactly the same way regardless of its value** — POST `_action`/`_state` (or the JSON form) as normal and read the response per the existing rules in this manual (`ok`, `rejected`, `errors[]`). You do not need to implement coalescing, an epoch, or any dispatch-lane concept to drive the wire correctly.

This connects to the polling section above: the `{"name": "poll"}` dispatch this manual already documents is itself an instance of a non-blocking action — a poll always rides the non-blocking lane client-side — so nothing about how you send a poll dispatch changes either.

## Lookup / reference fields (`inputType:"lookup"`, `"lookup-multiple"`)

A `FieldNode` whose `inputType` is `lookup` or `lookup-multiple` is a reference to a row in some server-side set too large to enumerate into the tree (a 5,000-person directory, an 80,000-row customer table). A `select` says *"here are all the values, pick one"*; a lookup says *"the values are a database table — describe which row you mean."*

**The picker's search is an ordinary action on this same public wire.** No special API, no private transport, no undocumented endpoint — you drive a lookup with the exact dispatch shape documented above. This is worth stating plainly because it is not the norm: surveyed platforms keep their reference picker's transport private and undocumented. Here it is just the wire.

### The happy path: set `bind` to the id. You are done.

**`bind` is the ONLY authoritative thing.** For `lookup` it holds a `string` (one id); for `lookup-multiple` a `string[]` (the ids). To set a reference, write the id at the bound path in the state blob and dispatch — exactly as with any other input (see *The round-trip rule*).

🚨 **You do not need to know the label, and you must not supply one.** The label is not state. It travels on `selected`, **server→client ONLY**, is recomputed on every render, and is **never trusted coming back from the client** — a client-supplied label is meaningless. Direction is the whole safety argument: you cannot forge a label into a handler because you never send one. An agent that assumes `selected` round-trips will write labels into state and be silently wrong.

If you already know the id, **skip the search entirely** — set `bind` and dispatch. This is the common agent case, and it is the whole reason the model suits agents: knowing the id but not the label is not a wrinkle here, it is the normal way in.

### Reading one

```json
{ "type": "field", "name": "assignee", "inputType": "lookup",
  "bind": "form.assigneeId",
  "selected": [ { "value": "u-1", "label": "Sally Omer" } ],
  "searchBind": "form.assigneeQuery",
  "searchAction": { "name": "search-agents" },
  "candidates": [
    { "value": "u-7", "label": "Sam Ortiz" },
    { "value": "u-1", "label": "Sally Omer" }
  ] }
```

| Field | Direction | Read it as |
|---|---|---|
| `bind` | **round-trips — STATE** | The id (`string`, or `string[]` for `lookup-multiple`). The authoritative value. |
| `selected` | **server→client — VIEW** | `Array<{ value, label?, type? }>` — the resolved label(s) for what is **currently chosen**. Always an array (0 or 1 entries for single `lookup`). **This is the only source of a selected label.** |
| `candidates` | **server→client — VIEW** | `Array<{ value, label?, type? }>` — the **current search results**, i.e. what the popup offers. **Never the source of a selected label.** |
| `searchBind` | **round-trips — STATE** | Where the typed query lives. Write your query here to search. |
| `searchAction` | — | The action to dispatch to run a search. |
| `allowCustom` | — | See below. Omitted = false. |

**Never conflate `selected` and `candidates`.** They are separate fields on purpose. Resolving a label out of `candidates` is the classic failure: with an id-valued field, *"filter the candidate list"* and *"forget what's selected"* are the same operation, so a form that loads with a value already set and no search having occurred has an empty `candidates` and would render a raw database id. Read the label from `selected` and only from `selected`. On an item, `label` is **omitted when it equals `value`** (an option not set is simply absent) — so a missing `label` means the label *is* the id, not that it's unknown. `type` is the polymorphic-reference tag (an id alone is not an identity); it is omitted for monomorphic references.

### 🚨 Candidate order is meaningful. It is preserved exactly.

The renderer presents `candidates` in the order given — it **sorts nothing, dedupes nothing, truncates nothing**. This cuts both ways, and you need both directions:

- **Reading a lookup:** the order **IS the server's ranking** (relevance / recency / most-recently-used). **Position 0 is the server's best answer.** Do not re-sort before choosing — re-sorting discards the server's judgment. Real adopters rank by things you cannot reconstruct client-side (e.g. recency-weighted mention frequency, computed server-side per operator).
- **Authoring a provider handler:** the order **you return is the order the user sees.** Ranking is yours to decide and yours to get right; nothing downstream will fix it up for you.

### Searching (optional — it is just an action)

Write your query into the state blob at `searchBind`, then POST `searchAction`'s `name` with that state, exactly like any other dispatch. Read `candidates` off the returned `vm`, pick the item you want, then write its `value` into `bind` and dispatch your real action.

```json
{ "name": "search-agents", "state": { "form": { "assigneeQuery": "sal" } } }
```

- **An empty query is a legitimate query.** There is no minimum-length gate. An empty query may legitimately return most-recently-used candidates rather than nothing.
- **`searchAction` is an ordinary action, with no special cadence.** A browser user fires it by pressing **Enter** in the field (typing alone dispatches nothing — there is no debounce and no live-query behavior). For you this changes nothing: it is one POST like any other, whenever you decide to ask.
- **`blocking` on a `searchAction` means what it means everywhere else** — see *Non-blocking actions* above. It is a client-side hint that never rides the POST payload, so as a wire-driving agent you dispatch normally regardless of its value.

### `allowCustom` — invented values are declared, never inferred

`allowCustom: true` means the field accepts a value that isn't one of the offered candidates; omitted/`false` means only offered candidates commit. Choosing an existing record and inventing a new tag are different acts, so the control **declares** which it is doing rather than leaving you to infer it from behavior.

An invented value is **just a value whose label equals itself** — there is no bare string and no union anywhere. `allowCustom: true` + no `candidates` + labels omitted **is** a free-form tags input, with no special case. So the shapes above are all you ever have to parse.

### Two rules that will bite you if you assume otherwise

- 🚨 **Any cap is VISIBLE in the tree. Nothing truncates silently.** If a server caps its results, it says so in the tree (the app renders a `TextNode`, per the canonical *"Refine your filter — N matches, max is X"* pattern). You should never be handed a silently truncated list. The anti-pattern this exists to avoid is real: a surveyed platform applies a 15-result cap *post-authorization* behind a hard 250-row SQL ceiling, so in a large table an exact-match record can be **silently invisible**. If you see a cap message, narrow the query — do not conclude the record doesn't exist.
- 🚨 **The picker's filter is UX, never authorization.** What `candidates` offers is a search-scoping convenience, **not an access boundary** — do not infer authorization from it. The server authorizes in the action handler with the real auth context, exactly as every other VMS action does. A value absent from `candidates` is not thereby forbidden, and a value present in `candidates` is not thereby permitted.

## Rich text fields (RICH-01, RICH-02)

Two node types added in v8.2.0 for user-authored rich text: `rich-text-field` (a leaf-input primitive) and `rich-text-toolbar` (a composite for the editor's tool strip).

### Wire value is a MARKDOWN STRING

🚨 **The `bind` path carries a plain markdown string. No HTML crosses this interface — ever.** A `rich-text-field`'s bind reads and writes exactly the same shape as any other text input: a `string` at a dotted path inside `state`. The browser renders the string as a WYSIWYG editor (TipTap + a framework-owned toolbar); on input/change the editor's HTML is converted to markdown client-side and written back to `bind`. As a wire-driving agent you never see HTML, never render the editor, never dispatch toolbar clicks, and never need TipTap. Toolbar buttons are CLIENT-SIDE UX; their effect is to mutate the markdown string, which you can produce directly.

Round-trip is the ordinary rule: read `state[bindPath]`, write your updated markdown string at the same path, dispatch as normal. Display-side of the same markdown string later flows through the shipped markdown → InlineRuns pipeline — the string you submit is the string that renders back.

### `rich-text-field` reference

```json
{ "type": "rich-text-field",
  "name": "body",
  "bind": "form.body",
  "label": "Description",
  "placeholder": "Type something…",
  "required": true,
  "toolbar": { "type": "rich-text-toolbar",
               "tools": ["bold", "italic", "link", "bullet-list", "ordered-list",
                         "heading-1", "heading-2", "heading-3",
                         "inline-code", "code-block", "blockquote"] } }
```

| Field | Meaning |
|---|---|
| `name` | REQUIRED. Field identifier — same role as `FieldNode.name`. |
| `bind` | REQUIRED. Dotted path into `state` where the markdown string lives. Read + write here. |
| `label` | Optional user-facing label. |
| `placeholder` | Optional placeholder shown when the editor is empty. |
| `toolbar` | Optional typed slot — a `rich-text-toolbar` node. **Providing this REPLACES the framework's default toolbar** (the Slack/GitHub floor). Omit to accept the default. |
| `required` | Optional boolean; when true, the field is required. |
| `disabled` | Optional boolean; when true, the editor is read-only. |
| `state` | Optional freeform lifecycle string (same axis as other v8.1.0 composites — `active`, `done`, `disabled`, or app-specific). |

### `rich-text-toolbar` reference

```json
{ "type": "rich-text-toolbar",
  "tools": ["bold", "italic", "link", "bullet-list", "ordered-list"],
  "size": "compact",
  "tone": "info" }
```

| Field | Meaning |
|---|---|
| `tools` | REQUIRED. An array of tool names (see the closed union below). A toolbar with no tools is not a toolbar. |
| `size` | Optional closed union: `compact | expanded`. Omitted = `expanded`. |
| `tone` | Optional closed union: `danger | warning | success | info`. Omitted = neutral. |
| `state` | Optional freeform lifecycle string (same axis as other v8.1.0 composites). |

Providing a `rich-text-toolbar` as the `toolbar` slot on a `rich-text-field` **replaces the framework's default toolbar entirely** — the tools you list are the tools that render, in that order.

### Tool names (v8.2.0 floor)

The closed initial set of `tools[]` values, matching the Slack/GitHub feature-surface floor:

`bold`, `italic`, `link`, `bullet-list`, `ordered-list`, `heading-1`, `heading-2`, `heading-3`, `inline-code`, `code-block`, `blockquote`.

**Forward-compat rule — silently ignore unknown tool names.** Widening the set later is additive (a new tool name is a MINOR bump, not a break). Key off the string values you see, never assume a fixed set — if you encounter a name you do not recognize, skip it, do not fail. (This mirrors the same closed-widen-later posture as `ChartNode.kind`.)

### Driving a rich text field cold — the five steps

1. `GET <endpoint>` and receive `{ ok, vm, state }`.
2. Locate the `rich-text-field` in `vm` (walk the tree; match `type === "rich-text-field"`). Note its `bind` path.
3. Read the current markdown at `state[bindPath]`.
4. Update `state[bindPath]` to the markdown string you want to submit (write your own markdown — headings, `**bold**`, `` `inline code` ``, lists, links, etc.).
5. `POST <actionEndpoint>` with the action envelope (`{ "name": "<save-action>", "state": <updated state> }`, JSON or multipart per the *Action dispatch shape* rules above). Read `ok`/`rejected` per the usual response-envelope rules.

## Chat composer (CHAT-01..20)

A `chat-composer` node in the `vm` tree is the framework's Route B chat-app compose bar (added in v9.1.0). It bundles a draft-text field, an attach button, a send button with a small state machine, three attach ingress paths (click / drag-drop / paste-image), and five typed slots. As a wire-driving agent you interact with it exactly like any other bound input plus one or two dispatches — no chat-specific transport.

### Wire shape

Discriminator: `"type": "chat-composer"`.

```json
{ "type": "chat-composer",
  "bind": "draft",
  "sendAction": { "name": "send-message" },
  "attachAction": { "name": "attach" },
  "attachBind": "attachments",
  "placeholder": "Type a message…",
  "status": "idle",
  "submitMode": "enter",
  "maxRows": 6 }
```

| Field | Direction | Meaning |
|---|---|---|
| `bind` | **round-trips — STATE** | REQUIRED. Dotted path in `state` where the draft text (a `string`) lives. Read + write here — same rule as any bound input. |
| `sendAction` | — | REQUIRED. Dispatched on Enter or click of the send button (per `submitMode`). |
| `placeholder` | server→client — VIEW | Optional placeholder text shown when `state[bind]` is empty. |
| `attachAction` | — | Optional. When present, the browser renders a leading `+`/paperclip button that opens the OS file picker. The action itself is dispatched name-only on click; the browser stages picked files locally until `sendAction` fires. **For a wire-driving agent that is not running a browser, `attachAction` is INFORMATIONAL** — you attach files by posting them directly on the `sendAction` multipart dispatch under `attachBind`; you never dispatch `attachAction` yourself. |
| `attachBind` | — | Optional multipart form-field name attached files ride under on `sendAction`. Default: `"attachments"`. Server reads via `Request.Form.Files.GetFiles(attachBind)` (.NET) / `payload.files[attachBind]` (TS). |
| `maxFiles` | — | Optional client-side attach cap (framework's inline validation banner fires on exceed). |
| `maxFileSize` | — | Optional per-file byte cap (client-side). |
| `accept` | — | Optional `string[]` of MIME types for the file-input `accept` attribute. |
| `dropScope` | — | Optional closed union: `composer | global`. Default `composer` — drag-drop listeners live on the composer element only. `global` attaches to `document` (a wire-driving agent has no drag-drop; this is a browser-side hint). |
| `status` | server→client — VIEW | Optional closed union: `idle | sending | streaming`. Default `idle`. Drives the send-button state machine (see below). |
| `stopAction` | — | Optional. **REQUIRED when `status` can reach `"streaming"`** — both backends fail-loud otherwise (browser adapter disables the send button + `console.error`; .NET tree validator rejects with `invalid_tree`). Fired on stop-click during streaming. |
| `submitMode` | — | Optional closed union: `enter | ctrl-enter` (wire values are kebab). Default `enter`. Keyboard flip: `enter` = Enter sends / Shift+Enter newline; `ctrl-enter` = Ctrl+Enter or Cmd+Enter sends / Enter newline. |
| `maxRows` | — | Optional textarea auto-resize cap. Default 6. |
| `disabled` | server→client — VIEW | Optional boolean. When true, all inputs + buttons are disabled. |
| `headerSlot` | server→client — VIEW | Optional `ViewNode` slot — content above the textarea (reply-preview pill, "editing X" indicator, etc.). Composes WITH the framework's attachment-preview chip strip (both render — chip strip first, consumer content below). |
| `inputSlot` | server→client — VIEW | Optional `ViewNode` slot — replaces default plain textarea. Drop a `rich-text-field` (v8.2.0) here for rich text. |
| `leadingSlot` | server→client — VIEW | Optional `ViewNode` slot — prepends before the attach button (rare). |
| `trailingSlot` | server→client — VIEW | Optional `ViewNode` slot — appends after the send button (voice, model select, emoji trigger, etc.). |
| `footerSlot` | server→client — VIEW | Optional `ViewNode` slot — content below the textarea inside the pill (helper text, footer chips). |

### Send-button state machine

| `status` | Icon rendered | Click fires |
|---|---|---|
| `idle` (default) | send | `sendAction` |
| `sending` | spinner (disabled — no dispatch) | (none) |
| `streaming` | square (stop) | `stopAction` |

Non-AI consumers never set `status` past `sending`; they get send-with-spinner at zero cost. AI-chat consumers that stream: return `{status:"streaming", stopAction:{name:"stop-generation"}}` in the same response that begins the stream; a subsequent `poll` (or `shell.push`) returns `{status:"idle"}` on completion.

### The round-trip rule (unchanged)

Draft text lives at `state[bind]` — read it, mutate it, dispatch. `sendAction` is name-only in the POST body:

```json
{ "name": "send-message", "state": { "draft": "hello world" } }
```

The server reads `state.draft` (its bind), acts, and returns a fresh `{vm, state}` with the draft typically cleared (`state.draft = ""`).

### File attachments — multipart only

Attach files by dispatching `sendAction` with a multipart body (JSON body cannot carry files). Each attached file is one entry keyed by `attachBind` (default `"attachments"`); multiple files use the SAME key (multi-value form):

```
Content-Type: multipart/form-data
---
_action: {"name":"send-message"}
_state:  {"draft":"hello"}
attachments: <file1 binary>
attachments: <file2 binary>
```

Server reads via `Request.Form.Files.GetFiles("attachments")` (.NET) / `payload.files["attachments"]` (TS). The framework's rule from the *Files* section applies — a file rides only the action(s) its input declares, and for `ChatComposerNode` that action is `sendAction`. Non-attach messages omit the file fields entirely.

### Keyboard (browser-side; informational for wire-driving agents)

- **`submitMode:"enter"`** (default): Enter = send / Shift+Enter = newline.
- **`submitMode:"ctrl-enter"`**: Ctrl+Enter (Cmd+Enter on Mac) = send / Enter = newline. Persistent-chat pattern (Slack/Discord/Teams).
- **Backspace on empty textarea removes the last staged attachment** (AI-elements precedent).
- **IME `isComposing` guard is baked-in NON-OPTIONAL** — CJK Enter during composition never fires send. This is a correctness requirement, not a preference.

For a wire-driving agent none of this applies: dispatch `sendAction` (with or without files) whenever you decide to send.

### Driving a chat composer cold — the four steps

1. `GET <endpoint>` and receive `{ ok, vm, state }`. Locate the `chat-composer` node (walk the tree; match `type === "chat-composer"`). Note its `bind` path and its `sendAction.name`. Note `attachBind` (default `"attachments"`) if you plan to attach files.
2. Write your draft text at `state[bindPath]`.
3. Dispatch `sendAction`:
   - **No attachments:** JSON body `{ "name": "<sendAction.name>", "state": <updated state> }` at `POST <actionEndpoint>` — or multipart, either works.
   - **With attachments:** multipart body with `_action` = `{"name":"<sendAction.name>"}`, `_state` = updated state, plus one file entry per attachment keyed by `attachBind`.
4. Read `ok`/`rejected` per the usual response-envelope rules. On streaming AI responses, the response typically carries `status:"streaming"` + `stopAction` + `nextPollIn` — schedule the poll per *Polling* above; if the user wants to interrupt, dispatch `stopAction` (name-only) instead of the next `poll`.

## Files

File uploads use the multipart form above. One form entry per file input, keyed by the input's `name` attribute (from the corresponding node's `name` field in the tree). The file's binary content is the entry's value. JSON-body dispatch cannot carry files; use multipart.

**A file rides only the action(s) its input declares.** Each file `FieldNode` carries an `uploadOn` array of action names. Send a file's binary entry **only** when the action you are dispatching (`_action.name`) is listed in that file input's `uploadOn`; if you dispatch any other action, do **not** include the file. A file input with no `uploadOn` (absent or empty) rides **nothing** — its binary is never sent. This mirrors the browser, where the same declaration decides which click sends the file: an agent should not attach a file to an action a human's click could not have sent it with. (There is no positional/implicit rule — the file's own `uploadOn` is the whole contract.)

## Chart data (`type:"chart"`)

A `ChartNode` in the `vm` tree carries bounded, agent-legible declared data — it is read-only structured data like any other node, with no dispatch-bearing fields of its own:

```json
{ "type": "chart", "title": "Weekly visits",
  "labels": [ "Mon", "Tue", "Wed" ],
  "series": [
    { "name": "Visits", "data": [ 12, 19, 7 ] },
    { "name": "Errors", "data": [ 1, 3, 2 ], "tone": "danger" }
  ],
  "stacked": true }
```

(`kind` is omitted above, so this renders as the default `"bar"`, grouped→stacked via `stacked:true`.)

- `kind` — optional, a closed union: `bar | line | area | pie | donut`. Omitted means `"bar"`. Widened additively over time — key off the value you see, never assume a fixed set.
- `labels` — the shared category (x-)axis. `labels[i]` is the category every series' `data[i]` refers to.
- `series` — one or more `{ name, data, tone? }` entries over the shared `labels`. `data[i]` aligns by index to `labels[i]`. A single-series chart is just one entry in this array — there is no separate "simple" shape. `name` is the series label (rendered in a browser legend); a wire-driving agent reads it to identify which series is which.
- `series[].tone` — optional (`danger|warning|success|info`), set PER SERIES. When present, that series is drawn in the theme's semantic color instead of the next categorical palette slot (a loss/error series tagged `danger`, for example). Omitted → the browser client assigns the next palette slot; this only affects rendered COLOR. A wire-driving agent with no renderer can simply read `series[].data`/`name`/`labels`/`title` directly and ignore `tone`.
- `stacked` — optional boolean, applies to `bar`/`area` only (ignored for `line`/`pie`/`donut`). Omitted/`false` means series are grouped side-by-side; `true` stacks them.
- `title` — optional chart title.
- **pie/donut note:** these kinds are single-series — only `series[0]` is rendered (per-slice palette), any additional entries are ignored by the renderer. Not shown in the example above.

There is nothing else to do to "drive" a chart over the wire.

## Versioning

This manual applies to protocol token `viewmodel-shell/1.0` — the value of the `protocol` field on the discoverability meta tag. The protocol token tracks the wire shape, NOT the package version: a 7.x or 8.x package release may still carry protocol `viewmodel-shell/1.0` because the wire has not undergone a breaking change. A future major-version bump (`viewmodel-shell/2.0`) signals a breaking change and invalidates this manual; expect a new skill at the same `/.well-known/vms-skill.md` URL.
