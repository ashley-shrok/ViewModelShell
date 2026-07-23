import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Regex aliases only (never string keys) — a string key like
// "@ashley-shrok/viewmodel-shell" prefix-matches subpath imports and
// silently misroutes them (AGENTS.md gotcha #3). Every alias below is an
// anchored regex.
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@ashley-shrok\/viewmodel-shell\/browser$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/src/browser.ts"),
      },
      {
        find: /^@ashley-shrok\/viewmodel-shell\/styles\.css$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/styles/default.css"),
      },
      {
        find: /^@ashley-shrok\/viewmodel-shell\/themes\/([a-z-]+)\.css(\?.*)?$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/styles/themes") + "/$1.css$2",
      },
      {
        find: /^@ashley-shrok\/viewmodel-shell$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/src/index.ts"),
      },
    ],
  },
  build: {
    outDir: "../AspNetCore/wwwroot",
    emptyOutDir: true,
  },
  test: {
    environment: "jsdom",
  },
});
