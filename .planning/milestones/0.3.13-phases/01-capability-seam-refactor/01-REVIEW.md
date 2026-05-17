---
phase: 01-capability-seam-refactor
reviewed: 2026-05-15T08:55:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - viewmodel-shell/src/index.ts
  - viewmodel-shell/src/browser.ts
  - viewmodel-shell/scripts/check-core-platform-globals.mjs
  - viewmodel-shell/test/adapter-seam.test.ts
  - viewmodel-shell/vitest.config.ts
  - viewmodel-shell/package.json
  - .github/workflows/parity.yml
  - AGENTS.md
  - README.md
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 1: Code Review Report

**Reviewed:** 2026-05-15T08:55:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This is a behavior-preserving architecture refactor that relocates three platform-global
bindings (`window.location.href`, `localStorage.setItem`, `sessionStorage.setItem`) out of
core `src/index.ts` and behind optional capability methods on the existing `Adapter`
interface, implemented in `BrowserAdapter`. A grep-based CI guard and a net-new jsdom/vitest
adapter test were added to enforce and prove the relocation.

**The locked phase invariants all hold:**

- **Zero platform globals in core** — verified by running the guard (`exit 0`, clean) and
  by reading `src/index.ts` in full. No `window`/`document`/`localStorage`/`sessionStorage`/`XMLHttpRequest`
  reference remains. The seam is optional methods on the existing `Adapter` interface (not a
  new plug-in concept). PASS.
- **Redirect resolution order** — `processResponse()` (index.ts:348-356) resolves exactly
  `onRedirect` → `adapter.navigate` → loud error. `onRedirect` signature is still
  `(url: string) => void` (no breaking change). PASS.
- **Fail-loud on missing capability** — `failCapability()` surfaces an `Error` via
  `onError` (or `console.error`), never a silent no-op. The adapter test Case D proves
  both the storage and navigate paths surface an error and that nothing is written. PASS.
- **`transport` is asymmetric** — core keeps `fetch` directly in `load()`/`dispatch()`;
  `transport?` is declared but NOT wired into the request path. PASS.
- **Guard scope** — scoped to `src/index.ts` ONLY, denylists exactly the 5 tokens,
  word-boundary regex does NOT false-positive on `fetch`/`FormData`/`setTimeout`/`URLSearchParams`/`console`
  (verified by execution). PASS.

**Verification performed during review:**

- `node scripts/check-core-platform-globals.mjs` → exit 0 on clean core; injected a real
  violation → exit 1 with correct line/token reporting; restored → exit 0 again.
- `npx tsc -p tsconfig.json` → clean build, `dist/` contains only index/browser/server.
- `npx vitest run` → all 5 adapter-seam tests pass.

The adapter test is genuine, not hollow: Case A asserts real jsdom `localStorage`/`sessionStorage`
contents after `push()`, Case B/C use prototype spies to prove the relocated `navigate` binding
actually fires and that `onRedirect` precedence holds, Case D asserts the error surfaces AND
that storage was not written. This materially closes the gap parity cannot cover (D-13).

No behavior change was found in the non-redirect render path. The two warnings below are
genuine robustness gaps in the guard tooling and a test-coverage gap, not behavior regressions.

## Warnings

### WR-01: Guard false-positives on the 5 tokens when they appear in comments or string literals

**File:** `viewmodel-shell/scripts/check-core-platform-globals.mjs:17-26`
**Issue:** The guard does a line-by-line `\b<token>\b` regex match against raw source text
with no comment/string stripping. I verified this empirically: injecting
`// this comment mentions window and document and localStorage` and
`const noteOnlyString = "sessionStorage and XMLHttpRequest in a string";` into `src/index.ts`
caused the guard to report 5 violations and exit 1, even though no platform global is
actually referenced.

This cuts both ways as a correctness concern:

