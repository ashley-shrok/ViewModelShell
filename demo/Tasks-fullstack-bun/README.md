# Tasks — full-stack TypeScript (one Bun process)

**The canonical reference for deploying a ViewModel Shell app as a single
end-to-end TypeScript process.** If you are building a real app on a
TypeScript backend (Bun / Deno / Node / Workers) rather than the .NET
reference, copy this shape.

## Why this demo exists

Every other demo splits into two installable halves:

| Half | Where it lives | What it is |
|---|---|---|
| Backend | `demo/<Name>/AspNetCore/` or `demo/<Name>-bun/` | the `(state, action) → {vm, state}` wire endpoints |
| Frontend | `demo/<Name>/frontend/` (Vite) | the bundled thin client that mounts the shell |

The `.NET` demos make this look like one thing because ASP.NET serves the
Vite build *and* the API from a single project (its MSBuild target builds the
frontend into `wwwroot/`). The `*-bun` demos are the **backend half only** —
they are headless parity fixtures (`parity/backends.json`), deliberately not
deployable apps.

So an agent that reaches for `Tasks-bun` to "set up a site" correctly notices
the rendering half is missing. That is **not a framework gap** — the thin
client *must* be bundled and served by something; that is the architecture,
not a defect. What was missing was a *worked example* of doing it in one
TypeScript process. This demo is that example.

## What it is

One `Bun.serve` ([`server.ts`](./server.ts)) that does both jobs:

1. **API** — `GET /api/tasks` and `POST /api/tasks/action`. The action logic
   is **not re-implemented here**; it is imported verbatim from
   [`../Tasks-bun/server.ts`](../Tasks-bun/server.ts), the parity-verified
   TypeScript Tasks backend. The wire this app serves is therefore
   byte-for-byte the one the parity harness gates against the .NET reference —
   single source of truth, zero drift.
2. **Client** — every other GET serves the Vite-bundled shell from `dist/`
   (`index.html` + hashed assets), with an SPA-style `index.html` fallback for
   client routes.

Because one process serves both, the client's endpoints are plain relative
paths (`/api/tasks`) — **no CORS, no second port, no dev proxy**
(see [`src/main.ts`](./src/main.ts)).

```
browser ──GET /──────────────► Bun.serve ──► dist/index.html + assets
        ──GET /api/tasks─────►           ──► initialState() + buildVm()  ┐ imported
        ──POST /api/tasks/action►        ──► actionHandler(request)      ┘ from Tasks-bun
```

The only code this demo adds over the parity backend is the static file
server in `server.ts`. That single function is the entire gap between a
headless backend and a deployable app.

## Run

Prerequisites (one-time, from the repo root) — the framework must be built
(server-side imports resolve to `viewmodel-shell/dist/`) and the parity
backend whose handlers we reuse must be installed (its `node_modules` symlink
is what resolves `@ashley-shrok/viewmodel-shell/server`):

```bash
cd viewmodel-shell && npm install && npm run build && cd ..
cd demo/Tasks-bun  && bun install                  && cd ../..
```

Then this demo:

```bash
cd demo/Tasks-fullstack-bun
bun install
bun run serve          # = vite build && bun run server.ts
# open http://localhost:3000   (PORT env var overrides)
```

Scripts:

| Script | What it does |
|---|---|
| `bun run build` | `vite build` → bundles the client into `dist/` |
| `bun run start` | `bun run server.ts` → serves `dist/` + the API (build first) |
| `bun run serve` | build then start, in one command |

## Porting this to Deno / Node / Workers

`server.ts` is Web Fetch-native, so the shape is portable; only the host
primitives differ:

| Concern | Bun (this demo) | Deno | Node 22+ | Cloudflare Workers |
|---|---|---|---|---|
| Listen | `Bun.serve({ fetch })` | `Deno.serve(handler)` | `node:http` + a Fetch adapter | `export default { fetch }` |
| Static files | `Bun.file()` | `Deno.readFile` / `serveDir` | `node:fs` + `Response` | a `[site]`/Assets binding |
| API handler | unchanged | unchanged | unchanged | unchanged |

The action half (`initialState` / `buildVm` / `actionHandler` from the
`@ashley-shrok/viewmodel-shell/server` subpath) is identical on every runtime —
only the listener and the static-file primitive change.

## Not part of the parity harness

This demo is intentionally **absent from `parity/backends.json`**. Parity
diffs *wire* output; that is already gated via `demo/Tasks-bun` (whose
handlers this demo imports unchanged). Adding this composed host would re-test
the same wire while adding a build step to the harness for no extra coverage.
The reuse is the guarantee: if the parity-gated handlers are correct, the wire
this demo serves is correct by construction.
