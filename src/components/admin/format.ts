/** Small formatting helpers shared by the admin pages. All event times are shown in Asia/Manila. */

const TZ = "Asia/Manila";

const dateTimeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const timeFmt = new Intl.DateTimeFormat("en-PH", {
  timeZone: TZ,
  hour: "numeric",
  minute: "2-digit",
});

function safeDate(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Thu, Nov 20, 2026, 9:00 AM" in Manila time. */
export function formatEventDate(iso: string): string {
  const d = safeDate(iso);
  return d ? dateTimeFmt.format(d) : iso;
}

/** "9:14 AM" in Manila time. */
export function formatTime(iso: string): string {
  const d = safeDate(iso);
  return d ? timeFmt.format(d) : "";
}

/**
 * Converts a `datetime-local` value ("2026-11-20T09:00") into an ISO string that carries the
 * user's own UTC offset ("2026-11-20T09:00:00+08:00"). Returns "" for an empty or invalid value.
 */
export function localInputToIso(value: string): string {
  if (!value) return "";
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!m) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const offsetMin = -d.getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${m[1]}T${m[2]}:${m[3]}:${m[4] ?? "00"}${sign}${hh}:${mm}`;
}

export function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** A filesystem-friendly CSV name from the event title. */
export function csvFilename(title: string): string {
  const base = title.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  return `${base || "registrants"}.csv`;
}
