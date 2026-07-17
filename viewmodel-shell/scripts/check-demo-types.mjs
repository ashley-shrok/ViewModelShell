#!/usr/bin/env node
// Type-check every demo source tree (nothing else does).
//
// The gap this closes: each demo already ships a `strict: true` tsconfig, but
// NOTHING ever ran it. CI builds every .NET demo (so since NuGet 6.0.0's enums
// those are genuinely type-checked), while the TypeScript demos were checked by
// NEITHER a build nor vitest -- a demo could emit a value no ViewNode type
// allows and every gate stayed green. That is exactly how `style:"warning"` vs
// `tone:"warning"` survived in demo/HelpDesk-bun for releases.
//
// DISCOVERY, NOT AN ALLOW-LIST. This walks demo/ for tsconfig.json rather than
// naming the demos, because a fixed enumeration can never gate an open-ended
// property -- a new demo added tomorrow is covered automatically, with nobody
// having to remember this file exists. (The sibling check-no-demo-style.mjs
// deliberately uses a literal list for a different reason; see its header.)
//
// A DEMO IT CANNOT CHECK IS A HARD FAILURE, NEVER A SKIP. If a demo's deps are
// missing, the gate fails loudly and names the install command. A silent skip
// would make an unchecked demo indistinguishable from a passing one -- which is
// the failure mode this whole gate exists to remove.
import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root = viewmodel-shell/scripts/ -> ../../
const REPO = resolve(__dirname, "../..");
const DEMO = join(REPO, "demo");

/** Every dir under demo/ holding a tsconfig.json, node_modules excluded. */
function findDemoProjects(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "dist" || entry === "wwwroot") continue;
    const abs = join(dir, entry);
    if (!statSync(abs).isDirectory()) continue;
    if (existsSync(join(abs, "tsconfig.json"))) found.push(abs);
    findDemoProjects(abs, found);
  }
  return found;
}

const projects = findDemoProjects(DEMO).sort();
if (projects.length === 0) {
  console.error("✗ check:demo-types found NO demo tsconfig.json — the discovery walk is broken; refusing to report a vacuous pass.");
  process.exit(1);
}

const failures = [];
let checked = 0;

for (const proj of projects) {
  const rel = relative(REPO, proj);
  // Each demo declares its own typescript devDependency; use it rather than
  // imposing the framework's version on a tree that pinned a different one.
  const tsc = join(proj, "node_modules", ".bin", "tsc");
  if (!existsSync(tsc)) {
    const installer = existsSync(join(proj, "bun.lock")) ? "bun install" : "npm ci";
    failures.push(`${rel}: NOT CHECKED — no local tsc (deps not installed). Run \`cd ${rel} && ${installer}\`. A demo that cannot be checked is a failure, not a skip.`);
    continue;
  }
  const r = spawnSync(tsc, ["-p", join(proj, "tsconfig.json"), "--noEmit"], {
    cwd: proj,
    encoding: "utf8",
  });
  checked++;
  if (r.status !== 0) {
    const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim();
    failures.push(`${rel}:\n${out.split("\n").map((l) => `    ${l}`).join("\n")}`);
  }
}

if (failures.length > 0) {
  console.error(`✗ check:demo-types — ${failures.length} of ${projects.length} demo project(s) failed:`);
  for (const f of failures) console.error(`  ${f}`);
  console.error("\nDemos are the framework's worked examples: an agent reads them to learn the wire.");
  console.error("A demo that does not type-check is teaching a shape the types do not allow.");
  process.exit(1);
}

console.log(`✓ check:demo-types: ${checked} demo project(s) type-check clean (discovered, not enumerated — a new demo is covered automatically).`);
process.exit(0);
