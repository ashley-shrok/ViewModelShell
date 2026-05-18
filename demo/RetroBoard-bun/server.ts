// RetroBoard demo — TypeScript backend mirror of demo/RetroBoard/AspNetCore/.
// Faithful port: same wire format, same action semantics, same vm shape.
//
// Source of truth: demo/RetroBoard/AspNetCore/RetroBoardController.cs (+ RetroState.cs).
// Redesign (0.4.0): PageNode(Layout:"cards") with 3 SectionNode lanes (Variant:"card"),
// each lane = FormNode + ListNode of card list-items. StatBar was DROPPED. Delete
// button label is "✕". Resolved action items get list-item Variant "done" and a
// strikethrough text style.

import {
  createAction,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

// The locally-pinned @ashley-shrok/viewmodel-shell (0.3.11) type defs predate the
// 0.4.0 redesign and omit PageNode.layout / SectionNode.variant. Those fields are
// part of the 0.4.0 wire contract the .NET controller emits, so parity REQUIRES
// them on the wire. These forward-compat aliases let us emit the real shape with
// full type-checking instead of `any`. (Constraint: only server.ts is editable —
// can't bump the dependency.)
type PageNodeV04    = Extract<ViewNode, { type: "page" }>    & { layout?: string };
type SectionNodeV04 = Extract<ViewNode, { type: "section" }> & { variant?: string };

interface RetroCard {
  id: string;
  text: string;
  votes: number;
  resolved: boolean;
  createdAt: string;
}

interface RetroState {
  wentWell: RetroCard[];
  didntGoWell: RetroCard[];
  actionItems: RetroCard[];
}

function initialState(): RetroState {
  const now = Date.now();
  return {
    wentWell:    [{ id: "s1", text: "Great team communication",  votes: 0, resolved: false, createdAt: new Date(now - 2 * 3_600_000).toISOString() }],
    didntGoWell: [{ id: "s2", text: "Scope creep during sprint", votes: 0, resolved: false, createdAt: new Date(now - 1 * 3_600_000).toISOString() }],
    actionItems: [{ id: "s3", text: "Define DoD for features",   votes: 0, resolved: false, createdAt: new Date(now - 30 * 60_000).toISOString() }],
  };
}

function buildCardItem(card: RetroCard, isActionItems: boolean): ViewNode {
  const children: ViewNode[] = [];

  if (isActionItems) {
    // C# CheckboxNode(Name, Checked, Label:null, Action). Label omitted (null).
    children.push({
      type: "checkbox",
      name: "resolved",
      checked: card.resolved,
      action: { name: "resolve-card", context: { id: card.id } },
    });
  }

  // C# TextNode(card.Text, card.Resolved ? "strikethrough" : null) — style omitted when null.
  children.push({
    type: "text",
    value: card.text,
    style: card.resolved ? "strikethrough" : undefined,
  });

  // C# ButtonNode($"▲ {card.Votes}", upvote, Variant:null) — variant omitted when null.
  children.push({
    type: "button",
    label: `▲ ${card.votes}`,
    action: { name: "upvote-card", context: { id: card.id } },
  });

  // C# ButtonNode("✕", delete, Variant:"danger").
  children.push({
    type: "button",
    label: "✕",
    action: { name: "delete-card", context: { id: card.id } },
    variant: "danger",
  });

  // C# ListItemNode(Id, Variant: card.Resolved ? "done" : null, Children).
  return {
    type: "list-item",
    id: card.id,
    variant: card.resolved ? "done" : undefined,
    children,
  };
}

function buildSectionNode(label: string, sectionId: string, cards: RetroCard[], isActionItems: boolean): ViewNode {
  // C# SectionNode(Heading: $"{label} ({cards.Count})", Variant:"card", Children:[Form, List]).
  const section: SectionNodeV04 = {
    type: "section",
    heading: `${label} (${cards.length})`,
    variant: "card",
    children: [
      {
        type: "form",
        submitAction: { name: "add-card", context: { section: sectionId } },
        submitLabel: "Add",
        children: [
          // C# FieldNode("text", "text", Label:null, Placeholder:$"Add to {label}…", Value:null).
          // Required defaults to false (non-nullable bool → always serialized).
          {
            type: "field",
            name: "text",
            inputType: "text",
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
          .map(c => buildCardItem(c, isActionItems)),
      },
    ],
  };
  return section as ViewNode;
}

function buildVm(state: RetroState): ViewNode {
  // C# PageNode(Title:"Retro Board", Layout:"cards", Children:[3 sections]). No StatBar.
  const page: PageNodeV04 = {
    type: "page",
    title: "Retro Board",
    layout: "cards",
    children: [
      buildSectionNode("Went Well",      "went-well",     state.wentWell,    false),
      buildSectionNode("Didn't Go Well", "didnt-go-well", state.didntGoWell, false),
      buildSectionNode("Action Items",   "action-items",  state.actionItems, true),
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
    wentWell:    s.wentWell.filter(c => c.id !== id),
    didntGoWell: s.didntGoWell.filter(c => c.id !== id),
    actionItems: s.actionItems.filter(c => c.id !== id),
  };
}

function upvoteCard(s: RetroState, id: string): RetroState {
  const bump = (c: RetroCard) => c.id === id ? { ...c, votes: c.votes + 1 } : c;
  return {
    wentWell:    s.wentWell.map(bump),
    didntGoWell: s.didntGoWell.map(bump),
    actionItems: s.actionItems.map(bump),
  };
}

// C# ResolveCard only mutates ActionItems.
function resolveCard(s: RetroState, id: string, resolved: boolean): RetroState {
  return {
    ...s,
    actionItems: s.actionItems.map(c => c.id === id ? { ...c, resolved } : c),
  };
}

const actionHandler = createAction<RetroState>(async (payload) => {
  const ctx = payload.context ?? {};
  const str  = (k: string): string | null  => (typeof ctx[k] === "string"  ? (ctx[k] as string)  : null);
  const bool = (k: string): boolean | null => (typeof ctx[k] === "boolean" ? (ctx[k] as boolean) : null);

  let state = payload.state;

  switch (payload.name) {
    case "add-card": {
      const section = str("section");
      const text = str("text");
      if (!text || !text.trim()) throw new Error("text required");
      if (section) {
        const card: RetroCard = {
          id: generateId(),
          text: text.trim(),
          votes: 0,
          resolved: false,
          createdAt: new Date().toISOString(),
        };
        state = addCard(state, section, card);
      }
      break;
    }
    case "delete-card": {
      const id = str("id");
      if (id) state = deleteCard(state, id);
      break;
    }
    case "upvote-card": {
      const id = str("id");
      if (id) state = upvoteCard(state, id);
      break;
    }
    case "resolve-card": {
      const id = str("id");
      const isResolved = bool("checked");
      if (id && isResolved !== null) state = resolveCard(state, id, isResolved);
      break;
    }
    default:
      throw new Error(`Unknown action: ${payload.name}`);
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
