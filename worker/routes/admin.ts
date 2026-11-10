import { Hono } from "hono";
import { checkinInput, eventInput, eventPatch } from "@shared/schemas";
import type { AdminEvent, Stats } from "@shared/api-types";
import type { Database } from "@shared/db.types";
import type { AppEnv } from "../env";
import { ApiErr, parseJson } from "../errors";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  EVENT_COLUMNS,
  csvCell,
  registeredCount,
  toAdminRegistration,
  toPublicEvent,
  type EventWithCount,
  type RegistrationRow,
} from "../services/format";
import { checkIn, isUuid, ownEvent } from "../services/registrations";
import { sendTicketEmail } from "../services/email";

export const adminRoutes = new Hono<AppEnv>();
adminRoutes.use("*", requireAdmin);

function toAdminEvent(row: EventWithCount, checkedIn: number): AdminEvent {
  return {
    ...toPublicEvent(row),
    status: row.status,
    registeredCount: registeredCount(row),
    checkedInCount: checkedIn,
    createdAt: row.created_at,
  };
}

async function checkedInCounts(c: { var: AppEnv["Variables"] }, eventIds: string[]) {
  const counts = new Map<string, number>();
  if (eventIds.length === 0) return counts;
  const { data, error } = await c.var.db
    .from("registrations")
    .select("event_id")
    .in("event_id", eventIds)
    .not("checked_in_at", "is", null);
  if (error) throw new ApiErr(500, "internal", "Could not load stats");
  for (const r of data) counts.set(r.event_id, (counts.get(r.event_id) ?? 0) + 1);
  return counts;
}

async function loadAdminEvent(c: { var: AppEnv["Variables"] }, id: string): Promise<AdminEvent> {
  const { data, error } = await c.var.db
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("id", id)
    .eq("admin_id", c.var.userId)
    .maybeSingle();
  if (error) throw new ApiErr(500, "internal", "Could not load event");
  if (!data) throw new ApiErr(404, "not_found", "Event not found");
  const counts = await checkedInCounts(c, [id]);
  return toAdminEvent(data as unknown as EventWithCount, counts.get(id) ?? 0);
}

// GET /api/admin/events: my events only.
adminRoutes.get("/events", async (c) => {
  const { data, error } = await c.var.db
    .from("events")
    .select(EVENT_COLUMNS)
    .eq("admin_id", c.var.userId)
    .order("date_time", { ascending: true });
  if (error) throw new ApiErr(500, "internal", "Could not load events");
  const rows = data as unknown as EventWithCount[];
  const counts = await checkedInCounts(c, rows.map((r) => r.id));
  return c.json({ events: rows.map((r) => toAdminEvent(r, counts.get(r.id) ?? 0)) });
});

// GET /api/admin/events/:id
adminRoutes.get("/events/:id", async (c) => {
  const id = c.req.param("id");
  if (!isUuid(id)) throw new ApiErr(404, "not_found", "Event not found");
  return c.json({ event: await loadAdminEvent(c, id) });
});

// POST /api/admin/events: new events start as drafts.
adminRoutes.post("/events", async (c) => {
  const input = await parseJson(c, eventInput);
  const { data, error } = await c.var.db
    .from("events")
    .insert({
      admin_id: c.var.userId,
      title: input.title,
      description: input.description,
      date_time: input.dateTime,
      venue: input.venue,
      capacity: input.capacity,
      status: "draft",
    })
    .select("id")
    .single();
  if (error || !data) throw new ApiErr(500, "internal", "Could not create event");
  return c.json({ event: await loadAdminEvent(c, data.id) }, 201);
});

