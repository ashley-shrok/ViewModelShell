// Phase 6 — BrowserAdapter bind-path coverage.
//
// These tests cover the post-Phase-6 wire contract:
//   - inputs read their visible value from state via stateAccess.read(bind);
//   - every user-input event writes back via stateAccess.write(bind, value);
//   - dispatched actions carry { name } only — no context payload;
//   - auto-dispatch is preserved (tab click, select-on-change, field-on-Enter,
//     checkbox-on-toggle still fire their declared action immediately).
//
// The tests use a small in-memory StateAccess backed by a single mutable
// object, mirroring how ViewModelShell's stateRead/stateWrite seam works in
// real use. The container is freshened per test and BrowserAdapter is the
// system under test — no jsdom-mocking of the renderer itself.

import { describe, it, expect, afterEach } from "vitest";
import type { StateAccess, ViewNode, ActionEvent } from "./index.js";
import { BrowserAdapter } from "./browser.js";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

interface TestSetup {
  container: HTMLElement;
  adapter: BrowserAdapter;
  state: Record<string, unknown>;
  sa: StateAccess;
  dispatched: ActionEvent[];
  render: (vm: ViewNode) => void;
}

function setup(initial: Record<string, unknown> = {}): TestSetup {
  const container = freshContainer();
  const adapter = new BrowserAdapter(container);
  // Mutable state object — the real shell holds state mutably too.
  const state = initial as Record<string, unknown>;
  const sa: StateAccess = {
    read(path: string): unknown {
      if (path === "") return state;
      const segs = path.split(".");
      let cur: unknown = state;
      for (const seg of segs) {
        if (cur == null) return undefined;
        if (Array.isArray(cur)) {
          const idx = Number(seg);
          if (!Number.isInteger(idx)) return undefined;
          cur = cur[idx];
        } else if (typeof cur === "object") {
          cur = (cur as Record<string, unknown>)[seg];
        } else {
          return undefined;
        }
      }
      return cur;
    },
    write(path: string, value: unknown): void {
      const segs = path.split(".");
      let cur: unknown = state;
      for (let i = 0; i < segs.length - 1; i++) {
        const seg = segs[i]!;
        const nextSeg = segs[i + 1]!;
        const nextIsNumeric = /^[0-9]+$/.test(nextSeg);
        if (Array.isArray(cur)) {
          const idx = Number(seg);
          let nxt = cur[idx];
          if (nxt == null || typeof nxt !== "object") {
            nxt = nextIsNumeric ? [] : {};
            cur[idx] = nxt;
          }
          cur = nxt;
        } else {
          const o = cur as Record<string, unknown>;
          let nxt = o[seg];
          if (nxt == null || typeof nxt !== "object") {
            nxt = nextIsNumeric ? [] : {};
            o[seg] = nxt;
          }
          cur = nxt;
        }
      }
      const last = segs[segs.length - 1]!;
      if (Array.isArray(cur)) cur[Number(last)] = value;
      else (cur as Record<string, unknown>)[last] = value;
    },
  };
  const dispatched: ActionEvent[] = [];
  const onAction = (a: ActionEvent): void => { dispatched.push(a); };
  const render = (vm: ViewNode): void => adapter.render(vm, onAction, sa);
  return { container, adapter, state, sa, dispatched, render };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("Phase 6 — text field bind-path read/write", () => {
  it("renders with the bound state value", () => {
    const { container, render } = setup({ fields: { title: "hello" } });
    render({
      type: "field",
      name: "title",
      inputType: "text",
      bind: "fields.title",
    });
    const inp = container.querySelector("input.vms-field__input") as HTMLInputElement;
    expect(inp).not.toBeNull();
    expect(inp.value).toBe("hello");
  });

  it("writes user input back to state at the bind path on every keystroke", () => {
    const { container, render, state } = setup({ fields: { title: "" } });
    render({
      type: "field",
      name: "title",
      inputType: "text",
      bind: "fields.title",
    });
    const inp = container.querySelector("input.vms-field__input") as HTMLInputElement;
    inp.value = "new";
    inp.dispatchEvent(new Event("input"));
    expect(state).toEqual({ fields: { title: "new" } });
  });

  it("creates intermediate object containers on write to a deep path", () => {
    const { container, render, state } = setup({});
    render({
      type: "field",
      name: "title",
      inputType: "text",
      bind: "a.b.c",
    });
    const inp = container.querySelector("input.vms-field__input") as HTMLInputElement;
    inp.value = "x";
    inp.dispatchEvent(new Event("input"));
    expect(state).toEqual({ a: { b: { c: "x" } } });
  });
});

describe("Phase 6 — checkbox bind-path read/write", () => {
  it("standalone CheckboxNode reads boolean from bind path", () => {
    const { container, render } = setup({ completed: true });
    render({ type: "checkbox", name: "done", bind: "completed", label: "Done" });
    const inp = container.querySelector("input.vms-checkbox__input") as HTMLInputElement;
    expect(inp.checked).toBe(true);
  });

  it("toggling CheckboxNode writes the new value to state then dispatches action name only", () => {
    const { container, render, state, dispatched } = setup({ completed: false });
    render({
      type: "checkbox",
      name: "done",
      bind: "completed",
      label: "Done",
      action: { name: "toggle-completed" },
    });
    const inp = container.querySelector("input.vms-checkbox__input") as HTMLInputElement;
    inp.checked = true;
    inp.dispatchEvent(new Event("change"));
    expect(state).toEqual({ completed: true });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ name: "toggle-completed" });
  });
});

