// ─── ViewModel Shell — vite subpath (3.11.0) ─────────────────────────────────
// A Vite plugin that packages the version-skew (3.8.0) client build-id contract
// so adopters stop hand-rolling the ~40-line placeholder/writeBundle glue.
//
// Adoption drops to two lines:
//   // vite.config.ts
//   import { vmsBuildIdPlugin } from "@ashley-shrok/viewmodel-shell/vite";
//   export default { plugins: [vmsBuildIdPlugin()] };
//   // shell init
//   new ViewModelShell({ …, clientBuildId: import.meta.env.VITE_VMS_BUILD });
//
// The `vite` import is TYPE-ONLY (`import type`), so the built `dist/vite.js`
// carries NO runtime `require("vite")` — non-Vite consumers of the root package
// never pull vite in. Node builtins (`fs`/`crypto`/`path`) are fine here: the
// core-globals CI guard only scopes `src/index.ts`.

import { createHash, randomBytes } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

/**
 * Hash the raw bytes of a Vite `manifest.json` into a VMS client build-id.
 *
 * The LOCKED cross-backend contract: SHA-256 of the **raw file bytes on disk**
 * → the **first `hashLength` hex chars, LOWERCASE**. No re-serialize, no JSON
 * normalization, no BOM handling — both the npm plugin and the .NET
 * `VmsManifestBuildId.Compute` hash the exact same bytes so a client's
 * compiled-in id matches the server-computed id byte-for-byte across the fleet.
 *
 * Exported so the cross-backend hash-lock test can call it directly against the
 * shared fixture bytes.
 *
 * @param bytes    Raw `manifest.json` file bytes.
 * @param hashLength Number of leading hex chars to keep (default 12).
 */
export function vmsHashManifestBytes(bytes: Uint8Array, hashLength = 12): string {
  return createHash("sha256").update(bytes).digest("hex").slice(0, hashLength);
}

/**
 * Options for {@link vmsBuildIdPlugin}.
 */
export interface VmsBuildIdPluginOptions {
  /**
   * File extensions of emitted chunks whose source should have the build-id
   * placeholder substituted. Default `[".js"]` — the shell bundle is JS, so CSS
   * and other assets are left untouched (and never carry the placeholder).
   */
  extensions?: string[];
  /**
   * Number of leading hex chars of the SHA-256 to use as the build id.
   * Default 12 (the locked contract shared with the .NET side).
   */
  hashLength?: number;
}

/**
 * Vite plugin that stamps a content-hash of the built `manifest.json` into the
 * client bundle so `ShellOptions.clientBuildId` matches the server's
 * `AddVmsShellVersioning()` hash for version-skew detection.
 *
 * ## How it works (the chicken-and-egg fix)
 * Vite writes chunk content-hashes into `manifest.json` during the bundle, so
 * the final manifest hash isn't known until after the bundle is written. The
 * plugin:
 *
 * 1. `config` hook — injects `import.meta.env.VITE_VMS_BUILD` as a unique
 *    internal placeholder token via `define`, and (if unset) turns on
 *    `build.manifest = "manifest.json"` at the server-read path.
 * 2. `writeBundle` hook — reads the emitted `manifest.json` raw bytes, computes
 *    the build id via {@link vmsHashManifestBytes}, and string-replaces the
 *    placeholder in every emitted chunk whose filename ends in one of
 *    `extensions` **that actually contains the placeholder** (the skip-guard —
 *    so non-shell chunks are never rewritten).
 *
 * ## The `build.manifest` gotcha it kills
 * Vite 5+ defaults the manifest to `.vite/manifest.json`, but the .NET server
 * reads `wwwroot/manifest.json`. If those diverge the two sides hash different
 * inputs and skew detection silently breaks. This plugin sets
 * `build.manifest = "manifest.json"` when unset. If the app has ALREADY set a
 * DIFFERENT manifest path, the plugin does NOT override it — it emits a `[vms]`
 * warning so the divergence is loud, not silent.
 *
 * ## Fleet constraint — no post-build modification of `manifest.json`
 * The server hashes `manifest.json` at startup; the client compiled-in id is
 * hashed at build time. A deploy-pipeline step that minifies / prettifies /
 * re-formats `manifest.json` between Vite emit and .NET startup changes the raw
 * bytes and diverges the two hashes. Ship the manifest byte-for-byte as Vite
 * wrote it.
 */
export function vmsBuildIdPlugin(options: VmsBuildIdPluginOptions = {}): Plugin {
  const extensions = options.extensions ?? [".js"];
  const hashLength = options.hashLength ?? 12;
  // Unique per plugin instance — an internal implementation detail, NOT an
  // option, so two co-configured tools can't collide on the token text.
  const placeholder = "__VMS_BUILD_" + randomBytes(4).toString("hex") + "__";

  return {
    name: "vms-build-id",
    apply: "build",

    config(userConfig) {
      const existing = userConfig.build?.manifest;
      if (existing !== undefined && existing !== "manifest.json") {
        // eslint-disable-next-line no-console
        console.warn(
          `[vms] build.manifest is set to ${JSON.stringify(existing)}, but the .NET ` +
            `server reads "manifest.json" (wwwroot/manifest.json). The client and server ` +
            `will hash different files and version-skew detection will not work. ` +
            `Set build.manifest to "manifest.json" (or remove it and let vmsBuildIdPlugin set it).`,
        );
      }
      // Return a partial (merge-friendly) config per Vite's `config` hook contract.
      return {
        define: {
          "import.meta.env.VITE_VMS_BUILD": JSON.stringify(placeholder),
        },
        ...(existing === undefined
          ? { build: { manifest: "manifest.json" } }
          : {}),
      };
    },

    writeBundle(outputOptions, bundle) {
      const dir = outputOptions.dir ?? "";
      const manifestBytes = readFileSync(join(dir, "manifest.json"));
      const buildId = vmsHashManifestBytes(manifestBytes, hashLength);

      for (const fileName of Object.keys(bundle)) {
        if (!extensions.some((ext) => fileName.endsWith(ext))) continue;
        const p = join(dir, fileName);
        const src = readFileSync(p, "utf-8");
        // Skip-guard: only rewrite chunks that actually carry the placeholder,
        // so non-shell chunks are never touched (no double-writes).
        if (src.includes(placeholder)) {
          writeFileSync(p, src.replaceAll(placeholder, buildId));
        }
      }
    },
  };
}
