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
    // src/**/*.test.ts picks up pure-TS framework tests that live alongside
    // their unit (e.g. src/tree-walker.test.ts colocates with server.ts's
    // validateActionNames). test/**/*.test.ts remains for jsdom adapter /
    // integration suites that need to import the renderer.
    include: ["test/**/*.test.ts", "src/**/*.test.ts"],
  },
});
