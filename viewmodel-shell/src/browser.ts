import type {
  ViewNode, ActionEvent, Adapter,
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

export class BrowserAdapter implements Adapter {
  private fileRegistry = new Map<string, File>();

  constructor(private container: HTMLElement) {}

  render(vm: ViewNode, onAction: (action: ActionEvent) => void): void {
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const focusId = active?.id || null;
    const selStart = active?.selectionStart ?? null;
    const selEnd = active?.selectionEnd ?? null;

    // 0.7.1 (#7) — snapshot the WINDOW scroll position alongside element-level
    // scroll. Without this, an action-driven re-render rebuilds the entire
    // subtree and the viewport jumps (to top, or wherever HTMLElement.focus()
    // scrolled the restored-focus element into view). Same preservation
    // contract as element scroll: preserve unless the server explicitly
    // navigates (a redirect IS a navigation, so it correctly does NOT
    // round-trip through render — it goes through navigate()).
    const winScrollX = window.scrollX;
    const winScrollY = window.scrollY;

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
        // 0.7.1 (#7) — preventScroll stops focus() from yanking the viewport
        // to the focused element. The window-scroll restore below still
        // overrides any scroll that snuck in, but preventing the scroll in
        // the first place is the cleaner contract.
        el.focus({ preventScroll: true });
        if (selStart !== null && selEnd !== null) {
          try { el.setSelectionRange(selStart, selEnd); } catch {}
        }
      }
    }

    scrollMap.forEach(({ top, left }, id) => {
      const el = this.container.querySelector<HTMLElement>(`#${CSS.escape(id)}`);
      if (el) { el.scrollTop = top; el.scrollLeft = left; }
    });

    // 0.7.1 (#7) — restore the window scroll LAST so any defensive
    // browser behavior earlier in this method (e.g. a future element
    // bringing itself into view) gets overridden by the snapshot.
    window.scrollTo(winScrollX, winScrollY);
  }

  navigate(url: string): void {
    window.location.href = url;
  }

  storage(scope: "local" | "session", key: string, value: string): void {
    const store = scope === "session" ? sessionStorage : localStorage;
    store.setItem(key, value);
  }

  /** Save an authenticated-download blob via the browser's native Save-As.
   *  contentType is informational — the Blob's own .type takes precedence in
   *  browsers. We accept the arg for adapter symmetry (other adapters use it). */
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
      // Revoke async so the browser has time to start the download. The 0ms
      // setTimeout is the established pattern (Chromium/Firefox/Safari).
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }

  async transport(
    input: string,
    init: { method?: string; headers?: Record<string, string>; body?: FormData | string },
    hooks?: { onUploadProgress?: (sent: number, total: number) => void },
  ): Promise<Response> {
    const onUploadProgress = hooks?.onUploadProgress;
    if (!onUploadProgress) {
      // No progress requested → identical to the core fetch path (D-02 fallback parity).
      return fetch(input, init);
    }

    return new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      // IN-01: this seam only exists to carry a body+files action request, so
      // a method-less init is non-sensical. dispatch() (the sole caller) always
      // passes "POST"; default to "POST" (not "GET") so a future caller bug
      // never silently produces a body-bearing GET.
      xhr.open(init.method ?? "POST", input);
      // WR-02: every header dispatch() builds in `init.headers` (Accept +
      // getRequestHeaders()) is applied here, so the XHR path's request
      // headers are byte-identical to the fetch path's. Scope note: this
      // seam is same-origin only. The fetch fallback sends cookies on
      // same-origin requests via its default `credentials: "same-origin"`;
      // XHR sends same-origin cookies without `withCredentials`, so the
      // common (same-origin `actionEndpoint`) case matches fetch exactly.
      // Cross-origin action endpoints are out of scope for this transport.
      for (const [k, v] of Object.entries(init.headers ?? {})) {
        xhr.setRequestHeader(k, v);
      }

      let knownTotal = 0;          // last computable total (0 = never computable)
      let lastLoaded = 0;          // last reported bytes sent

      xhr.upload.onprogress = (e: ProgressEvent) => {
        lastLoaded = e.loaded;
        if (e.lengthComputable) {
          knownTotal = e.total;
          onUploadProgress(e.loaded, e.total);          // D-05 in-flight, computable
        } else {
          onUploadProgress(e.loaded, 0);                // D-05 indeterminate sentinel (0)
        }
      };

      xhr.onload = () => {
        // D-05 terminal emission: mirror whichever value was being reported.
        // Known total → (total, total); indeterminate → (finalLoaded, finalLoaded).
        // NEVER (0,0) once any progress event has fired; a body that produces
        // no progress event (e.g. a zero-byte upload, or a transport that
        // completes before the browser emits any upload progress) legitimately
        // terminates at (0,0), which the documented `total > 0` consumer guard
        // (MIGRATION.md 5b) handles.
        if (knownTotal > 0) onUploadProgress(knownTotal, knownTotal);
        else onUploadProgress(lastLoaded, lastLoaded);
        // D-08: status 0 means a network-level failure (CORS rejection / blocked
        // request) where onload fired but onerror did not. The Fetch Response
        // constructor throws RangeError for status 0, and that throw would land
        // OUTSIDE the Promise executor (never settling it → dispatch() hangs).
        // Reject instead so dispatch()'s try/catch routes it to onError —
        // byte-identical to fetch, which rejects on CORS/network failure.
        if (xhr.status === 0) {
          reject(new Error(`Transport request to ${input} failed (status 0)`));
          return;
        }
        // D-08: resolve a real Response so dispatch()'s res.ok / await res.json()
        // / processResponse() is byte-identical to the fetch path.
        resolve(
          new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
          }),
        );
      };

      // D-07: error / timeout / abort → reject so dispatch()'s existing
      // try/catch routes it to onError exactly like a failed fetch.
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
      // 0.7.0 (#13) — width override: "wide" or "full" opt-in via a closed
      // union. Omitted = no modifier class (existing 1080px cap holds).
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

  private form(n: FormNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const form = document.createElement("form");
    form.className = `vms-form${n.layout && n.layout !== "stack" ? ` vms-form--${n.layout}` : ""}`;
    form.noValidate = true;
    this.kids(n.children, form, on);

    // 0.10.0 (#15) — harvest this form's current field values, merge into the
    // given action's context, and dispatch. Factored out of the submit
    // handler so both the default submit AND each buttons[] entry can call it
    // with a DIFFERENT action carrying the SAME live field values.
    const harvest = (base: ActionEvent): void => {
      const ctx: Record<string, unknown> = { ...(base.context ?? {}) };
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

      const action: ActionEvent = { name: base.name, context: ctx };
      if (Object.keys(files).length > 0) action.files = files;
      on(action);
    };

    // Default submit button + Enter-to-submit, only when submitAction is set.
    // (0.10.0: submitAction is now optional — a buttons[]-only form renders
    // no default button, and Enter does not submit at the form level.)
    if (n.submitAction) {
      const submitAction = n.submitAction;
      const submit = document.createElement("button");
      submit.type = "submit";
      submit.className = "vms-button vms-button--primary";
      submit.textContent = n.submitLabel ?? "Submit";
      form.appendChild(submit);
      form.addEventListener("submit", (e) => {
        e.preventDefault();
        harvest(submitAction);
      });
    } else {
      // No default submit — still neutralize implicit Enter submission so a
      // single-field buttons[]-only form doesn't reload via native submit.
      form.addEventListener("submit", (e) => e.preventDefault());
    }

    // 0.10.0 (#15) — multi-action buttons. Each renders through the normal
    // button() path (so variant + pendingLabel work) but its onAction is
    // wrapped to harvest the form first. We render them in a footer row so
    // they group like the default submit.
    if (n.buttons && n.buttons.length > 0) {
      const row = document.createElement("div");
      row.className = "vms-form__buttons";
      const harvestOn = (action: ActionEvent): void => harvest(action);
      for (const btn of n.buttons) this.button(btn, row, harvestOn);
      form.appendChild(row);
    }

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
      if (n.value) ta.value = n.value;
      if (n.required) ta.required = true;
      ta.addEventListener("keydown", (e) => {
        if (e.key === "Tab") {
          e.preventDefault();
          const start = ta.selectionStart ?? 0;
          const end   = ta.selectionEnd   ?? 0;
          ta.value = ta.value.slice(0, start) + "\t" + ta.value.slice(end);
          ta.selectionStart = ta.selectionEnd = start + 1;
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
    btn.addEventListener("click", () => {
      // 0.8.0 (#11) — pendingLabel: instant client-side feedback. Swap text +
      // add .vms-button--pending BEFORE handing off to the dispatcher. On
      // success the next render replaces the button entirely. On dispatch
      // error, the shell's dispatch() catch re-renders this.currentVm so
      // the original label snaps back automatically — no per-button cleanup
      // wiring needed in the adapter. Pure-client ephemeral state; never
      // round-trips through the wire.
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

  private table(n: TableNode, parent: HTMLElement, on: (a: ActionEvent) => void): void {
    const wrapper = document.createElement("div");
    wrapper.className = "vms-table-wrapper";

    const table = document.createElement("table");
    table.className = "vms-table";

    const thead = document.createElement("thead");
    const headerRow = document.createElement("tr");

    // Selection: a leading checkbox column. The header box is a select-all over
    // the rows CURRENTLY rendered (the current page) — never unloaded rows.
    const sel = n.selection;
    const selectedSet = sel ? new Set(sel.selectedIds) : null;
    if (sel) {
      const th = document.createElement("th");
      th.className = "vms-table__th vms-table__th--select";
      const allOnPage = n.rows.length > 0 && n.rows.every(r => r.id != null && selectedSet!.has(r.id));
      const someOnPage = n.rows.some(r => r.id != null && selectedSet!.has(r.id));
      const box = document.createElement("input");
      box.type = "checkbox";
      box.className = "vms-table__select vms-table__select--all";
      box.checked = allOnPage;
      box.indeterminate = someOnPage && !allOnPage;
      const selAction = sel.action;
      box.addEventListener("change", () =>
        on({ name: selAction.name, context: { ...(selAction.context ?? {}), all: true, checked: box.checked } }));
      th.appendChild(box);
      headerRow.appendChild(th);
    }

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
      if (sel) filterRow.appendChild(document.createElement("th")); // align under the select column
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
      const isSelected = sel != null && row.id != null && selectedSet!.has(row.id);
      if (isSelected) rowClass += " vms-table__row--selected";
      tr.className = rowClass;
      if (row.id) tr.dataset.id = row.id;
      if (row.action) {
        const rowAction = row.action;
        tr.addEventListener("click", () => on(rowAction));
      }
      if (sel) {
        const td = document.createElement("td");
        td.className = "vms-table__td vms-table__td--select";
        // A click in the checkbox cell must not also fire the row's click action.
        td.addEventListener("click", (e) => e.stopPropagation());
        const box = document.createElement("input");
        box.type = "checkbox";
        box.className = "vms-table__select";
        box.checked = isSelected;
        if (row.id != null) {
          const rowId = row.id;
          const selAction = sel.action;
          box.addEventListener("change", () =>
            on({ name: selAction.name, context: { ...(selAction.context ?? {}), id: rowId, checked: box.checked } }));
        } else {
          box.disabled = true; // selection addresses rows by id; a row without one can't be selected
        }
        td.appendChild(box);
        tr.appendChild(td);
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

      const pgAction = pg.action;
      const mkBtn = (label: string, targetPage: number, disabled: boolean): HTMLButtonElement => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "vms-button vms-button--secondary vms-table__pagination-btn";
        b.textContent = label;
        b.disabled = disabled;
        if (!disabled)
          b.addEventListener("click", () =>
            on({ name: pgAction.name, context: { ...(pgAction.context ?? {}), page: targetPage } }));
        return b;
      };
      footer.appendChild(mkBtn("‹ Prev", pg.page - 1, pg.page <= 1));
      footer.appendChild(mkBtn("Next ›", pg.page + 1, pg.page >= totalPages));

      wrapper.appendChild(footer);
    }

    parent.appendChild(wrapper);
  }

  private copyButton(n: CopyButtonNode, parent: HTMLElement): void {
    const btn = document.createElement("button");
    btn.type = "button";
    // 0.9.0 (#14): variant modifier class, mirroring button() exactly. The
    // existing .vms-button--{primary,secondary,danger} CSS rules apply
    // automatically — no new style surface.
    btn.className = `vms-button${n.variant ? ` vms-button--${n.variant}` : ""}`;
    btn.textContent = n.label ?? "Copy";
    btn.addEventListener("click", () => {
      const write = navigator.clipboard?.writeText(n.text);
      if (write) {
        write.then(() => {
          btn.textContent = n.copiedLabel ?? "Copied!";
          setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
        }).catch(() => {
          // primary failed — try legacy execCommand fallback
          if (legacyCopy(n.text)) {
            btn.textContent = n.copiedLabel ?? "Copied!";
            setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
          }
          // both paths failed: silent, no confirmation
        });
      } else {
        // navigator.clipboard absent — try legacy
        if (legacyCopy(n.text)) {
          btn.textContent = n.copiedLabel ?? "Copied!";
          setTimeout(() => { btn.textContent = n.label ?? "Copy"; }, 1500);
        }
        // else: silent
      }
    });
    parent.appendChild(btn);
  }
}
