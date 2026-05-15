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

// WR-01: Strip comments and string/template literals BEFORE the denylist scan.
// The denylist is a *code-reference* guard: a denylisted token appearing only
// inside a doc comment (e.g. JSDoc explaining WHY `window` is not used) or a
// string literal is NOT a platform-global reference and must not hard-fail CI.
// A real code reference (e.g. `const x = window;`) still trips the guard because
// stripping replaces comments/strings with blanks but leaves identifiers intact.
// Lightweight stripper (sufficient for this hand-written TS file — no parser dep,
// per D-08): block comments, then line comments, then string/template literals.
// NOTE: comment/string replacements preserve line count (newlines kept) so the
// reported `src/index.ts:<line>` numbers stay accurate to the original file.
function blankPreservingNewlines(match) {
  return match.replace(/[^\n]/g, "");
}
const stripped = src
  .replace(/\/\*[\s\S]*?\*\//g, blankPreservingNewlines)        // block comments
  .replace(/\/\/[^\n]*/g, "")                                   // line comments
  .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/g, blankPreservingNewlines); // string/template literals
// Scan the STRIPPED lines (comment/string false-positives removed), but report
// the ORIGINAL source text so a real violation's error message is readable.
const strippedLines = stripped.split(/\r?\n/);
const originalLines = src.split(/\r?\n/);
const violations = [];

for (const token of DENYLIST) {
  // \b...\b identifier match: catches `window`, `window.location`, `localStorage.setItem`
  // but NOT `fetch`/`FormData`/`setTimeout`/`URLSearchParams`/`console` (none contain a denylist token)
  // and NOT substrings like `windowed` (word-boundary on both sides).
  const re = new RegExp(`\\b${token}\\b`, "g");
  strippedLines.forEach((line, i) => {
    if (re.test(line)) {
      violations.push({ line: i + 1, token, text: (originalLines[i] ?? line).trim() });
    }
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
