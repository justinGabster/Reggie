import type { Stats } from "@shared/api-types";
import { copy } from "@/lib/copy";

type Tile = { key: string; value: string; label: string; border: string; text: string };

/** Three stat tiles: Registered (maroon), Checked In (green), Email Failed (red). */
export default function StatTiles({ stats }: { stats: Stats }) {
  const tiles: Tile[] = [
    {
      key: "registered",
      value: `${stats.registered}/${stats.capacity}`,
      label: copy.admin.stats.registered,
      border: "border-maroon",
      text: "text-heading",
    },
    {
      key: "checked",
      value: String(stats.checkedIn),
      label: copy.admin.stats.checkedIn,
      border: "border-success",
      text: "text-success",
    },
    {
      key: "failed",
      value: String(stats.emailFailed),
      label: copy.admin.stats.emailFailed,
      border: "border-error",
      text: stats.emailFailed > 0 ? "text-error" : "text-fg",
    },
  ];

  return (
    <ul className="grid grid-cols-3 gap-2 sm:gap-4" aria-label="Event stats">
      {tiles.map((t) => (
        <li
          key={t.key}
          className={`ledge flex min-w-0 flex-col items-center justify-center rounded-[18px] border-2 bg-card px-2 py-3 text-center short:py-2 sm:py-4 ${t.border}`}
        >
          <span className={`text-2xl font-black leading-none tabular-nums sm:text-3xl ${t.text}`}>{t.value}</span>
          <span className="mt-1 text-[11px] font-extrabold uppercase tracking-wide text-fg sm:text-xs">{t.label}</span>
        </li>
      ))}
    </ul>
  );
}
