// 1.2.0 — SectionNode.collapsible jsdom regression coverage.
//
// Asserts:
//   - render shape: collapsible:true ⇒ <details>/<summary>; omitted/false ⇒ <section>/<h2> byte-identical
//   - default-closed: initial <details> has no `open` attr
//   - summary IS heading: no double-rendered <h2 class="vms-section__heading">
//   - headingless fallback: summary text = "Show details"
//   - preservation across re-renders (same BrowserAdapter instance):
//       * open state survives same-key re-render
//       * identity change (heading change) drops preserved state
//       * removal + re-add drops preserved state (intermediate render clears snapshot for that key)
//       * id-based keying disambiguates duplicate headings
//       * ordinal-based keying disambiguates anonymous collapsibles
//   - keyboard: clicking the summary toggles details.open (skipped if jsdom doesn't implement it natively)
//
// Same harness shape as theme-modifiers.test.ts.
import { describe, it, expect } from "vitest";
import type { ViewNode } from "../src/index.js";
import { BrowserAdapter } from "../src/browser.js";

function freshContainer(): HTMLElement {
  const el = document.createElement("div");
  document.body.appendChild(el);
  return el;
}

function renderInto(adapter: BrowserAdapter, vm: ViewNode): void {
  adapter.render(vm, () => {});
}

describe("SectionNode.collapsible — render shape", () => {
  it("collapsible:true ⇒ rendered element is <details> with vms-section + vms-section--collapsible classes", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Notes",
      collapsible: true,
      children: [],
    });
    const el = container.querySelector(".vms-section") as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.tagName).toBe("DETAILS");
    expect(el.classList.contains("vms-section")).toBe(true);
    expect(el.classList.contains("vms-section--collapsible")).toBe(true);
  });

  it("collapsible:true ⇒ first child is <summary class=\"vms-section__summary\"> with textContent === heading", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Notes",
      collapsible: true,
      children: [],
    });
    const details = container.querySelector("details") as HTMLDetailsElement;
    const summary = details.firstElementChild as HTMLElement;
    expect(summary.tagName).toBe("SUMMARY");
    expect(summary.className).toBe("vms-section__summary");
    expect(summary.textContent).toBe("Notes");
  });

  it("collapsible:true with no heading ⇒ summary textContent === 'Show details' (documented fallback)", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      collapsible: true,
      children: [],
    });
    const summary = container.querySelector("summary") as HTMLElement;
    expect(summary.textContent).toBe("Show details");
  });

  it("collapsible:true ⇒ initial <details> does NOT have the open attribute (defaults closed)", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Notes",
      collapsible: true,
      children: [],
    });
    const details = container.querySelector("details") as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.hasAttribute("open")).toBe(false);
  });

  it("collapsible:true ⇒ NO <h2 class=\"vms-section__heading\"> rendered (no double-heading)", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Notes",
      collapsible: true,
      children: [],
    });
    expect(container.querySelector("h2.vms-section__heading")).toBeNull();
  });

  it("collapsible omitted ⇒ rendered element is <section> byte-identical (no vms-section--collapsible, no data-section-key, h2 still present)", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Notes",
      children: [],
    });
    const el = container.querySelector(".vms-section") as HTMLElement;
    expect(el.tagName).toBe("SECTION");
    expect(el.className).toBe("vms-section");
    expect(el.hasAttribute("data-section-key")).toBe(false);
    expect(container.querySelector("h2.vms-section__heading")?.textContent).toBe("Notes");
  });

  it("collapsible:false ⇒ same as omitted (byte-identical fallthrough)", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Notes",
      collapsible: false,
      children: [],
    });
    const el = container.querySelector(".vms-section") as HTMLElement;
    expect(el.tagName).toBe("SECTION");
    expect(el.className).toBe("vms-section");
    expect(el.hasAttribute("data-section-key")).toBe(false);
  });
});

