import { defineConfig } from "vite";
import { resolve } from "path";

// Aliases map the published package specifiers onto the in-repo source so the
// demo builds against local framework changes — the same pattern every other
// demo's vite.config.ts uses. Use REGEX keys, never string keys: a string
// "viewmodel-shell" prefix-matches "viewmodel-shell/browser" and silently
// breaks the subpath import (see AGENTS.md "Critical gotchas" #3).
//
// This demo is one directory shallower than demo/<Name>/frontend/, so the
// path back to the framework source is "../../viewmodel-shell", not "../../../".
//
// NOTE: this page loads default.css + the theme via runtime <link> tags in
// index.html (served verbatim from the framework by server.ts), NOT via a CSS
// import here — so the human sign-off is against the *shipped* renderer AND the
// *shipped* CSS, and the theme is runtime-swappable (light ↔ dark) without a
// rebuild.
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
  },
});
