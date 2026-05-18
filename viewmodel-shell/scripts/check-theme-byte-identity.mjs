#!/usr/bin/env node
// D-03 guard: THEME-05 is mechanism-invariant. The override seam is sacred:
// the 11 pre-existing theme files must stay BYTE-IDENTICAL to their
// pre-Phase-5 blob, AND the new themes/dark-purple.css must be a BYTE-EXACT
// capture of the prior default.css :root dark COLOR block (so
// `import ".../themes/dark-purple.css"` reproduces the pre-0.4.0 default
// pixel-for-pixel — the one-line restore the MIGRATION/CHANGELOG cites,
// D-02/D-05). Static repo-scan, zero deps, zero jsdom — a standalone Node
// script gated in parity.yml beside check:core-globals / check:aa-contrast
// (D-25: jsdom is the wrong tool for a static repo invariant).
//
// (1) THE 11 FROZEN THEME FILES — SHA-256 manifest. The CI-stable approach
//     (over `git show <ref>:file`): the 11 files were verified byte-identical
//     to their pre-Phase-5 git blob (commit cb97ebb, the last Phase-4 commit;
//     `git diff cb97ebb HEAD -- styles/themes/` shows ONLY the new
//     dark-purple.css added — every pre-existing theme file 0 changes). The
//     SHAs below are computed from those frozen files and embedded as the
//     expected manifest. THEME-05 / D-03 freeze these: any future edit to a
//     pre-existing theme file changes its SHA and trips this guard.
//
// (2) DARK-PURPLE BYTE-EXACT CAPTURE — themes/dark-purple.css :root must
//     declare exactly the prior default.css :root dark COLOR block (the 18
//     color/scheme declarations the prior shipped dark default carried;
//     non-color tokens — radius/fonts/spacing/type/page-max/card-min — are
//     NOT part of a theme override and are intentionally not in
//     dark-purple.css). The expected set below is the prior dark default
//     extracted from default.css @ cb97ebb (comment-stripped, :root-isolated
//     — the SAME parse as check-aa-contrast.mjs). Compared declaration-set
//     + value, normalizing only surrounding whitespace.
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = resolve(__dirname, "../styles/themes");
const DEFAULT_DARKPURPLE = resolve(THEMES_DIR, "dark-purple.css");

// ── (1) The 11 frozen-by-D-03 theme files: SHA-256 manifest ──────────────
// Computed from the pre-Phase-5 byte-frozen files (== git blob @ cb97ebb,
// verified). dark-purple.css is NOT here — it is a NEW file (D-02), asserted
// separately in (2). light-purple.css IS here and stays byte-unchanged even
// though its value set became the new default (editing it would be a
// THEME-05 seam behavior change — D-02/D-03).
const THEME_SHA256 = {
  "dark-blue.css":    "9ee4d4db9178a46efcb485264a342f89dee5a10f7572150c18fd6bb2f8ffc1b9",
  "dark-green.css":   "8ad1b4e6f49a7810f0c87a09843afd725c9d100b9bfed63ff3a2ccb5ce0c8ae1",
  "dark-rose.css":    "61a76c83f2a3ea9fbbfd348fb0b320b021be4341078d7eb099c08e1fb83f91ff",
  "dark-amber.css":   "8f1ba7c304d61d2d618fe1d006f39d81b3324ed9a9d256647e95c5b633d205c3",
  "dark-teal.css":    "782cd67e46dd11298ee50ba813869e096ce27546027dc20123c9a3d3c9d2ed1b",
  "light-purple.css": "1ba8f21da2a5d08800dbb13e1fcaff49936f70d2ae4c903b720cd7ac65bcc39d",
  "light-blue.css":   "15d9a05140437e43890a3a2be046f35a288a6f63a7902708a05330a149785e6a",
  "light-green.css":  "bd5947f24f99a35776346bc892daa1b7eeabf9f5598c8109f08e8f12d195e727",
  "light-rose.css":   "754cb7a6a0e390f1d7e10766bf37cd0f0a9d7b386e92686acf4526dc91abbcac",
  "light-amber.css":  "8752eb152a4eb961fa6d45f92a8e81ea3d4aa0f1fca7c7b372942981c6d1ecda",
  "light-teal.css":   "9a5f1efb8147bb467abe2336ae61d42469c355bf5471e08109f4bc411f52d7cf",
};

