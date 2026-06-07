// Phase 6 — thin-interpreter rewrite.
//
// Every input declares a `bind` dotted path into state; the renderer reads
// that slot to render and writes back on user-input events. Dispatch carries
// only the action name. The 7 context-assembly sites that lived here
// (form harvest, select-on-change, field-on-Enter, standalone CheckboxNode,
// TabsNode, TableNode sort/filter/pagination/selection, ButtonNode pre-baked
// context) collapse to one pattern: read via sa.read(bind); write via
// sa.write(bind, value); dispatch { name }. Drafts ARE state. File-input
// persistence keeps a fileRegistry for the binary side channel; the picked
// file also lands in state as {filename, size}. Focus/caret/scroll
// preservation continue to operate on the DOM.

import type {
  ViewNode, ActionEvent, Adapter, StateAccess,
  PageNode, SectionNode, ListNode, ListItemNode,
  FormNode, FieldNode, CheckboxNode, ButtonNode,
  TextNode, LinkNode, ImageNode, StatBarNode, TabsNode, ProgressNode,
  ModalNode, TableNode, CopyButtonNode,
} from "./index.js";

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * No-op StateAccess fallback for callers that mount the adapter without a
 * live shell (theme-modifier tests, conformance fixture walks, etc.). Reads
 * return undefined; writes are dropped. This keeps the static-tree test
 * surface intact while the bind-path contract is mandatory for real apps.
 */
const noopStateAccess: StateAccess = {
  read: () => undefined,
  write: () => { /* drop */ },
};

export class BrowserAdapter implements Adapter {
  private fileRegistry = new Map<string, File>();
  private sa: StateAccess = noopStateAccess;

  constructor(private container: HTMLElement) {}

  render(
    vm: ViewNode,
    onAction: (action: ActionEvent) => void,
    stateAccess?: StateAccess,
  ): void {
    this.sa = stateAccess ?? noopStateAccess;

    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const focusId = active?.id || null;
    const selStart = active?.selectionStart ?? null;
    const selEnd = active?.selectionEnd ?? null;

    // 0.7.1 (#7) — snapshot the WINDOW scroll position alongside element-level
    // scroll. Without this, an action-driven re-render rebuilds the entire
    // subtree and the viewport jumps. Same preservation contract as before;
    // unchanged by the Phase 6 rewrite.
    const winScrollX = window.scrollX;
    const winScrollY = window.scrollY;

    const scrollMap = new Map<string, { top: number; left: number }>();
    this.container.querySelectorAll<HTMLElement>("[id]").forEach(el => {
      if (el.scrollTop !== 0 || el.scrollLeft !== 0)
        scrollMap.set(el.id, { top: el.scrollTop, left: el.scrollLeft });
    });

    this.container.innerHTML = "";
    this.node(vm, this.container, onAction);

    if (focusId) {
      const el = this.container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
        `#${CSS.escape(focusId)}`
      );
      if (el) {
        el.focus({ preventScroll: true });
        if (selStart !== null && selEnd !== null) {
          try { el.setSelectionRange(selStart, selEnd); } catch { /* nothing */ }
        }
      }
    }

    scrollMap.forEach(({ top, left }, id) => {
      const el = this.container.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (el) { el.scrollTop = top; el.scrollLeft = left; }
    });

