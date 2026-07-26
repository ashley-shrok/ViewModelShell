// One-shot generator: reads lucide-static SVGs, extracts inner content, emits
// viewmodel-shell/src/icons-payload.ts as a Record<IconName, string>. Run once
// during Plan 22-04; the output file is checked into the repo (no runtime
// generation — per design-doc §6, bundled inline strings only).
//
//   node scripts/generate-icons-payload.mjs
//
// Idempotent: re-running with a newer lucide-static regenerates the file
// byte-identically for names that haven't upstream-changed and refreshes any
// upstream tweaks.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Byte-identical to the IconName union in src/index.ts (Plan 22-01), category
// order preserved so the generated map reads top-to-bottom in the same order.
const NAMES = [
  // Actions (24)
  "check", "x", "plus", "minus", "edit", "edit-3", "trash", "trash-2",
  "save", "download", "upload", "copy", "clipboard", "clipboard-copy",
  "share", "share-2", "refresh-cw", "rotate-ccw", "search", "filter",
  "send", "printer", "pencil", "eye",
  // Status (10)
  "check-circle", "check-circle-2", "x-circle", "alert-circle",
  "alert-triangle", "alert-octagon", "info", "help-circle", "ban",
  "loader-2",
  // Navigation (14)
  "home", "menu", "more-horizontal", "more-vertical", "external-link",
  "chevron-left", "chevron-right", "chevron-up", "chevron-down",
  "arrow-left", "arrow-right", "arrow-up", "arrow-down", "arrow-up-right",
  // Content (14)
  "book-open", "receipt", "file", "file-text", "folder", "folder-open",
  "image", "paperclip", "link", "link-2", "calendar", "clock",
  "bookmark", "mail",
  // Communication (5)
  "message-square", "message-circle", "at-sign", "phone", "bell",
  // People (5)
  "user", "user-plus", "user-check", "users", "user-x",
  // Objects (10)
  "wrench", "shield-check", "shield", "lock", "unlock", "key",
  "star", "heart", "tag", "flag",
  // Data / system (16)
  "activity", "workflow", "route", "database", "server", "hard-drive",
  "cloud", "wifi", "bar-chart", "line-chart", "pie-chart", "gauge",
  "layers", "settings", "cpu", "terminal",
  // Magic / accents (4)
  "sparkles", "zap", "wand-2", "flame",
];

const CATEGORY_LABEL = [
  ["Actions", 24],
  ["Status", 10],
  ["Navigation", 14],
  ["Content", 14],
  ["Communication", 5],
  ["People", 5],
  ["Objects", 10],
  ["Data / system", 16],
  ["Magic / accents", 4],
];

function extract(name) {
  const raw = readFileSync(join("node_modules/lucide-static/icons", name + ".svg"), "utf8");
  const m = raw.match(/<svg[^>]*>([\s\S]*?)<\/svg>/);
  if (!m) throw new Error("No <svg>...</svg> body in " + name);
  return m[1]
    .replace(/\n\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

const pkg = JSON.parse(readFileSync("node_modules/lucide-static/package.json", "utf8"));
const version = pkg.version;

let out = "";
out += "// v7.0.0 (ICON-01/02) — inline-bundled SVG payloads for the curated Lucide subset.\n";
out += "//\n";
out += "// GENERATED from lucide-static @ " + version + " by scripts/generate-icons-payload.mjs.\n";
out += "// Do NOT hand-edit — regenerate by running the script. Re-runs are byte-idempotent for\n";
out += "// names whose upstream Lucide payloads have not changed.\n";
out += "//\n";
out += "// The framework owns the outer <svg> wrapper attrs (viewBox=\"0 0 24 24\", fill,\n";
out += "// stroke=\"currentColor\", stroke-width, stroke-linecap, stroke-linejoin) — injected\n";
out += "// in the browser adapter's icon() renderer. This map holds ONLY the inner elements\n";
out += "// (<path>, <circle>, <line>) that vary per glyph.\n";
out += "//\n";
out += "// See .planning/design/icons-primitive.md section 6 for the curated set + rationale.\n";
out += "// A new icon becomes an addition here + a new IconName enum member in the same change\n";
out += "// (both TS + .NET, per closed-union-must-be-enum discipline).\n";
out += "//\n";
out += "// This module MUST NOT reference any platform global — it is a pure ESM string map\n";
out += "// imported ONLY by browser.ts (never by src/index.ts, which is core and platform-\n";
out += "// agnostic per the CI-enforced check:core-globals guard).\n";
out += "\n";
out += "import type { IconName } from \"./index.js\";\n";
out += "\n";
out += "export const ICONS: Record<IconName, string> = {\n";

let idx = 0;
for (const [label, count] of CATEGORY_LABEL) {
  out += "  // " + label + " (" + count + ")\n";
  for (let i = 0; i < count; i++) {
    const name = NAMES[idx++];
    const inner = extract(name);
    // We wrap with double-quote strings; the SVG contains double-quoted attrs
    // (fill=\"none\", d=\"...\"), so escape internal double quotes and any
    // backslashes. Newlines are already stripped by extract().
    const escaped = inner.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
    out += "  \"" + name + "\": \"" + escaped + "\",\n";
  }
}

out += "};\n";

writeFileSync("src/icons-payload.ts", out);
console.log("Wrote src/icons-payload.ts — " + out.length + " bytes");
console.log("102 icons, lucide-static v" + version);
