import { useMemo } from "react";
import { motion } from "framer-motion";
import { useShouldReduceMotion } from "@/lib/settings";

const COLORS = ["#800000", "#FFDF00", "#DAA520", "#5C0000", "#FFDF00"];

type Piece = { left: number; delay: number; duration: number; drift: number; spin: number; w: number; h: number; color: string; round: boolean };

function makePieces(count: number): Piece[] {
  return Array.from({ length: count }, (_, i) => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.5,
    duration: 1.8 + Math.random() * 1.4,
    drift: (Math.random() - 0.5) * 160,
    spin: (Math.random() - 0.5) * 900,
    w: 6 + Math.random() * 6,
    h: 10 + Math.random() * 8,
    color: COLORS[i % COLORS.length],
    round: i % 4 === 0,
  }));
}

/** One-shot maroon-and-gold confetti burst over the page. Renders nothing when motion is reduced. */
export function Confetti({ count = 36 }: { count?: number }) {
  const reduce = useShouldReduceMotion();
  const pieces = useMemo(() => makePieces(count), [count]);
  if (reduce) return null;
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {pieces.map((p, i) => (
        <motion.span
          key={i}
          className="absolute top-0 block"
          style={{
            left: `${p.left}%`,
            width: p.w,
            height: p.round ? p.w : p.h,
            background: p.color,
            borderRadius: p.round ? "50%" : 2,
          }}
          initial={{ y: -30, x: 0, rotate: 0, opacity: 1 }}
          animate={{ y: "105vh", x: p.drift, rotate: p.spin, opacity: [1, 1, 0.9, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: "easeIn" }}
        />
      ))}
    </div>
  );
}