    window.scrollTo(winScrollX, winScrollY);
  }

  navigate(url: string): void {
    window.location.href = url;
  }

  storage(scope: "local" | "session", key: string, value: string): void {
    const store = scope === "session" ? sessionStorage : localStorage;
    store.setItem(key, value);
  }

  saveFile(data: Blob, filename: string, _contentType: string): void {
    const url = URL.createObjectURL(data);
    try {
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }

  setBusy(active: boolean): void {
    this.container.classList.toggle("vms-busy", active);
  }

  private unloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
  setPreventUnload(active: boolean): void {
    if (active && this.unloadHandler == null) {
      this.unloadHandler = (e: BeforeUnloadEvent): void => {
        e.preventDefault();
        e.returnValue = "";
      };
      window.addEventListener("beforeunload", this.unloadHandler);
    } else if (!active && this.unloadHandler != null) {
      window.removeEventListener("beforeunload", this.unloadHandler);
      this.unloadHandler = null;
    }
  }

  async transport(
    input: string,
    init: { method?: string; headers?: Record<string, string>; body?: FormData | string },
    hooks?: { onUploadProgress?: (sent: number, total: number) => void },
  ): Promise<Response> {
    const onUploadProgress = hooks?.onUploadProgress;
    if (!onUploadProgress) {
      return fetch(input, init);
    }

    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(init.method ?? "POST", input);
      for (const [k, v] of Object.entries(init.headers ?? {})) {
        xhr.setRequestHeader(k, v);
      }

      let knownTotal = 0;
      let lastLoaded = 0;

      xhr.upload.onprogress = (e: ProgressEvent) => {
        lastLoaded = e.loaded;
        if (e.lengthComputable) {
          knownTotal = e.total;
          onUploadProgress(e.loaded, e.total);
        } else {
          onUploadProgress(e.loaded, 0);
        }
      };

      xhr.onload = () => {
        if (knownTotal > 0) onUploadProgress(knownTotal, knownTotal);
        else onUploadProgress(lastLoaded, lastLoaded);
        if (xhr.status === 0) {
          reject(new Error(`Transport request to ${input} failed (status 0)`));
          return;
        }
        resolve(
          new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
          }),
        );
      };

      xhr.onerror = () => reject(new Error(`Transport request to ${input} failed`));
      xhr.ontimeout = () => reject(new Error(`Transport request to ${input} timed out`));
      xhr.onabort = () => reject(new Error(`Transport request to ${input} aborted`));

      xhr.send(init.body ?? null);
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
      case "image":     return this.image(n, parent);
      case "stat-bar":  return this.statBar(n, parent);
      case "tabs":      return this.tabs(n, parent, on);
      case "progress":  return this.progress(n, parent);
      case "modal":        return this.modal(n, parent, on);
      case "table":        return this.table(n, parent, on);
      case "copy-button":  return this.copyButton(n, parent);
    }
  }

  private kids(nodes: ViewNode[], parent: HTMLElement, on: (a: ActionEvent) => void): void {
    nodes.forEach(n => this.node(n, parent, on));
  }

  private page(n: PageNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const el = document.createElement("div");
    el.className = `vms-page${n.density === "compact" ? " vms-page--compact" : ""}${
      n.layout && n.layout !== "stack" ? ` vms-page--${n.layout}` : ""}${
      n.width ? ` vms-page--${n.width}` : ""}`;
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
    el.className = `vms-section${n.variant === "card" ? " vms-section--card" : ""}${
      n.layout && n.layout !== "stack" ? ` vms-section--${n.layout}` : ""}`;
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

  /** FormNode — no harvest. Field values live in state via their bind paths;
   *  submit dispatches just `{name}`. File inputs are walked for binaries to
   *  attach to action.files (multipart side channel). */
  private form(n: FormNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const form = document.createElement("form");
    form.className = `vms-form${n.layout && n.layout !== "stack" ? ` vms-form--${n.layout}` : ""}`;
    form.noValidate = true;
    this.kids(n.children, form, on);

    const dispatchWithFiles = (action: ActionEvent): void => {
      const files: Record<string, File> = {};
      form.querySelectorAll<HTMLInputElement>("input[type=file]").forEach(inp => {
        if (inp.name && inp.files?.[0]) files[inp.name] = inp.files[0];
      });
      const ev: ActionEvent = { name: action.name };
      if (Object.keys(files).length > 0) ev.files = files;
      on(ev);
    };

    if (n.submitAction) {
      const submitAction = n.submitAction;
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "vms-button vms-button--primary";
      submit.textContent = n.submitLabel ?? "Submit";
      form.appendChild(submit);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        dispatchWithFiles(submitAction);
      });
    } else {
      // No default submit — neutralize implicit Enter submission so a
      // single-field buttons[]-only form doesn't reload via native submit.
      form.addEventListener("submit", (e) => e.preventDefault());
    }

    if (n.buttons && n.buttons.length > 0) {
      const row = document.createElement("div");
      row.className = "vms-form__buttons";
      const buttonOn = (action: ActionEvent): void => dispatchWithFiles(action);
      for (const btn of n.buttons) this.button(btn, row, buttonOn);
      form.appendChild(row);
    }

    parent.appendChild(form);
  }

  /** FieldNode — reads value from `sa.read(bind)`; writes back on input/change.
   *  When `action` is set, it fires on Enter (text-like) or change (select) —
   *  the new value is already in state by that point. */
  private field(n: FieldNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const stateValue = this.sa.read(n.bind);

    if (n.inputType === "hidden") {
      // Hidden fields don't write back — server is authoritative for hidden.
      const inp = document.createElement("input");
      inp.type = "hidden";
      inp.name = n.name;
      inp.value = stateValue == null ? "" : String(stateValue);
      parent.appendChild(inp);
      return;
    }

    if (n.inputType === "checkbox") {
      // FieldNode of type checkbox — used as a form-collected checkbox (the
      // standalone CheckboxNode is the immediate-dispatch variant). Bind path
      // holds a boolean.
      const wrapper = document.createElement("div");
      wrapper.className = "vms-field vms-field--checkbox";

      const inp = document.createElement("input");
      inp.type = "checkbox";
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.name = n.name;
      inp.checked = Boolean(stateValue);
      inp.addEventListener("change", () => {
        this.sa.write(n.bind, inp.checked);
      });

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
      const isMulti = n.inputType === "select-multiple";
      const selectedSet: Set<string> = isMulti && Array.isArray(stateValue)
        ? new Set((stateValue as unknown[]).map(String))
        : new Set();
      const selectedSingle: string = !isMulti && stateValue != null ? String(stateValue) : "";
      (n.options ?? []).forEach(opt => {
        const o = document.createElement("option");
        o.value = opt.value;
        o.textContent = opt.label;
        o.selected = isMulti ? selectedSet.has(opt.value) : opt.value === selectedSingle;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => {
        if (isMulti) {
          const arr = Array.from(sel.selectedOptions).map(o => o.value);
          this.sa.write(n.bind, arr);
        } else {
          this.sa.write(n.bind, sel.value);
        }
        if (n.action) on({ name: n.action.name });
      });
      wrapper.appendChild(sel);
    } else if (n.inputType === "file") {
      const inp = document.createElement("input");
      inp.type = "file";
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.name = n.name;
      // File-input persistence: re-apply any registered file to the new node.
      const existingFile = this.fileRegistry.get(n.name);
      if (existingFile) {
        try {
          const dt = new DataTransfer();
          dt.items.add(existingFile);
          inp.files = dt.files;
        } catch { /* nothing */ }
      }
      inp.addEventListener("change", () => {
        const file = inp.files?.[0];
        if (file) {
          this.fileRegistry.set(n.name, file);
          // Per Phase-6 decision: the picked file is visible in state as a
          // serialization-safe placeholder; the binary travels on the
          // multipart side channel.
          this.sa.write(n.bind, { filename: file.name, size: file.size });
        } else {
          this.fileRegistry.delete(n.name);
          this.sa.write(n.bind, null);
        }
      });
      wrapper.appendChild(inp);
    } else if (n.inputType === "textarea") {
      const ta = document.createElement("textarea");
      ta.className = "vms-field__input";
      ta.id = `vms-${n.name}`;
      ta.name = n.name;
      if (n.placeholder) ta.placeholder = n.placeholder;
      ta.value = stateValue == null ? "" : String(stateValue);
      if (n.required) ta.required = true;
      ta.addEventListener("input", () => { this.sa.write(n.bind, ta.value); });
      wrapper.appendChild(ta);
    } else if (n.inputType === "code") {
      // Monospaced editable text. Tab inserts a literal tab instead of moving
      // focus. Apps wanting syntax highlighting attach their own library
      // (CodeMirror, Monaco) using the .vms-field--code-{language} class hook.
      wrapper.classList.add("vms-field--code");
      if (n.language) wrapper.classList.add(`vms-field--code-${n.language}`);
      const ta = document.createElement("textarea");
      ta.className = "vms-field__input vms-field__input--code";
      ta.id = `vms-${n.name}`;
      ta.name = n.name;
      ta.spellcheck = false;
      ta.autocapitalize = "off";
      ta.autocomplete = "off";
      ta.setAttribute("autocorrect", "off");
      if (n.placeholder) ta.placeholder = n.placeholder;
      ta.value = stateValue == null ? "" : String(stateValue);
      if (n.required) ta.required = true;
      ta.addEventListener("input", () => { this.sa.write(n.bind, ta.value); });
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = ta.selectionStart ?? 0;
          const end   = ta.selectionEnd   ?? 0;
          ta.value = ta.value.slice(0, start) + "\t" + ta.value.slice(end);
          ta.selectionStart = ta.selectionEnd = start + 1;
          this.sa.write(n.bind, ta.value);
        }
      });
      wrapper.appendChild(ta);
    } else {
      const inp = document.createElement("input");
      inp.className = "vms-field__input";
      inp.id = `vms-${n.name}`;
      inp.type = n.inputType;
      inp.name = n.name;
      if (n.placeholder) inp.placeholder = n.placeholder;
      inp.value = stateValue == null ? "" : String(stateValue);
      if (n.required) inp.required = true;
      inp.addEventListener("input", () => { this.sa.write(n.bind, inp.value); });
      if (n.action) {
        const action = n.action;
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Belt-and-suspenders: flush the latest value to state before
            // dispatching, in case the browser hasn't fired `input` yet
            // (e.g. an autofill that lands then submits).
            this.sa.write(n.bind, inp.value);
            on({ name: action.name });
          }
        });
      }
      wrapper.appendChild(inp);
    }

    parent.appendChild(wrapper);
  }

  /** CheckboxNode (standalone, immediate-dispatch) — bound boolean; on toggle,
   *  write to state then dispatch the action name (if any). */
  private checkbox(n: CheckboxNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const lbl = document.createElement("label");
    lbl.className = "vms-checkbox";
    const inp = document.createElement("input");
    inp.type = "checkbox";
    inp.className = "vms-checkbox__input";
    inp.name = n.name;
    inp.checked = Boolean(this.sa.read(n.bind));
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
    inp.addEventListener("change", () => {
      this.sa.write(n.bind, inp.checked);
      if (n.action) on({ name: n.action.name });
    });
    parent.appendChild(lbl);
  }

  private button(n: ButtonNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vms-button${n.variant ? ` vms-button--${n.variant}` : ""}`;
    btn.textContent = n.label;
    btn.addEventListener("click", () => {
      // pendingLabel: instant client-side feedback. Swap text + add
      // .vms-button--pending BEFORE handing off to the dispatcher. On
      // success the next render replaces the button entirely. On dispatch
      // error, the shell re-renders so the original label snaps back.
      if (n.pendingLabel) {
        btn.textContent = n.pendingLabel;
        btn.classList.add("vms-button--pending");
      }
      on(n.action);
    });
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

  /** TabsNode — on click, write tab.value to state at node.bind, then dispatch
   *  the tab's own action name. */
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
        this.sa.write(n.bind, tab.value);
        on({ name: tab.action.name });
      });
      nav.appendChild(btn);
    });
    parent.appendChild(nav);
  }

  private image(n: ImageNode, parent: HTMLElement): void {
    const img = document.createElement("img");
    let cls = "vms-image";
    if (n.size) cls += ` vms-image--${n.size}`;
    if (n.shape) cls += ` vms-image--${n.shape}`;
    img.className = cls;
    img.src = n.src;
    if (n.alt != null) img.alt = n.alt;
    parent.appendChild(img);
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
    modal.className = `vms-modal${n.size ? ` vms-modal--${n.size}` : ""}`;
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

    if (n.footer && n.footer.length > 0) {
      const footer = document.createElement("div");
      footer.className = "vms-modal__footer";
      this.kids(n.footer, footer, on);
      modal.appendChild(footer);
    }

    backdrop.appendChild(modal);
    parent.appendChild(backdrop);
  }

  /** TableNode — sort writes {column, direction} to sortBind then dispatches
   *  sortActions[col.key]; filter inputs are bound to filterBinds[col.key],
   *  every keystroke writes, Enter dispatches filterAction; pagination
   *  prev/next write the target page to paginationBind then dispatch
   *  prevAction/nextAction. Per-row buttons are plain ButtonNodes. Selection
   *  is no longer a framework concept. */
  private table(n: TableNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const wrapper = document.createElement("div");
    wrapper.className = "vms-table-wrapper";

    const table = document.createElement("table");
    table.className = "vms-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    const sortIntent = (n.sortBind != null ? this.sa.read(n.sortBind) : null) as
      | { column?: string; direction?: "asc" | "desc" }
      | null
      | undefined;
    const sortedCol = sortIntent?.column;
    const sortedDir = sortIntent?.direction;

    n.columns.forEach(col => {
      const th = document.createElement("th");
      const isSorted = col.key === sortedCol;
      const dir = isSorted ? (sortedDir ?? "asc") : null;
      let classes = "vms-table__th";
      if (col.sortable) classes += " vms-table__th--sortable";
      if (dir === "asc") classes += " vms-table__th--asc";
      if (dir === "desc") classes += " vms-table__th--desc";
      th.className = classes;
      th.textContent = col.label;
      const sortAction = n.sortActions?.[col.key];
      if (col.sortable && sortAction && n.sortBind != null) {
        const sortBind = n.sortBind;
        th.addEventListener("click", () => {
          const nextDir: "asc" | "desc" = isSorted && sortedDir === "asc" ? "desc" : "asc";
          this.sa.write(sortBind, { column: col.key, direction: nextDir });
          on({ name: sortAction.name });
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
          const bindPath = n.filterBinds?.[col.key];
          const bound = bindPath != null ? this.sa.read(bindPath) : undefined;
          inp.value = bound != null
            ? String(bound)
            : (col.filterValue ?? "");
          inp.placeholder = `Filter…`;
          if (bindPath != null) {
            inp.addEventListener("input", () => { this.sa.write(bindPath, inp.value); });
          }
          inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              if (bindPath != null) this.sa.write(bindPath, inp.value);
              on({ name: filterAction.name });
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
      tr.className = rowClass;
      if (row.id) tr.dataset.id = row.id;
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
      // Per-row buttons render as plain ButtonNodes in a trailing actions cell.
      if (row.actions && row.actions.length > 0) {
        const td = document.createElement("td");
        td.className = "vms-table__td vms-table__td--actions";
        for (const btn of row.actions) this.button(btn, td, on);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrapper.appendChild(table);

    if (n.pagination) {
      const pg = n.pagination;
      const footer = document.createElement("div");
      footer.className = "vms-table__pagination";

      const totalPages = Math.max(1, Math.ceil(pg.totalRows / pg.pageSize));
      const from = pg.totalRows === 0 ? 0 : (pg.page - 1) * pg.pageSize + 1;
      const to = Math.min(pg.page * pg.pageSize, pg.totalRows);

      const range = document.createElement("span");
      range.className = "vms-table__pagination-range";
      range.textContent = `${from}–${to} of ${pg.totalRows}`;
      footer.appendChild(range);

      const paginationBind = n.paginationBind;
      const mkBtn = (
        label: string,
        targetPage: number,
        action: ActionEvent | undefined,
        disabled: boolean,
      ): HTMLButtonElement => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "vms-button vms-button--secondary vms-table__pagination-btn";
        b.textContent = label;
        b.disabled = disabled;
        if (!disabled && action) {
          b.addEventListener("click", () => {
            if (paginationBind != null) this.sa.write(paginationBind, targetPage);
            on({ name: action.name });
          });
        }
        return b;
      };
      const prevDisabled = pg.page <= 1 || pg.prevAction == null;
      const nextDisabled = pg.page >= totalPages || pg.nextAction == null;
      footer.appendChild(mkBtn("‹ Prev", pg.page - 1, pg.prevAction, prevDisabled));
      footer.appendChild(mkBtn("Next ›", pg.page + 1, pg.nextAction, nextDisabled));

      wrapper.appendChild(footer);
    }

    parent.appendChild(wrapper);
  }

  private copyButton(n: CopyButtonNode, parent: HTMLElement): void {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `vms-button${n.variant ? ` vms-button--${n.variant}` : ""}`;
    btn.textContent = n.label ?? "Copy";
    btn.addEventListener("click", () => {
      const write = navigator.clipboard?.writeText(n.text);
      if (write) {
        write.then(() => {
          btn.textContent = n.copiedLabel ?? "Copied!";
          setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
        }).catch(() => {
          if (legacyCopy(n.text)) {
            btn.textContent = n.copiedLabel ?? "Copied!";
            setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
          }
        });
      } else {
        if (legacyCopy(n.text)) {
          btn.textContent = n.copiedLabel ?? "Copied!";
          setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
        }
      }
    });
    parent.appendChild(btn);
  }
}
