# Phase 21: v5.2 Lookup / live-query lane — Pattern Map

**Mapped:** 2026-07-16
**Files analyzed:** 10 files to be created/modified
**Analogs found:** 9 exact / 1 partial — **0 with no analog**

> **Headline for the planner:** every mechanism this phase needs already exists somewhere in the
> codebase, *including the one the design doc says is genuinely new*. See §4 — the `<details>`/focus/
> scroll passes are indeed the wrong analog for the live region, but **`chartInstances` (browser.ts:92,
> 678-700) is a working, shipped, node-identity-survives-innerHTML-wipe mechanism** and is the correct
> analog. The design doc (D9a) and CONTEXT did not know about it. Do not build a 4th mechanism from
> scratch.

## File Classification

| File to modify | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `viewmodel-shell/src/index.ts` (FieldNode) | model/wire-type | request-response | `FieldNode.inputType` `select`/`select-multiple` + `options?` — index.ts:337-405 | exact |
| `viewmodel-shell/src/index.ts` (dispatch lane) | service (shell loop) | event-driven | `dispatch()` non-blocking lane — index.ts:1264-1345 | exact |
| `viewmodel-shell/src/browser.ts` (`field()`) | component/renderer | event-driven | `field()` select branch — browser.ts:1134-1179; text+Enter — 1282-1306 | exact |
| `viewmodel-shell/src/browser.ts` (debounced query) | component/renderer | streaming/live-query | table `filterBinds`/`filterAction` — browser.ts:1677-1718 | role-match (Enter-only, no debounce) |
| `viewmodel-shell/src/browser.ts` (live region) | component/renderer | event-driven | **`chartInstances` canvas persistence** — browser.ts:83-100, 175-185, 678-700 | exact (see §4) |
| `viewmodel-shell-dotnet/ViewModels.cs` | model/wire-type | request-response | `record FieldNode` — ViewModels.cs:696-736 | exact |
| `viewmodel-shell/src/server.ts` | utility (validator) | transform | `collectActions` `case "field"` — server.ts:161-165 | exact |
| `viewmodel-shell-dotnet/ViewModels.cs` (validator) | utility (validator) | transform | `Collect` `case FieldNode` — ViewModels.cs:1263-1265 | exact |
| `parity/` FeatureProbe | test/fixture | request-response | v5.1 nav primitives in `feature-probe.json` `$comment` | exact |
| `viewmodel-shell/styles/default.css` | config/styling | — | `.vms-badge` — default.css:1141-1185; `.vms-field__*` — 508-586 | exact |
| `viewmodel-shell/src/tui.tsx` | component/renderer | request-response | select branch — tui.tsx:1881-1900 | exact |
| `viewmodel-shell/test/*.test.ts` | test | event-driven | `nonblocking-dispatch.test.ts` (whole file) | exact |
| `viewmodel-shell-dotnet/Tests/` | test | — | `FieldBindSerializationTests.cs`, `ActionDescriptorBlockingSerializationTests.cs` | exact |

---

## 1. `viewmodel-shell/src/index.ts` — `FieldNode` wire type

**Analog:** `viewmodel-shell/src/index.ts:337-405`

**The pattern, quoted** (inputType union, index.ts:340-345):

```typescript
  inputType:
    | "text" | "email" | "password" | "number"
    | "date" | "time" | "datetime-local"
    | "textarea" | "hidden" | "file"
    | "select" | "select-multiple" | "checkbox"
    | "code";
```

**`options?` — the closest existing shape to `selected`/`candidates`** (index.ts:387):

```typescript
  options?: Array<{ value: string; label: string }>;
```

Note: `options[].label` is **required**; the design's `{value, label?, type?}` makes `label` optional
(D5 — absent when redundant). That is a deliberate divergence, not an oversight.

**`action` TSDoc — the existing "dispatch from a field" doc convention** (index.ts:393-395):

```typescript
  /** Dispatched when Enter is pressed (text-like inputs only). Carries an
   *  action name only — the current value is already in state at the bind path. */
  action?: ActionEvent;
```

**The `bind`-is-conditional TSDoc convention** (index.ts:346-354) is the model for documenting which
inputTypes require `searchBind`: it enumerates the applicable inputTypes inline and states the failure
mode of getting it wrong.

**What to copy:**
- Extend the existing `inputType` union in place — add `| "lookup" | "lookup-multiple"` to the
  `"select" | "select-multiple"` line (they are conceptual siblings; D2 says the split mirrors ours).
- The TSDoc house style: prose sentences, **`Omitted = <default>`** as the closing clause of every
  optional field's doc (see `disabled?` at :358-361, `width?` at :428-432). Every optional field in
  this file ends that way — match it.
- `min`/`max`/`step` at index.ts:376-383 are the precedent for the **"typed as strings so the wire
  stays byte-identical across backends"** rationale — cite the same reasoning for `selected[].value`.
- Update the `bind` TSDoc's inputType enumeration (:346-354) — `lookup`/`lookup-multiple` are
  value-bearing and REQUIRE `bind`, so they must be added to that list or the `[vms:no-bind]`
  diagnostic's documented contract drifts.

**What to do differently, and why:**
- **`label?` optional** (vs `options[].label` required) — D5.
- **`selected` is always an array even for single `lookup`** — deliberately no `T | T[]`, per the
  banked parity-type-safety lesson. Add that as an inline TSDoc note; there's no existing precedent
  for a "deliberately array-of-≤1" field, so the reasoning must be written down at the type.
- **D8 (filter is UX, never authorization) must be stated in the node's TSDoc.** The nearest tonal
  precedent for a security-shaped warning in TSDoc is the `uploadOn` doc (:396-404), which explicitly
  names the silent-failure mode. Match that register.
- **D7 (cap is visible in the tree)** — document on the node that the app renders a `TextNode`; no
  new wire field.

---

## 2. `viewmodel-shell/src/browser.ts` — the `field()` renderer

**Analog:** `browser.ts:1068-1310` (`field()`), specifically the select branch and the text branch.

### 2a. How `field()` branches by inputType

Early-return branches first (`hidden` at :1083, `checkbox` at :1093 — both `return` **before**
`decorateField`), then the shared wrapper is built at :1123-1132, then an `if/else if` chain:

```typescript
    if (n.inputType === "select" || n.inputType === "select-multiple") {   // :1134
    } else if (n.inputType === "file") {                                   // :1180
    } else if (n.inputType === "textarea") {                              // :1243
    } else if (n.inputType === "code") {                                  // :1253
    } else {                                                              // :1282 — native <input>
    }
    this.decorateField(wrapper, n);   // :1308
    parent.appendChild(wrapper);      // :1309
```

