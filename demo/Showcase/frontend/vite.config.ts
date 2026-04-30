import { defineConfig } from "vite";
import { resolve } from "path";

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
        // Single regex covers every theme file. The captured `name` becomes
        // the actual filename, and any ?query (e.g. ?inline) is preserved.
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
});
