// Node 22+ entry point. Wraps the same fetchHandler from handler.ts with a
// node:http server, converting IncomingMessage → Request and Response →
// ServerResponse. Node 18+ ships global Request/Response/FormData/Blob, so
// the framework's Web Fetch–native createAction works unchanged.
//
// Run: node --experimental-strip-types server-node.ts

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { fetchHandler } from "./handler.ts";

const port = Number(process.env.PORT ?? "3007");

async function toRequest(req: IncomingMessage): Promise<Request> {
  const host = req.headers.host ?? `localhost:${port}`;
  const url = `http://${host}${req.url ?? "/"}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach(val => headers.append(k, val));
    else if (v != null) headers.set(k, v);
  }
  const method = req.method ?? "GET";
  let body: Buffer | undefined;
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(chunk as Buffer);
    body = Buffer.concat(chunks);
  }
  return new Request(url, { method, headers, body });
}

async function writeResponse(response: Response, res: ServerResponse): Promise<void> {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  const buf = Buffer.from(await response.arrayBuffer());
  res.end(buf);
}

const server = createServer(async (req, res) => {
  try {
    const request = await toRequest(req);
    const response = await fetchHandler(request);
    await writeResponse(response, res);
  } catch (err) {
    res.statusCode = 500;
    res.end(JSON.stringify({ error: (err as Error).message }));
  }
});

server.listen(port, () => {
  console.log(`FeatureProbe Node backend listening on http://localhost:${port}`);
});
