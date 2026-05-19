// Tasks — full-stack single-process demo (the canonical end-to-end TypeScript
// reference).
//
// This is the worked example for "deploy a ViewModel Shell app as ONE
// TypeScript process": a single Bun.serve that BOTH
//   1. serves the Vite-bundled shell client (the static dist/ produced by
//      `vite build`), and
//   2. exposes the GET/POST wire endpoints the shell talks to.
//
// The action logic is NOT re-implemented here. It is imported verbatim from
// demo/Tasks-bun (the parity-verified TypeScript Tasks backend), so the wire
// this app serves is byte-for-byte the one the parity harness gates against
// the .NET reference. The ONLY thing this file adds over Tasks-bun is the
// static file server — that is precisely the single missing half between a
// headless parity backend and a deployable app. (Tasks-bun's standalone
// listener is `import.meta.main`-guarded, so importing it starts no second
// server.)

import { initialState, buildVm, actionHandler } from "../Tasks-bun/server.ts";

const distDir = new URL("./dist/", import.meta.url);

async function serveStatic(pathname: string): Promise<Response> {
  // "/" → index.html; strip leading slashes so the rest resolves under dist/.
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");

  // A static server must never escape its root.
  if (rel.split("/").some((seg) => seg === "..")) {
    return new Response("Forbidden", { status: 403 });
  }

  const file = Bun.file(new URL(rel, distDir));
  if (await file.exists()) {
    // Bun infers Content-Type from the file extension.
    return new Response(file);
  }

  // SPA-style fallback: an extension-less path (a client route) gets
  // index.html so the shell can still boot and load(). A genuinely missing
  // asset (has a `.`) is a real 404.
  if (!rel.includes(".")) {
    const index = Bun.file(new URL("index.html", distDir));
    if (await index.exists()) return new Response(index);
  }
  return new Response("Not Found", { status: 404 });
}

const port = Number(process.env.PORT ?? "3000");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // --- API: identical wire to demo/Tasks-bun and the .NET Tasks backend ---
    if (url.pathname === "/api/tasks" && request.method === "GET") {
      const state = initialState();
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/tasks/action" && request.method === "POST") {
      return actionHandler(request);
    }

    // --- Everything else: the bundled shell client ---
    if (request.method === "GET") {
      return serveStatic(url.pathname);
    }
    return new Response("Method Not Allowed", { status: 405 });
  },
});

console.log(
  `Tasks full-stack (client + API) → http://localhost:${port}  —  open it in a browser`,
);