describe("Phase 6 — select-on-change bind-path read/write + dispatch", () => {
  it("select reads the current value from bind path and writes the chosen value on change", () => {
    const { container, render, state, dispatched } = setup({ filter: "active" });
    render({
      type: "field",
      name: "filter",
      inputType: "select",
      bind: "filter",
      options: [
        { value: "all", label: "All" },
        { value: "active", label: "Active" },
        { value: "done", label: "Done" },
      ],
      action: { name: "set-filter" },
    });
    const sel = container.querySelector("select.vms-field__input") as HTMLSelectElement;
    expect(sel.value).toBe("active");

    sel.value = "done";
    sel.dispatchEvent(new Event("change"));
    expect(state).toEqual({ filter: "done" });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ name: "set-filter" });
  });

  it("select-multiple writes an array of selected values to state", () => {
    const { container, render, state } = setup({ tags: ["a"] });
    render({
      type: "field",
      name: "tags",
      inputType: "select-multiple",
      bind: "tags",
      options: [
        { value: "a", label: "A" },
        { value: "b", label: "B" },
        { value: "c", label: "C" },
      ],
    });
    const sel = container.querySelector("select.vms-field__input") as HTMLSelectElement;
    // Mark all three selected.
    Array.from(sel.options).forEach((o) => { o.selected = true; });
    sel.dispatchEvent(new Event("change"));
    expect(state).toEqual({ tags: ["a", "b", "c"] });
  });
});

describe("Phase 6 — TabsNode per-tab action + bind write", () => {
  it("clicking a tab writes tab.value to state at node.bind then dispatches the tab's unique action", () => {
    const { container, render, state, dispatched } = setup({ tab: "all" });
    render({
      type: "tabs",
      selected: "all",
      bind: "tab",
      tabs: [
        { value: "all", label: "All", action: { name: "select-tab-all" } },
        { value: "pending", label: "Pending", action: { name: "select-tab-pending" } },
        { value: "done", label: "Done", action: { name: "select-tab-done" } },
      ],
    });
    const btns = Array.from(container.querySelectorAll("button.vms-tabs__tab")) as HTMLButtonElement[];
    btns[1]!.click();
    expect(state).toEqual({ tab: "pending" });
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ name: "select-tab-pending" });
  });
});

