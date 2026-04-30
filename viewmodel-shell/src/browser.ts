import type {
  ViewNode, ActionEvent, Adapter,
  PageNode, SectionNode, ListNode, ListItemNode,
  FormNode, FieldNode, CheckboxNode, ButtonNode,
  TextNode, LinkNode, StatBarNode, TabsNode, ProgressNode,
  ModalNode, TableNode,
} from "./index";

export class BrowserAdapter implements Adapter {
  private fileRegistry = new Map<string, File>();

  constructor(private container: HTMLElement) {}

  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void {
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const focusId = active?.id || null;
    const selStart = active?.selectionStart ?? null;
    const selEnd = active?.selectionEnd ?? null;

    const scrollMap = new Map<string, { top: number; left: number }>();
    this.container.querySelectorAll<HTMLElement>("[id]").forEach(el => {
      if (el.scrollTop !== 0 || el.scrollLeft !== 0)
        scrollMap.set(el.id, { top: el.scrollTop, left: el.scrollLeft });
    });

    const draftValues = new Map<string, string>();
    this.container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input:not([type=checkbox]):not([type=hidden]):not([type=file]), textarea"
    ).forEach(el => { if (el.name) draftValues.set(el.name, el.value); });

    this.container.innerHTML = "";
    this.node(vm, this.container, onAction);

