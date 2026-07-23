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

describe("6.0.0 — per-item tone (StatItem.tone + StepItem.tone)", () => {
  it("StepItem.tone emits the shared --toned + specific --tone-{tone} classes, orthogonal to derived state", () => {
    const { container, render } = setup({});
    render({
      type: "steps",
      steps: [
        { label: "Draft" },
        { label: "Review", tone: "danger" },
        { label: "Publish" },
      ],
      current: 1,
    });
    const steps = Array.from(container.querySelectorAll("li.vms-steps__step"));
    // Untoned steps carry neither class.
    expect(steps[0]!.classList.contains("vms-steps__step--toned")).toBe(false);
    expect(steps[2]!.classList.contains("vms-steps__step--toned")).toBe(false);
    // The toned step keeps its DERIVED state class AND gains the tone classes.
    expect(steps[1]!.classList.contains("vms-steps__step--current")).toBe(true);
    expect(steps[1]!.classList.contains("vms-steps__step--toned")).toBe(true);
    expect(steps[1]!.classList.contains("vms-steps__step--tone-danger")).toBe(true);
  });

  it("StatItem.tone emits the chip classes; untoned items stay bare; value renders as its string", () => {
    const { container, render } = setup({});
    render({
      type: "stat-bar",
      stats: [
        { label: "active", value: "12" },
        { label: "failing", value: "3", tone: "danger" },
      ],
    });
    const items = Array.from(container.querySelectorAll(".vms-stat-bar__item"));
    expect(items).toHaveLength(2);
    expect(items[0]!.classList.contains("vms-stat-bar__item--toned")).toBe(false);
    expect(items[1]!.classList.contains("vms-stat-bar__item--toned")).toBe(true);
    expect(items[1]!.classList.contains("vms-stat-bar__item--tone-danger")).toBe(true);
    // Value is display text on both backends — rendered verbatim from the string.
    const vals = Array.from(container.querySelectorAll(".vms-stat-bar__value"));
    expect(vals.map((v) => v.textContent)).toEqual(["12", "3"]);
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

describe("TrackerNode — status/heat strip", () => {
  it("renders one cell per entry with its state class; omitted state = muted", () => {
    const { container, render } = setup();
    render({
      type: "tracker",
      id: "t1",
      cells: [
        {},
        { state: "success" },
        { state: "danger" },
        { state: "warning" },
        { state: "muted" },
      ],
    });
    const strip = container.querySelector(".vms-tracker") as HTMLElement;
    expect(strip).not.toBeNull();
    expect(strip.id).toBe("t1");
    expect(strip.getAttribute("role")).toBe("img");
    const cells = strip.querySelectorAll(".vms-tracker__cell");
    expect(cells.length).toBe(5);
    // omitted state falls back to muted
    expect(cells[0]!.classList.contains("vms-tracker__cell--muted")).toBe(true);
    expect(cells[1]!.classList.contains("vms-tracker__cell--success")).toBe(true);
    expect(cells[2]!.classList.contains("vms-tracker__cell--danger")).toBe(true);
    expect(cells[3]!.classList.contains("vms-tracker__cell--warning")).toBe(true);
    expect(cells[4]!.classList.contains("vms-tracker__cell--muted")).toBe(true);
  });

  it("label rides as both title tooltip and aria-label (non-color channel)", () => {
    const { container, render } = setup();
    render({ type: "tracker", cells: [{ state: "success", label: "14:02 UTC · Success" }] });
    const cell = container.querySelector(".vms-tracker__cell") as HTMLElement;
    expect(cell.title).toBe("14:02 UTC · Success");
    expect(cell.getAttribute("aria-label")).toBe("14:02 UTC · Success");
  });

  it("a cell with no label still carries the state as aria-label (never color-only)", () => {
    const { container, render } = setup();
    render({ type: "tracker", cells: [{ state: "danger" }] });
    const cell = container.querySelector(".vms-tracker__cell") as HTMLElement;
    expect(cell.getAttribute("aria-label")).toBe("danger");
    expect(cell.title).toBe(""); // no title when no label
  });

  it("a cell with an action is a role=button tabstop; click / Enter / Space dispatch (Space preventDefaults)", () => {
    const { container, render, dispatched } = setup();
    render({
      type: "tracker",
      cells: [
        { state: "danger", action: { name: "open-run-42" } },
        { state: "success" }, // no action
      ],
    });
    const cells = container.querySelectorAll(".vms-tracker__cell");
    const clickable = cells[0] as HTMLElement;
    const plain = cells[1] as HTMLElement;
    // clickable cell
    expect(clickable.classList.contains("vms-tracker__cell--clickable")).toBe(true);
    expect(clickable.getAttribute("role")).toBe("button");
    expect(clickable.tabIndex).toBe(0);
    clickable.dispatchEvent(new Event("click", { bubbles: true }));
    expect(dispatched.map((a) => a.name)).toEqual(["open-run-42"]);
    clickable.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(dispatched.length).toBe(2);
    const spaceEvt = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });
    clickable.dispatchEvent(spaceEvt);
    expect(dispatched.length).toBe(3);
    expect(spaceEvt.defaultPrevented).toBe(true); // Space suppresses page scroll
    // non-action cell: not a button, not a tabstop
    expect(plain.classList.contains("vms-tracker__cell--clickable")).toBe(false);
    expect(plain.getAttribute("role")).toBeNull();
  });
});

describe("DiffNode — aligned before/after primitive", () => {
  it("side-by-side (default mode) emits 4 cells per row with kind classes on BOTH linenum and content cells", () => {
    const { container, render } = setup();
    render({
      type: "diff",
      id: "d1",
      rows: [
        // context (identical)
        { old: { text: "foo", lineNumber: 1 }, new: { text: "foo", lineNumber: 1 } },
        // remove-only
        { old: { text: "bar", lineNumber: 2 } },
        // add-only
        { new: { text: "baz", lineNumber: 2 } },
      ],
    });
    const root = container.querySelector(".vms-diff") as HTMLElement;
    expect(root).not.toBeNull();
    expect(root.id).toBe("d1");
    expect(root.classList.contains("vms-diff--side-by-side")).toBe(true);
    expect(root.getAttribute("role")).toBe("group");
    expect(root.getAttribute("aria-label")).toBe("Diff");
    const cells = root.querySelectorAll(".vms-diff__cell");
    // 3 rows × 4 cells = 12
    expect(cells.length).toBe(12);
    // Row 1 (context): all four cells carry --context
    for (let i = 0; i < 4; i++) {
      expect(cells[i]!.classList.contains("vms-diff__cell--context")).toBe(true);
    }
    // Row 2 (remove): old-line + old-content = --remove; new-line + new-content = --empty
    expect(cells[4]!.classList.contains("vms-diff__cell--remove")).toBe(true);
    expect(cells[4]!.classList.contains("vms-diff__cell--linenum")).toBe(true);
    expect(cells[4]!.classList.contains("vms-diff__cell--old-linenum")).toBe(true);
    expect(cells[5]!.classList.contains("vms-diff__cell--remove")).toBe(true);
    expect(cells[6]!.classList.contains("vms-diff__cell--empty")).toBe(true);
    expect(cells[6]!.classList.contains("vms-diff__cell--new-linenum")).toBe(true);
    expect(cells[7]!.classList.contains("vms-diff__cell--empty")).toBe(true);
    // Row 3 (add): old side --empty; new side --add
    expect(cells[8]!.classList.contains("vms-diff__cell--empty")).toBe(true);
    expect(cells[9]!.classList.contains("vms-diff__cell--empty")).toBe(true);
    expect(cells[10]!.classList.contains("vms-diff__cell--add")).toBe(true);
    expect(cells[11]!.classList.contains("vms-diff__cell--add")).toBe(true);
  });

  it("side-by-side — a modified pair (both non-null, different text) renders both cells tinted in the same visual row", () => {
    const { container, render } = setup();
    render({
      type: "diff",
      rows: [
        { old: { text: "old-value", lineNumber: 1 }, new: { text: "new-value", lineNumber: 1 } },
      ],
    });
    const cells = container.querySelectorAll(".vms-diff__cell");
    expect(cells.length).toBe(4);
    // old side → remove, new side → add (same visual row)
    expect(cells[0]!.classList.contains("vms-diff__cell--remove")).toBe(true);
    expect(cells[1]!.classList.contains("vms-diff__cell--remove")).toBe(true);
    expect(cells[2]!.classList.contains("vms-diff__cell--add")).toBe(true);
    expect(cells[3]!.classList.contains("vms-diff__cell--add")).toBe(true);
    expect(cells[1]!.textContent).toBe("old-value");
    expect(cells[3]!.textContent).toBe("new-value");
  });

  it("unified mode — context row emits 3 cells (both linenums + content); change rows split into remove + add pairs", () => {
    const { container, render } = setup();
    render({
      type: "diff",
      mode: "unified",
      rows: [
        { old: { text: "foo", lineNumber: 1 }, new: { text: "foo", lineNumber: 1 } },
        { old: { text: "bar", lineNumber: 2 }, new: { text: "baz", lineNumber: 2 } },
      ],
    });
    const root = container.querySelector(".vms-diff") as HTMLElement;
    expect(root.classList.contains("vms-diff--unified")).toBe(true);
    const cells = root.querySelectorAll(".vms-diff__cell");
    // Row 1 context = 3 cells; row 2 modified pair = 3 remove cells + 3 add cells = 6.
    // Total = 3 + 6 = 9.
    expect(cells.length).toBe(9);
    // Row 1 context
    expect(cells[0]!.classList.contains("vms-diff__cell--context")).toBe(true);
    expect(cells[1]!.classList.contains("vms-diff__cell--context")).toBe(true);
    expect(cells[2]!.classList.contains("vms-diff__cell--context")).toBe(true);
    // Row 2 remove half
    expect(cells[3]!.classList.contains("vms-diff__cell--remove")).toBe(true);
    expect(cells[3]!.classList.contains("vms-diff__cell--old-linenum")).toBe(true);
    expect(cells[4]!.classList.contains("vms-diff__cell--remove")).toBe(true);
    expect(cells[4]!.classList.contains("vms-diff__cell--new-linenum")).toBe(true);
    expect(cells[5]!.classList.contains("vms-diff__cell--remove")).toBe(true);
    expect(cells[5]!.textContent).toBe("bar");
    // Row 2 add half
    expect(cells[6]!.classList.contains("vms-diff__cell--add")).toBe(true);
    expect(cells[6]!.classList.contains("vms-diff__cell--old-linenum")).toBe(true);
    expect(cells[7]!.classList.contains("vms-diff__cell--add")).toBe(true);
    expect(cells[8]!.classList.contains("vms-diff__cell--add")).toBe(true);
    expect(cells[8]!.textContent).toBe("baz");
  });

  it("header — side-by-side emits two labeled header cells; unified emits one joined header", () => {
    const { container, render } = setup();
    render({
      type: "diff",
      header: { old: "before.txt", new: "after.txt" },
      rows: [{ old: { text: "x" }, new: { text: "x" } }],
    });
    const sbs = container.querySelectorAll(".vms-diff__header");
    expect(sbs.length).toBe(2);
    expect(sbs[0]!.textContent).toBe("before.txt");
    expect(sbs[0]!.classList.contains("vms-diff__header--old")).toBe(true);
    expect(sbs[1]!.textContent).toBe("after.txt");
    expect(sbs[1]!.classList.contains("vms-diff__header--new")).toBe(true);

    container.replaceChildren();
    render({
      type: "diff",
      mode: "unified",
      header: { old: "before.txt", new: "after.txt" },
      rows: [{ old: { text: "x" }, new: { text: "x" } }],
    });
    const uni = container.querySelectorAll(".vms-diff__header");
    expect(uni.length).toBe(1);
    expect(uni[0]!.textContent).toBe("before.txt  →  after.txt");
  });

  it("line numbers are aria-hidden (visual gutter only — actual content announces on the content cell)", () => {
    const { container, render } = setup();
    render({
      type: "diff",
      rows: [{ old: { text: "x", lineNumber: 42 }, new: { text: "x", lineNumber: 42 } }],
    });
    const linenums = container.querySelectorAll(".vms-diff__cell--linenum");
    expect(linenums.length).toBe(2);
    linenums.forEach((l) => expect(l.getAttribute("aria-hidden")).toBe("true"));
  });

  it("line-number cells are optional — omitted lineNumber renders an empty gutter cell (not the string 'undefined')", () => {
    const { container, render } = setup();
    render({
      type: "diff",
      rows: [{ old: { text: "prose diff — no line numbers" }, new: { text: "prose diff — no line numbers here either" } }],
    });
    const linenums = container.querySelectorAll(".vms-diff__cell--linenum");
    expect(linenums.length).toBe(2);
    linenums.forEach((l) => expect(l.textContent).toBe(""));
  });
});

describe("TextNode inline runs", () => {
  const textEl = (c: HTMLElement) => c.querySelector(".vms-text") as HTMLElement;

  it("runs ABSENT renders byte-identically to before runs existed (single text node, zero child elements)", () => {
    const { container, render } = setup();
    render({ type: "text", value: "hello" });
    const el = textEl(container);
    expect(el.textContent).toBe("hello");
    expect(el.children.length).toBe(0);
    expect(el.childNodes.length).toBe(1);
    expect(el.childNodes[0].nodeType).toBe(3); // Text node
  });

  it("runs PRESENT are drawn instead of value — value is not rendered", () => {
    const { container, render } = setup();
    render({ type: "text", value: "IGNORED", runs: [{ text: "shown" }] });
    const el = textEl(container);
    expect(el.textContent).toBe("shown");
    expect(el.textContent).not.toContain("IGNORED");
  });

  it("a flag-free run emits a BARE text node — no wrapper element", () => {
    const { container, render } = setup();
    render({ type: "text", value: "plain", runs: [{ text: "plain" }] });
    const el = textEl(container);
    expect(el.querySelector("*")).toBeNull();
    expect(el.childNodes[0].nodeType).toBe(3);
  });

  it("each flag alone maps to its semantic element + class", () => {
    const cases: Array<[Record<string, unknown>, string, string]> = [
      [{ bold: true }, "STRONG", "vms-text__strong"],
      [{ italic: true }, "EM", "vms-text__em"],
      [{ code: true }, "CODE", "vms-text__code"],
      [{ strike: true }, "S", "vms-text__strike"],
    ];
    for (const [flag, tag, cls] of cases) {
      const { container, render } = setup();
      render({ type: "text", value: "x", runs: [{ text: "x", ...flag }] as never });
      const el = textEl(container);
      const child = el.firstElementChild as HTMLElement;
      expect(child.tagName).toBe(tag);
      expect(child.classList.contains(cls)).toBe(true);
      expect(child.textContent).toBe("x");
    }
  });

  it("combined flags nest in a FIXED order (strong > em > s > code > text) so the DOM is deterministic", () => {
    const { container, render } = setup();
    render({
      type: "text",
      value: "all",
      runs: [{ text: "all", bold: true, italic: true, code: true, strike: true }],
    });
    const el = textEl(container);
    const strong = el.firstElementChild as HTMLElement;
    expect(strong.tagName).toBe("STRONG");
    const em = strong.firstElementChild as HTMLElement;
    expect(em.tagName).toBe("EM");
    const s = em.firstElementChild as HTMLElement;
    expect(s.tagName).toBe("S");
    const code = s.firstElementChild as HTMLElement;
    expect(code.tagName).toBe("CODE");
    expect(code.textContent).toBe("all");
  });

  it("href emits an anchor with .vms-text__link and NOT .vms-link (which is inline-block and breaks line wrapping)", () => {
    const { container, render } = setup();
    render({ type: "text", value: "docs", runs: [{ text: "docs", href: "https://example.com/d" }] });
    const a = textEl(container).querySelector("a") as HTMLAnchorElement;
    expect(a.getAttribute("href")).toBe("https://example.com/d");
    expect(a.classList.contains("vms-text__link")).toBe(true);
    expect(a.classList.contains("vms-link")).toBe(false);
  });

  it("external adds target and rel exactly as the standalone link() path does; without it neither attribute is set", () => {
    const { container: c1, render: r1 } = setup();
    r1({ type: "text", value: "x", runs: [{ text: "x", href: "https://e.com", external: true }] });
    const ext = textEl(c1).querySelector("a") as HTMLAnchorElement;
    expect(ext.getAttribute("target")).toBe("_blank");
    expect(ext.getAttribute("rel")).toBe("noopener noreferrer");

    const { container: c2, render: r2 } = setup();
    r2({ type: "text", value: "x", runs: [{ text: "x", href: "/internal" }] });
    const int = textEl(c2).querySelector("a") as HTMLAnchorElement;
    expect(int.getAttribute("target")).toBeNull();
    expect(int.getAttribute("rel")).toBeNull();
  });

  it("adjacent runs sharing an identical href COALESCE into exactly ONE anchor (one tab stop, one SR announcement)", () => {
    const { container, render } = setup();
    render({
      type: "text",
      value: "see docs now",
      runs: [
        { text: "see ", href: "https://e.com/d" },
        { text: "docs", href: "https://e.com/d", bold: true },
        { text: " now", href: "https://e.com/d" },
      ],
    });
    const el = textEl(container);
    const anchors = el.querySelectorAll("a");
    expect(anchors.length).toBe(1);
    expect(anchors[0].textContent).toBe("see docs now");
    expect(anchors[0].querySelector("strong")?.textContent).toBe("docs");
  });

  it("adjacent runs with DIFFERENT hrefs stay separate anchors", () => {
    const { container, render } = setup();
    render({
      type: "text",
      value: "ab",
      runs: [
        { text: "a", href: "https://e.com/1" },
        { text: "b", href: "https://e.com/2" },
      ],
    });
    expect(textEl(container).querySelectorAll("a").length).toBe(2);
  });

  it("the anchor is OUTERMOST when a run has both href and emphasis", () => {
    const { container, render } = setup();
    render({ type: "text", value: "x", runs: [{ text: "x", href: "https://e.com", bold: true }] });
    const a = textEl(container).firstElementChild as HTMLElement;
    expect(a.tagName).toBe("A");
    expect((a.firstElementChild as HTMLElement).tagName).toBe("STRONG");
  });

  it("multiple runs concatenate in order with no separator", () => {
    const { container, render } = setup();
    render({ type: "text", value: "a b c", runs: [{ text: "a " }, { text: "b", bold: true }, { text: " c" }] });
    expect(textEl(container).textContent).toBe("a b c");
  });

  it("run text and href are inert — set via textContent, never parsed as HTML", () => {
    const { container, render } = setup();
    render({
      type: "text",
      value: "x",
      runs: [{ text: '<img src=x onerror=alert(1)>', href: "https://e.com/?a=<b>" }],
    });
    const el = textEl(container);
    expect(el.querySelector("img")).toBeNull();
    expect(el.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(el.innerHTML).toContain("&lt;img");
  });

  it("style:'pre' still renders a <pre> and nests the runs inside it", () => {
    const { container, render } = setup();
    render({ type: "text", value: "x", style: "pre", runs: [{ text: "x", code: true }] });
    const el = textEl(container);
    expect(el.tagName).toBe("PRE");
    expect(el.classList.contains("vms-text--pre")).toBe(true);
    expect(el.querySelector("code.vms-text__code")).not.toBeNull();
  });

  it("an empty runs array falls back to value (not an empty render)", () => {
    const { container, render } = setup();
    render({ type: "text", value: "fallback", runs: [] });
    expect(textEl(container).textContent).toBe("fallback");
  });

  it("DiffCell.runs drive word-level highlighting; cells without runs still render their text", () => {
    const { container, render } = setup();
    render({
      type: "diff",
      rows: [
        {
          old: { text: "the quick fox", runs: [{ text: "the " }, { text: "quick", strike: true }, { text: " fox" }] },
          new: { text: "the slow fox" },
        },
      ],
    });
    const cells = container.querySelectorAll(".vms-diff__cell:not(.vms-diff__cell--linenum)");
    expect(cells[0].querySelector("s.vms-text__strike")?.textContent).toBe("quick");
    expect(cells[0].textContent).toBe("the quick fox");
    expect(cells[1].textContent).toBe("the slow fox");
    expect(cells[1].querySelector("*")).toBeNull();
  });
});

// 6.12.0 (RADIO-01) — the radio inputType, additive to the FieldNode.inputType
// closed union. Renders a role="radiogroup" wrapping one <input type="radio"> per
// option; clicks write opt.value into bind. Options carry {value,label}; no
// new fields on the wire.
describe("6.12.0 — radio inputType", () => {
  it("renders one <input type='radio'> per option; the option matching stateValue is checked", () => {
    const { container, render } = setup({ priority: "med" });
    render({
      type: "field",
      name: "priority",
      inputType: "radio",
      bind: "priority",
      label: "Priority",
      options: [
        { value: "low", label: "Low" },
        { value: "med", label: "Medium" },
        { value: "high", label: "High" },
      ],
    });
    const group = container.querySelector<HTMLElement>(".vms-field--radio[role='radiogroup']");
    expect(group).not.toBeNull();
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='radio']"));
    expect(radios).toHaveLength(3);
    expect(radios.map(r => r.name)).toEqual(["priority", "priority", "priority"]);
    expect(radios.map(r => r.value)).toEqual(["low", "med", "high"]);
    expect(radios.map(r => r.checked)).toEqual([false, true, false]);
    // Option labels rendered next to the input.
    const labels = Array.from(container.querySelectorAll<HTMLElement>(".vms-field__radio-label"));
    expect(labels.map(l => l.textContent)).toEqual(["Low", "Medium", "High"]);
  });

  it("clicking a radio writes its value to state at the bind path", () => {
    const { container, render, state } = setup({ priority: "low" });
    render({
      type: "field",
      name: "priority",
      inputType: "radio",
      bind: "priority",
      options: [
        { value: "low", label: "Low" },
        { value: "med", label: "Medium" },
        { value: "high", label: "High" },
      ],
    });
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='radio']"));
    // Simulate the browser's native behavior: checking one unchecks its siblings.
    radios.forEach(r => { r.checked = false; });
    radios[2]!.checked = true;
    radios[2]!.dispatchEvent(new Event("change"));
    expect(state).toEqual({ priority: "high" });
  });

  it("radio renders with no option checked when stateValue matches nothing", () => {
    const { container, render } = setup({ priority: "unknown" });
    render({
      type: "field",
      name: "priority",
      inputType: "radio",
      bind: "priority",
      options: [
        { value: "low", label: "Low" },
        { value: "high", label: "High" },
      ],
    });
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>("input[type='radio']"));
    expect(radios.map(r => r.checked)).toEqual([false, false]);
  });
});