describe("Phase 6 — FormNode submit dispatches action name only", () => {
  it("submit fires the submitAction by name; no context anywhere", () => {
    const { container, render, dispatched } = setup({ title: "hello" });
    render({
      type: "form",
      submitAction: { name: "save-ticket-42" },
      submitLabel: "Save",
      children: [
        {
          type: "field",
          name: "title",
          inputType: "text",
          bind: "title",
          label: "Title",
        },
      ],
    });
    const submit = container.querySelector("button[type=submit]") as HTMLButtonElement;
    submit.click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("save-ticket-42");
    expect(Object.keys(dispatched[0]!)).toEqual(["name"]);
  });

  it("FormNode.buttons[] entries each fire their own action by name only", () => {
    const { container, render, dispatched } = setup({});
    render({
      type: "form",
      children: [
        { type: "field", name: "title", inputType: "text", bind: "title", label: "Title" },
      ],
      buttons: [
        { type: "button", label: "Preview", action: { name: "preview" } },
        { type: "button", label: "Save", action: { name: "save" }, emphasis: "primary" },
      ],
    });
    const labels = Array.from(container.querySelectorAll("button"))
      .map((b) => (b as HTMLButtonElement).textContent);
    const preview = Array.from(container.querySelectorAll("button"))
      .find((b) => (b as HTMLButtonElement).textContent === "Preview") as HTMLButtonElement;
    const save = Array.from(container.querySelectorAll("button"))
      .find((b) => (b as HTMLButtonElement).textContent === "Save") as HTMLButtonElement;
    preview.click();
    save.click();
    expect(labels).toEqual(["Preview", "Save"]);
    expect(dispatched.map((a) => a.name)).toEqual(["preview", "save"]);
    expect(dispatched.every((a) => Object.keys(a).filter((k) => k !== "files").length === 1)).toBe(true);
  });
});

describe("Phase 6 — file input populates action.files and writes placeholder to state", () => {
  it("on submit, action.files carries the picked file and state holds {filename, size}", () => {
    const { container, render, state, dispatched } = setup({});
    render({
      type: "form",
      submitAction: { name: "upload" },
      submitLabel: "Upload",
      children: [
        {
          type: "field",
          name: "attachment",
          inputType: "file",
          bind: "attachment",
          uploadOn: ["upload"],
        },
      ],
    });
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const inp = container.querySelector("input[type=file]") as HTMLInputElement;
    // jsdom doesn't ship DataTransfer; define the files NodeList directly.
    Object.defineProperty(inp, "files", {
      value: { 0: file, length: 1, item: (i: number) => (i === 0 ? file : null) } as unknown as FileList,
      configurable: true,
    });
    inp.dispatchEvent(new Event("change"));
    // State now holds the placeholder.
    expect(state).toEqual({
      attachment: { filename: "hello.txt", size: file.size },
    });
    // Submit fires the action with files attached.
    const submit = container.querySelector("button[type=submit]") as HTMLButtonElement;
    submit.click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]!.name).toBe("upload");
    expect(dispatched[0]!.files).toBeDefined();
    expect(dispatched[0]!.files!.attachment).toBe(file);
  });
});

describe("Phase 6 — TableNode per-row button dispatches its unique action", () => {
  it("clicking row.actions[0] dispatches just the action name", () => {
    const { container, render, dispatched } = setup({});
    render({
      type: "table",
      columns: [{ key: "name", label: "Name" }],
      rows: [
        {
          id: "42",
          cells: { name: "Alpha" },
          actions: [
            { type: "button", label: "Delete", action: { name: "delete-row-42" }, tone: "danger" },
          ],
        },
        {
          id: "43",
          cells: { name: "Beta" },
          actions: [
            { type: "button", label: "Delete", action: { name: "delete-row-43" } },
          ],
        },
      ],
    });
    const btns = Array.from(container.querySelectorAll("button.vms-button")) as HTMLButtonElement[];
    expect(btns).toHaveLength(2);
    // The first delete should target row 42.
    btns[0]!.click();
    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]).toEqual({ name: "delete-row-42" });
    btns[1]!.click();
    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]).toEqual({ name: "delete-row-43" });
  });
});

