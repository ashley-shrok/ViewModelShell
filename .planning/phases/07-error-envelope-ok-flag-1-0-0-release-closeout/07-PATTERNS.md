# Phase 7: Error Envelope + ok Flag + 1.0.0 Release Closeout — Pattern Map

**Mapped:** 2026-06-07
**Files analyzed:** 27 (8 framework source + 7 .NET demo controllers + 8 TS demo servers + 1 parity harness + 1 new parity fixture + 4 release artifacts)
**Analogs found:** 26 / 27 (the new envelope fixture has a close template; the `VmsActionError` TS class has only a structural analog)

This phase is largely a **direct-edit phase** — most files being modified ARE the canonical pattern for what they implement. For new additions (`UnknownActionError` / `UnknownActionException`, `VmsActionError`, the new parity fixture, the envelope-wrapping logic at the response edge), Phase 6's just-shipped `BadRequestError` / `validateActionNames` / fixture-step infrastructure is the freshest analog.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `viewmodel-shell/src/server.ts` (edit) | framework wire types + handler factory | request-response | self (Phase 6 just rewrote it) | self |
| `viewmodel-shell/src/index.ts` (edit) | shell runtime | request-response | self | self |
| `viewmodel-shell-dotnet/ViewModels.cs` (edit) | .NET framework wire types | request-response | self (Phase 6 just rewrote it) | self |
| `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj` (version bump) | release artifact | config | self (prior 0.16.0 bump) | self |
| `viewmodel-shell/package.json` (version bump) | release artifact | config | self | self |
| `demo/Tasks/AspNetCore/TasksController.cs` (edit) | demo controller | CRUD / request-response | self — canonical Phase-6 pattern | self |
| `demo/Tasks-bun/server.ts` (edit) | demo TS server | CRUD / request-response | self | self |
| `demo/ContactManager/AspNetCore/ContactsController.cs` (edit) | demo controller | CRUD / request-response | `demo/Tasks/AspNetCore/TasksController.cs` | exact role-match |
| `demo/ContactManager-bun/server.ts` (edit) | demo TS server | CRUD | `demo/Tasks-bun/server.ts` | exact |
| `demo/ExpenseTracker/AspNetCore/ExpensesController.cs` (edit) | demo controller | CRUD | `demo/Tasks/AspNetCore/TasksController.cs` | exact |
| `demo/ExpenseTracker-bun/server.ts` (edit) | demo TS server | CRUD | `demo/Tasks-bun/server.ts` | exact |
| `demo/RetroBoard/AspNetCore/RetroBoardController.cs` (edit) | demo controller | CRUD | `demo/Tasks/AspNetCore/TasksController.cs` | exact |
| `demo/RetroBoard-bun/server.ts` (edit) | demo TS server | CRUD | `demo/Tasks-bun/server.ts` | exact |
| `demo/HelpDesk/AspNetCore/AgentController.cs` (edit) | demo controller | CRUD + persistent (SQLite) | `demo/Tasks/AspNetCore/TasksController.cs` | structural |
| `demo/HelpDesk/AspNetCore/RequesterController.cs` (edit) | demo controller | CRUD + persistent | `demo/Tasks/AspNetCore/TasksController.cs` | structural |
| `demo/HelpDesk-bun/server.ts` (edit) | demo TS server (two controllers) | CRUD | `demo/Tasks-bun/server.ts` | structural |
| `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` (edit) | demo controller | CRUD + polling | `demo/Tasks/AspNetCore/TasksController.cs` | structural |
| `demo/FeatureProbe-bun/server.ts` (edit) | demo TS server | CRUD + polling | `demo/Tasks-bun/server.ts` | structural |
| `demo/FeatureProbe-node/server.ts` (edit) | demo TS server (node) | CRUD + polling | `demo/FeatureProbe-bun/server.ts` | exact (twin) |
| `demo/Reorder/AspNetCore/ReorderController.cs` (edit) | demo controller | CRUD | `demo/Tasks/AspNetCore/TasksController.cs` | exact |
| `demo/Reorder-bun/server.ts` (edit) | demo TS server | CRUD | `demo/Tasks-bun/server.ts` | exact |
| `parity/run.ts` (edit) | parity harness | streaming / batch | self — Phase 6 just rewrote it | self |
| `parity/fixtures/feature-probe-envelope.json` (NEW) | parity fixture | batch (HTTP step list) | `parity/fixtures/tasks.json` | structural template |
| `MIGRATION.md` (append) | release artifact | docs | existing append-only section at line 9 (0.16.0) | exact |
| `CHANGELOG.md` (append) | release artifact | docs | existing append-only section at line 9 (0.16.0) | exact |
| `AGENTS.md` (surgical edits) | docs | docs | self (Phase 5 EXAMPLES-03 bounded-pass convention) | self |
| `README.md` (accuracy pass) | docs | docs | self | self |

