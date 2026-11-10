import { useCallback, useEffect, useId, useRef, useState } from "react";
import { copy } from "@/lib/copy";
import { useShouldReduceMotion } from "@/lib/settings";
import { playSound } from "@/lib/sound";
import {
  POSES,
  REACTION_POSES,
  type Fx,
  type Mood,
  type Mouth,
  type Pose,
  type Reaction,
} from "./moods";
import { focusedFieldCenter, pointer, trackPointer } from "./pointer";
import { RIG } from "./rigData";
import {
  ArtDefs,
  BallArt,
  BodyArt,
  Ear,
  HEAD_PIVOT,
  HeadArt,
  TAIL_TIP_PIVOT,
  Tail,
} from "./ReggieArt";
import "./reggie.css";

export type ReggieProps = {
  mood: Mood;
  /** Height in px (default 160). Reggie is always drawn whole, so he scales instead of being cropped. */
  size?: number;
  /** Show his basketball (default true). */
  showBall?: boolean;
  className?: string;
};

/* ------------------------------------------------------------------ geometry */

const W = RIG.width;
const H = RIG.height;
// Padding around the art for the "?" / stars above his head and the ball's flight path.
const VB = { x: -30, y: -50, w: W + 60, h: H + 54 };
/** Rig coordinate -> % of the box (for positioning) and rig length -> % (for sizes). */
const posX = (v: number) => `${((v - VB.x) / VB.w) * 100}%`;
const posY = (v: number) => `${((v - VB.y) / VB.h) * 100}%`;
const lenX = (v: number) => `${(v / VB.w) * 100}%`;
const lenY = (v: number) => `${(v / VB.h) * 100}%`;

const [EYE_L, EYE_R] = RIG.eyes;
const EYES = [EYE_L, EYE_R] as const;
const GROUND = RIG.pivots.body;
const INK = "#0B0B14";
const BALL = RIG.ball;

/** How far each pupil may travel from the eye's center while staying inside the white. */
const TRAVEL = EYES.map((e) => ({
  x: e.rx - e.pr - 0.5,
  y: e.ry - e.pr - 0.5,
}));
/** Resting pupils (the original art looks straight at you, slightly toward the nose). */
const REST = EYES.map((e) => ({ x: e.px - e.cx, y: e.py - e.cy }));

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));
const ease = (k: number, dt: number) => 1 - Math.exp(-k * dt);

/* ------------------------------------------------------------------ face pieces */

const MOUTHS: Record<Mouth, { d: string; fill?: boolean }> = {
  w: { d: "M100 115 Q109 125 118.5 116 Q128 125 137 115" },
  smile: { d: "M106 116 Q118.5 125 131 116" },
  worried: { d: "M106 121 Q112 116 118.5 120 Q125 124 131 119" },
  ticket: { d: "M108 119 L129 119" },
  open: { d: "M100 114 Q118.5 142 137 114 Q118.5 120 100 114 Z", fill: true },
  wavy: {
    d: "M103 121 Q108.5 116 113.5 121 Q118.5 126 123.5 121 Q128.5 116 134 121",
  },
  frown: { d: "M106 125 Q118.5 112 131 125" },
  smirk: { d: "M105 120 Q120 125 133 114" },
  o: { d: "M118.5 115 a5 6.5 0 1 0 0.01 0 Z", fill: true },
};

function Sparkle({
  x,
  y,
  s = 1,
  color = "#FFDF00",
  delay = 0,
}: {
  x: number;
  y: number;
  s?: number;
  color?: string;
  delay?: number;
}) {
  return (
    <path
      className="reggie-twinkle"
      style={{ animationDelay: `${delay}s` }}
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 -9 Q1.6 -1.6 9 0 Q1.6 1.6 0 9 Q-1.6 1.6 -9 0 Q-1.6 -1.6 0 -9 Z"
      fill={color}
    />
  );
}

