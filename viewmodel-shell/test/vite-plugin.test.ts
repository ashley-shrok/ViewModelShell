// @vitest-environment node
//
// 3.11.0 — @ashley-shrok/viewmodel-shell/vite plugin unit tests.
//
// Runs in the node vitest environment (mirrors test/tui-lifecycle.test.ts)
// because the plugin uses node:fs/os/path/crypto. The plugin's hooks are plain
// functions on the returned object, so we call them directly — no Vite runtime.
//
// ⚠️ Cross-backend hash lock: the fixture manifest.json here is BYTE-IDENTICAL
// to viewmodel-shell-dotnet/Tests/fixtures/manifest.json, and both suites assert
// the SAME hardcoded expected 12-hex against it. If you touch either fixture,
// touch both and re-derive EXPECTED_HASH (sha256 → first 12 hex, lowercase).
// See VersioningTests.cs (VmsManifestBuildId_MatchesLockedContract).

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  cpSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { vmsBuildIdPlugin, vmsHashManifestBytes } from "../src/vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_MANIFEST = join(__dirname, "fixtures", "manifest.json");

// The locked cross-backend hash of test/fixtures/manifest.json.
// sha256(rawBytes) → first 12 hex, lowercase. Mirrored in the .NET suite.
const EXPECTED_HASH = "2f64b9072074";

const tmpDirs: string[] = [];
afterEach(() => {
  vi.restoreAllMocks();
  while (tmpDirs.length) rmSync(tmpDirs.pop()!, { recursive: true, force: true });
});

function makeTmp(): string {
  const d = mkdtempSync(join(tmpdir(), "vms-vite-"));
  tmpDirs.push(d);
  return d;
}

// The plugin hooks are declared as plain functions on the returned object.
// Grab them as callables (Vite types them as ObjectHook unions).
function asFn<T extends unknown[], R>(hook: unknown): (...args: T) => R {
  return hook as (...args: T) => R;
}

describe("3.11.0 — vmsHashManifestBytes (locked contract)", () => {
  it("hashes raw fixture bytes to the expected 12-hex lowercase", () => {
    const bytes = readFileSync(FIXTURE_MANIFEST);
    expect(vmsHashManifestBytes(bytes)).toBe(EXPECTED_HASH);
  });

  it("honors hashLength", () => {
    const bytes = readFileSync(FIXTURE_MANIFEST);
    expect(vmsHashManifestBytes(bytes, 8)).toBe(EXPECTED_HASH.slice(0, 8));
    expect(vmsHashManifestBytes(bytes, 12).startsWith(vmsHashManifestBytes(bytes, 8))).toBe(true);
  });
});

describe("3.11.0 — vmsBuildIdPlugin.config", () => {
  it("injects the VITE_VMS_BUILD define with a placeholder and sets build.manifest when unset", () => {
    const plugin = vmsBuildIdPlugin();
    const config = asFn<[Record<string, unknown>, unknown], Record<string, any>>(plugin.config);
    const result = config({}, {});

    const define = result.define as Record<string, string>;
    const placeholderJson = define["import.meta.env.VITE_VMS_BUILD"];
    expect(placeholderJson).toBeDefined();
    // JSON-stringified internal placeholder token.
    expect(JSON.parse(placeholderJson)).toMatch(/^__VMS_BUILD_[0-9a-f]{8}__$/);

    expect(result.build?.manifest).toBe("manifest.json");
  });

  it("does NOT override a manifest already set to manifest.json, and does not warn", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plugin = vmsBuildIdPlugin();
    const config = asFn<[Record<string, unknown>, unknown], Record<string, any>>(plugin.config);
    const result = config({ build: { manifest: "manifest.json" } }, {});

    expect(result.build).toBeUndefined(); // no build override emitted
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns (but does not override) when a different manifest path is set", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const plugin = vmsBuildIdPlugin();
    const config = asFn<[Record<string, unknown>, unknown], Record<string, any>>(plugin.config);
    const result = config({ build: { manifest: ".vite/manifest.json" } }, {});

    expect(result.build).toBeUndefined(); // no override
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("[vms]");
  });
});

describe("3.11.0 — vmsBuildIdPlugin.writeBundle", () => {
  it("rewrites the placeholder in .js chunks that carry it, hashing the manifest", () => {
    const plugin = vmsBuildIdPlugin();
    const config = asFn<[Record<string, unknown>, unknown], Record<string, any>>(plugin.config);
    const placeholder = JSON.parse(
      (config({}, {}).define as Record<string, string>)["import.meta.env.VITE_VMS_BUILD"],
    );

    const dir = makeTmp();
    // Real fixture bytes so the produced hash equals EXPECTED_HASH.
    cpSync(FIXTURE_MANIFEST, join(dir, "manifest.json"));

    // Chunk that carries the placeholder (the shell entry).
    writeFileSync(join(dir, "main.js"), `const b = "${placeholder}"; export {};`);
    // Chunk WITHOUT the placeholder (a vendor chunk) — must be untouched.
    const vendorSrc = `export const x = 1;`;
    writeFileSync(join(dir, "vendor.js"), vendorSrc);
    // A .css asset that happens to contain the placeholder — with default
    // extensions=[".js"] it must NOT be rewritten.
    const cssSrc = `.a{content:"${placeholder}"}`;
    writeFileSync(join(dir, "style.css"), cssSrc);

    const bundle = { "main.js": {}, "vendor.js": {}, "style.css": {} };
    const writeBundle = asFn<[{ dir: string }, Record<string, unknown>], void>(plugin.writeBundle);
    writeBundle({ dir }, bundle);

    const mainAfter = readFileSync(join(dir, "main.js"), "utf-8");
    const manifestBytes = readFileSync(FIXTURE_MANIFEST);
    const expected = vmsHashManifestBytes(manifestBytes);
    expect(expected).toBe(EXPECTED_HASH);
    expect(mainAfter).toContain(`"${expected}"`);
    expect(mainAfter).not.toContain(placeholder);

    // Untouched: no-placeholder chunk and (default extensions) the css.
    expect(readFileSync(join(dir, "vendor.js"), "utf-8")).toBe(vendorSrc);
    expect(readFileSync(join(dir, "style.css"), "utf-8")).toBe(cssSrc);
  });

  it("honors custom extensions and hashLength", () => {
    const plugin = vmsBuildIdPlugin({ extensions: [".css"], hashLength: 8 });
    const config = asFn<[Record<string, unknown>, unknown], Record<string, any>>(plugin.config);
    const placeholder = JSON.parse(
      (config({}, {}).define as Record<string, string>)["import.meta.env.VITE_VMS_BUILD"],
    );

    const dir = makeTmp();
    cpSync(FIXTURE_MANIFEST, join(dir, "manifest.json"));
    writeFileSync(join(dir, "app.css"), `.a{content:"${placeholder}"}`);
    writeFileSync(join(dir, "app.js"), `const b="${placeholder}";`); // NOT in extensions now

    const writeBundle = asFn<[{ dir: string }, Record<string, unknown>], void>(plugin.writeBundle);
    writeBundle({ dir }, { "app.css": {}, "app.js": {} });

    const short = EXPECTED_HASH.slice(0, 8);
    expect(readFileSync(join(dir, "app.css"), "utf-8")).toContain(`"${short}"`);
    // .js is excluded now → placeholder still present.
    expect(readFileSync(join(dir, "app.js"), "utf-8")).toContain(placeholder);
  });
});
