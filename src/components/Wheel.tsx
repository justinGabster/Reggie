import { useEffect, useRef } from "react";
import { cx } from "@/components/ui";
import { useShouldReduceMotion } from "@/lib/settings";

/* iOS-style scroll wheel, shared by the date/time picker and the capacity field. */

export const ITEM_H = 36;
export const VISIBLE = 5; // odd, so one row sits in the middle
export const WHEEL_H = ITEM_H * VISIBLE;
const LOOP_COPIES = 5; // looping wheels repeat their items and quietly re-center when they settle

const mod = (a: number, n: number) => ((a % n) + n) % n;

/**
 * A scroll-snapping wheel like the iOS time picker: flick or drag it, scroll it with a mouse wheel,
 * tap a row, or use the arrow keys. Rows tilt and fade away from the middle. `loop` makes it endless.
 */
export function Wheel({
  label,
  items,
  index,
  onChange,
  loop = false,
  widthClass = "w-14 max-w-24 flex-1 sm:flex-none",
  className,
}: {
  label: string;
  items: readonly string[];
  index: number;
  onChange: (i: number) => void;
  loop?: boolean;
  /** Width classes for the wheel (the default suits the time picker). */
  widthClass?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useShouldReduceMotion();
  const n = items.length;
  const copies = loop ? LOOP_COPIES : 1;
  const home = loop ? Math.floor(copies / 2) * n : 0; // first row of the middle copy
  const rows = Array.from({ length: n * copies }, (_, k) => items[k % n]);

  const latest = useRef({ index, onChange, reduce });
  useEffect(() => {
    latest.current = { index, onChange, reduce };
  });
  const scrolling = useRef(false);
  const settleTimer = useRef<number | undefined>(undefined);
  const raf = useRef(0);

  /** Tilts / fades the rows near the middle (direct DOM writes, once per frame). */
  const paint = () => {
    const el = ref.current;
    if (!el) return;
    const c = el.scrollTop / ITEM_H;
    const lo = Math.max(0, Math.floor(c) - VISIBLE);
    const hi = Math.min(el.children.length - 1, Math.ceil(c) + VISIBLE);
    for (let k = lo; k <= hi; k++) {
      const row = el.children[k] as HTMLElement;
      const dist = k - c;
      const a = Math.abs(dist);
      row.style.opacity = String(Math.max(0.12, 1 - a * 0.34));
      row.style.transform = latest.current.reduce
        ? ""
        : `perspective(260px) rotateX(${(-dist * 24).toFixed(1)}deg) scale(${(1 - a * 0.07).toFixed(3)})`;
    }
  };

  const settle = () => {
    const el = ref.current;
    if (!el) return;
    const k = Math.round(el.scrollTop / ITEM_H);
    const i = mod(k, n);
    if (loop && k !== home + i) el.scrollTop = (home + i) * ITEM_H; // same picture, back in the middle copy
    scrolling.current = false;
    paint();
    if (i !== latest.current.index) latest.current.onChange(i);
  };

  const onScroll = () => {
    scrolling.current = true;
    if (!raf.current) {
      raf.current = requestAnimationFrame(() => {
        raf.current = 0;
        paint();
      });
    }
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(settle, 130);
  };

  const scrollToRow = (k: number) =>
    ref.current?.scrollTo({ top: k * ITEM_H, behavior: latest.current.reduce ? "auto" : "smooth" });

  // Start on the current value. Deferred a frame: the <dialog> isn't laid out until showModal().
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      if (ref.current) ref.current.scrollTop = (home + latest.current.index) * ITEM_H;
      paint();
    });
    return () => {
      cancelAnimationFrame(id);
      cancelAnimationFrame(raf.current);
      window.clearTimeout(settleTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Follow outside changes (presets, keyboard) by spinning to the nearest matching row.
  useEffect(() => {
    const el = ref.current;
    if (!el || scrolling.current) return;
    const k = Math.round(el.scrollTop / ITEM_H);
    if (mod(k, n) === index) return;
    let target = home + index;
    if (loop) {
      const base = k - mod(k, n) + index;
      target = [base - n, base, base + n].reduce((best, c) => (Math.abs(c - k) < Math.abs(best - k) ? c : best));
    }
    scrollToRow(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  const step = (delta: number) => {
    const next = loop ? mod(index + delta, n) : Math.min(n - 1, Math.max(0, index + delta));
    if (next !== index) onChange(next);
  };

  return (
    <div
      ref={ref}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuenow={index}
      aria-valuemin={0}
      aria-valuemax={n - 1}
      aria-valuetext={items[index]}
      onScroll={onScroll}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
          e.preventDefault();
          step(e.key === "ArrowUp" ? -1 : 1);
        }
      }}
      className={cx("wheel relative overflow-y-scroll rounded-[12px] focus-visible:outline-offset-0", widthClass, className)}
      style={{ height: WHEEL_H, paddingBlock: ((VISIBLE - 1) / 2) * ITEM_H }}
    >
      {rows.map((text, k) => (
        <div
          key={k}
          aria-hidden="true"
          onClick={() => scrollToRow(k)}
          className="wheel-row flex cursor-pointer items-center justify-center text-2xl font-black tabular-nums text-heading"
          style={{ height: ITEM_H }}
        >
          {text}
        </div>
      ))}
    </div>
  );
}
