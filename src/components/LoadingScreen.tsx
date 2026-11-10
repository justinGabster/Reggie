import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Reggie } from "@/components/reggie/Reggie";
import { copy } from "@/lib/copy";
import { useShouldReduceMotion } from "@/lib/settings";

/**
 * Full-screen loading page: a gold circle grows out of the middle of the screen and Reggie runs
 * around in it. Used instead of the little spinning ring for page-level loads.
 *
 * It starts immediately (delayMs can add a wait if full-screen flashes on fast loads feel too busy).
 * With reduced motion the circle is replaced by a plain fade and Reggie holds still.
 */
export function LoadingScreen({ delayMs = 0 }: { delayMs?: number }) {
  const reduce = useShouldReduceMotion();
  const [visible, setVisible] = useState(delayMs <= 0);
  const [line, setLine] = useState(0);
  const lines = copy.app.loadingLines;

  useEffect(() => {
    if (visible) return;
    const t = window.setTimeout(() => setVisible(true), delayMs);
    return () => window.clearTimeout(t);
  }, [visible, delayMs]);

  useEffect(() => {
    if (!visible) return;
    const t = window.setInterval(() => setLine((l) => (l + 1) % lines.length), 1800);
    return () => window.clearInterval(t);
  }, [visible, lines.length]);

  if (!visible) {
    // Keep the loading state announced even while the visual waits.
    return <div role="status" aria-busy="true" className="sr-only">{copy.app.loading}</div>;
  }

  return (
    <motion.div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-secondary text-secondary-fg"
      initial={reduce ? { opacity: 0 } : { clipPath: "circle(0% at 50% 50%)" }}
      animate={reduce ? { opacity: 1 } : { clipPath: "circle(75% at 50% 50%)" }}
      transition={{ duration: reduce ? 0.15 : 0.35, ease: [0.2, 0.7, 0.3, 1] }}
    >
      <Reggie mood="loading" size={Math.min(190, Math.round(window.innerHeight * 0.3))} showBall={false} />
      <p className="px-6 text-center text-xl font-black">{lines[line]}</p>
      <span aria-hidden="true" className="flex gap-1.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-2.5 w-2.5 rounded-full bg-secondary-fg"
            animate={reduce ? undefined : { y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
    </motion.div>
  );
}

export default LoadingScreen;
