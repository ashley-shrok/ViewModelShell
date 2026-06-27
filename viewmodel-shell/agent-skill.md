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

Stop on `ok: false`. Surface the message to the user. Do not retry blindly — most of these are deterministic.

## Auth

The wire does not mandate an auth shape. If the app needs credentials, the app preamble above (or its own README) names them. Common patterns: a `Bearer` token in `Authorization`, a CSRF/anti-forgery token in a custom header, a session cookie. Send the same headers on every request, including polls and downloads. The `download` side-effect re-presents your auth headers when the agent fetches the file.

## Polling

If a response carries `nextPollIn: N`, schedule a POST `{ "name": "poll", "state": <last state> }` against the same `actionEndpoint` after `N` milliseconds. The server may continue returning `nextPollIn` until the workflow reaches a terminal state, at which point the field will be absent. Polls run silently — they are not user-initiated.

## Files

File uploads use the multipart form above. One form entry per file input, keyed by the input's `name` attribute (from the corresponding node's `name` field in the tree). The file's binary content is the entry's value. JSON-body dispatch cannot carry files; use multipart.

## Versioning

This manual applies to protocol token `viewmodel-shell/1.0` — the value of the `protocol` field on the discoverability meta tag. The protocol token tracks the wire shape, NOT the package version: a 1.5.x or 1.6.x package release may still carry protocol `viewmodel-shell/1.0` because the wire has not undergone a breaking change. A future major-version bump (`viewmodel-shell/2.0`) signals a breaking change and invalidates this manual; expect a new skill at the same `/.well-known/vms-skill.md` URL.
