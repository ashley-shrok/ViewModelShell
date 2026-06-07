// Reorder demo — TypeScript mirror of demo/Reorder/AspNetCore/.
// Prototype evaluating the click-to-select-then-place reorder pattern with
// ZERO framework changes: just state + actions + ButtonNode.
//
// Phase 6 wire-shape migration (0.17.0 / WIRE-07): per-item Move / Place
// buttons carry unique action names (`move-start-${id}` / `move-before-${id}`)
// — per-row identity is encoded in the action name itself. No `bind` paths
// are needed: this demo has no input fields, only buttons.

import {
  createAction,
  validateActionNames,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface ReorderItem {
  id: string;
  label: string;
}

interface ReorderState {
  items: ReorderItem[];
  movingId: string | null;
}

function initialState(): ReorderState {
  return {
    items: [
      { id: "a", label: "Alpha" },
      { id: "b", label: "Bravo" },
      { id: "c", label: "Charlie" },
      { id: "d", label: "Delta" },
      { id: "e", label: "Echo" },
    ],
    movingId: null,
  };
}

function buildVm(state: ReorderState): ViewNode {
  const moving = state.movingId
    ? state.items.find(i => i.id === state.movingId) ?? null
    : null;

  const children: ViewNode[] = [
    {
      type: "text",
      value: moving
        ? `Moving “${moving.label}” — choose where to place it`
        : "Click Move on an item, then Place to reorder.",
      style: moving ? "subheading" : "muted",
    },
  ];

  const listItems: ViewNode[] = state.items.map<ViewNode>(item => {
    if (item.id === state.movingId) {
      return {
        type: "list-item",
        id: item.id,
        variant: "moving",
        children: [
          { type: "text", value: item.label, style: "subheading" },
          { type: "button", label: "Cancel", action: { name: "move-cancel" }, variant: "secondary" },
        ],
      };
    }
    if (state.movingId) {
      return {
        type: "list-item",
        id: item.id,
        children: [
          { type: "text", value: item.label },
          {
            type: "button",
            label: "Place here",
            action: { name: `move-before-${item.id}` },
            variant: "primary",
          },
        ],
      };
    }
    return {
      type: "list-item",
      id: item.id,
      children: [
        { type: "text", value: item.label },
        {
          type: "button",
          label: "Move",
          action: { name: `move-start-${item.id}` },
          variant: "secondary",
        },
      ],
    };
  });

  children.push({ type: "list", children: listItems });

  if (state.movingId) {
    children.push({
      type: "button",
      label: "Place at end",
      action: { name: "move-to-end" },
      variant: "primary",
    });
  }

  return { type: "page", title: "Reorder", children };
}

const actionHandler = createAction<ReorderState>(async (payload) => {
  let state = payload.state;
  const name = payload.name;

  if (name.startsWith("move-start-")) {
    const id = name.slice("move-start-".length);
    state = { ...state, movingId: id };
  } else if (name === "move-cancel") {
    state = { ...state, movingId: null };
  } else if (name.startsWith("move-before-")) {
    const beforeId = name.slice("move-before-".length);
    if (state.movingId !== null && beforeId !== state.movingId) {
      const moving = state.items.find(i => i.id === state.movingId);
      if (moving) {
        const rest = state.items.filter(i => i.id !== state.movingId);
        const idx = rest.findIndex(i => i.id === beforeId);
        if (idx < 0) {
          // Match .NET List<T>.Insert(-1, ...) which throws — silent
          // splice(-1, 0, item) would insert before the LAST element of
          // rest, producing different behavior than the .NET twin on the
          // same malformed input.
          throw new Error(`beforeId '${beforeId}' not found in items`);
        }
        rest.splice(idx, 0, moving);
        state = { ...state, items: rest, movingId: null };
      } else {
        state = { ...state, movingId: null };
      }
    } else {
      state = { ...state, movingId: null };
    }
  } else if (name === "move-to-end") {
    if (state.movingId !== null) {
      const moving = state.items.find(i => i.id === state.movingId);
      if (moving) {
        const rest = state.items.filter(i => i.id !== state.movingId);
        rest.push(moving);
        state = { ...state, items: rest, movingId: null };
      }
    }
  } else {
    throw new Error(`Unknown action: ${name}`);
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
      return Response.json({ vm, state });
    }
    if (url.pathname === "/api/reorder/action" && request.method === "POST") {
      return actionHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Reorder Bun backend listening on http://localhost:${port}`);
