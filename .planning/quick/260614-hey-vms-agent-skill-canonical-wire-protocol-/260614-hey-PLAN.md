---
phase: 260614-hey-vms-agent-skill-canonical-wire-protocol-
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - viewmodel-shell/agent-skill.md
  - viewmodel-shell/package.json
  - viewmodel-shell/src/server.ts
  - viewmodel-shell/test/agent-skill.test.ts
  - viewmodel-shell-dotnet/AgentSkill.md
  - viewmodel-shell-dotnet/AgentSkill.cs
  - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
  - viewmodel-shell-dotnet/Tests/AgentSkillTests.cs
  - demo/HelpDesk/AspNetCore/Program.cs
  - demo/HelpDesk/frontend/agent.html
  - demo/HelpDesk/frontend/requester.html
  - demo/HelpDesk-bun/server.ts
  - parity/check-skill.ts
  - parity/run.ts
  - AGENTS.md
  - CHANGELOG.md
  - MIGRATION.md
autonomous: true
requirements:
  - VMS-SKILL-01
must_haves:
  truths:
    - "Both packages ship a canonical `agent-skill.md` markdown file with byte-identical content (npm publishes it under the package root; NuGet embeds it as a resource)."
    - "Both backends expose a one-liner mount helper that serves the canonical markdown at a configurable path (defaults to `/.well-known/vms-skill.md`) with `Content-Type: text/markdown; charset=utf-8`."
    - ".NET helper: `app.MapVmsAgentSkill()` (extension on `IEndpointRouteBuilder`); optional overloads accept a custom path and/or an `appPreamble` string."
    - "TS helper: `createAgentSkillHandler({appPreamble?})` returns a Web Fetch `(Request) => Response` handler that Bun/Deno/Hono/Workers mount on whichever path the app chooses."
    - "When `appPreamble` is supplied, the served body is `<preamble>\\n\\n---\\n\\n## App-specific notes\\n\\n<preamble>\\n\\n---\\n\\n<canonical-skill>`. (Actually: preamble goes ABOVE under heading; see Task 1/2.) Locked shape: served body = `## App-specific notes\\n\\n<preamble>\\n\\n---\\n\\n<canonical-skill-body>` when preamble present, else canonical body verbatim."
    - "Missing-resource is fail-loud: if the .NET embedded resource is absent at runtime, `MapVmsAgentSkill` throws `InvalidOperationException` at mount time (not at first request). The TS helper has no equivalent failure mode because the markdown is imported at module load (a missing file is a build/import-time error)."
    - "The existing `<meta name=\"viewmodel-shell\">` JSON gains an optional `skill` field pointing at the served URL. Omitting it is supported and produces byte-identical behavior to today (old agents still ignore unknown fields)."
    - "HelpDesk demo (both .NET twin and bun twin) mounts the skill endpoint at `/.well-known/vms-skill.md` with a short app-specific preamble naming the help-desk domain; both agent.html + requester.html meta tags gain the `skill` field."
    - "Parity gate: `GET /.well-known/vms-skill.md` against the dotnet-helpdesk and bun-helpdesk backends returns identical bodies AND `Content-Type: text/markdown; charset=utf-8`. Drift fails the build."
    - "AGENTS.md 'Agent discoverability' section is refreshed: the stale `viewmodel-shell/0.12` protocol example is corrected to the current `viewmodel-shell/1.0`; the new `skill` meta field is documented; both helper APIs get one-paragraph descriptions + copy-pasteable mount snippets; the canonical-skill source-tree location is named."
    - "Versions lockstep-bumped: npm 1.5.0 → 1.6.0; NuGet 1.4.0 → 1.5.0. Both minor (additive, no breaking change)."
    - "No new wire-shape ViewNode fields introduced — therefore critical gotcha #8 (JsonIgnore on nullable wire fields) does not apply to this plan. (Confirmed: the skill helpers serve markdown over HTTP; they do not extend the JSON wire.)"
  artifacts:
    - path: "viewmodel-shell/agent-skill.md"
      provides: "The canonical agent skill markdown — operating manual for the VMS wire protocol. Shipped in the npm `files` list."
      contains: "viewmodel-shell/1.0"
    - path: "viewmodel-shell/src/server.ts"
      provides: "`createAgentSkillHandler({appPreamble?})` factory exported from the server subpath"
      contains: "createAgentSkillHandler"
    - path: "viewmodel-shell/test/agent-skill.test.ts"
      provides: "vitest suite for the TS helper — verifies handler returns 200, correct content-type, canonical body verbatim when no preamble, preamble prepended under '## App-specific notes' heading when supplied"
    - path: "viewmodel-shell-dotnet/AgentSkill.md"
      provides: "The canonical agent skill markdown — byte-identical to viewmodel-shell/agent-skill.md (single-source-of-truth maintained via a tiny sync check in the parity script; see Task 6 + Task 8)."
    - path: "viewmodel-shell-dotnet/AgentSkill.cs"
      provides: "`AgentSkillExtensions.MapVmsAgentSkill(this IEndpointRouteBuilder, string path = '/.well-known/vms-skill.md', string? appPreamble = null)` extension method; loads the embedded resource lazily on first request (with cached result); throws InvalidOperationException at mount time if the embedded resource is missing"
      contains: "MapVmsAgentSkill"
    - path: "viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj"
      provides: "Embeds AgentSkill.md as a logical resource under the manifest name 'AshleyShrok.ViewModelShell.AgentSkill.md' AND bumps `<Version>` from 1.4.0 to 1.5.0"
      contains: "AgentSkill.md"
    - path: "viewmodel-shell-dotnet/Tests/AgentSkillTests.cs"
      provides: "xUnit facts for the .NET helper — verify mount throws if the embedded resource is missing (simulated via a wrapper that reads from a different assembly), verify handler returns 200 + correct content-type + canonical body verbatim (no preamble), verify preamble prepended when supplied, verify path override works"
    - path: "demo/HelpDesk/AspNetCore/Program.cs"
      provides: ".NET HelpDesk demo mounts the skill endpoint with a help-desk-specific preamble"
      contains: "MapVmsAgentSkill"
    - path: "demo/HelpDesk-bun/server.ts"
      provides: "bun HelpDesk demo mounts the skill endpoint with a help-desk-specific preamble (same preamble text, byte-identical bodies)"
      contains: "createAgentSkillHandler"
    - path: "demo/HelpDesk/frontend/agent.html"
      provides: "agent.html meta tag gains `skill` field"
    - path: "demo/HelpDesk/frontend/requester.html"
      provides: "requester.html meta tag gains `skill` field"
    - path: "parity/check-skill.ts"
      provides: "Standalone parity check: spins up dotnet-helpdesk + bun-helpdesk via the existing backends.json registry, GETs `/.well-known/vms-skill.md` from each, asserts body bytes are identical AND content-type matches AND the served body literally contains the help-desk preamble string (sanity check that `appPreamble` plumbing fires on both backends)"
    - path: "parity/run.ts"
      provides: "Top-level parity orchestrator runs the existing JSON-fixture sweep AND then invokes the new check-skill.ts step; one failing check fails the run."
    - path: "AGENTS.md"
      provides: "'Agent discoverability' section refreshed with the new `skill` meta field, corrected protocol example, both helper API descriptions, source-tree pointer to the canonical skill"
    - path: "CHANGELOG.md"
      provides: "1.6.0 / 1.5.0 entry"
    - path: "MIGRATION.md"
      provides: "1.6.0 / 1.5.0 entry (additive — no consumer action required)"
  key_links:
    - from: "viewmodel-shell/agent-skill.md (canonical source)"
      to: "viewmodel-shell-dotnet/AgentSkill.md (.NET embedded resource copy)"
      via: "byte-identical content (locked decision 1); maintained via a sync check in parity/check-skill.ts that diffs the two files at the source tree as well as the two served HTTP bodies"
      pattern: "viewmodel-shell/1.0"
    - from: "viewmodel-shell/src/server.ts (createAgentSkillHandler)"
      to: "viewmodel-shell/agent-skill.md"
      via: "ESM import-as-string OR readFileSync at module-init (executor picks the simplest cross-runtime path — see Task 2 'behavior' for the recommended approach)"
      pattern: "createAgentSkillHandler"
    - from: "viewmodel-shell-dotnet/AgentSkill.cs (MapVmsAgentSkill)"
      to: "viewmodel-shell-dotnet/AgentSkill.md (embedded resource)"
      via: "Assembly.GetManifestResourceStream(\"AshleyShrok.ViewModelShell.AgentSkill.md\") with InvalidOperationException at mount if absent (fail-loud rule)"
      pattern: "AshleyShrok.ViewModelShell.AgentSkill.md"
    - from: "demo/HelpDesk/AspNetCore/Program.cs"
      to: "AgentSkillExtensions.MapVmsAgentSkill"
      via: "one-liner registration call between MapControllers() and MapFallbackToFile()"
      pattern: "MapVmsAgentSkill"
    - from: "parity/check-skill.ts"
      to: "parity/run.ts orchestrator"
      via: "run.ts invokes check-skill.ts after the JSON-fixture sweep; failure exits non-zero"
      pattern: "check-skill"
---

<objective>
Ship a canonical agent skill — a self-contained markdown operating manual for the VMS wire protocol — and serve it from a well-known endpoint advertised in the existing `<meta name="viewmodel-shell">` discoverability tag. Today, BrowserAdapter encapsulates the entire protocol (multipart `_action`+`_state`, JSON-body opt-in, state round-trip rules, bind paths, response envelope, side-effect verbs, polling, auth headers, dispatch guard, file persistence) for human visitors; an agent driving the API cold gets a JSON tree but none of the operating knowledge. The skill closes that gap.

Purpose: a JS-less agent — curl, WebFetch, an LLM reading the page — can `curl https://<host>/.well-known/vms-skill.md` and obtain a tight, imperative ~1-3-page operating manual that documents every protocol invariant the renderer hides. The skill IS the protocol manual; per-app preambles (optional) let an app prepend domain context above the canonical body. The skill grows with the framework — when a new side-effect verb or wire-shape lands, the skill gains a line, just like CHANGELOG.

