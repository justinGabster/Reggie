import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { useAnimate } from "framer-motion";
import { Reggie } from "@/components/reggie/Reggie";
import { ReggieBubble } from "@/components/reggie/ReggieBubble";
import type { Mood } from "@/components/reggie/moods";
import { Button, cx } from "@/components/ui";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from "@/components/icons";
import { copy, fill } from "@/lib/copy";
import { playSound } from "@/lib/sound";
import { useShouldReduceMotion } from "@/lib/settings";
import { ITEM_H, WHEEL_H, Wheel } from "@/components/Wheel";

/**
 * Reggie-styled date + time picker that replaces the browser's `datetime-local` popup.
 *
 * The value format is the same as `datetime-local` ("2026-11-20T09:00", browser time zone), so it
 * plugs straight into `localInputToIso`. The trigger looks like a Field; tapping it opens a native
 * <dialog> (focus trap, Esc to cancel) that is a bottom sheet on phones and a card on desktop.
 * Changes are a draft until "Ayos na"; Esc / backdrop cancels.
 */

const C = copy.picker;

/* ------------------------------------------------------------------ date helpers (local time) */

type Ymd = { y: number; m: number; d: number }; // m is 0-11

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (a: Ymd) => `${a.y}-${pad(a.m + 1)}-${pad(a.d)}`;
const sameDay = (a: Ymd | null, b: Ymd | null) => !!a && !!b && keyOf(a) === keyOf(b);
const before = (a: Ymd, b: Ymd) => keyOf(a) < keyOf(b);
const daysIn = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const toDate = (a: Ymd, h = 0, min = 0) => new Date(a.y, a.m, a.d, h, min);

function fromDate(t: Date): Ymd {
  return { y: t.getFullYear(), m: t.getMonth(), d: t.getDate() };
}
function addDays(a: Ymd, n: number): Ymd {
  return fromDate(new Date(a.y, a.m, a.d + n));
}
function addMonths(a: Ymd, n: number): Ymd {
  const t = new Date(a.y, a.m + n, 1);
  return { y: t.getFullYear(), m: t.getMonth(), d: Math.min(a.d, daysIn(t.getFullYear(), t.getMonth())) };
}
function todayYmd(): Ymd {
  return fromDate(new Date());
}

/** Today's date as "YYYY-MM-DD" (for `minDate`). */
export function todayKey(): string {
  return keyOf(todayYmd());
}

function parseYmd(s: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
}

function parseValue(v: string): { date: Ymd; h: number; min: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
  if (!m) return null;
  return { date: { y: +m[1], m: +m[2] - 1, d: +m[3] }, h: +m[4], min: +m[5] };
}

const buildValue = (date: Ymd, h: number, min: number) => `${keyOf(date)}T${pad(h)}:${pad(min)}`;

