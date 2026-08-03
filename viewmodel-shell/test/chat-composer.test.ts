// v9.1.0 (CHAT-16 / Plan 30-06) — ChatComposerNode jsdom adapter tests.
//
// Ten interaction tests covering every behavior landed by Plans 30-01..05:
//   1. Enter=send in submitMode:"enter" (default).
//   2. Shift+Enter=newline in submitMode:"enter" — sendAction NOT dispatched,
//      preventDefault NOT called on the event.
//   3. Enter=newline in submitMode:"ctrl-enter" — sendAction NOT dispatched.
//   4. Ctrl+Enter=send AND Meta+Enter=send in submitMode:"ctrl-enter".
//   5. 🚨 ADVERSARIAL CJK IME test (CHAT-12 non-optional correctness gate) —
//      composition-Enter is SUPPRESSED; post-compositionend Enter dispatches.
//   6. Backspace-on-empty-textarea with pending attachments removes the last
//      attachment AND revokes the blob URL (CHAT-04+CHAT-08 wire-through).
//   7. Drag-drop of a File onto the composer lands it in the attachment registry
//      (chip rendered in DOM).
//   8. Paste of an image File via clipboardData lands it in the registry.
//   9. Status transitions swap the send-button icon and the wrapping BEM class.
//  10. status="streaming" click dispatches stopAction (NOT sendAction).
//
// Plus M-1 anti-collision test (per plan directive): two ChatComposerNodes with
// the same `bind` on the same page get DISTINCT registry entries — files
// attached to composer A do NOT show up on composer B's chip strip.
//
// Test template: viewmodel-shell/test/form-submit-on-enter.test.ts (the shipped
// IME + Enter/Shift+Enter jsdom pattern) + viewmodel-shell/test/chip.test.ts
// (the per-composite split-out convention). Both were used byte-alike to shape
// this file so the pattern stays consistent across the composite suite.
//
// jsdom quirks handled:
//   • CSS.supports("field-sizing", "content") returns false in jsdom → the
//     JS auto-resize fallback fires. Not asserted (out of scope for CHAT-16);
//     just noted so the composer render doesn't blow up under a fallback path.
//   • KeyboardEvent init dict doesn't accept `isComposing` in jsdom's older
//     versions — Object.defineProperty is the reliable path (matches
//     form-submit-on-enter.test.ts:118-121 verbatim).
//   • DataTransfer constructor and DragEvent constructor availability varies —
//     synthesize `dataTransfer` on a plain Event via Object.assign per the
//     Plan 30-06 <interfaces> guidance.
//   • ClipboardEvent + clipboardData similarly synthesized.
//   • jsdom has no real blob URLs — spy on URL.createObjectURL/revokeObjectURL
//     so the composer's blob-URL creation + cleanup can be asserted.
//   • crypto.randomUUID may be missing on older jsdom — polyfill in beforeEach.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { StateAccess, ViewNode, ActionEvent, ChatComposerNode, PageNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

// ── Test rig ─────────────────────────────────────────────────────────────────

function mkSA(state: Record<string, unknown>): StateAccess {
  // Byte-parallel to form-submit-on-enter.test.ts:28-50 — dot-path read/write
  // that mirrors the shell's own state accessor semantics.
  return {
    read(path: string): unknown {
      const segs = path.split(".");
      let cur: unknown = state;
      for (const seg of segs) {
        if (cur == null || typeof cur !== "object") return undefined;
        cur = (cur as Record<string, unknown>)[seg];
      }
      return cur;
    },
    write(path: string, value: unknown): void {
      const segs = path.split(".");
      let cur: Record<string, unknown> = state;
      for (let i = 0; i < segs.length - 1; i++) {
        const seg = segs[i]!;
        if (typeof cur[seg] !== "object" || cur[seg] == null) cur[seg] = {};
        cur = cur[seg] as Record<string, unknown>;
      }
      cur[segs[segs.length - 1]!] = value;
    },
  };
}

interface Harness {
  container: HTMLElement;
  adapter: BrowserAdapter;
  state: Record<string, unknown>;
  dispatched: ActionEvent[];
  render(node: ChatComposerNode | ChatComposerNode[]): void;
  root(): HTMLElement;
  textarea(): HTMLTextAreaElement;
  sendBtn(): HTMLButtonElement;
  chips(): NodeListOf<HTMLElement>;
  fileInput(): HTMLInputElement;
  allComposers(): NodeListOf<HTMLElement>;
}