Output: canonical markdown shipped in BOTH packages (npm file + .NET embedded resource, byte-identical), tiny mount helper on each backend (`MapVmsAgentSkill` on .NET, `createAgentSkillHandler` on TS), one HelpDesk twin pair mounted as the worked example + parity surface, the meta tag's new optional `skill` field, AGENTS.md doc refresh, parity gate that prevents the .NET embedded copy from drifting from the npm source, CHANGELOG + MIGRATION entries, and lockstep minor version bumps (npm 1.5.0 → 1.6.0; NuGet 1.4.0 → 1.5.0).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/home/ubuntu/ViewModelShell/AGENTS.md
@/home/ubuntu/ViewModelShell/viewmodel-shell/src/server.ts
@/home/ubuntu/ViewModelShell/viewmodel-shell/src/index.ts
@/home/ubuntu/ViewModelShell/viewmodel-shell/src/browser.ts
@/home/ubuntu/ViewModelShell/viewmodel-shell/package.json
@/home/ubuntu/ViewModelShell/viewmodel-shell-dotnet/ViewModels.cs
@/home/ubuntu/ViewModelShell/viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
@/home/ubuntu/ViewModelShell/demo/HelpDesk/AspNetCore/Program.cs
@/home/ubuntu/ViewModelShell/demo/HelpDesk-bun/server.ts
@/home/ubuntu/ViewModelShell/demo/HelpDesk/frontend/agent.html
@/home/ubuntu/ViewModelShell/demo/HelpDesk/frontend/requester.html
@/home/ubuntu/ViewModelShell/parity/run.ts
@/home/ubuntu/ViewModelShell/parity/backends.json
@/home/ubuntu/ViewModelShell/parity/fixtures/helpdesk.json
@/home/ubuntu/ViewModelShell/CHANGELOG.md
@/home/ubuntu/ViewModelShell/MIGRATION.md
@/home/ubuntu/ViewModelShell/.planning/quick/260614-bmd-issue-21-sectionnode-url-link-variant-cl/260614-bmd-SUMMARY.md

<interfaces>
This plan is fundamentally different from prior 260613-w4z / 260614-9hq / 260614-bmd in one respect: it adds NO new ViewNode wire field. The work is content (the skill markdown) + a tiny HTTP-handler helper on each backend. Critical gotcha #8 (JsonIgnore on nullable wire fields) does NOT apply because no nullable wire field is added. Critical gotcha #9 (parity) DOES apply — but the parity surface is the served markdown body, not a JSON ViewNode subtree, so the gate goes in a sibling script (`parity/check-skill.ts`) rather than the existing JSON-fixture machinery.

