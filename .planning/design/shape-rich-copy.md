# Shape: Rich copy — a copy button whose paste keeps its formatting

**Opened:** 2026-07-17
**Vehicle:** gsd phase

## What this is

Today the framework has a copy affordance — a button that, when pressed, puts a piece of text on
the clipboard as plain text. Paste it into somewhere that understands formatting (an email, a
document) and you get raw characters: no headings, no bold, no table structure. This feature makes
the paste keep its formatting where the destination can use it, while still degrading to clean
plain text where it can't. It does this by letting the copy carry two representations of the same
content at once — a formatted one and a plain one — and letting the destination pick whichever it
understands. The whole thing is a browser-side convenience; the part of the framework that knows
nothing about screens stays untouched.

## Shape

There are **two ways** to source a rich copy, and both put **both representations** (formatted +
plain) on the clipboard:

- **The harvest way (the cheap default).** The copy button points at a region of the interface
  the server already described — by that region's identifier. When pressed, the browser layer lifts
  both the formatted version and the plain version straight off what it already drew on screen. The
  server authors nothing new; the content already exists as the thing the user is looking at.

- **The server-provided way (opt-in).** The existing copy button that carries its own payload can
  *also* carry a formatted version alongside its plain text. When it does, the copy writes both.
  Here the server does produce the formatted content — which is fine, because it is entirely
  optional and only reached for when the content to copy is *not* already sitting rendered on the
  page (for instance, a cleaner or richer export than what's shown).

Rich copy is therefore a **general enrichment of copy**, not a bolt-on for one situation — the same
capability, reached two ways.

The harvest semantics are the ordinary, conventional clipboard behavior every browser already does
on a normal copy: put the region's markup on the clipboard as the formatted representation and its
plain text as the fallback, and let the *destination* sanitize. No clever cleaning pass invented
here — the standard behavior is the correct behavior. Because the framework keeps its look in shared
styling keyed by class rather than baked into each element, what survives a paste into a foreign
destination is the **semantic structure** — a heading stays a heading, a table stays a table, bold
stays bold — while the framework's own theme naturally falls away. That is exactly the desired
outcome (nobody wants the app's theme in their email), and it comes for free from doing the
conventional thing.

The copy *target* is reachable only by pointing at a described region's identifier. Because those
identifiers only live on pieces of the described interface, the button structurally cannot point at
loose on-screen furniture the server never described — the intent is always visible to someone
reading the wire, for free.

## Philosophy

- **A clipboard export is not decoration.** The rule that apps describe and never decorate is about
  an app not controlling *its own on-screen presentation*. The formatted content here is
  **write-only, bound for a foreign destination** (an email, a document); it never re-enters the
  interface and never styles the app's own screen. That makes it an *export format*, the same family
  as a download — which a server is allowed to produce. A server producing markup to style its own
  UI would violate the spirit; a server producing an export representation does not. This is the line
  that keeps the opt-in server-provided path legitimate.

- **The rich artifact is a render-tier convenience, and that's fine.** Someone driving the framework
  over the wire with no browser will not receive a formatted clipboard blob — but nothing is actually
  lost to them, because the content the button would copy is sitting right there in the described tree
  as ordinary nodes. They read the source instead of a clipboard artifact. This is the exact same
  category as the fact that a browserless agent doesn't "receive" a rendered dropdown either. So this
  does not dent the sufficiency of the wire at all — it's a convenience layered on top of a wire that
  is already sufficient. Intent is wire-visible (the button names the region it copies); content is
  wire-present (the region is a described node).

- **The platform side-effect stays at the platform seam.** Writing two representations to the
  clipboard is a browser-layer capability. The part of the framework that must never know about
  screens does not learn about clipboards; the clipboard write lives where every other
  screen-touching side-effect already lives.

- **Do the conventional thing.** How a rendered region becomes clipboard content is a solved,
  standard mechanism, not a place to invent framework-specific behavior.

## Prior context

- The framework already has a plain-text copy button; copying is already a browser-only behavior
  with no round-trip to the server. This feature extends that, it does not introduce a new *kind* of
  interaction.
- The framework already stamps optional identifiers onto at least some described regions (the
  collapsible panels rely on one to keep their own open/closed state straight), so there is precedent
  for the server giving a region an identity — but it is **not** universal across every kind of node
  today. Making arbitrary content addressable-for-copy is the part that may need adding (see Scope
  edges).
- The framework already reads truth back off its own rendered surface — where the cursor sits, how
  far a container is scrolled, which panels are left open — none of which round-trips to the server.
  So "the browser layer harvests from its own rendering" is an established move. What is genuinely new
  is harvesting rendered output to produce *copied content* rather than to restore interaction state.
- This began as a request from the requester who maintains the downstream chat app, relayed as a
  CEO-level "paste out of the app keeps its formatting" need. During shaping it became clear the
  capability stands on its own for anyone wanting formatted content to paste cleanly out of any app —
  it is not shaped to that one situation.
- **The CEO's *manual* select-then-copy pain is a separate thread, deliberately out of scope here.**
  That is a different mechanism (likely a conversation about how the markup for a free-selection region
  is built) and will be its own later discussion. This feature is the *button-driven* rich copy only.

## What would make it wrong

- **If it only ever wrote the formatted version.** The point is that a paste into a *plain*
  destination still lands clean text. Writing formatted-only — so a plain destination receives a mess
  of markup — misses the point entirely. Both representations, always.
- **If the framework's own theme leaked into the paste.** Pasting into an email should yield the
  destination's formatting of a heading/table/bold, not the app's colors and spacing. Structure
  should survive; theme should not.
- **If the button could point at something the wire never described.** That would make a copy whose
  content couldn't be explained from the wire alone — breaking the promise that the description is
  enough to understand what every part does. The target must always be a described region.
- **If it quietly grew into a way for apps to style their own interface.** The moment a "formatted"
  payload is used for anything other than a write-only export — if it ever re-enters the rendered
  view — the decoration line has been crossed and the feature has become the thing the framework
  forbids.
- **If a broken reference failed silently.** A copy button pointing at a region that isn't there
  should not silently put nothing on the clipboard as though it worked. (Exact behavior is a build
  detail below, but silence on a broken copy is the wrong instinct given the framework's "nothing
  important fails quietly" stance.)

## Scope edges

- **In:** a copy button that harvests both representations off a described region named by its
  identifier; an optional server-provided formatted representation on the existing payload-carrying
  copy button; the browser-layer capability to write two representations to the clipboard at once;
  whatever addressability the copy *target* needs.
- **Out / deferred:** the CEO's manual free-selection copy — a separate mechanism, its own later
  conversation.
- **Tempting but no:** a framework-invented "cleaning" pass over harvested markup — the conventional
  destination-sanitizes behavior is correct and enough. Any use of the formatted payload that puts it
  back into the rendered interface — that is decoration and is forbidden.
- **Build-shape details to resolve during planning (none needing the operator):**
  - How widely identifiers exist on described regions today, and therefore whether the copy *target*
    needs an optional identifier added to more kinds of region, or a thin "this region is copyable,
    here's its handle" wrapper. (Confirm against the real source; the collapsible-panel identifier is
    the known precedent, not proof it's universal.)
  - Whether this is **one** enriched copy affordance with flexible sourcing (its own payload, or a
    pointer to a region) or **two** distinct affordances. Leaning toward one enriched affordance;
    settle in the plan.
  - What a copy button does when its referenced region is absent (fail-loud vs. no-op) — resolve
    consistent with the framework's "nothing important fails quietly" stance.
  - Confirm the framework really keeps its styling in shared class-keyed rules rather than sprinkling
    it inline (the assumption the "theme falls away, structure survives" behavior rests on).

## Vehicle notes

Chosen vehicle: **GSD phase** (plan → execute → verify). This is a genuine framework feature, not a
quick change: it touches both backends' node-type definitions, adds a clipboard-write capability at
the browser-layer seam (leaving the screen-agnostic core untouched), needs the copy target made
addressable, and then rides the full release ritual — cross-backend parity coverage, a
human-runnable verification page that actually exercises the copy in a real browser, a version bump,
publish on both registries, changelog, and a changelog-room announcement. That spread across types +
adapter + tests + release is what the phase pipeline is for. The lighter vehicles were set aside
deliberately: too broad for an inline or single quick task, and it ends in a publish, so it wants the
phase discipline.

Handoff notes for the implementing agent:
- The screen-agnostic core must stay free of any clipboard/platform reference; the two-representation
  write belongs at the same seam as the other screen-touching side-effects, and its absence on a
  target that can't honor it should follow the same fail-loud posture as the other capability verbs.
- Keep both backend type sources aligned — a new optional field exists on both or the build fails at
  the parity gate.
- The verification page is a standing requirement for this maintainer: serve the real shipped bundle
  + real styling over the tailnet so the operator can actually copy and paste into a real email/doc
  and feel it, not just read a diff.
- Identity doing the work: **vicky** (VMS steward). Refined-shape record and the requester-coordination
  history live in the bounty `copybutton-rich-copy` under this identity.
- Related design docs live alongside this file under `.planning/design/`.
