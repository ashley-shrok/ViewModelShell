// Tasks demo — TypeScript backend mirror of demo/Tasks/AspNetCore/.
// Faithful port: same wire format, same action semantics, same vm shape.
// Used as one half of the parity test harness (parity/run.ts).

import {
  createAction,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface TaskRecord {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string; // ISO timestamp
}

interface TasksState {
  items: TaskRecord[];
  filter: string;
}

function initialState(): TasksState {
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

function buildVm(state: TasksState): ViewNode {
  const filtered =
    state.filter === "active"    ? state.items.filter(t => !t.completed)
    : state.filter === "completed" ? state.items.filter(t =>  t.completed)
    :                                state.items;

  const total     = state.items.length;
  const completed = state.items.filter(t => t.completed).length;
  const pct       = total === 0 ? 0 : Math.round(100 * completed / total);

  return {
    type: "page",
    title: "Tasks",
    children: [
      {
        type: "stat-bar",
        stats: [{ label: "complete", value: `${completed} of ${total}` }],
      },
      {
        type: "form",
        submitAction: { name: "add" },
        submitLabel: "Add",
        children: [
          { type: "field", name: "title", inputType: "text", placeholder: "Add a task…", required: false },
        ],
      },
      {
        type: "tabs",
        selected: state.filter,
        action: { name: "filter" },
        tabs: [
          { value: "all",       label: "All" },
          { value: "active",    label: "Active" },
          { value: "completed", label: "Completed" },
        ],
      },
      {
        type: "list",
        children: filtered
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
                label: "Delete",
                action: { name: "delete", context: { id: t.id } },
                variant: "danger",
              },
            ],
          })),
      },
      { type: "progress", value: pct },
    ],
  };
}

function generateId(): string {
  // 8-char hex, matches the C# Guid.NewGuid().ToString("N")[..8] shape.
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

const actionHandler = createAction<TasksState>(async (payload) => {
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