## Pattern Assignments

### `viewmodel-shell/src/server.ts` — `UnknownActionError` + envelope wrapping in `createAction`

**Analog: self.** This file IS the canonical pattern. The structural pattern for the new `UnknownActionError` class is the existing `BadRequestError` (lines 314-326); the structural pattern for envelope construction is the existing try/catch in `createAction` (lines 343-393).

**Existing `BadRequestError` class — template for `UnknownActionError`** (`viewmodel-shell/src/server.ts:314-326`):
```typescript
/**
 * Thrown by an action handler to signal a malformed/invalid request. The
 * createAction wrapper catches this and returns a 400 with the error
 * message in the body, matching the .NET twin's BadRequest("...") path.
 * Any other thrown Error propagates to the runtime (Bun.serve / Hono /
 * etc.) as a 500.
 */
export class BadRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}
```

Copy this exact shape for `UnknownActionError(name)` — single constructor arg `name: string`, set `this.name = "UnknownActionError"`, store `name` as a public field for the catch arm to read into the envelope's `code: "unknown_action"`.

**Existing try/catch envelope structure — template for the new envelope** (`viewmodel-shell/src/server.ts:346-392`):
```typescript
return async (request: Request): Promise<Response> => {
    const contentType = request.headers.get("content-type") ?? "";
    let payload: ActionPayload<TState>;
    try {
      if (contentType.includes("application/json")) {
        payload = parseJsonAction<TState>(await request.text());
      } else {
        payload = parseFormDataAction<TState>(await request.formData());
      }
    } catch (err) {
      return new Response(JSON.stringify({ error: (err as Error).message }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    let result: ShellResponseBody<TState>;
    try {
      result = await handler(payload);
    } catch (err) {
      if (err instanceof BadRequestError) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      throw err;
    }
    // Phase 06 / WIRE-05 — enforce action-name uniqueness on the built tree
    // before it leaves the server. A violation here is a server-side bug, so
    // we surface it as a 500 [...].
    if (result.vm) {
      try {
        validateActionNames(result.vm);
      } catch (err) {
        return new Response(JSON.stringify({ error: (err as Error).message }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  };
```

