#!/usr/bin/env node
// D-03/D-26 guard: THEME-05 is mechanism-invariant — the override seam is
// sacred, but "byte-frozen" only ever protected files that were CORRECT.
// D-26: the 5 non-purple dark themes shipped as accent-only partials that
// silently relied on the pre-0.4.0 dark default; the D-01 light re-base
// removed that base, leaving them rendering LIGHT. THEME-05's *purpose* is a
// working seam, not frozen bytes — so (same means-vs-goal principle as
// D-17 / D-01↔D-07) they were corrected to self-sufficient full dark
// overrides. This guard now baselines the CORRECTED files (still catches
// *accidental* future drift); the real dark/light correctness is enforced
// functionally by check-theme-function.mjs (the guard that should have
// existed — byte-identity guards file bytes, not seam behavior).
//
// Still genuinely frozen: the 6 light-* files (FULL, correct as-is) and the
// dark-purple.css byte-exact capture of the prior default (the one-line
// restore the MIGRATION/CHANGELOG cites — D-02/D-05). Static repo-scan,
// zero deps, zero jsdom — gated in parity.yml beside check:core-globals /
// check:aa-contrast (D-25: jsdom is the wrong tool for a static invariant).
//
// (1) THEME-FILE SHA-256 manifest. light-* (6) baseline their genuinely
//     byte-frozen pre-Phase-5 blob (commit cb97ebb); dark-* (5) baseline
//     their D-26-corrected form. Any future edit to ANY of these 11 trips
//     this guard — intentional drift is re-baselined deliberately + recorded
//     (D-26 precedent), accidental drift is caught.
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

// ── (1) Theme-file SHA-256 manifest (11 files) ───────────────────────────
// light-* (6): re-baselined in issue #8 (deliberate drift, recorded per the
// D-26 precedent) — `warning` became a TEXT style (.vms-text--warning), and
// the light themes' prior --vms-warning #c89610 was only 2.68:1 on the light
// surface (fine as a 3.0:1 border accent, sub-AA as text). It was darkened to
// #8a630d (≥5:1) across default + all 6 light themes so check-aa-contrast.mjs
// (now theme-wide) passes. ONLY that one declaration changed; the SHAs below
// re-freeze the corrected files (still catches accidental future drift).
// dark-* (5): SHAs of the D-26-CORRECTED full overrides (their pre-0.4.0
// accent-only form was broken by the D-01 re-base). dark-purple.css is NOT
// here — NEW file (D-02), asserted byte-exact separately in (2); its
// --vms-warning (#e0a823, light amber on dark) already clears the text bar,
// so #8 left it untouched and the byte-exact capture in (2) still holds.
// Re-baselined 2026-07-09 (CHARTBASE-02, Phase 18 Plan 02): all 11 files gained
// the 8-token --vms-chart-1..8 categorical palette (a deliberate, recorded
// addition — same D-26 precedent as the #8 warning-AA re-baseline). SHAs below
// reflect the files WITH the chart palette added; the addition is otherwise
// identical to each file's prior content (verified via the check-aa-contrast /
// check-theme-function guards, which stay green across this change).
const THEME_SHA256 = {
  // dark-* (5): D-26 — corrected from broken accent-only partials to
  // self-sufficient full dark overrides (the D-01 light re-base removed the
  // dark default they used to inherit). SHAs baseline the CORRECTED files;
  // functional dark/light correctness is enforced by check-theme-function.mjs.
  "dark-blue.css":    "b868cc97c858ae0c7acb71d0eada74588e624db5779f5fd5cef5eb609d3e3cea",
  "dark-green.css":   "f768680ec43a6010d775fdc01467af46b1982895c3a5a9a66d2d6178d477f21e",
  "dark-rose.css":    "b28d809da1ee8b46d36a621fe07f40a29d7dc9150395acf903f8a8a2071ea4d7",
  "dark-amber.css":   "50030388ef370853a010539a0301f799f62b400b95fa464f45195781e810c62b",
  "dark-teal.css":    "687ae6ed3b8bdf1833ae1adff16d02939a492e7cda82ceaf779daf5273e635cd",
  "light-purple.css": "de897eded85654e7c12ac5d8fd0a8654f755b64c28c1e89ad1c9896c138eb649",
  "light-blue.css":   "8868ac3f89474d11021a53f0bf11ca51c389b0205b669c4f9abaa906538a2b50",
  "light-green.css":  "7c664f32395100ffd09353aa1e31746daa0bd4ff2543e1c6e3c8f15e443d99e7",
  "light-rose.css":   "106c22e5c6f26fe11f7187ceab3597bb1ef8ccaeca2747afb771fcab23a37c13",
  "light-amber.css":  "1d5310d81d83cb8b062443e96064e0516394eb0e8c84e874e5513b2f57f46318",
  "light-teal.css":   "228cbf8438d3262ef89e1685d9e93fcc683f1b385936217796b7cd401e8c403d",
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
      `${name}: byte-changed — SHA-256 ${actual} != recorded baseline ${expected}. ` +
      `THEME-05/D-03/D-26: theme files must match their recorded baseline; ` +
      `intentional changes are re-baselined deliberately + recorded (D-26 precedent), not silently.`
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
        // CHARTBASE-02 (Phase 18 Plan 02) deliberately adds the 8-token
        // --vms-chart-1..8 categorical palette to EVERY theme file, including
        // dark-purple.css — an explicitly allowed addition alongside the
        // otherwise-frozen D-02 byte-exact capture (same D-26 "re-baseline
        // deliberately + recorded" precedent, scoped to exactly this token set
        // so the historical 18-declaration capture below stays provably intact).
        if (/^--vms-chart-[1-8]$/.test(n)) continue;
        violations.push(`dark-purple.css: unexpected extra declaration ${n} = "${actual[n]}" — D-02 capture is exactly the prior dark COLOR block plus the CHARTBASE-02 chart palette (no other extra tokens)`);
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
  `✓ D-03/D-26: all ${Object.keys(THEME_SHA256).length} theme files match their recorded baseline ` +
  `(SHA-256; light-* re-baselined #8 warning-AA, dark-* D-26-corrected), ` +
  `and themes/dark-purple.css :root is a byte-exact capture of the prior default dark color block (${Object.keys(PRIOR_DEFAULT_DARK).length} declarations).`
);
process.exit(0);
