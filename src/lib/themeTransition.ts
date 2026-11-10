import { flushSync } from "react-dom";
import { getSettings, type Theme } from "@/lib/settings";

const WIPE_MS = 560;

/** Keeps <meta name="theme-color"> in step with the top bar color of the active theme. */
export function syncThemeColorMeta() {
  if (typeof document === "undefined") return;
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) return;
  const color = getComputedStyle(document.documentElement).getPropertyValue("--color-topbar").trim();
  if (color) meta.content = color;
}

function prefersReducedMotion(): boolean {
  if (getSettings().reduceMotion) return true;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

type Origin = Element | { x: number; y: number } | null | undefined;

function centerOf(origin: Origin): { x: number; y: number } {
  if (origin && "getBoundingClientRect" in origin) {
    const r = origin.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  if (origin) return origin;
  return { x: window.innerWidth / 2, y: 0 };
}

/**
 * Switches the theme with a circular "wipe" that grows out of `origin` (e.g. the dark-mode switch).
 * Going dark, the dark page expands from the switch; going light, the dark page shrinks back into it.
 * Falls back to an instant switch without the View Transitions API or when motion is reduced.
 */
export function switchTheme(next: Theme, setTheme: (t: Theme) => void, origin?: Origin) {
  const apply = () => {
    setTheme(next);
    syncThemeColorMeta();
  };

  const doc = document as Document & {
    startViewTransition?: (cb: () => void) => { ready: Promise<void>; finished: Promise<void> };
  };
  if (typeof doc.startViewTransition !== "function" || prefersReducedMotion()) {
    apply();
    return;
  }

  const { x, y } = centerOf(origin);
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const shrink = next === "light";
  const root = document.documentElement;
  root.classList.add("theme-wipe");
  root.classList.toggle("theme-wipe-shrink", shrink);

  let transition: { ready: Promise<void>; finished: Promise<void> };
  try {
    transition = doc.startViewTransition.call(document, () => {
      flushSync(apply);
    });
  } catch {
    root.classList.remove("theme-wipe", "theme-wipe-shrink");
    apply();
    return;
  }

  const small = `circle(0px at ${x}px ${y}px)`;
  const big = `circle(${radius}px at ${x}px ${y}px)`;
  transition.ready
    .then(() => {
      root.animate(
        { clipPath: shrink ? [big, small] : [small, big] },
        {
          duration: WIPE_MS,
          easing: shrink ? "cubic-bezier(0.4, 0, 0.8, 0.6)" : "cubic-bezier(0.2, 0.6, 0.35, 1)",
          fill: "forwards",
          pseudoElement: shrink ? "::view-transition-old(root)" : "::view-transition-new(root)",
        },
      );
    })
    .catch(() => {
      /* transition skipped; the theme is already applied */
    });
  transition.finished
    .catch(() => undefined)
    .then(() => root.classList.remove("theme-wipe", "theme-wipe-shrink"));
}