const fmtShort = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
const fmtBubble = new Intl.DateTimeFormat("en-PH", { weekday: "short", month: "short", day: "numeric" });
const fmtLong = new Intl.DateTimeFormat("en-PH", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const fmtMonth = new Intl.DateTimeFormat("en-PH", { month: "long" });
const fmtTime = new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit" });

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

/* ------------------------------------------------------------------ small art */

/** Reggie's paw print: marks today on the calendar. */
function Paw({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" width="11" height="11" aria-hidden="true" className={className} fill="currentColor">
      <ellipse cx="10" cy="13.4" rx="4.6" ry="3.9" />
      <ellipse cx="3.6" cy="8.6" rx="1.9" ry="2.4" transform="rotate(-18 3.6 8.6)" />
      <ellipse cx="7.6" cy="4.6" rx="1.9" ry="2.5" transform="rotate(-6 7.6 4.6)" />
      <ellipse cx="12.4" cy="4.6" rx="1.9" ry="2.5" transform="rotate(6 12.4 4.6)" />
      <ellipse cx="16.4" cy="8.6" rx="1.9" ry="2.4" transform="rotate(18 16.4 8.6)" />
    </svg>
  );
}

/* ------------------------------------------------------------------ the field (trigger) */

export type DateTimeFieldProps = {
  label: string;
  name: string;
  id?: string;
  /** "YYYY-MM-DDTHH:mm" in the browser's time zone, or "". */
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  /** Called after the picker closes (with the parent already holding the new value). */
  onBlur?: () => void;
  /** Already-translated message. */
  error?: string;
  hint?: string;
  disabled?: boolean;
  /** Earliest pickable day, "YYYY-MM-DD" (e.g. todayKey()). */
  minDate?: string;
  className?: string;
};

export function DateTimeField({
  label,
  name,
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  error,
  hint,
  disabled,
  minDate,
  className,
}: DateTimeFieldProps) {
  const autoId = useId();
  const fieldId = id ?? `field-${name}-${autoId.replace(/:/g, "")}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const reduce = useShouldReduceMotion();
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const [open, setOpen] = useState(false);
  const [pendingBlur, setPendingBlur] = useState(false);

  useEffect(() => {
    if (error && !reduce && scope.current) {
      void animate(scope.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.35 });
    }
  }, [error, reduce, animate, scope]);

  // Fire onBlur one render after closing, so the parent validates the value it just received.
  useEffect(() => {
    if (!pendingBlur) return;
    setPendingBlur(false);
    onBlur?.();
  }, [pendingBlur, onBlur]);

  const parsed = parseValue(value);
  const when = parsed ? toDate(parsed.date, parsed.h, parsed.min) : null;

  return (
    <div className={cx("flex flex-col gap-1.5 short:gap-1", className)}>
      <label htmlFor={fieldId} className="text-sm font-black uppercase tracking-wide text-heading short:text-xs">
        {label}
      </label>
      <div ref={scope}>
        <button
          id={fieldId}
          type="button"
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(" ") || undefined}
          onClick={() => {
            setOpen(true);
            onFocus?.();
          }}
          className={cx(
            "group flex h-[50px] w-full items-center gap-3 rounded-[14px] border-2 bg-card px-4 text-left text-base font-bold text-fg short:h-11",
            "transition-[border-color,box-shadow,background-color] duration-150",
            "focus:outline-none focus-visible:outline-none focus:border-focus focus:shadow-[0_0_0_4px_var(--focus-glow)]",
            "disabled:opacity-50",
            error ? "border-error bg-error-fill" : "border-line",
          )}
        >
          <CalendarIcon size={22} className="shrink-0 text-heading" />
          {when ? (
            <span className="min-w-0 flex-1 truncate">
              {fmtShort.format(when)}
              <span className="text-fg/45"> · </span>
              <span className="font-black text-heading">{fmtTime.format(when)}</span>
            </span>
          ) : (
            <span className="min-w-0 flex-1 truncate font-semibold text-fg/45">{C.placeholder}</span>
          )}
        </button>
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-extrabold leading-snug text-error short:text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm font-semibold leading-snug text-fg/70 short:text-xs">
          {hint}
        </p>
      ) : null}

      {open && (
        <PickerSheet
          title={label}
          value={value}
          minDate={minDate}
          onCommit={onChange}
          onClosed={() => {
            setOpen(false);
            setPendingBlur(true);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ the sheet */

function PickerSheet({
  title,
  value,
  minDate,
  onCommit,
  onClosed,
}: {
  title: string;
  value: string;
  minDate?: string;
  onCommit: (v: string) => void;
  onClosed: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const today = todayYmd();
  const min = minDate ? parseYmd(minDate) : null;

  const [initial] = useState(() => parseValue(value));
  const [start] = useState<Ymd>(() => initial?.date ?? (min && before(today, min) ? min : today));
  const [date, setDate] = useState<Ymd | null>(initial?.date ?? null);
  const [hour, setHour] = useState(initial?.h ?? 9); // 0-23
  const [minute, setMinute] = useState(initial?.min ?? 0);
  const [view, setView] = useState({ y: start.y, m: start.m });
  const [focus, setFocus] = useState<Ymd>(start);
  const [slide, setSlide] = useState<"next" | "prev" | null>(null);
  const [popKey, setPopKey] = useState(0);
  const dayRefs = useRef(new Map<string, HTMLButtonElement>());
  const moveDomFocus = useRef(false);

  const isDisabled = (d: Ymd) => !!min && before(d, min);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    }
    const raf = requestAnimationFrame(() => dayRefs.current.get(keyOf(start))?.focus());
    return () => cancelAnimationFrame(raf);
  }, [start]);

  useEffect(() => {
    if (!moveDomFocus.current) return;
    moveDomFocus.current = false;
    dayRefs.current.get(keyOf(focus))?.focus();
  }, [focus]);

  function showMonth(y: number, m: number) {
    if (y === view.y && m === view.m) return;
    setSlide(y * 12 + m > view.y * 12 + view.m ? "next" : "prev");
    setView({ y, m });
  }

  function goMonth(delta: number) {
    const t = new Date(view.y, view.m + delta, 1);
    showMonth(t.getFullYear(), t.getMonth());
    setFocus((f) => addMonths({ y: view.y, m: view.m, d: f.d }, delta));
  }

  function moveFocus(next: Ymd) {
    const n = min && before(next, min) ? min : next;
    moveDomFocus.current = true;
    setFocus(n);
    showMonth(n.y, n.m);
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    const wd = toDate(focus).getDay();
    const moves: Record<string, () => Ymd> = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -wd),
      End: () => addDays(focus, 6 - wd),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
    };
    const move = moves[e.key];
    if (!move) return;
    e.preventDefault();
    moveFocus(move());
  }

  function pick(d: Ymd) {
    if (isDisabled(d)) return;
    setDate(d);
    setFocus(d);
    setPopKey((k) => k + 1);
    playSound("pop");
  }

  function close() {
    const d = ref.current;
    if (d?.open) d.close();
    else onClosed();
  }

  // Time: like iOS, the hour wheel keeps the current AM/PM; the period has its own wheel.
  const setHour12 = (i: number) => setHour((h) => ((i + 1) % 12) + (h >= 12 ? 12 : 0));
  const setPm = (pm: boolean) => setHour((h) => (pm ? (h < 12 ? h + 12 : h) : h >= 12 ? h - 12 : h));
  const isPm = hour >= 12;

  // Reggie reacts to the draft.
  const past = date ? before(date, today) : false;
  const mood: Mood = !date ? "eyebrow" : past ? "confused" : "success";
  const bubble = !date
    ? C.bubbleEmpty
    : past
      ? C.bubblePast
      : fill(C.bubblePicked, { date: fmtBubble.format(toDate(date)), time: fmtTime.format(toDate(date, hour, minute)) });

  // Six fixed rows keep the sheet the same height every month.
  const first = new Date(view.y, view.m, 1).getDay();
  const dim = daysIn(view.y, view.m);
  const prevDim = daysIn(view.y, view.m - 1);
  type Cell = { kind: "ghost"; n: number } | { kind: "day"; day: Ymd };
  const cells = Array.from({ length: 42 }, (_, i): Cell => {
    const n = i - first + 1;
    if (n < 1) return { kind: "ghost", n: prevDim + n };
    if (n > dim) return { kind: "ghost", n: n - dim };
    return { kind: "day", day: { y: view.y, m: view.m, d: n } };
  });
  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const viewingToday = view.y === today.y && view.m === today.m;
  const prevBlocked = !!min && (view.y < min.y || (view.y === min.y && view.m <= min.m));

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClosed}
      onClick={(e) => {
        if (e.target === e.currentTarget) close(); // backdrop
      }}
    >
      <div className="cal-sheet max-h-[100dvh] overflow-y-auto overscroll-contain rounded-t-[24px] border-2 border-b-0 border-line bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-fg short:p-4 short:pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-[24px] sm:border-b-2 sm:ledge">
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>

        {/* Reggie reads back what you picked. */}
        <div className="mb-4 flex items-center gap-3 short:mb-3 xshort:hidden">
          <Reggie mood={mood} size={64} showBall={false} className="shrink-0" />
          <ReggieBubble tail="left" className="flex-1 py-2.5 text-[15px] leading-snug">
            {bubble}
          </ReggieBubble>
        </div>

        {/* Month header */}
        <div className="mb-3 flex items-center gap-2 short:mb-2">
          <p aria-live="polite" className="min-w-0 flex-1 truncate text-xl font-black text-heading">
            {fmtMonth.format(new Date(view.y, view.m, 1))} <span className="text-fg/50">{view.y}</span>
          </p>
          {!viewingToday && (
            <button
              type="button"
              onClick={() => {
                showMonth(today.y, today.m);
                setFocus(today);
              }}
              className="rounded-full bg-secondary px-3 py-1 text-xs font-black uppercase tracking-wide text-secondary-fg shadow-[0_3px_0_var(--color-secondary-ledge)] active:translate-y-[3px] active:shadow-none"
            >
              {C.today}
            </button>
          )}
          <NavButton label={C.prevMonth} onClick={() => goMonth(-1)} disabled={prevBlocked}>
            <ChevronLeftIcon size={22} strokeWidth={3} />
          </NavButton>
          <NavButton label={C.nextMonth} onClick={() => goMonth(1)}>
            <ChevronRightIcon size={22} strokeWidth={3} />
          </NavButton>
        </div>

        {/* Calendar */}
        <div role="grid" aria-labelledby={titleId} onKeyDown={onGridKey} className="select-none">
          <div role="row" className="mb-1 grid grid-cols-7 gap-1">
            {WEEKDAYS.map((w, i) => (
              <span
                key={w}
                role="columnheader"
                aria-label={w}
                className={cx(
                  "text-center text-[11px] font-black tracking-wider",
                  i === 0 || i === 6 ? "text-heading" : "text-fg/55",
                )}
              >
                {w}
              </span>
            ))}
          </div>
          <div
            key={`${view.y}-${view.m}`}
            className={cx("flex flex-col gap-1", slide === "next" && "cal-in-next", slide === "prev" && "cal-in-prev")}
          >
            {rows.map((row, r) => (
              <div role="row" key={r} className="grid grid-cols-7 gap-1">
                {row.map((cell, c) => {
                  if (cell.kind === "ghost") {
                    return (
                      <span
                        key={c}
                        role="gridcell"
                        aria-hidden="true"
                        className="grid h-10 place-items-center text-[15px] font-bold tabular-nums text-fg/20 short:h-9"
                      >
                        {cell.n}
                      </span>
                    );
                  }
                  const d = cell.day;
                  const k = keyOf(d);
                  const selected = sameDay(d, date);
                  const isToday = sameDay(d, today);
                  const off = isDisabled(d);
                  return (
                    <div role="gridcell" key={k} aria-selected={selected}>
                      <button
                        type="button"
                        ref={(el) => {
                          if (el) dayRefs.current.set(k, el);
                          else dayRefs.current.delete(k);
                        }}
                        tabIndex={sameDay(d, focus) ? 0 : -1}
                        aria-disabled={off || undefined}
                        aria-current={isToday ? "date" : undefined}
                        aria-label={fmtLong.format(toDate(d))}
                        onClick={() => pick(d)}
                        onFocus={() => {
                          if (!sameDay(d, focus)) setFocus(d);
                        }}
                        className={cx(
                          "relative grid h-10 w-full place-items-center rounded-[12px] text-[15px] font-extrabold tabular-nums transition-colors duration-100 short:h-9",
                          selected
                            ? "text-primary-fg"
                            : off
                              ? "cursor-not-allowed text-fg/25"
                              : cx("hover:bg-fg/10 active:bg-fg/15", isToday ? "font-black text-heading" : "text-fg"),
                        )}
                      >
                        {selected && (
                          <span
                            key={popKey}
                            aria-hidden="true"
                            className="cal-pop absolute inset-0 rounded-[12px] bg-primary shadow-[0_3px_0_var(--color-primary-ledge)]"
                          />
                        )}
                        <span className="relative">{d.d}</span>
                        {isToday && (
                          <Paw
                            className={cx(
                              "absolute bottom-[2px] left-1/2 -translate-x-1/2",
                              selected ? "text-primary-fg" : "text-progress",
                            )}
                          />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Time */}
        <div className="mt-4 border-t-2 border-line/40 pt-4 short:mt-3 short:pt-3">
          <p className="mb-2 text-sm font-black uppercase tracking-wide text-heading short:text-xs">{C.time}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            {/* iOS-style wheels: hour : minute  AM/PM, with one highlight band across all three. */}
            <div
              className="relative flex w-full shrink-0 items-stretch justify-center rounded-[18px] border-2 border-line bg-card px-2 ledge sm:w-auto"
              style={{ height: WHEEL_H + 4 }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-1.5 top-1/2 -translate-y-1/2 rounded-[12px] bg-secondary shadow-[0_3px_0_var(--color-secondary-ledge)]"
                style={{ height: ITEM_H }}
              />
              <Wheel label={C.hour} items={HOURS} index={(hour % 12 || 12) - 1} loop onChange={setHour12} />
              <span aria-hidden="true" className="relative flex items-center pb-1 text-2xl font-black text-heading">
                :
              </span>
              <Wheel label={C.minute} items={MINUTES} index={minute} loop onChange={setMinute} />
              <Wheel label={C.period} items={PERIODS} index={isPm ? 1 : 0} onChange={(i) => setPm(i === 1)} className="ml-1" />
            </div>

            {/* One-tap common start times */}
            <div className="flex w-full gap-2 sm:w-auto sm:flex-1 sm:flex-col">
              {C.presets.map((p) => {
                const on = hour === p.h && minute === 0;
                return (
                  <button
                    key={p.h}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setHour(p.h);
                      setMinute(0);
                    }}
                    className={cx(
                      "flex-1 whitespace-nowrap rounded-full border-2 px-2 py-1.5 text-center text-[11px] font-black uppercase tracking-wide transition-colors sm:flex-none sm:px-3 sm:text-left sm:text-xs",
                      on ? "border-primary bg-primary text-primary-fg" : "border-line text-fg hover:bg-fg/10",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-2 short:mt-4">
          {(initial || date) && (
            <Button
              variant="ghost"
              onClick={() => {
                onCommit("");
                close();
              }}
            >
              {C.clear}
            </Button>
          )}
          <Button
            variant="primary"
            full
            className="flex-1"
            disabled={!date}
            onClick={() => {
              if (!date) return;
              onCommit(buildValue(date, hour, minute));
              playSound("success");
              close();
            }}
          >
            {C.done}
          </Button>
        </div>
      </div>
    </dialog>
  );
}

function NavButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border-2 border-line bg-card text-heading ledge transition-[transform,box-shadow] duration-75 active:translate-y-1 active:shadow-none disabled:opacity-30 disabled:shadow-none"
    >
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ iOS-style wheel */

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTES = Array.from({ length: 60 }, (_, i) => pad(i));
const PERIODS = ["AM", "PM"];

export default DateTimeField;
