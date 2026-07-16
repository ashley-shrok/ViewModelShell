// LookupVerification — the v5.2 Lookup / remote-search reference field tailnet
// sign-off page (LOOK-03 / LOOK-06 / LOOK-07, Plan 21-09).
//
// A real-bundle, real-CSS human-verification harness for the two new inputTypes
// shipped in Phase 21 — `lookup` + `lookup-multiple` — plus Enter-to-search.
// It drives the REAL shipped viewmodel-shell
// browser bundle (Vite-aliased to ../../viewmodel-shell/src) and the REAL
// shipped default.css + all 12 themes (served verbatim below), so Ashley's
// visual + interactive sign-off is meaningful — nothing here is hand-mocked.
//
// 🚨 THE BANKED LESSON — WHY THIS IS A REAL BACKEND AND NOT A FETCH SHIM.
// An in-page reducer/fetch-shim that hands `buildVm` output straight to
// `adapter.render` BYPASSES SERVER-SIDE VALIDATION and therefore ACCEPTS TREES
// THE REAL SERVER REJECTS. That is not hypothetical: it has already happened
// here — a tree with a duplicate action name (a HARD validator failure) sailed
// through a mock and then 500'd the moment it hit a real controller. This phase
// is squarely in that blast radius: it adds `searchAction`, a whole new
// action-bearing field, plus two validator descents.
// So this page uses the REAL `createAction` from
// `@ashley-shrok/viewmodel-shell/server`, which itself runs the shipped
// `validateActionNames` + `validateSectionAction` over every response tree —
// the real code path, not a lookalike. The GET path does not flow through
// `createAction`, so it calls the SAME shipped validators explicitly below
// (see `validated()`). Do NOT "simplify" either call away.

