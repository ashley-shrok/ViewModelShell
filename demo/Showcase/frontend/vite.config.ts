import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^viewmodel-shell\/browser$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/src/browser.ts"),
      },
      {
        find: /^viewmodel-shell\/styles\.css$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/styles/default.css"),
      },
      {
        find: /^viewmodel-shell\/themes\/dark-blue\.css(\?.*)?$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/styles/themes/dark-blue.css"),
      },
      {
        find: /^viewmodel-shell\/themes\/light\.css(\?.*)?$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/styles/themes/light.css"),
      },
      {
        find: /^viewmodel-shell$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/src/index.ts"),
      },
    ],
  },
  build: {
    outDir: "../AspNetCore/wwwroot",
    emptyOutDir: true,
  },
});
