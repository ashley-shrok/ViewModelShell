// ContactManager demo — TypeScript backend mirror of demo/ContactManager/AspNetCore/.
// Faithful port: same wire format, same action semantics, same vm shape.
// Used as part of the parity test harness in ../../parity/.
//
// Realistic CRM / Google-Contacts shape (0.4.0 redesign): ONE persistent page
// with a split master/detail layout. Left = searchable contact list (master);
// right = a card panel showing the selected contact / add form / empty state.
// Mirrors ContactsController.BuildVm exactly.

import {
  createAction,
  type ViewNode,
} from "@ashley-shrok/viewmodel-shell/server";

interface ContactRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  createdAt: string;
}

interface ContactsState {
  contacts: ContactRecord[];
  currentView: string;   // "list" | "detail" | "add"
  selectedId: string | null;
  searchQuery: string;
}

function initialState(): ContactsState {
  const day = 24 * 3_600_000;
  const now = Date.now();
  const offset = (n: number) => new Date(now - n * day).toISOString();
  return {
    contacts: [
      { id: "c1",  name: "Alice Johnson",   email: "alice@example.com",   phone: "555-0101", notes: "Met at conference 2024",  createdAt: offset(30) },
      { id: "c2",  name: "Bob Smith",       email: "bob@example.com",     phone: "555-0102", notes: "Former colleague",         createdAt: offset(20) },
      { id: "c3",  name: "Carol Davis",     email: "carol@example.com",   phone: "555-0103", notes: "Client from Q1 project",   createdAt: offset(10) },
      { id: "c4",  name: "David Lee",       email: "david@example.com",   phone: "555-0104", notes: "Referred by Alice",        createdAt: offset(9)  },
      { id: "c5",  name: "Eva Martinez",    email: "eva@example.com",     phone: "555-0105", notes: "Design lead at Acme",      createdAt: offset(8)  },
      { id: "c6",  name: "Frank Chen",      email: "frank@example.com",   phone: "555-0106", notes: "Met at hackathon",         createdAt: offset(7)  },
      { id: "c7",  name: "Grace Kim",       email: "grace@example.com",   phone: "555-0107", notes: "University contact",       createdAt: offset(6)  },
      { id: "c8",  name: "Henry Patel",     email: "henry@example.com",   phone: "555-0108", notes: "Potential partner",        createdAt: offset(5)  },
      { id: "c9",  name: "Isabel Nguyen",   email: "isabel@example.com",  phone: "555-0109", notes: "Freelance illustrator",    createdAt: offset(4)  },
      { id: "c10", name: "James O'Brien",   email: "james@example.com",   phone: "555-0110", notes: "Investor intro",           createdAt: offset(3)  },
      { id: "c11", name: "Karen Walsh",     email: "karen@example.com",   phone: "555-0111", notes: "Legal counsel",            createdAt: offset(2)  },
      { id: "c12", name: "Luis Romero",     email: "luis@example.com",    phone: "555-0112", notes: "Backend engineer",         createdAt: offset(1)  },
    ],
    currentView: "list",
    selectedId: null,
    searchQuery: "",
  };
}

function filtered(state: ContactsState): ContactRecord[] {
  if (!state.searchQuery || !state.searchQuery.trim()) return state.contacts;
  const needle = state.searchQuery.toLowerCase();
  return state.contacts.filter(c =>
    c.name.toLowerCase().includes(needle) ||
    c.email.toLowerCase().includes(needle)
  );
}

// LEFT — searchable contact list (master).
function buildMaster(state: ContactsState): ViewNode {
  const list = filtered(state);
  const count = list.length === state.contacts.length
    ? `${state.contacts.length}`
    : `${list.length} of ${state.contacts.length}`;

  return {
    type: "section",
    heading: `All Contacts (${count})`,
    children: [
      {
        type: "form",
        submitAction: { name: "search" },
        submitLabel: "Search",
        children: [
          {
            type: "field",
            name: "query",
            inputType: "text",
            placeholder: "Search by name or email…",
            value: state.searchQuery,
            required: false,
            action: { name: "search" },
          },
        ],
      },
      {
        type: "button",
        label: "+ Add Contact",
        action: { name: "navigate-to-add" },
        variant: "primary",
      },
      {
        type: "list",
        id: "contact-list",
        children: list
          .slice()
          .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
          .map<ViewNode>(c => ({
            type: "list-item",
            id: c.id,
            // D-27: the shipped .vms-list-item--active default marks the
            // current master-detail selection.
            ...(c.id === state.selectedId ? { variant: "active" } : {}),
            children: [
              { type: "text", value: c.name },
              { type: "text", value: c.email, style: "muted" },
              {
                type: "button",
                label: "Open",
                action: { name: "navigate-to-detail", context: { id: c.id } },
              },
            ],
          })),
      },
    ],
  };
}

