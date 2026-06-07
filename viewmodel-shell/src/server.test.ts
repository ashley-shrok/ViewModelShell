// Phase 07 Plan 01 / ERROR-01..03 — envelope + ok flag tests for createAction.
//
// Pure-TS test (no jsdom; no Bun/Hono runtime): createAction takes a
// handler and returns a (Request → Response) function. We build synthetic
// Request objects directly, call the returned handler, and assert the
// Response body + status.
//
// Coverage:
//   - Success path: ok:true on all response shapes
//   - Parse error: ok:false, code "parse_error", status 400
//   - BadRequestError: ok:false, no code, status 400
//   - UnknownActionError: ok:false, code "unknown_action", status 400
//   - Generic uncaught Error: ok:false, code "uncaught_exception", status 500
//   - validateActionNames violation: ok:false, code "invalid_tree", status 500
//   - Redirect-only response: ok:true
//   - Null omission: path/code absent when not set
//   - T1 info-disclosure: uncaught-throw body never leaks stack trace

import { describe, it, expect } from "vitest";
import {
  createAction,
  BadRequestError,
  UnknownActionError,
  ERR_CODES,
} from "./server.js";
import type { ActionPayload, ShellResponseBody } from "./server.js";
import type { PageNode } from "./index.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface TestState {
  value: string;
}

const VALID_STATE: TestState = { value: "hello" };

/** Build a JSON (application/json) request with the given payload. */
function jsonRequest(body: object): Request {
  return new Request("http://localhost/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Build a multipart request with valid _action + _state fields. */
function multipartRequest(name: string, state: TestState): Request {
  const fd = new FormData();
  fd.append("_action", JSON.stringify({ name }));
  fd.append("_state", JSON.stringify(state));
  return new Request("http://localhost/action", {
    method: "POST",
    body: fd,
  });
}

/** Build a multipart request with a malformed _action field. */
function malformedMultipartRequest(): Request {
  const fd = new FormData();
  fd.append("_action", "not-valid-json{{{");
  fd.append("_state", JSON.stringify(VALID_STATE));
  return new Request("http://localhost/action", {
    method: "POST",
    body: fd,
  });
}

/** Build a minimal valid page tree for the success path. */
function makeVm(): PageNode {
  return { type: "page", children: [{ type: "text", text: "hello" }] };
}

async function parseBody(res: Response): Promise<unknown> {
  return await res.json();
}

// ─── ERR_CODES export ─────────────────────────────────────────────────────────

describe("ERR_CODES", () => {
  it("exports the four framework code constants", () => {
    expect(ERR_CODES.PARSE).toBe("parse_error");
    expect(ERR_CODES.UNKNOWN_ACTION).toBe("unknown_action");
    expect(ERR_CODES.INVALID_TREE).toBe("invalid_tree");
    expect(ERR_CODES.UNCAUGHT).toBe("uncaught_exception");
  });
});

// ─── UnknownActionError ───────────────────────────────────────────────────────

describe("UnknownActionError", () => {
  it("stores the offending action name on actionName property", () => {
    const err = new UnknownActionError("missing-action");
    expect(err.actionName).toBe("missing-action");
  });

  it("sets a descriptive message containing the action name", () => {
    const err = new UnknownActionError("bogus");
    expect(err.message).toContain("bogus");
  });

  it("has name = UnknownActionError (Error.prototype.name convention)", () => {
    const err = new UnknownActionError("x");
    expect(err.name).toBe("UnknownActionError");
  });

  it("is an instance of Error", () => {
    expect(new UnknownActionError("x")).toBeInstanceOf(Error);
  });
});

// ─── createAction — success paths ─────────────────────────────────────────────

describe("createAction — success path", () => {
  it("JSON body: returns ok:true with vm and state on success", async () => {
    const handler = createAction<TestState>(async (payload) => ({
      vm: makeVm(),
      state: payload.state,
    }));
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    expect(res.status).toBe(200);
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.state).toEqual(VALID_STATE);
    expect(body.vm).toBeDefined();
  });

  it("multipart body: returns ok:true with vm and state on success", async () => {
    const handler = createAction<TestState>(async (payload) => ({
      vm: makeVm(),
      state: payload.state,
    }));
    const res = await handler(multipartRequest("save", VALID_STATE));
    expect(res.status).toBe(200);
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  it("redirect-only response carries ok:true", async () => {
    const handler = createAction<TestState>(async (_payload) => ({
      redirect: "/dashboard",
    }));
    const res = await handler(jsonRequest({ name: "login", state: VALID_STATE }));
    expect(res.status).toBe(200);
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.redirect).toBe("/dashboard");
  });

  it("sideEffects-only response carries ok:true", async () => {
    const handler = createAction<TestState>(async (_payload) => ({
      sideEffects: [{ type: "set-local-storage", key: "k", value: "v" }],
    }));
    const res = await handler(jsonRequest({ name: "effect", state: VALID_STATE }));
    expect(res.status).toBe(200);
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(true);
  });

  it("returns Content-Type: application/json", async () => {
    const handler = createAction<TestState>(async () => ({ vm: makeVm(), state: VALID_STATE }));
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    expect(res.headers.get("content-type")).toContain("application/json");
  });
});

// ─── createAction — parse error ───────────────────────────────────────────────

describe("createAction — parse error", () => {
  it("malformed multipart _action JSON returns status 400", async () => {
    const handler = createAction<TestState>(async () => ({ vm: makeVm(), state: VALID_STATE }));
    const res = await handler(malformedMultipartRequest());
    expect(res.status).toBe(400);
  });

  it("malformed payload returns ok:false envelope", async () => {
    const handler = createAction<TestState>(async () => ({ vm: makeVm(), state: VALID_STATE }));
    const res = await handler(malformedMultipartRequest());
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(Array.isArray(body.errors)).toBe(true);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toBeTruthy();
  });

  it("parse error envelope has code = parse_error", async () => {
    const handler = createAction<TestState>(async () => ({ vm: makeVm(), state: VALID_STATE }));
    const res = await handler(malformedMultipartRequest());
    const body = await parseBody(res) as Record<string, unknown>;
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].code).toBe("parse_error");
  });

  it("JSON body missing _action name field returns 400 with parse_error", async () => {
    // parseJsonAction requires a name field
    const handler = createAction<TestState>(async () => ({ vm: makeVm(), state: VALID_STATE }));
    const req = new Request("http://localhost/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: VALID_STATE }), // missing "name"
    });
    const res = await handler(req);
    expect(res.status).toBe(400);
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect((body.errors as Array<Record<string, unknown>>)[0].code).toBe("parse_error");
  });
});

