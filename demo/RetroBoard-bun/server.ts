// RetroBoard demo — TypeScript backend mirror of demo/RetroBoard/AspNetCore/.
// Faithful port: same wire format, same action semantics, same vm shape.
//
// Source of truth: demo/RetroBoard/AspNetCore/RetroBoardController.cs (+ RetroState.cs).
// Redesign (0.4.0): PageNode(Layout:"cards") with 3 SectionNode lanes (Variant:"card"),
// each lane = FormNode + ListNode of card list-items. StatBar was DROPPED. Delete
// button label is "✕". Resolved action items get list-item Variant "done" and a
// strikethrough text style.
//
// Phase 6 wire-shape migration (0.17.0 / WIRE-07): per-lane add inputs bind to
// state.drafts[lane]; per-card upvote/delete/resolve buttons use unique action
// names encoding the card id; action-items checkboxes bind to the
// actionItems[i].resolved slot via index.

import {
  createAction,
  type PageNode,
  type SectionNode,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface RetroCard {
  id: string;
  text: string;
  votes: number;
  resolved: boolean;
  createdAt: string;
}

interface RetroDrafts {
  wentWell: string;
  didntGoWell: string;
  actionItems: string;
}

const SECTION_TO_DRAFT: Record<string, keyof RetroDrafts> = {
  "went-well":     "wentWell",
  "didnt-go-well": "didntGoWell",
  "action-items":  "actionItems",
};

interface RetroState {
  wentWell: RetroCard[];
  didntGoWell: RetroCard[];
  actionItems: RetroCard[];
  // Phase 6 — per-lane draft text bound by the FieldNodes in each Add form.
  // Reset to "" after an "add-card-{section}" succeeds.
  drafts: RetroDrafts;
}

function initialState(): RetroState {
  const now = Date.now();
  return {
    wentWell:    [{ id: "s1", text: "Great team communication",  votes: 0, resolved: false, createdAt: new Date(now - 2 * 3_600_000).toISOString() }],
    didntGoWell: [{ id: "s2", text: "Scope creep during sprint", votes: 0, resolved: false, createdAt: new Date(now - 1 * 3_600_000).toISOString() }],
    actionItems: [{ id: "s3", text: "Define DoD for features",   votes: 0, resolved: false, createdAt: new Date(now - 30 * 60_000).toISOString() }],
    drafts: { wentWell: "", didntGoWell: "", actionItems: "" },
  };
}

type SectionId = "went-well" | "didnt-go-well" | "action-items";

function buildCardItem(
  card: RetroCard,
  isActionItems: boolean,
  actionItemsIndex: number,
): ViewNode {
  const children: ViewNode[] = [];

  if (isActionItems) {
    children.push({
      type: "checkbox",
      name: "resolved",
      bind: `actionItems.${actionItemsIndex}.resolved`,
      action: { name: `resolve-card-${card.id}` },
    });
  }

  children.push({
    type: "text",
    value: card.text,
    style: card.resolved ? "strikethrough" : undefined,
  });

  children.push({
    type: "button",
    label: `▲ ${card.votes}`,
    action: { name: `upvote-card-${card.id}` },
  });

  children.push({
    type: "button",
    label: "✕",
    action: { name: `delete-card-${card.id}` },
    variant: "danger",
  });

  return {
    type: "list-item",
    id: card.id,
    variant: card.resolved ? "done" : undefined,
    children,
  };
}

function buildSectionNode(
  label: string,
  sectionId: SectionId,
  cards: RetroCard[],
  isActionItems: boolean,
  sourceActionItems: RetroCard[],
): ViewNode {
  const section: SectionNode = {
    type: "section",
    heading: `${label} (${cards.length})`,
    variant: "card",
    children: [
      {
        type: "form",
        submitAction: { name: `add-card-${sectionId}` },
        submitLabel: "Add",
        children: [
          {
            type: "field",
            name: "text",
            inputType: "text",
            bind: `drafts.${SECTION_TO_DRAFT[sectionId]}`,
            placeholder: `Add to ${label}…`,
            required: false,
          },
        ],
      },
      {
        type: "list",
        children: cards
          .slice()
          .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
          .map(c => {
            const idx = sourceActionItems.findIndex(x => x.id === c.id);
            return buildCardItem(c, isActionItems, idx);
          }),
      },
    ],
  };
  return section as ViewNode;
}

function buildVm(state: RetroState): ViewNode {
  const page: PageNode = {
    type: "page",
    title: "Retro Board",
    layout: "cards",
    children: [
      buildSectionNode("Went Well",      "went-well",     state.wentWell,    false, state.actionItems),
      buildSectionNode("Didn't Go Well", "didnt-go-well", state.didntGoWell, false, state.actionItems),
      buildSectionNode("Action Items",   "action-items",  state.actionItems, true,  state.actionItems),
    ],
  };
  return page as ViewNode;
}

function generateId(): string {
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

function addCard(s: RetroState, section: string, card: RetroCard): RetroState {
  switch (section) {
    case "went-well":     return { ...s, wentWell:    [...s.wentWell,    card] };
    case "didnt-go-well": return { ...s, didntGoWell: [...s.didntGoWell, card] };
    case "action-items":  return { ...s, actionItems: [...s.actionItems, card] };
    default: return s;
  }
}

function deleteCard(s: RetroState, id: string): RetroState {
  return {
    ...s,
    wentWell:    s.wentWell.filter(c => c.id !== id),
    didntGoWell: s.didntGoWell.filter(c => c.id !== id),
    actionItems: s.actionItems.filter(c => c.id !== id),
  };
}

function upvoteCard(s: RetroState, id: string): RetroState {
  const bump = (c: RetroCard) => c.id === id ? { ...c, votes: c.votes + 1 } : c;
  return {
    ...s,
    wentWell:    s.wentWell.map(bump),
    didntGoWell: s.didntGoWell.map(bump),
    actionItems: s.actionItems.map(bump),
  };
}

const actionHandler = createAction<RetroState>(async (payload) => {
  let state = payload.state;
  const name = payload.name;

  if (name.startsWith("add-card-")) {
    const section = name.slice("add-card-".length) as SectionId;
    const draftKey = SECTION_TO_DRAFT[section];
    if (!draftKey) throw new Error(`unknown section: ${section}`);
    const text = (state.drafts[draftKey] ?? "").trim();
    if (!text) throw new Error("text required");
    const card: RetroCard = {
      id: generateId(),
      text,
      votes: 0,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    state = addCard(state, section, card);
    state = { ...state, drafts: { ...state.drafts, [draftKey]: "" } };
  } else if (name.startsWith("delete-card-")) {
    const id = name.slice("delete-card-".length);
    state = deleteCard(state, id);
  } else if (name.startsWith("upvote-card-")) {
    const id = name.slice("upvote-card-".length);
    state = upvoteCard(state, id);
  } else if (name.startsWith("resolve-card-")) {
    // The checkbox bind has already written the new boolean to
    // state.actionItems[i].resolved. Just acknowledge with a re-render.
  } else {
    throw new Error(`Unknown action: ${name}`);
  }

  return { vm: buildVm(state), state };
});

const port = Number(process.env.PORT ?? "3003");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/retro" && request.method === "GET") {
      const state = initialState();
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/retro/action" && request.method === "POST") {
      return actionHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`RetroBoard Bun backend listening on http://localhost:${port}`);
