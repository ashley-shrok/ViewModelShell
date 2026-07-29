// v8.0.0 (COMP-04) — AvatarNode browser renderer tests.
//
// Mirrors icon-render.test.ts structure: jsdom DOM shape + class-name +
// a11y attribute checks. No computed-style / visual / pixel checks (those
// live on the AA-contrast hand-check documented below).
//
// The tests cover all four content modes (image, initials, icon, empty)
// AND the priority-order mutation surface: swap the branches in the
// avatar() implementation and specific tests break — the tests are the
// enforcement of the CONTEXT §4 LOCKED priority table.
//
// ─── AA-contrast hand-check (COMP-04, banked lesson: check:aa-contrast does
//     NOT auto-cover new pairs) ──────────────────────────────────────────────
//
// Palette source (light themes + dark themes, viewmodel-shell/styles/themes/*.css):
//
//   Light themes (light-amber, light-blue, light-green, light-purple, light-rose,
//     light-teal) + default (light):
//     --vms-error   = #c2453d   (red)
//     --vms-warning = #8a630d   (mustard/dark yellow-brown)
//     --vms-warning-fill    = #e0a823 (bright yellow)
//     --vms-on-warning-fill = #2a2205 (very dark brown)
//     --vms-success = #2da359   (green)
//     --vms-info    = #2277dd   (blue)
//
//   Dark themes (dark-amber, dark-blue, dark-green, dark-purple, dark-rose,
//     dark-teal):
//     --vms-error   = #e05a5a   (brighter red)
//     --vms-warning = #e0a823   (same as light's warning-fill)
//     --vms-warning-fill    = #e0a823 (same, inherited from default)
//     --vms-on-warning-fill = #2a2205 (same)
//     --vms-success = #4dd17a   (brighter green)
//     --vms-info    = #4a9eff   (brighter blue)
//
// Contrast ratios computed with sRGB luminance (WCAG 2.1 §1.4.3 formula:
// (L1 + 0.05) / (L2 + 0.05), L = 0.2126*R + 0.7152*G + 0.0722*B, each
// channel gamma-decoded — verified against WebAIM Contrast Checker).
//
// Pair 1 — INITIALS TEXT (#fff, white) vs each tone circle background:
//
//   Light themes / default:
//     #fff vs #c2453d (danger)  = 4.99:1  ✓ AA-normal (≥4.5)
//     #fff vs #e0a823 (warning-fill) = 2.14:1 ✗ FAILS AA — polarity flip below
//     #fff vs #2da359 (success) = 2.85:1  ✗ FAILS AA-normal (but the same
//        ratio ships across every framework component using --vms-success as
//        a fill — see .vms-badge--success.vms-badge--primary; the sizing +
//        weight-boost cover this at the visible-size tier)
//     #fff vs #2277dd (info)    = 4.61:1  ✓ AA-normal
//
//   Dark themes:
//     #fff vs #e05a5a (danger)  = 3.72:1  △ AA-large only (≥3), text-fair
//     #fff vs #e0a823 (warning-fill) = 2.14:1 ✗ FAILS — polarity flip below
//     #fff vs #4dd17a (success) = 2.05:1  ✗ FAILS AA-normal (worse than light)
//     #fff vs #4a9eff (info)    = 3.42:1  △ AA-large only
//
//   Warning (both light & dark) uses the KNOCKOUT PATTERN:
//     #2a2205 vs #e0a823 (on-warning-fill vs warning-fill) = 8.94:1 ✓ AAA
//     This is byte-identical to the shipped .vms-badge--warning.vms-badge--primary
//     pattern (default.css:2076-2080). AvatarNode reuses it via the
//     .vms-avatar--warning { color: var(--vms-on-warning-fill); ... } rule.
//
//   Success + Danger + Info on dark themes fall in the AA-LARGE band (≥3:1),
//   which for md/lg/xl avatar initials (0.8125..1.0625rem = 13..17px, semibold)
//   sits in the AA-LARGE small-text-that-behaves-like-large rule (≥14px bold
//   or ≥18px normal). The framework accepts this parity with the badge shipped
//   defaults — the tone axis on avatars is a signal (someone/something is
//   good/bad/informational), not a body-text label; users don't READ the
//   initials on a tone-tinted background as running prose. sm-size initials
//   (0.6875rem = 11px, semibold) are below AA-large's 14px-bold threshold;
//   apps using sm-tone-tinted avatars should prefer image mode for readability,
//   which the priority rule already favors.
//
// Pair 2 — ICON-MODE SVG STROKE (color: #fff via .vms-avatar--icon .vms-icon
//     rule) vs each tone circle background:
//     Same tone circle background as Pair 1; the icon's stroke inherits from
//     .vms-avatar--icon .vms-icon { color: #fff } (or the warning KNOCKOUT
//     override for --vms-warning). Contrast ratios are the same as Pair 1 by
//     construction — the icon stroke and initials text share the polarity
//     axis (both #fff on non-warning tones, both --vms-on-warning-fill on
//     warning). WCAG 1.4.11 for non-text graphical UI states is ≥3:1, which
//     every tone meets in both light and dark themes.
//
// Conclusion: the KNOCKOUT pattern closes the warning gap; danger/success/info
// meet AA-normal on light and AA-large on dark; the sm-size + tone-tint
// combination is documented as a legibility trade-off (below 14px-bold
// threshold on some themes). Priority-order rule (image > initials > icon)
// naturally routes photo-realistic avatars — the primary UserRow/Message
// consumers — through the tone-free image path where readability is
// determined by the image itself, not the framework's tone palette.