// RIGHT — detail card: selected contact / add form / empty state.
function buildDetail(state: ContactsState): ViewNode {
  if (state.currentView === "add") {
    return {
      type: "section",
      heading: "New Contact",
      variant: "card",
      children: [
        {
          type: "form",
          submitAction: { name: "save-contact" },
          submitLabel: "Create Contact",
          children: [
            { type: "field", name: "name",  inputType: "text",     label: "Name",  placeholder: "Full name",          required: true  },
            { type: "field", name: "email", inputType: "email",    label: "Email", placeholder: "email@example.com",  required: false },
            { type: "field", name: "phone", inputType: "text",     label: "Phone", placeholder: "555-0100",           required: false },
            { type: "field", name: "notes", inputType: "textarea", label: "Notes", placeholder: "Any notes…",         required: false },
          ],
        },
        { type: "button", label: "Cancel", action: { name: "navigate-to-list" } },
      ],
    };
  }

  const contact = state.selectedId
    ? state.contacts.find(c => c.id === state.selectedId)
    : null;

  if (!contact) {
    return {
      type: "section",
      heading: "Details",
      variant: "card",
      children: [
        { type: "text", value: "Select a contact to view details, or add a new one.", style: "muted" },
      ],
    };
  }

  return {
    type: "section",
    heading: contact.name,
    variant: "card",
    children: [
      {
        type: "form",
        submitAction: { name: "save-contact", context: { id: contact.id } },
        submitLabel: "Save",
        children: [
          { type: "field", name: "name",  inputType: "text",     label: "Name",  value: contact.name,  required: true  },
          { type: "field", name: "email", inputType: "email",    label: "Email", value: contact.email, required: false },
          { type: "field", name: "phone", inputType: "text",     label: "Phone", value: contact.phone, required: false },
          { type: "field", name: "notes", inputType: "textarea", label: "Notes", value: contact.notes, required: false },
        ],
      },
      {
        type: "button",
        label: "Delete",
        action: { name: "delete-contact", context: { id: contact.id } },
        variant: "danger",
      },
    ],
  };
}

function buildVm(state: ContactsState): ViewNode {
  return {
    type: "page",
    title: "Contacts",
    density: "compact",
    layout: "split",
    width: "wide",   // master+detail benefits from the 1440px cap — 0.7.0/#13
    children: [
      buildMaster(state),
      buildDetail(state),
    ],
  };
}

function generateId(): string {
  return Array.from({ length: 8 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("");
}

const actionHandler = createAction<ContactsState>(async (payload) => {
  const ctx = payload.context ?? {};
  const str = (k: string): string | null => (typeof ctx[k] === "string" ? (ctx[k] as string) : null);

  let state = payload.state;

  switch (payload.name) {
    case "navigate-to-detail": {
      const id = str("id");
      if (!id) throw new Error("id required");
      state = { ...state, selectedId: id, currentView: "detail" };
      break;
    }
    case "navigate-to-add":
      state = { ...state, currentView: "add", selectedId: null };
      break;
    case "navigate-to-list":
      state = { ...state, currentView: "list", selectedId: null };
      break;
    case "save-contact": {
      const name = str("name");
      if (!name || !name.trim()) throw new Error("name required");
      const trimmedName = name.trim();
      const email = (str("email") ?? "").trim();
      const phone = (str("phone") ?? "").trim();
      const notes = (str("notes") ?? "").trim();
      const editId = str("id");
      if (editId) {
        state = {
          ...state,
          contacts: state.contacts.map(c =>
            c.id === editId ? { ...c, name: trimmedName, email, phone, notes } : c
          ),
          selectedId: editId,
          currentView: "detail",
        };
      } else {
        const added: ContactRecord = {
          id: generateId(),
          name: trimmedName,
          email,
          phone,
          notes,
          createdAt: new Date().toISOString(),
        };
        state = {
          ...state,
          contacts: [...state.contacts, added],
          selectedId: added.id,
          currentView: "detail",
        };
      }
      break;
    }
    case "delete-contact": {
      const id = str("id");
      if (id) state = { ...state, contacts: state.contacts.filter(c => c.id !== id) };
      state = { ...state, currentView: "list", selectedId: null };
      break;
    }
    case "search":
      state = { ...state, searchQuery: str("query") ?? "" };
      break;
    default:
      throw new Error(`Unknown action: ${payload.name}`);
  }

  return { vm: buildVm(state), state };
});

const port = Number(process.env.PORT ?? "3002");

Bun.serve({
  port,
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/contacts" && request.method === "GET") {
      const state = initialState();
      return Response.json({ vm: buildVm(state), state });
    }
    if (url.pathname === "/api/contacts/action" && request.method === "POST") {
      return actionHandler(request);
    }
    return new Response("Not Found", { status: 404 });
  },
});

console.log(`ContactManager Bun backend listening on http://localhost:${port}`);
