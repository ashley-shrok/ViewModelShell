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
        // Preserve any `?query` (e.g. ?inline, ?url) by interpolating $1 from
        // the captured group — otherwise the alias would strip the query and
        // Vite wouldn't apply the transform.
        find: /^viewmodel-shell\/themes\/dark-blue\.css(\?.*)?$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/styles/themes/dark-blue.css") + "$1",
      },
      {
        find: /^viewmodel-shell\/themes\/light\.css(\?.*)?$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/styles/themes/light.css") + "$1",
      },
      {
        find: /^viewmodel-shell\/themes\/rainbow-dark\.css(\?.*)?$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/styles/themes/rainbow-dark.css") + "$1",
      },
      {
        find: /^viewmodel-shell\/themes\/rainbow-light\.css(\?.*)?$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/styles/themes/rainbow-light.css") + "$1",
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
