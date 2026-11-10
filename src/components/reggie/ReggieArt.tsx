import { forwardRef } from "react";
import { RIG } from "./rigData";

/**
 * Reggie drawn in code: vector parts traced from the final character art
 * (design/mockups/sprites/front.png, 237 x 259), in the same coordinates as rigData.ts so the live
 * face (eyes, brows, mouth) lines up. Soft gradients stand in for the painted shading; there are
 * no outlines, like the original sticker art.
 *
 * Every moving part is its own group with a known pivot, so Reggie.tsx can animate it:
 *   tail (pivot RIG.pivots.tail) with a tip that bends (TAIL_TIP_PIVOT), ears (RIG.pivots.earL / earR),
 *   head (HEAD_PIVOT, the neck), body (RIG.pivots.body, the ground) and the ball.
 */

export const PALETTE = {
  fur: RIG.furColor, // #9D5931
  furLight: "#B4713F",
  furDark: "#7C4223",
  ear: "#7A4223",
  earDark: "#58301A",
  cream: "#FCE7CC",
  creamShade: "#EFCBA2",
  cheek: "#F7878F",
  nose: "#3A1810",
  jersey: "#8E0F15",
  jerseyDark: "#66080D",
  gold: "#FFD319",
  goldDark: "#DDA400",
  toe: "#C29672",
  ball: "#F27B1C",
  ballLight: "#FFA14A",
  ballDark: "#C9520A",
  seam: "#4E1E0E",
} as const;

export const HEAD_PIVOT = [118.5, 138] as const;
export const TAIL_TIP_PIVOT = [201, 192] as const;

