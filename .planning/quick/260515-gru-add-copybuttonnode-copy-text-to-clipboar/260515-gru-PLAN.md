---
quick_id: 260515-gru
type: execute
wave: 1
depends_on: []
autonomous: true
files_modified:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell-dotnet/ViewModels.cs
  - viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj
  - viewmodel-shell/package.json
  - viewmodel-shell/package-lock.json
  - demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
  - demo/FeatureProbe-bun/handler.ts
  - parity/fixtures/feature-probe.json
  - viewmodel-shell/test/copy-button.test.ts
  - AGENTS.md
  - CHANGELOG.md

must_haves:
  truths:
    - "CopyButtonNode is in the ViewNode union in index.ts with zero platform-global references"
    - "BrowserAdapter renders a .vms-button element and on click writes node.text to clipboard, swaps label to copiedLabel for ~1.5s then reverts — all adapter-internal, no dispatch"
    - "CopyButtonNode record + [JsonDerivedType] discriminator exist in ViewModels.cs"
    - "npm bumped to 0.3.14, NuGet bumped to 0.3.10"
    - "AGENTS.md node-types table has a copy-button row"
    - "CHANGELOG.md has a 0.3.14 entry (npm 0.3.14, NuGet 0.3.10)"
    - "FeatureProbe (dotnet + bun) both emit a CopyButtonNode and parity fixture exercises it"
    - "vitest copy-button.test.ts: clipboard write fires, ephemeral label swap reverts, graceful no-confirmation on clipboard failure"
    - "npm run check:core-globals exits 0, npx vitest run all-green, bun run parity/run.ts all-green"
    - "npm publish and NuGet push complete; GitHub release tagged v0.3.14"
  artifacts:
    - path: "viewmodel-shell/src/index.ts"
      provides: "CopyButtonNode interface + union member"
    - path: "viewmodel-shell/src/browser.ts"
      provides: "copy-button render branch + clipboard handler"
    - path: "viewmodel-shell-dotnet/ViewModels.cs"
      provides: "CopyButtonNode record + JsonDerivedType discriminator"
    - path: "viewmodel-shell/test/copy-button.test.ts"
      provides: "jsdom adapter tests (3 cases)"
    - path: "parity/fixtures/feature-probe.json"
      provides: "copy-button serialization step"
  key_links:
    - from: "viewmodel-shell/src/browser.ts copy-button case"
      to: "navigator.clipboard.writeText"
      via: "adapter-internal click handler — no dispatch, no onAction call"
    - from: "demo/FeatureProbe/AspNetCore/FeatureProbeController.cs"
      to: "viewmodel-shell-dotnet/ViewModels.cs CopyButtonNode"
      via: "new CopyButtonNode(...) in BuildVm"
    - from: "demo/FeatureProbe-bun/handler.ts"
      to: "ViewNode type: copy-button"
      via: "inline object literal in buildVm"
---

<objective>
Add CopyButtonNode — a pure adapter-side copy-to-clipboard node — across all three lockstep surfaces (TypeScript types, browser renderer, .NET backend), version-bump both packages, add parity coverage, add jsdom unit tests, update docs, and publish.

Purpose: Closes a common UX gap (copy text to clipboard) with zero server round-trips; models the right pattern for adapter-internal interactions that need no wire contract.
Output: npm 0.3.14 + NuGet 0.3.10 published; GitHub release tagged; parity + vitest green.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@AGENTS.md
@viewmodel-shell/src/index.ts
@viewmodel-shell/src/browser.ts
@viewmodel-shell-dotnet/ViewModels.cs
@viewmodel-shell/test/adapter-seam.test.ts
@parity/fixtures/feature-probe.json
@demo/FeatureProbe/AspNetCore/FeatureProbeController.cs
@demo/FeatureProbe-bun/handler.ts
@CHANGELOG.md

<interfaces>
<!-- Key contracts the executor must know without exploring. -->

Current ViewNode union tail (index.ts line 41–56):
```typescript
export type ViewNode =
  | PageNode | SectionNode | ListNode | ListItemNode
  | FormNode | FieldNode | CheckboxNode | ButtonNode
  | TextNode | LinkNode | StatBarNode | TabsNode
  | ProgressNode | ModalNode | TableNode;
```
Add `| CopyButtonNode` at the end of this union.

New interface to add in index.ts (after TableNode, before the Shell section):
```typescript
export interface CopyButtonNode {
  type: "copy-button";
  text: string;
  label?: string;
  copiedLabel?: string;
}
```