import {
  UnknownActionError,
  createAction,
  createAgentSkillHandler,
  validateActionNames,
  validateSectionAction,
  type LookupItem,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

// ─── The directory (the "database table" a lookup describes a row of) ─────────
//
// ~120 people: large enough that (a) the round trip is perceptible against the
// simulated latency, and (b) the D7 cap actually fires on a broad query.

const FIRST = [
  "Sally", "Omar", "Priya", "Dmitri", "Naomi", "Kwame", "Ingrid", "Hiro",
  "Yusuf", "Elena", "Tobias", "Marguerite", "Chen", "Aroha", "Bjorn", "Fatima",
  "Lorenzo", "Anneke", "Rafael", "Sunita",
];
const LAST = [
  "Omer", "Okonkwo", "Lindqvist", "Vasquez", "Nakamura", "Petrova", "Abadi",
  "Fitzgerald", "Mwangi", "Sorensen", "Delacroix", "Havelock", "Ramirez",
  "Bergstrom", "Achterberg",
];
const TEAMS = ["Platform", "Billing", "Support", "Security", "Data"];

interface Person {
  id: string;
  name: string;
  team: string;
}

const DIRECTORY_SIZE = 120;

const DIRECTORY: Person[] = (() => {
  // Walk the 20x15 = 300 first/last combinations with a stride CO-PRIME to 300,
  // so the first 120 are all DISTINCT and consecutive entries share neither name.
  // Both halves of that matter and both were bugs found on this page:
  //   - a naive nested loop yields "Omar Omer", "Priya Omer", … (fake-looking,
  //     and every surname query matches a contiguous block);
  //   - striding first/last independently (n%20, n*7%15) has period lcm(20,15)
  //     = 60, so 120 people silently contain EVERY PAIR TWICE — two candidates
  //     rendering the identical name is precisely the confusion a picker
  //     verification page must not manufacture.
  const combos = FIRST.length * LAST.length; // 300
  const STRIDE = 7; // gcd(7, 300) === 1  => visits 120 distinct combos
  const out: Person[] = [];
  const seen = new Set<string>();
  for (let n = 0; n < DIRECTORY_SIZE; n++) {
    const k = (n * STRIDE) % combos;
    const name = `${FIRST[k % FIRST.length]} ${LAST[Math.floor(k / FIRST.length)]}`;
    seen.add(name);
    out.push({ id: `u-${String(401 + n)}`, name, team: TEAMS[n % TEAMS.length] });
  }
  // Fail loudly at startup rather than ship a directory with twins: a duplicate
  // display name here would make the candidate list ambiguous for no reason.
  if (seen.size !== out.length) {
    throw new Error(
      `Directory generator produced ${out.length - seen.size} duplicate name(s) — ` +
        "the STRIDE is no longer co-prime with FIRST.length * LAST.length.",
    );
  }
  return out;
})();

// The headline's preselected reference. Pinned by ID so the point is unmissable:
// the page loads knowing ONLY "u-401", and the label is resolved server-side and
// carried on the NODE.
const OWNER_ID = "u-401";

function personById(id: string): Person | undefined {
  return DIRECTORY.find((p) => p.id === id);
}

/** Server-side label resolution — the ONLY place a label is ever produced.
 *  D1: the id is STATE (it round-trips, it is authoritative); the label is VIEW
 *  (recomputed every render, server→client only, never trusted back). */
function toItem(p: Person): LookupItem {
  return { value: p.id, label: p.name, type: "user" };
}

/** Resolve ids → items for `selected`. Note this reads the DIRECTORY, never
 *  `candidates` — that is the whole anti-trap: resolving a selected label out of
 *  the candidate list means "filter the list" and "forget the selection" are the
 *  SAME operation, which is precisely how Ant Design renders a raw database id. */
function selectedItems(ids: string[]): LookupItem[] {
  return ids
    .map(personById)
    .filter((p): p is Person => p !== undefined)
    .map(toItem);
}

const CAP = 8;

interface SearchResult {
  items: LookupItem[];
  /** Set when the query matched more than CAP — D7: any cap is VISIBLE in the
   *  tree. ServiceNow's silent 15-of-250 truncation is the anti-pattern. */
  overCap?: number;
  /** Set when the query matched nothing (distinct from over-cap AND from error). */
  noMatches?: boolean;
}

/** @param mruOnEmpty OPEN-6 — the empty-query path DOES reach the server, so an
 *  app MAY supply a most-recently-used list for an empty box. Opt-in per field,
 *  and deliberately OFF for the headline field: an MRU list would put the
 *  preselected person INTO `candidates` on load, which would let a naive
 *  candidate-resolving implementation render the right label BY ACCIDENT and
 *  quietly destroy the proof. The headline must load with `candidates` EMPTY. */
function searchDirectory(query: string, mruOnEmpty = false): SearchResult {
  const q = query.trim().toLowerCase();
  if (q === "") return { items: mruOnEmpty ? DIRECTORY.slice(0, 5).map(toItem) : [] };
  const hits = DIRECTORY.filter(
    (p) => p.name.toLowerCase().includes(q) || p.team.toLowerCase().includes(q),
  );
  if (hits.length === 0) return { items: [], noMatches: true };
  if (hits.length > CAP) return { items: [], overCap: hits.length };
  // D12 — the app's order is meaningful and the renderer never re-sorts it.
  return { items: hits.map(toItem) };
}

/** The deliberate failure trigger for the OPEN-5 search-error differentiator. */
function isFailingQuery(query: string): boolean {
  return query.trim().toLowerCase().includes("fail");
}

/** §4a's CURATED directory — a fixed, server-owned label set you PICK from and
 *  cannot invent into. It exists to sit beside §4b's free-form tags over the
 *  SAME domain (labelling a ticket), because that contrast IS D15: one act per
 *  field, DECLARED. Same control, same domain, two different acts. */
const CATEGORIES: LookupItem[] = [
  { value: "cat-billing", label: "Billing" },
  { value: "cat-data-loss", label: "Data loss" },
  { value: "cat-integration", label: "Integration" },
  { value: "cat-perf", label: "Performance" },
  { value: "cat-security", label: "Security" },
  { value: "cat-ui", label: "UI / rendering" },
];

function categoryById(id: string): LookupItem | undefined {
  return CATEGORIES.find((c) => c.value === id);
}

/** §4a — the same D1 rule as the people directory: `selected` resolves out of
 *  CATEGORIES (the server's own id space), never out of `candidates`. */
function searchCategories(query: string): LookupItem[] {
  const q = query.trim().toLowerCase();
  if (q === "") return [];
  return CATEGORIES.filter((c) => (c.label ?? c.value).toLowerCase().includes(q));
}

// ─── State ────────────────────────────────────────────────────────────────────

interface LookupState {
  // 1 — the headline: a reference already set at load, with no search performed.
  owner: string;
  ownerQuery: string;
  // 2 — search-from-cold, exercising the D7 cap + the no-matches signal.
  assignee: string;
  assigneeQuery: string;
  // 3 — lookup-multiple chips.
  watchers: string[];
  watchersQuery: string;
  // 4a — a DIRECTORY PICKER: search, no invention (searchAction, no allowCustom).
  category: string;
  categoryQuery: string;
  // 4b — a TAGS FIELD: invention, no directory (allowCustom, no searchAction).
  tags: string[];
  tagsQuery: string;
  // 5 — the always-broken directory (the search-error differentiator).
  brokenPick: string;
  brokenQuery: string;
}

function initialState(): LookupState {
  return {
    // 🚨 THE HEADLINE. The state holds an ID and NOTHING ELSE. No label, no
    // candidates, no search has run. If the label renders, the design works.
    owner: OWNER_ID,
    ownerQuery: "",
    assignee: "",
    assigneeQuery: "",
    watchers: ["u-403", "u-407"],
    watchersQuery: "",
    category: "",
    categoryQuery: "",
    tags: ["urgent", "regression"],
    tagsQuery: "",
    brokenPick: "",
    brokenQuery: "",
  };
}

// ─── View (pure function of state) ────────────────────────────────────────────

function note(value: string): ViewNode {
  return { type: "text", value, style: "muted" };
}

/** The cap / no-matches signal — D7: the app renders a TextNode, exactly as the
 *  canonical table workflow does. There is no wire field for this and there does
 *  not need to be one. The three zero-candidate paths each carry a DISTINCT
 *  signal so they can never be confused with a broken render:
 *    over cap   -> "Refine your search — N matches, max is CAP" (warning tone)
 *    no matches -> "No people match ..." (muted)
 *    error      -> FieldNode.error (role=alert, danger) — set by the caller.  */
function capNote(r: SearchResult, query: string): ViewNode[] {
  if (r.overCap !== undefined) {
    return [{
      type: "text",
      value: `Refine your search — ${r.overCap} matches, max is ${CAP}.`,
      tone: "warning",
    }];
  }
  if (r.noMatches) return [note(`No people match “${query}”.`)];
  return [];
}

function buildVm(state: LookupState): ViewNode {
  // The headline field gets NO MRU on an empty query — see searchDirectory().
  const ownerSearch = searchDirectory(state.ownerQuery);
  // Section 2 is where the OPEN-6 MRU is demonstrated: nothing is selected
  // there, so an MRU list cannot muddy any proof.
  const assigneeSearch = searchDirectory(state.assigneeQuery, true);
  const watchersSearch = searchDirectory(state.watchersQuery);
  // 4a — the curated-category directory picker (search, no invention).
  const categorySearch = searchCategories(state.categoryQuery);

  return {
    type: "page",
    title: "Lookup / remote-search reference field — Tailnet Verification",
    width: "wide",
    children: [
      {
        type: "text",
        value: "v5.2 Lookup Field — Verification",
        style: "heading",
      },
      note(
        "Rendered by the real shipped viewmodel-shell bundle + the real shipped " +
        "default.css + a real theme (swap it with the picker at the top). Every " +
        "response tree below is run through the SHIPPED tree validator before it " +
        "leaves this server.",
      ),

      // ── 1. THE HEADLINE ───────────────────────────────────────────────────
      {
        type: "section",
        heading: "1. The headline — a reference already set, with NO search",
        variant: "card",
        children: [
          note(
            `This form loaded holding the id “${OWNER_ID}” and nothing else. No ` +
            "search has run, and this field's candidate list is EMPTY " +
            `(candidates: ${ownerSearch.items.length}) — yet the field shows the ` +
            "NAME. That is the whole design: the label rides on the node " +
            "(server→client, recomputed every render); it is never resolved out " +
            "of the candidate list. A picker that resolves labels from candidates " +
            "renders a raw database id right here, on cold start. (The empty list " +
            "is deliberate: an MRU list on load would contain the selected person " +
            "and let a broken implementation look correct by accident.)",
          ),
          {
            type: "field",
            name: "owner",
            inputType: "lookup",
            label: "Ticket owner",
            bind: "owner",
            searchBind: "ownerQuery",
            placeholder: "Search people…",
            selected: selectedItems(state.owner ? [state.owner] : []),
            candidates: ownerSearch.items,
            searchAction: { name: "search-owner" },
          },
          ...capNote(ownerSearch, state.ownerQuery),
          note(
            "🚨 THE ANTI-TRAP: type “Petrova” (or any query that excludes Sally " +
            "Omer). The candidate list no longer contains the selection — and the " +
            "label is STILL shown. Filtering the list must never mean forgetting " +
            "the selection. Press Escape twice to clear the selection.",
          ),
          note(`bind holds: “${state.owner || "(cleared)"}”`),
        ],
      },

      // ── 2. Live search from cold + the D7 cap ─────────────────────────────
      {
        type: "section",
        heading: "2. Enter-to-search — an ordinary blocking action, and the visible cap",
        variant: "card",
        children: [
          note(
            "Starts empty. Type, then press ENTER to search — typing alone " +
            "dispatches nothing (searchAction is an ORDINARY BLOCKING action, " +
            "exactly like a table's column filter; D4/D11 reversed). Nothing " +
            "re-renders under your cursor, because the only re-render is the one " +
            `you asked for. This directory holds ${DIRECTORY_SIZE} people and ` +
            `caps at ${CAP} results. Try “a” (over cap), then “Nakamura” (a real ` +
            "hit), then “zzzz” (no matches) — each is a DIFFERENT, unambiguous " +
            "signal. Press Enter on an EMPTY box for the most-recently-used path.",
          ),
          {
            type: "field",
            name: "assignee",
            inputType: "lookup",
            label: "Assignee",
            bind: "assignee",
            searchBind: "assigneeQuery",
            placeholder: "Search people…",
            selected: selectedItems(state.assignee ? [state.assignee] : []),
            candidates: assigneeSearch.items,
            searchAction: { name: "search-assignee" },
          },
          ...capNote(assigneeSearch, state.assigneeQuery),
          note(
            "An EMPTY box still reaches the server (OPEN-6), so the first few " +
            "names stand in for a most-recently-used list — clear the box to see it.",
          ),
        ],
      },

      // ── 3. lookup-multiple — the chips ────────────────────────────────────
      {
        type: "section",
        heading: "3. lookup-multiple — the chips",
        variant: "card",
        children: [
          note(
            "Loads with two chips already set — again from ids alone, with no " +
            "search. Add more by searching. Remove one with the mouse (the ✕), " +
            "and one with the keyboard: Tab to a chip, arrow between them, Enter/" +
            "Space to remove. Focus must land somewhere sensible (the next chip, " +
            "else the previous, else the input) — never the top of the page. " +
            "Backspace in the EMPTY input is two-step: the first press highlights " +
            "and announces the last chip, the second removes it.",
          ),
          {
            type: "field",
            name: "watchers",
            inputType: "lookup-multiple",
            label: "Watchers",
            bind: "watchers",
            searchBind: "watchersQuery",
            placeholder: "Search people…",
            selected: selectedItems(state.watchers),
            candidates: watchersSearch.items,
            searchAction: { name: "search-watchers" },
          },
          ...capNote(watchersSearch, state.watchersQuery),
          note(`bind holds: [${state.watchers.map((w) => `“${w}”`).join(", ") || "—"}]`),
        ],
      },

      // ── 4. D15 — the TWO supported shapes, side by side ────────────────────
      //
      // 🚨 THIS SECTION USED TO DECLARE ONE FIELD WITH allowCustom + searchAction
      // TOGETHER. That combination is UNSUPPORTED as of D15 and now warns
      // [vms:lookup-ambiguous-enter]: one Enter cannot both invent a value and
      // run a search ("urgent" + Enter — create the tag, or search for it?), and
      // NO precedence serves both. So the page exercises what actually SHIPS: the
      // two shapes, over the SAME domain (labelling a ticket), so the contrast is
      // the lesson — same control, one DECLARED act each, Enter unambiguous in
      // both.
      {
        type: "section",
        heading: "4. D15 — one Enter, one declared act",
        variant: "card",
        children: [
          note(
            "Enter carries a dispatch, and this control could declare more than " +
            "one act on it. D15 settles that by SHAPE rather than by precedence: " +
            "declare a search OR an invention, never both. Both fields below " +
            "label a ticket; they differ only in the act they declare, and that " +
            "is exactly the point. (Declaring both is not silently half-served — " +
            "it is a console error, because a combination that quietly half-works " +
            "is the failure principle 8 forbids.)",
          ),

          // 4a — DIRECTORY PICKER: search, NO invention.
          {
            type: "section",
            heading: "4a. Directory picker — searchAction, NO allowCustom",
            children: [
              note(
                "A CURATED label set: you pick, you cannot invent. Type “i” and " +
                "press Enter — Enter SEARCHES (Integration, UI / rendering); " +
                "arrow+Enter accepts. Typing a category that does not exist and " +
                "pressing Enter creates NOTHING — it searches and finds nothing. " +
                "That refusal is the declared act doing its job.",
              ),
              {
                type: "field",
                name: "category",
                inputType: "lookup",
                label: "Category (curated)",
                bind: "category",
                searchBind: "categoryQuery",
                placeholder: "Search categories…",
                // D1 — resolved from CATEGORIES (the server's id space), NEVER
                // from `candidates`. Same anti-trap rule as the people fields.
                selected: state.category
                  ? [categoryById(state.category)].filter((c): c is LookupItem => c !== undefined)
                  : [],
                candidates: categorySearch,
                searchAction: { name: "search-category" },
                // NO allowCustom — declaring it here would warn and be ignored.
              },
              ...(state.categoryQuery.trim() !== "" && categorySearch.length === 0
                ? [note(`No category matches “${state.categoryQuery}” — and Enter will not invent one.`)]
                : []),
              note(`bind holds: ${state.category ? `“${state.category}”` : "—"}`),
            ],
          },

          // 4b — TAGS FIELD: invention, NO directory.
          {
            type: "section",
            heading: "4b. Tags field — allowCustom, NO searchAction",
            children: [
              note(
                "The SAME control with allowCustom:true and NO directory behind " +
                "it — a free-form tags input falls out with zero renderer " +
                "special-casing (D3). Type a new value and press Enter to create " +
                "a tag; here Enter INVENTS, unambiguously, because nothing else " +
                "claims it. Note these chips carry no label: a tag is a value " +
                "whose label IS itself, so per D5 the label is simply absent from " +
                "the wire rather than repeated.",
              ),
              {
                type: "field",
                name: "tags",
                inputType: "lookup-multiple",
                label: "Tags (free-form)",
                bind: "tags",
                searchBind: "tagsQuery",
                placeholder: "Type a tag, press Enter…",
                // D5 — label OMITTED, because it would merely repeat `value`.
                selected: state.tags.map((t) => ({ value: t })),
                allowCustom: true,
                // NO searchAction — suggestions on a tags field are DEFERRED
                // (D15), exactly as the parked `tags` design already deferred
                // them. The combo would warn and drop the invention.
              },
              note(`bind holds: [${state.tags.map((t) => `“${t}”`).join(", ") || "—"}]`),
            ],
          },
        ],
      },

      // ── 5. The search-error differentiator ────────────────────────────────
      {
        type: "section",
        heading: "5. The differentiator — a failed search is NOT “no results”",
        variant: "card",
        children: [
          note(
            "Type anything containing “fail” — this directory is deliberately " +
            "broken for those queries. You get a real ERROR (red, role=alert), " +
            "which is visibly DIFFERENT from section 2's muted “No people match”. " +
            "No surveyed library does this: react-select actively SWALLOWS fetch " +
            "errors, so a dead backend is indistinguishable from an empty result " +
            "— a direct violation of “nothing important fails quietly”. Type " +
            "something without “fail” to see it recover.",
          ),
          {
            type: "field",
            name: "brokenPick",
            inputType: "lookup",
            label: "Directory (deliberately broken on “fail”)",
            bind: "brokenPick",
            searchBind: "brokenQuery",
            placeholder: "Try: fail",
            selected: selectedItems(state.brokenPick ? [state.brokenPick] : []),
            candidates: isFailingQuery(state.brokenQuery)
              ? []
              : searchDirectory(state.brokenQuery).items,
            // OPEN-5 — a SEARCH failure reuses the `error` slot. Do not swallow it.
            error: isFailingQuery(state.brokenQuery)
              ? "Directory search failed: upstream returned 503. This is not “no results” — the query never ran."
              : undefined,
            searchAction: { name: "search-broken" },
          },
        ],
      },

      // ── 6. Themes ─────────────────────────────────────────────────────────
      {
        type: "section",
        heading: "6. Themes",
        variant: "card",
        children: [
          note(
            "Use the theme picker at the very top of the page to switch across " +
            "the shipped light default and all 12 themes. The chips must stay " +
            "readable in every one — nothing washed out or invisible. The chip " +
            "fill and the remove button's focus ring were hand-measured across " +
            "all 13 (worst 10.63:1, vs a 4.5:1 text bar and a 3:1 focus bar). " +
            "Tab to a chip's ✕ in a light theme to check the focus ring.",
          ),
        ],
      },
    ],
  };
}

// ─── The shipped validator, on the GET path too ───────────────────────────────
//
// `createAction` runs validateActionNames + validateSectionAction itself, so the
// POST path is covered by the real framework code. GET does not flow through it,
// so the SAME shipped validators run here. Throwing is the point: a tree the real
// server would reject must fail HERE, loudly, before Ashley ever sees the page —
// never render fine in a harness and 500 later in production.
function validated(vm: ViewNode): ViewNode {
  validateActionNames(vm);
  validateSectionAction(vm);
  return vm;
}

// Fail at STARTUP, not on first request: if the tree is invalid, this process
// must not come up at all.
validated(buildVm(initialState()));

// ─── Actions ──────────────────────────────────────────────────────────────────

/** Simulated directory latency. NOT padding — it is what makes the property
 *  under review OBSERVABLE. With an in-memory 120-row search the round trip is
 *  ~1ms, so the search would appear instantaneous and the reviewer could not
 *  see WHICH cadence is running. At ~350ms the Enter-to-search contract is
 *  plainly visible by eye: typing produces NOTHING (no network, no re-render),
 *  and one Enter produces exactly one visible round trip whose results land
 *  where the cursor expects them. `searchAction` is an ordinary BLOCKING action
 *  (D4/D11 reversed), so the page correctly shows its in-flight busy state for
 *  ~350ms — that lock is the dispatch guard serializing the trip, which is
 *  precisely what makes a stale response impossible. */
const SEARCH_LATENCY_MS = 350;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const actionHandler = createAction<LookupState>(async (payload) => {
  const state = payload.state;
  await sleep(SEARCH_LATENCY_MS);
  switch (payload.name) {
    // Every search action is a no-op on state: the query already round-tripped
    // via `searchBind` (keystrokes write it; Enter dispatches), and the view is
    // a pure function of state, so buildVm simply re-runs the search. There is
    // nothing else to do here.
    case "search-owner":
    case "search-assignee":
    case "search-watchers":
    // 4a's directory picker. There is deliberately no "search-tags" any more:
    // 4b declares allowCustom and therefore NO searchAction (D15).
    case "search-category":
    case "search-broken":
      break;
    default:
      throw new UnknownActionError(payload.name);
  }
  return { vm: buildVm(state), state };
});

// ─── The REAL shipped CSS (default + all 12 themes), served verbatim ──────────

const stylesDir = new URL("../../viewmodel-shell/styles/", import.meta.url);

async function serveShippedCss(pathname: string): Promise<Response | null> {
  const m = pathname.match(/^\/vms\/(default\.css|themes\/[a-z-]+\.css)$/);
  if (!m) return null;
  const file = Bun.file(new URL(m[1], stylesDir));
  if (await file.exists()) {
    return new Response(file, { headers: { "Content-Type": "text/css; charset=utf-8" } });
  }
  return new Response("Not Found", { status: 404 });
}

// ─── Vite-built client (dist/) ────────────────────────────────────────────────

const distDir = new URL("./dist/", import.meta.url);

async function serveStatic(pathname: string): Promise<Response> {
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  if (rel.split("/").some((seg) => seg === "..")) {
    return new Response("Forbidden", { status: 403 });
  }
  const file = Bun.file(new URL(rel, distDir));
  if (await file.exists()) return new Response(file);
  if (!rel.includes(".")) {
    const index = Bun.file(new URL("index.html", distDir));
    if (await index.exists()) return new Response(index);
  }
  return new Response("Not Found", { status: 404 });
}

const skillHandler = createAgentSkillHandler({
  appPreamble:
    "This is the v5.2 Lookup Field verification page. GET /api/lookup returns a " +
    "page exercising both new inputTypes: a `lookup` preselected to an id with " +
    "no search performed (the label rides on FieldNode.selected, never resolved " +
    "from candidates), a cold `lookup` demonstrating the visible D7 result cap, " +
    "a `lookup-multiple` chip field, a `lookup-multiple` with allowCustom:true " +
    "and no directory (a free-form tags input), and a lookup whose directory " +
    "fails on any query containing 'fail' (the search-error state, surfaced via " +
    "FieldNode.error). The search-* actions are ordinary blocking actions fired " +
    "on Enter; each is a state no-op because the query round-trips via searchBind.",
});

// ─── HTTP server ──────────────────────────────────────────────────────────────

const port = Number(process.env.PORT ?? "3012");

Bun.serve({
  // Bind all interfaces (0.0.0.0) so the page is reachable over the tailnet at
  // http://100.113.23.63:PORT/ AND at 127.0.0.1 for a local smoke check.
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/lookup" && request.method === "GET") {
      const state = initialState();
      // The shipped validator on the GET path — see `validated()`.
      return Response.json({ ok: true, vm: validated(buildVm(state)), state });
    }
    if (url.pathname === "/api/lookup/action" && request.method === "POST") {
      return actionHandler(request);
    }
    if (url.pathname === "/.well-known/vms-skill.md" && request.method === "GET") {
      return skillHandler(request);
    }

    if (request.method === "GET") {
      const css = await serveShippedCss(url.pathname);
      if (css) return css;
      return serveStatic(url.pathname);
    }
    return new Response("Method Not Allowed", { status: 405 });
  },
});

console.log(
  `LookupVerification (v5.2 lookup sign-off) → http://localhost:${port}  ` +
    `(tailnet: http://100.113.23.63:${port}/) — open it in a browser`,
);
