/** Date helpers. Event times are always shown in Philippine time (Asia/Manila). */

const TZ = "Asia/Manila";

const full = new Intl.DateTimeFormat("en-PH", {
  timeZone: TZ,
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});
const month = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, month: "short" });
const day = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, day: "numeric" });
const weekday = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, weekday: "short" });
const time = new Intl.DateTimeFormat("en-PH", { timeZone: TZ, hour: "numeric", minute: "2-digit" });

function parse(iso: string): Date | null {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Thu, Nov 20, 2026, 9:00 AM" */
export function formatDateTime(iso: string): string {
  const d = parse(iso);
  return d ? full.format(d) : iso;
}

/** "9:00 AM" */
export function formatTime(iso: string): string {
  const d = parse(iso);
  return d ? time.format(d) : "";
}

/** Parts for a calendar-style date chip: { month: "NOV", day: "20", weekday: "THU" }. */
export function dateChip(iso: string): { month: string; day: string; weekday: string } {
  const d = parse(iso);
  if (!d) return { month: "", day: "?", weekday: "" };
  return {
    month: month.format(d).toUpperCase(),
    day: day.format(d),
    weekday: weekday.format(d).toUpperCase(),
  };
}
