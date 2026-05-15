#!/usr/bin/env node
// AGNOSTIC-03 guard: core src/index.ts must reference ZERO platform globals.
// Grep-based denylist (D-08: not ESLint, not a no-DOM-lib tsconfig split).
// Scope is src/index.ts ONLY (D-11) — server.ts/browser.ts are out of scope.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(__dirname, "../src/index.ts");
const DENYLIST = ["window", "document", "localStorage", "sessionStorage", "XMLHttpRequest"];

const src = readFileSync(TARGET, "utf8");
const lines = src.split(/\r?\n/);
const violations = [];

for (const token of DENYLIST) {
  // \b...\b identifier match: catches `window`, `window.location`, `localStorage.setItem`
  // but NOT `fetch`/`FormData`/`setTimeout`/`URLSearchParams`/`console` (none contain a denylist token)
  // and NOT substrings like `windowed` (word-boundary on both sides).
  const re = new RegExp(`\\b${token}\\b`, "g");
  lines.forEach((line, i) => {
    if (re.test(line)) violations.push({ line: i + 1, token, text: line.trim() });
    re.lastIndex = 0;
  });
}

if (violations.length > 0) {
  console.error(`✗ AGNOSTIC-03: ${violations.length} platform-global violation(s) in viewmodel-shell/src/index.ts:`);
  for (const v of violations) console.error(`  src/index.ts:${v.line}  [${v.token}]  ${v.text}`);
  console.error("The core must reference zero platform globals. Move the binding into BrowserAdapter behind the capability seam.");
  process.exit(1);
}

console.log("✓ AGNOSTIC-03: viewmodel-shell/src/index.ts references zero platform globals.");
process.exit(0);
