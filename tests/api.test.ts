import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import jsQR from "jsqr";
import app from "../worker/index";
import type { Bindings, Db } from "../worker/env";
import { sendTicketEmail } from "../worker/services/email";
import type { EventRow, RegistrationRow } from "../worker/services/format";
import { decodeGrayPng } from "./helpers/png";

/**
 * Calls the Hono app in-process. Nothing here may touch the network: global fetch is replaced with a
 * spy that rejects, and tests assert it was never called on paths that must fail before any DB call.
 */

const configured: Bindings = {
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "x",
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Reggie <tickets@mail.example.com>",
  APP_URL: "https://reggie.example",
};

const EVENT_ID = "11111111-1111-4111-8111-111111111111";

const ctx = () => ({ waitUntil: vi.fn(), passThroughOnException: vi.fn(), props: {} });

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn(async () => {
    throw new Error("network access is not allowed in unit tests");
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function call(path: string, init: RequestInit = {}, env: Partial<Bindings> = configured) {
  return app.request(path, init, env, ctx() as never);
}

function postJson(path: string, body: unknown, env: Partial<Bindings> = configured) {
  return call(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }, env);
}

describe("basic routes", () => {
  it("GET /api/health -> { ok: true }", async () => {
    const res = await call("/api/health", {}, {});
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("unknown /api route -> 404 not_found", async () => {
    const res = await call("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
  });

  it("GET /api/qr-test returns a scannable PNG", async () => {
    const res = await call("/api/qr-test?text=hi", {}, {});
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const png = new Uint8Array(await res.arrayBuffer());
    const { width, height, rgba } = await decodeGrayPng(png);
    expect(jsQR(rgba, width, height)?.data).toBe("hi");
  });
});

describe("server configuration guard", () => {
  it("GET /api/events with no Supabase key -> 500 internal", async () => {
    const res = await call("/api/events", {}, { SUPABASE_URL: "https://example.supabase.co" });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe("internal");
    expect(body.error.message).toMatch(/not configured/i);
  });

  it("the placeholder SUPABASE_URL from wrangler.jsonc counts as not configured", async () => {
    const res = await call("/api/events", {}, { ...configured, SUPABASE_URL: "https://YOUR-PROJECT.supabase.co" });
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("internal");
  });

  it("guards /api/admin/* too", async () => {
    const res = await call("/api/admin/events", {}, {});
    expect(res.status).toBe(500);
  });
});

describe("admin auth", () => {
  it.each([
    ["GET", "/api/admin/events"],
    ["GET", `/api/admin/events/${EVENT_ID}`],
    ["POST", "/api/admin/events"],
    ["PATCH", `/api/admin/events/${EVENT_ID}`],
    ["GET", `/api/admin/events/${EVENT_ID}/registrations`],
    ["POST", `/api/admin/events/${EVENT_ID}/checkin`],
    ["POST", `/api/admin/registrations/${EVENT_ID}/resend`],
  ])("%s %s with no Authorization header -> 401 before any network call", async (method, path) => {
    const res = await call(path, { method });
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("unauthorized");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a non-Bearer Authorization header -> 401", async () => {
    const res = await call("/api/admin/events", { headers: { Authorization: "Basic abc" } });
    expect(res.status).toBe(401);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("public routes that fail before the DB", () => {
  it("POST registration with an invalid body -> 400 validation_error with field codes", async () => {
    const res = await postJson(`/api/events/${EVENT_ID}/registrations`, {
      fullName: "J",
      email: "nope",
      organization: "",
      contactNumber: "08171234567",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; fields: Record<string, string> } };
    expect(body.error.code).toBe("validation_error");
    expect(body.error.fields).toEqual({
      fullName: "name_short",
      email: "email_format",
      organization: "org_required",
      contactNumber: "contact_format",
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST registration with an empty object -> 400 with a code for every field", async () => {
    const res = await postJson(`/api/events/${EVENT_ID}/registrations`, {});
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { fields: Record<string, string> } };
    expect(Object.keys(body.error.fields).sort()).toEqual(["contactNumber", "email", "fullName", "organization"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST registration with a non-JSON body -> 400 validation_error", async () => {
    const res = await call(`/api/events/${EVENT_ID}/registrations`, { method: "POST", body: "not json" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("validation_error");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("POST registration to a non-UUID event id -> 404 not_found", async () => {
    const res = await postJson("/api/events/not-a-uuid/registrations", {});
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("GET /api/events/:id with a non-UUID id -> 404 not_found", async () => {
    const res = await call("/api/events/abc");
    expect(res.status).toBe(404);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("GET /api/tickets/:token with a malformed token -> 404 not_found", async () => {
    const res = await call("/api/tickets/short");
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("not_found");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a DB failure surfaces as the §6.1 error shape, not a raw exception", async () => {
    // A non-retryable PostgREST error (postgrest-js retries network errors and 503/520 on GET, so avoid those).
    fetchSpy.mockImplementation(
      async () =>
        new Response(JSON.stringify({ code: "42P01", message: "relation does not exist", details: null, hint: null }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }),
    );
    const res = await call("/api/events");
    expect(res.status).toBe(500);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("internal");
    expect(String(fetchSpy.mock.calls[0][0])).toContain("https://example.supabase.co/rest/v1/events");
  });
});

describe("sendTicketEmail (Resend mocked)", () => {
  const reg: RegistrationRow = {
    id: "33333333-3333-4333-8333-333333333333",
    event_id: EVENT_ID,
    full_name: "Juan Dela Cruz",
    email: "juan@example.com",
    organization: "PUP",
    contact_number: "+639171234567",
    qr_token: "AbCdEfGhIjKlMnOpQrStUv",
    email_status: "pending",
    checked_in_at: null,
    created_at: "2026-11-10T00:00:00Z",
  };
  const event: EventRow = {
    id: EVENT_ID,
    admin_id: "22222222-2222-4222-8222-222222222222",
    title: "Intro to Workers",
    description: "",
    date_time: "2026-12-01T01:00:00Z",
    venue: "Room 301",
    capacity: 50,
    status: "published",
    created_at: "2026-11-10T00:00:00Z",
  };

  /** Fake Supabase client that records email_status updates. */
  function fakeDb() {
    const updates: unknown[] = [];
    const db = {
      from: () => ({
        update: (u: unknown) => {
          updates.push(u);
          return { eq: async () => ({ error: null }) };
        },
      }),
    };
    return { db: db as unknown as Db, updates };
  }

  it("posts the ticket to Resend with an inline QR attachment and marks it sent", async () => {
    fetchSpy.mockImplementation(async () => new Response("{}", { status: 200 }));
    const { db, updates } = fakeDb();
    expect(await sendTicketEmail(configured, db, reg, event)).toBe("sent");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test");
    expect(headers["Idempotency-Key"]).toBe(`ticket-${reg.id}-1`);

    const payload = JSON.parse(init.body as string);
    expect(payload.to).toEqual(["juan@example.com"]);
    expect(payload.from).toBe(configured.EMAIL_FROM);
    expect(payload.subject).toBe("Ito na ang ticket mo, Juan!");
    expect(payload.html).toContain("cid:ticket-qr");
    expect(payload.html).toContain(`https://reggie.example/ticket/${reg.qr_token}`);
    expect(payload.text).toContain(`https://reggie.example/ticket/${reg.qr_token}`);

    const att = payload.attachments[0];
    expect(att.content_id).toBe("ticket-qr");
    const png = new Uint8Array(Buffer.from(att.content, "base64"));
    const { width, height, rgba } = await decodeGrayPng(png);
    expect(jsQR(rgba, width, height)?.data).toBe(reg.qr_token);

    expect(updates).toEqual([{ email_status: "sent" }]);
  });

  it("marks failed (and does not throw) when Resend returns an error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchSpy.mockImplementation(async () => new Response("bad", { status: 422 }));
    const { db, updates } = fakeDb();
    expect(await sendTicketEmail(configured, db, reg, event)).toBe("failed");
    expect(updates).toEqual([{ email_status: "failed" }]);
  });

  it("marks failed without calling Resend when RESEND_API_KEY is missing", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, updates } = fakeDb();
    expect(await sendTicketEmail({ ...configured, RESEND_API_KEY: "" }, db, reg, event)).toBe("failed");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(updates).toEqual([{ email_status: "failed" }]);
  });

  it("uses a new idempotency key per resend attempt and strips a trailing slash from APP_URL", async () => {
    fetchSpy.mockImplementation(async () => new Response("{}", { status: 200 }));
    const { db } = fakeDb();
    await sendTicketEmail({ ...configured, APP_URL: "https://reggie.example/" }, db, reg, event, 1700000000000);
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)["Idempotency-Key"]).toBe(`ticket-${reg.id}-1700000000000`);
    expect(JSON.parse(init.body as string).html).toContain(`href="https://reggie.example/ticket/${reg.qr_token}"`);
  });
});