describe("Phase 6 — TableNode sort writes intent to sortBind + dispatches per-column action", () => {
  it("clicking a sortable header writes {column, direction} to sortBind and dispatches sortActions[col]", () => {
    const { container, render, state, dispatched } = setup({});
    render({
      type: "table",
      columns: [
        { key: "title", label: "Title", sortable: true },
        { key: "status", label: "Status", sortable: true },
      ],
      rows: [],
      sortBind: "sort",
      sortActions: {
        title: { name: "sort-by-title" },
        status: { name: "sort-by-status" },
      },
    });
    const ths = Array.from(container.querySelectorAll("th.vms-table__th--sortable")) as HTMLElement[];
    ths[0]!.click();
    expect(state).toEqual({ sort: { column: "title", direction: "asc" } });
    expect(dispatched).toEqual([{ name: "sort-by-title" }]);

    // A second click on the same column flips direction.
    ths[0]!.click();
    expect(state).toEqual({ sort: { column: "title", direction: "desc" } });
    expect(dispatched[1]).toEqual({ name: "sort-by-title" });
  });
});

describe("Phase 6 — TableNode pagination next click dispatches nextAction", () => {
  it("Next writes target page to paginationBind then dispatches pagination.nextAction", () => {
    const { container, render, state, dispatched } = setup({});
    render({
      type: "table",
      columns: [{ key: "name", label: "Name" }],
      rows: [{ id: "1", cells: { name: "x" } }],
      paginationBind: "page",
      pagination: {
        page: 1,
        pageSize: 1,
        totalRows: 5,
        prevAction: { name: "page-prev" },
        nextAction: { name: "page-next" },
      },
    });
    const next = Array.from(container.querySelectorAll("button.vms-table__pagination-btn"))
      .find((b) => (b as HTMLButtonElement).textContent === "Next ›") as HTMLButtonElement;
    next.click();
    expect(state).toEqual({ page: 2 });
    expect(dispatched).toEqual([{ name: "page-next" }]);
  });
});

describe("Phase 6 — draft preservation through state", () => {
  it("re-rendering with the same state object preserves the typed text", () => {
    const { container, render, state } = setup({ title: "" });
    const vm: ViewNode = {
      type: "field",
      name: "title",
      inputType: "text",
      bind: "title",
    };
    render(vm);
    const inp = container.querySelector("input.vms-field__input") as HTMLInputElement;
    inp.value = "typed text";
    inp.dispatchEvent(new Event("input"));
    expect(state).toEqual({ title: "typed text" });

    // Server returns the same state — render again.
    render(vm);
    const inp2 = container.querySelector("input.vms-field__input") as HTMLInputElement;
    expect(inp2.value).toBe("typed text");
  });

  it("re-rendering with a state object that explicitly sets a new value snaps to the server value", () => {
    const { container, render, state } = setup({ title: "" });
    const vm: ViewNode = {
      type: "field",
      name: "title",
      inputType: "text",
      bind: "title",
    };
    render(vm);
    const inp = container.querySelector("input.vms-field__input") as HTMLInputElement;
    inp.value = "typed text";
    inp.dispatchEvent(new Event("input"));

    // Server overrides the bound slot.
    (state as Record<string, unknown>).title = "server-set";
    render(vm);
    const inp2 = container.querySelector("input.vms-field__input") as HTMLInputElement;
    expect(inp2.value).toBe("server-set");
  });
});

