import type { Database } from "@shared/db.types";
import type { AdminRegistration, PublicEvent } from "@shared/api-types";

export type EventRow = Database["public"]["Tables"]["events"]["Row"];
export type RegistrationRow = Database["public"]["Tables"]["registrations"]["Row"];

/** Columns for an event plus the registration count used for spotsLeft. */
export const EVENT_COLUMNS =
  "id, admin_id, title, description, date_time, venue, capacity, status, created_at, registrations(count)";

export type EventWithCount = EventRow & { registrations?: { count: number }[] };

export function registeredCount(row: EventWithCount): number {
  return row.registrations?.[0]?.count ?? 0;
}

export function toPublicEvent(row: EventWithCount): PublicEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    dateTime: row.date_time,
    venue: row.venue,
    capacity: row.capacity,
    spotsLeft: Math.max(0, row.capacity - registeredCount(row)),
  };
}

export function toAdminRegistration(r: RegistrationRow): AdminRegistration {
  return {
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    organization: r.organization,
    contactNumber: r.contact_number,
    emailStatus: r.email_status,
    checkedInAt: r.checked_in_at,
    createdAt: r.created_at,
  };
}

export function formatManila(iso: string): string {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/** CSV cell: quoted, with spreadsheet formula injection neutralized. */
export function csvCell(value: unknown): string {
  let s = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}