describe("SectionNode.collapsible — open-state preservation across re-renders", () => {
  it("user-opened state survives a re-render with the same VM (same adapter instance)", () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const vm: ViewNode = {
      type: "section", heading: "Notes", collapsible: true, children: [],
    };
    renderInto(adapter, vm);
    const first = container.querySelector("details") as HTMLDetailsElement;
    first.open = true;
    expect(first.open).toBe(true);

    renderInto(adapter, vm);
    const second = container.querySelector("details") as HTMLDetailsElement;
    expect(second.open).toBe(true);
  });

  it("section identity change (heading change) drops preserved state — fresh closed", () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    renderInto(adapter, {
      type: "section", heading: "Notes", collapsible: true, children: [],
    });
    const first = container.querySelector("details") as HTMLDetailsElement;
    first.open = true;

    renderInto(adapter, {
      type: "section", heading: "Comments", collapsible: true, children: [],
    });
    const second = container.querySelector("details") as HTMLDetailsElement;
    expect(second.open).toBe(false);
  });

  it("section removed from tree, then re-added — final state is CLOSED (intermediate render drops the snapshot)", () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const sectionVm: ViewNode = {
      type: "section", heading: "Notes", collapsible: true, children: [],
    };

    renderInto(adapter, sectionVm);
    const first = container.querySelector("details") as HTMLDetailsElement;
    first.open = true;

    // Intermediate render — no section.
    renderInto(adapter, { type: "page", children: [] });
    expect(container.querySelector("details")).toBeNull();

    // Re-add — should be CLOSED.
    renderInto(adapter, sectionVm);
    const re = container.querySelector("details") as HTMLDetailsElement;
    expect(re.open).toBe(false);
  });

  it("id-based keying disambiguates two sections with the same heading", () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const buildVm = (): ViewNode => ({
      type: "page",
      children: [
        { type: "section", heading: "Item", id: "alpha", collapsible: true, children: [] },
        { type: "section", heading: "Item", id: "beta",  collapsible: true, children: [] },
      ],
    });
    renderInto(adapter, buildVm());

    const alpha1 = container.querySelector("[data-section-key=\"alpha:0\"]") as HTMLDetailsElement;
    const beta1  = container.querySelector("[data-section-key=\"beta:0\"]")  as HTMLDetailsElement;
    expect(alpha1).not.toBeNull();
    expect(beta1).not.toBeNull();
    alpha1.open = true;

    renderInto(adapter, buildVm());
    const alpha2 = container.querySelector("[data-section-key=\"alpha:0\"]") as HTMLDetailsElement;
    const beta2  = container.querySelector("[data-section-key=\"beta:0\"]")  as HTMLDetailsElement;
    expect(alpha2.open).toBe(true);
    expect(beta2.open).toBe(false);
  });

  it("anonymous (no id, no heading) collapsibles get disambiguated by ordinal — second opens, first stays closed", () => {
    const container = freshContainer();
    const adapter = new BrowserAdapter(container);
    const buildVm = (): ViewNode => ({
      type: "page",
      children: [
        { type: "section", collapsible: true, children: [] },
        { type: "section", collapsible: true, children: [] },
      ],
    });
    renderInto(adapter, buildVm());
    const all1 = container.querySelectorAll<HTMLDetailsElement>("[data-section-key]");
    expect(all1.length).toBe(2);
    expect(all1[0].dataset.sectionKey).toBe("vms-section-anon:0");
    expect(all1[1].dataset.sectionKey).toBe("vms-section-anon:1");
    all1[1].open = true;

    renderInto(adapter, buildVm());
    const all2 = container.querySelectorAll<HTMLDetailsElement>("[data-section-key]");
    expect(all2[0].open).toBe(false);
    expect(all2[1].open).toBe(true);
  });
});

describe("SectionNode.collapsible — native <details> keyboard/click behavior", () => {
  // jsdom 22.x DOES implement <details> toggle-on-summary-click; if the
  // running jsdom version doesn't, switch to it.skip with a comment naming
  // the version. The point of this case is to verify NATIVE behavior, NOT
  // to fake the toggle in the test.
  it("clicking the summary toggles details.open from false to true", () => {
    const container = freshContainer();
    renderInto(new BrowserAdapter(container), {
      type: "section",
      heading: "Notes",
      collapsible: true,
      children: [],
    });
    const details = container.querySelector("details") as HTMLDetailsElement;
    const summary = details.querySelector("summary") as HTMLElement;
    expect(details.open).toBe(false);
    summary.click();
    expect(details.open).toBe(true);
  });
});
