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
//
// Phase 6 wire-shape migration (0.17.0 / WIRE-07): inputs carry `bind` paths
// instead of values; per-row buttons and per-tab nav use unique action names
// (`delete-row-${id}`, `filter-all` / `filter-active` / `filter-completed`);
// the action handler reads from state, not from a `context` payload.

import {
  createAction,
  validateActionNames,
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
  /** Phase 6 — typed value of the inline add-task input. Lives in state so
   *  the renderer's bind seam can read/write it; the "add" handler reads it
   *  and resets to "" after appending the new task. */
  draftTitle: string;
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
    draftTitle: "",
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
  // Each nav button gets a unique action name (`filter-all` / `filter-active` /
  // `filter-completed`) — per-row identity-in-name, no context payload.
  const navItem = (id: string, label: string, count: number): ViewNode => ({
    type: "list-item",
    id,
    variant: state.filter === id ? "active" : undefined,
    children: [
      {
        type: "button",
        label: `${label} (${count})`,
        action: { name: `filter-${id}` },
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
    .map<ViewNode>((t, idx) => {
      // Find the index in the unsorted items[] array so the bind path
      // (`items.${i}.completed`) points at the correct slot. The renderer
      // writes the new value to state before the action fires.
      const i = state.items.findIndex(x => x.id === t.id);
      if (i < 0) {
        throw new Error(
          `Task id '${t.id}' is in the filtered list but not in state.items. ` +
          `Bind paths require a valid array index.`,
        );
      }
      return {
        type: "list-item",
        id: t.id,
        variant: t.completed ? "done" : undefined,
        children: [
          {
            type: "checkbox",
            name: "completed",
            bind: `items.${i}.completed`,
            action: { name: `toggle-row-${t.id}` },
          },
          {
            type: "text",
            value: t.title,
            style: t.completed ? "strikethrough" : undefined,
          },
          {
            type: "button",
            label: "✕",
            action: { name: `delete-row-${t.id}` },
            variant: "danger",
          },
        ],
      };
    });
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
            bind: "draftTitle",
            placeholder: "Add a task…",
            // FieldNode.Label is null → omitted.
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
  let state = payload.state;
  const name = payload.name;

  if (name === "add") {
    const title = state.draftTitle?.trim() ?? "";
    if (!title) {
      throw new Error("title required");
    }
    const newTask: TaskRecord = {
      id: generateId(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    state = { ...state, items: [...state.items, newTask], draftTitle: "" };
  } else if (name.startsWith("toggle-row-")) {
    // The renderer has already written the new `completed` boolean into
    // state at `items.${i}.completed`. The server just acknowledges with
    // a re-render — state is the source of truth.
  } else if (name.startsWith("delete-row-")) {
    const id = name.slice("delete-row-".length);
    state = { ...state, items: state.items.filter(t => t.id !== id) };
  } else if (name.startsWith("filter-")) {
    const value = name.slice("filter-".length);
    state = { ...state, filter: value };
  } else {
    throw new Error(`Unknown action: ${name}`);
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
        const vm = buildVm(state);
        validateActionNames(vm);
        return Response.json({ vm, state });
      }
      if (url.pathname === "/api/tasks/action" && request.method === "POST") {
        return actionHandler(request);
      }
      return new Response("Not Found", { status: 404 });
    },
  });

  console.log(`Tasks Bun backend listening on http://localhost:${port}`);
}
