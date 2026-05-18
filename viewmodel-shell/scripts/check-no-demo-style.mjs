#!/usr/bin/env node
// D-12/D-15 guard: the demos + Showcase frontend HTML must be ZERO-`<style>`
// and the Showcase archetypes must be `.vms-*`-only (no raw-HTML content
// construction). This is the falsifiable STRUCTURAL PROXY for "visually
// serviceable benchmarked against Bootstrap" — visual quality itself cannot
// be browser-unit-tested (the framework's no-browser-test promise), so D-12
// splits it into CI-checkable proxies (this guard + check:aa-contrast) plus
// an explicit owned reviewer sign-off. Static repo-scan, zero deps, zero
// jsdom — a standalone Node script gated in parity.yml beside
// check:core-globals / check:aa-contrast (D-25: jsdom is the wrong tool for
// a static repo invariant).
//
// SCAN SCOPE: the 8 hand-edited frontend HTML source files only. demo/**/AspNetCore/wwwroot/*.html is HARD-EXCLUDED — it is Vite build output (regenerated, not authoritative hand-edited source), and .NET parity diffs wire JSON not CSS (D-24) so served chrome has zero parity surface.
// (FIXED PLAN DECISION — branch (b). The scan list below is a LITERAL
// allow-list, deliberately NOT a `demo/**/*.html` glob, precisely so the 8
// wwwroot mirrors are never pulled in. No wwwroot rebuild step exists
// anywhere in this plan — branch (a) is explicitly rejected to keep the
// closeout regression-only with zero new build/parity surface.)
//
// main.ts rule (the ONE allowed exception, documented precisely): the
// Showcase ships a single runtime theme-switcher element created in JS via
// `document.createElement("style")` with `id="vms-showcase-theme"` (the
// legitimate 12-theme runtime switcher — D-06/D-14). That is NOT literal
// `<style>` HTML and NOT raw markup-string content; it is left alone. The
// main.ts assertion is therefore scoped to: (1) no literal `<style` HTML
// substring anywhere in the source, and (2) no markup-string content
// construction — no `.innerHTML =` / `.insertAdjacentHTML(` assignment of
// HTML markup (the archetypes must be `.vms-*` ViewNode trees rendered by
// the adapter, never hand-built DOM/markup). The JS-created switcher
// element is explicitly permitted by this precise rule.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root = viewmodel-shell/scripts/ -> ../../
const REPO = resolve(__dirname, "../..");

// The 8 authoritative hand-edited frontend HTML source files (LITERAL
// allow-list — Plan 03's 7 de-chromed demo files + Plan 02's de-chromed
// Showcase scaffold). NOT a glob: demo/**/AspNetCore/wwwroot/*.html is
// hard-excluded (see SCAN SCOPE header above).
const HTML_FILES = [
  "demo/ContactManager/frontend/index.html",
  "demo/ExpenseTracker/frontend/index.html",
  "demo/RetroBoard/frontend/index.html",
  "demo/Tasks/frontend/index.html",
  "demo/HelpDesk/frontend/index.html",
  "demo/HelpDesk/frontend/agent.html",
  "demo/HelpDesk/frontend/requester.html",
  "demo/Showcase/frontend/index.html",
];

// The Showcase archetype source — must be `.vms-*`-only (no raw-HTML
// content construction); the JS-created theme-switcher <style> element is
// the documented single exception (see main.ts rule in the header).
const SHOWCASE_MAIN = "demo/Showcase/frontend/src/main.ts";

const violations = [];

// (1) Zero `<style` (case-insensitive) in every hand-edited frontend HTML.
for (const rel of HTML_FILES) {
  const abs = resolve(REPO, rel);
  if (!existsSync(abs)) {
    violations.push(`${rel}: MISSING — expected hand-edited frontend HTML source not found`);
    continue;
  }
  const html = readFileSync(abs, "utf8");
  if (/<style/i.test(html)) {
    violations.push(`${rel}: contains a <style> block — demos must be zero-<style>, chrome owned by the shipped .vms-page shell + default.css body rule (D-15)`);
  }
}

// (2) Showcase main.ts: no literal `<style` HTML substring, and no
//     markup-string content construction (.innerHTML = / .insertAdjacentHTML().
const mainAbs = resolve(REPO, SHOWCASE_MAIN);
if (!existsSync(mainAbs)) {
  violations.push(`${SHOWCASE_MAIN}: MISSING — Showcase archetype source not found`);
} else {
  const main = readFileSync(mainAbs, "utf8");
  if (/<style/i.test(main)) {
    violations.push(`${SHOWCASE_MAIN}: contains a literal "<style" HTML substring — the Showcase must be .vms-*-only; the runtime theme switcher is a JS-created document.createElement("style") element (id=vms-showcase-theme), never literal <style> HTML (D-12/D-14)`);
  }
  // Markup-string content construction is forbidden: the archetypes must be
  // .vms-* ViewNode trees rendered by the adapter, never hand-built markup.
  // `.innerHTML =` or `.insertAdjacentHTML(` is the unambiguous signal.
  const innerHtmlAssign = /\.innerHTML\s*=/;
  const insertAdjacent = /\.insertAdjacentHTML\s*\(/;
  if (innerHtmlAssign.test(main)) {
    violations.push(`${SHOWCASE_MAIN}: assigns .innerHTML — archetypes must be .vms-* ViewNode trees rendered by the adapter, not hand-built HTML markup (D-12 .vms-*-only proxy)`);
  }
  if (insertAdjacent.test(main)) {
    violations.push(`${SHOWCASE_MAIN}: calls .insertAdjacentHTML() — archetypes must be .vms-* ViewNode trees rendered by the adapter, not injected HTML markup (D-12 .vms-*-only proxy)`);
  }
}

if (violations.length > 0) {
  console.error(`✗ D-12/D-15: ${violations.length} zero-<style> / .vms-*-only violation(s):`);
  for (const v of violations) console.error(`  ${v}`);
  console.error("Demos + Showcase must be zero-<style> and .vms-*-only — chrome is owned by the shipped stylesheet (the canonical few-shot surface). wwwroot/** is hard-excluded (Vite build output; .NET parity diffs wire JSON not CSS — D-24).");
  process.exit(1);
}

console.log(`✓ D-12/D-15: ${HTML_FILES.length} hand-edited frontend HTML files are zero-<style>, and ${SHOWCASE_MAIN} is .vms-*-only (no literal <style>, no innerHTML/insertAdjacentHTML markup). wwwroot/** hard-excluded (Vite build output, zero parity surface — D-24).`);
process.exit(0);
