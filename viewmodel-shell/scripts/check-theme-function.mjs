#!/usr/bin/env node
// D-26 guard: a theme must FUNCTION as its name claims. The byte-identity
// guard (check-theme-byte-identity.mjs) protects file bytes — but bytes are
// not behavior: 5 dark-* themes shipped byte-"frozen" yet rendered LIGHT
// after the D-01 re-base because they were accent-only partials inheriting a
// default that moved. Byte-identity was green while the seam was broken; the
// human visual review caught it. This guard is the mechanical version of
// that review: for every theme file, MERGE its :root over the shipped
// default :root (theme wins, exactly the cascade a consumer gets from
// `import styles.css; import themes/<t>.css`) and assert the EFFECTIVE
// scheme + background match the theme's name. Static, zero deps, zero jsdom
// (D-25), gated in parity.yml beside check:core-globals / check:aa-contrast.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEFAULT_CSS = resolve(__dirname, "../styles/default.css");
const THEMES_DIR = resolve(__dirname, "../styles/themes");

// Effective-luminance bands. Shipped dark bg #0f0f11 ≈ 0.004; shipped light
// bg #f7f7f9 ≈ 0.93. Wide guard bands (no theme should ever sit between):
const DARK_BG_MAX = 0.2; // a dark theme's effective --vms-bg must be ≤ this
const LIGHT_BG_MIN = 0.5; // a light theme's effective --vms-bg must be ≥ this

// Same parse as check-aa-contrast.mjs: blank CSS block comments (the
// default.css doc-comment contains an illustrative :root example that must
// NOT be read as the real :root), preserve newlines, isolate the first
// :root block, then read `--vms-*` declarations.
function rootVars(css) {
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  const m = stripped.match(/:root\s*\{([\s\S]*?)\}/);
  if (!m) return null;
  const vars = {};
  for (const decl of m[1].split(";")) {
    const ix = decl.indexOf(":");
    if (ix === -1) continue;
    const name = decl.slice(0, ix).trim();
    const value = decl.slice(ix + 1).trim();
    if (name.startsWith("--vms-")) vars[name] = value;
  }
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
function linChannel(c8) {
  const c = c8 / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function relLuminance(hex) {
  const [r, g, b] = hexToRgb(hex).map(linChannel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const defaultRoot = rootVars(readFileSync(DEFAULT_CSS, "utf8"));
if (!defaultRoot) {
  console.error("✗ D-26: could not locate the :root block in styles/default.css");
  process.exit(1);
}

const themeFiles = readdirSync(THEMES_DIR).filter((f) => f.endsWith(".css")).sort();
const violations = [];
const rows = [];

for (const file of themeFiles) {
  const mPrefix = file.match(/^(dark|light)-/);
  if (!mPrefix) {
    violations.push(`${file}: theme filename must start with "dark-" or "light-"`);
    continue;
  }
  const wantScheme = mPrefix[1];
  const themeRoot = rootVars(readFileSync(resolve(THEMES_DIR, file), "utf8"));
  if (!themeRoot) {
    violations.push(`${file}: no :root block`);
    continue;
  }
  // Effective cascade a real consumer gets: default first, theme overrides.
  const eff = { ...defaultRoot, ...themeRoot };
  const scheme = eff["--vms-color-scheme"];
  const bg = eff["--vms-bg"];
  if (!bg || !/^#[0-9a-fA-F]{3,8}$/.test(bg)) {
    violations.push(`${file}: effective --vms-bg "${bg}" is not a hex color`);
    continue;
  }
  const lum = relLuminance(bg);
  const schemeOk = scheme === wantScheme;
  const bgOk =
    wantScheme === "dark" ? lum <= DARK_BG_MAX : lum >= LIGHT_BG_MIN;
  rows.push({ file, wantScheme, scheme, bg, lum, schemeOk, bgOk });
  if (!schemeOk) {
    violations.push(
      `${file}: effective --vms-color-scheme = "${scheme}" but a "${wantScheme}-*" theme must yield "${wantScheme}". ` +
        `Likely an accent-only partial inheriting the (now ${defaultRoot["--vms-color-scheme"]}) default — make it a self-sufficient full override (D-26).`
    );
  }
  if (!bgOk) {
    violations.push(
      `${file}: effective --vms-bg ${bg} (luminance ${lum.toFixed(3)}) is not ${wantScheme} ` +
        `(need ${wantScheme === "dark" ? "≤ " + DARK_BG_MAX : "≥ " + LIGHT_BG_MIN}). ` +
        `The theme renders ${wantScheme === "dark" ? "light" : "dark"} on the shipped default — broken seam (D-26).`
    );
  }
}

const colW = Math.max(...rows.map((r) => r.file.length), 4);
console.log("Theme function — effective scheme/bg merged over the shipped default");
console.log("─".repeat(colW + 40));
for (const r of rows) {
  const mark = r.schemeOk && r.bgOk ? "PASS" : "FAIL";
  console.log(
    `${r.file.padEnd(colW)}  scheme=${(r.scheme ?? "·").padEnd(5)} bg=${r.bg.padEnd(8)} lum=${r.lum.toFixed(3)}  ${mark}`
  );
}

if (violations.length > 0) {
  console.error(`\n✗ D-26: ${violations.length} theme(s) do not function as their name claims:`);
  for (const v of violations) console.error(`  ${v}`);
  console.error(
    "\nA shipped theme must produce its named scheme on the shipped default — " +
      "byte-identity does not imply this (D-26). Fix the theme file to be a " +
      "self-sufficient full override; do not weaken this guard."
  );
  process.exit(1);
}

console.log(`\n✓ D-26: all ${rows.length} theme files function as their name claims (scheme + bg correct merged over the shipped default).`);
process.exit(0);
