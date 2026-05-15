# Migration Guide

This document tells downstream app maintainers exactly what (if anything) to update,
what is explicitly **NOT breaking** and why, and the two non-obvious silent behaviors
to be aware of. It is copy-pasteable — every command and version string is concrete.

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
