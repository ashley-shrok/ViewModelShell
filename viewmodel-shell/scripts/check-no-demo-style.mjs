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
// SCAN SCOPE: every hand-edited demo/Showcase frontend HTML source file,
// DISCOVERED by walking demo/ — never enumerated. wwwroot/ is excluded because
// it is Vite build output (regenerated, not authoritative hand-edited source),
// and .NET parity diffs wire JSON not CSS (D-24), so served chrome has zero
// parity surface. node_modules/ and dist/ are excluded for the same
// not-authoritative-source reason.
//
// DISCOVERY, NOT AN ALLOW-LIST (changed 2026-07-17). This scan was originally a
// literal 8-path allow-list. The exclusion it was protecting (wwwroot mirrors)
// is real, but an enumeration was the wrong way to express it: a FIXED LIST can
// never gate an OPEN-ENDED property, so every demo page added after the list was
// written went silently uncovered while the gate printed a confident green
// naming "8 files". That was not hypothetical — at the time of this change 15
// hand-edited demo HTML files existed and 7 of them were gated by NOTHING
// (all clean, so the hole was real but unexploited). The wwwroot exclusion is
// now expressed as a DESCRIPTION, which keeps the intended exclusion AND covers
// a new demo automatically, with nobody having to remember this file exists.
// (The original header rejected "branch (a)" — adding a wwwroot REBUILD step.
// That rejection stands and is untouched here: this change adds no build step.
// It was never an argument for enumeration.)
//
// A VACUOUS PASS IS A HARD FAILURE, NEVER A GREEN. If the walk discovers no
// HTML at all, the gate fails rather than reporting success over an empty set —
// a broken discovery walk must not be indistinguishable from a clean repo.
// (Same guard, same reason, as check-demo-types.mjs.)
//
// SCOPE NOTE — verification harnesses are covered too, deliberately. A few demo
// pages (e.g. demo/NavVerification-bun, demo/LookupVerification-bun) carry
// out-of-tree HOST CHROME (a theme toggle) built from plain HTML with inline
// `style=` attributes — the sanctioned exception for harness chrome. They
// contain no <style> block, so covering them asserts the status quo rather than
// changing it. If such a page ever genuinely needs a <style> block, that is a
// design conversation worth having and this gate failing is the right way to
// start it — not a reason to re-introduce an allow-list.
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
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// repo root = viewmodel-shell/scripts/ -> ../../
const REPO = resolve(__dirname, "../..");
const DEMO = join(REPO, "demo");

// Not authoritative hand-edited source: wwwroot/ is Vite build output, and
// node_modules/ + dist/ are generated. See the SCAN SCOPE header.
const SKIP_DIRS = new Set(["node_modules", "dist", "wwwroot"]);

/** Every hand-edited *.html under demo/ — discovered, never enumerated. */
function findDemoHtml(dir, found = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      if (SKIP_DIRS.has(entry)) continue;
      findDemoHtml(abs, found);
    } else if (entry.endsWith(".html")) {
      found.push(relative(REPO, abs));
    }
  }
  return found;
}

const HTML_FILES = findDemoHtml(DEMO).sort();
if (HTML_FILES.length === 0) {
  console.error(
    "✗ D-12/D-15: the discovery walk found NO hand-edited demo HTML under demo/ — the walk is broken; refusing to report a vacuous pass.",
  );
  process.exit(1);
}

// The Showcase archetype source — must be `.vms-*`-only (no raw-HTML
// content construction); the JS-created theme-switcher <style> element is
// the documented single exception (see main.ts rule in the header).
const SHOWCASE_MAIN = "demo/Showcase/frontend/src/main.ts";

const violations = [];

// (1) Zero `<style` (case-insensitive) in every hand-edited frontend HTML.
// (No MISSING check: these paths were just discovered on disk, so a listed-file-
// went-away failure mode no longer exists — that check was a cost of the list.)
for (const rel of HTML_FILES) {
  const html = readFileSync(resolve(REPO, rel), "utf8");
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

console.log(`✓ D-12/D-15: ${HTML_FILES.length} hand-edited frontend HTML file(s) are zero-<style> (discovered, not enumerated — a new demo is covered automatically), and ${SHOWCASE_MAIN} is .vms-*-only (no literal <style>, no innerHTML/insertAdjacentHTML markup). wwwroot/** excluded (Vite build output, zero parity surface — D-24).`);
process.exit(0);
