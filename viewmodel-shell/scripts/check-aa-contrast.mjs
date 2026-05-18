#!/usr/bin/env node
// D-07 guard: the SHIPPED default (default.css :root) must meet WCAG-AA
// contrast for body + muted text and for semantic colors on the dominant
// surface. Static invariant (a CSS-value floor), NOT DOM behavior — so this
// is a standalone Node script gated in parity.yml beside check:core-globals
// (D-25: jsdom is the wrong tool for a static invariant; zero DOM here).
//
// Thresholds (WCAG 2.x — https://www.w3.org/TR/WCAG21/):
//   - Body + muted TEXT pairs        >= 4.5:1  (SC 1.4.3 Contrast (Minimum),
//                                                normal text — muted text is
//                                                still text, not "large").
//   - Semantic color ON --vms-surface >= 3.0:1  (SC 1.4.11 Non-text Contrast
//                                                / graphical-object & large-
//                                                text floor — these colors are
//                                                used as accents/indicators on
//                                                the dominant surface).
// Contrast ratio: (L1 + 0.05) / (L2 + 0.05) with L = WCAG relative luminance
// over sRGB channels linearised per the WCAG 2.x transfer function.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(__dirname, "../styles/default.css");

const TEXT_AA = 4.5; // SC 1.4.3 normal text
const NONTEXT_AA = 3.0; // SC 1.4.11 non-text / large

const rawCss = readFileSync(TARGET, "utf8");

// Strip CSS block comments first: the file's top doc-comment contains an
// illustrative `:root { ... }` override example that must NOT be mistaken
// for the shipped :root (mirrors check-core-platform-globals.mjs comment
// stripping). Newlines preserved so any reported context stays accurate.
const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));

// Isolate the :root block so theme-file or rule-body values can never be
// mistaken for the shipped default.
const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
if (!rootMatch) {
  console.error("✗ D-07: could not locate the :root block in styles/default.css");
  process.exit(1);
}
const root = rootMatch[1];

// Pull a --vms-* hex value (#rgb or #rrggbb) from :root.
function readVar(name) {
  const re = new RegExp(`--${name}\\s*:\\s*(#[0-9a-fA-F]{3,8})\\s*;`);
  const m = root.match(re);
  if (!m) {
    console.error(`✗ D-07: --${name} not found as a hex value in default.css :root`);
    process.exit(1);
  }
  return m[1];
}

function hexToRgb(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

// WCAG 2.x sRGB -> linear channel.
function linChannel(c8) {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(linChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(fgHex, bgHex) {
  const L1 = relLuminance(fgHex);
  const L2 = relLuminance(bgHex);
  const [hi, lo] = L1 >= L2 ? [L1, L2] : [L2, L1];
  return (hi + 0.05) / (lo + 0.05);
}

const C = {
  bg: readVar("vms-bg"),
  surface: readVar("vms-surface"),
  surface2: readVar("vms-surface-2"),
  text: readVar("vms-text"),
  textMuted: readVar("vms-text-muted"),
  error: readVar("vms-error"),
  success: readVar("vms-success"),
  warning: readVar("vms-warning"),
  info: readVar("vms-info"),
  priorityHigh: readVar("vms-priority-high"),
};

// [label, fgHex, bgHex, threshold]
const pairs = [
  ["--vms-text on --vms-bg", C.text, C.bg, TEXT_AA],
  ["--vms-text on --vms-surface", C.text, C.surface, TEXT_AA],
  ["--vms-text on --vms-surface-2", C.text, C.surface2, TEXT_AA],
  ["--vms-text-muted on --vms-bg", C.textMuted, C.bg, TEXT_AA],
  ["--vms-text-muted on --vms-surface", C.textMuted, C.surface, TEXT_AA],
  ["--vms-text-muted on --vms-surface-2", C.textMuted, C.surface2, TEXT_AA],
  ["--vms-error on --vms-surface", C.error, C.surface, NONTEXT_AA],
  ["--vms-success on --vms-surface", C.success, C.surface, NONTEXT_AA],
  ["--vms-warning on --vms-surface", C.warning, C.surface, NONTEXT_AA],
  ["--vms-info on --vms-surface", C.info, C.surface, NONTEXT_AA],
  ["--vms-priority-high on --vms-surface", C.priorityHigh, C.surface, NONTEXT_AA],
];

const rows = pairs.map(([label, fg, bg, need]) => {
  const ratio = contrast(fg, bg);
  return { label, fg, bg, ratio, need, pass: ratio >= need };
});

const colW = Math.max(...rows.map((r) => r.label.length));
console.log("WCAG-AA contrast — shipped default (default.css :root)");
console.log("─".repeat(colW + 34));
for (const r of rows) {
  const ratio = r.ratio.toFixed(2).padStart(5);
  const mark = r.pass ? "PASS" : "FAIL";
  console.log(
    `${r.label.padEnd(colW)}  ${ratio}:1  (need ${r.need.toFixed(1)}:1)  ${mark}`
  );
}

const failures = rows.filter((r) => !r.pass);
if (failures.length > 0) {
  console.error(`\n✗ D-07: ${failures.length} pair(s) below WCAG-AA on the shipped default:`);
  for (const f of failures) {
    console.error(
      `  ${f.label}: ${f.ratio.toFixed(2)}:1 (need ${f.need.toFixed(1)}:1)`
    );
  }
  console.error(
    "The shipped default must be WCAG-AA serviceable (D-07). :root values are " +
      "locked to the light-purple set by D-01 — a failure here is a phase blocker, " +
      "escalate; do not silently adjust :root to force a pass."
  );
  process.exit(1);
}

console.log(`\n✓ D-07: all ${rows.length} pairs meet WCAG-AA on the shipped default.`);
process.exit(0);