**What to copy:** add `lookup`/`lookup-multiple` as a **new `else if` arm in this chain, after the
select arm** — NOT an early return. This matters: staying in the chain means `decorateField()` at
:1308 gives you `disabled`/`readonly`/`error`/`help`/`aria-describedby`/`aria-invalid` **for free**
(see §2d), which is exactly the "don't re-implement FieldNode" rule the design doc §4 invokes.

⚠️ **`decorateField` finds the control via `wrapper.querySelector(".vms-field__input")` (:1317).** The
lookup's text input MUST carry `.vms-field__input` or every decoration silently no-ops. This is a real
trap — it fails quietly and structurally passes.

### 2b. The select branch — the closest analog for reading `selected`

`browser.ts:1134-1179`, quoted in the load-bearing part:

```typescript
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
```

**What to copy:** the `isMulti` single-branch-two-shapes structure (one code path, cardinality as a
local bool) — D2 says lookup/lookup-multiple are separate *wire tokens*, but the renderer may still
share a function with an `isMulti` local, exactly as select does. The `(n.options ?? [])` nullish
default is the house idiom for an optional array — use it for `candidates ?? []`.

**🚨 What to do deliberately differently — THE TRAP (D1):** the select branch resolves the displayed
label **from `options`** (`o.textContent = opt.label`). **The lookup must NOT resolve its label from
`candidates`.** That is precisely the Zag/Ant failure the design doc exists to prevent. Read the
label from `n.selected` and *only* from `n.selected`; `candidates` feeds the popup listbox and nothing
else. A reviewer should be able to grep the lookup branch and find zero reads of `candidates` in the
chip/display path.

**Also do differently — do NOT copy the seed-write.** browser.ts:1152-1169 seeds state from the DOM
because `<select>` auto-selects its first option:

```typescript
      } else if (stateValue === undefined || String(stateValue) !== sel.value) {
        this.writeBind(n.bind, sel.value);
      }
```

A lookup has no auto-selected default — an empty lookup means "nothing chosen", which is a legitimate
absent. Seeding here would invent a selection the user never made. (The rationale comment at
:1152-1162 explains why select needs it; that rationale does not transfer.)

### 2c. `writeBind` and `n.action` — what exists today

`writeBind` (browser.ts:1063-1066) — the whole thing:

```typescript
  /** Write to a bind path, no-op when the field has no bind (file inputs). */
  private writeBind(bind: string | undefined, value: unknown): void {
    if (bind != null) this.sa.write(bind, value);
  }
```

`n.action` on a text input — **Enter ONLY** (browser.ts:1291-1303), the exact code the design doc D4
cites:

```typescript
      inp.addEventListener("input", () => { this.writeBind(n.bind, inp.value); });
      if (n.action) {
        const action = n.action;
        inp.addEventListener("keydown", (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            // Belt-and-suspenders: flush the latest value to state before
            // dispatching, in case the browser hasn't fired `input` yet
            // (e.g. an autofill that lands then submits).
            this.writeBind(n.bind, inp.value);
            on(action);
          }
        });
      }
```

**Confirmed for the planner: there is no debounce, no timer, and no live dispatch anywhere in
`field()`.** The design doc's grep-verified claim holds. The phase **extends** this — it adds a
separate `input` listener that writes `searchBind` and schedules a debounced `searchAction`, alongside
(not replacing) the existing Enter-dispatches-`action` binding. `action` and `searchAction` are
independent: a lookup may legitimately carry both.

**What to copy:** the **flush-before-dispatch** idiom (`this.writeBind(n.bind, inp.value)` immediately
before `on(action)`). The debounced search callback fires ~250-300ms after the last keystroke, by which
time `input` has certainly fired — but the debounce timer must still `writeBind(n.searchBind, ...)`
**inside the timer callback, reading `inp.value` fresh**, so the dispatched state is the value as of
fire time, not as of schedule time. This mirrors the same defensive reasoning.

### 2d. `decorateField` — free infrastructure

`browser.ts:1316-1361`. Handles `disabled`, `readonly`, `min`/`max`/`step`, `maxLength`, `.vms-field__help`,
and `.vms-field__error` (with `role="alert"`, `aria-invalid`, `aria-describedby` accumulation).

**Relevant to OPEN-5 (search error state).** The error path, quoted (:1347-1357):

```typescript
    if (n.error != null && n.error !== "") {
      wrapper.classList.add("vms-field--error");
      const errEl = document.createElement("div");
      errEl.className = "vms-field__error";
      errEl.id = `vms-${n.name}-error`;
      errEl.setAttribute("role", "alert");
      errEl.textContent = n.error;
      wrapper.appendChild(errEl);
      describedBy.push(errEl.id);
      control?.setAttribute("aria-invalid", "true");
    }
```