const Drop = ({
  x,
  y,
  s = 1,
  className,
}: {
  x: number;
  y: number;
  s?: number;
  className: string;
}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <path
      className={className}
      d="M0 -9 Q7 2 0 8 Q-7 2 0 -9 Z"
      fill="#6FB6FF"
    />
  </g>
);

function FxLayer({ fx }: { fx: Fx[] }) {
  return (
    <>
      {fx.includes("sweat") && (
        <>
          <Drop x={182} y={34} s={1.15} className="reggie-drip" />
          <Drop x={192} y={56} s={0.85} className="reggie-drip reggie-delay" />
        </>
      )}
      {fx.includes("tear") && (
        <Drop x={156} y={100} s={0.9} className="reggie-tear" />
      )}
      {fx.includes("question") && (
        <text
          className="reggie-float"
          x={186}
          y={4}
          fontFamily="Nunito, system-ui, sans-serif"
          fontWeight={900}
          fontSize={46}
          fill="#800000"
        >
          ?
        </text>
      )}
      {fx.includes("ticket") && (
        <g transform="translate(128 104) rotate(-14)">
          <rect width={40} height={24} rx={4} fill="#FFDF00" />
          <rect
            x={4}
            y={4}
            width={32}
            height={16}
            rx={2}
            fill="none"
            stroke="#DAA520"
            strokeWidth={1.6}
            strokeDasharray="3 2"
          />
          <rect x={10} y={9} width={20} height={2.4} rx={1.2} fill="#DAA520" />
          <rect x={10} y={13} width={14} height={2.4} rx={1.2} fill="#DAA520" />
        </g>
      )}
      {fx.includes("speed") && (
        <g
          stroke="#800000"
          strokeWidth={5}
          strokeLinecap="round"
          className="reggie-speed"
        >
          <path d="M-22 150 H6" />
          <path d="M-14 170 H14" />
          <path d="M-24 190 H2" />
        </g>
      )}
      {fx.includes("sparkles") && (
        <>
          <Sparkle x={20} y={20} s={1.2} />
          <Sparkle x={214} y={6} s={1.4} delay={0.25} />
          <Sparkle x={226} y={120} s={1} color="#DAA520" delay={0.5} />
          <Sparkle x={6} y={130} s={0.9} color="#800000" delay={0.7} />
        </>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ component */

type Bonk = { start: number; combo: boolean };

/**
 * Reggie, the PUP-jersey puppy — a live rig built from the final character art.
 * Ears, tail and ball are separate layers; the face is SVG so his eyes follow your cursor (or the
 * field you're typing in), he blinks, and every mood is a real expression. Tap his ball to bonk him,
 * or tap him to make him giggle. Decorative for screen readers (the speech bubble carries the meaning).
 */
export function Reggie({
  mood,
  size = 160,
  showBall = true,
  className,
}: ReggieProps) {
  const reduce = useShouldReduceMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");

  const [reaction, setReaction] = useState<Reaction | null>(null);
  const [stars, setStars] = useState(false);
  const [hearts, setHearts] = useState(0);
  const [hover, setHover] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const earLRef = useRef<SVGGElement>(null);
  const earRRef = useRef<SVGGElement>(null);
  const tailRef = useRef<SVGGElement>(null);
  const tailTipRef = useRef<SVGGElement>(null);
  const shadowRef = useRef<SVGEllipseElement>(null);
  const ballBackRef = useRef<SVGGElement>(null);
  const ballFrontRef = useRef<SVGGElement>(null);
  const pupilRefs = [useRef<SVGGElement>(null), useRef<SVGGElement>(null)];
  const lidRefs = [useRef<SVGPathElement>(null), useRef<SVGPathElement>(null)];

  // Live inputs for the animation loop (refs, so the loop never restarts).
  const live = useRef({ mood, reaction, hover, reduce, showBall });
  live.current = { mood, reaction, hover, reduce, showBall };
  const moodStart = useRef(performance.now());
  const bonk = useRef<Bonk | null>(null);
  const giggleStart = useRef(-1e9);
  const taps = useRef<number[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => {
    moodStart.current = performance.now();
  }, [mood]);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  }, []);
  useEffect(
    () => () => timers.current.forEach((t) => window.clearTimeout(t)),
    [],
  );

  /* -------------------------------------------------- the animation loop */
  useEffect(() => {
    trackPointer();
    const svg = svgRef.current;
    if (!svg) return;

    const s = {
      earL: 0,
      earR: 0,
      earLv: 0,
      earRv: 0,
      tail: 0,
      tailTip: 0,
      tailPhase: 0,
      tailAmp: 0,
      head: 0,
      tilt: 0,
      y: 0,
      prevY: 0,
      x: 0,
      sx: 1,
      sy: 1,
      lid: 0,
      pupils: REST.map((r) => ({ ...r })),
      glance: { x: 0, y: 0, until: 0 },
      blinkAt: performance.now() + 2500 + Math.random() * 3000,
      blinkStart: -1,
    };
    let raf = 0;
    let last = performance.now();
    let visible = true;

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible && !raf) raf = requestAnimationFrame(frame);
    });
    io.observe(svg);

    function frame(now: number) {
      raf = 0;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const {
        mood: m,
        reaction: rx,
        hover: hov,
        reduce: rm,
        showBall: ball,
      } = live.current;
      const pose: Pose = {
        ...POSES[m],
        ...(rx ? REACTION_POSES[rx] : {}),
      } as Pose;
      const t = now / 1000;
      const sinceMood = (now - moodStart.current) / 1000;
      const motionOn = !rm;

      /* ---- body */
      let y = pose.body.dy;
      let tilt = pose.body.tilt;
      let sx = 1;
      let sy = pose.body.squash;
      let x = 0;
      let jumpH = 0;
      if (motionOn) {
        if (pose.body.motion === "bob") {
          y -= 1.6 * (0.5 - 0.5 * Math.cos(t * Math.PI));
          tilt += 1.2 * Math.sin(t * 2 * Math.PI * 0.3);
        } else if (pose.body.motion === "run") {
          jumpH = 6 * Math.abs(Math.sin(t * 2 * Math.PI * 2.2));
          y -= jumpH;
        } else if (pose.body.motion === "jump") {
          const p = (sinceMood % 2.2) / 0.7;
          if (p < 1) {
            jumpH = 4 * 24 * p * (1 - p);
            y -= jumpH;
            sy *= 1 + 0.05 * Math.sin(p * Math.PI);
          } else if (p < 1.25) {
            const q = (p - 1) / 0.25;
            sy *= 1 - 0.09 * Math.sin(q * Math.PI);
            sx *= 1 + 0.07 * Math.sin(q * Math.PI);
          }
        }
        if (pose.shake && sinceMood < 0.55)
          x = 7 * Math.sin(sinceMood * 40) * (1 - sinceMood / 0.55);
        // giggle: a springy squash
        const g = (now - giggleStart.current) / 1000;
        if (g < 0.7) {
          const k = Math.sin(g * 18) * (1 - g / 0.7);
          sy *= 1 - 0.07 * k;
          sx *= 1 + 0.05 * k;
        }
      }

      /* ---- ball / bonk timeline */
      let ballX = 0;
      let ballY = 0;
      let ballRot = 0;
      let ballFront = false;
      let earSpike = 0;
      const b = bonk.current;
      if (b) {
        const tb = (now - b.start) / 1000;
        type Pt = { x: number; y: number };
        const A: Pt = { x: BALL.cx, y: BALL.cy };
        const top: Pt = { x: 116, y: -18 };
        const bez = (p: number, P0: Pt, C: Pt, P1: Pt): Pt => ({
          x: (1 - p) ** 2 * P0.x + 2 * (1 - p) * p * C.x + p * p * P1.x,
          y: (1 - p) ** 2 * P0.y + 2 * (1 - p) * p * C.y + p * p * P1.y,
        });
        let pos: Pt = A;
        if (rm) {
          ballRot = 12 * Math.sin(tb * 30) * Math.max(0, 1 - tb / 0.35);
        } else if (tb < 0.32) {
          const p = tb / 0.32;
          pos = bez(p * (2 - p), A, { x: 40, y: -70 }, top);
          ballRot = 400 * p;
          ballFront = true;
        } else if (tb < 0.82) {
          const p = (tb - 0.32) / 0.5;
          pos = bez(
            p,
            top,
            b.combo ? { x: 70, y: -130 } : { x: 34, y: -95 },
            A,
          );
          ballRot = 400 + 500 * p;
          ballFront = p < 0.8;
          const c = (tb - 0.32) / 0.3;
          if (c < 1) {
            sy *= 1 - 0.13 * Math.sin(c * Math.PI);
            sx *= 1 + 0.1 * Math.sin(c * Math.PI);
            earSpike = 16 * (1 - c);
          }
        } else if (tb < 1.2) {
          const p = (tb - 0.82) / 0.38;
          const hop =
            p < 0.6
              ? 14 * Math.sin((p / 0.6) * Math.PI)
              : 5 * Math.sin(((p - 0.6) / 0.4) * Math.PI);
          pos = { x: A.x, y: A.y - hop };
          ballRot = 900 + 120 * p;
        } else {
          bonk.current = null;
        }
        ballX = pos.x - A.x;
        ballY = pos.y - A.y;
      }

      /* ---- ears */
      const hoverLift = hov && motionOn ? 5 : 0;
      const sway = motionOn
        ? pose.ears.sway * Math.sin(t * 2 * Math.PI * pose.ears.swayHz)
        : 0;
      const sway2 = motionOn
        ? pose.ears.sway * Math.sin(t * 2 * Math.PI * pose.ears.swayHz + 1.3)
        : 0;
      // Floppy ears: a springy follow, kicked by the body's vertical speed (hops make them flap).
      const vy = dt > 0 ? (s.y - s.prevY) / dt : 0;
      s.prevY = s.y;
      const flop = motionOn ? clamp(-vy * 0.1, -14, 14) : 0;
      const targetL = clamp(
        pose.ears.L + hoverLift + sway + earSpike + flop,
        -14,
        24,
      );
      const targetR = clamp(
        pose.ears.R + hoverLift + sway2 + earSpike + flop,
        -14,
        24,
      );
      if (motionOn) {
        s.earLv += ((targetL - s.earL) * 170 - s.earLv * 13) * dt;
        s.earRv += ((targetR - s.earR) * 170 - s.earRv * 13) * dt;
        s.earL = clamp(s.earL + s.earLv * dt, -20, 30);
        s.earR = clamp(s.earR + s.earRv * dt, -20, 30);
      } else {
        s.earL = targetL;
        s.earR = targetR;
        s.earLv = s.earRv = 0;
      }

      /* ---- tail */
      const giggling = now - giggleStart.current < 900;
      const happyTail = giggling || rx === "happy";
      // The wag never stops: the phase keeps running (so speed changes don't jump) and the amplitude
      // eases between moods. The cream tip follows a beat behind, like a whip.
      const amp = motionOn
        ? pose.tail.amp + (hov ? 5 : 0) + (happyTail ? 8 : 0)
        : 0;
      const hz = pose.tail.hz * (hov ? 1.4 : 1) * (happyTail ? 1.8 : 1);
      s.tailPhase =
        (s.tailPhase + dt * 2 * Math.PI * hz) % (2 * Math.PI * 1000);
      s.tailAmp += (amp - s.tailAmp) * ease(4, dt);
      const tailTarget = clamp(
        pose.tail.base + s.tailAmp * Math.sin(s.tailPhase),
        -30,
        32,
      );
      s.tail += (tailTarget - s.tail) * ease(25, dt);
      s.tailTip = clamp(
        s.tailAmp * 0.75 * Math.sin(s.tailPhase - 1.1),
        -26,
        26,
      );

      /* ---- head: sways on the neck, leans into the mood's tilt */
      const headTarget = motionOn
        ? pose.body.tilt * 0.4 +
          (pose.body.motion === "bob"
            ? 2.2 * Math.sin(t * 2 * Math.PI * 0.23 + 0.8)
            : 0)
        : 0;
      s.head += (headTarget - s.head) * ease(6, dt);

      /* ---- body easing */
      const bk = ease(10, dt);
      s.tilt += (tilt - s.tilt) * bk;
      s.y +=
        (y - s.y) *
        ease(
          pose.body.motion === "jump" || pose.body.motion === "run" ? 40 : 10,
          dt,
        );
      s.x = x;
      s.sx = sx;
      s.sy = sy;

      /* ---- eyes: look at the cursor, the focused field, or glance around */
      const ctm = svg!.getScreenCTM();
      const recent = pointer.inside && now - pointer.t < 6000;
      const field = focusedFieldCenter();
      const watchField = field && (m === "typing" || now - pointer.t > 1200);
      const target = watchField ? field : recent ? pointer : null;
      if (!target && now > s.glance.until) {
        const r = Math.random();
        s.glance =
          r < 0.45
            ? { x: 0, y: 0, until: now + 1800 + Math.random() * 2200 }
            : {
                x: (Math.random() * 2 - 1) * 0.8,
                y: (Math.random() * 2 - 1) * 0.5,
                until: now + 900 + Math.random() * 1400,
              };
      }
      EYES.forEach((e, i) => {
        let ox: number;
        let oy: number;
        if (pose.eyes === "dazed" && motionOn) {
          ox = Math.cos(t * 9) * TRAVEL[i].x * 0.7;
          oy = Math.sin(t * 9) * TRAVEL[i].y * 0.55;
        } else if (target && ctm) {
          const ex = ctm.a * e.cx + ctm.c * e.cy + ctm.e;
          const ey = ctm.b * e.cx + ctm.d * e.cy + ctm.f;
          const dx = target.x - ex;
          const dy = target.y - ey;
          const dist = Math.hypot(dx, dy) || 1;
          const k = Math.min(1, dist / (60 * ctm.a + 40));
          ox = (dx / dist) * k * TRAVEL[i].x;
          oy = (dy / dist) * k * TRAVEL[i].y;
        } else if (s.glance.x || s.glance.y) {
          ox = s.glance.x * TRAVEL[i].x;
          oy = s.glance.y * TRAVEL[i].y;
        } else {
          ox = REST[i].x;
          oy = REST[i].y;
        }
        ox += pose.gaze[0] * TRAVEL[i].x * 0.6;
        oy += pose.gaze[1] * TRAVEL[i].y * 0.6;
        const n = (ox / TRAVEL[i].x) ** 2 + (oy / TRAVEL[i].y) ** 2;
        if (n > 1) {
          ox /= Math.sqrt(n);
          oy /= Math.sqrt(n);
        }
        const pk = ease(pose.eyes === "dazed" ? 40 : 14, dt);
        s.pupils[i].x += (ox - s.pupils[i].x) * pk;
        s.pupils[i].y += (oy - s.pupils[i].y) * pk;
        pupilRefs[i].current?.setAttribute(
          "transform",
          `translate(${s.pupils[i].x.toFixed(2)} ${s.pupils[i].y.toFixed(2)})`,
        );
      });

      /* ---- blink */
      let lid = pose.lid;
      if (motionOn && pose.eyes === "open") {
        if (now > s.blinkAt && s.blinkStart < 0) s.blinkStart = now;
        if (s.blinkStart >= 0) {
          const p = (now - s.blinkStart) / 150;
          if (p >= 1) {
            s.blinkStart = -1;
            s.blinkAt = now + 2200 + Math.random() * 3800;
          } else lid = Math.max(lid, Math.sin(p * Math.PI));
        }
      }
      s.lid += (lid - s.lid) * ease(lid > s.lid ? 60 : 25, dt);
      EYES.forEach((e, i) => {
        const top = e.cy - e.ry - 2;
        const h = (2 * e.ry + 4) * s.lid;
        const x0 = e.cx - e.rx - 2;
        const x1 = e.cx + e.rx + 2;
        const yb = top + h;
        lidRefs[i].current?.setAttribute(
          "d",
          `M${x0} ${top} H${x1} V${yb} Q${e.cx} ${yb + 7 * s.lid} ${x0} ${yb} Z`,
        );
      });

      /* ---- write transforms */
      const [gx, gy] = GROUND;
      bodyRef.current?.setAttribute(
        "transform",
        `translate(${s.x.toFixed(2)} ${s.y.toFixed(2)}) rotate(${s.tilt.toFixed(2)} ${gx} ${gy}) ` +
          `translate(${gx} ${gy}) scale(${s.sx.toFixed(3)} ${s.sy.toFixed(3)}) translate(${-gx} ${-gy})`,
      );
      headRef.current?.setAttribute(
        "transform",
        `rotate(${s.head.toFixed(2)} ${HEAD_PIVOT[0]} ${HEAD_PIVOT[1]})`,
      );
      earLRef.current?.setAttribute(
        "transform",
        `rotate(${s.earL.toFixed(2)} ${RIG.pivots.earL[0]} ${RIG.pivots.earL[1]})`,
      );
      earRRef.current?.setAttribute(
        "transform",
        `rotate(${(-s.earR).toFixed(2)} ${RIG.pivots.earR[0]} ${RIG.pivots.earR[1]})`,
      );
      tailRef.current?.setAttribute(
        "transform",
        `rotate(${s.tail.toFixed(2)} ${RIG.pivots.tail[0]} ${RIG.pivots.tail[1]})`,
      );
      tailTipRef.current?.setAttribute(
        "transform",
        `rotate(${s.tailTip.toFixed(2)} ${TAIL_TIP_PIVOT[0]} ${TAIL_TIP_PIVOT[1]})`,
      );
      const shadowScale = 1 - Math.min(0.35, (jumpH + Math.max(0, -s.y)) / 70);
      shadowRef.current?.setAttribute(
        "rx",
        (RIG.shadow.rx * shadowScale).toFixed(2),
      );
      const ballT = `translate(${ballX.toFixed(2)} ${ballY.toFixed(2)}) rotate(${ballRot.toFixed(1)} ${BALL.cx} ${BALL.cy})`;
      if (ball) {
        ballBackRef.current?.setAttribute("transform", ballT);
        ballFrontRef.current?.setAttribute("transform", ballT);
        ballBackRef.current?.setAttribute("opacity", ballFront ? "0" : "1");
        ballFrontRef.current?.setAttribute("opacity", ballFront ? "1" : "0");
      }

      if (visible && !document.hidden) raf = requestAnimationFrame(frame);
    }

    const onVis = () => {
      if (!document.hidden && visible && !raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
    };
    // pupilRefs/lidRefs are stable ref objects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* -------------------------------------------------- interactions */
  const onBall = useCallback(() => {
    if (bonk.current) return; // ignore taps mid-flight
    const now = performance.now();
    taps.current = [...taps.current.filter((x) => now - x < 2500), now];
    const combo = taps.current.length >= 3;
    if (combo) taps.current = [];
    bonk.current = { start: now, combo };
    if (reduce) {
      setReaction("happy");
      later(() => setReaction(null), 700);
      playSound("boing");
      return;
    }
    later(() => {
      playSound("boing");
      setReaction(combo ? "happy" : "bonk");
      setStars(true);
    }, 320);
    later(() => setStars(false), 1100);
    later(() => setReaction(combo ? "happy" : "dazed"), 850);
    later(() => setReaction("happy"), 1400);
    later(() => setReaction(null), 2100);
  }, [reduce, later]);

  const onPet = useCallback(() => {
    if (bonk.current) return;
    giggleStart.current = performance.now();
    playSound("pop");
    setReaction("giggle");
    setHearts((h) => h + 1);
    later(() => setHearts(0), 1050); // gone after the float-up (and never lingers with reduced motion)
    later(() => setReaction((r) => (r === "giggle" ? null : r)), 900);
  }, [later]);

  /* -------------------------------------------------- render */
  const pose: Pose = {
    ...POSES[mood],
    ...(reaction ? REACTION_POSES[reaction] : {}),
  } as Pose;
  const width = Math.round((size * VB.w) / VB.h);
  const brow = (side: "L" | "R") => {
    const [dy, rot] = pose.brows[side];
    return (
      <path
        d={RIG.brows[side]}
        fill="none"
        stroke={INK}
        strokeWidth={7}
        strokeLinecap="round"
        style={{
          transform: `translate(0px, ${dy}px) rotate(${rot}deg)`,
          transformBox: "fill-box",
          transformOrigin: "center",
          transition: reduce
            ? undefined
            : "transform 0.25s cubic-bezier(.3,1.4,.5,1)",
        }}
      />
    );
  };
  const mouth = MOUTHS[pose.mouth];

  return (
    <div
      className={`reggie relative inline-block shrink-0 select-none ${className ?? ""}`}
      style={{ width, height: size }}
      onPointerEnter={() => setHover(true)}
      onPointerLeave={() => setHover(false)}
    >
      <svg
        ref={svgRef}
        viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`}
        width={width}
        height={size}
        aria-hidden="true"
        focusable="false"
        className="absolute inset-0 overflow-visible"
      >
        <defs>
          <ArtDefs uid={uid} />
          {EYES.map((e, i) => (
            <clipPath key={i} id={`${uid}-eye${i}`}>
              <ellipse cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} />
            </clipPath>
          ))}
          <clipPath id={`${uid}-mouth`}>
            <path d={MOUTHS.open.d} />
          </clipPath>
        </defs>

        {/* Dark-mode "court spotlight" so the maroon jersey doesn't sink into the background. */}
        <circle
          cx={W / 2}
          cy={H * 0.56}
          r={W * 0.56}
          className="hidden fill-gold/15 dark:inline"
        />

        <ellipse
          ref={shadowRef}
          cx={RIG.shadow.cx}
          cy={RIG.shadow.cy}
          rx={RIG.shadow.rx}
          ry={RIG.shadow.ry}
          fill={RIG.shadow.color}
          opacity={0.9}
        />

        {showBall && (
          <g ref={ballBackRef}>
            <BallArt uid={uid} />
          </g>
        )}

        <g ref={bodyRef}>
          <Tail ref={tailRef} tipRef={tailTipRef} uid={uid} />
          <BodyArt uid={uid} />

          <g ref={headRef}>
            <Ear ref={earLRef} uid={uid} side="L" />
            <Ear ref={earRRef} uid={uid} side="R" />
            <HeadArt uid={uid} />

            {/* eyes */}
            {EYES.map((e, i) => {
              const sgn = i === 0 ? 1 : -1;
              if (pose.eyes === "happy") {
                return (
                  <path
                    key={i}
                    d={`M${e.cx - 13} ${e.cy + 5} Q${e.cx} ${e.cy - 12} ${e.cx + 13} ${e.cy + 5}`}
                    fill="none"
                    stroke={INK}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />
                );
              }
              if (pose.eyes === "bonk") {
                const d =
                  i === 0
                    ? `M${e.cx - 10} ${e.cy - 9} L${e.cx + 8} ${e.cy} L${e.cx - 10} ${e.cy + 9}`
                    : `M${e.cx + 10} ${e.cy - 9} L${e.cx - 8} ${e.cy} L${e.cx + 10} ${e.cy + 9}`;
                return (
                  <path
                    key={i}
                    d={d}
                    fill="none"
                    stroke={INK}
                    strokeWidth={5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                );
              }
              return (
                <g key={i}>
                  <ellipse
                    cx={e.cx}
                    cy={e.cy}
                    rx={e.rx}
                    ry={e.ry}
                    fill="#fff"
                  />
                  <g clipPath={`url(#${uid}-eye${i})`}>
                    <g
                      ref={pupilRefs[i]}
                      transform={`translate(${REST[i].x} ${REST[i].y})`}
                    >
                      <circle cx={e.cx} cy={e.cy} r={e.pr} fill={INK} />
                      <circle
                        cx={e.cx + sgn * 6.5}
                        cy={e.cy - 5.5}
                        r={4.6}
                        fill="#fff"
                      />
                      <circle
                        cx={e.cx - sgn * 4.8}
                        cy={e.cy + 7}
                        r={1.9}
                        fill="#fff"
                      />
                    </g>
                    <path ref={lidRefs[i]} d="" fill={`url(#${uid}-head)`} />
                  </g>
                </g>
              );
            })}

            {/* brows */}
            {brow("L")}
            {brow("R")}

            {/* mouth */}
            <g key={pose.mouth} className={reduce ? undefined : "reggie-pop"}>
              {mouth.fill ? (
                <>
                  <path d={mouth.d} fill="#3A0D12" />
                  {pose.mouth === "open" && (
                    <g clipPath={`url(#${uid}-mouth)`}>
                      <ellipse
                        cx={118.5}
                        cy={131}
                        rx={10}
                        ry={7}
                        fill="#F0606E"
                      />
                    </g>
                  )}
                </>
              ) : (
                <path
                  d={mouth.d}
                  fill="none"
                  stroke={INK}
                  strokeWidth={3.6}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </g>

            <FxLayer fx={pose.fx} />
          </g>
        </g>

        {showBall && (
          <g ref={ballFrontRef} opacity={0}>
            <BallArt uid={uid} />
          </g>
        )}

        {stars && (
          <g>
            <Sparkle x={76} y={-22} s={1.3} />
            <Sparkle x={160} y={-26} s={1.1} delay={0.1} />
            <Sparkle x={118} y={-40} s={0.9} color="#DAA520" delay={0.2} />
            <path
              d="M92 -6 l-8 -12 M144 -8 l8 -12 M118 -14 v-14"
              stroke="#800000"
              strokeWidth={4}
              strokeLinecap="round"
            />
          </g>
        )}
        {hearts > 0 && (
          <path
            key={hearts}
            className="reggie-heart"
            transform="translate(178 6)"
            d="M0 6 C-10 -2 -8 -12 0 -7 C8 -12 10 -2 0 6 Z"
            fill="#E8505B"
          />
        )}
      </svg>

      {/* Interactive areas: pet Reggie, or bounce the ball off his head. */}
      <button
        type="button"
        aria-label="Pet Reggie"
        onClick={onPet}
        className="absolute cursor-pointer rounded-[40%] bg-transparent p-0"
        style={{
          left: posX(48),
          top: posY(0),
          width: lenX(145),
          height: lenY(240),
        }}
      />
      {showBall && (
        <button
          type="button"
          aria-label={copy.reggie.ballLabel}
          onClick={onBall}
          className="absolute cursor-pointer rounded-full bg-transparent p-0"
          style={{
            left: posX(BALL.cx - BALL.r - 4),
            top: posY(BALL.cy - BALL.r - 4),
            width: lenX(2 * BALL.r + 8),
            height: lenY(2 * BALL.r + 8),
          }}
        />
      )}
    </div>
  );
}

export default Reggie;