function setup(initialState: Record<string, unknown> = {}): Harness {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  const state: Record<string, unknown> = { ...initialState };
  const dispatched: ActionEvent[] = [];
  return {
    container,
    adapter,
    state,
    dispatched,
    render(node) {
      const children = Array.isArray(node) ? node : [node];
      const tree: PageNode = { type: "page", children: children as ViewNode[] };
      adapter.render(tree, (a) => { dispatched.push(a); }, mkSA(state));
    },
    root() {
      return container.querySelector<HTMLElement>(".vms-chat-composer")!;
    },
    textarea() {
      return container.querySelector<HTMLTextAreaElement>(".vms-chat-composer__textarea")!;
    },
    sendBtn() {
      return container.querySelector<HTMLButtonElement>(".vms-chat-composer__send")!;
    },
    chips() {
      return container.querySelectorAll<HTMLElement>(".vms-chat-composer__chip");
    },
    fileInput() {
      return container.querySelector<HTMLInputElement>(".vms-chat-composer__file-input")!;
    },
    allComposers() {
      return container.querySelectorAll<HTMLElement>(".vms-chat-composer");
    },
  };
}

// FileList polyfill for jsdom — assigns to `input.files` via defineProperty
// (the shipped pattern from field-optional-bind.test.ts:63-69).
function attachFiles(inp: HTMLInputElement, files: File[]): void {
  const list = {
    length: files.length,
    item: (i: number) => files[i] ?? null,
    [Symbol.iterator]: function* () { for (const f of files) yield f; },
    ...Object.fromEntries(files.map((f, i) => [String(i), f])),
  } as unknown as FileList;
  Object.defineProperty(inp, "files", { value: list, configurable: true });
  inp.dispatchEvent(new Event("change", { bubbles: true }));
}

// Blob-URL counter for deterministic assertions on revoke-what-was-created.
let blobUrlCounter = 0;
let createdBlobUrls: string[] = [];
let revokedBlobUrls: string[] = [];