**Planner: this is the evidence OPEN-5 asked for ("needs a look at how `error` renders").** Reusing
`FieldNode.error` for a search failure gets you a `role="alert"` (assertive) region and
`aria-invalid="true"` on the combobox. Design §7 item 9 says **`assertive` is reserved for errors** —
so a genuine search *failure* is arguably a correct fit. But `aria-invalid="true"` on the input is
semantically wrong for "the server is down" (the user's input is not invalid), and it would collide
with a real validation error on the same field. **Recommendation to record: reuse `error` for v1
(cheap, honest, satisfies principle 8), and note the `aria-invalid` overload as a known wart** — or
add a distinct slot if the planner judges the collision real. Either way this needs an explicit
decision, not a default.

### 2e. The table filter — the nearest existing "type then query the server"

**Analog:** `browser.ts:1677-1718`. The core (:1698-1712):

```typescript
          const bindPath = n.filterBinds?.[col.key];
          const bound = bindPath != null ? this.sa.read(bindPath) : undefined;
          inp.value = bound != null ? String(bound) : (col.filterValue ?? "");
          inp.placeholder = `Filter…`;
          if (bindPath != null) {
            inp.addEventListener("input", () => { this.sa.write(bindPath, inp.value); });
          }
          inp.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
              if (bindPath != null) this.sa.write(bindPath, inp.value);
              on(filterAction);
            }
          });
```

This is the **exact shape** `searchBind`/`searchAction` should take — a bind that receives every
keystroke, plus a dispatch trigger — with the trigger changed from `keydown Enter` to a debounce timer.
`filterBinds` even has the same "a bind for the query, separate from the value bind" split that
`searchBind` needs.

**🚨 The single most copyable line in this file** (browser.ts:1692-1697):

```typescript
          // Stable id so render()'s focus+caret restore can re-find this input
          // after a re-render — critical because a silent poll can fire mid-
          // keystroke while the user is typing a filter (the canonical
          // workflow-table pattern). Without an id the value survives (it's
          // bound state) but focus/caret are lost on every poll tick.
          inp.id = `vms-tablefilter-${col.key}`;
```

**This is the lookup's problem verbatim, and worse.** The lookup dispatches on *its own* keystrokes —
so a re-render lands mid-typing on **every single search**, not just on an unlucky poll tick. The
lookup's text input MUST have a stable id (`vms-${n.name}` — the field convention at :1285) or focus
and caret are destroyed on every debounce fire, making the control unusable. The existing focus/caret
restore (browser.ts:111-114 + 187-197) then handles it for free. **Copy the id; copy the reasoning
comment.**

**What to do differently:** the table filter's `input` listener writes the bind and stops. The lookup's
must also `clearTimeout` + `setTimeout` the pending search. Also per design §7 item 14, the same
listener must **clear the active option** on every query change.

---

## 3. 🚨 THE NON-BLOCKING LANE — how a new caller opts in

**Analog:** `viewmodel-shell/src/index.ts:1011-1345`. **Verdict: cleanly reusable. Zero changes needed
to the lane itself. `searchAction` is a pure new consumer.**

### 3a. The fields (index.ts:1018-1067) — names the planner must use verbatim

| Field | Line | Role |
|---|---|---|
| `blockingInFlight` | 1020 | Guards ONLY the blocking lane (the old `dispatching` mutex, renamed 1:1) |
| `nonBlockingInFlight` | 1023 | Guards the non-blocking lane — at most one background trip in flight |
| `pendingNonBlockingRefire` | 1036 | `{ action, silent } \| null` — the coalescing slot, **latest wins, overwrite never append** |
| `dispatchSeq` | 1040 | Monotonic, incremented **at actual fire time**, shared across both lanes |
| `appliedSeq` | 1067 | High-water mark of the newest applied response; advanced only via `Math.max` |
| `serverBusy` / `userDispatching` | 1073-1074 | Feed `syncBusy()` → `adapter.setBusy` |

### 3b. How a dispatch is classified — the ONE line that matters

`index.ts:1264-1268`:

```typescript
  async dispatch(action: ActionEvent, silent = false): Promise<void> {
    // Phase 14 (NBA-01) — unifies the existing poll-only `silent` flag with
    // the new `blocking:false` field under one "non-blocking lane" concept
    // (design doc: "Poll = a non-blocking action on a timer").
    const nonBlocking = silent || action.blocking === false;
```

**⇒ How a NEW caller opts into the non-blocking lane: set `blocking: false` on the `ActionEvent` it
passes to `onAction`.** That is the entire opt-in. `silent=true` is the poll's private door (only
`schedulePoll` passes it); an adapter-originated dispatch uses `action.blocking === false`.

**🚨 The single most important decision this creates for the planner.** `searchAction` arrives from the
server as an `ActionEvent`/`ActionDescriptor`. Two options:

1. **App-declared** — the app must remember to set `blocking: false` on every `searchAction`. An app
   that forgets gets a typeahead that busy-locks the page on every keystroke. **Silent, awful, and
   the app's fault for a framework-owned concern.**
2. **✅ Renderer-forced** — `field()` dispatches `on({ ...n.searchAction, blocking: false })`. The lane
   is a framework decision (D4: "we own both halves, in the framework"), the app cannot get it wrong,
   and `ActionEvent.blocking` never needs to cross the wire for this feature at all.

**Recommend option 2 and record it.** Note `ActionEvent.blocking`'s own TSDoc (index.ts:6-20) already
says the field is *"read PURELY client-side"* and *"never rides inside the `_action` POST payload"* —
so synthesizing it in the renderer is exactly in-contract, not a hack. The .NET `ActionDescriptor.Blocking`
stays available for apps that want an explicit non-blocking button, unchanged.

### 3c. The blocking lane (index.ts:1270-1303) — what the search must NOT trip

```typescript
    if (!nonBlocking) {
      if (this.serverBusy) return;
      if (this.blockingInFlight) return;
      ...
      this.blockingInFlight = true;
      this.userDispatching = true;
      this.syncBusy();
      this.options.onLoading?.(true);
      try { await this.performRoundTrip(action, false); }
      finally { this.blockingInFlight = false; this.userDispatching = false; this.syncBusy(); this.options.onLoading?.(false); }
      return;
    }
```

`this.blockingInFlight` returning early is why a keystroke-driven search on the blocking lane would be
**dropped** while a user's form submit is in flight, and why it would flip `.vms-busy`
(`pointer-events: none`) on the whole page every ~300ms. Both are disqualifying — this is the concrete
argument for the non-blocking lane.

### 3d. The non-blocking lane + coalesce/refire (index.ts:1305-1345)

```typescript
    if (this.nonBlockingInFlight) {
      // NBA-02 — coalesce; do NOT fire a second concurrent request. Overwrite
      // (never append/queue) so at most one extra round trip fires once the
      // in-flight one resolves, carrying the LATEST trigger.
      this.pendingNonBlockingRefire = { action, silent };
      return;
    }
    ...
    this.nonBlockingInFlight = true;
    try {
      await this.performRoundTrip(action, true);
    } finally {
      this.nonBlockingInFlight = false;
      const refire = this.pendingNonBlockingRefire;
      this.pendingNonBlockingRefire = null;
      if (refire) void this.dispatch(refire.action, refire.silent);
    }
```

**Planner note — this answers OPEN-4 partially, and it is better news than the design doc assumed.**
The design says *"the superseded request still goes out and still costs the server."* That is true of
requests **already in flight**, but the coalescing slot means rapid keystrokes **never fire more than
2 concurrent requests total** (one in flight + one queued, latest-wins overwrite). Combined with a
~300ms debounce (which suppresses most keystrokes *before* they reach `dispatch()` at all), the actual
server load is far below the "per-keystroke directory search" worst case OPEN-4 worries about. **The
debounce and the coalesce slot are two independent suppressors stacked.** Recommend: **discard-only,
no cancel, for v1** — cheap, already built, and the load argument for `AbortController` is much weaker
than it looks. Record it as a decision with this reasoning.

### 3e. The lane-aware epoch (index.ts:1149-1237)

Seq assignment at fire time (:1150-1152):

```typescript
    // Phase 14 (NBA-03) — assigned at the moment the request actually fires
    // (not at trigger/coalesce time) so it reflects real fire order.
    const seq = ++this.dispatchSeq;
```

The apply gate (:1211-1237) — the heart:

```typescript
      if (nonBlocking) {
        if (seq >= this.appliedSeq && this.pendingNonBlockingRefire === null) {
          this.appliedSeq = Math.max(this.appliedSeq, seq);
          this.processResponse(body);
        }
      } else {
        // Blocking (user) response: authoritative — ALWAYS applies.
        this.appliedSeq = Math.max(this.appliedSeq, seq);
        this.processResponse(body);
      }
```