**Canonical skill content scope (Task 1).** The skill is the protocol invariants ONLY, not framework lore. Roughly 1-3 pages. Locked section order (per task-summary decision 1):
  a. **What VMS is** — 2-3 sentences. Server-driven UI; response is structured view tree + state blob; drive via this API without rendering anything.
  b. **The endpoints** — GET to load initial `{vm, state}`; POST `actionEndpoint` to dispatch actions. URLs come from the `<meta name="viewmodel-shell">` tag's `endpoint` / `actionEndpoint` fields.
  c. **Action dispatch shape** — two forms:
     - JSON (recommended for agents): `Content-Type: application/json`, body `{"name": "<action-name>", "state": <round-tripped state blob>}`. Files NOT supported in this form.
     - Multipart (browser/file-bearing): three required field types — `_action={"name":"..."}`, `_state=<JSON>`, plus one form field per file input keyed by the input's `name` attribute.
  d. **The round-trip rule** — the `state` blob from the last response is sent back unmodified EXCEPT for fields the user changed. Input nodes carry a `bind` property whose value is the dotted path inside `state` where the input's value lives. Update that path before dispatch; everything else stays as-is.
  e. **Response envelope** — every response has `ok: bool`. Success: `{ok:true, vm, state}` OR `{ok:true, redirect:"<url>"}` OR `{ok:true, sideEffects:[...]}` (these compose — `sideEffects` may accompany `vm`/`state` or a `redirect`). Failure: `{ok:false, errors:[{message, code?, path?}]}` with status 4xx/5xx. Optional success-path fields: `nextPollIn` (ms — schedule next poll), `busy` (boolean — server is busy; drop user dispatches until cleared), `preventUnload` (boolean — install a "leave site?" guard).
  f. **Side-effect verbs** — `set-local-storage {key, value}`, `set-session-storage {key, value}`, `download {url, filename?}`. Honor or ignore per-agent-policy. UNKNOWN verbs MUST be silently ignored (forward-compat rule; future verbs may land in a minor release).
  g. **Errors** — `ok:false` carries `errors[]`; common codes: `parse_error`, `unknown_action`, `invalid_tree`, `uncaught_exception`. Stop and surface to the user; do not retry.
  h. **Auth** — if the app needs it, send headers per the app's preamble above. The framework does not mandate an auth shape.
  i. **Polling** — if a response carries `nextPollIn`, schedule a POST `{name:"poll", state}` after that many ms. The server may continue returning `nextPollIn` until the workflow reaches a terminal state.
  j. **Files** — multipart only; one form field per file input by the input's `name`.
  k. **Versioning** — this skill applies to protocol `viewmodel-shell/1.0` (matches the meta tag's `protocol` field). Future protocol-breaking changes will bump that token.

Tone: imperative, operational, no framework history or marketing. The reader is an agent that needs to do work in the next 60 seconds.

**Preamble shape (Task 2/4).** When `appPreamble` is supplied, the served body is:
```
## App-specific notes

<preamble verbatim>

---

<canonical-skill-body verbatim>
```
The `---` HR is the separator. The `## App-specific notes` heading is fixed (apps don't supply their own heading — preamble is plain paragraph-style content). When `appPreamble` is null/empty, the served body is the canonical skill verbatim (no leading heading, no separator).

**The byte-identical-twin rule (Task 1).** `viewmodel-shell/agent-skill.md` and `viewmodel-shell-dotnet/AgentSkill.md` MUST be byte-identical. The npm package ships the TS-side file; the .NET package embeds the .NET-side file as a resource. To prevent drift, `parity/check-skill.ts` reads BOTH source files from disk and diffs them BEFORE the HTTP step — a mismatch fails the parity run with a clear "source files diverged; copy <a> to <b>" message. (Pure file-tree drift, no backend startup needed for the source-diff check; the HTTP step is separate and runs after.) The executor MAY use a build-time copy step (`<Target>` in the .csproj that copies the npm file before embedding) if it reads cleaner — but the locked safety net is the parity diff, not the build-time copy.

**TS helper plumbing (Task 2).** `createAgentSkillHandler` is exported from `viewmodel-shell/src/server.ts` alongside `createAction` / `shellRedirect` etc. The function signature:
```ts
export function createAgentSkillHandler(opts?: { appPreamble?: string }): (req: Request) => Response;
```
Implementation loads the canonical markdown at module init. The simplest portable approach is `readFileSync` against a path resolved relative to the module file:
```ts
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const CANONICAL_SKILL = readFileSync(join(__dirname, "..", "agent-skill.md"), "utf8");
```
Note: `dist/server.js` ends up one dir above the package root (under `dist/`), so the `..` resolves correctly to `viewmodel-shell/agent-skill.md` at the installed-package location. Verify the npm `files` array in `package.json` includes `agent-skill.md` so the file ships in the published tarball (see Task 7). The handler accepts any HTTP method (the helper is path-mounted by the caller; method routing is the app's responsibility) — for GET it returns 200; the handler does not respond to non-GET differently because the application's router already routes on method. Keep the handler shape minimal: `(req) => Response` so it composes with `Bun.serve` / Hono / Deno trivially.

**.NET helper plumbing (Task 4).** `AgentSkill.cs` lives in the package root next to `ViewModels.cs`. The csproj embeds `AgentSkill.md` via:
```xml
<ItemGroup>
  <EmbeddedResource Include="AgentSkill.md" LogicalName="AshleyShrok.ViewModelShell.AgentSkill.md" />
</ItemGroup>
```
The extension class lives under namespace `ViewModelShell`:
```csharp
public static class AgentSkillExtensions
{
    public static IEndpointRouteBuilder MapVmsAgentSkill(
        this IEndpointRouteBuilder endpoints,
        string path = "/.well-known/vms-skill.md",
        string? appPreamble = null)
    {
        // Resolve canonical body ONCE at mount time (fail-loud per AGENTS.md
        // capability-seam rule: a missing embedded resource is a setup bug, not
        // a per-request runtime condition — surface it at startup).
        string canonical = LoadCanonical();           // throws InvalidOperationException if absent
        string body = string.IsNullOrEmpty(appPreamble)
            ? canonical
            : $"## App-specific notes\n\n{appPreamble}\n\n---\n\n{canonical}";
        endpoints.MapGet(path, (HttpContext ctx) =>
        {
            ctx.Response.ContentType = "text/markdown; charset=utf-8";
            return ctx.Response.WriteAsync(body);
        });
        return endpoints;
    }
}
```
`LoadCanonical()` uses `typeof(AgentSkillExtensions).Assembly.GetManifestResourceStream("AshleyShrok.ViewModelShell.AgentSkill.md")` and throws `InvalidOperationException` with a clear "expected embedded resource 'AshleyShrok.ViewModelShell.AgentSkill.md'; did the build embed it?" message if the stream is null. The fail-loud rule from AGENTS.md ("capability that has no safe core default") applies: a silently-404'd skill endpoint would defeat the purpose. The body is computed ONCE at mount (not per request) so the per-request cost is just an `await Response.WriteAsync`. The `IEndpointRouteBuilder` extension is the modern minimal-API surface used by `MapControllers` / `MapGet`; no MVC dependency is needed (the existing `Microsoft.AspNetCore.App` framework reference covers it).

**Meta-tag extension (Task 5).** The four HelpDesk HTML files in `demo/HelpDesk/frontend/` are:
- `agent.html`, `requester.html` — currently carry `<meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/<x>","actionEndpoint":"/api/<x>/action"}'>`
- `index.html` (chooser landing page) — does NOT carry the meta tag per AGENTS.md convention (no shell mount).

Update agent.html and requester.html to add a `skill` field:
```html
<meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/agent","actionEndpoint":"/api/agent/action","skill":"/.well-known/vms-skill.md"}'>
```
Both demos serve from the same origin (the .NET HelpDesk app at one port; the bun twin at another), so the skill URL is relative-absolute — the same string works for both backends since they both mount the skill at the same path.

**Per-app preamble for HelpDesk (Tasks 3, 5).** The HelpDesk preamble names the domain in 1-2 sentences. Recommended text (use VERBATIM in both .NET and bun mounts to keep the parity diff byte-clean):
```
This is a help-desk ticketing app. Two roles share one SQLite DB: requesters create tickets at `/api/requester`; agents act on them at `/api/agent`. State holds the current view (queue / detail), the active filter, and per-row selection — see each controller's bind paths in the rendered tree.
```
Both backends embed this string LITERALLY in their mount call. The parity check then asserts the served body contains this substring on both backends (sanity check that `appPreamble` plumbing fires symmetrically).

**Parity gate plumbing (Task 6).** `parity/check-skill.ts` is a standalone Bun/Node script invoked from `parity/run.ts` AFTER the JSON-fixture sweep. Two phases:
  1. **Source-tree diff**: `readFileSync` `viewmodel-shell/agent-skill.md` AND `viewmodel-shell-dotnet/AgentSkill.md`; if their bytes differ, throw with a clear "source skill files diverged — copy <a> to <b> to fix" message. This is the cheap pre-check; it runs without any backend startup.
  2. **HTTP twin check**: leverage the existing `dotnet-helpdesk` + `bun-helpdesk` backends already running in the parity harness (their startup is handled by `parity/run.ts`). GET `${baseUrl}/.well-known/vms-skill.md` from each; assert status 200, Content-Type starts with `text/markdown`, bodies are byte-identical, body contains the HelpDesk preamble substring (sanity check appPreamble plumbing on both backends).

The simplest plumbing: `parity/run.ts` already has the orchestration to spin up + tear down backends. Add a phase between the existing fixture-diff loop and the cleanup step: after the JSON fixtures pass, call `await checkSkill(processes, manifest)` where `checkSkill` is exported from `./check-skill.ts`. The function does both the source-diff (phase 1, no backend dependency) and the HTTP twin check (phase 2, against the already-running HelpDesk backends, identified by name from `backends.json`). Backends not named `dotnet-helpdesk` or `bun-helpdesk` are skipped — this is HelpDesk-specific coverage as locked by task-summary decision 6.

Source-tree diff failure mode: print the byte-position of first divergence (helps the operator see whether it's a trailing-newline issue or a content drift); exit non-zero.
HTTP failure mode: print status + content-type + first 200 bytes of each backend's body for triage; exit non-zero.

**TS test plumbing (Task 2 cont.).** `viewmodel-shell/test/agent-skill.test.ts` exercises the TS helper without standing up a backend. Use vitest's standard import. Test cases:
- No preamble: handler returns a `Response`; `await res.text()` matches the literal contents of `viewmodel-shell/agent-skill.md` (read via `readFileSync` in the test for the comparison).
- With preamble "hello world": served body starts with `## App-specific notes\n\nhello world\n\n---\n\n` followed by the canonical body.
- Content-Type header is `text/markdown; charset=utf-8`.
- Status is 200.
- Multiple invocations of the handler return the SAME byte content (no per-request mutation; body cached at handler creation).

**.NET test plumbing (Task 4 cont.).** Tests live in `viewmodel-shell-dotnet/Tests/AgentSkillTests.cs`. The simplest test setup uses ASP.NET's `WebApplicationFactory<TEntryPoint>` OR — to keep dependencies minimal and mirror the existing `ShellExceptionFilterTests` pattern — direct invocation of `MapVmsAgentSkill` against an in-process `WebApplication.CreateBuilder` builder. The xUnit facts:
- `MapVmsAgentSkill_DefaultPath_Returns200WithCanonicalBody` — mount via `app.MapVmsAgentSkill()`; `TestServer.CreateClient().GetAsync("/.well-known/vms-skill.md")` returns 200; body matches the embedded resource bytes verbatim (load via `Assembly.GetManifestResourceStream` in the test to compare).
- `MapVmsAgentSkill_CustomPath_Returns200` — mount via `app.MapVmsAgentSkill("/my-skill.md")`; GET the custom path returns 200; GET the default path returns 404.
- `MapVmsAgentSkill_WithPreamble_PrependsPreambleAndSeparator` — mount with `appPreamble: "test preamble"`; body starts with `## App-specific notes\n\ntest preamble\n\n---\n\n` followed by canonical bytes.
- `MapVmsAgentSkill_ContentTypeIsTextMarkdown` — assert response Content-Type starts with `text/markdown`.
- `LoadCanonical_MissingResource_Throws` — call `LoadCanonical` directly (make it `internal` and add `InternalsVisibleTo` to Tests OR test it indirectly by constructing a wrapper that points at a different assembly). Asserts `InvalidOperationException` with a recognizable substring. The executor can use the simplest available path — if `InternalsVisibleTo` is not already configured, a direct integration-level test that mounts in a stripped-down configuration where the embedded resource is absent is acceptable. (Edge case: this test may be skipped/`[Fact(Skip="…")]` if the simplest approach hits friction; the fail-loud BEHAVIOR is locked by Task 4's implementation, but the TEST is a nice-to-have, not a release-blocker.)

For minimal-API testing without `WebApplicationFactory`, the executor can use:
```csharp
var builder = WebApplication.CreateBuilder();
builder.WebHost.UseTestServer();
var app = builder.Build();
app.MapVmsAgentSkill(/* ... */);
await app.StartAsync();
var client = app.GetTestClient();
// ... await client.GetAsync(...)
await app.StopAsync();
```
`Microsoft.AspNetCore.TestHost` provides `UseTestServer` and `GetTestClient`. Add that package reference to Tests.csproj if not already present (check first via `grep -n "TestHost\|TestServer" viewmodel-shell-dotnet/Tests/Tests.csproj`).

**HelpDesk demo mount (Task 5).** In `demo/HelpDesk/AspNetCore/Program.cs`:
```csharp
app.MapControllers();
app.MapVmsAgentSkill(appPreamble: "<the HelpDesk preamble verbatim>");
app.MapFallbackToFile("index.html");
```
The mount line goes BETWEEN `MapControllers()` and `MapFallbackToFile("index.html")` so the static-file fallback doesn't shadow it. The fallback only fires for unmatched routes; the explicit `MapGet` from `MapVmsAgentSkill` claims `/.well-known/vms-skill.md` before the fallback runs.

In `demo/HelpDesk-bun/server.ts`, add a route case in the `Bun.serve.fetch` switch BEFORE the `Not Found` return:
```typescript
const skillHandler = createAgentSkillHandler({ appPreamble: "<the HelpDesk preamble verbatim>" });
// inside fetch:
if (url.pathname === "/.well-known/vms-skill.md" && request.method === "GET") {
  return skillHandler(request);
}
```
The handler instance is created OUTSIDE the `fetch` handler (above `Bun.serve(...)`) so the body is built once, not per request.

**AGENTS.md refresh scope (Task 7).** The "Agent discoverability" section at lines ~502-514 gets:
- The stale `viewmodel-shell/0.12` protocol example string corrected to `viewmodel-shell/1.0`. Note in the explanatory paragraph that the protocol token is `viewmodel-shell/<major.minor>` of the wire shape, NOT of the npm package version (the package can be 1.6.0 while the protocol token is 1.0 because the wire shape hasn't broken). This was a latent confusion bug — the example string drifted but the prose didn't.
- A new `skill` meta-tag field documented with one paragraph + a copy-paste example.
- Two short subsections naming the helper APIs: one paragraph on `MapVmsAgentSkill` (.NET) + one paragraph on `createAgentSkillHandler` (TS), each with a one-line code snippet.
- A pointer to the canonical skill source: `viewmodel-shell/agent-skill.md` (npm-side, single source of truth) and `viewmodel-shell-dotnet/AgentSkill.md` (.NET copy; parity-checked against the npm source).
- A note that updating the skill is part of any wire-affecting change (the same rule as the maintainer comment on `ViewModels.cs` for JsonIgnore-on-nullable — make it a stable maintainer-rule sentence).

The section structure: keep the existing prose intro about why the meta tag exists, fix the broken `0.12` → `1.0` example, append the `skill` paragraph + helper API paragraphs as additional subsections under the same "Agent discoverability" heading. Do NOT introduce a new top-level heading — this is one cohesive topic.

**CHANGELOG/MIGRATION entry voice (Task 8).** Mirror the prior phase (260614-bmd) entry style exactly: heading like `## 1.6.0 / 1.5.0 — Canonical agent skill + discoverability endpoint (npm + NuGet)` with a one-paragraph "why" intro, `### Added` listing all new surface (the skill markdown file, both helper APIs, the `skill` meta field, the parity gate, the HelpDesk demo mount), `### Demo migration` naming the HelpDesk twins that picked up the mount, `### Tests` naming the new vitest + xUnit suites and the parity check, `### Consumers` noting "additive — nothing required." The MIGRATION entry follows the same template: header, version table, what-changed, "consumer action required: none," not-breaking, opt-in mount snippet (one .NET + one TS), and a "what's new at the meta-tag level" note.

**Decision NOT to update every demo (locked).** Only HelpDesk gets the mount. AGENTS.md will note that future demos can adopt the pattern; the goal of this plan is to prove the pattern + create the parity surface, not to roll out the mount across every demo.

**Decision NOT to add a JSON-Schema response envelope (locked, deferred).** Out of scope per task-summary. The skill is markdown-only; a future plan can layer a JSON-Schema response definition on top if the framework grows in that direction.

**Decision NOT to auto-derive the skill URL from the action endpoint (locked, rejected).** Explicit advertising via the meta tag's `skill` field is preferred. A consuming agent reads the meta tag once; auto-derivation would force per-app-specific guessing.

**Decision NOT to ship a per-action runbook generation feature (locked, out of scope).** The skill is the protocol manual. Per-action narration would belong on individual action handlers via a separate mechanism (future plan).

**Decision NOT to build a vms-tui or non-browser adapter that consumes the skill (locked, out of scope).** The skill is for OUTSIDE agents, not for shipping a new client. The existing TUI adapter is unchanged.

Wire shape of the new optional `skill` meta-tag field (the canonical example agents will paste from):
```html
<meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/agent","actionEndpoint":"/api/agent/action","skill":"/.well-known/vms-skill.md"}'>
```
The `skill` field is OPTIONAL. Omitting it = pre-1.6.0 behavior. New agents check for it and fetch the skill if present; old agents ignore the unknown field.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Write the canonical agent-skill.md (single source of truth + .NET twin copy)</name>
  <files>viewmodel-shell/agent-skill.md, viewmodel-shell-dotnet/AgentSkill.md</files>
  <action>
Write `viewmodel-shell/agent-skill.md` per the locked content scope in `<interfaces>` above (11 sections a-k, in order). Tone: imperative, operational, no marketing, no framework history. Concrete byte targets: aim for 1500-3000 bytes (roughly 1-3 pages rendered). Open with a level-1 heading `# ViewModel Shell — agent operating manual`. Each section is a level-2 heading matching the bullet list (a → `## What this is`, b → `## Endpoints`, etc.). Use fenced JSON code blocks for the wire-shape examples in sections c, e, f. Inline-code the field names (`ok`, `state`, `bind`, `nextPollIn`). The closing section k cites the protocol token `viewmodel-shell/1.0` explicitly and notes that a future major-version bump invalidates this skill.

After writing the canonical file, copy it byte-for-byte to `viewmodel-shell-dotnet/AgentSkill.md` (this is the .NET twin — kept byte-identical by the parity gate added in Task 6). The simplest reliable copy: `cp viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md` (or use the `Read` tool to read all bytes then `Write` to the destination). Verify byte-identity with `diff viewmodel-shell/agent-skill.md viewmodel-shell-dotnet/AgentSkill.md` — must print nothing.

Per AGENTS.md "Working agreement for agents": commit ONE atomic commit for this task: `feat(260614-hey): write canonical agent skill markdown (TS + .NET twin)`.
  </action>
  <verify>
    <automated>diff /home/ubuntu/ViewModelShell/viewmodel-shell/agent-skill.md /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet/AgentSkill.md &amp;&amp; test $(wc -c &lt; /home/ubuntu/ViewModelShell/viewmodel-shell/agent-skill.md) -gt 1500</automated>
  </verify>
  <done>`viewmodel-shell/agent-skill.md` exists, contains all 11 sections (a-k) in order, &gt;1500 bytes, cites `viewmodel-shell/1.0` protocol token; `viewmodel-shell-dotnet/AgentSkill.md` exists and is byte-identical to the TS-side file (verified by `diff` exiting 0).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: TS helper `createAgentSkillHandler` + vitest suite</name>
  <files>viewmodel-shell/src/server.ts, viewmodel-shell/test/agent-skill.test.ts</files>
  <behavior>
    - Add `createAgentSkillHandler` to `viewmodel-shell/src/server.ts`. Suggested placement: immediately after the `shellSideEffect` factory block (line ~457-475) and before the `BadRequestError` class (line ~482) — that's where the response-construction helpers live. The function signature:
      ```ts
      export function createAgentSkillHandler(opts?: { appPreamble?: string }): (req: Request) => Response;
      ```
    - At module init (top of `server.ts`, after the imports and the `export *` line at line 28), load the canonical markdown via:
      ```ts
      import { readFileSync } from "node:fs";
      import { fileURLToPath } from "node:url";
      import { dirname, join } from "node:path";
      const __agentSkillDir = dirname(fileURLToPath(import.meta.url));
      const AGENT_SKILL_MARKDOWN = readFileSync(join(__agentSkillDir, "..", "agent-skill.md"), "utf8");
      ```
      Rationale: `dist/server.js` resolves to `<package>/dist/server.js`; `..` resolves to `<package>/`, and `agent-skill.md` ships at `<package>/agent-skill.md` (per the `files` array updated in Task 7). At dev time (running `vitest` from `viewmodel-shell/`), `src/server.ts` resolves to `viewmodel-shell/src/server.ts`; `..` resolves to `viewmodel-shell/`, and the canonical file lives at `viewmodel-shell/agent-skill.md`. Both layouts work.
    - Body construction (computed ONCE at handler creation, NOT per request):
      ```ts
      export function createAgentSkillHandler(opts: { appPreamble?: string } = {}): (req: Request) => Response {
        const preamble = opts.appPreamble?.trim();
        const body = preamble
          ? `## App-specific notes\n\n${preamble}\n\n---\n\n${AGENT_SKILL_MARKDOWN}`
          : AGENT_SKILL_MARKDOWN;
        return (_req: Request) => new Response(body, {
          status: 200,
          headers: { "Content-Type": "text/markdown; charset=utf-8" },
        });
      }
      ```
      The `_req` parameter is unused — the handler is stateless; the application's router is responsible for method-routing (typically `GET`) and path-matching.
    - Add a JSDoc block above the function naming: (a) the canonical skill path `viewmodel-shell/agent-skill.md`, (b) the recommended well-known URL `/.well-known/vms-skill.md`, (c) the `appPreamble` shape (prepended under `## App-specific notes` heading with `---` separator), (d) the cross-runtime guarantees (works in Bun, Deno, Node, Workers — pure Web Fetch types), (e) a mention that the body is cached at creation, so multiple `createAgentSkillHandler` calls with different preambles are cheap and independent.
    - Tests (`viewmodel-shell/test/agent-skill.test.ts`): create a new vitest file with these cases:
      - `returns 200 with text/markdown content-type` — handler() returns a Response; status === 200; headers.get("content-type") starts with "text/markdown"
      - `serves canonical body verbatim when no preamble` — body === the literal contents of `viewmodel-shell/agent-skill.md` (read via readFileSync in the test for comparison)
      - `prepends preamble under App-specific notes heading with separator` — handler with `appPreamble: "test preamble"` returns body starting with `## App-specific notes\n\ntest preamble\n\n---\n\n` and ending with the canonical body
      - `treats empty/whitespace-only preamble as no preamble` — `appPreamble: "   "` returns the canonical body verbatim (trim → empty)
      - `is idempotent across multiple invocations` — calling the returned handler twice returns Responses with identical bytes (body is cached at handler creation)
      - `two handlers with different preambles are independent` — create two handlers with different preambles; each serves its own body; they don't share state
  </behavior>
  <action>Implement per `<behavior>`. Read `viewmodel-shell/src/server.ts` lines 440-510 first to find the natural placement for the new function. Verify the readFileSync path resolution by running a one-off `node --input-type=module -e "import {fileURLToPath} from 'node:url'; import {dirname,join} from 'node:path'; console.log(join(dirname(fileURLToPath('file:///home/ubuntu/ViewModelShell/viewmodel-shell/src/server.ts')), '..', 'agent-skill.md'))"` and confirm the printed path matches `/home/ubuntu/ViewModelShell/viewmodel-shell/agent-skill.md`. Write the test file mirroring the scaffolding pattern from `viewmodel-shell/test/section-link.test.ts` (or another existing test — read one for the import boilerplate). Run `npx tsc --noEmit` to confirm types, then `npx vitest run test/agent-skill.test.ts`. Commit: `feat(260614-hey): createAgentSkillHandler + vitest suite (TS)`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell &amp;&amp; npx tsc --noEmit &amp;&amp; npx vitest run test/agent-skill.test.ts</automated>
  </verify>
  <done>`createAgentSkillHandler` exported from `viewmodel-shell/src/server.ts`; `AGENT_SKILL_MARKDOWN` module-init constant loads `viewmodel-shell/agent-skill.md` via readFileSync; new vitest suite passes all 6 cases; full `npx vitest run` stays green; `npx tsc --noEmit` clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: .NET helper `MapVmsAgentSkill` + embedded resource wiring + xUnit suite</name>
  <files>viewmodel-shell-dotnet/AgentSkill.cs, viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj, viewmodel-shell-dotnet/Tests/AgentSkillTests.cs, viewmodel-shell-dotnet/Tests/Tests.csproj</files>
  <behavior>
    - Create `viewmodel-shell-dotnet/AgentSkill.cs` next to `ViewModels.cs`. Under namespace `ViewModelShell`. The full surface:
      ```csharp
      namespace ViewModelShell;

      using System.Reflection;
      using Microsoft.AspNetCore.Builder;
      using Microsoft.AspNetCore.Http;
      using Microsoft.AspNetCore.Routing;

      public static class AgentSkillExtensions
      {
          private const string EmbeddedResourceName = "AshleyShrok.ViewModelShell.AgentSkill.md";

          /// <summary>
          /// Mount the canonical VMS agent skill markdown at <paramref name="path"/>.
          /// The skill is a self-contained operating manual for the VMS wire protocol;
          /// advertise it to agents via the <c>skill</c> field on the
          /// <c>&lt;meta name="viewmodel-shell"&gt;</c> tag.
          /// </summary>
          /// <param name="endpoints">The endpoint route builder (typically <c>app</c> in Program.cs).</param>
          /// <param name="path">Well-known URL the skill is served at. Default <c>/.well-known/vms-skill.md</c>.</param>
          /// <param name="appPreamble">Optional app-specific context prepended above the canonical skill under a <c>## App-specific notes</c> heading with an <c>---</c> separator. Useful for naming the app's domain, auth requirements, or anything an agent should know before reading the canonical protocol manual.</param>
          /// <returns>The same endpoint builder for fluent chaining.</returns>
          /// <exception cref="InvalidOperationException">Thrown at mount time (not first request) if the embedded resource <c>AshleyShrok.ViewModelShell.AgentSkill.md</c> is absent from the assembly — typically a build-system misconfiguration.</exception>
          public static IEndpointRouteBuilder MapVmsAgentSkill(
              this IEndpointRouteBuilder endpoints,
              string path = "/.well-known/vms-skill.md",
              string? appPreamble = null)
          {
              string canonical = LoadCanonical();
              string preamble = appPreamble?.Trim() ?? "";
              string body = preamble.Length == 0
                  ? canonical
                  : $"## App-specific notes\n\n{preamble}\n\n---\n\n{canonical}";

              endpoints.MapGet(path, async (HttpContext ctx) =>
              {
                  ctx.Response.ContentType = "text/markdown; charset=utf-8";
                  await ctx.Response.WriteAsync(body);
              });
              return endpoints;
          }

          internal static string LoadCanonical()
          {
              Assembly asm = typeof(AgentSkillExtensions).Assembly;
              using Stream? stream = asm.GetManifestResourceStream(EmbeddedResourceName);
              if (stream is null)
              {
                  throw new InvalidOperationException(
                      $"Expected embedded resource '{EmbeddedResourceName}' in assembly '{asm.GetName().Name}'. " +
                      "AgentSkill.md must be embedded as a logical resource by AshleyShrok.ViewModelShell.csproj. " +
                      "This is a build-system misconfiguration; the published NuGet package always embeds it.");
              }
              using StreamReader reader = new(stream);
              return reader.ReadToEnd();
          }
      }
      ```
    - In `viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`, add a new `<ItemGroup>` block embedding the markdown:
      ```xml
      <ItemGroup>
        <EmbeddedResource Include="AgentSkill.md" LogicalName="AshleyShrok.ViewModelShell.AgentSkill.md" />
      </ItemGroup>
      ```
      Place this between the existing `<ItemGroup>` for `README.md` Pack=true (line ~38-40) and the Tests-exclusion `<ItemGroup>` (line ~46-49). The `LogicalName` attribute is REQUIRED so the embedded resource's manifest name matches what `GetManifestResourceStream` queries — without it, the auto-generated name would include the project's root-namespace folder structure and be brittle.
    - Bump `<Version>1.4.0</Version>` → `<Version>1.5.0</Version>` in the same csproj edit. (This is the .NET-side lockstep bump; the npm bump happens in Task 7.)
    - Tests (`viewmodel-shell-dotnet/Tests/AgentSkillTests.cs`):
      First check if `Microsoft.AspNetCore.TestHost` is already referenced by Tests.csproj: `grep -n "TestHost" viewmodel-shell-dotnet/Tests/Tests.csproj`. If absent, add `<PackageReference Include="Microsoft.AspNetCore.TestHost" Version="8.0.*" />` to Tests.csproj (the version range matches the `<TargetFramework>net8.0</TargetFramework>` already in the project).
      Test class structure (mirror `ShellExceptionFilterTests.cs` for namespace and imports):
      ```csharp
      namespace ViewModelShell.Tests;

      using Microsoft.AspNetCore.Builder;
      using Microsoft.AspNetCore.Hosting;
      using Microsoft.AspNetCore.TestHost;
      using Microsoft.Extensions.DependencyInjection;
      using Microsoft.Extensions.Hosting;

      public class AgentSkillTests
      {
          private static async Task<(HttpClient client, IHost host)> StartHostAsync(
              Action<IEndpointRouteBuilder> configure)
          {
              var builder = new HostBuilder()
                  .ConfigureWebHost(webHost =>
                  {
                      webHost.UseTestServer();
                      webHost.Configure(app =>
                      {
                          app.UseRouting();
                          app.UseEndpoints(configure);
                      });
                  });
              var host = await builder.StartAsync();
              return (host.GetTestClient(), host);
          }
          // ... facts
      }
      ```
      xUnit facts:
      - `MapVmsAgentSkill_DefaultPath_Returns200WithCanonicalBody` — mount via `endpoints.MapVmsAgentSkill()`; GET `/.well-known/vms-skill.md` returns 200; body bytes match the embedded resource read directly via `Assembly.GetManifestResourceStream("AshleyShrok.ViewModelShell.AgentSkill.md")`.
      - `MapVmsAgentSkill_CustomPath_Returns200` — mount via `endpoints.MapVmsAgentSkill("/my-skill.md")`; GET `/my-skill.md` returns 200; GET `/.well-known/vms-skill.md` returns 404.
      - `MapVmsAgentSkill_WithPreamble_PrependsPreambleAndSeparator` — mount with `appPreamble: "test preamble"`; body starts with `"## App-specific notes\n\ntest preamble\n\n---\n\n"` followed by the canonical body verbatim.
      - `MapVmsAgentSkill_ContentTypeIsTextMarkdown` — assert `response.Content.Headers.ContentType?.MediaType == "text/markdown"` and charset is utf-8.
      - `MapVmsAgentSkill_EmptyPreamble_OmitsHeader` — mount with `appPreamble: "   "` (whitespace-only); body equals the canonical body verbatim (Trim → empty → no heading).
      - `LoadCanonical_RealAssembly_ReturnsNonEmpty` — direct call to `AgentSkillExtensions.LoadCanonical()` (accessible because Tests project ProjectReferences the package and `LoadCanonical` is `internal`; add `[assembly: InternalsVisibleTo("Tests")]` to `AshleyShrok.ViewModelShell.csproj` via `<ItemGroup><InternalsVisibleTo Include="Tests" /></ItemGroup>` — modern SDK supports this MSBuild item directly without an AssemblyInfo.cs). Asserts the returned string is non-empty and contains the `viewmodel-shell/1.0` protocol token (proves the embedded resource is the real canonical skill).
      - `LoadCanonical_MissingResource_Throws` — OPTIONAL (mark `[Fact(Skip = "Requires assembly without AgentSkill.md embedded; covered by integration-level smoke")]` if direct construction is awkward). The fail-loud behavior is locked by the implementation; the test is a nice-to-have. If the executor finds a clean path (e.g. invoking `GetManifestResourceStream` against `typeof(string).Assembly` to simulate "wrong assembly"), include it; otherwise skip with the comment above.
    - Build sanity: `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj -c Release` succeeds. The build output `bin/Release/AshleyShrok.ViewModelShell.dll` MUST contain the embedded resource; verify with `dotnet ildasm` is overkill — instead inspect via `unzip -l bin/Release/AshleyShrok.ViewModelShell.1.5.0.nupkg | grep -i agentskill` after a `dotnet pack` (Task 9-style verification, but Task 3's done criterion can be the simpler `dotnet build` + the LoadCanonical_RealAssembly fact passing).
  </behavior>
  <action>Implement per `<behavior>`. Create `AgentSkill.cs` and the new csproj `<ItemGroup>` first. Run `dotnet build viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj -c Release` to confirm the embedded resource compiles in. Then create the Tests file (add the TestHost package ref to Tests.csproj if missing — `grep` first to check). Add the `InternalsVisibleTo` MSBuild item to AshleyShrok.ViewModelShell.csproj so the Tests can reach `LoadCanonical`. Run `dotnet test viewmodel-shell-dotnet/Tests/Tests.csproj --filter "FullyQualifiedName~AgentSkillTests"` to confirm. Commit: `feat(260614-hey): MapVmsAgentSkill + embedded AgentSkill.md + xUnit suite (.NET)`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet &amp;&amp; dotnet build AshleyShrok.ViewModelShell.csproj -c Release &amp;&amp; cd Tests &amp;&amp; dotnet test Tests.csproj --filter "FullyQualifiedName~AgentSkillTests"</automated>
  </verify>
  <done>`AgentSkill.cs` exists with `MapVmsAgentSkill` extension + `LoadCanonical` internal helper; csproj embeds `AgentSkill.md` with explicit `LogicalName`; csproj `<Version>` bumped to 1.5.0; `InternalsVisibleTo("Tests")` set so the LoadCanonical fact compiles; Tests.csproj has Microsoft.AspNetCore.TestHost reference; all six (or seven counting the optional skipped fact) AgentSkillTests pass; `dotnet build` is warning-clean.</done>
</task>

<task type="auto">
  <name>Task 4: HelpDesk demo mounts skill endpoint + meta-tag `skill` field (both twins)</name>
  <files>demo/HelpDesk/AspNetCore/Program.cs, demo/HelpDesk-bun/server.ts, demo/HelpDesk/frontend/agent.html, demo/HelpDesk/frontend/requester.html</files>
  <action>
The HelpDesk preamble string (use VERBATIM in both backends — byte-equal preamble = byte-equal served body = clean parity diff):
```
This is a help-desk ticketing app. Two roles share one SQLite DB: requesters create tickets at `/api/requester`; agents act on them at `/api/agent`. State holds the current view (queue / detail), the active filter, and per-row selection — see each controller's bind paths in the rendered tree.
```

1. `demo/HelpDesk/AspNetCore/Program.cs`: add `using ViewModelShell;` at the top if not already imported. Insert `app.MapVmsAgentSkill(appPreamble: "<preamble verbatim above>");` between `app.MapControllers();` (line 27) and `app.MapFallbackToFile("index.html");` (line 29). Use a C# verbatim string literal (`@"..."`) or interpolated string — match the existing code style (the file is short; pick whichever reads cleanest). The preamble contains backticks; in a non-verbatim string they're fine, but in a verbatim string the only escaped char is `""` for embedded quote. No quote chars in the preamble, so verbatim is simplest:
   ```csharp
   app.MapVmsAgentSkill(appPreamble: @"This is a help-desk ticketing app. Two roles share one SQLite DB: requesters create tickets at `/api/requester`; agents act on them at `/api/agent`. State holds the current view (queue / detail), the active filter, and per-row selection — see each controller's bind paths in the rendered tree.");
   ```

2. `demo/HelpDesk-bun/server.ts`: add `createAgentSkillHandler` to the imports from `@ashley-shrok/viewmodel-shell/server` at line 22-28 (sibling of `createAction`, `UnknownActionError`, etc.). Create the handler instance ONCE above the `Bun.serve(...)` call (around line 868, before `const port = ...` or just after it; before `Bun.serve(...)`):
   ```typescript
   const skillHandler = createAgentSkillHandler({
     appPreamble: "This is a help-desk ticketing app. Two roles share one SQLite DB: requesters create tickets at `/api/requester`; agents act on them at `/api/agent`. State holds the current view (queue / detail), the active filter, and per-row selection — see each controller's bind paths in the rendered tree.",
   });
   ```
   Inside `Bun.serve`'s `fetch` handler, add a route case BEFORE the `return new Response("Not Found", { status: 404 });`:
   ```typescript
   if (url.pathname === "/.well-known/vms-skill.md" && request.method === "GET") {
     return skillHandler(request);
   }
   ```

3. `demo/HelpDesk/frontend/agent.html` (line 8) — change:
   ```html
   <meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/agent","actionEndpoint":"/api/agent/action"}'>
   ```
   to:
   ```html
   <meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/agent","actionEndpoint":"/api/agent/action","skill":"/.well-known/vms-skill.md"}'>
   ```

4. `demo/HelpDesk/frontend/requester.html` (line 8) — same edit pattern, just replace `/api/agent` with `/api/requester` per the existing content.

5. Verify the .NET build still works: `cd /home/ubuntu/ViewModelShell/demo/HelpDesk/AspNetCore && dotnet build`. The build must produce zero warnings and the `using ViewModelShell;` resolves the extension method (it lives in that namespace per Task 3).

6. Verify the bun side still type-checks: `cd /home/ubuntu/ViewModelShell/demo/HelpDesk-bun && bun tsc --noEmit` (or whatever the existing pre-flight type-check is — `grep "tsc" demo/HelpDesk-bun/package.json` to find it; if there's no script, `npx tsc --noEmit` against `tsconfig.json` works).

Per AGENTS.md "Working agreement for agents": commit ONE atomic commit. The bun side imports a function from `@ashley-shrok/viewmodel-shell/server` — that function won't exist in the published package until 1.6.0 is released, BUT the demo links against the local repo via the `bun link` mechanism (see prior-phase Task 5 notes referencing `bun link`). The executor should mirror the prior phase's pattern: if `cd /home/ubuntu/ViewModelShell/demo/HelpDesk-bun && bun install` fails because `@ashley-shrok/viewmodel-shell` isn't linked, run `cd /home/ubuntu/ViewModelShell/viewmodel-shell && bun link` then `cd /home/ubuntu/ViewModelShell/demo/HelpDesk-bun && bun link @ashley-shrok/viewmodel-shell` to point at the local source. The prior-phase SUMMARY notes a similar dance — read 260614-bmd-SUMMARY.md for the exact replay if needed.

Commit: `feat(260614-hey): HelpDesk demo mounts skill endpoint + meta-tag skill field (both twins)`.
  </action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell/demo/HelpDesk/AspNetCore &amp;&amp; dotnet build --nologo -v minimal &amp;&amp; grep -q '"skill":"/.well-known/vms-skill.md"' /home/ubuntu/ViewModelShell/demo/HelpDesk/frontend/agent.html &amp;&amp; grep -q '"skill":"/.well-known/vms-skill.md"' /home/ubuntu/ViewModelShell/demo/HelpDesk/frontend/requester.html &amp;&amp; grep -q "MapVmsAgentSkill" /home/ubuntu/ViewModelShell/demo/HelpDesk/AspNetCore/Program.cs &amp;&amp; grep -q "createAgentSkillHandler" /home/ubuntu/ViewModelShell/demo/HelpDesk-bun/server.ts</automated>
  </verify>
  <done>HelpDesk .NET Program.cs calls `app.MapVmsAgentSkill(appPreamble: ...)` with the locked preamble string; HelpDesk bun server.ts imports + invokes `createAgentSkillHandler` with the same preamble and serves at `/.well-known/vms-skill.md`; agent.html + requester.html meta tags carry `"skill":"/.well-known/vms-skill.md"` field; .NET build clean; bun side type-checks; both preamble strings are byte-equal.</done>
</task>

<task type="auto">
  <name>Task 5: Parity gate — source-tree diff + HTTP twin check for the skill endpoint</name>
  <files>parity/check-skill.ts, parity/run.ts</files>
  <behavior>
    - Create `parity/check-skill.ts`. The script exports two functions and is invoked by `parity/run.ts` after the JSON-fixture sweep. Structure:
      ```typescript
      // Parity gate for the canonical agent skill. Two phases:
      //   1. Source-tree diff — assert viewmodel-shell/agent-skill.md and viewmodel-shell-dotnet/AgentSkill.md
      //      are byte-identical (catches the .NET twin drifting from the npm source).
      //   2. HTTP twin check — GET /.well-known/vms-skill.md against dotnet-helpdesk + bun-helpdesk; assert
      //      identical bodies, correct content-type, contains the HelpDesk preamble substring.

      import { readFileSync } from "node:fs";
      import { resolve, dirname } from "node:path";
      import { fileURLToPath } from "node:url";

      const __dirname = dirname(fileURLToPath(import.meta.url));

      const TS_SKILL_PATH = resolve(__dirname, "..", "viewmodel-shell", "agent-skill.md");
      const DOTNET_SKILL_PATH = resolve(__dirname, "..", "viewmodel-shell-dotnet", "AgentSkill.md");
      const HELPDESK_PREAMBLE_SUBSTRING = "This is a help-desk ticketing app.";
      const SKILL_URL_PATH = "/.well-known/vms-skill.md";

      export function checkSourceTwins(): void {
        const tsBytes = readFileSync(TS_SKILL_PATH);
        const dotnetBytes = readFileSync(DOTNET_SKILL_PATH);
        if (tsBytes.length !== dotnetBytes.length || !tsBytes.equals(dotnetBytes)) {
          // Find byte-position of first divergence for triage.
          let firstDiff = -1;
          const min = Math.min(tsBytes.length, dotnetBytes.length);
          for (let i = 0; i < min; i++) {
            if (tsBytes[i] !== dotnetBytes[i]) { firstDiff = i; break; }
          }
          throw new Error(
            `Skill source files diverged at byte ${firstDiff === -1 ? "<length mismatch>" : firstDiff}: ` +
            `${TS_SKILL_PATH} (${tsBytes.length}B) vs ${DOTNET_SKILL_PATH} (${dotnetBytes.length}B). ` +
            `Fix: cp ${TS_SKILL_PATH} ${DOTNET_SKILL_PATH}`
          );
        }
        console.log(`  ✓ skill source files byte-identical (${tsBytes.length}B)`);
      }

      export async function checkHttpTwins(baseUrls: { name: string; url: string }[]): Promise<void> {
        const bodies: Array<{ name: string; body: string; contentType: string }> = [];
        for (const b of baseUrls) {
          const res = await fetch(`${b.url}${SKILL_URL_PATH}`);
          if (res.status !== 200) {
            throw new Error(`${b.name} GET ${SKILL_URL_PATH} returned ${res.status} ${res.statusText}`);
          }
          const ct = res.headers.get("content-type") ?? "";
          if (!ct.toLowerCase().startsWith("text/markdown")) {
            throw new Error(`${b.name} GET ${SKILL_URL_PATH} content-type was '${ct}', expected text/markdown*`);
          }
          const body = await res.text();
          if (!body.includes(HELPDESK_PREAMBLE_SUBSTRING)) {
            throw new Error(`${b.name} body missing preamble substring '${HELPDESK_PREAMBLE_SUBSTRING}'`);
          }
          bodies.push({ name: b.name, body, contentType: ct });
        }
        if (bodies.length < 2) return; // single backend → nothing to diff
        const ref = bodies[0]!;
        for (let i = 1; i < bodies.length; i++) {
          const other = bodies[i]!;
          if (other.body !== ref.body) {
            // Show first 200 bytes of each for triage.
            throw new Error(
              `Skill body diverged: ${ref.name} (${ref.body.length}B) vs ${other.name} (${other.body.length}B). ` +
              `\n${ref.name} head: ${JSON.stringify(ref.body.slice(0, 200))}` +
              `\n${other.name} head: ${JSON.stringify(other.body.slice(0, 200))}`
            );
          }
        }
        console.log(`  ✓ skill HTTP twins byte-identical (${ref.body.length}B) across ${bodies.length} backends`);
      }
      ```
    - Modify `parity/run.ts` to invoke the new check. Read `parity/run.ts` end-to-end first (~400 lines) to find the natural seam — the existing structure is: prebuild → start backends in parallel → wait for ready → run each fixture → diff captures → stop backends. Insert the skill check AFTER the fixture-diff loop and BEFORE the backend cleanup. The skill check needs:
      1. Phase 1 (source twins): unconditional — runs regardless of which backends are configured.
      2. Phase 2 (HTTP twins): only the HelpDesk backends. Filter `manifest.backends` to those whose `name` is `dotnet-helpdesk` or `bun-helpdesk`. If both are present, pass `[{ name: b.name, url: b.baseUrl }]` for each to `checkHttpTwins`. If only one or zero present, just run the single backend's check (or skip HTTP twins entirely with a `(skipping — HelpDesk backends not configured)` log line).
    - Concrete insertion (verify exact line numbers via re-read; this is the structural intent):
      ```typescript
      import { checkSourceTwins, checkHttpTwins } from "./check-skill";

      // ... existing main() ...

      // After the fixture-diff loop, before backend teardown:
      console.log("\nSkill parity:");
      checkSourceTwins();
      const helpdeskBackends = manifest.backends.filter(b =>
        b.name === "dotnet-helpdesk" || b.name === "bun-helpdesk"
      );
      if (helpdeskBackends.length > 0) {
        await checkHttpTwins(helpdeskBackends.map(b => ({ name: b.name, url: b.baseUrl })));
      } else {
        console.log("  (skipping HTTP skill twins — HelpDesk backends not configured)");
      }
      ```
    - Any thrown error from either phase propagates to the existing try/catch in `main()`; the harness reports failure + exits non-zero like any other parity break.
    - Run `bun run parity/run.ts` end-to-end. The full run takes ~30-60 seconds because it spins up every backend. The skill checks add maybe 1-2 seconds total.
  </behavior>
  <action>Read `parity/run.ts` end-to-end first to find the exact insertion seam. Create `parity/check-skill.ts` per `<behavior>`. Edit `parity/run.ts` to import + invoke the new functions. Run `bun run parity/run.ts` and confirm both `✓ skill source files byte-identical` AND `✓ skill HTTP twins byte-identical` lines print, AND the existing JSON-fixture sweep still passes. Commit: `feat(260614-hey): parity gate for canonical agent skill + HelpDesk HTTP twins`.</action>
  <verify>
    <automated>cd /home/ubuntu/ViewModelShell &amp;&amp; bun run parity/run.ts</automated>
  </verify>
  <done>`parity/check-skill.ts` exists with `checkSourceTwins` + `checkHttpTwins` exports; `parity/run.ts` imports + invokes them after the JSON-fixture sweep; the full parity run prints both skill-check ✓ lines AND the existing fixture-diff ✓ lines AND exits 0; a deliberate one-byte edit to `viewmodel-shell-dotnet/AgentSkill.md` makes the run fail with the "Fix: cp ..." message (manual smoke check; do NOT commit the broken state).</done>
</task>

<task type="auto">
  <name>Task 6: AGENTS.md "Agent discoverability" refresh + canonical skill source pointer</name>
  <files>AGENTS.md</files>
  <behavior>
    Edit the existing "Agent discoverability" section at lines ~502-514 of `AGENTS.md`. Locked changes:

    1. **Correct the stale protocol example**: in the `<meta>` example at line ~509, replace `"protocol":"viewmodel-shell/0.12"` with `"protocol":"viewmodel-shell/1.0"`. Then update the explanatory paragraph at ~line 512 to clarify that the protocol token is `viewmodel-shell/<major.minor>` of the **wire shape**, NOT of the npm package version — note that as of 1.6.0 / 1.5.0 the wire shape is still at `viewmodel-shell/1.0` because the wire hasn't undergone a breaking change. (The package can be 1.6.0 while protocol is 1.0; the prior wording was ambiguous.)

    2. **Document the new `skill` meta-tag field**: append a paragraph after the existing protocol-token paragraph (~line 512) introducing the optional `skill` field. Example:
       ```
       Agent skill (1.6.0 / 1.5.0): the optional `skill` field on the same meta tag points at a markdown operating manual for the VMS wire protocol. Agents driving the API cold — curl, WebFetch, an LLM reading the page — can `GET` that URL to obtain a self-contained protocol manual (action dispatch shape, state round-trip rules, response envelope vocabulary, side-effect verbs, polling, errors, file uploads). Old agents that don't know about the field simply ignore it; old apps without the field continue to work.

       ```html
       <meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/<x>","actionEndpoint":"/api/<x>/action","skill":"/.well-known/vms-skill.md"}'>
       ```
       ```

    3. **Document both helper APIs** with copy-pasteable snippets. Add a new subsection (still under "Agent discoverability") titled `**Mount the skill endpoint:**`. Two short blocks:
       ```
       .NET (any IEndpointRouteBuilder host):
       ```csharp
       app.MapVmsAgentSkill(appPreamble: "App-specific context for agents.");
       // or with a custom path:
       app.MapVmsAgentSkill("/.well-known/vms-skill.md", appPreamble: "...");
       ```

       TypeScript (Bun/Deno/Hono/Workers — anything Web Fetch native):
       ```typescript
       import { createAgentSkillHandler } from "@ashley-shrok/viewmodel-shell/server";
       const skillHandler = createAgentSkillHandler({ appPreamble: "App-specific context for agents." });
       // mount on /.well-known/vms-skill.md per your router
       ```

       Both helpers serve the canonical skill markdown verbatim (or with an app preamble prepended under a `## App-specific notes` heading + `---` separator) with `Content-Type: text/markdown; charset=utf-8`. The body is built ONCE at mount/handler-creation time, not per request.
       ```

    4. **Point at the canonical skill source**: add a final paragraph naming the source-of-truth file:
       ```
       Canonical skill source: `viewmodel-shell/agent-skill.md` (npm-side, single source of truth). The .NET package embeds a byte-identical copy at `viewmodel-shell-dotnet/AgentSkill.md` as a logical resource; the parity gate in `parity/check-skill.ts` diffs both source files AND the served HTTP bodies on the HelpDesk twins, so the .NET copy cannot silently drift. **Maintainer rule:** any change to the wire shape, response envelope, side-effect verb set, or polling semantics MUST update `viewmodel-shell/agent-skill.md` in the same change, then re-copy to `viewmodel-shell-dotnet/AgentSkill.md`. The parity gate fails the build on drift, so this isn't optional — but updating the skill in the same change is what keeps it useful.
       ```

    Do NOT remove or rewrite the existing prose around the `<meta>` convention rule (the "any new demo page... MUST include this meta" line at ~line 514) — keep that intact; the new content is APPENDED.

    No other section of AGENTS.md should be edited.
  </behavior>
  <action>Read AGENTS.md lines 495-525 to anchor the edit. Use Edit (not Write) with the existing protocol-string `viewmodel-shell/0.12` as the unique anchor for fix #1. Use the existing line `The `protocol` token is `viewmodel-shell/<major.minor>`...` as the unique anchor for the prepend point of changes #2-4. Verify the edit by re-reading the section after and confirming all four changes are in place and no other content was clobbered. Commit: `docs(260614-hey): AGENTS.md Agent discoverability — skill meta field + helper APIs + canonical source pointer`.</action>
  <verify>
    <automated>grep -q '"protocol":"viewmodel-shell/1.0"' /home/ubuntu/ViewModelShell/AGENTS.md &amp;&amp; ! grep -q '"protocol":"viewmodel-shell/0.12"' /home/ubuntu/ViewModelShell/AGENTS.md &amp;&amp; grep -q 'MapVmsAgentSkill' /home/ubuntu/ViewModelShell/AGENTS.md &amp;&amp; grep -q 'createAgentSkillHandler' /home/ubuntu/ViewModelShell/AGENTS.md &amp;&amp; grep -q 'viewmodel-shell/agent-skill.md' /home/ubuntu/ViewModelShell/AGENTS.md</automated>
  </verify>
  <done>AGENTS.md no longer contains the stale `viewmodel-shell/0.12` string; the corrected `viewmodel-shell/1.0` example is present; the new `skill` meta-tag field is documented with rationale; both helper API snippets are present; the canonical-source pointer to `viewmodel-shell/agent-skill.md` + maintainer rule is present; no other section of AGENTS.md was modified.</done>
</task>

<task type="auto">
  <name>Task 7: npm `files` array update + lockstep version bumps + CHANGELOG + MIGRATION</name>
  <files>viewmodel-shell/package.json, CHANGELOG.md, MIGRATION.md</files>
  <behavior>
    1. **`viewmodel-shell/package.json`**:
       - Bump `"version": "1.5.0"` → `"version": "1.6.0"`.
       - Add `"agent-skill.md"` to the `files` array (currently `["dist", "styles", "README.md", "LICENSE"]` → `["dist", "styles", "agent-skill.md", "README.md", "LICENSE"]`). CRITICAL: without this, the file is NOT included in the published npm tarball, and `readFileSync` from `dist/server.js` at runtime in a consumer's `node_modules` will throw ENOENT. Insertion order matches the existing alphabetical-ish grouping (after `styles`).
       - Re-sync `package-lock.json` via `cd viewmodel-shell && npm install --package-lock-only` (mirror the prior phase's lockfile-sync step).
       - The .NET `<Version>` was already bumped in Task 3 (1.4.0 → 1.5.0) — confirm that file is still 1.5.0 (`grep -q '<Version>1.5.0</Version>' viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj`); do not bump again.

    2. **`CHANGELOG.md`** — read lines 1-40 first to match voice exactly (the prior entry is the 1.5.0/1.4.0 entry from 260614-bmd). Prepend a new entry immediately after the `---` separator under the `# Changelog` preamble:
       ```markdown
       ## 1.6.0 / 1.5.0 — Canonical agent skill + discoverability endpoint (npm + NuGet)

       Both packages now ship a canonical markdown operating manual for the VMS wire protocol — the same content an LLM or curl-driven agent would need to drive a VMS app without a browser. A new optional `skill` field on the existing `<meta name="viewmodel-shell">` tag advertises where the skill is served; agents that know about it fetch it for the protocol manual, old agents ignore the unknown field. Mounting the endpoint is a one-liner on either backend.

       ### Added

       - `viewmodel-shell/agent-skill.md` — the canonical agent skill markdown (shipped in the npm `files` array; embedded as a logical resource by the .NET package; byte-identical between the two, parity-gated to prevent drift). Covers: action dispatch shape (JSON + multipart), state round-trip rules + bind paths, response envelope vocabulary (`ok`, `vm`, `state`, `redirect`, `sideEffects`, `nextPollIn`, `busy`, `preventUnload`), side-effect verbs + forward-compat "ignore unknown" rule, error codes, polling cadence, file uploads, protocol versioning. Tone is imperative and operational — the reader is an agent that needs to do work in the next 60 seconds.
       - TypeScript helper `createAgentSkillHandler({appPreamble?})` exported from `@ashley-shrok/viewmodel-shell/server` — returns a Web Fetch `(Request) => Response` handler. Compatible with Bun, Deno, Hono, Cloudflare Workers, Node 18+.
       - .NET helper `AgentSkillExtensions.MapVmsAgentSkill(this IEndpointRouteBuilder, string path = "/.well-known/vms-skill.md", string? appPreamble = null)` — minimal-API endpoint extension; lazily loads the embedded resource at mount time and fails loud at startup if absent.
       - Optional `skill` field on the existing `<meta name="viewmodel-shell">` JSON content. Purely additive: omitting it is the pre-1.6.0 behavior; old apps and old agents both still work.
       - Per-app preamble support: when `appPreamble` is supplied, the served body prepends the preamble under a `## App-specific notes` heading + `---` separator, then the canonical body verbatim. Apps use this to name their domain, auth specifics, or any context an agent should read before the protocol manual.

       ### Demo migration

       - HelpDesk (both .NET twin and bun twin) mounts the skill endpoint at `/.well-known/vms-skill.md` with a short help-desk-specific preamble. Both `agent.html` and `requester.html` meta tags now carry the `skill` field. This is the worked example and the parity surface — `parity/check-skill.ts` GETs the URL from both backends and asserts byte-identical bodies + correct content-type + preamble plumbing.
       - Other demos are unchanged. Future demos can adopt the mount via the one-liner per backend.

       ### Tests

       - New vitest suite `viewmodel-shell/test/agent-skill.test.ts` (6 cases): handler returns 200 + correct content-type; canonical body verbatim when no preamble; preamble prepended under heading with separator; whitespace-only preamble treated as no preamble; idempotent across invocations; independent across handler instances.
       - New xUnit suite `viewmodel-shell-dotnet/Tests/AgentSkillTests.cs` (6 facts + 1 optional skip): default-path 200 + canonical body, custom path 200 + default 404, preamble prepended, content-type text/markdown, empty preamble omits header, `LoadCanonical` returns non-empty + contains protocol token, (optional) missing-resource throws InvalidOperationException.
       - Parity gate: `parity/check-skill.ts` runs after the JSON-fixture sweep — phase 1 diffs the npm + .NET source files byte-for-byte (catches a drifted .NET copy), phase 2 GETs the skill URL from both HelpDesk backends and asserts identical bodies + content-type + preamble substring.

       ### Consumers

       Additive — nothing required. No existing API changed; no existing wire shape changed; old apps without the meta-tag `skill` field continue to work; old agents that don't know about the field continue to work. Consumers that want to advertise a skill mount the helper + add the `skill` field; everyone else upgrades cleanly without code changes.
       ```

    3. **`MIGRATION.md`** — read lines 1-60 first to match voice. Prepend a new entry above the existing 1.5.0/1.4.0 heading:
       ```markdown
       ## Upgrading to `1.6.0` / `1.5.0` (lockstep — npm @ashley-shrok/viewmodel-shell + NuGet AshleyShrok.ViewModelShell)

       | Package | Old | New |
       |---|---|---|
       | `@ashley-shrok/viewmodel-shell` (npm) | 1.5.0 | 1.6.0 |
       | `AshleyShrok.ViewModelShell` (NuGet) | 1.4.0 | 1.5.0 |

       **What changed:** both packages ship a canonical agent skill markdown — a self-contained operating manual for the VMS wire protocol that an external agent (curl, WebFetch, an LLM) can `GET` over HTTP to learn how to drive a VMS app without a browser. New helper APIs (`MapVmsAgentSkill` on .NET, `createAgentSkillHandler` on TS) make mounting the endpoint a one-liner. The existing `<meta name="viewmodel-shell">` discoverability tag gains an optional `skill` field pointing at the served URL.

       **Consumer action required: none.** The skill is additive — apps that don't mount the endpoint and don't add the `skill` field behave exactly as 1.5.0 / 1.4.0. Old agents that don't know about the field ignore it. No wire-shape change.

       ### Not breaking

       - No ViewNode field added or removed.
       - No HTTP response envelope change.
       - No CSS or DOM change.
       - The existing meta-tag JSON content is forward-compatible with the new optional field.

       ### New capability — opt-in mount

       To advertise a skill to agents driving your VMS app:

       **.NET:**
       ```csharp
       app.MapControllers();
       app.MapVmsAgentSkill(appPreamble: "This is a help-desk app. ..."); // optional preamble
       app.MapFallbackToFile("index.html");
       ```

       **TypeScript (Bun shown; same shape for Deno/Hono/Workers):**
       ```typescript
       import { createAgentSkillHandler } from "@ashley-shrok/viewmodel-shell/server";
       const skillHandler = createAgentSkillHandler({ appPreamble: "..." });
       Bun.serve({
         async fetch(req) {
           const url = new URL(req.url);
           if (url.pathname === "/.well-known/vms-skill.md" && req.method === "GET") {
             return skillHandler(req);
           }
           // ... your existing routes
         }
       });
       ```

       Then add the `skill` field to your app's `<meta name="viewmodel-shell">` tag:
       ```html
       <meta name="viewmodel-shell" content='{"protocol":"viewmodel-shell/1.0","endpoint":"/api/x","actionEndpoint":"/api/x/action","skill":"/.well-known/vms-skill.md"}'>
       ```

       Agents that fetch the meta tag will see the skill URL, fetch it, and read the canonical protocol manual — or your preamble prepended above it under a `## App-specific notes` heading.
       ```
    - Both files are append-prepend; existing entries are UNTOUCHED (release-gated rule per AGENTS.md).
  </behavior>
  <action>Bump `version` string in `viewmodel-shell/package.json` and add `agent-skill.md` to the `files` array via `Edit`. Run `cd /home/ubuntu/ViewModelShell/viewmodel-shell && npm install --package-lock-only` to re-sync the lockfile. Confirm the .NET `<Version>` is already 1.5.0 from Task 3 (do NOT re-edit). Read `CHANGELOG.md` lines 1-40 + `MIGRATION.md` lines 1-60 first to match voice exactly. Insert both new entries via `Edit` (anchor on the first `---` separator under the "# Changelog" preamble; anchor on the existing `## Upgrading to '1.5.0' / '1.4.0'` heading in MIGRATION and insert above it). Do NOT touch the existing 1.5.0 / 1.4.0 (or earlier) entries. Commit: `chore(release): viewmodel-shell 1.6.0 / NuGet 1.5.0 — canonical agent skill + discoverability endpoint`.</action>
  <verify>
    <automated>grep -q '"version": "1.6.0"' /home/ubuntu/ViewModelShell/viewmodel-shell/package.json &amp;&amp; grep -q '"agent-skill.md"' /home/ubuntu/ViewModelShell/viewmodel-shell/package.json &amp;&amp; grep -q '<Version>1.5.0</Version>' /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj &amp;&amp; grep -q '1.6.0' /home/ubuntu/ViewModelShell/CHANGELOG.md &amp;&amp; grep -q '1.6.0' /home/ubuntu/ViewModelShell/MIGRATION.md</automated>
  </verify>
  <done>npm bumped 1.5.0 → 1.6.0; `agent-skill.md` added to `files` array; package-lock.json re-synced; .NET `<Version>` confirmed at 1.5.0 (from Task 3, no re-edit); CHANGELOG.md and MIGRATION.md have new 1.6.0/1.5.0 entries citing the skill + helper APIs; old entries untouched.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 8: Publish to npm + NuGet + tag release (OPERATOR-DRIVEN — final step)</name>
  <what-built>
    Tasks 1-7 produced seven atomic commits implementing the canonical agent skill end-to-end: the markdown source-of-truth file (shipped in both packages, byte-identical, parity-gated); the TS + .NET mount helpers with fail-loud missing-resource handling on .NET; the HelpDesk demo twin pair as the worked example + parity surface; the new optional `skill` meta-tag field; the AGENTS.md "Agent discoverability" doc refresh (including fixing the stale `viewmodel-shell/0.12` example string); the parity gate that diffs both source files AND served HTTP bodies; and the lockstep version bumps (npm 1.5.0 → 1.6.0; NuGet 1.4.0 → 1.5.0).

    The code is committed to the current branch and ready to ship, but per AGENTS.md "🚨 A version bump is NOT a release — the registries are. Publishing is mandatory and manual." this final step has to be operator-driven for two reasons:
    1. Publishing requires sourcing `/home/ubuntu/ViewModelShell/.env` for `NPM_TOKEN` and `NUGET_API_KEY`, syncing `~/.npmrc` to the bypass-2FA token, and running `npm publish` + `dotnet nuget push`. The .env values are sensitive and the operator should confirm before the package goes to the global registry.
    2. Tagging the release (`git tag -a v1.6.0 <sha> -m "viewmodel-shell 1.6.0"` + `git push origin v1.6.0`) is part of the release per AGENTS.md; untagged releases break `git checkout v1.6.0`-based backlog recovery and are invisible to anyone browsing tags/releases on GitHub.
  </what-built>
  <how-to-verify>
    Operator runs the publish ritual from AGENTS.md "Conventions for evolving the framework" section. The exact sequence (copy-paste from AGENTS.md, with version strings filled in):

    1. **Credential precheck** (verify .env has both keys, ~/.npmrc is in sync, NUGET_API_KEY sources cleanly):
    ```
    grep -E '^(NPM_TOKEN|NUGET_API_KEY)=' /home/ubuntu/ViewModelShell/.env
    echo "//registry.npmjs.org/:_authToken=$(grep '^NPM_TOKEN=' /home/ubuntu/ViewModelShell/.env | cut -d= -f2- | tr -d \"'\\\"\")" > ~/.npmrc
    chmod 600 ~/.npmrc
    npm whoami  # should print ashley-shrok (E401 here means the .env token is stale — mint a new one before continuing)
    set -a; source /home/ubuntu/ViewModelShell/.env; set +a
    [ -n "$NUGET_API_KEY" ] && echo "NUGET_API_KEY sourced"
    ```

    2. **Publish npm** (1.6.0):
    ```
    cd /home/ubuntu/ViewModelShell/viewmodel-shell
    npm publish
    curl -s https://registry.npmjs.org/@ashley-shrok/viewmodel-shell | python3 -c "import sys,json; print(json.load(sys.stdin)['dist-tags']['latest'])"
    # should print 1.6.0
    ```

    3. **Publish NuGet** (1.5.0):
    ```
    cd /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet
    dotnet pack -c Release
    dotnet nuget push bin/Release/AshleyShrok.ViewModelShell.1.5.0.nupkg --api-key "$NUGET_API_KEY" --source https://api.nuget.org/v3/index.json
    curl -s https://api.nuget.org/v3-flatcontainer/ashleyshrok.viewmodelshell/index.json | python3 -c "import sys,json; print(json.load(sys.stdin)['versions'][-1])"
    # should print 1.5.0
    ```

    **Pre-publish smoke (recommended)**: before `dotnet nuget push`, inspect the produced `.nupkg` to confirm `AgentSkill.md` is embedded:
    ```
    unzip -l /home/ubuntu/ViewModelShell/viewmodel-shell-dotnet/bin/Release/AshleyShrok.ViewModelShell.1.5.0.nupkg | grep -i agentskill
    ```
    Expect: `AshleyShrok.ViewModelShell.dll` (which contains the embedded resource). If the `.dll` is missing or zero bytes, the embed step in the csproj is misconfigured — STOP and fix before pushing.

    Similarly for npm, confirm `agent-skill.md` is in the tarball before pushing:
    ```
    cd /home/ubuntu/ViewModelShell/viewmodel-shell
    npm pack --dry-run | grep agent-skill
    ```
    Expect a line like `agent-skill.md  XXXkB`. If missing, the `files` array fix in Task 7 didn't apply — STOP and re-check.

    4. **Tag the release** (find the release commit sha first — it's Task 7's commit, the `chore(release):` one):
    ```
    cd /home/ubuntu/ViewModelShell
    RELEASE_SHA=$(git log --format=%H --grep="chore(release): viewmodel-shell 1.6.0" -n 1)
    git tag -a v1.6.0 $RELEASE_SHA -m "viewmodel-shell 1.6.0"
    git push origin v1.6.0
    ```

    **Operator confirmation expected before each step**: confirm the .env values are current. Confirm the version strings match what was bumped. Confirm both pre-publish smoke checks (npm pack --dry-run; unzip -l on the .nupkg) show the new files are present. Confirm the registry curl-back shows the new versions before tagging.

    **If `npm whoami` returns E401** at step 1: the .env token is stale. AGENTS.md has the recovery: mint a new Granular Access Token at https://www.npmjs.com/settings/ashley-shrok/tokens (publish scope, 2FA-bypass checkbox TICKED), update `.env`, re-run step 1. Do NOT run `npm login` — it overwrites `~/.npmrc` with a non-bypass session token and breaks publish again.
  </how-to-verify>
  <resume-signal>Type "published" (with both registry confirmations + tag pushed) or "skip publishing" if the operator wants to defer the release.</resume-signal>
</task>

</tasks>

<verification>
After Tasks 1-7 complete (and BEFORE Task 8), run the full project sanity sweep:
- `cd viewmodel-shell && npm run check:core-globals` — core platform-agnosticism guard (server.ts changes add `readFileSync` from `node:fs`, which is allowed in server.ts — the guard is scoped to `src/index.ts` only per AGENTS.md). Sanity check.
- `cd viewmodel-shell && npm run check:aa-contrast` — AA contrast across default + 12 themes (no CSS changes this phase, but the guard should still pass; pure regression check).
- `cd viewmodel-shell && npm run check:theme-byte-identity` — themes haven't drifted.
- `cd viewmodel-shell && npm run check:theme-function` — every theme remains functional.
- `cd viewmodel-shell && npm run check:no-demo-style` — no demo-side CSS regressions.
- `cd viewmodel-shell && npx vitest run` — full TS test suite (prior phase had ~285 cases + 6 new agent-skill cases = ~291 passing).
- `cd viewmodel-shell-dotnet/Tests && dotnet test` — full .NET test suite (prior phase had 60 + 6-7 new AgentSkill facts = ~66-67 passing).
- `bun run parity/run.ts` — cross-backend wire parity AND the new skill parity gate (source-tree diff + HTTP twins). Both must report ✓.
- `npm pack --dry-run` from `viewmodel-shell/` — confirm `agent-skill.md` appears in the tarball file listing. Pre-publish smoke.
- `dotnet pack -c Release` from `viewmodel-shell-dotnet/` then `unzip -l bin/Release/*.nupkg` — confirm `AshleyShrok.ViewModelShell.dll` is present (the embedded resource lives inside the dll; manifest inspection is overkill, but the dll's size jumping by ~the size of `AgentSkill.md` is the cheap proxy).

Task 8 (publishing) is operator-driven and runs AFTER the project sanity sweep + AFTER operator confirms versions match expectations + AFTER both pre-publish smoke checks pass.
</verification>

<success_criteria>
- [ ] `viewmodel-shell/agent-skill.md` exists, byte-identical to `viewmodel-shell-dotnet/AgentSkill.md`, covers all 11 sections (a-k) of the locked content scope, ≥1500 bytes, cites `viewmodel-shell/1.0` protocol token.
- [ ] TS helper `createAgentSkillHandler({appPreamble?})` exported from `viewmodel-shell/src/server.ts`; body built once at handler creation; serves `text/markdown; charset=utf-8`; preamble prepended under `## App-specific notes` heading with `---` separator when supplied.
- [ ] .NET helper `AgentSkillExtensions.MapVmsAgentSkill(IEndpointRouteBuilder, string, string?)` exposed via `using ViewModelShell;`; `AgentSkill.md` embedded as logical resource `AshleyShrok.ViewModelShell.AgentSkill.md`; mount-time fail-loud if embedded resource is missing.
- [ ] Optional `skill` meta-tag field documented and used in HelpDesk's agent.html + requester.html.
- [ ] HelpDesk both twins mount the skill endpoint with byte-equal preamble strings.
- [ ] Parity gate (source-tree diff + HTTP twins) passes; a one-byte edit to `viewmodel-shell-dotnet/AgentSkill.md` produces a clear "Fix: cp ..." error.
- [ ] AGENTS.md "Agent discoverability" section: stale `viewmodel-shell/0.12` example corrected to `viewmodel-shell/1.0`; protocol-token-vs-package-version distinction clarified; new `skill` field documented; both helper APIs shown; canonical-source pointer + maintainer rule added.
- [ ] npm bumped 1.5.0 → 1.6.0; `agent-skill.md` added to `files` array; NuGet bumped 1.4.0 → 1.5.0; package-lock.json re-synced.
- [ ] CHANGELOG.md and MIGRATION.md have new 1.6.0/1.5.0 entries; old entries untouched.
- [ ] No new wire-shape ViewNode field introduced (critical gotcha #8 N/A — confirmed by zero changes to `viewmodel-shell/src/index.ts` and `viewmodel-shell-dotnet/ViewModels.cs`).
- [ ] No `<style>` blocks introduced anywhere (per AGENTS.md "No custom CSS / no hand-rolled TUI layout" rule).
- [ ] Full project sanity sweep passes: vitest, dotnet test, parity/run.ts, all CSS guards green.
- [ ] STATE.md's Quick Tasks table is appended with this task's entry (executor's responsibility per AGENTS.md "no maintained narrative state file" rule — narrative sections untouched).
- [ ] **Task 8 only**: operator publishes to npm + NuGet + pushes the v1.6.0 git tag (or explicitly defers publishing).
</success_criteria>

<output>
Create `.planning/quick/260614-hey-vms-agent-skill-canonical-wire-protocol-/260614-hey-SUMMARY.md` when done. Include:
- Summary of changes per task (1-7)
- Files touched (full paths)
- Test run results: vitest count + .NET test count + parity run output (both source-diff and HTTP-twins ✓ lines)
- Pre-publish smoke results (`npm pack --dry-run | grep agent-skill`; `unzip -l ...nupkg | grep agentskill` or DLL size confirmation)
- Version bump confirmation (npm 1.6.0; NuGet 1.5.0)
- Whether Task 8 (publishing) was completed by the operator or deferred + rationale
- Any deviations from the plan (apply the working-agreement rule — diverge when an instruction contradicts existing patterns; note each deviation explicitly with the reason)
</output>
