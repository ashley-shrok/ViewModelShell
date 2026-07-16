// Reorder demo — TypeScript mirror of demo/Reorder/AspNetCore/.
//
// The CANONICAL, framework-blessed way to reorder a list, TWO patterns, BOTH
// built from primitives that already exist (buttons + a modal + named actions)
// — ZERO new framework capability:
//
//   1. Up / Down buttons per row = fine-grained reorder WITHIN a group (first
//      row's Up + last row's Down are `disabled`).
//   2. A "Move…" button opens a MODAL listing the other groups; picking one
//      RELOCATES the item there (the "move into a folder" case DnD would do).
//
// Pointer drag-and-drop is deliberately REJECTED (mouse-only → not agent- or
// keyboard-drivable). Every reorder is a discrete NAMED action, identical for a
// human clicking, a keyboard user tabbing, and an agent over the wire. Per-row
// identity is encoded in the action name (Phase 6 / WIRE-07).

import {
  UnknownActionError,
  createAction,
  validateActionNames,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface ReorderItem {
  id: string;
  label: string;
  folder: string;
}

interface ReorderState {
  items: ReorderItem[];
  moveOpenId?: string;
}

// (key, display label), rendered top-to-bottom in this order.
const FOLDERS: ReadonlyArray<{ key: string; label: string }> = [
  { key: "backlog", label: "Backlog" },
  { key: "active",  label: "Active" },
  { key: "archive", label: "Archive" },
];

function initialState(): ReorderState {
  return {
    items: [
      { id: "a", label: "Alpha",   folder: "backlog" },
      { id: "b", label: "Bravo",   folder: "backlog" },
      { id: "c", label: "Charlie", folder: "backlog" },
      { id: "d", label: "Delta",   folder: "active" },
      { id: "e", label: "Echo",    folder: "active" },
      // "archive" starts empty (shows the empty-group rendering).
    ],
    moveOpenId: undefined,
  };
}

// Swap the item with its nearest same-folder neighbour in `dir` (-1 up, +1
// down). No-op (clamp) if there is no neighbour in that direction.
function swap(items: ReorderItem[], id: string, dir: number): void {
  const i = items.findIndex(x => x.id === id);
  if (i < 0) return;
  const folder = items[i].folder;
  for (let j = i + dir; j >= 0 && j < items.length; j += dir) {
    if (items[j].folder === folder) {
      const t = items[i];
      items[i] = items[j];
      items[j] = t;
      return;
    }
  }
}

function buildVm(state: ReorderState): ViewNode {
  const children: ViewNode[] = [
    {
      type: "text",
      value:
        "Reorder within a group with Up / Down. Use Move… to relocate an " +
        "item to another group. No drag-and-drop — every reorder is a named " +
        "action, so it works for keyboard users and agents too.",
      style: "muted",
    },
  ];

  for (const { key, label } of FOLDERS) {
    const group = state.items.filter(i => i.folder === key);
    let body: ViewNode;
    if (group.length === 0) {
      body = { type: "text", value: "(empty)", style: "muted" };
    } else {
      const rows: ViewNode[] = group.map<ViewNode>((item, k) => ({
        type: "list-item",
        id: item.id,
        children: [
          { type: "text", value: item.label },
          // disabled is an optional bool → present ONLY when true (false = absent
          // on the wire, matching the .NET WhenWritingDefault posture / parity F2).
          { type: "button", label: "Up",   action: { name: `move-up-${item.id}` },
            emphasis: "secondary", size: "sm", ...(k === 0 ? { disabled: true } : {}) },
          { type: "button", label: "Down", action: { name: `move-down-${item.id}` },
            emphasis: "secondary", size: "sm", ...(k === group.length - 1 ? { disabled: true } : {}) },
          { type: "button", label: "Move…", action: { name: `move-open-${item.id}` },
            emphasis: "secondary", size: "sm" },
        ],
      }));
      body = { type: "list", children: rows };
    }
    children.push({ type: "section", heading: label, variant: "card", children: [body] });
  }

  // "Move to another group" modal (relocation). Lists every OTHER group.
  if (state.moveOpenId !== undefined) {
    const moving = state.items.find(i => i.id === state.moveOpenId) ?? null;
    if (moving) {
      const dests: ViewNode[] = FOLDERS
        .filter(f => f.key !== moving.folder)
        .map<ViewNode>(f => ({
          type: "button",
          label: f.label,
          action: { name: `move-to-${f.key}-${moving.id}` },
          emphasis: "primary",
          width: "full",
        }));
      children.push({
        type: "modal",
        title: `Move “${moving.label}” to…`,
        children: dests,
        // Cancel = the modal's close (X). No same-named footer button (a modal
        // must not carry both dismissAction and a same-named footer Close —
        // AGENTS.md gotcha).
        dismissAction: { name: "move-close" },
      });
    }
  }

  return { type: "page", title: "Reorder", children };
}

const actionHandler = createAction<ReorderState>(async (payload) => {
  let state = payload.state;
  const name = payload.name;
  const items = [...state.items];

  if (name.startsWith("move-up-")) {
    swap(items, name.slice("move-up-".length), -1);
    state = { ...state, items };
  } else if (name.startsWith("move-down-")) {
    swap(items, name.slice("move-down-".length), +1);
    state = { ...state, items };
  } else if (name.startsWith("move-open-")) {
    state = { ...state, moveOpenId: name.slice("move-open-".length) };
  } else if (name === "move-close") {
    state = { ...state, moveOpenId: undefined };
  } else if (name.startsWith("move-to-")) {
    // move-to-<folderKey>-<id> — folderKey has no hyphen, split on first '-'.
    const rest = name.slice("move-to-".length);
    const dash = rest.indexOf("-");
    if (dash > 0) {
      const folderKey = rest.slice(0, dash);
      const id = rest.slice(dash + 1);
      const idx = items.findIndex(i => i.id === id);
      const valid = FOLDERS.some(f => f.key === folderKey);
      if (idx >= 0 && valid) {
        const moving = { ...items[idx], folder: folderKey };
        items.splice(idx, 1);
        items.push(moving); // append → becomes last in its new group
        state = { ...state, items };
      }
    }
    state = { ...state, moveOpenId: undefined };
  } else {
    throw new UnknownActionError(name);
  }

  return { vm: buildVm(state), state };
});

const port = Number(process.env.PORT ?? "3007");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/reorder" && request.method === "GET") {
      const state = initialState();
      const vm = buildVm(state);
      validateActionNames(vm);
      return Response.json({ ok: true, vm, state });
    }
    if (url.pathname === "/api/reorder/action" && request.method === "POST") {
      return actionHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Reorder Bun backend listening on http://localhost:${port}`);
