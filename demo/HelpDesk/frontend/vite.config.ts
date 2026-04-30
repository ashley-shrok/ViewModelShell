import { defineConfig } from "vitest/config";
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
        find: /^viewmodel-shell$/,
        replacement: resolve(__dirname, "../../../viewmodel-shell/src/index.ts"),
      },
    ],
  },
  build: {
    outDir: "../AspNetCore/wwwroot",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main:      resolve(__dirname, "index.html"),
        requester: resolve(__dirname, "requester.html"),
        agent:     resolve(__dirname, "agent.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});
