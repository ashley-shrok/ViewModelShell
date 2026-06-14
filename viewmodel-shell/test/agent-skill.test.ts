// 260614-hey — createAgentSkillHandler vitest suite.
//
// Exercises the TS mount helper exported from viewmodel-shell/src/server.ts.
// No backend required — the handler is a pure (Request) => Response factory
// whose body is cached at handler creation. We compare bytes against the
// on-disk canonical markdown so a body-shape drift is caught here, not at
// the parity gate.

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createAgentSkillHandler } from "../src/server.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CANONICAL_PATH = join(__dirname, "..", "agent-skill.md");
const CANONICAL_BODY = readFileSync(CANONICAL_PATH, "utf8");

describe("createAgentSkillHandler", () => {
  it("returns 200 with text/markdown content-type", async () => {
    const handler = createAgentSkillHandler();
    const res = handler(new Request("http://x/.well-known/vms-skill.md"));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/markdown/);
  });

  it("serves canonical body verbatim when no preamble", async () => {
    const handler = createAgentSkillHandler();
    const res = handler(new Request("http://x/.well-known/vms-skill.md"));
    const body = await res.text();
    expect(body).toBe(CANONICAL_BODY);
  });

  it("prepends preamble under App-specific notes heading with separator", async () => {
    const handler = createAgentSkillHandler({ appPreamble: "test preamble" });
    const res = handler(new Request("http://x/.well-known/vms-skill.md"));
    const body = await res.text();
    expect(body.startsWith("## App-specific notes\n\ntest preamble\n\n---\n\n")).toBe(true);
    expect(body.endsWith(CANONICAL_BODY)).toBe(true);
  });

  it("treats empty/whitespace-only preamble as no preamble", async () => {
    const handler = createAgentSkillHandler({ appPreamble: "   " });
    const res = handler(new Request("http://x/.well-known/vms-skill.md"));
    const body = await res.text();
    expect(body).toBe(CANONICAL_BODY);
  });

  it("is idempotent across multiple invocations", async () => {
    const handler = createAgentSkillHandler({ appPreamble: "stable preamble" });
    const a = await handler(new Request("http://x/.well-known/vms-skill.md")).text();
    const b = await handler(new Request("http://x/.well-known/vms-skill.md")).text();
    expect(a).toBe(b);
  });

  it("two handlers with different preambles are independent", async () => {
    const h1 = createAgentSkillHandler({ appPreamble: "preamble one" });
    const h2 = createAgentSkillHandler({ appPreamble: "preamble two" });
    const a = await h1(new Request("http://x/.well-known/vms-skill.md")).text();
    const b = await h2(new Request("http://x/.well-known/vms-skill.md")).text();
    expect(a).not.toBe(b);
    expect(a).toContain("preamble one");
    expect(b).toContain("preamble two");
    expect(a).not.toContain("preamble two");
    expect(b).not.toContain("preamble one");
  });
});