// ─── createAction — BadRequestError ──────────────────────────────────────────

describe("createAction — BadRequestError", () => {
  it("thrown BadRequestError returns status 400", async () => {
    const handler = createAction<TestState>(async () => {
      throw new BadRequestError("bad input");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    expect(res.status).toBe(400);
  });

  it("thrown BadRequestError returns ok:false with the message", async () => {
    const handler = createAction<TestState>(async () => {
      throw new BadRequestError("bad input");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].message).toBe("bad input");
  });

  it("BadRequestError envelope has NO code field (D-08)", async () => {
    const handler = createAction<TestState>(async () => {
      throw new BadRequestError("bad input");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const body = await parseBody(res) as Record<string, unknown>;
    const errors = body.errors as Array<Record<string, unknown>>;
    // code must be absent, not null
    expect("code" in errors[0]).toBe(false);
  });

  it("BadRequestError envelope has NO path field", async () => {
    const handler = createAction<TestState>(async () => {
      throw new BadRequestError("bad input");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const body = await parseBody(res) as Record<string, unknown>;
    const errors = body.errors as Array<Record<string, unknown>>;
    expect("path" in errors[0]).toBe(false);
  });
});

// ─── createAction — UnknownActionError ───────────────────────────────────────

describe("createAction — UnknownActionError", () => {
  it("thrown UnknownActionError returns status 400", async () => {
    const handler = createAction<TestState>(async (payload) => {
      throw new UnknownActionError(payload.name);
    });
    const res = await handler(jsonRequest({ name: "missing", state: VALID_STATE }));
    expect(res.status).toBe(400);
  });

  it("thrown UnknownActionError returns ok:false envelope", async () => {
    const handler = createAction<TestState>(async (payload) => {
      throw new UnknownActionError(payload.name);
    });
    const res = await handler(jsonRequest({ name: "missing", state: VALID_STATE }));
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(false);
  });

  it("UnknownActionError envelope has code = unknown_action", async () => {
    const handler = createAction<TestState>(async (payload) => {
      throw new UnknownActionError(payload.name);
    });
    const res = await handler(jsonRequest({ name: "missing", state: VALID_STATE }));
    const body = await parseBody(res) as Record<string, unknown>;
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].code).toBe("unknown_action");
  });

  it("UnknownActionError envelope message contains the action name", async () => {
    const handler = createAction<TestState>(async (payload) => {
      throw new UnknownActionError(payload.name);
    });
    const res = await handler(jsonRequest({ name: "missing", state: VALID_STATE }));
    const body = await parseBody(res) as Record<string, unknown>;
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(String(errors[0].message)).toContain("missing");
  });
});

// ─── createAction — uncaught exception ───────────────────────────────────────

describe("createAction — uncaught exception", () => {
  it("generic Error thrown returns status 500", async () => {
    const handler = createAction<TestState>(async () => {
      throw new Error("boom");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    expect(res.status).toBe(500);
  });

  it("generic Error returns ok:false with code = uncaught_exception", async () => {
    const handler = createAction<TestState>(async () => {
      throw new Error("boom");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].code).toBe("uncaught_exception");
  });

  it("uncaught Error envelope carries err.message verbatim", async () => {
    const handler = createAction<TestState>(async () => {
      throw new Error("something went wrong");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const body = await parseBody(res) as Record<string, unknown>;
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].message).toBe("something went wrong");
  });

  it("T1: uncaught Error message does NOT contain a stack trace (no 'at ' lines)", async () => {
    const handler = createAction<TestState>(async () => {
      throw new Error("something failed internally");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const bodyText = await res.text();
    expect(bodyText).not.toContain("\n    at ");
    expect(bodyText).not.toContain("Error: something failed"); // no toString() form
  });

  it("T1: non-Error thrown returns 'Internal server error' (no unknown shape leak)", async () => {
    const handler = createAction<TestState>(async () => {
      throw "a raw string throw"; // eslint-disable-line @typescript-eslint/no-throw-literal
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    expect(res.status).toBe(500);
    const body = await parseBody(res) as Record<string, unknown>;
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].message).toBe("Internal server error");
  });

  it("T1: thrown object (non-Error) does not leak object contents", async () => {
    const handler = createAction<TestState>(async () => {
      throw { secret: "sensitive-data", stack: "fake stack" };
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const bodyText = await res.text();
    expect(bodyText).not.toContain("sensitive-data");
  });
});

// ─── createAction — validateActionNames (invalid tree) ───────────────────────

describe("createAction — validateActionNames violation", () => {
  it("duplicate action names in distinct positions returns status 500", async () => {
    const handler = createAction<TestState>(async () => ({
      // Two buttons with the same action name not in the same form = invalid
      vm: {
        type: "page" as const,
        children: [
          { type: "button" as const, label: "A", action: { name: "same-action" } },
          { type: "button" as const, label: "B", action: { name: "same-action" } },
        ],
      },
      state: VALID_STATE,
    }));
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    expect(res.status).toBe(500);
  });

  it("invalid tree returns ok:false with code = invalid_tree", async () => {
    const handler = createAction<TestState>(async () => ({
      vm: {
        type: "page" as const,
        children: [
          { type: "button" as const, label: "A", action: { name: "dup" } },
          { type: "button" as const, label: "B", action: { name: "dup" } },
        ],
      },
      state: VALID_STATE,
    }));
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const body = await parseBody(res) as Record<string, unknown>;
    expect(body.ok).toBe(false);
    const errors = body.errors as Array<Record<string, unknown>>;
    expect(errors[0].code).toBe("invalid_tree");
  });
});

// ─── Null-omission contract ───────────────────────────────────────────────────

describe("null-omission contract", () => {
  it("BadRequest entry: no path key, no code key (both absent)", async () => {
    const handler = createAction<TestState>(async () => {
      throw new BadRequestError("msg");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const text = await res.text();
    // The JSON text must not contain null values for path or code
    expect(text).not.toContain('"path":null');
    expect(text).not.toContain('"code":null');
    expect(text).not.toContain('"path": null');
    expect(text).not.toContain('"code": null');
  });

  it("UnknownAction entry: code is present but path is absent", async () => {
    const handler = createAction<TestState>(async () => {
      throw new UnknownActionError("x");
    });
    const res = await handler(jsonRequest({ name: "test", state: VALID_STATE }));
    const text = await res.text();
    expect(text).not.toContain('"path":null');
    expect(text).not.toContain('"path": null');
    expect(text).toContain('"code"');
  });
});