// 6.12.0 (RANGE-01) — the range inputType, additive to the FieldNode.inputType
// closed union. Falls through the default renderer branch (inp.type = "range")
// with min/max/step applied by decorateField. No new wire fields.
describe("6.12.0 — range inputType", () => {
  it("renders <input type='range'> with min/max/step applied and value bound to state", () => {
    const { container, render } = setup({ level: "42" });
    render({
      type: "field",
      name: "level",
      inputType: "range",
      bind: "level",
      label: "Level",
      min: "0",
      max: "100",
      step: "5",
    });
    const inp = container.querySelector<HTMLInputElement>("input.vms-field__input");
    expect(inp).not.toBeNull();
    expect(inp!.type).toBe("range");
    expect(inp!.min).toBe("0");
    expect(inp!.max).toBe("100");
    expect(inp!.step).toBe("5");
    expect(inp!.value).toBe("42");
  });

  it("dragging the slider writes the new value (as a string) back to state on 'input'", () => {
    const { container, render, state } = setup({ level: "10" });
    render({
      type: "field",
      name: "level",
      inputType: "range",
      bind: "level",
      min: "0",
      max: "100",
    });
    const inp = container.querySelector<HTMLInputElement>("input.vms-field__input")!;
    inp.value = "75";
    inp.dispatchEvent(new Event("input"));
    // Native <input type=range>.value is always a string; state carries that string.
    expect(state).toEqual({ level: "75" });
  });
});

