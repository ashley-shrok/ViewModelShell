// Reorder demo — TypeScript mirror of demo/Reorder/AspNetCore/.
// Prototype evaluating the click-to-select-then-place reorder pattern with
// ZERO framework changes: just state + actions + ButtonNode.

import {
  createAction,
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
            action: { name: "move-before", context: { id: item.id } },
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
          action: { name: "move-start", context: { id: item.id } },
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
  const ctx = payload.context ?? {};
  const str = (k: string): string | null => (typeof ctx[k] === "string" ? (ctx[k] as string) : null);

  let state = payload.state;

  switch (payload.name) {
    case "move-start": {
      const id = str("id");
      if (id !== null) state = { ...state, movingId: id };
      break;
    }
    case "move-cancel":
      state = { ...state, movingId: null };
      break;
    case "move-before": {
      const beforeId = str("id");
      if (state.movingId !== null && beforeId !== null && beforeId !== state.movingId) {
        const moving = state.items.find(i => i.id === state.movingId)!;
        const rest = state.items.filter(i => i.id !== state.movingId);
        const idx = rest.findIndex(i => i.id === beforeId);
        rest.splice(idx, 0, moving);
        state = { ...state, items: rest, movingId: null };
      } else {
        state = { ...state, movingId: null };
      }
      break;
    }
    case "move-to-end": {
      if (state.movingId !== null) {
        const moving = state.items.find(i => i.id === state.movingId)!;
        const rest = state.items.filter(i => i.id !== state.movingId);
        rest.push(moving);
        state = { ...state, items: rest, movingId: null };
      }
      break;
    }
    default:
      throw new Error(`Unknown action: ${payload.name}`);
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
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/reorder/action" && request.method === "POST") {
      return actionHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`Reorder Bun backend listening on http://localhost:${port}`);
