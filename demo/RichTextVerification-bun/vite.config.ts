import { defineConfig } from "vite";
import { resolve } from "path";

// RichTextVerification (Phase 28 v8.2.0 rich text primitive tailnet sign-off
// page). Structurally identical to demo/StateAxisVerification-bun/vite.config.ts
// (Phase 27's post-implementation verification demo) — single entrypoint
// (index.html), aliases pointing at ../../viewmodel-shell/src so the demo
// builds against LOCAL framework source (Plans 28-01..28-08 shipped code).
//
// The page loads default.css + the picked theme via runtime <link> tags in
// index.html (served verbatim from the framework by server.ts) — NOT via CSS
// imports here — so Ashley's sign-off is against the *shipped* renderer AND
// the *shipped* CSS, and the 12-theme cycle is runtime-swappable with no
// rebuild.
//
// Use REGEX keys, never string keys — a string "viewmodel-shell" prefix-
// matches "viewmodel-shell/browser" and silently breaks the subpath import
// (see AGENTS.md "Critical gotchas" #3).
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@ashley-shrok\/viewmodel-shell\/browser$/,
        replacement: resolve(__dirname, "../../viewmodel-shell/src/browser.ts"),
      },
      {
        find: /^@ashley-shrok\/viewmodel-shell\/server$/,
        replacement: resolve(__dirname, "../../viewmodel-shell/src/server.ts"),
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