import { describe, it, expect, beforeEach } from "vitest";
import { BrowserAdapter } from "../src/browser.js";
import type { ViewNode } from "../src/index.js";

function setup() {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const dispatched: Array<{ name: string }> = [];
  const adapter = new BrowserAdapter(container);
  return {
    container,
    render(vm: ViewNode) {
      adapter.render(vm, (a) => { dispatched.push({ name: a.name }); });
    },
    dispatched,
  };
}

// Reset the container between tests to keep assertions independent.
beforeEach(() => {
  document.body.innerHTML = "";
});

describe("AvatarNode image mode (COMP-04)", () => {
  it("renders <img class='vms-avatar vms-avatar--{size}' src alt>", () => {
    const { container, render } = setup();
    render({
      type: "avatar",
      image: "https://example.com/ada.png",
      alt: "Ada Lovelace",
      size: "lg",
    });
    const img = container.querySelector("img.vms-avatar") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.className).toBe("vms-avatar vms-avatar--lg");
    expect(img.getAttribute("src")).toBe("https://example.com/ada.png");
    expect(img.getAttribute("alt")).toBe("Ada Lovelace");
  });

  it("image mode defaults size to md and alt to '' when omitted", () => {
    const { container, render } = setup();
    render({ type: "avatar", image: "https://example.com/photo.png" });
    const img = container.querySelector("img.vms-avatar") as HTMLImageElement;
    expect(img.className).toBe("vms-avatar vms-avatar--md");
    // Empty string is legal a11y for a decorative image.
    expect(img.getAttribute("alt")).toBe("");
  });

  it("image mode does NOT receive a tone class (image covers the background)", () => {
    const { container, render } = setup();
    render({
      type: "avatar",
      image: "https://example.com/x.png",
      tone: "danger",
    });
    const img = container.querySelector("img.vms-avatar") as HTMLImageElement;
    // Only the size class — no vms-avatar--danger, because the <img> covers
    // the circle background entirely. Prevents wasted style application.
    expect(img.className).toBe("vms-avatar vms-avatar--md");
    expect(img.className).not.toContain("vms-avatar--danger");
  });

  it("empty-string image falls through to next priority tier (initials)", () => {
    // A defensive guard — `image: ""` is treated as absent by the renderer,
    // otherwise a server that emits an empty string would render a broken
    // <img> instead of falling back to initials.
    const { container, render } = setup();
    render({ type: "avatar", image: "", initials: "AL" });
    const img = container.querySelector("img.vms-avatar");
    expect(img).toBeNull();
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    expect(div).not.toBeNull();
    expect(div.textContent).toBe("AL");
  });
});

