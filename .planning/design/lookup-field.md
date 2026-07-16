# Design of record — Lookup / remote-search reference field

Status: **signed off** (Ashley, 2026-07-16). Consumed by Phase 21.

This is the rationale of record, in the same role as `layout-system-research.md` is for layout:
**read it before proposing any change to the lookup, and before re-litigating any decision below.**
Every decision here is backed by a three-part survey (mature component libraries; enterprise
reference fields; the combobox accessibility contract). Where this doc asserts a fact about another
system, it was verified against that system's primary documentation.

---

## 1. The gap

`select` and `select-multiple` both assume the option set can be **enumerated into the tree**. The
moment the set is a 5,000-person directory or an 80,000-row customer table, VMS has no answer and the
app is forced into a workaround — which by our own rule is the signal that a primitive is missing.

The industry name is a **lookup / reference / relation** field (Salesforce Lookup, Dynamics lookup +
Dataverse `EntityReference`, ServiceNow reference, Airtable link-to-record, Strapi/Contentful
relation; "async select" in React-land). Conceptually it is **not a big select**:

> A `select` says *"here are all the values, pick one."*
> A **lookup** says *"the values are a database table — describe which row you mean."*

This is bread-and-butter for the workflow/queue/admin tools VMS explicitly targets: assign a ticket
to one of 5,000 agents; attach an invoice to one of 80,000 customers; set a parent record. **The gap
predates the request that surfaced it** (a Metis @mention brief) and is not shaped by it.

## 2. Scope — what this is NOT

