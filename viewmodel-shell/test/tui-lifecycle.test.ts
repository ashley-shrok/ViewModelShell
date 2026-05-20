// @vitest-environment node
//
// TuiAdapter lifecycle smoke (B1) — narrow, library-agnostic checks that
// the adapter's PUBLIC surface holds across the substrate rewrite:
//
//   - constructor accepts the documented option shape (viewport,
//     sidebarFraction) without throwing;
//   - the side-channel capability verbs (storage, saveFile, _peekSession)
//     behave the same as on the Ink adapter (the verbs themselves are
//     library-agnostic — they're file-system + child_process, not
//     terminal-renderer concerns);
//   - dispose() is idempotent and does not throw before any render.
//
// Interactive behavior (render → mount → mouse / scroll / keyboard) is
// validated by the manual smoke against a demo backend (the B1
// verification gate item) and by phase B5's interaction-polish tests.
// We deliberately do NOT mount a real OpenTUI renderer in this file —
// that requires a TTY + the platform binary loaded with Bun's FFI, both
// of which are environment-fragile in CI.

import { describe, it, expect, afterEach, vi } from "vitest";
import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  rmSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { TuiAdapter } from "../src/tui.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("0.6.0 — TuiAdapter constructor", () => {
  it("accepts no options", () => {
    expect(() => new TuiAdapter()).not.toThrow();
  });
  it("accepts viewport: 'fill'", () => {
    expect(() => new TuiAdapter({ viewport: "fill" })).not.toThrow();
  });
  it("accepts viewport: 'content'", () => {
    expect(() => new TuiAdapter({ viewport: "content" })).not.toThrow();
  });
  it("accepts sidebarFraction in valid range", () => {
    expect(() => new TuiAdapter({ sidebarFraction: 0.3 })).not.toThrow();
  });
});

describe("0.6.0 — dispose() is idempotent + safe before render()", () => {
  it("dispose before render does not throw", () => {
    const adapter = new TuiAdapter();
    expect(() => adapter.dispose()).not.toThrow();
  });
  it("dispose twice does not throw", () => {
    const adapter = new TuiAdapter();
    adapter.dispose();
    expect(() => adapter.dispose()).not.toThrow();
  });
});

describe("0.6.0 — storage capability (XDG state file)", () => {
  it("session storage is in-memory only — no file written", () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-xdg-"));
    vi.stubEnv("XDG_STATE_HOME", tmp);
    try {
      const adapter = new TuiAdapter();
      adapter.storage("session", "s", "v");
      expect(adapter._peekSession("s")).toBe("v");
      expect(existsSync(join(tmp, "vms-tui", "storage.json"))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("local storage writes the XDG state file", () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-xdg-"));
    vi.stubEnv("XDG_STATE_HOME", tmp);
    try {
      const adapter = new TuiAdapter();
      adapter.storage("local", "k", "v");
      const file = join(tmp, "vms-tui", "storage.json");
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ k: "v" });
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("local storage I/O failure does not throw into the caller", () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-xdg-"));
    const asFile = join(tmp, "not-a-dir");
    writeFileSync(asFile, "x"); // XDG base is a FILE → mkdir under it = ENOTDIR
    vi.stubEnv("XDG_STATE_HOME", asFile);
    try {
      const adapter = new TuiAdapter();
      expect(() => adapter.storage("local", "k", "v")).not.toThrow();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe("0.6.0 — saveFile capability (download to disk)", () => {
  it("writes the blob bytes to $XDG_DOWNLOAD_DIR/<filename>", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-dl-"));
    vi.stubEnv("XDG_DOWNLOAD_DIR", tmp);
    try {
      const adapter = new TuiAdapter();
      await adapter.saveFile(new Blob(["hello"]), "greeting.txt", "text/plain");
      expect(readFileSync(join(tmp, "greeting.txt"), "utf8")).toBe("hello");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("sanitizes filename — path traversal lands the file INSIDE the dir", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-dl-"));
    vi.stubEnv("XDG_DOWNLOAD_DIR", tmp);
    try {
      const adapter = new TuiAdapter();
      await adapter.saveFile(new Blob(["x"]), "../../etc/passwd", "text/plain");
      expect(readFileSync(join(tmp, "passwd"), "utf8")).toBe("x");
      expect(existsSync(join(tmp, "..", "etc", "passwd"))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("sanitizes Windows-style backslash separators", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-dl-"));
    vi.stubEnv("XDG_DOWNLOAD_DIR", tmp);
    try {
      const adapter = new TuiAdapter();
      await adapter.saveFile(new Blob(["y"]), "..\\..\\Windows\\System32\\evil.bin", "application/octet-stream");
      expect(readFileSync(join(tmp, "evil.bin"), "utf8")).toBe("y");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("dot-only / empty filename collapses to the literal 'download' fallback", async () => {
    const tmp = mkdtempSync(join(tmpdir(), "vms-dl-"));
    vi.stubEnv("XDG_DOWNLOAD_DIR", tmp);
    try {
      const adapter = new TuiAdapter();
      await adapter.saveFile(new Blob(["z"]), "...", "application/octet-stream");
      expect(readFileSync(join(tmp, "download"), "utf8")).toBe("z");
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
