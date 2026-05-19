import { defineConfig } from "vitest/config";

export default defineConfig({
  // esbuild only applies the JSX transform to files that contain JSX; the
  // existing jsdom .ts suites have none, so this is additive and inert for
  // them. It lets test/tui.test.ts import the .tsx adapter.
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "react",
  },
  test: {
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
  },
});