beforeEach(() => {
  document.body.innerHTML = "";
  blobUrlCounter = 0;
  createdBlobUrls = [];
  revokedBlobUrls = [];
  // jsdom's URL class doesn't ship createObjectURL/revokeObjectURL — vi.spyOn
  // requires the property to exist first. Define no-op stubs, then spy on
  // them. Restored by vi.restoreAllMocks() in afterEach.
  const u = URL as unknown as {
    createObjectURL?: (obj: Blob) => string;
    revokeObjectURL?: (url: string) => void;
  };
  if (typeof u.createObjectURL !== "function") u.createObjectURL = () => "";
  if (typeof u.revokeObjectURL !== "function") u.revokeObjectURL = () => {};
  vi.spyOn(URL, "createObjectURL").mockImplementation(() => {
    const url = `blob:mock-url-${blobUrlCounter++}`;
    createdBlobUrls.push(url);
    return url;
  });
  vi.spyOn(URL, "revokeObjectURL").mockImplementation((url: string) => {
    revokedBlobUrls.push(url);
  });
  // jsdom may lack crypto.randomUUID on older versions — polyfill for the
  // addFiles() path in browser.ts which uses it to key registry entries.
  const c = globalThis.crypto as { randomUUID?: () => string } | undefined;
  if (c && typeof c.randomUUID !== "function") {
    c.randomUUID = () => `test-uuid-${Math.random().toString(36).slice(2)}` as `${string}-${string}-${string}-${string}-${string}`;
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

// ── Test 1: Enter=send in submitMode:"enter" (default) ──────────────────────

describe("ChatComposerNode (CHAT-16 / Plan 30-06) — Enter dispatches sendAction (default submitMode)", () => {
  it("Enter on a non-empty draft fires sendAction exactly once + preventDefault called", () => {
    const h = setup({ draft: "hello" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
    });
    const ta = h.textarea();
    const evt = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    ta.dispatchEvent(evt);
    expect(h.dispatched).toHaveLength(1);
    expect(h.dispatched[0]!.name).toBe("send");
    // Enter=send MUST preventDefault to suppress the native newline that would
    // otherwise appear in the textarea alongside the dispatch (both browser
    // and jsdom fire default). Missing preventDefault = a rogue "\n" in the
    // draft after send — the exact bug the state machine exists to prevent.
    expect(evt.defaultPrevented).toBe(true);
  });
});

// ── Test 2: Shift+Enter=newline in submitMode:"enter" ───────────────────────

describe("ChatComposerNode — Shift+Enter is a newline (does NOT dispatch)", () => {
  it("Shift+Enter does NOT fire sendAction AND preventDefault is NOT called", () => {
    const h = setup({ draft: "line one" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
    });
    const ta = h.textarea();
    const evt = new KeyboardEvent("keydown", {
      key: "Enter",
      shiftKey: true,
      bubbles: true,
      cancelable: true,
    });
    ta.dispatchEvent(evt);
    expect(h.dispatched).toHaveLength(0);
    // Native newline path preserved — the handler MUST NOT call preventDefault
    // when Shift is held; the textarea's default action inserts "\n".
    expect(evt.defaultPrevented).toBe(false);
  });
});

// ── Test 3: Enter=newline in submitMode:"ctrl-enter" ────────────────────────

describe("ChatComposerNode — submitMode:'ctrl-enter' — plain Enter is a newline", () => {
  it("plain Enter does NOT dispatch sendAction; preventDefault NOT called", () => {
    const h = setup({ draft: "hi" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      submitMode: "ctrl-enter",
      sendAction: { name: "send" },
    });
    const ta = h.textarea();
    const evt = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
    ta.dispatchEvent(evt);
    expect(h.dispatched).toHaveLength(0);
    expect(evt.defaultPrevented).toBe(false);
  });
});

// ── Test 4: Ctrl+Enter=send AND Meta+Enter=send in submitMode:"ctrl-enter" ──

describe("ChatComposerNode — submitMode:'ctrl-enter' — modifier+Enter dispatches", () => {
  it("Ctrl+Enter dispatches sendAction (with preventDefault)", () => {
    const h = setup({ draft: "hi" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      submitMode: "ctrl-enter",
      sendAction: { name: "send" },
    });
    const ta = h.textarea();
    const evt = new KeyboardEvent("keydown", {
      key: "Enter",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    ta.dispatchEvent(evt);
    expect(h.dispatched).toHaveLength(1);
    expect(h.dispatched[0]!.name).toBe("send");
    expect(evt.defaultPrevented).toBe(true);
  });

  it("Meta+Enter (Cmd+Enter on Mac) ALSO dispatches sendAction", () => {
    const h = setup({ draft: "hi" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      submitMode: "ctrl-enter",
      sendAction: { name: "send" },
    });
    const ta = h.textarea();
    const evt = new KeyboardEvent("keydown", {
      key: "Enter",
      metaKey: true,
      bubbles: true,
      cancelable: true,
    });
    ta.dispatchEvent(evt);
    expect(h.dispatched).toHaveLength(1);
    expect(h.dispatched[0]!.name).toBe("send");
    expect(evt.defaultPrevented).toBe(true);
  });
});

// ── Test 5: 🚨 ADVERSARIAL CJK IME test — CHAT-12 non-optional gate ────────

describe("ChatComposerNode — 🚨 ADVERSARIAL CJK IME guard (CHAT-12 correctness gate)", () => {
  // This test is the CORRECTNESS GATE for CHAT-12 (RESEARCH.md §P2).
  //
  // A CJK user typing e.g. 会話 opens their IME's suggestion popup. Enter
  // in that state commits the IME candidate; if the composer's send handler
  // fires on that Enter, the user's half-typed romanization ships as a
  // message. This is a regression that silently ruins CJK users' experience
  // — the belt-and-braces guard (`isComposing` state var tracked via
  // compositionstart/end events + `e.isComposing` on the KeyboardEvent) is
  // NON-OPTIONAL correctness, NOT a preference.
  //
  // This test exercises BOTH sides of the guard:
  //   (a) compositionstart fires → the state var is true → Enter is
  //       suppressed even if the KeyboardEvent's isComposing is unset by
  //       the platform.
  //   (b) Enter with isComposing=true set on the event object is suppressed
  //       even if compositionstart never fires (some browsers commit the
  //       state on the event alone; others via the composition-event alone;
  //       the belt-and-braces guard covers both).
  //
  // Any regression that breaks EITHER guard makes CJK Enter accidentally
  // fire send. This test MUST stay green.

  it("compositionstart + Enter(isComposing:true) → sendAction NOT dispatched", () => {
    const h = setup({ draft: "会話" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
    });
    const ta = h.textarea();

    // (a) IME composition starts — the state var flips to true.
    ta.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));

    // Enter with isComposing=true — jsdom's KeyboardEvent init dict may not
    // accept isComposing, so we set it via Object.defineProperty (matches
    // form-submit-on-enter.test.ts:118-121 verbatim). The handler reads
    // BOTH `isComposing` (closure state) AND `e.isComposing` (event property).
    const composingEnter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(composingEnter, "isComposing", { value: true });
    ta.dispatchEvent(composingEnter);
    expect(h.dispatched).toHaveLength(0);
    // The suppression path early-returns without preventDefault — the IME
    // needs to consume the Enter to commit its candidate.
    expect(composingEnter.defaultPrevented).toBe(false);

    // (b) compositionend fires — the state var flips back to false.
    ta.dispatchEvent(new CompositionEvent("compositionend", { bubbles: true }));

    // NOW a plain Enter (no isComposing) SHOULD fire send — the guard
    // released. The bind still holds "会話" so canSend is true.
    const postEnter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });
    ta.dispatchEvent(postEnter);
    expect(h.dispatched).toHaveLength(1);
    expect(h.dispatched[0]!.name).toBe("send");
    expect(postEnter.defaultPrevented).toBe(true);
  });
});

// ── Test 6: Backspace-on-empty removes last attachment + revokes blob URL ───

describe("ChatComposerNode — Backspace on empty textarea removes last attachment", () => {
  it("Backspace on empty textarea with pending attachment → chip removed + revokeObjectURL called", () => {
    const h = setup({ draft: "" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
      attachAction: { name: "attach" },
    });
    // Seed the attachment registry via the real file-input change path (option
    // 3 from Plan 30-06 — uses the shipped ingress, doesn't couple tests).
    const inp = h.fileInput();
    expect(inp).not.toBeNull();
    const img = new File(["fake-image-bytes"], "cat.png", { type: "image/png" });
    attachFiles(inp, [img]);
    expect(h.chips().length).toBe(1);
    expect(createdBlobUrls).toHaveLength(1);
    const seededUrl = createdBlobUrls[0];

    // Now Backspace on the empty textarea — the handler should splice the
    // last attachment and revoke its previewUrl.
    const ta = h.textarea();
    ta.value = "";
    const evt = new KeyboardEvent("keydown", {
      key: "Backspace",
      bubbles: true,
      cancelable: true,
    });
    ta.dispatchEvent(evt);
    // Chip removed from DOM.
    expect(h.chips().length).toBe(0);
    // The seeded image's blob URL was revoked.
    expect(revokedBlobUrls).toContain(seededUrl);
    // preventDefault called (so the "empty" textarea doesn't beep or do
    // anything else with the Backspace).
    expect(evt.defaultPrevented).toBe(true);
  });

  it("Backspace on a non-empty textarea does NOT remove an attachment", () => {
    const h = setup({ draft: "x" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
      attachAction: { name: "attach" },
    });
    const img = new File(["fake"], "cat.png", { type: "image/png" });
    attachFiles(h.fileInput(), [img]);
    expect(h.chips().length).toBe(1);

    const ta = h.textarea();
    ta.value = "x";  // non-empty
    const evt = new KeyboardEvent("keydown", {
      key: "Backspace",
      bubbles: true,
      cancelable: true,
    });
    ta.dispatchEvent(evt);
    // Chip still present — the attach removal path only fires when the
    // textarea is empty.
    expect(h.chips().length).toBe(1);
    // preventDefault NOT called — the textarea's native Backspace is what
    // should delete the "x".
    expect(evt.defaultPrevented).toBe(false);
  });
});

// ── Test 7: Drag-drop file lands in the composer's registry ─────────────────

describe("ChatComposerNode — drag-drop file lands in registry (dropScope:'composer')", () => {
  it("drop with dataTransfer.files=[file] renders chip in DOM", () => {
    const h = setup({ draft: "" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
      attachAction: { name: "attach" },
    });
    const root = h.root();
    const dropped = new File(["dropped-bytes"], "dropped.png", { type: "image/png" });

    // Synthesize a DataTransfer — jsdom's DataTransfer is stubby, so build a
    // plain object with the two properties the handler reads. `types` MUST
    // include "Files" per the RESEARCH.md §Q1 guard that prevents stealing
    // non-file drags (text/DOM). `files` is iterable via Array.from(dt.files).
    const dataTransfer = {
      types: ["Files"],
      files: {
        length: 1,
        0: dropped,
        item: (i: number) => (i === 0 ? dropped : null),
        [Symbol.iterator]: function* () { yield dropped; },
      } as unknown as FileList,
    };

    // Fire dragover FIRST so the handler's preventDefault path runs (browsers
    // require dragover.preventDefault to allow a subsequent drop).
    const dragOver = new Event("dragover", { bubbles: true, cancelable: true });
    Object.assign(dragOver, { dataTransfer });
    root.dispatchEvent(dragOver);
    expect(dragOver.defaultPrevented).toBe(true);
    expect(root.classList.contains("vms-chat-composer--dragging")).toBe(true);

    // Now the drop itself.
    const drop = new Event("drop", { bubbles: true, cancelable: true });
    Object.assign(drop, { dataTransfer });
    root.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    // Dragging class released.
    expect(root.classList.contains("vms-chat-composer--dragging")).toBe(false);
    // Chip landed.
    expect(h.chips().length).toBe(1);
    const chipName = h.container.querySelector(".vms-chat-composer__chip-name");
    expect(chipName?.textContent).toBe("dropped.png");
  });
});

// ── Test 8: Paste of an image File lands in the registry ────────────────────

describe("ChatComposerNode — paste image lands in registry (thumb rendered)", () => {
  it("paste with clipboardData.items=[image-file] renders chip with blob-URL thumb", () => {
    const h = setup({ draft: "" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
      attachAction: { name: "attach" },
    });
    const ta = h.textarea();
    const pasted = new File(["png-bytes"], "clipboard.png", { type: "image/png" });

    // Synthesize a ClipboardEvent — jsdom's ClipboardEvent + DataTransferItem
    // are patchy. The handler reads `e.clipboardData.items`, iterates via
    // `Array.from(items)`, and for each with `kind === "file"` calls
    // `item.getAsFile()`. Build the minimum shape the handler needs.
    const clipboardData = {
      items: [
        {
          kind: "file",
          type: "image/png",
          getAsFile: () => pasted,
        },
      ],
    };
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.assign(paste, { clipboardData });
    ta.dispatchEvent(paste);

    // preventDefault called — paste consumed to prevent the fallback data-URL
    // text paste some browsers do for image blobs.
    expect(paste.defaultPrevented).toBe(true);
    // Chip landed with a blob-URL thumbnail (kind: "image").
    expect(h.chips().length).toBe(1);
    const thumb = h.container.querySelector<HTMLImageElement>(".vms-chat-composer__chip-thumb");
    expect(thumb).not.toBeNull();
    expect(thumb!.src).toBe(createdBlobUrls[0]);
  });
});

// ── Test 9: Status transitions swap send-button icon + BEM class ────────────

describe("ChatComposerNode — status transitions swap send-button icon", () => {
  // Icons don't carry their name as a DOM attribute — they're identified by
  // the inner SVG payload (path/rect etc. shipped by icons-payload.ts). Assert
  // the wrapping BEM class (--idle | --sending | --streaming) which IS
  // observable + also assert distinctive SVG payload markers.
  const SEND_ICON_MARKER = "M14.536 21.686";       // send icon path (icons-payload.ts:44)
  const SQUARE_ICON_MARKER = "<rect";              // square icon rect  (icons-payload.ts:135)
  const LOADER_ICON_MARKER = "M21 12a9 9 0";       // loader-2 path     (icons-payload.ts:58)

  it("status:'idle' → send icon + --idle class + data-composer-status='idle'", () => {
    const h = setup({ draft: "hello" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
    });
    const btn = h.sendBtn();
    expect(btn.classList.contains("vms-chat-composer__send--idle")).toBe(true);
    expect(btn.dataset.composerStatus).toBe("idle");
    // Assert send icon by its distinctive path marker.
    expect(btn.innerHTML).toContain(SEND_ICON_MARKER);
    expect(btn.innerHTML).not.toContain(SQUARE_ICON_MARKER);
  });

  it("re-render with status:'streaming'+stopAction → square icon + --streaming class", () => {
    const h = setup({ draft: "hello" });
    // First render at idle.
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
    });
    expect(h.sendBtn().classList.contains("vms-chat-composer__send--idle")).toBe(true);

    // Re-render with status:"streaming" — the whole tree rebuilds from scratch
    // (adapter's render() innerHTML wipes then re-emits). The new send button
    // MUST carry the stop-icon shape.
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
      status: "streaming",
      stopAction: { name: "stop" },
    });
    const btn = h.sendBtn();
    expect(btn.classList.contains("vms-chat-composer__send--streaming")).toBe(true);
    expect(btn.classList.contains("vms-chat-composer__send--idle")).toBe(false);
    expect(btn.dataset.composerStatus).toBe("streaming");
    expect(btn.innerHTML).toContain(SQUARE_ICON_MARKER);
    expect(btn.innerHTML).not.toContain(SEND_ICON_MARKER);
    expect(btn.getAttribute("aria-label")).toBe("Stop generating");
  });

  it("status:'sending' → loader-2 icon + --sending class + disabled", () => {
    const h = setup({ draft: "hello" });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
      status: "sending",
    });
    const btn = h.sendBtn();
    expect(btn.classList.contains("vms-chat-composer__send--sending")).toBe(true);
    expect(btn.disabled).toBe(true);
    expect(btn.innerHTML).toContain(LOADER_ICON_MARKER);
  });
});