/** Shared gradients. `uid` keeps ids unique when several Reggies are on screen. */
export function ArtDefs({ uid }: { uid: string }) {
  const P = PALETTE;
  return (
    <>
      {/* userSpaceOnUse so the eyelids (filled with this too) match the head exactly. */}
      <radialGradient id={`${uid}-head`} gradientUnits="userSpaceOnUse" cx={118} cy={46} r={96}>
        <stop offset="0" stopColor={P.furLight} />
        <stop offset="0.55" stopColor={P.fur} />
        <stop offset="1" stopColor={P.furDark} />
      </radialGradient>
      <radialGradient id={`${uid}-fur`} cx="0.4" cy="0.3" r="0.8">
        <stop offset="0" stopColor={P.furLight} />
        <stop offset="0.6" stopColor={P.fur} />
        <stop offset="1" stopColor={P.furDark} />
      </radialGradient>
      <linearGradient id={`${uid}-ear`} x1="0.2" y1="0" x2="0.6" y2="1">
        <stop offset="0" stopColor={P.ear} />
        <stop offset="1" stopColor={P.earDark} />
      </linearGradient>
      <radialGradient id={`${uid}-cream`} cx="0.5" cy="0.35" r="0.75">
        <stop offset="0.5" stopColor={P.cream} />
        <stop offset="1" stopColor={P.creamShade} />
      </radialGradient>
      <radialGradient id={`${uid}-jersey`} cx="0.5" cy="0.35" r="0.8">
        <stop offset="0" stopColor={P.jersey} />
        <stop offset="1" stopColor={P.jerseyDark} />
      </radialGradient>
      <linearGradient id={`${uid}-gold`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={P.gold} />
        <stop offset="1" stopColor={P.goldDark} />
      </linearGradient>
      <radialGradient id={`${uid}-ball`} cx="0.35" cy="0.3" r="0.8">
        <stop offset="0" stopColor={P.ballLight} />
        <stop offset="0.55" stopColor={P.ball} />
        <stop offset="1" stopColor={P.ballDark} />
      </radialGradient>
      <clipPath id={`${uid}-ballclip`}>
        <circle cx={RIG.ball.cx} cy={RIG.ball.cy} r={RIG.ball.r} />
      </clipPath>
    </>
  );
}

/* ------------------------------------------------------------------ tail */

/** Tail: the brown base swings from its root; the cream tip bends a beat later (a whip-like wag). */
export const Tail = forwardRef<SVGGElement, { uid: string; tipRef: React.Ref<SVGGElement> }>(function Tail(
  { uid, tipRef },
  ref,
) {
  return (
    <g ref={ref}>
      <path
        d="M182 234 C177 212 184 192 191 178 C195 170 199 165 204 166 C212 170 220 182 220 196 C220 212 214 226 206 234 Z"
        fill={`url(#${uid}-fur)`}
      />
      <g ref={tipRef}>
        <path
          d="M190 181 C193 168 198 158 206 158 C215 160 223 174 222 190 C216 197 209 192 203 197 C198 190 190 192 190 181 Z"
          fill={`url(#${uid}-cream)`}
        />
      </g>
    </g>
  );
});

/* ------------------------------------------------------------------ ears */

const EAR_D =
  "M80 7 C60 3 30 18 14 46 C2 66 -2 92 4 112 C9 129 26 135 40 129 C52 123 56 104 58 86 C60 62 70 36 86 18 Z";
const EAR_FOLD_D = "M70 20 C46 32 22 62 17 98 C15 114 25 124 36 120 C29 100 38 62 70 20 Z";

/** Left ear, hanging from RIG.pivots.earL. The right ear is the same shape mirrored. */
export const Ear = forwardRef<SVGGElement, { uid: string; side: "L" | "R" }>(function Ear({ uid, side }, ref) {
  return (
    <g ref={ref}>
      <g transform={side === "R" ? `translate(${RIG.width} 0) scale(-1 1)` : undefined}>
        <path d={EAR_D} fill={`url(#${uid}-ear)`} />
        <path d={EAR_FOLD_D} fill={PALETTE.earDark} opacity={0.35} />
      </g>
    </g>
  );
});

/* ------------------------------------------------------------------ head (without the live face) */

export function HeadArt({ uid }: { uid: string }) {
  const P = PALETTE;
  return (
    <>
      <path
        d="M118.5 2 C152 2 172 16 178 42 C183 62 190 88 189 106 C188 128 160 139 118.5 139 C77 139 49 128 48 106 C47 88 54 62 59 42 C65 16 85 2 118.5 2 Z"
        fill={`url(#${uid}-head)`}
      />
      {/* soft top highlight */}
      <ellipse cx={118.5} cy={24} rx={36} ry={14} fill="#fff" opacity={0.07} />
      {/* muzzle */}
      <path
        d="M118.5 82 C132 82 141 90 151 96 C169 100 178 111 174 123 C170 134 150 137 118.5 137 C87 137 67 134 63 123 C59 111 68 100 86 96 C96 90 105 82 118.5 82 Z"
        fill={`url(#${uid}-cream)`}
      />
      {/* cheeks */}
      <ellipse cx={66} cy={101} rx={14} ry={9.5} fill={P.cheek} opacity={0.85} />
      <ellipse cx={171} cy={101} rx={14} ry={9.5} fill={P.cheek} opacity={0.85} />
      {/* nose */}
      <ellipse cx={118} cy={100} rx={13.5} ry={9} fill={P.nose} />
      <ellipse cx={112} cy={96.5} rx={4.6} ry={2.6} fill="#fff" opacity={0.85} />
    </>
  );
}

/* ------------------------------------------------------------------ body */

export function BodyArt({ uid }: { uid: string }) {
  const P = PALETTE;
  const toes = (x: number) => (
    <>
      <path d={`M${x - 8} 226 V238`} stroke={P.toe} strokeWidth={3.2} strokeLinecap="round" />
      <path d={`M${x + 8} 226 V238`} stroke={P.toe} strokeWidth={3.2} strokeLinecap="round" />
    </>
  );
  return (
    <>
      {/* torso + arms */}
      <path d="M73 148 C60 168 52 196 56 224 L181 224 C185 196 177 168 164 148 C148 140 89 140 73 148 Z" fill={`url(#${uid}-fur)`} />
      {/* jersey */}
      <path
        d="M80 142 Q118.5 149 157 142 C155 160 153 176 154 196 L152 230 L85 230 L83 196 C84 176 82 160 80 142 Z"
        fill={`url(#${uid}-jersey)`}
      />
      {/* arm-hole trim */}
      <path d="M80 142 C82 160 84 176 83 194" fill="none" stroke={P.gold} strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />
      <path d="M157 142 C155 160 153 176 154 194" fill="none" stroke={P.gold} strokeWidth={2.4} strokeLinecap="round" opacity={0.85} />
      {/* V collar */}
      <path d="M78 140 L118.5 171 L159 140 L150 140 L118.5 162 L87 140 Z" fill={`url(#${uid}-gold)`} />
      {/* number */}
      <text
        x={119}
        y={204}
        textAnchor="middle"
        fontFamily="Nunito, system-ui, sans-serif"
        fontWeight={900}
        fontSize={35}
        letterSpacing={-1}
        fill={`url(#${uid}-gold)`}
      >
        27
      </text>
      {/* back legs */}
      <ellipse cx={72} cy={207} rx={23} ry={23} fill={`url(#${uid}-fur)`} />
      <ellipse cx={165} cy={207} rx={23} ry={23} fill={`url(#${uid}-fur)`} />
      {/* belly peeking between the paws */}
      <ellipse cx={118.5} cy={234} rx={15} ry={8} fill={P.furDark} />
      {/* front paws */}
      <ellipse cx={85} cy={231} rx={25} ry={13.5} fill={`url(#${uid}-cream)`} />
      <ellipse cx={151} cy={231} rx={25} ry={13.5} fill={`url(#${uid}-cream)`} />
      {toes(85)}
      {toes(151)}
    </>
  );
}

/* ------------------------------------------------------------------ ball */

export function BallArt({ uid }: { uid: string }) {
  const { cx, cy, r } = RIG.ball;
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-ball)`} />
      <g clipPath={`url(#${uid}-ballclip)`} fill="none" stroke={PALETTE.seam} strokeWidth={3} strokeLinecap="round">
        <path d={`M${cx - r} ${cy + 6} C${cx - 10} ${cy - 2} ${cx + 10} ${cy - 8} ${cx + r} ${cy - 14}`} />
        <path d={`M${cx + 2} ${cy - r} C${cx + 14} ${cy - 10} ${cx + 16} ${cy + 10} ${cx + 8} ${cy + r}`} />
        <path d={`M${cx - r + 4} ${cy - 14} C${cx - 14} ${cy - 18} ${cx - 8} ${cy - 2} ${cx - 16} ${cy + r - 2}`} />
      </g>
      <circle cx={cx - 14} cy={cy - 12} r={4.2} fill="#fff" opacity={0.9} />
    </>
  );
}
