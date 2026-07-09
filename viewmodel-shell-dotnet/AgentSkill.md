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
| `stale_client` | Your request advertised an `X-VMS-Client-Build` header that no longer matches the server's current deployed build. The mutation was rejected **before your `_state` was read — nothing was applied.** The fix is to reload to the current app (re-`GET` the endpoint for a fresh `vm`/`state`), not to retry the same request. See *Client build / version skew*. |

Stop on `ok: false`. Surface the message to the user. Do not retry blindly — most of these are deterministic.

## Client build / version skew

Optional, opt-in. When the app enables versioning, every response carries a `serverBuild` string (the client bundle the server currently deploys), and you may advertise the build you are running by sending an `X-VMS-Client-Build: <your-build-id>` header on every action POST.

- **Detection.** On any successful response, if you sent a build and `serverBuild` differs from it, the server has rolled forward while you kept running an old bundle. Reload to the current app (re-`GET` the endpoint) so you are driving the current tree.
- **Fail-closed guard.** If you send a mismatching `X-VMS-Client-Build`, a *mutating* action is rejected with `ok: false`, HTTP 400, `code: "stale_client"` — **before** your `_state` is deserialized, so nothing is applied. Do not retry the same request against the same build; reload first. If you do NOT send the header, no request is ever rejected on this basis (the guard only fires for a client that advertised a stale build).

## Auth

The wire does not mandate an auth shape. If the app needs credentials, the app preamble above (or its own README) names them. Common patterns: a `Bearer` token in `Authorization`, a CSRF/anti-forgery token in a custom header, a session cookie. Send the same headers on every request, including polls and downloads. The `download` side-effect re-presents your auth headers when the agent fetches the file.

## Polling

If a response carries `nextPollIn: N`, schedule a POST `{ "name": "poll", "state": <last state> }` against the same `actionEndpoint` after `N` milliseconds. The server may continue returning `nextPollIn` until the workflow reaches a terminal state, at which point the field will be absent. Polls run silently — they are not user-initiated.

## Non-blocking actions (`blocking:false`)

Some node action descriptors in the `vm` tree (a `CheckboxNode.action`, `ButtonNode.action`, a `TableRow.action`, etc.) may carry `"blocking": false` alongside the action's `name`. This is a CLIENT-SIDE scheduling hint for the browser `ViewModelShell` instance: it selects a non-blocking dispatch lane that coexists with an in-flight blocking action instead of queuing behind it, and coalesces rapid repeated triggers of the same action to "latest wins."

It never appears in the `_action` POST payload you send. The request body shape stays `{"name": "<action-name>"}` (JSON form) or `{"name":"<action-name>"}` (multipart `_action` field) regardless of whether the descriptor you read it from said `blocking:true` (the default, typically omitted) or `blocking:false`.

**For you (a wire-driving agent with no client-side dispatch loop): `blocking` is INFORMATIONAL ONLY. Dispatch the action exactly the same way regardless of its value** — POST `_action`/`_state` (or the JSON form) as normal and read the response per the existing rules in this manual (`ok`, `rejected`, `errors[]`). You do not need to implement coalescing, an epoch, or any dispatch-lane concept to drive the wire correctly.

This connects to the polling section above: the `{"name": "poll"}` dispatch this manual already documents is itself an instance of a non-blocking action — a poll always rides the non-blocking lane client-side — so nothing about how you send a poll dispatch changes either.

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

This manual applies to protocol token `viewmodel-shell/1.0` — the value of the `protocol` field on the discoverability meta tag. The protocol token tracks the wire shape, NOT the package version: a 1.5.x or 1.6.x package release may still carry protocol `viewmodel-shell/1.0` because the wire has not undergone a breaking change. A future major-version bump (`viewmodel-shell/2.0`) signals a breaking change and invalidates this manual; expect a new skill at the same `/.well-known/vms-skill.md` URL.
