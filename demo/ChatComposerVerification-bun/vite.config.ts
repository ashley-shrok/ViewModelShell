import { defineConfig } from "vite";
import { resolve } from "path";

// ChatComposerVerification (Phase 30 v9.1.0 ChatComposerNode Route B composite
// tailnet sign-off page — Plan 30-09). Structurally derived from
// demo/RichTextVerification-bun/vite.config.ts (Phase 28's post-implementation
// verification demo), with ONE key departure: this page uses IFRAME-SCOPED
// PANELS per Vicky's tasting-artifact pattern
// (~/.claude/identities/vicky/bounties/chat-composer-primitive/tasting/) —
// every panel is a separate iframe, each iframe loads its own shipped CSS +
// its own theme link + its own ViewModelShell mount. This prevents CSS/JS
// cross-contamination between panels (which matters when panels demonstrate
// different subvariants side-by-side).
//
// The 13 HTML entry points:
//   - index.html          — parent page with theme switcher + iframe grid
//   - panels/panel-1.html — DEFAULT
//   - panels/panel-2.html — WITH ATTACH
//   - panels/panel-3.html — ALL SLOTS FILLED
//   - panels/panel-4.html — STREAMING STATE
//   - panels/panel-5.html — SENDING STATE
//   - panels/panel-6.html — DISABLED
//   - panels/panel-7.html — SUBMITMODE CTRL-ENTER
//   - panels/panel-8.html — DROPSCOPE GLOBAL
//   - panels/panel-9.html — MAX-FILE VALIDATION
//   - panels/panel-10.html — INPUT SLOT RICH TEXT
//   - panels/panel-11.html — MAX ROWS OVERRIDE
//   - panels/panel-12.html — HEADER SLOT COMPOSITION WITH ATTACHED FILES
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
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        panel1: resolve(__dirname, "panels/panel-1.html"),
        panel2: resolve(__dirname, "panels/panel-2.html"),
        panel3: resolve(__dirname, "panels/panel-3.html"),
        panel4: resolve(__dirname, "panels/panel-4.html"),
        panel5: resolve(__dirname, "panels/panel-5.html"),
        panel6: resolve(__dirname, "panels/panel-6.html"),
        panel7: resolve(__dirname, "panels/panel-7.html"),
        panel8: resolve(__dirname, "panels/panel-8.html"),
        panel9: resolve(__dirname, "panels/panel-9.html"),
        panel10: resolve(__dirname, "panels/panel-10.html"),
        panel11: resolve(__dirname, "panels/panel-11.html"),
        panel12: resolve(__dirname, "panels/panel-12.html"),
      },
    },
  },
});