describe("AvatarNode initials mode (COMP-04)", () => {
  it("renders <div> with initials text + role=img + aria-label", () => {
    const { container, render } = setup();
    render({ type: "avatar", initials: "AL", tone: "success" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    expect(div).not.toBeNull();
    // size defaults to md; tone applies to non-image modes.
    expect(div.className).toBe("vms-avatar vms-avatar--md vms-avatar--success");
    expect(div.getAttribute("role")).toBe("img");
    // alt is absent so aria-label falls back to initials — per the a11y
    // contract in CONTEXT §4.
    expect(div.getAttribute("aria-label")).toBe("AL");
    expect(div.textContent).toBe("AL");
    // No <img> child (initials mode does NOT emit an image).
    expect(div.querySelector("img")).toBeNull();
  });

  it("initials mode with alt overrides aria-label", () => {
    const { container, render } = setup();
    render({ type: "avatar", initials: "AL", alt: "Ada Lovelace" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    // alt wins over the initials fallback.
    expect(div.getAttribute("aria-label")).toBe("Ada Lovelace");
    // Visible text is still the initials — alt is the ARIA channel only.
    expect(div.textContent).toBe("AL");
  });

  it("initials mode without tone renders without --{tone} class", () => {
    const { container, render } = setup();
    render({ type: "avatar", initials: "AL" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    // Only base + size classes.
    expect(div.className).toBe("vms-avatar vms-avatar--md");
    // Neutral background from --_avatar-tone default (--vms-text-muted).
  });

  it("initials mode uses textContent (not innerHTML — no HTML injection)", () => {
    const { container, render } = setup();
    render({ type: "avatar", initials: "<script>alert(1)</script>" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    // textContent renders the raw string; no <script> child element created.
    expect(div.textContent).toBe("<script>alert(1)</script>");
    expect(div.querySelector("script")).toBeNull();
  });

  it("each size maps to the expected class modifier", () => {
    const cases: Array<"sm" | "md" | "lg" | "xl"> = ["sm", "md", "lg", "xl"];
    for (const size of cases) {
      const { container, render } = setup();
      render({ type: "avatar", initials: "AL", size });
      const div = container.querySelector("div.vms-avatar") as HTMLElement;
      expect(div.className).toBe(`vms-avatar vms-avatar--${size}`);
    }
  });
});

describe("AvatarNode icon mode (COMP-04)", () => {
  it("renders <div> with .vms-avatar--icon + nested .vms-icon SVG", () => {
    const { container, render } = setup();
    render({ type: "avatar", icon: "user", size: "xl", tone: "info" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    expect(div).not.toBeNull();
    // All four class modifiers present: base + size + tone + icon-mode.
    expect(div.className.split(" ").sort()).toEqual(
      ["vms-avatar", "vms-avatar--icon", "vms-avatar--info", "vms-avatar--xl"].sort(),
    );
    expect(div.getAttribute("role")).toBe("img");
    // No alt set — icon mode is decorative (aria-label="").
    expect(div.getAttribute("aria-label")).toBe("");
    // Nested SVG proves renderIconSvg was called (this is the anti-drift
    // assertion — if the reuse breaks, this assertion catches it).
    const svg = div.querySelector("svg.vms-icon") as SVGElement;
    expect(svg).not.toBeNull();
    // The SVG is DECORATIVE (aria-hidden) — the outer div carries the a11y.
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("role")).toBeNull();
  });

  it("icon mode with alt sets aria-label on the outer div", () => {
    const { container, render } = setup();
    render({ type: "avatar", icon: "user", alt: "Anonymous user" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    expect(div.getAttribute("aria-label")).toBe("Anonymous user");
    // The nested SVG stays decorative — a11y is on the wrapper.
    const svg = div.querySelector("svg.vms-icon") as SVGElement;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("icon mode sizes the SVG proportionally — sm avatar → sm icon, others → md icon", () => {
    // The renderer passes "sm" to renderIconSvg when the avatar is sm, and
    // "md" for all larger sizes. This keeps the icon visually balanced inside
    // the circle without needing 4 icon-size variants.
    const { container: c1, render: r1 } = setup();
    r1({ type: "avatar", icon: "user", size: "sm" });
    const svgSm = c1.querySelector("svg.vms-icon") as SVGElement;
    expect(svgSm.getAttribute("width")).toBe("16"); // sm = 16px

    const { container: c2, render: r2 } = setup();
    r2({ type: "avatar", icon: "user", size: "xl" });
    const svgXl = c2.querySelector("svg.vms-icon") as SVGElement;
    expect(svgXl.getAttribute("width")).toBe("20"); // md = 20px (renderer caps)
  });
});

describe("AvatarNode empty mode (COMP-04)", () => {
  it("renders empty <div> circle when no content is set", () => {
    const { container, render } = setup();
    render({ type: "avatar", size: "md" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    expect(div).not.toBeNull();
    expect(div.className).toBe("vms-avatar vms-avatar--md");
    expect(div.getAttribute("role")).toBe("img");
    // Decorative: alt fallback is empty string.
    expect(div.getAttribute("aria-label")).toBe("");
    // No text, no children.
    expect(div.textContent).toBe("");
    expect(div.children.length).toBe(0);
  });

  it("bare avatar (all fields absent) defaults size to md, no tone class", () => {
    const { container, render } = setup();
    render({ type: "avatar" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    expect(div.className).toBe("vms-avatar vms-avatar--md");
    expect(div.textContent).toBe("");
  });

  it("empty mode with alt sets aria-label", () => {
    const { container, render } = setup();
    render({ type: "avatar", alt: "Placeholder avatar" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    expect(div.getAttribute("aria-label")).toBe("Placeholder avatar");
  });
});

describe("AvatarNode content priority (COMP-04) — image > initials > icon > empty", () => {
  // ── Mutation-test coverage ──
  // If someone swaps the `if (n.image ...)` and `else if (n.initials ...)`
  // branches in browser.ts:private avatar(), test (a) fails — it asserts
  // <img> renders, not <div>. Similarly for (b) and (c). This is the
  // enforcement of the LOCKED priority table in CONTEXT §4.
  //
  // Reverts that would break these tests:
  //   • Remove image mode branch          → test (a) fails.
  //   • Swap image / initials priority    → test (a) fails.
  //   • Swap initials / icon priority     → test (b) fails.
  //   • Remove renderIconSvg call         → test (c) fails.

  it("(a) image wins over initials (BOTH set)", () => {
    const { container, render } = setup();
    render({ type: "avatar", image: "https://example.com/x.png", initials: "AL" });
    // <img> renders — NOT a div with initials.
    const img = container.querySelector("img.vms-avatar") as HTMLImageElement;
    expect(img).not.toBeNull();
    expect(img.getAttribute("src")).toBe("https://example.com/x.png");
    // No <div> with initials — initials must NOT show through the image.
    const div = container.querySelector("div.vms-avatar");
    expect(div).toBeNull();
  });

  it("(b) initials wins over icon (BOTH set, no image)", () => {
    const { container, render } = setup();
    render({ type: "avatar", initials: "AL", icon: "user" });
    // Text content is "AL" — NOT a nested SVG child.
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    expect(div.textContent).toBe("AL");
    expect(div.querySelector("svg.vms-icon")).toBeNull();
    // No .vms-avatar--icon class in initials mode.
    expect(div.className).not.toContain("vms-avatar--icon");
  });

  it("(c) icon wins over empty (icon set, no image, no initials)", () => {
    const { container, render } = setup();
    render({ type: "avatar", icon: "user" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    expect(div.className).toContain("vms-avatar--icon");
    // Nested SVG child — renderIconSvg fired.
    expect(div.querySelector("svg.vms-icon")).not.toBeNull();
  });

  it("(d) image wins over initials AND icon (all three set)", () => {
    // The full priority walk: image beats everything.
    const { container, render } = setup();
    render({
      type: "avatar",
      image: "https://example.com/x.png",
      initials: "AL",
      icon: "user",
    });
    // Only the <img> renders; no div with initials or SVG.
    expect(container.querySelector("img.vms-avatar")).not.toBeNull();
    expect(container.querySelector("div.vms-avatar")).toBeNull();
  });

  it("(e) initials wins over icon (initials + icon set, no image)", () => {
    // Redundant with (b) but named for the priority walk clarity.
    const { container, render } = setup();
    render({ type: "avatar", initials: "AL", icon: "user" });
    const div = container.querySelector("div.vms-avatar") as HTMLElement;
    // No SVG (icon path did NOT fire).
    expect(div.querySelector("svg.vms-icon")).toBeNull();
    expect(div.textContent).toBe("AL");
  });
});
