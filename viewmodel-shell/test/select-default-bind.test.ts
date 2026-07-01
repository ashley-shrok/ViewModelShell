// Regression — prod bug filed by Poppy (PBMInvoices, 2026-07-01): a select
// FieldNode whose bound path has NO value renders (HTML auto-selects + DISPLAYS
// the first option) but never wrote that displayed value into state, so on
// dispatch the key was ABSENT from the serialized _state and presence-checking
// server validators reported the field unset. Text/number/date fields aren't
// affected because an untouched text input legitimately has "".
//
// The fix seeds a select's effective displayed value into state at render time
// (browser.ts). These tests mirror the real form: addFormValues starts WITHOUT
// the select's key, and assert state ends up carrying the value the user SEES
// selected.

import { describe, it, expect, afterEach } from "vitest";
import type { StateAccess, ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function setup(initial: Record<string, unknown> = {}) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const adapter = new BrowserAdapter(container);
  const state = initial as Record<string, unknown>;
  const sa: StateAccess = {
    read(path: string): unknown {
      return path.split(".").reduce<unknown>(
        (o, k) => (o == null ? undefined : (o as Record<string, unknown>)[k]), state);
    },
    write(path: string, value: unknown): void {
      const keys = path.split(".");
      let o = state as Record<string, unknown>;
      for (let i = 0; i < keys.length - 1; i++) {
        if (o[keys[i]] == null || typeof o[keys[i]] !== "object") o[keys[i]] = {};
        o = o[keys[i]] as Record<string, unknown>;
      }
      o[keys[keys.length - 1]] = value;
    },
  };
  return { container, state, render: (vm: ViewNode) => adapter.render(vm, () => {}, sa) };
}

const pbmSelect: ViewNode = {
  type: "field",
  name: "pbm",
  inputType: "select",
  bind: "addFormValues.pbm",
  label: "PBM",
  required: true,
  options: [
    { value: "cerpassrx", label: "CerpassRx" },
    { value: "araya", label: "Araya" },
  ],
};

afterEach(() => { document.body.innerHTML = ""; });

describe("REPRO: select whose bound path is empty", () => {
  it("the displayed default is written into state on render", () => {
    // addFormValues exists with OTHER fields but no pbm — the real prod shape.
    const { container, state, render } = setup({ addFormValues: { block: "PRUST" } });
    render(pbmSelect);
    const sel = container.querySelector("select.vms-field__input") as HTMLSelectElement;
    // HTML auto-selects + displays the first option — the user SEES "CerpassRx".
    expect(sel.value).toBe("cerpassrx");
    // The wire must carry what's displayed. Before the fix, addFormValues.pbm is ABSENT.
    expect((state.addFormValues as Record<string, unknown>).pbm).toBe("cerpassrx");
  });

  it("an explicit change still writes (sanity — this path already worked)", () => {
    const { container, state, render } = setup({ addFormValues: { block: "PRUST" } });
    render(pbmSelect);
    const sel = container.querySelector("select.vms-field__input") as HTMLSelectElement;
    sel.value = "araya";
    sel.dispatchEvent(new Event("change"));
    expect((state.addFormValues as Record<string, unknown>).pbm).toBe("araya");
  });

  it("a placeholder-first select seeds the placeholder value (required-validation still fails correctly)", () => {
    const { container, state, render } = setup({ addFormValues: {} });
    render({
      ...pbmSelect,
      options: [
        { value: "", label: "Select a PBM…" },
        { value: "cerpassrx", label: "CerpassRx" },
        { value: "araya", label: "Araya" },
      ],
    } as ViewNode);
    const sel = container.querySelector("select.vms-field__input") as HTMLSelectElement;
    expect(sel.value).toBe("");
    // State faithfully carries "" — an empty required value the server rejects,
    // which is correct (the user hasn't chosen), NOT a silently-absent key.
    expect((state.addFormValues as Record<string, unknown>).pbm).toBe("");
  });
});