    if (draftValues.size > 0) {
      this.container.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input:not([type=checkbox]):not([type=hidden]):not([type=file]), textarea"
      ).forEach(el => {
        if (el.name && !el.value && draftValues.has(el.name))
          el.value = draftValues.get(el.name)!;
      });
    }

    if (focusId) {
      const el = this.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `#${CSS.escape(focusId)}`
      );
      if (el) {
        el.focus();
        if (selStart !== null && selEnd !== null) {
          try { el.setSelectionRange(selStart, selEnd); } catch {}
        }
      }
    }

    scrollMap.forEach(({ top, left }, id) => {
      const el = this.container.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (el) { el.scrollTop = top; el.scrollLeft = left; }
    });
  }

  private node(n: ViewNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    switch (n.type) {
      case "page":      return this.page(n, parent, on);
      case "section":   return this.section(n, parent, on);
      case "list":      return this.list(n, parent, on);
      case "list-item": return this.listItem(n, parent, on);
      case "form":      return this.form(n, parent, on);
      case "field":     return this.field(n, parent, on);
      case "checkbox":  return this.checkbox(n, parent, on);
      case "button":    return this.button(n, parent, on);
      case "text":      return this.text(n, parent);
      case "link":      return this.link(n, parent);
      case "stat-bar":  return this.statBar(n, parent);
      case "tabs":      return this.tabs(n, parent, on);
      case "progress":  return this.progress(n, parent);
      case "modal":     return this.modal(n, parent, on);
      case "table":     return this.table(n, parent, on);
    }
  }

  private kids(nodes: ViewNode[], parent: HTMLElement, on: (a: ActionEvent) => void): void {
    nodes.forEach(n => this.node(n, parent, on));
  }

  private page(n: PageNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const el = document.createElement("div");
    el.className = "vms-page";
    if (n.title) {
      const h = document.createElement("h1");
      h.className = "vms-page__title";
      h.textContent = n.title;
      el.appendChild(h);
    }
    this.kids(n.children, el, on);
    parent.appendChild(el);
  }

  private section(n: SectionNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const el = document.createElement("section");
    el.className = "vms-section";
    if (n.heading) {
      const h = document.createElement("h2");
      h.className = "vms-section__heading";
      h.textContent = n.heading;
      el.appendChild(h);
    }
    this.kids(n.children, el, on);
    parent.appendChild(el);
  }

  private list(n: ListNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const ul = document.createElement("ul");
    ul.className = "vms-list";
    if (n.id) ul.id = n.id;
    this.kids(n.children, ul, on);
    parent.appendChild(ul);
  }

  private listItem(n: ListItemNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const li = document.createElement("li");
    li.className = `vms-list-item${n.variant ? ` vms-list-item--${n.variant}` : ""}`;
    if (n.id) li.dataset.id = n.id;
    this.kids(n.children, li, on);
    parent.appendChild(li);
  }

  private form(n: FormNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const form = document.createElement("form");
    form.className = "vms-form";
    form.noValidate = true;
    this.kids(n.children, form, on);
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.className = "vms-button vms-button--primary";
    submit.textContent = n.submitLabel ?? "Submit";
    form.appendChild(submit);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const ctx: Record<string, unknown> = { ...(n.submitAction.context ?? {}) };
      const files: Record<string, File> = {};

      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        "input:not([type=checkbox]):not([type=file]), textarea"
      ).forEach(el => { if (el.name) ctx[el.name] = el.value; });

      // Form-collected checkboxes (FieldNode inputType="checkbox").
      // CheckboxNode renders with .vms-checkbox__input and is excluded so its
      // immediate-dispatch path stays the only way it talks to the server.
      form.querySelectorAll<HTMLInputElement>(
        "input.vms-field__input[type=checkbox]"
      ).forEach(el => { if (el.name) ctx[el.name] = el.checked; });

      form.querySelectorAll<HTMLSelectElement>("select:not([multiple])").forEach(sel => {
        if (sel.name) ctx[sel.name] = sel.value;
      });

      form.querySelectorAll<HTMLSelectElement>("select[multiple]").forEach(sel => {
        if (sel.name)
          ctx[sel.name] = Array.from(sel.selectedOptions).map(o => o.value).join(",");
      });

      form.querySelectorAll<HTMLInputElement>("input[type=file]").forEach(inp => {
        if (inp.name && inp.files?.[0]) files[inp.name] = inp.files[0];
      });

      const action: ActionEvent = { name: n.submitAction.name, context: ctx };
      if (Object.keys(files).length > 0) action.files = files;
      on(action);
    });
    parent.appendChild(form);
  }

  private field(n: FieldNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    if (n.inputType === "hidden") {
      const inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = n.name;
      if (n.value) inp.value = n.value;
      parent.appendChild(inp);
      return;
    }

    if (n.inputType === "checkbox") {
      const wrapper = document.createElement("div");
      wrapper.className = "vms-field vms-field--checkbox";

      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.name = n.name;
      inp.checked = !!n.value && n.value !== "false" && n.value !== "0";

      wrapper.appendChild(inp);

      if (n.label) {
        const lbl = document.createElement("label");
        lbl.className = "vms-field__label";
        lbl.htmlFor = `vms-${n.name}`;
        lbl.textContent = n.label;
        wrapper.appendChild(lbl);
      }
      parent.appendChild(wrapper);
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.className = "vms-field";

    if (n.label) {
      const lbl = document.createElement("label");
      lbl.className = "vms-field__label";
      lbl.htmlFor = `vms-${n.name}`;
      lbl.textContent = n.label;
      wrapper.appendChild(lbl);
    }

    if (n.inputType === "select" || n.inputType === "select-multiple") {
      const sel = document.createElement("select");
      sel.className = "vms-field__input";
      sel.id = `vms-${n.name}`;
      sel.name = n.name;
      sel.multiple = n.inputType === "select-multiple";
      (n.options ?? []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        o.selected = n.inputType === "select-multiple"
          ? (n.value ?? "").split(",").map(s => s.trim()).includes(opt.value)
          : opt.value === n.value;
        sel.appendChild(o);
      });
      if (n.action) {
        const action = n.action;
        sel.addEventListener("change", () => {
          on({ name: action.name, context: { ...(action.context ?? {}), [n.name]: sel.value } });
        });
      }
      wrapper.appendChild(sel);
    } else if (n.inputType === "file") {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.name = n.name;
      const existingFile = this.fileRegistry.get(n.name);
      if (existingFile) {
        try {
          const dt = new DataTransfer();
          dt.items.add(existingFile);
          inp.files = dt.files;
        } catch {}
      }
      inp.addEventListener("change", () => {
        const file = inp.files?.[0];
        if (file) this.fileRegistry.set(n.name, file);
        else this.fileRegistry.delete(n.name);
      });
      wrapper.appendChild(inp);
    } else if (n.inputType === "textarea") {
      const ta = document.createElement("textarea");
      ta.className = "vms-field__input";
      ta.id = `vms-${n.name}`;
      ta.name = n.name;
      if (n.placeholder) ta.placeholder = n.placeholder;
      if (n.value) ta.value = n.value;
      if (n.required) ta.required = true;
      wrapper.appendChild(ta);
    } else {
      const inp = document.createElement("input");
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.type = n.inputType;
      inp.name = n.name;
      if (n.placeholder) inp.placeholder = n.placeholder;
      if (n.value) inp.value = n.value;
      if (n.required) inp.required = true;
      if (n.action) {
        const action = n.action;
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            on({ name: action.name, context: { ...(action.context ?? {}), [n.name]: inp.value } });
          }
        });
      }
      wrapper.appendChild(inp);
    }

    parent.appendChild(wrapper);
  }

  private checkbox(n: CheckboxNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const lbl = document.createElement("label");
    lbl.className = "vms-checkbox";
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.className = "vms-checkbox__input";
    inp.name = n.name;
    inp.checked = n.checked;
    const mark = document.createElement("span");
    mark.className = "vms-checkbox__mark";
    lbl.appendChild(inp);
    lbl.appendChild(mark);
    if (n.label) {
      const span = document.createElement("span");
      span.className = "vms-checkbox__label";
      span.textContent = n.label;
      lbl.appendChild(span);
    }
    if (n.action) {
      const action = n.action;
      inp.addEventListener("change", () => {
        on({ name: action.name, context: { ...(action.context ?? {}), checked: inp.checked } });
      });
    }
    parent.appendChild(lbl);
  }

  private button(n: ButtonNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vms-button${n.variant ? ` vms-button--${n.variant}` : ""}`;
    btn.textContent = n.label;
    btn.addEventListener("click", () => on(n.action));
    parent.appendChild(btn);
  }

  private text(n: TextNode, parent: HTMLElement): void {
    const el = document.createElement(n.style === "pre" ? "pre" : "span");
    el.className = `vms-text${n.style ? ` vms-text--${n.style}` : ""}`;
    el.textContent = n.value;
    parent.appendChild(el);
  }

  private link(n: LinkNode, parent: HTMLElement): void {
    const a = document.createElement("a");
    a.className = "vms-link";
    a.href = n.href;
    a.textContent = n.label;
    if (n.external) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
    parent.appendChild(a);
  }

  private statBar(n: StatBarNode, parent: HTMLElement): void {
    const bar = document.createElement("div");
    bar.className = "vms-stat-bar";
    n.stats.forEach(stat => {
      const item = document.createElement("div");
      item.className = "vms-stat-bar__item";
      const val = document.createElement("span");
      val.className = "vms-stat-bar__value";
      val.textContent = String(stat.value);
      const lbl = document.createElement("span");
      lbl.className = "vms-stat-bar__label";
      lbl.textContent = stat.label;
      item.appendChild(val);
      item.appendChild(lbl);
      bar.appendChild(item);
    });
    parent.appendChild(bar);
  }

  private tabs(n: TabsNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const nav = document.createElement("nav");
    nav.className = "vms-tabs";
    nav.setAttribute("role", "tablist");
    n.tabs.forEach(tab => {
      const btn = document.createElement("button");
      btn.className = `vms-tabs__tab${tab.value === n.selected ? " vms-tabs__tab--active" : ""}`;
      btn.textContent = tab.label;
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", String(tab.value === n.selected));
      btn.addEventListener("click", () => {
        on({ name: n.action.name, context: { ...(n.action.context ?? {}), value: tab.value } });
      });
      nav.appendChild(btn);
    });
    parent.appendChild(nav);
  }

  private progress(n: ProgressNode, parent: HTMLElement): void {
    const track = document.createElement("div");
    track.className = "vms-progress";
    const bar = document.createElement("div");
    bar.className = "vms-progress__bar";
    bar.style.width = `${n.value}%`;
    track.appendChild(bar);
    parent.appendChild(track);
  }

  private modal(n: ModalNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const backdrop = document.createElement("div");
    backdrop.className = "vms-modal-backdrop";

    const modal = document.createElement("div");
    modal.className = "vms-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const header = document.createElement("div");
    header.className = "vms-modal__header";

    if (n.title) {
      const title = document.createElement("span");
      title.className = "vms-modal__title";
      title.textContent = n.title;
      header.appendChild(title);
    }

    if (n.dismissAction) {
      const action = n.dismissAction;
      const closeBtn = document.createElement("button");
      closeBtn.type = "button";
      closeBtn.className = "vms-modal__close";
      closeBtn.textContent = "✕";
      closeBtn.addEventListener("click", () => on(action));
      header.appendChild(closeBtn);
    }

    modal.appendChild(header);

    const body = document.createElement("div");
    body.className = "vms-modal__body";
    this.kids(n.children, body, on);
    modal.appendChild(body);

    backdrop.appendChild(modal);
    parent.appendChild(backdrop);
  }

  private table(n: TableNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const wrapper = document.createElement("div");
    wrapper.className = "vms-table-wrapper";

    const table = document.createElement("table");
    table.className = "vms-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");
    n.columns.forEach(col => {
      const th = document.createElement("th");
      const isSorted = col.key === n.sortColumn;
      const dir = isSorted ? (n.sortDirection ?? "asc") : null;
      let classes = "vms-table__th";
      if (col.sortable) classes += " vms-table__th--sortable";
      if (dir === "asc") classes += " vms-table__th--asc";
      if (dir === "desc") classes += " vms-table__th--desc";
      th.className = classes;
      th.textContent = col.label;
      if (col.sortable && n.sortAction) {
        const sortAction = n.sortAction;
        th.addEventListener("click", () => {
          const nextDir = isSorted && n.sortDirection === "asc" ? "desc" : "asc";
          on({ name: sortAction.name, context: { ...(sortAction.context ?? {}), column: col.key, direction: nextDir } });
        });
      }
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    const hasFilters = n.columns.some(c => c.filterable) && !!n.filterAction;
    if (hasFilters) {
      const filterAction = n.filterAction!;
      const filterRow = document.createElement("tr");
      filterRow.className = "vms-table__filter-row";
      n.columns.forEach(col => {
        const th = document.createElement("th");
        if (col.filterable) {
          const inp = document.createElement("input");
          inp.type = "text";
          inp.className = "vms-table__filter-input";
          inp.dataset.col = col.key;
          inp.value = col.filterValue ?? "";
          inp.placeholder = `Filter…`;
          inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              const filters: Record<string, string> = {};
              filterRow.querySelectorAll<HTMLInputElement>("[data-col]").forEach(el => {
                filters[el.dataset.col!] = el.value;
              });
              on({ name: filterAction.name, context: { ...(filterAction.context ?? {}), column: col.key, value: inp.value, filters } });
            }
          });
          th.appendChild(inp);
        }
        filterRow.appendChild(th);
      });
      thead.appendChild(filterRow);
    }

    table.appendChild(thead);

    const tbody = document.createElement("tbody");
    n.rows.forEach(row => {
      const tr = document.createElement("tr");
      let rowClass = "vms-table__row";
      if (row.variant) rowClass += ` vms-table__row--${row.variant}`;
      if (row.action) rowClass += " vms-table__row--clickable";
      tr.className = rowClass;
      if (row.id) tr.dataset.id = row.id;
      if (row.action) {
        const rowAction = row.action;
        tr.addEventListener("click", () => on(rowAction));
      }
      n.columns.forEach(col => {
        const td = document.createElement("td");
        td.className = "vms-table__td";
        const cellValue = row.cells[col.key] ?? "";
        if (col.linkLabel && cellValue) {
          const a = document.createElement("a");
          a.href = cellValue;
          a.textContent = col.linkLabel;
          a.className = "vms-table__link";
          if (col.linkExternal) {
            a.target = "_blank";
            a.rel = "noopener noreferrer";
          }
          td.appendChild(a);
        } else {
          td.textContent = cellValue;
        }
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrapper.appendChild(table);
    parent.appendChild(wrapper);
  }
}