- ❌ **Not a replacement for `select` / `select-multiple`.** Those stay the control for enumerable
  sets, and that split is **an accessibility requirement, not just taste** — see §7. SAP formalizes
  the same line in metadata (`Common.ValueListWithFixedValues` = *"this list is small enough to be a
  dropdown; don't build a search"*), and it is the only surveyed platform that makes the distinction
  explicit. We get it for free by having two controls.
- ❌ **Not inline `@mention` in prose.** Splicing a token at the caret is a rich-text-editor feature:
  it is not agent-drivable (an agent writing a note just writes the token and never touches the
  picker), it requires caret-offset semantics that either leak onto the wire or push app-shaped
  splice logic into the client, and it would be the first inline content VMS ever put *inside* text
  (`TextNode` is a plain string). Ruled **not now, door open** (Ashley, 2026-07-16: *"maybe we do text
  editing but certainly not right now"*). If ever revisited, the answer is **structured segments** on
  the wire (text, mention, text), never a blob plus a regex the app and framework secretly agree on —
  a hidden shared-regex contract breaks the principle that the structured description is sufficient
  on its own.
- ❌ **Create-new-inline is deferred.** The least essential feature in the survey; the newest mature
  design (Salesforce's `lightning-record-picker`) deliberately omits it, and the others bolted it
  onto the list/popup behind a separate config surface. Purely additive later.

## 3. Decisions

### D1 — The label is **view**, not **state**. `bind` holds the id; the node carries the label. ⭐

**This is the load-bearing decision. Everything else follows from it.**

- **`value` round-trips. The label is server→client ONLY** — recomputed every response, **never
  authoritative, never trusted coming back from the client.** *Direction is the entire safety
  argument.*
- **Rationale from our own principles:** the view is a pure function of state. The id **is** state (it
  persists; it round-trips; it is what's authoritative). The label is derived, recomputed every
  render, server-owned ⇒ it is **view**. Putting the label in the bind is putting **view into state**.
- **Evidence:** all seven surveyed enterprise platforms **store the id alone**. Staleness warnings
  appear in **zero** of their docs — not because they solved it, but because *there is no copy to
  drift*. Rename a user in ServiceNow and every label on every referencing table changes with **zero
  writes**. A stored label also physically cannot be locale-correct (ServiceNow and Salesforce both
  localize theirs per user).
- **The decisive artifact:** Salesforce needed a non-blocking error code — `ERR_RP004`, *"The default
  selected record can't be retrieved"* — purely because their picker is handed a bare id and must make
  a **second round trip** to resolve it. That error is *a symptom of not sending both halves*. **A
  server that ships the label in the first render cannot produce it.** Salesforce has client-side
  record caching and a GraphQL layer and still needs that trip.

**❌ Rejected — the label in the bind (`{value,label}` as the bound value).** This is the
component-library consensus (6–7 of 8: MUI, react-select, Headless UI, Downshift, PrimeReact,
Atlassian) and it is **an artifact of being client-only** — they hold the whole option object
*because they have no server to ask*. The object **is** their state. That reasoning does not transfer
to a server-driven framework, and adopting it would manufacture the exact cache-invalidation problem
all seven enterprise platforms designed away.

> ⚠️ **Generalizable lesson, worth keeping:** when a survey shows near-unanimity, ask **what
> constraint produced it** before adopting it. Unanimity among peers who share a limitation we don't
> have is not evidence for us.

**❌ Rejected — resolving the label out of the candidate list.** This is **the trap**, and it is why
this doc exists. Zag's maintainer, on why no automatic fix is possible:

> *"We can't trigger syncSelectedItems since it affects the filtering logic. When you start
> filtering, and the value isn't part of the filtered options, the selected item isn't up to date."*

⇒ **With an id-valued field, "filter the candidate list" and "forget what's selected" are the same
operation.** No cache separates them, because the cache cannot be seeded for a value the client has
never seen (cold start). Ant Design ships the failure silently — `label: ... ?? item.value` **renders
the raw database id** on a cache miss. Zag chased this across four changelog entries and two years.
SAP names it as its own degenerate case: the moment a SAP field falls back to a fixed options array,
its good mechanism switches off.

### D2 — `lookup` and `lookup-multiple` are **separate nodes**

Designed together; **single ships first, multi immediately behind.**

Three independent surveys converge, **contradicting** the component libraries' 7-of-8 "multiple is an
orthogonal flag" consensus (wrong here for the same reason they're wrong about labels — client-only):

- **Accessibility:** the chips layer has **no APG pattern at all**, and GOV.UK's public attempt at
  this exact control was **retired as inaccessible** (§7).
- **Component libraries:** Downshift charges a **separate hook** for multi — *"a second widget grafted
  onto the first… Everyone else hides the cost."* Multi adds a **second focusable dimension**: the
  selected set itself becomes navigable.
- **Enterprise:** Salesforce SLDS renders single-select **inside** the input (no pill element exists
  at all) and multi as a **separate pill listbox outside** the combobox with its own roving-tabindex
  focus model — two components in all but name. Airtable made cardinality a soft hint
  (`prefersSingleRecordLink`, read-only) and it is *"routinely violated by copy-paste and
  automations"* — the cautionary tale.

**VMS already has this shape:** `select` / `select-multiple` are already separate input types. This is
our existing pattern, not a new one.

> The value model scales trivially (`T` → `T[]`). **The interaction does not.** Design both up front
> to protect the shape; ship single first, because multi is where the second-widget cost and
> essentially all of the accessibility risk live.

### D3 — Custom entries are an **explicit, declared axis**

*Ashley's framing is the rationale: "choosing somebody to mention is very different from inventing a
new tag."* Different **acts** sharing a widget ⇒ the control must **declare** which it is doing, never
leave it to be inferred from behavior.

- One control, one **declared** `allowCustom` axis. **Not** a mode enum; **not** two fused things.
- An invented value stays a **homogeneous object**, never a bare string. This is why we can unify at
  all: MUI's `multiple + freeSolo` yields `Array<Value | string>` — a heterogeneous array that forces
  every consumer to branch on `typeof`, and whose own docs warn *"it may cause type mismatch."* Their
  tags demo dodges it only by degrading options to bare strings. **We never admit a bare string, so
  that union never arises.** A free-form tag is simply a value whose label equals itself.
- **This supersedes the separately-designed `inputType: "tags"` proposal**, which is absorbed as
  `allowCustom: true` with no candidate source. Its research (commit keys, dedupe/trim, removal
  paths) still applies.
- Precedent: react-select is the one library that models this correctly — invented values carry a
  structural marker and a **distinct action** (`create-option` vs `select-option`), never a `typeof`
  sniff.

### D4 — The framework **learns to search** (the live-query lane)

Today VMS only asks when told: **every** text field dispatches on Enter (`browser.ts:1291-1303`),
and the table's column filter is the same (keystrokes write the bind; Enter dispatches
`filterAction`). **There is no live-query dispatch anywhere in the framework.** A lookup cannot exist
under that rule — a picker that only answers on Enter is a query form.

- **New tempo:** debounced per-keystroke dispatch riding the **existing v4.2 non-blocking lane**
  (Phases 14/15) — a background query that must not block typing, where the lane-aware epoch already
  discards stale and out-of-order responses.
- **Convention: ~250–300ms debounce.** (ServiceNow `glide.xmlhttp.ac_wait_time` = 250ms; PrimeReact
  `delay` = 300ms.)
- **No minimum-character gate.** Nearly nonexistent in *both* lanes: ServiceNow has no min-chars
  property at all (effective minimum 1), and PrimeReact is the only surveyed library with `minLength`.
  **Debounce is the real convention, not a length gate.**

> 🏆 **This is a genuine differentiator, not a catch-up feature. No surveyed library handles both
> debounce and response ordering in framework code.** react-select guards ordering
> (`if (request !== lastRequest.current) return;`) but the word "debounce" has **zero occurrences in
> its entire repository**, and the open request for it is unanswered by any maintainer. PrimeReact
> debounces but ships no ordering guard. Ant Design and MUI address the race **only in demo code** —
> meaning every consumer who didn't copy the demo verbatim shipped the bug. Consumer-owned debounce is
> genuinely treacherous, not boilerplate: a debounced *promise-returning* loader returns `undefined`
> on suppressed calls, react-select's `.then` duck-check fails, and the spinner never clears (issues
> #2476, #3075, #4931 — the same bug, three times).
>
> **We own both halves, in the framework, and we already built the hard one.**

⚠️ **Banked lesson applies with full force:** subtle-concurrency code needs adversarial interleaving
verification; the first implementation is almost never right. The plan **must** enumerate the
interleavings (user-action-races-background; background-resolves-first; rapid-fire-supersede;
stale-arrives-late) and demand a FAIL-before / PASS-after test per race. A green unit suite that
doesn't script the interleaving proves nothing about the race. **Also check whether this is the
signal for the deferred, conditional Phase 17 admission barrier.**

### D5 — The label is **absent when redundant**

Principle 7 ("an option not set is simply absent") applied to a pair. Salesforce sets
`displayValue: null` for a plain string field, populating it **only when it carries information
`value` doesn't** — localization, formatting, or a related record's name. ⇒ **omit the label when it
equals the value**, which is exactly the free-form-tag case.

### D6 — A polymorphic reference needs a **type tag**; the id alone is not an identity

Microsoft, verbatim: *"When you include the `_ownerid_value` lookup property with your `$select`, it
returns a GUID value. **This value doesn't tell you whether the owner of the record is a user or a
team.**"* Dataverse fixes this with a `lookuplogicalname` annotation travelling beside the id.
⇒ a reference carries `{ value, label?, type? }`. `type` is **optional** — omit for monomorphic
references (principle 7 again).

### D7 — Any cap is **visible in the tree**. Nothing truncates silently.

Principle 8 ("nothing important fails quietly"). **ServiceNow is the anti-pattern**, and it's a
correctness bug rather than a perf knob — from their own performance staff:

> *"the first 250 matching results are returned by SQL to the application layer in batches of up to
> 100 at a time… security is then applied against those results via `GlideRecord.canRead()`…
> **Processing stops after 15 results are found that the user can read**."*

A 15-result cap applied **post-ACL behind a hard 250-row SQL ceiling** ⇒ **in a large table, an
exact-match record can be silently invisible.**

**Our in-house answer already exists and needs no new wire field:** the canonical table workflow's
*"Refine your filter — N matches, max is X"* pattern. The app renders a `TextNode`. Document this on
the node.

### D8 — The picker's filter is **UX, never authorization**

Both vendors say so outright. ServiceNow: ***"To restrict what data specific users can access, use
ACLs not reference qualifiers."*** Salesforce runs **two** layers with different jobs —
`CustomField.lookupFilter` (field metadata, **enforced server-side on save**, raising
`FIELD_FILTER_VALIDATION_EXCEPTION`) versus the record-picker's `filter` attribute (**UI-only**,
search scoping).

⇒ The server authorizes in the action handler with the real auth context, exactly as every other VMS
action does. The picker only narrows what's *offered*. **This must be stated in the node's TSDoc** —
a filter that looks like a security boundary and isn't is precisely the kind of thing that gets
trusted by mistake.

### D9 — Accessibility: **build to the baseline; don't gate the ship on a screen reader**

Ashley, 2026-07-16: *"the actual pool of users for the framework is too small for that to be
something that we're worried about. And if it ever came up, we'd revisit it."*

Two separable things; **only the second is declined**:
- **Building correctly** is near-free up front and a rewrite to retrofit ⇒ **we build to the baseline
  in §7.**
- **Verifying by ear** (driving it under a real screen reader as a ship gate) ⇒ **dropped.**

**One cheap test survives**, because it catches the one failure that is *invisible* rather than merely
unverified: a jsdom test asserting **the live-region node survives re-render with its identity
intact** (§7, item 8). Milliseconds, every CI run, no ceremony.

Revisit if a real user ever surfaces.

### D10 — The live region reuses the **`chartInstances` idiom**. It is NOT a new mechanism.

> ⚠️ **CORRECTION (2026-07-16, caught by the Phase 21 pattern-mapper).** An earlier revision of this
> doc asserted the live region needed a *"genuinely new, fourth preservation category"* beyond
> focus/scroll/`<details>`. **That was wrong, and it was wrong in the specific way our own banked rule
> warns about: it reasoned from memory instead of grepping.** The mechanism already exists and has
> shipped since Phase 12.

**`BrowserAdapter.chartInstances`** (`browser.ts:83-95`, used at `:676-700`) is **exactly** the
node-identity-survives-`innerHTML`-wipe mechanism this needs. Its own comment states the property:

> *"DELIBERATELY PERSISTENT across renders (NOT reset like the per-render fields below): the canvas +
> Chart instance must **SURVIVE render()'s innerHTML wipe** so a re-render with changed data redraws
> IN PLACE… Instances are mark-swept (destroy()'d + deleted) in render() when the new tree drops
> them."*

And at the reuse site: *"Reuse the SAME canvas element (**detached by the innerHTML wipe, not
destroyed**) — its 2D context + drawn bitmap survive."*

The distinction that matters is real and still holds — focus/scroll/details restore **state** onto
fresh nodes, whereas a live region (like a canvas) needs **the same node object** to persist, because
what survives is an external registration (the assistive tech's, or Chart.js's). **But that is a
distinction between two existing idioms, not a gap.** The correct implementation is a **fifth
instance of the `chartInstances` idiom**: a persistent, mark-swept map keyed by a stable per-render
ordinal, holding the live-region element(s), reattached on each render rather than rebuilt.

⇒ **Do NOT build a parallel mechanism. Copy `chartInstances`,** including its mark-sweep (a lookup
removed from the tree must drop its regions) and its per-render key-counter reset idiom
(`chartKeyCounter` / `chartKeysSeen`).

### D11 — `searchAction` is **renderer-forced** onto the non-blocking lane. The app cannot opt out.

The non-blocking lane is opted into via `ActionEvent.blocking === false` (`index.ts:20`) — i.e. it is
**a wire field the app sets.** For a search-as-you-type action that is a footgun: an app that forgets
`blocking: false` **busy-locks the entire page on every keystroke**, because the framework applies
`.vms-busy` for the duration of any user-initiated dispatch. The failure is severe, silent at author
time, and only visible when someone types.

⇒ **The renderer forces `searchAction` non-blocking**, regardless of what the app declares. A search
query is *definitionally* a background question — there is no coherent app that wants a blocking one,
so this is not a choice worth exposing. This is the same instinct as the framework owning debounce
and ordering (D4): the correct behavior is baked in rather than left to every consumer to get right.

Corollary for the design: **`blocking` is meaningless on `searchAction`.** Say so in the TSDoc rather
than letting an author believe setting it does something.

## 4. Wire shape

New `FieldNode.inputType` values: **`"lookup"`** and **`"lookup-multiple"`**.

No new node type. This reuses `name` / `label` / `placeholder` / `required` / `disabled` / `error` /
`help`, form-harvest, draft preservation, and a11y wiring — per the standing rule against
re-implementing `FieldNode`, and the banked *provide-your-own-X* divergence lesson (a parallel node
would re-implement all of that and drift).

| Field | Direction | Purpose |
|---|---|---|
| `bind` | **round-trips — STATE** | The id. `string` for `lookup`; `string[]` for `lookup-multiple`. **The only authoritative thing.** |
| `selected?` | **server→client — VIEW** | `Array<{ value: string; label?: string; type?: string }>` — the resolved label(s) for what is currently chosen. **Always an array** (length ≤ 1 for `lookup`). |
| `searchBind` | **round-trips — STATE** | Where the typed query lives, so the server sees it and the view stays a pure function of state. |
| `searchAction` | — | Dispatched **debounced** on type, on the non-blocking lane (D4). |
| `candidates?` | **server→client — VIEW** | `Array<{ value, label?, type? }>` — the current results. Same shape as `selected`. **Never** the source of a selected label (D1). |
| `allowCustom?` | — | The **declared** custom-entry axis (D3). |
| `textArrangement?` | — | Closed enum — see §5. |

**Design notes:**

- **`selected` and `candidates` are separate fields on purpose.** Fusing them is the original sin —
  it is precisely what makes filtering erase the selection (D1). SAP separates three concerns that
  the low-code tools fuse into one options array: *what the text is* (`Common.Text` — a path,
  server-resolved, travelling with the record), *how to render key+text* (`UI.TextArrangement`), and
  *how to search for a new one* (`Common.ValueList`). Per the survey: *"Fusing those three into one
  array is the original sin, and it's why the naive design breaks precisely when it's needed most —
  on a form that loads with a value already set."*
- **`selected` is always an array, deliberately** — including for single-select, where it holds 0 or 1
  entries. A `T | T[]` union would drift across backends; per the banked parity-type-safety lesson,
  prefer the shape that serializes byte-identically under both System.Text.Json and `JSON.stringify`.
- **`selected[].value` duplicating `bind` is accepted, deliberate redundancy.** Keying by value is
  robust; positional parallel arrays (Retool's model, which sits squarely in the client-resolve/bug
  lane) are not.
- **No `loading` on the wire.** The shell already knows a dispatch is in flight — that is framework
  state, not app state. Renderer-owned.
- **No `minChars`.** See D4.
- **Free-form tags fall out with no special case anywhere:** `allowCustom: true` + no `candidates` +
  labels omitted (because they equal their values) ⇒ a tags input.
- **Picked-vs-invented is server-decidable, not sniffed:** the server knows its own ids, so a bind
  value that isn't one is an invention. (See OPEN-3 — verify before locking.)

**.NET mirror obligations** (gotcha #8): `allowCustom` is an optional non-nullable bool whose `false`
means absent ⇒ `[JsonIgnore(Condition = WhenWritingDefault)]`. Every nullable carries
`WhenWritingNull`. Otherwise it silently re-introduces null/false-vs-absent drift from the TS twin.

## 5. `textArrangement` — adopted from SAP's `UI.TextArrangement`

A **closed enum** expressing how to render a key+text pair **with zero CSS** — structurally identical
to our existing appearance axes, and it answers a real question: *does the user see "Sally Omer", the
raw id, or both?*

| SAP | VMS | Means |
|---|---|---|
| `TextOnly` | `"text"` | label only — **the default** |
| `TextFirst` | `"text-id"` | label, then id |
| `TextLast` | `"id-text"` | id, then label |
| `TextSeparate` | *(not adopted)* | code here, text rendered elsewhere entirely — a layout intent no `{label,value}` pair can carry; out of scope |

SAP annotates `TextOnly` *"e.g. for UUIDs"* — i.e. when the id is noise. Ours defaults to label-only
and lets an app surface the id when it is genuinely meaningful (an order number, a SKU, a ticket ref).
**OPEN-1: v1 or fast-follow.**

### D12 — **Candidate ORDER is the app's. The renderer MUST NEVER re-sort.**

`candidates` is an array and **its order is meaningful data, not incidental**. The renderer presents
them in the order given, full stop.

**Consumer signal (@molly / Metis, 2026-07-16), which is why this is written down:** their plan is to
sort candidates by *recency-weighted mention frequency* — the people a given operator @-mentions most
bubble to the top — computed server-side in their own provider handler before the list is returned.
They flagged it as *"Metis-side sort… so it doesn't touch your design."* **It does touch it**: a
renderer that helpfully alphabetized for tidiness would silently destroy that ranking, and the app
would have no way to stop it.

This also settles **OPEN-6** concretely and matches the survey: Salesforce's picker `searchType`
**defaults to `Recent`**, and Dynamics shows *"the five most recently used rows… along with five
favorite rows"* (explicitly *not* filtered by the search term). **Relevance ordering is universal in
mature pickers, and in every case it is the server's judgment, not the widget's.**

⇒ The renderer sorts nothing, dedupes nothing, and truncates nothing. The app decides what comes back
and in what order; if it wants a cap, D7 requires it say so visibly in the tree.

**Scope — D12 governs PRESENTATION of `candidates`, not state writes.** (Ambiguity caught by the
Phase 21 planner, 2026-07-16 — it read the multi-select commit-path dedupe as a D12 violation and
flagged it rather than silently working around it. It isn't one, but the wording invited the reading,
so: the fix is here, in the decision.)

- **In scope (forbidden):** reordering, filtering, deduping, or truncating **`candidates`** for
  display. That list is the server's answer and the renderer is not entitled to an opinion about it.
- **Out of scope (allowed, and correct):** **deduping `bind` on commit** in `lookup-multiple` — i.e.
  not writing the same id into the selection twice. That is a *state write* about the user's own
  accumulated selection, not a presentation of the server's list. A selection set has set semantics;
  a duplicate id in `bind` is meaningless in every case anyone has been able to construct, and mature
  libraries prevent it structurally (react-select's `hideSelectedOptions` defaults on for multi).

The distinction in one line: **D12 is about not second-guessing the server's answer. It is not a ban
on the renderer having any logic at all.** Comment it at the commit site — a reader fresh off D12 will
flag it, exactly as the planner did.

## 6. Agent-drivability

An agent sets `bind` to the id(s) and never touches the search UI. **It does not need to know the
label** — `selected` is display-only and the server must never trust a client-supplied one (D1). The
"an agent knows the id but not the label" wrinkle becomes an argument *for* the model.

> 🏆 **And the finding worth stating loudly:** *"There is essentially no prior art at the protocol
> level; everyone kept the picker's transport private."* ServiceNow's `/xmlhttp.do` is undocumented
> across all authoritative sources; Strapi's `/relations` endpoint has no doc page; Salesforce's UI
> API is the lone public exception.
>
> **In VMS the picker's search IS an ordinary action on the public wire.** An agent drives a lookup
> exactly like a human — no special API, no private transport, no undocumented endpoint. **We would be
> the first system where the reference picker is a documented, first-class protocol.** It costs us
> nothing; it falls straight out of the architecture. **This belongs in `agent-skill.md`.**

## 7. Accessibility baseline (mandatory — this is the implementable spec)

Sources: W3C WAI-ARIA APG (Combobox pattern), a11ysupport.io, GOV.UK's published assistive-technology
user testing, Adobe React Aria, Adrian Roselli, TetraLogical.

> ⚠️ **Context that shapes everything below: the naive chips multi-select is a KNOWN, PUBLICLY FAILED
> design.** `alphagov/accessible-autocomplete-multiselect` carries the notice *"This project is
> retired as the component is not accessible."* It failed GOV.UK's own review because it *"does not
> announce the selections effectively or the presence of the 'Remove' button for screenreaders"*, and
> they judged the fixes *"will be challenging"* enough to withdraw rather than repair it. Items 25,
> 27 and 29 exist to prevent exactly that.
>
> ⚠️ **And the APG pattern is the best-*specified* option, not a validated-good one.** Roselli:
> *"Both the APG examples and native HTML control have tested poorly with users for more than two
> decades."* Sarah Higley's testing lands similarly. **This is why D2's "keep `select-multiple` for
> enumerable sets" is an accessibility requirement, not a preference** — the combobox must never be
> the only multi-select we offer.

### Single-select combobox
1. `role="combobox"` on the **`<input>` itself**, not a wrapper. ARIA 1.2 is current; the 1.0
   wrapper + `aria-owns` pattern is deprecated.
2. Input carries `role="combobox"`, `aria-expanded` (**always present**, even when closed),
   `aria-controls` (valid while the popup is hidden), `aria-autocomplete="list"`, and
   `aria-activedescendant` **only while an option is active** (removed otherwise). Accessible name via
   `<label for>`.
3. **Do not set `aria-haspopup`** — `listbox` is implicit for `role="combobox"`.
4. Popup `role="listbox"` with its own accessible name. Options `role="option"`, unique stable `id`,
   `aria-selected="true"` on the highlighted one.
5. **`aria-activedescendant`, NOT roving tabindex** — DOM focus must stay in the input or typing
   breaks. (Roving tabindex *is* correct for the chips — different widget, no text editing.)
6. Popup and options excluded from the tab sequence; only the input is tabbable.
7. Options must be `role="option"` elements, **never `<button>`/`<a>`** — interactive descendants
   destroy the listbox accessibility tree.

### The live region (the part most implementations get wrong)
8. 🚨 **Render `role="status"` EMPTY at mount, before any results exist, and NEVER conditionally
   render it.** Screen readers only announce changes to elements they already registered for;
   creating the element and injecting its text in the same tick announces **nothing**.
   **⇒ This is a HARD constraint on our renderer.** `BrowserAdapter` full-rebuilds the tree on every
   response — which is exactly why focus, scroll, and `<details>`-open each need explicit
   snapshot-and-restore. **A live region rebuilt every render is a live region that never announces,
   and it fails silently: the page looks perfect and every structural test passes.**
   **⇒ This is a genuinely NEW, FOURTH preservation category.** Focus/scroll/details restore *state*
   onto fresh nodes; a live region needs **the same node to persist** so the assistive tech's
   registration survives with it. Not the same mechanism. **This is the D9 test.**
9. Politeness = **`polite`** via `role="status"`. `assertive` is wrong for counts and loading (it
   interrupts the user's own typing echo); reserve it for errors.
10. **Debounce status updates ~1400ms** (GOV.UK's `statusDebounceMillis`) — on Safari/VoiceOver
    *"typing echo can otherwise interrupt announcement of the aria live content."* Note this is a
    **separate, much longer debounce than the query debounce** in D4.
11. Announcement strings (adopt GOV.UK's battle-tested set): `"${n} results are available."`;
    `"${option} ${i+1} of ${n} is highlighted"`; `"No search results"`; **and announce loading** —
    *"Loading results"*. An async combobox silent during the fetch leaves AT users with no signal.
12. **Use TWO alternating status regions.** Writing *identical* text into a live region twice is not a
    change and is **not re-announced** — retype, get "5 results" again, hear silence. GOV.UK
    alternates two divs; React Aria independently landed on dual regions.
13. Ship an assistive hint via `aria-describedby`, **removed after first input** so it isn't a
    per-keystroke tax.
14. **Clear the active option whenever the query text changes; do NOT auto-highlight the first option
    when results arrive.** React Aria's NVDA finding: with an option auto-focused, *"character
    deletions and text cursor movement in the ComboBox input weren't being announced at all."* This
    bites async hardest — the natural implementation highlights option 1 the moment results land,
    mid-typing.

> 🚨 **Why the live region is load-bearing and not decorative:** a11ysupport.io's test of **the APG's
> own reference example** found VoiceOver + Safari a complete failure — *"nothing was conveyed"* —
> despite the listbox displaying. React Aria built live-region announcements *specifically* to work
> around VoiceOver bugs. **On Safari the announcement is the only thing that works.**

### Keyboard
15. Closed: `Down` opens + focuses first; `Alt+Down` opens **without** moving focus; `Up` opens +
    focuses last.
16. Open: `Down`/`Up` wrap through options; `Left`/`Right` **return to the input text and move the
    caret** (they exit the list, they don't navigate it); `Home`/`End` are **text-editing keys** in an
    editable combobox (caret to start/end), **not** first/last option.
17. `Enter` with an option active: accept, set the input value, close, return focus to the input.
18. **`Escape` is two-stage:** popup open ⇒ close and **keep** the value. Popup already closed ⇒
    *optionally* clear. **Escape must never clear while the popup is open.**
19. `Tab` — see **OPEN-2**. APG is silent.
20. `PageUp`/`PageDown` are **not** part of the listbox-popup contract. Do not invent them.
21. Printable characters while an option is active: type into the input, refilter, **clear the active
    option** (item 14). Typing must never be swallowed by list-typeahead.
22. `Backspace`/`Delete` = plain text editing. Never intercept (except chips, item 31).

### Chips (multi)
23. ⚠️ **There is no APG pattern for chips.** Everything here is extrapolation. Build conservatively.
24. **Do not make the chip group a `listbox` with `option` children** — a chip contains a remove
    *button*, and an interactive descendant inside `option` is invalid and destroys the accessibility
    tree. Use `role="list"`/`listitem` (or `role="group"` + `aria-labelledby`) with a real `<button>`.
25. 🚨 **Each remove button needs a unique, item-specific name: `aria-label="Remove ${item}"`.** Not
    "Remove", not "×", not an unlabelled icon. **This exact failure killed the GOV.UK multiselect.**
26. **Roving tabindex across chips** + `Left`/`Right` traversal — correct here because chips are not
    text-editable, so DOM focus can move freely. **Do not use `aria-activedescendant` for chips** —
    remove buttons need real focus to be operable.
27. 🚨 **Announce add AND remove WITH the running count:** *"${item} selected. ${n} items selected."* /
    *"${item} removed. ${n} items selected."* Without the count an AT user cannot know the size of the
    selection they are building without leaving the input to audit the chips. **GOV.UK failed review
    for exactly this.**
28. The chip group needs an accessible name (`aria-label="Selected items"`) so it is findable.
29. 🚨 **Focus after removing a chip.** Removing the focused element dumps focus to `<body>`, stranding
    the user at the top of the page. **Rule: next chip's remove button → else previous chip's → else
    the text input. NEVER `<body>`.**
30. Multi listbox: `aria-multiselectable="true"`; keep `aria-selected` accurate on **every** option
    (true *and* false); **do not close the popup on select.**
31. **Backspace-on-empty: two-step, non-destructive.** No authority addresses this; it is convention.
    First press ⇒ do **not** delete — highlight the last chip and announce *"${item}, press Backspace
    or Delete to remove"*. Second press ⇒ remove, announce, apply the focus rule. Rationale: a
    single-press silent delete is destructive, invisible to AT, and trivially mis-triggered while
    fixing a typo. Costs mouse users nothing.

### General
32. **Never rely on `aria-selected` alone** — *"mostly not announced when true. Only Narrator + Edge
    provides support."* Same for `aria-autocomplete` and `aria-controls`. **Set them all** (correct,
    cheap, support improves) but treat them as **non-communicating**: every fact they encode must
    ALSO be in the live-region text. A genuine conformance-vs-reality conflict; satisfy both sides.
33. **Reflow:** chip and option text must wrap without truncation, and options must be visually
    delimited so a wrapped option never reads as two. GOV.UK's 12× magnification tester: *"Some larger
    country names may take over two lines. It wasn't always clear to him that this had happened — the
    words just looked like separate suggestions that didn't make much sense."*
34. ⚠️ **Known, unresolved cost of the APG pattern:** speech input. GOV.UK: *"A Dragon user trying
    'click Egypt' is something we'd like to support. They are clickable options but Dragon doesn't
    recognise them as such"* — `role="option"` elements are not voice-clickable, and there is **no
    known fix**. Documented honestly rather than pretended away. Also: *"Avoid JavaScript interference
    with browser-provided editing functions"* (APG) — Dragon's text-input path blanked GOV.UK's field
    because their JS assumed keystroke events.

## 8. Open decisions

Recorded so they are **decisions, not implementation accidents**. Vicky's to make during the build.

- **OPEN-1 — `textArrangement` in v1 or fast-follow?** Purely additive. Leaning fast-follow to keep
  v1's surface honest; the closed enum is already designed.
- **OPEN-2 — Does `Tab` select the active option or abandon it?** ⚠️ **APG is silent** — its table
  only specifies where Tab *goes*, never what it does to the active option. Real-world splits:
  IDE/URL-bar muscle memory expects Tab to accept; the other camp holds that Tab is a navigation key
  and must never silently commit. **Leaning: close the popup, do NOT select** — non-destructive,
  matches Escape's keep-the-value semantics, and an accidental Tab silently committing a wrong value
  is unannounced data corruption. **Will generate complaints either way.**
- **OPEN-3 — Is server-side "is this id one of mine?" enough to distinguish picked-from-invented**, or
  does an invented value need an explicit wire marker (react-select's `__isNew__` + distinct action)?
  Leaning "server-decidable is enough" — but D3's whole point is that this is *explicit*, so **verify
  rather than assume**.
- **OPEN-4 — Stale-response discard-only vs cancel.** Our lane discards today, as react-select does —
  correct but wasteful: the superseded request still goes out and still costs the server. On a
  per-keystroke directory search that is real load.
- **OPEN-5 — Search error state.** No surveyed library has a first-class one, and **react-select
  actively swallows it** (`loader.then(callback, () => callback())`) ⇒ *a failed fetch is
  indistinguishable from "no results."* That directly violates principle 8 and is a **free
  differentiator**. Reuse `FieldNode.error` (currently validation-shaped) or add a distinct
  search-error slot? Leaning reuse; needs a look at how `error` renders.
- **OPEN-6 — MRU empty state.** Salesforce's `searchType` **defaults to `Recent`**; Dynamics shows 5
  most-recently-used + 5 favourites (*"Recent rows are not filtered by search term"*). A cheap UX win.
  This is the app's job — it supplies `candidates` on an empty query — but **the design must not
  preclude it**: confirm the empty-query path reaches the server at all.

## 9. Provenance

The full three-part survey (with citations, verbatim vendor quotes, and the comparison tables this
doc summarizes) is the working record and lives outside the repo, in the maintainer's bounty
`lookup-field-primitive/survey/`. This document carries every decision and the evidence needed to
defend it; the surveys carry the receipts.