describe("Phase 6 — context never appears in dispatched actions", () => {
  it("every dispatched action has only { name } or { name, files }", () => {
    const { container, render, dispatched } = setup({});
    render({
      type: "page",
      children: [
        {
          type: "tabs",
          selected: "all",
          bind: "tab",
          tabs: [
            { value: "all", label: "All", action: { name: "select-tab-all" } },
            { value: "x", label: "X", action: { name: "select-tab-x" } },
          ],
        },
        {
          type: "checkbox",
          name: "done",
          bind: "completed",
          label: "Done",
          action: { name: "toggle" },
        },
        {
          type: "button",
          label: "Go",
          action: { name: "go" },
        },
      ],
    });
    // Click tab, checkbox, button.
    (container.querySelectorAll("button.vms-tabs__tab")[1]! as HTMLButtonElement).click();
    const cb = container.querySelector("input.vms-checkbox__input") as HTMLInputElement;
    cb.checked = true;
    cb.dispatchEvent(new Event("change"));
    const goBtn = Array.from(container.querySelectorAll("button.vms-button"))
      .find((b) => (b as HTMLButtonElement).textContent === "Go") as HTMLButtonElement;
    goBtn.click();
    expect(dispatched).toHaveLength(3);
    for (const a of dispatched) {
      const keys = Object.keys(a).filter((k) => k !== "files");
      expect(keys).toEqual(["name"]);
    }
  });
});

// ── v5.1 Navigation primitives ────────────────────────────────────────────

describe("v5.1 — BreadcrumbNode renders a nav landmark with an auto-current last item", () => {
  it("renders <nav aria-label> > <ol.vms-breadcrumb>, last crumb non-clickable + aria-current=page, href/action crumbs distinct, action dispatches", () => {
    const { container, render, dispatched } = setup({});
    render({
      type: "breadcrumb",
      items: [
        { label: "Home", href: "/" },
        { label: "Products", action: { name: "go-products" } },
        { label: "Widget" },
      ],
    });
    const nav = container.querySelector("nav");
    expect(nav).not.toBeNull();
    expect(nav!.getAttribute("aria-label")).toBe("breadcrumb");
    const ol = nav!.querySelector("ol.vms-breadcrumb");
    expect(ol).not.toBeNull();
    const items = Array.from(ol!.querySelectorAll("li.vms-breadcrumb__item"));
    expect(items).toHaveLength(3);

    // Crumb 1: an href link.
    const link = items[0]!.querySelector("a.vms-breadcrumb__link") as HTMLAnchorElement;
    expect(link).not.toBeNull();
    expect(link.getAttribute("href")).toBe("/");
    expect(link.textContent).toBe("Home");

    // Crumb 2: an action button (NOT an anchor) that dispatches by name.
    expect(items[1]!.querySelector("a")).toBeNull();
    const actionBtn = items[1]!.querySelector("button.vms-breadcrumb__link") as HTMLButtonElement;
    expect(actionBtn).not.toBeNull();
    actionBtn.click();
    expect(dispatched).toEqual([{ name: "go-products" }]);

    // Crumb 3 (last): current page — plain text, aria-current on the <li>, no link/button.
    expect(items[2]!.getAttribute("aria-current")).toBe("page");
    expect(items[2]!.querySelector("a")).toBeNull();
    expect(items[2]!.querySelector("button")).toBeNull();
    const current = items[2]!.querySelector("span.vms-breadcrumb__current");
    expect(current).not.toBeNull();
    expect(current!.textContent).toBe("Widget");
  });
});

describe("v5.1 — StepsNode derives per-step state from current + marks the current step", () => {
  it("renders done/current/upcoming classes in order with exactly one aria-current=step", () => {
    const { container, render } = setup({});
    render({
      type: "steps",
      steps: [{ label: "Cart" }, { label: "Shipping" }, { label: "Payment" }],
      current: 1,
    });
    const ol = container.querySelector("ol.vms-steps");
    expect(ol).not.toBeNull();
    const steps = Array.from(ol!.querySelectorAll("li.vms-steps__step"));
    expect(steps).toHaveLength(3);
    expect(steps[0]!.classList.contains("vms-steps__step--done")).toBe(true);
    expect(steps[1]!.classList.contains("vms-steps__step--current")).toBe(true);
    expect(steps[2]!.classList.contains("vms-steps__step--upcoming")).toBe(true);

    const currents = ol!.querySelectorAll('[aria-current="step"]');
    expect(currents).toHaveLength(1);
    expect((currents[0] as HTMLElement).classList.contains("vms-steps__step--current")).toBe(true);
  });
});