// 6.12.0 (TOOL-01) — the tooltip prop cluster on 8 node types. Renderer stamps
// three things per tooltip-carrying element: native title=, .vms-has-tooltip
// class, data-vms-tooltip attribute. On mouseenter/focusin, a body-appended
// .vms-tooltip-host shows the tooltip; on mouseleave/focusout, it hides.
// (Body-appended in 6.12.1 to escape overflow contexts + edge clipping —
// Ashley's first-use verification found real bugs the CSS-only v1 couldn't fix.)
describe("6.12.0 — tooltip prop cluster", () => {
  it("ButtonNode with tooltip stamps title + .vms-has-tooltip + data-vms-tooltip on the <button>", () => {
    const { container, render } = setup();
    render({
      type: "button",
      label: "Delete",
      action: { name: "delete" },
      tooltip: "Removes the record permanently — cannot be undone.",
    });
    const btn = container.querySelector<HTMLButtonElement>("button.vms-button")!;
    expect(btn.title).toBe("Removes the record permanently — cannot be undone.");
    expect(btn.classList.contains("vms-has-tooltip")).toBe(true);
    expect(btn.dataset.vmsTooltip).toBe("Removes the record permanently — cannot be undone.");
  });

  it("BadgeNode with tooltip stamps the three tooltip attributes on the <span>", () => {
    const { container, render } = setup();
    render({
      type: "badge",
      label: "!!!",
      tone: "danger",
      tooltip: "3 tickets past SLA",
    });
    const span = container.querySelector<HTMLSpanElement>("span.vms-badge")!;
    expect(span.title).toBe("3 tickets past SLA");
    expect(span.classList.contains("vms-has-tooltip")).toBe(true);
    expect(span.dataset.vmsTooltip).toBe("3 tickets past SLA");
  });

  it("LinkNode with tooltip stamps the tooltip on the <a>", () => {
    const { container, render } = setup();
    render({
      type: "link",
      label: "Docs",
      href: "https://example.com",
      tooltip: "Open the framework docs",
    });
    const a = container.querySelector<HTMLAnchorElement>("a.vms-link")!;
    expect(a.title).toBe("Open the framework docs");
    expect(a.classList.contains("vms-has-tooltip")).toBe(true);
    expect(a.dataset.vmsTooltip).toBe("Open the framework docs");
  });

  it("TextNode with tooltip wraps text in .vms-text__anchor inner span (6.12.1 anchor fix)", () => {
    const { container, render } = setup();
    render({
      type: "text",
      value: "MTD",
      style: "heading",
      tooltip: "Month-to-date",
    });
    // The tooltip is on the INNER anchor span, not the outer .vms-text — so the
    // hover trigger + JS position measurement lands on the letters, not the
    // flex-stretched outer span (`.vms-text { flex: 1 }` in default.css).
    const outer = container.querySelector<HTMLElement>(".vms-text")!;
    expect(outer.title).toBe("");  // outer no longer carries the tooltip
    const anchor = container.querySelector<HTMLElement>(".vms-text__anchor")!;
    expect(anchor).not.toBeNull();
    expect(anchor.textContent).toBe("MTD");
    expect(anchor.title).toBe("Month-to-date");
    expect(anchor.classList.contains("vms-has-tooltip")).toBe(true);
    expect(anchor.dataset.vmsTooltip).toBe("Month-to-date");
  });

  it("TextNode WITHOUT tooltip renders bare text (no inner anchor wrapper — byte-identical to pre-6.12)", () => {
    const { container, render } = setup();
    render({ type: "text", value: "MTD", style: "heading" });
    const outer = container.querySelector<HTMLElement>(".vms-text")!;
    expect(outer.textContent).toBe("MTD");
    // No inner wrapper when tooltip absent — the pre-6.12 rendering path.
    expect(container.querySelector(".vms-text__anchor")).toBeNull();
  });

  it("TableColumn with tooltip stamps the tooltip on the header <th>", () => {
    const { container, render } = setup();
    render({
      type: "table",
      columns: [
        { key: "name", label: "Name" },
        { key: "mtd", label: "MTD", tooltip: "Month-to-date" },
      ],
      rows: [{ id: "1", cells: { name: "Alice", mtd: "1200" } }],
    });
    const ths = container.querySelectorAll<HTMLTableCellElement>("th.vms-table__th");
    expect(ths[0]!.title).toBe("");
    expect(ths[0]!.classList.contains("vms-has-tooltip")).toBe(false);
    expect(ths[1]!.title).toBe("Month-to-date");
    expect(ths[1]!.classList.contains("vms-has-tooltip")).toBe(true);
    expect(ths[1]!.dataset.vmsTooltip).toBe("Month-to-date");
  });

  it("a node WITHOUT tooltip stamps NONE of the three attributes (null-omission)", () => {
    const { container, render } = setup();
    render({ type: "button", label: "Save", action: { name: "save" } });
    const btn = container.querySelector<HTMLButtonElement>("button.vms-button")!;
    expect(btn.title).toBe("");
    expect(btn.classList.contains("vms-has-tooltip")).toBe(false);
    expect(btn.hasAttribute("data-vms-tooltip")).toBe(false);
  });

  it("empty-string tooltip is treated as absent (helper no-ops)", () => {
    const { container, render } = setup();
    render({ type: "button", label: "Save", action: { name: "save" }, tooltip: "" });
    const btn = container.querySelector<HTMLButtonElement>("button.vms-button")!;
    expect(btn.title).toBe("");
    expect(btn.classList.contains("vms-has-tooltip")).toBe(false);
    expect(btn.hasAttribute("data-vms-tooltip")).toBe(false);
  });

  // 6.12.1 (TOOL-02) — the body-appended tooltip host + mouseenter/mouseleave
  // behavior. Replaces the pure-CSS ::after v1 that couldn't escape overflow
  // contexts or detect viewport edges.
  it("mouseenter on a tooltip anchor appends a .vms-tooltip-host to <body> with the tooltip text", () => {
    const { container, render } = setup();
    render({
      type: "button",
      label: "Save",
      action: { name: "save" },
      tooltip: "Persists all fields",
    });
    const btn = container.querySelector<HTMLButtonElement>("button.vms-button")!;
    // Before mouseenter: no visible tooltip host.
    let host = document.body.querySelector<HTMLElement>(".vms-tooltip-host");
    expect(host === null || host.hidden === true).toBe(true);
    btn.dispatchEvent(new MouseEvent("mouseenter"));
    host = document.body.querySelector<HTMLElement>(".vms-tooltip-host")!;
    expect(host).not.toBeNull();
    expect(host.hidden).toBe(false);
    expect(host.textContent).toBe("Persists all fields");
    expect(host.getAttribute("role")).toBe("tooltip");
    // mouseleave hides it (host stays in DOM as a singleton — hidden=true).
    btn.dispatchEvent(new MouseEvent("mouseleave"));
    expect(host.hidden).toBe(true);
  });

  it("tooltip host is a SINGLETON — showing a second tooltip reuses the same host", () => {
    const { container, render } = setup();
    render({
      type: "section",
      children: [
        { type: "button", label: "A", action: { name: "a" }, tooltip: "first" },
        { type: "button", label: "B", action: { name: "b" }, tooltip: "second" },
      ],
    });
    const btns = container.querySelectorAll<HTMLButtonElement>("button.vms-button");
    btns[0]!.dispatchEvent(new MouseEvent("mouseenter"));
    const hostsAfterFirst = document.body.querySelectorAll(".vms-tooltip-host");
    expect(hostsAfterFirst).toHaveLength(1);
    expect(hostsAfterFirst[0]!.textContent).toBe("first");
    btns[0]!.dispatchEvent(new MouseEvent("mouseleave"));
    btns[1]!.dispatchEvent(new MouseEvent("mouseenter"));
    const hostsAfterSecond = document.body.querySelectorAll(".vms-tooltip-host");
    expect(hostsAfterSecond).toHaveLength(1);  // still ONE
    expect(hostsAfterSecond[0]!.textContent).toBe("second");
  });

  it("focusin/focusout show/hide the tooltip (keyboard-a11y parity with hover)", () => {
    const { container, render } = setup();
    render({
      type: "button",
      label: "Save",
      action: { name: "save" },
      tooltip: "Persists all fields",
    });
    const btn = container.querySelector<HTMLButtonElement>("button.vms-button")!;
    btn.dispatchEvent(new FocusEvent("focusin"));
    const host = document.body.querySelector<HTMLElement>(".vms-tooltip-host")!;
    expect(host.hidden).toBe(false);
    expect(host.textContent).toBe("Persists all fields");
    btn.dispatchEvent(new FocusEvent("focusout"));
    expect(host.hidden).toBe(true);
  });
});