browser.ts import line 1 already imports all node type names — add `CopyButtonNode` to the named imports.

browser.ts node() switch (line 154–170) — add:
```typescript
case "copy-button": return this.copyButton(n, parent);
```

New private method for browser.ts (adapter-internal, no `on` parameter):
```typescript
private copyButton(n: CopyButtonNode, parent: HTMLElement): void {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "vms-button";
  btn.textContent = n.label ?? "Copy";
  btn.addEventListener("click", () => {
    const write = navigator.clipboard?.writeText(n.text);
    if (write) {
      write.then(() => {
        btn.textContent = n.copiedLabel ?? "Copied!";
        setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
      }).catch(() => {
        // primary failed — try legacy execCommand fallback
        legacyCopy(n.text)
          ? (() => {
              btn.textContent = n.copiedLabel ?? "Copied!";
              setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
            })()
          : void 0;          // both paths failed: silent, no confirmation
      });
    } else {
      // navigator.clipboard absent — try legacy
      if (legacyCopy(n.text)) {
        btn.textContent = n.copiedLabel ?? "Copied!";
        setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
      }
      // else: silent
    }
  });
  parent.appendChild(btn);
}
```

Helper function (module-level, before the class, in browser.ts):
```typescript
function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
```

C# record + discriminator for ViewModels.cs — add after the existing `[JsonDerivedType(typeof(LinkNode), "link")]` line (line 95) and add a new record after `LinkNode`:
```csharp
[JsonDerivedType(typeof(CopyButtonNode), "copy-button")]
```
```csharp
public record CopyButtonNode(
    string Text,
    string? Label = null,
    string? CopiedLabel = null
) : ViewNode;
```