// PATCH /api/admin/events/:id: edit fields and/or publish/unpublish.
adminRoutes.patch("/events/:id", async (c) => {
  const id = c.req.param("id");
  await ownEvent(c.var.db, id, c.var.userId);
  const p = await parseJson(c, eventPatch);
  const update: Database["public"]["Tables"]["events"]["Update"] = {};
  if (p.title !== undefined) update.title = p.title;
  if (p.description !== undefined) update.description = p.description;
  if (p.dateTime !== undefined) update.date_time = p.dateTime;
  if (p.venue !== undefined) update.venue = p.venue;
  if (p.capacity !== undefined) update.capacity = p.capacity;
  if (p.status !== undefined) update.status = p.status;
  if (Object.keys(update).length > 0) {
    const { error } = await c.var.db.from("events").update(update).eq("id", id).eq("admin_id", c.var.userId);
    if (error) throw new ApiErr(500, "internal", "Could not update event");
  }
  return c.json({ event: await loadAdminEvent(c, id) });
});

// DELETE /api/admin/events/:id: removes the event and (via ON DELETE CASCADE) all its registrations.
adminRoutes.delete("/events/:id", async (c) => {
  const id = c.req.param("id");
  await ownEvent(c.var.db, id, c.var.userId); // 404 if missing or someone else's
  const { error } = await c.var.db.from("events").delete().eq("id", id).eq("admin_id", c.var.userId);
  if (error) throw new ApiErr(500, "internal", "Could not delete event");
  return c.json({ ok: true as const });
});

// GET /api/admin/events/:id/registrations (?format=csv)
adminRoutes.get("/events/:id/registrations", async (c) => {
  const id = c.req.param("id");
  const event = await ownEvent(c.var.db, id, c.var.userId);
  const { data, error } = await c.var.db
    .from("registrations")
    .select("*")
    .eq("event_id", id)
    .order("created_at", { ascending: true });
  if (error) throw new ApiErr(500, "internal", "Could not load registrants");
  const rows = data as RegistrationRow[];
  const registrations = rows.map(toAdminRegistration);

  if (c.req.query("format") === "csv") {
    const header = ["Full Name", "Email", "Organization", "Contact Number", "Email Status", "Checked In At", "Registered At"];
    const lines = registrations.map((r) =>
      [r.fullName, r.email, r.organization, r.contactNumber, r.emailStatus, r.checkedInAt ?? "", r.createdAt]
        .map(csvCell)
        .join(","),
    );
    const csv = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");
    const filename = `${event.title.replace(/[^\w-]+/g, "-").slice(0, 40) || "registrants"}.csv`;
    return c.body(csv, 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    });
  }

  const stats: Stats = {
    registered: rows.length,
    checkedIn: rows.filter((r) => r.checked_in_at).length,
    capacity: event.capacity,
    emailFailed: rows.filter((r) => r.email_status === "failed").length,
  };
  return c.json({ registrations, stats });
});

// POST /api/admin/events/:id/checkin: always 200 with a result (§6.3).
adminRoutes.post("/events/:id/checkin", async (c) => {
  const id = c.req.param("id");
  await ownEvent(c.var.db, id, c.var.userId);
  const { token } = await parseJson(c, checkinInput);
  return c.json(await checkIn(c.var.db, id, token));
});

// POST /api/admin/registrations/:id/resend
adminRoutes.post("/registrations/:id/resend", async (c) => {
  const id = c.req.param("id");
  if (!isUuid(id)) throw new ApiErr(404, "not_found", "Registration not found");
  const db = c.var.db;
  const { data: reg, error } = await db.from("registrations").select("*").eq("id", id).maybeSingle();
  if (error) throw new ApiErr(500, "internal", "Could not load registration");
  if (!reg) throw new ApiErr(404, "not_found", "Registration not found");
  const event = await ownEvent(db, reg.event_id, c.var.userId); // 404 if it's another admin's event

  await db.from("registrations").update({ email_status: "pending" }).eq("id", id);
  const attempt = Date.now(); // new idempotency key per manual resend
  c.executionCtx.waitUntil(sendTicketEmail(c.env, db, reg, event, attempt));
  return c.json({ emailStatus: "pending" as const }, 202);
});