describe("v5.1 — BreadcrumbNode external crumb hardens the link (T-20-06)", () => {
  it("external:true sets target=_blank + rel=noopener noreferrer", () => {
    const { container, render } = setup({});
    render({
      type: "breadcrumb",
      items: [
        { label: "Docs", href: "https://example.com", external: true },
        { label: "Here" },
      ],
    });
    const a = container.querySelector("a.vms-breadcrumb__link") as HTMLAnchorElement;
    expect(a.target).toBe("_blank");
    expect(a.rel).toBe("noopener noreferrer");
  });
});

describe("v5.1 — StepsNode a11y: markers carry state labels, stepper is inert", () => {
  it("each marker has a state aria-label, done shows a check glyph, root is not a progressbar and not focusable", () => {
    const { container, render } = setup({});
    render({
      type: "steps",
      steps: [{ label: "Cart" }, { label: "Shipping" }, { label: "Payment" }],
      current: 1,
    });
    const ol = container.querySelector("ol.vms-steps") as HTMLElement;
    // Discrete stepper — NOT role=progressbar, NOT in the tab order.
    expect(ol.getAttribute("role")).toBeNull();
    expect(ol.getAttribute("aria-label")).not.toBeNull();
    expect(ol.hasAttribute("tabindex")).toBe(false);
    for (const step of Array.from(ol.querySelectorAll("li.vms-steps__step"))) {
      expect(step.hasAttribute("tabindex")).toBe(false);
    }

    const markers = Array.from(ol.querySelectorAll(".vms-steps__marker"));
    expect(markers.map((m) => m.getAttribute("aria-label"))).toEqual([
      "complete", "current", "upcoming",
    ]);
    // Done marker shows a check glyph; the others show their 1-based number.
    expect(markers[0]!.textContent).toBe("✓");
    expect(markers[1]!.textContent).toBe("2");
    expect(markers[2]!.textContent).toBe("3");
  });
});

describe("v5.1 — StepsNode orientation modifier is present only when vertical", () => {
  it("orientation:vertical adds vms-steps--vertical; omitted/horizontal does not", () => {
    const vertical = setup({});
    vertical.render({
      type: "steps",
      steps: [{ label: "One" }, { label: "Two" }],
      current: 0,
      orientation: "vertical",
    });
    expect(
      (vertical.container.querySelector("ol.vms-steps") as HTMLElement)
        .classList.contains("vms-steps--vertical"),
    ).toBe(true);

    const horizontal = setup({});
    horizontal.render({
      type: "steps",
      steps: [{ label: "One" }, { label: "Two" }],
      current: 0,
    });
    expect(
      (horizontal.container.querySelector("ol.vms-steps") as HTMLElement)
        .classList.contains("vms-steps--vertical"),
    ).toBe(false);
  });
});

describe("v5.1 — StepsNode renders an optional description only when present", () => {
  it("emits .vms-steps__description for steps that carry one, omits it otherwise", () => {
    const { container, render } = setup({});
    render({
      type: "steps",
      steps: [
        { label: "Cart", description: "Review items" },
        { label: "Pay" },
      ],
      current: 0,
    });
    const steps = Array.from(container.querySelectorAll("li.vms-steps__step"));
    const desc0 = steps[0]!.querySelector(".vms-steps__description");
    expect(desc0).not.toBeNull();
    expect(desc0!.textContent).toBe("Review items");
    expect(steps[1]!.querySelector(".vms-steps__description")).toBeNull();
  });
});
