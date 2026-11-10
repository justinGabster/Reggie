import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { CheckinResult } from "@shared/api-types";
import Reggie from "@/components/reggie/Reggie";
import type { Mood } from "@/components/reggie/moods";
import { copy, fill } from "@/lib/copy";
import { firstName, formatTime } from "./format";

/** A check-in result, or a local failure (network/server) shown in the same sheet. */
export type ScanOutcome = CheckinResult | { result: "error"; message: string };

/** One sheet per scan; `id` changes for every new result so the sheet re-animates and the timer restarts. */
export type ScanSheetItem = { id: number; outcome: ScanOutcome };

type View = {
  badge: string;
  icon: string;
  title: string;
  detail?: string;
  line: string;
  mood: Mood;
  /** Classes for the colored top edge and badge. */
  edge: string;
  badgeClass: string;
};

function viewFor(o: ScanOutcome): View {
  switch (o.result) {
    case "checked_in":
      return {
        badge: "CHECKED IN",
        icon: "✓",
        title: o.registration.fullName,
        detail: o.registration.organization,
        line: fill(copy.scan.checked_in, { name: firstName(o.registration.fullName) }),
        mood: "success",
        edge: "border-success",
        badgeClass: "bg-success-fill text-success border-success",
      };
    case "already_checked_in": {
      const t = formatTime(o.registration.checkedInAt);
      return {
        badge: t ? `ALREADY CHECKED IN · ${t}` : "ALREADY CHECKED IN",
        icon: "🕘",
        title: o.registration.fullName,
        detail: o.registration.organization,
        line: t ? fill(copy.scan.alreadyAt, { time: t }) : copy.scan.already,
        mood: "eyebrow",
        edge: "border-goldenrod",
        badgeClass: "bg-goldenrod text-maroon border-goldenrod",
      };
    }
    case "wrong_event":
      return {
        badge: "WRONG EVENT",
        icon: "⇄",
        title: o.registration.fullName,
        detail: `Registered for: ${o.registration.eventTitle}`,
        line: copy.scan.wrong_event,
        mood: "confused",
        edge: "border-maroon",
        badgeClass: "bg-maroon text-white border-maroon",
      };
    case "invalid":
      return {
        badge: "INVALID QR",
        icon: "✕",
        title: "Hindi valid ang code.",
        line: copy.scan.invalid,
        mood: "confused",
        edge: "border-danger",
        badgeClass: "bg-danger text-white border-danger",
      };
    case "error":
      return {
        badge: "HINDI NA-CHECK",
        icon: "!",
        title: o.message,
        line: copy.app.retry,
        mood: "sad",
        edge: "border-error",
        badgeClass: "bg-error-fill text-error border-error",
      };
  }
}

/** Text announced to screen readers for a result. */
export function announce(o: ScanOutcome): string {
  const v = viewFor(o);
  return [v.badge, v.title, v.detail, v.line].filter(Boolean).join(". ");
}

const TAP_TO_CLOSE = "Tap to close";

type Props = {
  item: ScanSheetItem | null;
  onDismiss: () => void;
  /** Auto-dismiss delay in ms. */
  duration?: number;
};

/** Bottom sheet that slides up for each scan result, colored per outcome, with Reggie reacting. */
export default function ScanResultSheet({ item, onDismiss, duration = 3000 }: Props) {
  const reduce = useReducedMotion();

  useEffect(() => {
    if (!item) return;
    const t = window.setTimeout(onDismiss, duration);
    return () => window.clearTimeout(t);
  }, [item, onDismiss, duration]);

  const view = item ? viewFor(item.outcome) : null;

  return (
    <>
      {/* Persistent live region so every result is announced, even if the sheet is already open. */}
      <div className="sr-only" aria-live="assertive" aria-atomic="true">
        {item ? announce(item.outcome) : ""}
      </div>

      <AnimatePresence>
        {item && view && (
          <motion.div
            key={item.id}
            role="button"
            tabIndex={0}
            aria-label={`${view.badge}. Tap to dismiss.`}
            onClick={onDismiss}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
                e.preventDefault();
                onDismiss();
              }
            }}
            initial={reduce ? { opacity: 0 } : { y: "110%" }}
            animate={reduce ? { opacity: 1 } : { y: 0 }}
            exit={reduce ? { opacity: 0 } : { y: "110%" }}
            transition={{ type: "spring", stiffness: 420, damping: 36 }}
            className={`fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[960px] cursor-pointer rounded-t-[28px] border-t-[6px] bg-card px-4 pt-4 text-fg shadow-[0_-8px_24px_rgba(0,0,0,0.25)] outline-none focus-visible:ring-4 focus-visible:ring-focus ${view.edge}`}
            style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-line" aria-hidden="true" />
            <div className="flex items-center gap-3">
              <div className="shrink-0">
                <Reggie mood={view.mood} size={96} showBall={false} />
              </div>
              <div className="min-w-0 flex-1">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1 text-xs font-black uppercase tracking-wide ${view.badgeClass}`}
                >
                  <span aria-hidden="true">{view.icon}</span>
                  {view.badge}
                </span>
                <p className="mt-2 truncate text-lg font-black text-heading">{view.title}</p>
                {view.detail && <p className="truncate text-sm font-semibold text-fg">{view.detail}</p>}
                <p className="mt-2 inline-block rounded-2xl border-2 border-line bg-bg px-3 py-1.5 text-sm font-bold text-fg">
                  {view.line}
                </p>
              </div>
            </div>
            <p className="mt-3 text-center text-xs font-semibold text-fg opacity-70">{TAP_TO_CLOSE}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