1. **False failure:** A future legitimate doc comment in core that names one of these tokens
   (e.g. explaining *why* `window` is not used, or referencing `localStorage` in JSDoc) will
   hard-fail CI even though core is clean. The current `Adapter` interface JSDoc in
   `index.ts:21-31` deliberately avoids the bare tokens ("sets the page location",
   "platform storage") — that avoidance is load-bearing and undocumented, so the next editor
   who writes a clarifying comment will trip it.
2. **It does correctly catch real violations** (the actual phase deliverable), so this is a
   robustness/maintainability issue, not an invariant failure.

**Fix:** Strip line comments, block comments, and string literals before matching, or match
only identifier-position occurrences. A pragmatic lightweight approach:

```js
// Drop // line comments and /* */ block comments, then blank out string literals,
// before the denylist scan. Keeps the grep-based D-08 mechanism, removes the
// comment/string false-positive class.
const stripped = src
  .replace(/\/\*[\s\S]*?\*\//g, "")            // block comments
  .replace(/\/\/[^\n]*/g, "")                  // line comments
  .replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""'); // string/template literals
const lines = stripped.split(/\r?\n/);
```

At minimum, add a comment in the script documenting that bare tokens must not appear in core
comments/strings, and add a one-line note to AGENTS.md §Enforcement so future editors know
the constraint extends to prose inside `index.ts`.

### WR-02: No adapter test covers the `onRedirect` + `adapter.navigate`-absent case, and no test asserts side-effect ordering relative to redirect

**File:** `viewmodel-shell/test/adapter-seam.test.ts:35-150`
**Issue:** The suite proves the four primary branches (storage write, navigate default,
onRedirect precedence, fail-loud x2). Two behavior-preservation guarantees from the phase
contract are not directly asserted:

1. **Side-effects apply before redirect.** `processResponse()` (index.ts:339-357) runs the
   `sideEffects` loop and *then* the redirect branch with an early `return`. AGENTS.md and the
   wire docs explicitly promise "applied in order before redirect or re-render," and the
   canonical security example is `set-local-storage(hecate_jwt)` + `redirect` in one
   response. No test feeds a response containing *both* `sideEffects` and `redirect` to prove
   the JWT is persisted before the navigation fires. This is exactly the security-sensitive
   path D-06 exists to protect; it is currently unverified end-to-end.
2. **`onRedirect` set but adapter has no `navigate`.** The redirect-precedence test (Case C)
   uses `BrowserAdapter` (which has `navigate`). The fail-loud navigate test (Case D) has
   neither `onRedirect` nor `navigate`. The combination "consumer set `onRedirect`, adapter
   is render-only" — the common SPA-router integration shape — is not asserted to succeed
   without touching `failCapability`. The code is correct (onRedirect is checked first), but
   the regression guard for "onRedirect alone is sufficient, no navigate needed" is missing.

**Fix:** Add two cases to `adapter-seam.test.ts`:

```ts
it("applies a storage side-effect BEFORE redirecting (JWT-then-redirect security path)", () => {
  const navSpy = vi.spyOn(BrowserAdapter.prototype, "navigate").mockImplementation(() => {});
  const shell = new ViewModelShell({
    adapter: new BrowserAdapter(freshContainer()), endpoint, actionEndpoint,
  });
  shell.push({
    vm, state, redirect: "/app",
    sideEffects: [{ type: "set-local-storage", key: "hecate_jwt", value: "tok" }],
  });
  expect(localStorage.getItem("hecate_jwt")).toBe("tok"); // persisted before nav
  expect(navSpy).toHaveBeenCalledWith("/app");
});

it("onRedirect alone satisfies redirect when the adapter has no navigate", () => {
  const onError = vi.fn();
  const onRedirect = vi.fn();
  const renderOnlyAdapter: Adapter = { render() {} };
  const shell = new ViewModelShell({
    adapter: renderOnlyAdapter, endpoint, actionEndpoint, onRedirect, onError,
  });
  shell.push({ vm, state, redirect: "/login" });
  expect(onRedirect).toHaveBeenCalledWith("/login");
  expect(onError).not.toHaveBeenCalled(); // failCapability NOT reached
});
```

