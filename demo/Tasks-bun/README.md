# Tasks — TypeScript backend

A faithful port of `demo/Tasks/AspNetCore/` to TypeScript, running on Bun.
Same wire format, same action semantics, same vm shape as the .NET reference.

Used as one half of the parity test harness in `../../parity/` — both
backends are spun up against the same fixture and their responses are
diffed step-for-step.

## Run

```
bun install
bun run start          # defaults to port 3001 (PORT env var to override)
```

Then point the Tasks frontend (`../Tasks/frontend/`) at `http://localhost:3001`
instead of the .NET backend's port.

## Why Bun?

The framework's `@ashley-shrok/viewmodel-shell/server` subpath is Web Fetch
API-native. Bun, Deno, Cloudflare Workers, and Node 22+ all support that
surface natively — this demo uses Bun because it has the simplest start
command (`bun run server.ts`) and ships TypeScript support out of the box,
but the same `server.ts` runs unchanged on the others with one-line entry
shim differences.
