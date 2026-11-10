import type { CheckinResult } from "@shared/api-types";
import type { Bindings, Db } from "../env";
import { ApiErr } from "../errors";
import type { EventRow, RegistrationRow } from "./format";

/** Calls the row-locking RPC (0003_functions.sql) and maps database errors to API errors. */
export async function insertRegistration(
  db: Db,
  args: { eventId: string; fullName: string; email: string; organization: string; contactNumber: string; token: string },
): Promise<RegistrationRow> {
  const { data, error } = await db.rpc("register_for_event", {
    p_event_id: args.eventId,
    p_full_name: args.fullName,
    p_email: args.email,
    p_organization: args.organization,
    p_contact_number: args.contactNumber,
    p_qr_token: args.token,
  });
  if (error) {
    if (error.code === "23505") throw new ApiErr(409, "duplicate_registration", "Already registered for this event");
    if (error.code === "P0001" || error.message?.includes("EVENT_FULL")) throw new ApiErr(409, "event_full", "Event is full");
    if (error.code === "P0002" || error.code === "22P02" || error.message?.includes("EVENT_NOT_FOUND")) {
      throw new ApiErr(404, "not_found", "Event not found");
    }
    console.error("register_for_event failed", error);
    throw new ApiErr(500, "internal", "Could not register");
  }
  return data as RegistrationRow;
}

/** Loads an event only if it belongs to this admin. 404 either way, so other admins' events don't leak (§6.4). */
export async function ownEvent(db: Db, eventId: string, userId: string): Promise<EventRow> {
  if (!isUuid(eventId)) throw new ApiErr(404, "not_found", "Event not found");
  const { data, error } = await db.from("events").select("*").eq("id", eventId).eq("admin_id", userId).maybeSingle();
  if (error) throw new ApiErr(500, "internal", "Could not load event");
  if (!data) throw new ApiErr(404, "not_found", "Event not found");
  return data;
}

/**
 * Check-in (§6.5). The conditional update `checked_in_at is null` means two simultaneous scans
 * of the same QR cannot both get "checked_in".
 */
export async function checkIn(db: Db, eventId: string, token: string): Promise<CheckinResult> {
  const { data: reg, error } = await db
    .from("registrations")
    .select("id, event_id, full_name, organization, checked_in_at, events(title)")
    .eq("qr_token", token)
    .maybeSingle();
  if (error) throw new ApiErr(500, "internal", "Could not look up ticket");
  if (!reg) return { result: "invalid" };

  const row = reg as unknown as {
    id: string;
    event_id: string;
    full_name: string;
    organization: string;
    checked_in_at: string | null;
    events: { title: string } | null;
  };
  if (row.event_id !== eventId) {
    return { result: "wrong_event", registration: { fullName: row.full_name, eventTitle: row.events?.title ?? "" } };
  }

  const { data: updated, error: updErr } = await db
    .from("registrations")
    .update({ checked_in_at: new Date().toISOString() })
    .eq("id", row.id)
    .is("checked_in_at", null)
    .select("checked_in_at")
    .maybeSingle();
  if (updErr) throw new ApiErr(500, "internal", "Could not check in");

  if (updated?.checked_in_at) {
    return {
      result: "checked_in",
      registration: { fullName: row.full_name, organization: row.organization, checkedInAt: updated.checked_in_at },
    };
  }

  let checkedInAt = row.checked_in_at;
  if (!checkedInAt) {
    // Lost a race with another scanner: read the winner's timestamp.
    const { data: again } = await db.from("registrations").select("checked_in_at").eq("id", row.id).maybeSingle();
    checkedInAt = again?.checked_in_at ?? new Date().toISOString();
  }
  return {
    result: "already_checked_in",
    registration: { fullName: row.full_name, organization: row.organization, checkedInAt },
  };
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

/** Optional Cloudflare Turnstile check; skipped when TURNSTILE_SECRET is not set. */
export async function verifyTurnstile(env: Bindings, token: string | undefined, ip: string | undefined) {
  if (!env.TURNSTILE_SECRET) return;
  if (!token) throw new ApiErr(400, "validation_error", "Captcha required", { turnstileToken: "captcha_required" });
  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: form });
  const out = (await res.json()) as { success?: boolean };
  if (!out.success) throw new ApiErr(400, "validation_error", "Captcha failed", { turnstileToken: "captcha_failed" });
}
