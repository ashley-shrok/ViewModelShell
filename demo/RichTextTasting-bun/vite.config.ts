import { defineConfig } from "vite";
import { resolve } from "path";

// Aliases map the published package specifiers onto the in-repo source so the
// demo builds against local framework changes — the same pattern every other
// demo's vite.config.ts uses. Use REGEX keys, never string keys: a string
// "viewmodel-shell" prefix-matches "viewmodel-shell/browser" and silently
// breaks the subpath import (see AGENTS.md "Critical gotchas" #3).
//
// This demo lives at demo/RichTextTasting-bun/ (one directory shallower than
// demo/<Name>/frontend/), so the path back to the framework source is
// "../../viewmodel-shell", not "../../../".
//
// MULTI-PAGE build: this tasting site is A/B iframe-scoped per the banked
// v8.0.3 lesson (2026-07-30) — a shared <script>/<link> at parent level would
// cross-contaminate the comparison. Three HTML entrypoints (parent index.html
// + panel-primitives.html + panel-composite.html) each bundle their own JS
// entry (parent bundles ./src/main.ts for the theme switcher chrome; each
// panel bundles its own ./src/panel-*.ts for a real ViewModelShell mount).
//
// NOTE: shipped default.css + the picked theme are loaded via runtime <link>
// tags in each HTML file (served verbatim from viewmodel-shell/styles by
// server.ts), NOT via CSS imports here — so the sign-off is against the
// SHIPPED renderer AND the SHIPPED CSS, and the theme is runtime-swappable
// across 12 themes without a rebuild.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@ashley-shrok\/viewmodel-shell\/browser$/,
        replacement: resolve(__dirname, "../../viewmodel-shell/src/browser.ts"),
      },
      {
        find: /^@ashley-shrok\/viewmodel-shell$/,
        replacement: resolve(__dirname, "../../viewmodel-shell/src/index.ts"),
      },
    ],
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        // Parent page: theme switcher chrome + iframe scaffolding, no VMS
        // mount. See index.html.
        index: resolve(__dirname, "index.html"),
        // BEFORE panel: rich text input composed from EXISTING primitives
        // (SectionNode(layout:row) header + ButtonNodes + FieldNode textarea).
        // The "pretty-bad-approximation" baseline the earned-a-composite rule
        // requires (composite-nodes-layer.md §2).
        "panel-primitives": resolve(__dirname, "src/panel-primitives.html"),
        // AFTER panel: RichTextFieldNode + RichTextToolbarNode composite via
        // the just-shipped Plan 28-03 renderer. Exercises the composite path
        // Plan 28-05 will finalize; Ashley signs off on the shape here.
        "panel-composite": resolve(__dirname, "src/panel-composite.html"),
      },
    },
  },
});