Three rules the phase inherits **for free**, and must not re-implement:
1. **Stale discard** (`seq >= this.appliedSeq`) — a slow search response that lands after a newer one
   is dropped. This is *exactly* react-select's `if (request !== lastRequest.current) return;`, already
   built, already tested.
2. **Blocking is authoritative** (CR-02, :1227-1236) — the user picking an option (blocking) is never
   clobbered by a background search response.
3. **Refire-queued discard** (NBA-06, :1223) — if a newer search is already queued, the in-flight
   response is dropped rather than applied-then-immediately-superseded (which would flicker stale
   candidates into the popup for one frame).

**What to copy:** nothing — **call it, don't touch it.** The correct posture is that `field()` calls
`on({...searchAction, blocking:false})` and every guarantee above applies with zero new lane code.
Any PR that adds a field named like `pendingSearch`/`searchSeq`/`lastSearchRequest` to `ViewModelShell`
is a parallel mechanism and should be rejected on sight.

**What to do differently:** the **debounce lives in `browser.ts`, not in the lane.** The lane is
platform-agnostic core (`check:core-globals` gates `index.ts`); `setTimeout` is on the allowed-universals
list, so a debounce in core would *pass* the guard — but it does not belong there. The debounce is a
DOM-input-cadence concern, it belongs with the `input` listener that owns the timer, and putting it in
core would force the TUI to inherit a cadence it has no use for. **Recommendation: debounce in
`field()` in `browser.ts`; the lane stays untouched.**

### 3f. Phase 17 admission barrier (CONTEXT D4 asks: "is this the signal?")

**Assessment: no.** The admission barrier was recorded as conditional on a real signal of *lane
contention* — many independent non-blocking producers fighting for one slot. A lookup is a single
producer, already self-throttled by its own debounce, and the existing latest-wins coalesce slot is
precisely the right semantic for it (an older query is worthless the instant a newer one exists — it
*wants* to be dropped, not queued). **Recommend recording "not the signal, barrier stays deferred"**
with this reasoning, so the question is closed rather than re-asked next phase.

---

## 4. 🚨 The preservation passes — and the 4th category

### 4a. The three existing passes, all in `render()` (browser.ts:104-236)

All three follow one shape: **snapshot before `this.container.innerHTML = ""` (:172) → rebuild via
`this.node(vm, ...)` (:173) → restore after.**

| Pass | Snapshot | Restore | Keyed by |
|---|---|---|---|
| **Focus + caret** | :111-114 | :187-197 | element `id` |
| **Scroll** (element + window) | :116-130 | :199-202, :220 | element `id` |
| **`<details>` open** | :146-157 | :222-235 | `data-section-key` (base + ordinal) |
| *(follow-tail — a scroll variant)* | :132-144 | :204-214 | document-order ordinal |

Focus snapshot (:111-114):

```typescript
    const active = document.activeElement as HTMLInputElement | HTMLTextAreaElement | null;
    const focusId = active?.id || null;
    const selStart = active?.selectionStart ?? null;
    const selEnd = active?.selectionEnd ?? null;
```

Details snapshot (:151-157) + restore (:228-233):

```typescript
    const openMap = new Map<string, boolean>();
    this.container.querySelectorAll<HTMLDetailsElement>("[data-section-key]").forEach(el => {
      const key = el.dataset.sectionKey;
      if (key != null) openMap.set(key, el.open);
    });
    this.detailsOpenSnapshot = openMap;
    this.sectionKeyCounter = new Map();
    // ... innerHTML wipe, node() rebuild ...
    this.container.querySelectorAll<HTMLDetailsElement>("[data-section-key]").forEach(el => {
      const key = el.dataset.sectionKey;
      if (key != null && this.detailsOpenSnapshot.get(key) === true) {
        el.open = true;
      }
    });
```

**The design doc and CONTEXT are CORRECT that none of these three works for a live region.** All three
read a value off an old node and write it onto a **brand-new** node. An `aria-live` region needs the
*same DOM object* to persist so the AT's registration survives. Copying `textContent` onto a fresh node
announces nothing — exactly the silent failure §7 item 8 describes.

### 4b. ✅ But the mechanism ALREADY EXISTS — `chartInstances`

**Analog: `browser.ts:83-100` (field), `:165-185` (render hook), `:678-700` (reuse). The design doc's
D9a claim that this is "a genuinely NEW, FOURTH preservation category… not the same mechanism" is
true of focus/scroll/details — but it MISSED the chart mechanism, which is exactly this.**

The field declaration (browser.ts:83-92) — read the comment closely:

```typescript
  // Phase 12 (CHART-01/03) — live Chart.js instances keyed by a stable per-render
  // ordinal chart key. DELIBERATELY PERSISTENT across renders (NOT reset like the
  // per-render fields below): the canvas + Chart instance must SURVIVE render()'s
  // innerHTML wipe so a re-render with changed data redraws IN PLACE via
  // .update() instead of re-constructing.
  private chartInstances = new Map<string, { canvas: HTMLCanvasElement; chart: any | null; latest: any | null }>();
```

The reuse (browser.ts:678-693):

```typescript
    const existing = this.chartInstances.get(key);
    if (existing) {
      // Reuse the SAME canvas element (detached by the innerHTML wipe, not
      // destroyed) — its 2D context + drawn bitmap survive.
      wrapper.appendChild(existing.canvas);
      ...
      return;
    }
    // First render of this key: create a fresh canvas + kick the lazy loader
    const canvas = document.createElement("canvas");
    wrapper.appendChild(canvas);
    this.chartInstances.set(key, { canvas, chart: null, latest: config });
```

The mark-sweep (browser.ts:175-185):

```typescript
    // Phase 12 (CHART-03) — mark-sweep: destroy + drop any Chart instance whose
    // key was NOT rendered this pass (a ChartNode removed from the new tree), so
    // instances never leak across a long session. Swept POST-rebuild (unlike the
    // fits pre-wipe disconnect) because a persisting chart's canvas must survive
    // the innerHTML wipe to be reused for an in-place .update().
    for (const [key, entry] of this.chartInstances) {
      if (!this.chartKeysSeen.has(key)) {
        entry.chart?.destroy();
        this.chartInstances.delete(key);
      }
    }
```

And the chart key derivation (browser.ts:559-566) — the exact "stable base + per-render ordinal"
disambiguation the live region needs, itself copied from the details-section keying:

```typescript
    const baseKey = n.title ?? "vms-chart-anon";
    const ordinal = this.chartKeyCounter.get(baseKey) ?? 0;
    this.chartKeyCounter.set(baseKey, ordinal + 1);
    const key = `${baseKey}#${ordinal}`;
    this.chartKeysSeen.add(key);
```

**Assessment for the planner (asked for explicitly): the live region is a NEW preservation *category*
but NOT a new *mechanism*. Extend the `chartInstances` pattern; do not invent a fourth one.**

Concretely, the shape to copy 1:1 — call it e.g. `liveRegions`:
- `private liveRegions = new Map<string, { a: HTMLElement; b: HTMLElement; next: "a"|"b" }>()` —
  **deliberately persistent**, NOT reset per render (mirror the `chartInstances` comment verbatim,
  including the "NOT reset like the per-render fields below" warning — that comment exists because the
  next person's instinct is to reset it, and doing so silently breaks announcements).
- Key: `n.name` is already unique-ish per field and stable across renders — **simpler and better than
  the chart's title+ordinal**, because `FieldNode.name` is already the id basis at browser.ts:1285
  (`inp.id = \`vms-${n.name}\``). Use `n.name` directly; no ordinal counter needed. Note this
  divergence explicitly rather than cargo-culting `chartKeyCounter`.
- On render: `get(key)` → if present, **re-append the existing nodes** (`wrapper.appendChild(existing.a)`)
  exactly as :682 does with the canvas; else create both and `set()`.
- Mark-sweep in `render()` alongside the chart sweep at :175-185, using a per-render `liveRegionKeysSeen`
  set, so a lookup removed from the tree doesn't leak its regions forever.

**Two design-§7 requirements this pattern satisfies naturally:**
- **Item 8 (exists empty at mount):** the region is created on the *first* render of the key with empty
  `textContent`, and every later render re-appends the same node. AT registration survives.
- **Item 12 (two alternating regions):** the `{a, b, next}` value shape is why the map value is an
  object, not a bare element — same as the chart's `{canvas, chart, latest}` triple.

**Item 10 (~1400ms status debounce)** is a *third* independent timer, separate from both the ~300ms
query debounce and the lane. No analog exists for it — it is genuinely new, but it is a plain
`setTimeout` on the same object, and it is the least risky of the three.

**The D9 test** (§7 item 8 / success criterion 4) asserts **node identity**, which is exactly what the
existing chart tests already assert. See §10.

---

## 5. `viewmodel-shell-dotnet/ViewModels.cs` — the `FieldNode` record

**Analog:** `viewmodel-shell-dotnet/ViewModels.cs:696-736`

**The attribute conventions, quoted** — the real optional-bool member the task asked for (:710-712):

```csharp
    // Dropped from the wire when false (WhenWritingDefault) → absent, matching
    // the TS optional `required?` (3.3.0, F2).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Required = false,
```

and (:716-721):

```csharp
    // Forms-completeness (3.4.0). Disabled/Readonly drop their false default like
    // Required (WhenWritingDefault); Error/Help are nullable strings (WhenWritingNull).
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Disabled = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool Readonly = false,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Error = null,
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] string? Help = null,
```

**How `Options` is typed** (:714):

```csharp
    [property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)] IReadOnlyList<FieldOption>? Options = null,
```