Wire shape (both backends must emit identically):
```json
{ "type": "copy-button", "text": "some text to copy", "label": "Copy", "copiedLabel": "Copied!" }
```
Null fields omitted by ASP.NET Core's `WhenWritingNull` policy and TypeScript's undefined-omit behavior.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Three-surface type + renderer + .NET record (lockstep)</name>
  <files>
    viewmodel-shell/src/index.ts,
    viewmodel-shell/src/browser.ts,
    viewmodel-shell-dotnet/ViewModels.cs
  </files>
  <action>
    SURFACE 1 — viewmodel-shell/src/index.ts:
    1. Add `CopyButtonNode` interface (text: string, label?: string, copiedLabel?: string, type: "copy-button") after the TableNode interface, before the Shell section comment.
    2. Append `| CopyButtonNode` to the ViewNode union. Zero platform-global references — this file must keep check:core-globals green (no window/document/navigator/etc.). Type only.

    SURFACE 2 — viewmodel-shell/src/browser.ts:
    1. Add `CopyButtonNode` to the named import from "./index.js" at line 1.
    2. Add `case "copy-button": return this.copyButton(n, parent);` to the node() switch (no `on` argument — this node is purely adapter-internal, no dispatch).
    3. Add the module-level `legacyCopy(text: string): boolean` helper function before the BrowserAdapter class (uses document.createElement("textarea") + execCommand — belongs in browser.ts, not index.ts).
    4. Add the `private copyButton(n: CopyButtonNode, parent: HTMLElement): void` method to BrowserAdapter. Click handler: attempt `navigator.clipboard?.writeText(n.text)` first; on success swap textContent to `n.copiedLabel ?? "Copied!"` then setTimeout 1500ms to revert to `n.label ?? "Copy"`. On Promise rejection, attempt legacyCopy; if that succeeds show copiedLabel feedback; if that also fails, show no confirmation (silent). If navigator.clipboard is absent (falsy), attempt legacyCopy directly with same feedback logic. NO dispatch, NO onAction call — adapter-internal only.
    5. The button element: type="button", className="vms-button" (reuses existing button styling, no variant modifier for this node type).

    SURFACE 3 — viewmodel-shell-dotnet/ViewModels.cs:
    1. Add `[JsonDerivedType(typeof(CopyButtonNode), "copy-button")]` to the [JsonPolymorphic] attribute block on ViewNode, after the existing `[JsonDerivedType(typeof(LinkNode), "link")]` entry.
    2. Add `public record CopyButtonNode(string Text, string? Label = null, string? CopiedLabel = null) : ViewNode;` after the LinkNode record at the end of the file.
    3. Follow existing nullability conventions: non-nullable `Text` (required), nullable `Label?` and `CopiedLabel?` with defaults matching the adapter fallbacks ("Copy" / "Copied!" are adapter-side defaults, NOT C# defaults — C# defaults should be `null` so the wire omits them when unset, matching the TypeScript optional behavior).

    After all edits: run `npm run check:core-globals` from the viewmodel-shell/ directory and confirm exit 0.
  </action>
  <verify>
    cd viewmodel-shell && npm run check:core-globals
    cd viewmodel-shell && npx tsc --noEmit
    cd viewmodel-shell-dotnet && dotnet build --nologo -v minimal
  </verify>
  <done>
    check:core-globals exits 0; tsc --noEmit no errors; dotnet build succeeds.
    CopyButtonNode appears in all three files at the correct locations.
    browser.ts copyButton() method has no `on` parameter and makes zero onAction/dispatch calls.
  </done>
</task>

<task type="auto">
  <name>Task 2: jsdom adapter tests + parity fixture + FeatureProbe backends</name>
  <files>
    viewmodel-shell/test/copy-button.test.ts,
    parity/fixtures/feature-probe.json,
    demo/FeatureProbe/AspNetCore/FeatureProbeController.cs,
    demo/FeatureProbe-bun/handler.ts
  </files>
  <action>
    TEST FILE — viewmodel-shell/test/copy-button.test.ts:
    Follow the exact import/harness pattern from test/adapter-seam.test.ts (local source .js specifiers, describe/it/expect/vi/beforeEach/afterEach from vitest, BrowserAdapter from ../src/browser.js, ViewModelShell from ../src/index.js).

    Three cases:

    Case A — clipboard write fires with node.text:
    - Mock navigator.clipboard.writeText via vi.stubGlobal / Object.defineProperty so it is a spy returning Promise.resolve().
    - Render a CopyButtonNode via shell.push({ vm: { type: "copy-button", text: "hello", label: "Copy", copiedLabel: "Copied!" }, state: {} }).
    - Click the rendered button (container.querySelector("button").click()).
    - Await a microtask flush (await Promise.resolve()).
    - Assert clipboard.writeText was called with "hello".
    - Assert button textContent is "Copied!" (swap happened).
    - Advance fake timers by 1500ms (vi.useFakeTimers / vi.advanceTimersByTime).
    - Assert button textContent reverts to "Copy".

    Case B — ephemeral copiedLabel swap-then-revert (label/copiedLabel defaults):
    - navigator.clipboard.writeText spy returns Promise.resolve().
    - Render CopyButtonNode with only text set (no label, no copiedLabel).
    - Click, flush, assert textContent is "Copied!" (adapter default).
    - Advance 1500ms, assert textContent reverts to "Copy" (adapter default).

    Case C — graceful no-confirmation when navigator.clipboard rejects AND execCommand unavailable:
    - navigator.clipboard.writeText spy returns Promise.reject(new Error("NotAllowed")).
    - Stub document.execCommand to return false (or throw).
    - Render CopyButtonNode, click, flush.
    - Assert button textContent is still "Copy" (no feedback — silent failure, no crash).
    - Assert no error is thrown / no onError fires.

    Use vi.useFakeTimers() in beforeEach and vi.useRealTimers() in afterEach for timer control. Use vi.restoreAllMocks() in afterEach.

    PARITY FIXTURE — parity/fixtures/feature-probe.json:
    Add one new step at the end of the steps array (before the closing `]`):
    ```json
    { "id": "copy-button-node", "method": "POST", "action": { "name": "show-copy-button" } }
    ```
    This step exercises the copy-button serialization surface — both backends must return a vm containing a CopyButtonNode with type:"copy-button", and the parity harness diffs the normalized JSON to confirm byte-identical wire output.

    FEATUREPROBE DOTNET — demo/FeatureProbe/AspNetCore/FeatureProbeController.cs:
    1. Add "show-copy-button" case to the switch:
    ```csharp
    case "show-copy-button":
        break;  // state unchanged; BuildVm always includes the copy-button node
    ```
    2. In BuildVm, add a CopyButtonNode to the children list (always present, unconditional):
    ```csharp
    new CopyButtonNode("npx @ashley-shrok/viewmodel-shell", "Copy install command", "Copied!")
    ```
    Place it after the existing TextNode lines, before the closing `}`.

    FEATUREPROBE BUN — demo/FeatureProbe-bun/handler.ts:
    1. Add "show-copy-button" case to the switch:
    ```typescript
    case "show-copy-button":
      break;  // state unchanged; buildVm always includes the copy-button node
    ```
    2. In buildVm, add an inline copy-button node to the children array (always present):
    ```typescript
    { type: "copy-button", text: "npx @ashley-shrok/viewmodel-shell", label: "Copy install command", copiedLabel: "Copied!" } as ViewNode,
    ```
    Place it after the existing push calls / array entries.

    Both backends always emit the CopyButtonNode in the view (not behind a state flag), so the initial-load step also carries it — the parity harness diffs every step's full vm tree, and the new "show-copy-button" step's response is the one whose snapshot is new.

    After edits:
    - Run `cd viewmodel-shell && npx vitest run` — all tests must pass including the new 3 copy-button cases.
    - Run `cd viewmodel-shell-dotnet && dotnet build --nologo -v minimal` to confirm FeatureProbe controller compiles.
    - Run `bun run parity/run.ts` — all fixtures including feature-probe must show "all backends agree".
  </action>
  <verify>
    cd viewmodel-shell && npx vitest run
    cd viewmodel-shell-dotnet && dotnet build --nologo -v minimal
    bun run parity/run.ts
  </verify>
  <done>
    vitest: all tests pass including copy-button.test.ts (3 cases: clipboard write, ephemeral revert, silent failure).
    dotnet build: clean.
    parity/run.ts: "Parity tests passed" / all fixtures green including feature-probe (dotnet-probe, bun-probe, node-probe all agree on copy-button serialization).
  </done>
</task>

<task type="auto">
  <name>Task 3: Version bumps, docs (AGENTS.md + CHANGELOG), publish (npm + NuGet), GitHub release</name>
  <files>
    viewmodel-shell/package.json,
    viewmodel-shell/package-lock.json,
    viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj,
    AGENTS.md,
    CHANGELOG.md
  </files>
  <action>
    VERSION BUMPS (lockstep — new ViewNode type, both packages move):
    1. viewmodel-shell/package.json: "version": "0.3.13" → "0.3.14"
    2. viewmodel-shell/package-lock.json: sync via `cd viewmodel-shell && npm install --package-lock-only` (or manually update both version occurrences for the root package entry).
    3. viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj: `<Version>0.3.9</Version>` → `<Version>0.3.10</Version>`

    AGENTS.md — node-types table:
    Add a `copy-button` row to the Node types table (the `| Type | Notes |` table under `## Node types`). Insert after the `modal` row and before the `table` row (or at the end — match the existing row order which follows the TypeScript union order). Row:
    ```
    | `copy-button` | `text` (required): string to copy. `label` (default: "Copy") / `copiedLabel` (default: "Copied!"): button labels. Pure adapter-side — no dispatch, no server round-trip. Clipboard write via `navigator.clipboard.writeText`; falls back to `execCommand("copy")` on insecure context; silent on both failures. |
    ```
    Also add `copy-button` to the CSS classes table:
    ```
    | copy-button | `.vms-button` |
    ```

    CHANGELOG.md — new entry at the top (above the `## 0.3.13` heading), following the exact format of the 0.3.13 entry:
    ```markdown
    ## 0.3.14 — CopyButtonNode (copy text to clipboard)

    **npm:** `0.3.14` (PATCH) · **NuGet:** `0.3.10` (PATCH — new ViewNode type on both sides)

    ### Added
    - `CopyButtonNode` (`type: "copy-button"`) — inline copy-to-clipboard node. Set `text` (the string to copy), optionally `label` (button label, default "Copy") and `copiedLabel` (ephemeral feedback label, default "Copied!"). Pure adapter-side: no dispatch, no server round-trip. Browser adapter writes via `navigator.clipboard.writeText`; falls back to legacy `execCommand("copy")` on insecure contexts; silent on both failures.

    ### Consumer action
    - **None required.** Additive; backward-compatible. Use `new CopyButtonNode(text)` (.NET) or `{ type: "copy-button", text: "..." }` (TypeScript) to include a copy button anywhere in the view tree.
    ```

    PUBLISH SEQUENCE (run in order; all must succeed before the next step):
    1. Build npm package: `cd viewmodel-shell && npm run build`
    2. Confirm vitest still green: `cd viewmodel-shell && npx vitest run`
    3. Publish npm: `cd viewmodel-shell && npm publish --access public`
    4. Pack NuGet: `cd viewmodel-shell-dotnet && dotnet pack --nologo -c Release`
    5. Push NuGet: `dotnet nuget push nupkg/AshleyShrok.ViewModelShell.0.3.10.nupkg --api-key $NUGET_API_KEY --source https://api.nuget.org/v3/index.json`
       (If NUGET_API_KEY env var is not set, output the push command for the user to run manually and note it as a manual step.)
    6. Git commit all changes: `git add viewmodel-shell/src/index.ts viewmodel-shell/src/browser.ts viewmodel-shell-dotnet/ViewModels.cs viewmodel-shell-dotnet/AshleyShrok.ViewModelShell.csproj viewmodel-shell/package.json viewmodel-shell/package-lock.json viewmodel-shell/test/copy-button.test.ts parity/fixtures/feature-probe.json demo/FeatureProbe/AspNetCore/FeatureProbeController.cs demo/FeatureProbe-bun/handler.ts AGENTS.md CHANGELOG.md`
    7. Commit message: `feat: add CopyButtonNode (copy-button) — npm 0.3.14, NuGet 0.3.10`
    8. Git tag: `git tag v0.3.14 && git push origin main --tags`
    9. GitHub release: `gh release create v0.3.14 --title "v0.3.14 — CopyButtonNode" --notes "Adds \`CopyButtonNode\` (\`type: \"copy-button\"\`) — inline copy-to-clipboard with ephemeral feedback. No dispatch, no server round-trip. npm \`0.3.14\` · NuGet \`0.3.10\`. See CHANGELOG.md for details."`

    Note on package-lock.json: The nupkg/ directory already exists (visible in git status as untracked). Do NOT add nupkg/ to git — it is the build output directory. Confirm .gitignore already covers it or add the pattern.
  </action>
  <verify>
    cd viewmodel-shell && npm run build
    cd viewmodel-shell && npx vitest run
    cd viewmodel-shell && npm publish --dry-run 2>&1 | head -5
    cd viewmodel-shell-dotnet && dotnet pack --nologo -c Release
    gh release view v0.3.14
  </verify>
  <done>
    npm 0.3.14 published (or dry-run confirmed the tarball is correct).
    NuGet 0.3.10 pushed (or push command handed to user if API key absent).
    GitHub release v0.3.14 exists with correct notes.
    AGENTS.md copy-button row present in node-types table and CSS classes table.
    CHANGELOG.md 0.3.14 entry is the first entry, matches format of 0.3.13.
    All version numbers consistent across package.json (0.3.14) and .csproj (0.3.10).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| server→wire→adapter | CopyButtonNode.text arrives from server; adapter writes it to clipboard — text is server-controlled |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-gru-01 | Information Disclosure | copyButton click handler — clipboard write | accept | `node.text` is server-chosen and already visible in the rendered UI; writing it to clipboard discloses nothing the user hasn't already seen. No auth tokens or secrets should travel via CopyButtonNode (doc note: use side-effects for that). |
| T-gru-02 | Tampering | legacyCopy textarea briefly appended to DOM | accept | textarea has opacity:0, position:fixed, is immediately removed after execCommand; no user-visible DOM pollution; no persistent side-effect. |
| T-gru-03 | Denial of Service | rapid repeated clipboard writes | accept | browser clipboard API is user-gesture gated; no rate limiting needed at framework level. |
</threat_model>

<verification>
Full suite gate (run in order after all tasks complete):

```
cd viewmodel-shell && npm run check:core-globals   # must exit 0
cd viewmodel-shell && npx vitest run               # all tests green (existing 14 + new 3 = 17+)
bun run parity/run.ts                              # all fixtures "all backends agree"
```

Manual spot-check: open a FeatureProbe demo page in a browser; click the copy button; confirm text is written to clipboard and label flips to "Copied!" then reverts after ~1.5s.
</verification>

<success_criteria>
1. All three surfaces updated in lockstep: index.ts type, browser.ts renderer, ViewModels.cs record.
2. npm 0.3.14 published; NuGet 0.3.10 published (or push command ready).
3. GitHub release v0.3.14 exists.
4. AGENTS.md node-types table has copy-button row; CHANGELOG.md has 0.3.14 entry.
5. parity/run.ts green (feature-probe fixture includes copy-button step, dotnet+bun+node backends agree).
6. vitest: 3 new copy-button cases pass (clipboard write, ephemeral revert, silent failure).
7. check:core-globals exits 0 (no platform globals leaked into index.ts).
</success_criteria>

<output>
After completion, create `.planning/quick/260515-gru-add-copybuttonnode-copy-text-to-clipboar/260515-gru-SUMMARY.md`
</output>
