#!/usr/bin/env node
// D-07 guard: the shipped default AND every shipped theme must meet WCAG-AA
// contrast for body + muted text, for the text-level semantic colors
// (error + warning — both have .vms-text--* rules), and for the non-text
// semantic accents (success / info / priority-high). Static invariant (a
// CSS-value floor), NOT DOM behavior — so this is a standalone Node script
// gated in parity.yml beside check:core-globals (D-25: jsdom is the wrong
// tool for a static invariant; zero DOM here).
//
// SCOPE (extended for issue #8): originally default-only. `warning` became a
// TEXT style (.vms-text--warning, symmetric with .vms-text--error) — a text
// color must clear the 4.5:1 bar, not the 3.0:1 non-text bar warning was
// tuned for as a border accent. So this guard now (a) classifies error +
// warning as TEXT (4.5:1, checked on BOTH surface and bg, since text appears
// on either), and (b) runs the whole matrix over the shipped default AND
// every theme — each theme merged over the default :root exactly as a
// consumer's `import styles.css; import themes/<t>.css` cascade produces it
// (same merge as check-theme-function.mjs). success / info / priority-high
// remain NON-TEXT accents (borders/badges/tints) → 3.0:1 on surface.
//
// Thresholds (WCAG 2.x — https://www.w3.org/TR/WCAG21/):
//   - TEXT pairs (body, muted, error, warning) >= 4.5:1  (SC 1.4.3 Contrast
//                                                (Minimum), normal text).
//   - NON-TEXT semantic on --vms-surface       >= 3.0:1  (SC 1.4.11 Non-text
//                                                Contrast / graphical-object).
// Contrast ratio: (L1 + 0.05) / (L2 + 0.05) with L = WCAG relative luminance
// over sRGB channels linearised per the WCAG 2.x transfer function.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, basename } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSS = resolve(__dirname, "../styles/default.css");
const THEMES_DIR = resolve(__dirname, "../styles/themes");

const TEXT_AA = 4.5; // SC 1.4.3 normal text
const NONTEXT_AA = 3.0; // SC 1.4.11 non-text / large

// Parse a CSS file's :root into a { "vms-*": "#hex" } map. Strips block
// comments first (the default.css top doc-comment contains an illustrative
// `:root { ... }` override example that must NOT be read as the real :root —
// mirrors check-core-platform-globals.mjs / check-theme-function.mjs comment
// stripping), then isolates the first :root block and reads every --vms-*
// hex declaration (#rgb / #rrggbb / #rrggbbaa — alpha ignored downstream).
function parseRoot(file) {
  const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, "")
  );
  const m = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!m) {
    console.error(`✗ D-07: could not locate a :root block in ${basename(file)}`);
    process.exit(1);
  }
  const vars = {};
  const re = /(--vms-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;/g;
  let d;
  while ((d = re.exec(m[1])) !== null) vars[d[1].slice(2)] = d[2];
  return vars;
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

// [fgVar, bgVar, threshold]. TEXT pairs first, then non-text accents.
const PAIRS = [
  ["vms-text", "vms-bg", TEXT_AA],
  ["vms-text", "vms-surface", TEXT_AA],
  ["vms-text", "vms-surface-2", TEXT_AA],
  ["vms-text-muted", "vms-bg", TEXT_AA],
  ["vms-text-muted", "vms-surface", TEXT_AA],
  ["vms-text-muted", "vms-surface-2", TEXT_AA],
  // error + warning are TEXT styles (.vms-text--error / .vms-text--warning) —
  // checked at the text bar on BOTH surface and bg (text renders on either).
  ["vms-error", "vms-surface", TEXT_AA],
  ["vms-error", "vms-bg", TEXT_AA],
  ["vms-warning", "vms-surface", TEXT_AA],
  ["vms-warning", "vms-bg", TEXT_AA],
  // success / info / priority-high are NON-TEXT accents (borders/badges/tints).
  ["vms-success", "vms-surface", NONTEXT_AA],
  ["vms-info", "vms-surface", NONTEXT_AA],
  ["vms-priority-high", "vms-surface", NONTEXT_AA],
];

const defaultVars = parseRoot(DEFAULT_CSS);

// Targets: the shipped default, then every theme merged over the default
// :root (theme wins — the exact cascade a consumer gets).
const themeFiles = readdirSync(THEMES_DIR)
  .filter((f) => f.endsWith(".css"))
  .sort();
const targets = [
  { label: "default (shipped)", vars: defaultVars },
  ...themeFiles.map((f) => ({
    label: `theme: ${f}`,
    vars: { ...defaultVars, ...parseRoot(resolve(THEMES_DIR, f)) },
  })),
];

function evalTarget(vars) {
  return PAIRS.map(([fg, bg, need]) => {
    const fgHex = vars[fg];
    const bgHex = vars[bg];
    if (!fgHex || !bgHex) {
      console.error(
        `✗ D-07: --${!fgHex ? fg : bg} missing as a hex value (after theme merge)`
      );
      process.exit(1);
    }
    const ratio = contrast(fgHex, bgHex);
    return { label: `--${fg} on --${bg}`, ratio, need, pass: ratio >= need };
  });
}

let totalFailures = 0;
for (const { label, vars } of targets) {
  const rows = evalTarget(vars);
  const failures = rows.filter((r) => !r.pass);
  if (failures.length === 0) {
    console.log(`✓ ${label.padEnd(22)} ${rows.length}/${rows.length} pairs meet WCAG-AA`);
    continue;
  }
  totalFailures += failures.length;
  console.error(`✗ ${label.padEnd(22)} ${failures.length} pair(s) below WCAG-AA:`);
  for (const f of failures) {
    console.error(
      `    ${f.label.padEnd(34)} ${f.ratio.toFixed(2).padStart(5)}:1  (need ${f.need.toFixed(1)}:1)`
    );
  }
}

if (totalFailures > 0) {
  console.error(
    `\n✗ D-07: ${totalFailures} pair(s) below WCAG-AA across the shipped default + themes.\n` +
      "Every shipped surface must be WCAG-AA serviceable (D-07). error + warning are " +
      "TEXT colors (.vms-text--*) and must clear 4.5:1 on both surface and bg — do not " +
      "downgrade the threshold to force a pass; darken the offending --vms-* color."
  );
  process.exit(1);
}

console.log(
  `\n✓ D-07: all ${PAIRS.length} pairs meet WCAG-AA on the shipped default + all ${themeFiles.length} themes.`
);
process.exit(0);