// ── (2) The prior default.css :root dark COLOR block (frozen-by-D-02) ─────
// Extracted from default.css @ cb97ebb (the pre-Plan-01 dark default), via
// the same comment-strip + :root-isolate parse as check-aa-contrast.mjs.
// This is precisely the declaration set themes/dark-purple.css must carry,
// byte-exact by value (D-02 byte-exact capture). Order-independent; values
// compared after trimming surrounding whitespace only.
const PRIOR_DEFAULT_DARK = {
  "--vms-bg":             "#0f0f11",
  "--vms-surface":        "#18181c",
  "--vms-surface-2":      "#222228",
  "--vms-border":         "#2e2e38",
  "--vms-accent":         "#7c6af7",
  "--vms-accent-glow":    "rgba(124, 106, 247, 0.18)",
  "--vms-accent-dim":     "rgba(124, 106, 247, 0.35)",
  "--vms-text":           "#e8e8f0",
  "--vms-text-muted":     "#9090a8",
  "--vms-done-bg":        "#3a3a48",
  "--vms-done-text":      "#5a5a6e",
  "--vms-error":          "#e05a5a",
  "--vms-error-glow":     "rgba(224, 90, 90, 0.12)",
  "--vms-warning":        "#e0a823",
  "--vms-priority-high":  "#e07015",
  "--vms-success":        "#4dd17a",
  "--vms-info":           "#4a9eff",
  "--vms-color-scheme":   "dark",
};

const violations = [];

// ── (1) Assert each frozen theme file is byte-identical via SHA-256 ──────
for (const [name, expected] of Object.entries(THEME_SHA256)) {
  const abs = resolve(THEMES_DIR, name);
  if (!existsSync(abs)) {
    violations.push(`${name}: MISSING — a pre-existing theme file was deleted (THEME-05/D-03: the 11 theme files are frozen)`);
    continue;
  }
  const actual = createHash("sha256").update(readFileSync(abs)).digest("hex");
  if (actual !== expected) {
    violations.push(
      `${name}: byte-changed — SHA-256 ${actual} != frozen ${expected}. ` +
      `THEME-05/D-03: the 11 pre-existing theme files must stay byte-identical (the override seam is sacred).`
    );
  }
}

// ── (2) Assert dark-purple.css :root == the prior default dark color block
if (!existsSync(DEFAULT_DARKPURPLE)) {
  violations.push(`dark-purple.css: MISSING — D-02 requires the byte-exact capture of the prior dark default`);
} else {
  const raw = readFileSync(DEFAULT_DARKPURPLE, "utf8");
  // Same parse as check-aa-contrast.mjs: strip CSS block comments (the file's
  // header doc-comment must never be mistaken for the :root block), preserve
  // newlines, then isolate the single :root block.
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ""));
  const rootMatch = css.match(/:root\s*\{([\s\S]*?)\}/);
  if (!rootMatch) {
    violations.push(`dark-purple.css: could not locate a :root block`);
  } else {
    const body = rootMatch[1];
    // Parse declarations: name -> value (trim surrounding whitespace only;
    // this is the only normalization — values themselves must match exactly).
    const actual = {};
    for (const decl of body.split(";")) {
      const ix = decl.indexOf(":");
      if (ix === -1) continue;
      const name = decl.slice(0, ix).trim();
      const value = decl.slice(ix + 1).trim();
      if (name.startsWith("--vms-")) actual[name] = value;
    }
    const expectedNames = Object.keys(PRIOR_DEFAULT_DARK);
    const actualNames = Object.keys(actual);

    for (const n of expectedNames) {
      if (!(n in actual)) {
        violations.push(`dark-purple.css: missing ${n} — D-02 byte-exact capture requires the prior-default value ${PRIOR_DEFAULT_DARK[n]}`);
      } else if (actual[n] !== PRIOR_DEFAULT_DARK[n]) {
        violations.push(`dark-purple.css: ${n} = "${actual[n]}" != prior-default "${PRIOR_DEFAULT_DARK[n]}" (D-02 byte-exact capture mismatch)`);
      }
    }
    for (const n of actualNames) {
      if (!(n in PRIOR_DEFAULT_DARK)) {
        violations.push(`dark-purple.css: unexpected extra declaration ${n} = "${actual[n]}" — D-02 capture is exactly the prior dark COLOR block (no extra tokens)`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`✗ D-03/D-02: ${violations.length} theme byte-identity violation(s):`);
  for (const v of violations) console.error(`  ${v}`);
  console.error("THEME-05 is mechanism-invariant: the 11 pre-existing theme files are frozen byte-identical and dark-purple.css must reproduce the prior dark default byte-exact (the one-line restore path — D-02/D-03/D-05).");
  process.exit(1);
}

console.log(
  `✓ D-03/D-02: all ${Object.keys(THEME_SHA256).length} pre-existing theme files byte-identical (SHA-256), ` +
  `and themes/dark-purple.css :root is a byte-exact capture of the prior default dark color block (${Object.keys(PRIOR_DEFAULT_DARK).length} declarations).`
);
process.exit(0);