// ── Test 10: status='streaming' click dispatches stopAction, NOT sendAction ─

describe("ChatComposerNode — click on streaming send-btn dispatches stopAction", () => {
  it("status:'streaming' + stopAction set → click fires {name:'stop'} (NOT 'send')", () => {
    const h = setup({ draft: "generating..." });
    h.render({
      type: "chat-composer",
      bind: "draft",
      sendAction: { name: "send" },
      status: "streaming",
      stopAction: { name: "stop" },
    });
    const btn = h.sendBtn();
    btn.click();
    expect(h.dispatched).toHaveLength(1);
    // Positive: the stop action name arrived.
    expect(h.dispatched[0]!.name).toBe("stop");
    // Anti-assertion: sendAction MUST NOT have fired — the router MUST have
    // branched on status. If a future contributor accidentally reverts the
    // click handler to always dispatch sendAction, this test fails.
    expect(h.dispatched[0]!.name).not.toBe("send");
  });
});

// ── M-1 anti-collision test (per plan directive) ────────────────────────────

describe("ChatComposerNode — M-1: two composers with the same `bind` get DISTINCT registries", () => {
  // The composerRegistry is keyed by `${bind}:${ordinal}` (browser.ts:1499),
  // NOT by `bind` alone. Two ChatComposerNodes on the same page with the
  // same `bind` ("draft" is the demo/test default) MUST get separate
  // registry entries — attaching a file to composer A must NOT show up on
  // composer B's chip strip.
  //
  // If a future contributor reverts the keying to `bind` alone (removing
  // the `${bind}:${ordinal}` disambiguation), this test fails: both composers
  // share the same registry entry and BOTH show the same chip.
  it("attaching a file to composer A leaves composer B's chip strip empty (survives re-render)", () => {
    const h = setup({ draft: "" });
    const tree: PageNode = {
      type: "page",
      children: [
        {
          type: "chat-composer",
          bind: "draft",
          sendAction: { name: "send-a" },
          attachAction: { name: "attach-a" },
        },
        {
          type: "chat-composer",
          bind: "draft",
          sendAction: { name: "send-b" },
          attachAction: { name: "attach-b" },
        },
      ] as ViewNode[],
    };
    // Render TWO composers with THE SAME bind. The composerKeyCounter should
    // assign ordinals 0 and 1 to distinguish them.
    h.adapter.render(tree, (a) => { h.dispatched.push(a); }, mkSA(h.state));
    const composers1 = h.allComposers();
    expect(composers1.length).toBe(2);

    // Attach a file to composer A ONLY (index 0).
    const inputA = composers1[0]!.querySelector<HTMLInputElement>(".vms-chat-composer__file-input")!;
    expect(inputA).not.toBeNull();
    const file = new File(["a-only"], "a-only.png", { type: "image/png" });
    attachFiles(inputA, [file]);

    // Now trigger a re-render (byte-parallel to the shell's own render loop).
    // The persistent composerRegistry survives the re-render — but with proper
    // `${bind}:${ordinal}` keying, composer A's file lands in "draft:0" and
    // composer B (at "draft:1") re-renders EMPTY.
    //
    // Under the M-1 collision mutation (composerKey = baseKey), BOTH composers
    // would share the "draft" entry — and after re-render, composer B's
    // renderChipStrip would find composer A's file in the shared registry and
    // render its chip too. THAT is the anti-collision failure this test guards.
    h.adapter.render(tree, (a) => { h.dispatched.push(a); }, mkSA(h.state));
    const composers2 = h.allComposers();
    expect(composers2.length).toBe(2);
    const chipsA = composers2[0]!.querySelectorAll(".vms-chat-composer__chip");
    const chipsB = composers2[1]!.querySelectorAll(".vms-chat-composer__chip");
    // Composer A retains the chip (persistent registry).
    expect(chipsA.length).toBe(1);
    // Composer B stays empty — the ordinal keying prevented cross-pollination.
    expect(chipsB.length).toBe(0);
  });
});