**What to copy:**
- **`allowCustom` → `[property: JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingDefault)] bool AllowCustom = false`** —
  exactly the `Required` shape (CONTEXT + gotcha #8 both call this out; the code precedent is right here).
- **`Selected` / `Candidates` → `IReadOnlyList<LookupItem>? = null` with `WhenWritingNull`** — the
  `Options` shape verbatim. Define a `LookupItem` record next to the existing `FieldOption` record
  (find it near `FieldNode`) with `Label`/`Type` carrying `WhenWritingNull`.
- **`SearchBind` → `string?` + `WhenWritingNull`; `SearchAction` → `ActionDescriptor?` + `WhenWritingNull`** —
  the `Action` member at :713 is the exact template.
- **Positional-record + trailing-defaults ordering.** Every new member goes at the **END** of the
  parameter list with a default value — see how 3.4.0's forms-completeness batch (:716-721) and
  4.0.0's `UploadOn` (:735) were appended rather than inserted. Inserting mid-list is a source-breaking
  change for every positional-construction call site in `demo/`. **This is the additive-only rule at
  the C# level.**
- The inline `//` comment above each member group naming the version + the TS twin it mirrors. Every
  group in this record has one; match it.

**What to do differently:** nothing structural — this record is a clean template. Just don't forget the
header-comment maintainer rule in `ViewModels.cs` (cited in AGENTS.md gotcha #8): a new nullable MUST
carry `WhenWritingNull`, a new optional bool whose `false` means absent MUST carry `WhenWritingDefault`.

---

## 6. Both tree-validators — `searchAction` MUST participate in uniqueness

### 6a. TypeScript — `viewmodel-shell/src/server.ts:161-165`

```typescript
    case "field": {
      const field = node as FieldNode;
      if (field.action) recordAction(field.action, enclosingForm, out);
      return;
    }
```

**What to copy — the one-line change:**

```typescript
    case "field": {
      const field = node as FieldNode;
      if (field.action) recordAction(field.action, enclosingForm, out);
      if (field.searchAction) recordAction(field.searchAction, enclosingForm, out);
      return;
    }
```

Uniqueness semantics (server.ts:82-124): two occurrences of a name are legal **iff** they share the same
non-null enclosing `FormNode`. Both `action` and `searchAction` on the same field pass `enclosingForm`
through unchanged — so a field carrying both `action: {name:"x"}` and `searchAction: {name:"x"}` inside
one form would be *accepted* by the rule as-written (same form). **That is semantically wrong** (they are
two distinct operations) but it is consistent with how `form.submitAction` + `form.buttons[]` already
behave. Flag it, don't fix it here — it's a pre-existing property of the rule, not a Phase 21 regression.

### 6b. .NET — `viewmodel-shell-dotnet/ViewModels.cs:1263-1265`

```csharp
            case FieldNode field:
                if (field.Action is { } fieldAction) Record(fieldAction, enclosingForm, sink);
                break;
```

Same one-line addition, using the same `is { }` pattern-match idiom:

```csharp
            case FieldNode field:
                if (field.Action is { } fieldAction) Record(fieldAction, enclosingForm, sink);
                if (field.SearchAction is { } fieldSearchAction) Record(fieldSearchAction, enclosingForm, sink);
                break;
```

⚠️ **Both walkers must change in the same commit.** The v5.1 precedent is instructive: the FeatureProbe
fixture deliberately gives its breadcrumb action a unique name (`nav-crumb-probe`) *specifically to
prove the walk descends into the new node* (see the `$comment`, §7). **Do the same for
`searchAction`** — a fixture whose lookup carries `searchAction: {name:"lookup-search-probe"}` is what
makes a missed walker fail parity instead of shipping. The CONTEXT's verification-page rule (the
fetch-shim must run `buildVm` through the REAL validator) exists for exactly this class of miss.

---

## 7. `parity/` — the FeatureProbe fixture pattern

**Analog:** `parity/fixtures/feature-probe.json` (`$comment` at :5, `steps` at :6+) and
`parity/backends.json:107-133`.

**🚨 Correcting the CONTEXT.** It says *"new parity/FeatureProbe fixtures per inputType"* and success
criterion 5 says *"a new FeatureProbe fixture per inputType."* **The shipped v5.1 nav-primitives pattern
is neither.** Read the v5.1 clause of the `$comment` verbatim:

> *"v5.1 (NAV-01/NAV-02, BreadcrumbNode + StepsNode): buildVm additionally renders a 'Navigation
> primitives' section as static view-shape — a breadcrumb whose crumbs cover the full
> omitted-vs-present matrix … **All captured by the existing GET steps, so the byte-identical diff
> covers the … wire with no new POST step.** NOTE: the CLIENT-SIDE appearance/a11y … is browser-only
> and NOT part of parity — parity proves only that the two nodes serialize identically across
> backends."*

**The actual pattern for a new node/field:**
1. **No new fixture file. No `backends.json` change.** `dotnet-probe`/`bun-probe`/`node-probe` already
   register `"fixtures": ["feature-probe", "feature-probe-envelope"]` (backends.json:115, 125, and the
   node-probe entry). Nothing to add.
2. **Add the new view-shape to `buildVm` in all THREE probe backends** — `demo/FeatureProbe/AspNetCore`
   (C#), `demo/FeatureProbe-bun/server.ts` (bun **and** node share this file per backends.json:129).
   The existing GET steps (`initial`, `fresh-*`) capture it automatically and byte-diff it.
3. **Append a clause to the `$comment`** in the established voice: what was added, **which fields prove
   omitted-vs-present**, the unique action name proving the walker descends, and a closing **`NOTE:`
   naming what is browser-only and explicitly NOT parity-tested.**
4. A new POST step is added **only** when the feature changes a *response*, not a view-shape (see
   `trigger-toast`, and `tbl-page-jump-valid`/`tbl-page-jump-clamp`).

**What to copy for Phase 21** — the omitted-vs-present matrix is the whole point:
- a `lookup` with `selected` **present** (a preselected value, **the headline proof — success criterion 1**)
  and `candidates` **absent**;
- a `lookup` with `allowCustom` **omitted** (proves absent, the `WhenWritingDefault` bool) and one with
  `allowCustom: true` (proves the literal JSON boolean);
- a `selected` entry with `label` **omitted** (D5, label == value — the free-form-tag case) and one with
  `label` + `type` present (D6);
- a `lookup-multiple` with `selected` holding 2 entries and `bind` a string array;
- a `searchAction` with a **unique** name (`lookup-search-probe`) proving the uniqueness walk descends
  into `FieldNode.searchAction` (§6).

**The `NOTE:` clause to write** (following the v5.0/v5.1/Phase-14 precedent exactly — Phase 14's is the
closest, since it also gated a client-only lane):

> *NOTE: the CLIENT-SIDE debounce, popup/listbox, chips, live-region announcements, and the
> non-blocking lane's coalescing/epoch behavior are browser-only and NOT part of parity — parity proves
> only that the lookup wire serializes identically across backends.*

**Nothing here has no analog.** This is the single lowest-risk task in the phase.

---

## 8. `viewmodel-shell/styles/default.css`

### 8a. `.vms-field__*` structure — analog `default.css:508-586`

```css
.vms-field__label { font-size: var(--vms-text-sm); color: var(--vms-text-muted); }
.vms-field__input { /* :509 — the shared control box */ }
.vms-field__input:focus { /* :537 */ }
.vms-field__help  { font-size: var(--vms-text-sm); color: var(--vms-text-muted); }
.vms-field__error { font-size: var(--vms-text-sm); color: var(--vms-error); }
.vms-field--error .vms-field__input { border-color: var(--vms-error); }
.vms-field--disabled .vms-field__input { /* :554 */ }
```

BEM: `.vms-field` block, `__element` for parts, `--modifier` for state. `.vms-field--checkbox` (:578)
is the precedent for **an inputType-specific layout modifier** — the lookup's chip row and popup should
follow as `.vms-field--lookup`, `.vms-field__chips`, `.vms-field__popup`, `.vms-field__option`.

Also note `.vms-field--code` uses **both** a wrapper modifier and an element modifier
(`.vms-field__input--code`, :567) — precedent for a lookup that needs both.

### 8b. `.vms-badge` — the chip analog, `default.css:1141-1185`

```css
.vms-badge {
  --_badge-tone: var(--vms-text-muted);
  display: inline-flex;
  align-items: center;
  /* Hug content in ANY parent layout. A badge is semantically inline, but as a flex
     item it is BLOCKIFIED (inline-flex → flex) and a stack section's align-items:stretch
     would then stretch it to full width. Giving it a definite cross-size (fit-content)
     opts out of that stretch … */
  width: fit-content;
  vertical-align: middle;
  gap: var(--vms-space-2xs);
  font-size: var(--vms-text-xs);
  font-weight: 600;
  line-height: 1;
  padding: 0.2em 0.6em;
  border-radius: 999px;
  white-space: nowrap;
  /* default (no tone, no emphasis): subtle neutral tint pill. */
  background: color-mix(in srgb, var(--_badge-tone) 16%, var(--vms-surface));
  color: var(--_badge-tone);
  border: 1px solid transparent;
}
.vms-badge--danger  { --_badge-tone: var(--vms-error); }
.vms-badge--warning { --_badge-tone: var(--vms-warning); }
.vms-badge--success { --_badge-tone: var(--vms-success); }
.vms-badge--info    { --_badge-tone: var(--vms-info); }
```

**The `--_badge-tone` private-var indirection is the technique to copy.** One private custom property
holds the working color; tone modifiers reassign *only that var*; the fill, text, and border all derive
from it. **A new tone requires one line, and every theme recolors automatically** because
`--vms-error`/`--vms-surface` are theme-owned. That is exactly the "chip recolors per-theme
automatically" property the task asks about.

**`color-mix(in srgb, var(--_badge-tone) 16%, var(--vms-surface))` is the polarity-adaptive knockout
CONTEXT recommends** — mixing *toward `--vms-surface`* (not toward white/black) means the tint auto-adapts
to light and dark themes with **zero per-theme deepening**. It's used 18× in this file; it's the house
technique. **Use it for the chip fill.**

**What to copy:** `--_chip-tone` + `color-mix(… , var(--vms-surface))` + `border-radius: 999px` +
`white-space: nowrap` (v1) and the `width: fit-content` blockification fix — **the chip lives inside a
flex chip-row, so it will hit the identical stretch bug the badge comment (:1145-1152) documents.**
That comment was written in 5.1.2 for exactly this failure mode; read it before writing the chip.

**What to do differently:**
- **`white-space: nowrap` conflicts with design §7 item 33** (*"chip and option text must wrap without
  truncation"* — GOV.UK's 12× magnification finding). The badge is a short status word; a chip holds a
  person's name. **Do NOT copy `nowrap` onto the chip.** This is a real, easy-to-miss divergence.
- **The chip is interactive** (contains a real remove `<button>`, §7 item 24) — the badge is inert.
  It needs focus-visible styling on the remove button; `.vms-field__input:focus` (:537) is the token
  precedent.
- **🚨 AA-contrast (CONTEXT):** the fixed 13-pair `check:aa-contrast` gate does NOT auto-cover the chip
  fg/bg pair. The `16%` mix ratio is tuned for a **6px badge on a page surface**; a chip on the field's
  input background is a *different* backdrop. **Hand-compute across default + all 12 themes.** Do not
  assume inheriting the badge's ratio inherits its contrast.

---

## 9. `viewmodel-shell/src/tui.tsx` — TUI degradation

**⚠️ Path correction: the file is `src/tui.tsx`, not `src/tui.ts`.**

**Analog:** `tui.tsx:1881-1900` (the select branch), with the contract stated at :1794-1807.

The header contract (tui.tsx:1794-1807):

```
// Real OpenTUI input/textarea/select wired to the adapter's field state.
// Layout per inputType:
//   select / select-multiple  → <text label> + <select options=[...] >.
//                                B3 ships single-select; select-multiple semantics
//                                are deferred (no native OpenTUI multi-select …
```

The branch (tui.tsx:1882-1893):

```tsx
  if (node.inputType === "select" || node.inputType === "select-multiple") {
    const options = (node.options ?? []).map((o) => ({ ... }));
    let selectedIndex = options.findIndex((o) => String(o.value) === currentValue);
    if (selectedIndex < 0) selectedIndex = 0;
    ...
        <select
```

**The pattern for a new inputType — and the precedent that matters most:** `select-multiple`
**degrades to single-select** and says so in a comment, rather than failing or faking it. `hidden`
returns `null` (:1839). This is the framework's "honest, slightly imperfect rendering is simply
accepted" principle in code (AGENTS.md philosophy #4), and the TUI is `@experimental` besides.

**What to copy:** add a `lookup`/`lookup-multiple` branch that degrades to a **plain text input bound
to `bind`**, plus a `<text>` line rendering `selected` labels. Update the :1794-1807 header comment
listing per-inputType layout — it's a maintained contract, not decoration.

**What to do differently, and why:** **do NOT implement the debounced search in the TUI.** The live
region, popup, chips, and roving tabindex are all browser/DOM concepts with no OpenTUI analog, and
§7's whole a11y spec is a screen-reader contract that means nothing in a terminal. An agent or terminal
user sets the id directly via `bind` — which is precisely design §6's point ("an agent sets `bind` to
the id and never touches the search UI"). **The lookup degrading to a text-id input in the TUI is the
architecture working as designed, not a gap.** Say so in the comment.

---

## 10. Tests

### 10a. The live-query race tests — analog `viewmodel-shell/test/nonblocking-dispatch.test.ts`

**This file is the exact style the phase's four races need. Copy its harness wholesale.** Its header
states the reason it exists (:1-9):

```typescript
// Unlike busy.test.ts's `stubFetch` (which auto-resolves in FIFO order),
// these tests need MANUAL, OUT-OF-ORDER control over exactly when each
// dispatch's response arrives — so the fetch mock here defers every
// post-load call until the test explicitly resolves it.
```

The harness (`makeControllableFetch`, :36-53) — first call (the `load()` GET) resolves immediately,
**every subsequent call parks a deferred resolver** the test resolves by hand:

```typescript
function makeControllableFetch(): { fetchMock: ReturnType<typeof vi.fn>; deferreds: Deferred[] } {
  const deferreds: Deferred[] = [];
  let callCount = 0;
  const fetchMock = vi.fn(() => {
    callCount++;
    if (callCount === 1) {
      return Promise.resolve(new Response(JSON.stringify({ vm: emptyVm, state: {}, ok: true }), { ... }));
    }
    return new Promise<Response>((resolve) => { deferreds.push({ resolve }); });
  });
  return { fetchMock, deferreds };
}
```

**This is what makes an interleaving scriptable**: fire dispatch A, fire dispatch B, then
`resolveDeferred(deferreds[1], …)` *before* `deferreds[0]` — an out-of-order response, deterministically.

**Map CONTEXT's four required races onto the existing describe blocks — each already has a working twin:**

| Phase 21 race (CONTEXT D4) | Existing analog to copy |
|---|---|
| user-action-races-background | `nonblocking-dispatch.test.ts:71-135` (NBA-01, both directions) |
| background-resolves-first | `:258-292` (CR-02 — "applies the blocking response even though a later-fired non-blocking one resolved first") |
| rapid-fire-supersede | `:137-169` (NBA-02 — "three rapid non-blocking triggers produce exactly one coalesced re-fire carrying the latest action") |
| stale-arrives-late | `:170-200` (NBA-03 — "a late non-blocking response that resolves after a newer blocking one is discarded") |

**Planner note:** these four already pass **for the lane**. The new tests must drive them **through
`field()`'s search path** (adapter → debounced dispatch → lane), not by calling `shell.dispatch()`
directly — otherwise they re-test Phase 14 and prove nothing about Phase 21. **This is the difference
between a green suite and CONTEXT's "a green suite that doesn't script the interleaving proves
NOTHING."** Fake timers (`vi.useFakeTimers`) will be needed to drive the debounce deterministically —
**no existing test in this suite uses fake timers with the deferred-fetch harness**, so that
combination is the one genuinely new testing technique in the phase. Flagging it as the sharpest edge
in the test work: `vi.advanceTimersByTime` + un-awaited promises interleave subtly.

### 10b. The jsdom adapter-test pattern — analogs `src/adapter.test.ts`, `test/section-collapsible.test.ts`, `test/browser-scroll.test.ts`

For the **D9 node-identity test** (success criterion 4), the closest analog is the chart suite
(`test/chart.test.ts`) — it is the only existing suite that asserts a node **survives** a re-render,
which is precisely the assertion §7 item 8 needs:

```typescript
// the shape to write:
const first = container.querySelector('[data-vms-live="lookup-name"]');
adapter.render(vmB, onAction, sa);          // full rebuild — innerHTML wipe
const second = container.querySelector('[data-vms-live="lookup-name"]');
expect(second).toBe(first);                  // ← IDENTITY (toBe), not toEqual
```

**`expect(second).toBe(first)` — reference identity — is the entire test.** `toEqual` would pass on a
freshly-created node and prove nothing; that is the silent failure D9 exists to catch. Say it in a
comment, because the next person will "simplify" it to `toEqual`.

### 10c. .NET serialization — absent-vs-null

**Analogs:** `viewmodel-shell-dotnet/Tests/FieldBindSerializationTests.cs:29`,
`ActionDescriptorBlockingSerializationTests.cs:49`, `FillSerializationTests.cs:39,57`.

The assertion idiom is uniform across all four:

```csharp
        Assert.DoesNotContain("\"bind\"", json);        // FieldBindSerializationTests.cs:29
        Assert.DoesNotContain("\"blocking\"", json);    // ActionDescriptorBlockingSerializationTests.cs:49
        Assert.DoesNotContain("\"fill\"", json);        // FillSerializationTests.cs:39
```

`ActionDescriptorBlockingSerializationTests.cs` is the **best** template — it covers an optional bool
with the `WhenWritingDefault` posture, which is exactly `allowCustom`. Its header (:6) states the
contract: *"optional `ActionEvent.blocking?: boolean` being absent when unset."*

**What to copy:** a `LookupSerializationTests.cs` proving —
- `AllowCustom = false` ⇒ **no** `"allowCustom"` in the JSON (the `WhenWritingDefault` proof);
- `AllowCustom = true` ⇒ `"allowCustom":true` present;
- `Selected = null` / `Candidates = null` ⇒ **absent** (`WhenWritingNull`);
- a `LookupItem` with `Label = null` ⇒ **no** `"label"` (D5 at the item level — the free-form-tag case);
- `Selected` with one entry ⇒ serializes as a **JSON array**, not an object (the deliberate
  always-array decision).

`NavNodeSerializationTests.cs` (the v5.1 twin of this work) is the closest structural precedent for a
whole-feature serialization suite — read it for file layout.

⚠️ Don't forget `global using Xunit;` in `GlobalUsings.cs` (AGENTS.md gotcha #7) — already present in
this project, but the file must be added to it if new usings are needed.

---

## Shared Patterns

### The `Omitted = <default>` TSDoc closer
**Source:** `index.ts:358-361`, `:428-432`, `:436`, `:443`
**Apply to:** every new optional field on `FieldNode` (TS side).
Every optional field's TSDoc in `index.ts` ends by naming what absence means. No exceptions in the file.

### The version + twin-reference inline comment (.NET)
**Source:** `ViewModels.cs:710-712`, `:716-721`, `:729-735`
**Apply to:** every new member group on the .NET `FieldNode`.
Each group names its version and the TS field it mirrors — this is what makes drift reviewable.

### Per-render reset vs. deliberate persistence (browser.ts)
**Source:** `browser.ts:77-100` (the field block), `:159-171` (the reset hooks)
**Apply to:** the live-region map.
The file has two explicit categories, and the comments call the distinction out by name:
`fitsObservers`/`sectionKeyCounter`/`chartKeyCounter`/`chartKeysSeen` are **reset at the top of every
render**; `chartInstances` is **deliberately persistent + mark-swept**. The live-region map is the
**second** kind. The `chartInstances` comment (:84-85) even pre-warns: *"DELIBERATELY PERSISTENT across
renders (NOT reset like the per-render fields below)"*. Copy that warning verbatim in spirit.

### `warnOnce` dev diagnostics
**Source:** `browser.ts:61-65` (`diagWarned`), used at `:1076-1080` (`[vms:no-bind]`), `:1207-1211`
(`[vms:orphan-file]`), `:1222-1228` (`[vms:type-mismatch]`)
**Apply to:** lookup misconfigurations that fail silently.
The house pattern for "this renders but does nothing useful". Candidates worth a diagnostic:
a `lookup` with `searchAction` but **no** `searchBind` (the query is dispatched but the server can never
see it — a silent dead typeahead, and structurally invisible); `selected` non-empty but `bind` empty
(view/state disagree — the D1 invariant violated by the app). The existing `[vms:no-bind]` check at
:1075 already fires for a bind-less lookup once the inputType is added to the value-bearing list — free.

---

## No Analog Found

**Only three items in the entire phase lack a codebase analog — all three are small, and none is the
scary one:**

| Item | Role | Why no analog | Risk |
|---|---|---|---|
| **~1400ms status-announcement debounce** (§7 item 10) | renderer timer | A third independent timer (distinct from the ~300ms query debounce and the lane). Nothing in the codebase debounces anything today. | **Low** — a plain `setTimeout` on the persistent live-region object. The *object* has an analog (`chartInstances`); only the timing is new. |
| **Roving tabindex across chips** (§7 items 26, 29) | renderer a11y | VMS has one roving-tabindex-ish precedent — `TableRow.action` sets `tabindex=0` + `role="button"` — but nothing manages focus **across a set** or restores focus **after removing the focused element**. `<details>`/focus restore is by id, not by set position. | **Medium** — §7 item 29's next→previous→input rule (never `<body>`) is easy to get wrong and, per GOV.UK, it is one of the two failures that retired their component. Needs its own jsdom test. |
| **jsdom fake-timers + deferred-fetch, combined** | test technique | `nonblocking-dispatch.test.ts` uses deferred fetch with **real** timers; other suites use fake timers without deferred fetch. The lookup needs both at once. | **Medium** — see §10a. This is the sharpest edge in the test work. |

**Explicitly NOT a gap (the design doc and CONTEXT both assert otherwise — they are wrong on this
one point):** the "genuinely NEW, FOURTH preservation category" for the live region. The *category* is
new; the *mechanism* ships today as `chartInstances`. See §4b.

---

## Metadata

**Analog search scope:** `viewmodel-shell/src/`, `viewmodel-shell/test/`, `viewmodel-shell/styles/`,
`viewmodel-shell-dotnet/`, `parity/`
**Files scanned:** 24 (read: `index.ts`, `browser.ts`, `server.ts`, `tui.tsx`, `ViewModels.cs`,
`default.css`, `nonblocking-dispatch.test.ts`, `feature-probe.json`, `backends.json`,
`.planning/design/lookup-field.md`, `21-CONTEXT.md`)
**Pattern extraction date:** 2026-07-16
