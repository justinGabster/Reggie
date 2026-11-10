import { Hono } from "hono";
import { registrationInput } from "@shared/schemas";
import type { PublicEvent, RegisterResponse, TicketResponse } from "@shared/api-types";
import type { AppEnv } from "../env";
import { ApiErr, parseJson } from "../errors";
import { EVENT_COLUMNS, toPublicEvent, type EventWithCount } from "../services/format";
import { newToken, qrSvg } from "../services/qr";
import { insertRegistration, isUuid, verifyTurnstile } from "../services/registrations";
import { sendTicketEmail } from "../services/email";

export const publicRoutes = new Hono<AppEnv>();

// GET /api/events: published events, upcoming first (events from the last 12 hours stay visible on the day).
publicRoutes.get("/events", async (c) => {
  const since = new Date(Date.now() - 12 * 3600_000).toISOString();
  const { data, error } = await c.var.db
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("status", "published")
    .gte("date_time", since)
    .order("date_time", { ascending: true });
  if (error) throw new ApiErr(500, "internal", "Could not load events");
  const events: PublicEvent[] = (data as unknown as EventWithCount[]).map(toPublicEvent);
  return c.json({ events });
});

// GET /api/events/:id: one published event (drafts are 404).
publicRoutes.get("/events/:id", async (c) => {
  const id = c.req.param("id");
  if (!isUuid(id)) throw new ApiErr(404, "not_found", "Event not found");
  const { data, error } = await c.var.db
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw new ApiErr(500, "internal", "Could not load event");
  if (!data) throw new ApiErr(404, "not_found", "Event not found");
  return c.json({ event: toPublicEvent(data as unknown as EventWithCount) });
});

// POST /api/events/:id/registrations: register -> save -> QR -> email (in the background).
publicRoutes.post("/events/:id/registrations", async (c) => {
  const eventId = c.req.param("id");
  if (!isUuid(eventId)) throw new ApiErr(404, "not_found", "Event not found");
  const input = await parseJson(c, registrationInput);
  await verifyTurnstile(c.env, input.turnstileToken, c.req.header("CF-Connecting-IP"));

  const token = newToken();
  const db = c.var.db;
  const reg = await insertRegistration(db, {
    eventId,
    fullName: input.fullName,
    email: input.email,
    organization: input.organization,
    contactNumber: input.contactNumber,
    token,
  });

  // Respond fast; the email is sent after the response (waitUntil).
  c.executionCtx.waitUntil(
    (async () => {
      const { data: event } = await db.from("events").select("*").eq("id", eventId).single();
      if (event) await sendTicketEmail(c.env, db, reg, event);
    })(),
  );

  const body: RegisterResponse = {
    registration: { id: reg.id, fullName: reg.full_name, eventId: reg.event_id },
    ticketUrl: `/ticket/${token}`,
    token,
  };
  return c.json(body, 201);
});

// GET /api/tickets/:token: ticket data and QR SVG (the token in the URL is the secret).
publicRoutes.get("/tickets/:token", async (c) => {
  const token = c.req.param("token");
  if (!/^[A-Za-z0-9_-]{22,64}$/.test(token)) throw new ApiErr(404, "not_found", "Ticket not found");
  const { data, error } = await c.var.db
    .from("registrations")
    .select(`full_name, organization, checked_in_at, events(${EVENT_COLUMNS})`)
    .eq("qr_token", token)
    .maybeSingle();
  if (error) throw new ApiErr(500, "internal", "Could not load ticket");
  if (!data) throw new ApiErr(404, "not_found", "Ticket not found");

  const row = data as unknown as {
    full_name: string;
    organization: string;
    checked_in_at: string | null;
    events: EventWithCount;
  };
  const body: TicketResponse = {
    ticket: {
      fullName: row.full_name,
      organization: row.organization,
      checkedInAt: row.checked_in_at,
      event: toPublicEvent(row.events),
    },
    qrSvg: qrSvg(token),
  };
  return c.json(body);
});