**Migration shape for Phase 7:** Three body-shape swaps + one new catch arm + one success-path mutation.
- Parse-error catch (line 356-361): swap `{error: msg}` → `{ok: false, errors: [{message: msg, code: "parse_error"}]}` (researcher decides the exact code string from the small stable vocabulary).
- `BadRequestError` catch (line 366-371): swap `{error: msg}` → `{ok: false, errors: [{message: msg}]}`. No `code` (this is the apps' "user can't see this" channel — see D-08).
- **New** catch arm above `throw err` at line 372: `if (err instanceof UnknownActionError) { return Response with status 400, body {ok: false, errors: [{message: err.message, code: "unknown_action"}]} }`.
- Uncaught-throw catch: convert the rethrow at line 372 into a wrapping catch — 500 + `{ok: false, errors: [{message: err.message, code: ...}]}` (researcher picks code).
- `validateActionNames` catch (line 380-386): same swap to envelope body shape, status stays 500.
- Success-path return (line 389-391): merge `{ok: true}` into the response body before serializing. Concretely: `JSON.stringify({ok: true, ...result})` — this is the central point where every successful response acquires `ok: true` (per CONTEXT.md integration-points).

**Conditional-spread null-omission pattern for `path?` and `code?`** — already canonical in this file, see `shellSideEffect.download` (`server.ts:308`):
```typescript
download: (url: string, filename?: string): ShellSideEffect =>
    ({ type: "download", url, ...(filename != null ? { filename } : {}) }),
```
Apply the identical `...(code != null ? { code } : {})` / `...(path != null ? { path } : {})` shape when constructing error entries.

---

### `viewmodel-shell/src/index.ts` — `VmsActionError` class + parse-then-branch in shell

**Analog: self.** The structural template for `VmsActionError` is the existing `failCapability` Error construction (lines 601-611). The structural template for parse-then-branch is the existing `processResponse` body-typed branching (lines 613-651) and the dispatch error path (lines 523-536).

**Existing `failCapability` Error construction — structural template for `VmsActionError`** (`viewmodel-shell/src/index.ts:601-611`):
```typescript
private failCapability(capability: "navigate" | "storage" | "saveFile", detail: string): void {
    const err = new Error(
      `[ViewModelShell] Adapter is missing the "${capability}" capability but the ` +
      `server response requires it (${detail}). This is a hard failure, not a no-op: ` +
      `a silently-dropped ${capability} (e.g. an auth token never persisted, a ` +
      `redirect that never happens, or an authenticated download silently swallowed) ` +
      `is a correctness/security bug. Implement ${capability}() on your Adapter, ` +
      `or (for redirect) pass ShellOptions.onRedirect.`
    );
    this.options.onError ? this.options.onError(err) : console.error("[ViewModelShell]", err);
  }
```

`VmsActionError` follows the same "construct an Error and surface via `onError`" surface — non-VMS apps that wired `onError` for fetch failures keep working unchanged (D-13/D-14). New class shape per D-13:
```typescript
export class VmsActionError extends Error {
  errors: Array<{ path?: string; message: string; code?: string }>;
  status: number;
  code?: string;  // shortcut to errors[0].code for ergonomic branching
}
```
The constructor composes `.message` from the structured `errors` array — researcher picks "join with '; '" vs "first entry" vs "count summary" (D-discretion).

**Existing dispatch error path — where the branch lands** (`viewmodel-shell/src/index.ts:520-545`):
```typescript
} else {
        res = await fetch(actionEndpoint, init);
      }
      if (!res.ok) throw new Error(`Action '${action.name}' failed: ${res.status}`);
      this.processResponse((await res.json()) as ShellResponse);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      onError ? onError(error) : console.error("[ViewModelShell]", error);
      // 0.8.0 (#11) — re-render the current VM on dispatch error. Adapters
      // may have applied client-side ephemeral state in onAction handlers
      // (e.g., BrowserAdapter swaps button text for ButtonNode.pendingLabel).
      // Re-rendering snaps that back to the authoritative server state.
      // Skipped when no VM has loaded yet (pre-initial-load dispatch is
      // already an error case handled above; currentVm stays null there).
      if (this.currentVm !== null) {
        this.options.adapter.render(this.currentVm, (a) => this.dispatch(a), this.stateAccessForAdapter());
      }
    }
```

**Migration shape for Phase 7:**
- Replace `if (!res.ok) throw new Error(...)` at line 523 with **always parse the body** — even on 4xx/5xx — per D-13. Then `const body = (await res.json()) as ShellResponse;` followed by the literal `if (body.ok === false) { throw new VmsActionError(body.errors, res.status); } else { this.processResponse(body); }` (user's exact phrasing from `<specifics>`).
- Symmetrical change at `load()` path (`index.ts:443-468`): the `if (!res.ok) throw new Error(...)` at line 450 follows the same parse-then-branch shape (CONTEXT.md integration-point: D-04 says `ok` on every response including GET).
- `processResponse` (line 613): the `body.ok === false` branch already short-circuited above. No render path change needed inside `processResponse` (D-15: shell does NOT render a returned `vm` on `ok: false`).
- `push()` (line 547-551): also runs through the same branching — when `shell.push()` receives an `ok: false` body (e.g. SSE-pushed server error), it surfaces via `onError` the same way. CONTEXT.md integration-points line 155 calls this out.

**Update `ShellResponse` interface** (`viewmodel-shell/src/index.ts:403-422`): add optional `ok?: boolean` field. (Optional because `processResponse` is called with the body type after parsing; the type stays additive — older code that hand-constructs a `ShellResponse` for `shell.push()` doesn't break.)

---

### `viewmodel-shell-dotnet/ViewModels.cs` — `UnknownActionException` + `Ok` property + envelope record

**Analog: self.** The structural pattern for `UnknownActionException` is the existing `InvalidOperationException` thrown by `ViewTreeValidation.ValidateActionNames` (line 386-391). The structural pattern for the `Ok` property addition is the recently-added `Busy` / `PreventUnload` defaults (`ViewModels.cs:94-99`).

**Existing `Busy` / `PreventUnload` non-nullable defaults — template for `Ok = true`** (`viewmodel-shell-dotnet/ViewModels.cs:85-100`):
```csharp
public record ShellResponse<TState>(
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] ViewNode? Vm,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] TState? State,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Redirect = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<ShellSideEffect>? SideEffects = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] int? NextPollIn = null,
    // 0.14.0 — install / clear the browser's "warn before unload" guard. False
    // is the default and is dropped from the wire via WhenWritingDefault, so the
    // wire stays clean (the field only appears on responses where it matters).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool PreventUnload = false,
    // 0.16.0 — lock the UI [...]
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Busy = false
)
```

**Important inversion for `Ok`:** Per D-04 / D-06, `ok` is on EVERY successful response — the default should serialize `true`, not be dropped. So `Ok` is NOT `WhenWritingDefault`-decorated; it's a plain `bool Ok = true` member that always serializes. (Alternatively a non-nullable `bool` with no JsonIgnore attribute at all — the maintainer rule at the top of `ViewModels.cs:7-22` is "non-nullable members deliberately keep serializing their value.")

**Existing `InvalidOperationException` thrown shape — template for `UnknownActionException`** (`viewmodel-shell-dotnet/ViewModels.cs:386-391`):
```csharp
if (!allInSameForm)
            {
                throw new InvalidOperationException(
                    $"Duplicate action name '{group.Key}' dispatched from semantically distinct nodes. " +
                    "Each action name must name exactly one operation. Either rename one of the " +
                    $"nodes (e.g. '{group.Key}-X' / '{group.Key}-Y') or move them into the same surrounding " +
                    "form if they are intended to fire the same operation.");
            }
```

For `UnknownActionException` — public class extending `Exception`, single constructor `(string name)`, sets the message and stores `Name` as a public property the framework's response-edge wrapper reads to write `code: "unknown_action"`.

**Envelope record additions** — new records on the wire:
- `ErrorEntry(string Message, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Path = null, [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Code = null)` — matches the `ShellSideEffect` record pattern at `ViewModels.cs:60-66` for nullable wire optionals.
- An error-envelope response shape (researcher picks between extending `ShellResponse<TState>` with nullable `Ok` + `Errors`, or a separate `ShellErrorResponse` record with `Ok = false` and `Errors`). The D-06 lock is "framework constructs the `ok: false` envelope without an app-supplied `ShellResponse<T>`."

**Validate() — already on the record** (`viewmodel-shell-dotnet/ViewModels.cs:127-131`): this fluent chain is where Phase 6 wired the action-name uniqueness check; Phase 7 either extends `Validate()` to also normalize the envelope, or layers a separate framework helper (a controller filter or `AsActionResult()` method per CONTEXT.md integration-points line 157). Researcher proposes the exact mechanism; constraint is "apps don't need per-controller boilerplate to get `Ok` set."

---

### Demo controllers (`.NET`) — sweep `default:` to throw `UnknownActionException`

**Analog: `demo/Tasks/AspNetCore/TasksController.cs` lines 60-63** (the simplest dispatch with the cleanest `return BadRequest(...)` arm to replace):

```csharp
else
        {
            return BadRequest($"Unknown action: {name}");
        }

        return new ShellResponse<TasksState>(BuildVm(state), state).Validate();
```

**Migration shape:** replace `return BadRequest($"Unknown action: {name}")` with `throw new UnknownActionException(name)`. Mechanical sweep across **all 7 .NET controllers**:
| File | Line | Today | After |
|---|---|---|---|
| `demo/Tasks/AspNetCore/TasksController.cs` | 62 | `return BadRequest($"Unknown action: {name}");` | `throw new UnknownActionException(name);` |
| `demo/ContactManager/AspNetCore/ContactsController.cs` | 108 | same | same |
| `demo/ExpenseTracker/AspNetCore/ExpensesController.cs` | 69 | same | same |
| `demo/RetroBoard/AspNetCore/RetroBoardController.cs` | 62 | same | same |
| `demo/HelpDesk/AspNetCore/AgentController.cs` | 97 | same | same |
| `demo/HelpDesk/AspNetCore/RequesterController.cs` | 101 | same | same |
| `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` | 193 | same | same |
| `demo/Reorder/AspNetCore/ReorderController.cs` | 99 | same | same |

**Note on validation `BadRequest` calls** (per D-08 — these STAY in the public API but their wire shape changes to the envelope on the framework's wrapping side):
- `demo/Tasks/AspNetCore/TasksController.cs:36` — `if (...) return BadRequest("title required");` — these are "structurally invalid request" calls (D-08), not app validation. Stay as-is in the controller; the framework wraps them into the new envelope shape.
- `demo/ContactManager/AspNetCore/ContactsController.cs:36, 56, 77` — same.
- `demo/ExpenseTracker/AspNetCore/ExpensesController.cs:36` — same.
- `demo/RetroBoard/AspNetCore/RetroBoardController.cs:35` — same.

(Routine app validation — duplicate-email, permission-denied — already follows the state-based `ValidationError` field pattern from AGENTS.md gotcha #4 and is unchanged. D-07.)

---

### Demo servers (TS/Bun/Node) — sweep `default:` to throw `UnknownActionError`

**Analog: `demo/Tasks-bun/server.ts` lines 194-225** (canonical clean Phase-6 pattern):

```typescript
export const actionHandler = createAction<TasksState>(async (payload) => {
  let state = payload.state;
  const name = payload.name;

  if (name === "add") {
    const title = state.draftTitle?.trim() ?? "";
    if (!title) {
      throw new BadRequestError("title required");
    }
    [...]
  } else if (name.startsWith("filter-")) {
    const value = name.slice("filter-".length);
    state = { ...state, filter: value };
  } else {
    throw new BadRequestError(`Unknown action: ${name}`);
  }

  return { vm: buildVm(state), state };
});
```

**Migration shape:** replace `throw new BadRequestError(\`Unknown action: ${name}\`)` with `throw new UnknownActionError(name)`. Add `UnknownActionError` to the import block at the top of each server (alongside the existing `BadRequestError` import).

**Sweep across 8 TS demo servers:**
| File | Line | Today |
|---|---|---|
| `demo/Tasks-bun/server.ts` | 221 | `throw new BadRequestError(\`Unknown action: ${name}\`);` |
| `demo/ContactManager-bun/server.ts` | 302 | same |
| `demo/ExpenseTracker-bun/server.ts` | 293 | same |
| `demo/RetroBoard-bun/server.ts` | 233 | same |
| `demo/HelpDesk-bun/server.ts` | 601 | same (Agent handler) |
| `demo/HelpDesk-bun/server.ts` | 851 | same (Requester handler — two `createAction` calls in one file) |
| `demo/FeatureProbe-bun/server.ts` | TBD (search for "Unknown action") | same |
| `demo/FeatureProbe-node/server.ts` | TBD | same |
| `demo/Reorder-bun/server.ts` | 152 | same |

Validation `throw new BadRequestError("title required")` calls stay (D-08, same rationale as .NET).

---

### `parity/run.ts` — `ok: true` assertion sweep + envelope-aware response capture

**Analog: self.** The existing capture/diff loop in `runFixtureAgainst` (`parity/run.ts:180-226`) is the integration point; the normalize/diff pair in `parity/normalize.ts:14-58` is where added fields get compared.

**Existing capture loop** (`parity/run.ts:216-223`):
```typescript
const res = await fetch(url, init);
    if (!res.ok) {
      throw new Error(`${cfg.name} step '${step.id}' failed: ${res.status} ${res.statusText}`);
    }
    const body = await res.json() as CapturedResponse & { vm: unknown; state: unknown };
    captured.push({ step: step.id, ...body });
    lastState = body.state;
```

**Migration shape (Phase 7 / D-20 sweep + D-21 envelope cases):**
- **D-20 sweep (additive, mechanical):** the `ok: true` field flows through naturally — every framework-rendered response now includes `ok: true`, and the existing diff loop compares it across backends without code change. The CapturedResponse interface (`run.ts:73-80`) gets an `ok?: boolean` field added to type-narrow on. Optionally add a single assertion line in `runFixtureAgainst` after `captured.push`: `if (body.ok !== true) throw new Error(\`${cfg.name} step '${step.id}' expected ok:true, got ${body.ok}\`);` for fail-fast diagnostics on the success path.
- **D-21 new fixture** (see next section): the harness needs an opt-in to allow non-2xx responses for the envelope-case steps. Researcher picks the exact mechanism — likely a per-step `expectStatus?: number` field added to `FixtureStep` (`run.ts:35-64`), checked against `res.status` instead of throwing on `!res.ok`. Steps without `expectStatus` keep today's "throw on !ok" behavior.

**Existing FixtureStep interface** (`parity/run.ts:35-64`) — additive field shape template:
```typescript
interface FixtureStep {
  id: string;
  method: "GET" | "POST";
  endpoint?: string;
  actionEndpoint?: string;
  freshState?: boolean;
  action?: { name: string };
  stateMutations?: Array<{ path: string; value: unknown }>;
  attach?: Record<string, { name: string; content: string }>;
}
```
Adding `expectStatus?: number` follows the existing optional-field shape (every other field is optional). Diff/normalize layer (`parity/normalize.ts`) needs no change — the `ok` field is just another JSON property that gets walked.

---

### `parity/fixtures/feature-probe-envelope.json` (NEW) — three envelope cases

**Analog: `parity/fixtures/tasks.json`** — closest template for a fixture file (smallest, exercises full step lifecycle):

```json
{
  "name": "tasks",
  "endpoint": "/api/tasks",
  "actionEndpoint": "/api/tasks/action",
  "$comment": "Phase 6 wire shape (0.17.0 / WIRE-07): _action carries {name} only. [...]",
  "steps": [
    { "id": "initial-load",  "method": "GET" },
    { "id": "filter-active", "method": "POST", "action": { "name": "filter-active" } },
    { "id": "toggle-2",      "method": "POST", "action": { "name": "toggle-row-2" }, "stateMutations": [{ "path": "items.1.completed", "value": true }] },
    [...]
  ]
}
```

**New fixture shape (D-21 — three envelope cases, FeatureProbe-hosted):**
```json
{
  "name": "feature-probe-envelope",
  "endpoint": "/api/feature-probe",
  "actionEndpoint": "/api/feature-probe/action",
  "$comment": "Phase 7 envelope cases. Each step asserts ok:false + expected HTTP status. Demonstrates: (1) malformed payload → 400, (2) unknown action → 400 with code:unknown_action, (3) uncaught throw → 500. All three case responses share the {ok:false, errors:[...]} body shape; only status differs.",
  "steps": [
    { "id": "initial-load",  "method": "GET" },
    // Step 2: malformed _action body — researcher picks the exact malformation
    // (missing _action field, invalid JSON, etc.). expectStatus: 400.
    { "id": "malformed-payload", "method": "POST", "action": { "name": "...malformed..." }, "expectStatus": 400 },
    // Step 3: unknown action name — controller's dispatch throws UnknownActionError.
    { "id": "unknown-action", "method": "POST", "action": { "name": "this-action-does-not-exist" }, "expectStatus": 400 },
    // Step 4: deliberate uncaught throw — new FeatureProbe action `boom` throws
    // a generic Error; the framework wraps as 500 + envelope.
    { "id": "uncaught-throw", "method": "POST", "action": { "name": "boom" }, "expectStatus": 500 }
  ]
}
```

**Coupled work — add a `"boom"` action to FeatureProbe controllers** (both `.NET` at `demo/FeatureProbe/AspNetCore/FeatureProbeController.cs` and bun/node at `demo/FeatureProbe-bun/server.ts` + `demo/FeatureProbe-node/server.ts`). The action handler is one line: `throw new Exception("deliberate test failure")` / `throw new Error("deliberate test failure")`. Place it before the `default` / `else` arm so the throw path is exercised before the unknown-action path.

**Register in `parity/backends.json`** for the FeatureProbe-bearing backends (existing FeatureProbe fixture entries — add `"feature-probe-envelope"` to their `fixtures` array).

---

### Version bumps — `package.json` and `AshleyShrok.ViewModelShell.csproj`

**Analog: self.** The prior 0.16.0 → next bump pattern is direct text replacement.

`viewmodel-shell/package.json:3` — `"version": "0.16.0"` → `"version": "1.0.0"`.
`viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj:13` — `<Version>0.16.0</Version>` → `<Version>1.0.0</Version>`.

**Sequencing (D-18 / D-19):** version bump is the LAST plan, after all other Phase 7 work is shipped + parity is green. "Expose breakage internally before consumers see it" — user's exact principle.

---

### `MIGRATION.md` — consolidated 1.0.0 section (D-16)

**Analog: existing 0.16.0 section at `MIGRATION.md:9` and following.** The append-only convention is established: new section at the top, prior sections kept verbatim.

**Per D-16: ONE comprehensive 1.0.0 section** covering the entire milestone (context-payload elimination from Phase 6, bind paths on every input from Phase 6, action-name uniqueness rule from Phase 6, the new error envelope + ok flag + UnknownActionError pattern from Phase 7). Single end-to-end recipe for any consumer on 0.4.x or 0.16.x — they don't read it in two chunks. Prior sections (0.3.13, 0.4.0, 0.13.0, 0.14.0, 0.15.0, 0.16.0) stay append-only for consumers stuck on older versions.

Existing structure to follow per the 0.16.0 section pattern:
- `## Upgrading to '1.0.0' (...) (npm + NuGet)`
- `### What changed`
- `### Migration recipe` — per-app concrete steps (the wire shape break is the surface).

Section ordering inside the 1.0.0 entry (researcher decides exact title wording):
1. Context-payload elimination (Phase 6 / WIRE-03)
2. Bind paths on every input (Phase 6 / WIRE-01)
3. Action-name uniqueness rule (Phase 6 / WIRE-05) — with the `validateActionNames` diagnostic message
4. The new error envelope + ok flag + `UnknownActionError` / `UnknownActionException` migration step (Phase 7)
5. `BadRequestError` / `BadRequest("...")` semantic split (D-08) — kept in the public API, but reserved for structurally invalid request

---

### `CHANGELOG.md` — 1.0.0 entry (D-RELEASE-03)

**Analog: existing 0.16.0 entry at `CHANGELOG.md:9`** — the append-only `## 0.16.0 — ...` header pattern, followed by `### Why` / `### Added` / `### Demo + parity` / `### Consumers` sub-sections.

Existing structure to follow:
```markdown
## 0.16.0 — `ShellResponse.busy` (UI lockout) + generic per-round-trip lock (npm + NuGet)

[crisp before/after framing]

### Why
[user-facing motivation]

### Added
[bullet list of new wire fields / behaviors]

### Demo + parity
[which demos exercise it; parity coverage]

### Consumers
[migration impact: opt-in vs auto / breaking vs additive]
```

New 1.0.0 entry has the same structure, scoped to the full milestone (wire-shape break + error envelope + ok flag) per RELEASE-03's "crisp before/after framing for consumers."

---

### `AGENTS.md` — surgical rewrite (D-17)

**Analog: self — Phase 5 EXAMPLES-03 / Phase 6 RELEASE-04 bounded-accuracy convention.** No restructure; accuracy-only sweep per section.

Sections to rewrite per D-17 (line/section references from `AGENTS.md`):
- **Line 19, `## Critical gotchas (read first)`** — drop context-related footguns (already invalid post-Phase-6), refine gotcha #4 (state-vs-throw rule for the ok-flag era), document the `ok` flag as the single check across responses.
- **Line 368, `### Action payload — JSON body (curl/agent ergonomics)`** — rewrite to show the new `{action, state, files?}` wire shape and the `{ok: false, errors: [...]}` envelope.
- **Line 167, `## Non-obvious framework behaviors`** — accuracy sweep: add the uniform-`ok` rule, the `VmsActionError` surface on `onError`, the `UnknownActionError`/`UnknownActionException` pattern.
- **Line 400, `### ShellResponse<TState> reference`** — add `Ok` row (framework-set, document it).
- **Everything else** — accuracy-only pass; no restructure.

The existing gotcha #4 text (`AGENTS.md:30` — "Inline validation goes in the state record, not BadRequest") is the canonical state-vs-throw pattern that survives unchanged into the ok-flag era; refine its wording to mention the new envelope so agents reading just gotcha #4 understand the split.

---

### `README.md` — accuracy check

**Analog: self.** Just sweep version references (anything saying `0.16.x` or pinning an example to `0.4.x` bumps to `1.0.0`) and check that any wire-shape examples in the README match the new `{action, state}` shape + envelope. No structural change.

---

## Shared Patterns

### Null omission for `path?` and `code?` on error entries

**Source: `viewmodel-shell-dotnet/ViewModels.cs:7-22` (the wire-contract maintainer rule).**
**Apply to:** every new nullable field on the envelope (`ErrorEntry.Path`, `ErrorEntry.Code`).

```csharp
// ─────────────────────────────────────────────────────────────────────────────
// WIRE CONTRACT — null omission is INTRINSIC to these types.
//
// Every nullable (T?) member of an outbound wire record carries
//   [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
// so the contract — "an unset optional is ABSENT, never \"field\": null" —
// holds even under default ASP.NET JsonSerializerOptions [...]
// ─────────────────────────────────────────────────────────────────────────────
```

On the TS side, the conditional-spread mirror from `viewmodel-shell/src/server.ts:308`:
```typescript
download: (url: string, filename?: string): ShellSideEffect =>
    ({ type: "download", url, ...(filename != null ? { filename } : {}) }),
```

### Framework-set wire fields (the Phase 6 `Busy` / `PreventUnload` template)

**Source: `viewmodel-shell-dotnet/ViewModels.cs:94-99` + `viewmodel-shell/src/server.ts:280-289`.**
**Apply to:** the new `Ok` flag construction in `ShellResponse<TState>` and at the success-path return in `createAction`.

The Phase 6 / 0.16.0 `Busy` / `PreventUnload` pattern is "framework sets this on every response, shell branches on it." `ok` follows the same shape with one inversion: it's checked **before** anything else in `processResponse` / `load()` / `push()`, and it defaults to `true` (the success case) rather than `false` (the toggle case).

### Validate() fluent chain — where to wire framework checks

**Source: `viewmodel-shell-dotnet/ViewModels.cs:127-131`.**
**Apply to:** the new envelope-construction wrapper (if implemented as a chained method) or the controller-filter layer (if implemented as a filter).

```csharp
public ShellResponse<TState> Validate()
{
    if (Vm is not null) ViewTreeValidation.ValidateActionNames(Vm);
    return this;
}
```

The Phase 6 `Validate()` chain is the established response-edge work point on the .NET backend. Phase 7's envelope wrapper either extends this method or sits next to it (researcher decides per CONTEXT.md integration-points line 157).

### Exception → response-edge wrapping (the `createAction` template)

**Source: `viewmodel-shell/src/server.ts:343-393`.**
**Apply to:** every new `try/catch` arm in the Phase 7 envelope migration.

The existing try/catch structure (parse-error catch → 400; `BadRequestError` catch → 400; `validateActionNames` catch → 500; rethrow otherwise) is exactly the shape Phase 7 extends — three swaps + one new arm. The structural pattern is unchanged; only the response body shape changes from `{error: msg}` to `{ok: false, errors: [...]}`.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| (none — every Phase-7 file has either self or a Phase-6 sibling as analog) | | | |

The `VmsActionError` TypeScript class is the only meaningful "new construct" with no direct analog — the closest structural template is the `failCapability` Error construction in `index.ts:601-611`, which differs in being a one-shot `new Error(...)` rather than a subclass. The planner should treat `VmsActionError` as a fresh small class extending `Error` per the D-13 shape spec, not as a refactor of an existing class.

## Metadata

**Analog search scope:** `viewmodel-shell/src/`, `viewmodel-shell-dotnet/`, `demo/**/AspNetCore/`, `demo/**-bun/`, `demo/**-node/`, `parity/`, repo root release artifacts.
**Files scanned:** ~30 (focused — Phase 7 is largely self-referential).
**Pattern extraction date:** 2026-06-07.
