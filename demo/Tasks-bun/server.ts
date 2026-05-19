// Tasks demo — TypeScript backend mirror of demo/Tasks/AspNetCore/.
// Faithful port: same wire format, same action semantics, same vm shape.
// Used as one half of the parity test harness (parity/run.ts).
//
// THE .NET CONTROLLER (demo/Tasks/AspNetCore/TasksController.cs) IS THE
// AUTHORITATIVE SOURCE OF TRUTH. This file mirrors it byte-for-byte (post
// parity/normalize.ts). Layout redesigned in 0.4.0 ("realistic-demo pass"):
// PageNode("Tasks",[rail,main],layout:"sidebar"); rail is a "Views" card
// section with a nav ListNode; main has progress text, progress bar, an
// inline add form, and the task list.

import {
  createAction,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

// The pure handlers (initialState / buildVm / actionHandler) are exported so
// other hosts can reuse this exact, parity-verified Tasks backend without
// re-implementing it (see demo/Tasks-fullstack-bun, which wraps them with a
// static file server). The standalone Bun.serve at the bottom is guarded by
// `import.meta.main`, so importing this file does NOT start a second listener.

export interface TaskRecord {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string; // ISO timestamp — neutralized by parity normalize()
}

export interface TasksState {
  items: TaskRecord[];
  filter: string;
}

export function initialState(): TasksState {
  // Mirrors TasksState.Initial(): ids "1","2","3", exact titles/completed.
  // createdAt is volatile under parity normalize() so only ordering matters;
  // the controller orders the rendered list by CreatedAt ascending, so the
  // seed timestamps here must keep the same relative order (1 < 2 < 3).
  const now = Date.now();
  return {
    items: [
      { id: "1", title: "Set up the project",        completed: true,  createdAt: new Date(now - 3 * 3_600_000).toISOString() },
      { id: "2", title: "Wire the ViewModel shell",  completed: false, createdAt: new Date(now - 1 * 3_600_000).toISOString() },
      { id: "3", title: "Write the render function", completed: false, createdAt: new Date(now - 20 * 60_000).toISOString() },
    ],
    filter: "all",
  };
}

export function buildVm(state: TasksState): ViewNode {
  const total     = state.items.length;
  const completed = state.items.filter(t => t.completed).length;
  const active    = total - completed;
  const pct       = total === 0 ? 0 : Math.round((100 * completed) / total);

  const filtered =
    state.filter === "active"    ? state.items.filter(t => !t.completed)
    : state.filter === "completed" ? state.items.filter(t =>  t.completed)
    :                                state.items;

  // LEFT RAIL — Todoist-style view nav; current view = active variant.
  // ListItemNode(id, filter==id ? "active" : null, [ButtonNode("{label} ({count})", filter)])
  const navItem = (id: string, label: string, count: number): ViewNode => ({
    type: "list-item",
    id,
    variant: state.filter === id ? "active" : undefined,
    children: [
      {
        type: "button",
        label: `${label} (${count})`,
        action: { name: "filter", context: { value: id } },
        // ButtonNode.Variant is null here → omitted under normalize().
      },
    ],
  });

  const rail: ViewNode = {
    type: "section",
    heading: "Views",
    children: [
      {
        type: "list",
        children: [
          navItem("all",       "All",       total),
          navItem("active",    "Active",    active),
          navItem("completed", "Completed", completed),
        ],
      },
    ],
    variant: "card",
  };

  // MAIN — progress text, progress bar, inline add form, the task list.
  const taskItems: ViewNode[] = filtered
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    .map<ViewNode>(t => ({
      type: "list-item",
      id: t.id,
      variant: t.completed ? "done" : undefined,
      children: [
        {
          type: "checkbox",
          name: "completed",
          checked: t.completed,
          action: { name: "toggle", context: { id: t.id } },
        },
        {
          type: "text",
          value: t.title,
          style: t.completed ? "strikethrough" : undefined,
        },
        {
          type: "button",
          label: "✕",
          action: { name: "delete", context: { id: t.id } },
          variant: "danger",
        },
      ],
    }));
  if (taskItems.length === 0) {
    taskItems.push({ type: "text", value: "Nothing here.", style: "muted" });
  }

  const main: ViewNode = {
    type: "section",
    // SectionNode heading is null → omitted under normalize().
    children: [
      { type: "text", value: `${completed} of ${total} complete`, style: "muted" },
      { type: "progress", value: pct },
      {
        type: "form",
        submitAction: { name: "add" },
        submitLabel: "Add",
        children: [
          {
            type: "field",
            name: "title",
            inputType: "text",
            placeholder: "Add a task…",
            // FieldNode.Label and .Value are null → omitted.
            // FieldNode.Required is non-nullable bool → MUST emit required:false.
            required: false,
          },
        ],
        layout: "inline",
      },
      { type: "list", children: taskItems },
    ],
  };

  return {
    type: "page",
    title: "Tasks",
    children: [rail, main],
    layout: "sidebar",
  };
}

function generateId(): string {
  // 8-char hex, matches the C# Guid.NewGuid().ToString("N")[..8] shape.
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

export const actionHandler = createAction<TasksState>(async (payload) => {
  const ctx = payload.context ?? {};
  const str  = (k: string): string | null  => (typeof ctx[k] === "string"  ? (ctx[k] as string)  : null);
  const bool = (k: string): boolean | null => (typeof ctx[k] === "boolean" ? (ctx[k] as boolean) : null);

  let state = payload.state;

  switch (payload.name) {
    case "add": {
      const title = str("title");
      if (!title || !title.trim()) {
        throw new Error("title required");
      }
      const newTask: TaskRecord = {
        id: generateId(),
        title: title.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      state = { ...state, items: [...state.items, newTask] };
      break;
    }
    case "toggle": {
      const id = str("id");
      const checked = bool("checked");
      if (id !== null && checked !== null) {
        state = {
          ...state,
          items: state.items.map(t => (t.id === id ? { ...t, completed: checked } : t)),
        };
      }
      break;
    }
    case "delete": {
      const id = str("id");
      if (id !== null) {
        state = { ...state, items: state.items.filter(t => t.id !== id) };
      }
      break;
    }
    case "filter": {
      const value = str("value");
      if (value !== null) {
        state = { ...state, filter: value };
      }
      break;
    }
    default:
      throw new Error(`Unknown action: ${payload.name}`);
  }

  return { vm: buildVm(state), state };
});

// Standalone server: only when this file is the process entrypoint
// (`bun run server.ts`, as the parity harness invokes it). When this module
// is imported instead, the guard is false and no listener starts — the
// importer composes the exported handlers itself.
if (import.meta.main) {
  const port = Number(process.env.PORT ?? "3001");

  Bun.serve({
    port,
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      if (url.pathname === "/api/tasks" && request.method === "GET") {
        const state = initialState();
        return Response.json({ vm: buildVm(state), state });
      }
      if (url.pathname === "/api/tasks/action" && request.method === "POST") {
        return actionHandler(request);
      }
      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`Tasks Bun backend listening on http://localhost:${port}`);
}
