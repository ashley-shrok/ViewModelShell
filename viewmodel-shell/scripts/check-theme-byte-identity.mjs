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
// light-* (6): SHAs of the genuinely byte-frozen pre-Phase-5 blob (git
// blob @ cb97ebb — these were FULL, correct, unchanged). dark-* (5): SHAs
// of the D-26-CORRECTED full overrides (their pre-0.4.0 accent-only form
// was broken by the D-01 re-base). dark-purple.css is NOT here — NEW file
// (D-02), asserted byte-exact separately in (2). light-purple.css IS here
// and stays byte-unchanged even though its value set became the new
// default (editing it would be a THEME-05 seam behavior change — D-02/D-03).
const THEME_SHA256 = {
  // dark-* (5): D-26 — corrected from broken accent-only partials to
  // self-sufficient full dark overrides (the D-01 light re-base removed the
  // dark default they used to inherit). SHAs baseline the CORRECTED files;
  // functional dark/light correctness is enforced by check-theme-function.mjs.
  "dark-blue.css":    "580be9a7ecc715d7ae47632ebe81e56c046a74973c7dcebd9643a156c9561f6e",
  "dark-green.css":   "1c28ae63c34b53f5e3b1a4ff32c119c1c94a95e49398fdec9efc19d20d8082ea",
  "dark-rose.css":    "1df08e356a902d562172572810388893f1bd762148ffc66144f99b8f15f85f6c",
  "dark-amber.css":   "99f2015f8393d38ff2f80c66b721fad4075be829cf695ccf01c96e8260d8cc63",
  "dark-teal.css":    "7eda81edc92a3968f21e96f256a32e59e4bb71918f2077e6ae99b4c70e125244",
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
  `✓ D-03/D-26: all ${Object.keys(THEME_SHA256).length} theme files match their recorded baseline ` +
  `(SHA-256; light-* frozen pre-Phase-5, dark-* D-26-corrected), ` +
  `and themes/dark-purple.css :root is a byte-exact capture of the prior default dark color block (${Object.keys(PRIOR_DEFAULT_DARK).length} declarations).`
);
process.exit(0);
