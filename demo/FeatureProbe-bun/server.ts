// Bun entry point. The actual logic lives in handler.ts so node-server.ts
// can share it. Proves the framework's "Web Fetch native" claim — same
// fetchHandler runs unchanged under both Bun.serve and node:http.

import { fetchHandler } from "./handler.ts";

const port = Number(process.env.PORT ?? "3006");

Bun.serve({ port, fetch: fetchHandler });

console.log(`FeatureProbe Bun backend listening on http://localhost:${port}`);