## Info

### IN-01: `BrowserAdapter.transport` signature omits the `hooks?` parameter declared on the interface

**File:** `viewmodel-shell/src/browser.ts:70-77`
**Issue:** `Adapter.transport` is declared with a third `hooks?: { onUploadProgress?: ... }`
parameter (index.ts:32-36), but `BrowserAdapter.transport` declares only `(input, init)`.
This is structurally type-compatible in TypeScript (a method accepting fewer parameters
satisfies an interface requiring more — confirmed by clean `tsc`), and matches the Phase 1
intent (no upload-progress yet). It is intentional, but the divergence is silent: a reader
comparing the two signatures may think `hooks` was dropped by mistake.
**Fix:** Add `hooks` to the signature for shape parity and discoverability (it can stay
unused in Phase 1):
```ts
async transport(
  input: string,
  init: { method?: string; headers?: Record<string, string>; body?: FormData | string },
  _hooks?: { onUploadProgress?: (sent: number, total: number) => void },
): Promise<Response> {
  return fetch(input, init);
}
```

### IN-02: Guard records at most one violation per token per line

**File:** `viewmodel-shell/scripts/check-core-platform-globals.mjs:21-25`
**Issue:** `re.test(line)` returns a boolean, so a line with two distinct denylisted tokens
is reported once per token (acceptable) but a single token appearing twice on one line is
reported once. For a pass/fail gate this is harmless — any hit fails the build — but the
violation report under-counts and could mislead someone fixing a dense violation line. The
`re.lastIndex = 0` reset on line 24 is correct and necessary (the `/g` regex is stateful);
keep it.
**Fix:** Optional. If precise reporting is wanted, use `line.match(re)` and iterate matches.
Not required for the guard's gating function.

### IN-03: `transport` default-fetch behavior is documented but not asserted by any test

**File:** `viewmodel-shell/src/browser.ts:70-77`, `viewmodel-shell/test/adapter-seam.test.ts`
**Issue:** Phase 1 deliberately does not route `load()`/`dispatch()` through `transport`
(correct per D-07), so there is nothing to regress *yet*. But `BrowserAdapter.transport`
exists as committed code with zero coverage. When Phase 2 wires it in, there is no Phase 1
baseline test asserting "thin fetch passthrough" semantics.
**Fix:** Optional for Phase 1 (the method is genuinely a no-op extension point). Consider a
one-line smoke test that `BrowserAdapter.prototype.transport` delegates to `fetch` so Phase 2
has a regression anchor. Defer is acceptable since D-07 scopes the binding to Phase 2.

### IN-04: `processResponse` storage loop silently ignores effects with `key == null` (documented behavior, but no fail-loud)

**File:** `viewmodel-shell/src/index.ts:339-347`
**Issue:** A `set-local-storage`/`set-session-storage` effect with a missing/null `key` is
silently skipped (the `&& effect.key != null` guard falls through to no branch). This is
consistent with the documented "unknown `type` values are silently ignored" forward-compat
rule and is pre-existing behavior (not introduced by this refactor), so it is not a phase
regression. Flagging only because the phase's security thesis is "a swallowed storage write
is a security failure" — a malformed JWT side-effect with a null key is swallowed just as
silently as the missing-capability case that this phase makes loud. The asymmetry (missing
adapter capability = loud; malformed effect = silent) is defensible (server-side bug vs.
client-side capability gap) but undocumented.
**Fix:** None required for Phase 1 (out of scope, pre-existing, behavior-preserving). Worth
a one-line note in the side-effects section of AGENTS.md that a side-effect with a missing
`key` is silently dropped, so the asymmetry with the new fail-loud rule is intentional and
documented.

---

_Reviewed: 2026-05-15T08:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
