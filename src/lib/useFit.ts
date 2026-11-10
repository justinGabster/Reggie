import { useEffect, useState, useSyncExternalStore, type RefObject } from "react";

/* ---------------------------------------------------------------- Viewport height */

let lastHeight = typeof window === "undefined" ? 800 : window.innerHeight;

function isTyping(): boolean {
  const el = typeof document === "undefined" ? null : document.activeElement;
  return !!el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT");
}

function readHeight(): number {
  const h = window.innerHeight;
  // A shrink while a field is focused is almost always the on-screen keyboard:
  // keep the old height so Reggie doesn't jump around under the user's thumb.
  if (h < lastHeight && isTyping()) return lastHeight;
  lastHeight = h;
  return h;
}

function subscribeResize(cb: () => void) {
  const onResize = () => {
    readHeight();
    cb();
  };
  window.addEventListener("resize", onResize);
  window.addEventListener("orientationchange", onResize);
  return () => {
    window.removeEventListener("resize", onResize);
    window.removeEventListener("orientationchange", onResize);
  };
}

/** window.innerHeight, ignoring on-screen-keyboard shrinks while an input is focused. */
export function useViewportHeight(): number {
  return useSyncExternalStore(
    subscribeResize,
    () => lastHeight,
    () => 800,
  );
}

/** A pixel size that scales with the viewport height: clamp(min, height * ratio, max). */
export function useFitSize(ratio: number, min: number, max: number): number {
  const h = useViewportHeight();
  return Math.round(Math.min(max, Math.max(min, h * ratio)));
}

/* ---------------------------------------------------------------- Element height */

/** The element's current content-box height (ResizeObserver), or undefined before the first measure. */
export function useElementHeight(ref: RefObject<HTMLElement | null>): number | undefined {
  const [height, setHeight] = useState<number | undefined>(undefined);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h !== undefined) setHeight(Math.round(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return height;
}
