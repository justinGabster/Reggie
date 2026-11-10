/**
 * One shared pointer tracker for every Reggie on the page (a single window listener),
 * so all of them can look at the cursor / last touch.
 */
export const pointer = { x: 0, y: 0, t: 0, inside: false };

let attached = false;

function onMove(e: PointerEvent) {
  pointer.x = e.clientX;
  pointer.y = e.clientY;
  pointer.t = performance.now();
  pointer.inside = true;
}

function onOut(e: MouseEvent) {
  if (!e.relatedTarget) pointer.inside = false; // left the window
}

export function trackPointer() {
  if (attached || typeof window === "undefined") return;
  attached = true;
  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onMove, { passive: true });
  window.addEventListener("mouseout", onOut, { passive: true });
}

/** Center of the focused form field, if any (Reggie watches what you're typing into). */
export function focusedFieldCenter(): { x: number; y: number } | null {
  const el = typeof document !== "undefined" ? document.activeElement : null;
  if (!el || !(el instanceof HTMLElement) || !el.matches("input, textarea, select")) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  // Look at the caret-ish area: a bit left of center for inputs.
  return { x: r.left + Math.min(r.width * 0.35, 160), y: r.top + r.height / 2 };
}
