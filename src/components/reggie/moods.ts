/**
 * Reggie's moods (Implementation Plan §7.2) as procedural poses for the rig in Reggie.tsx.
 * The art is the final character sheet, split into layers by scripts/build-reggie-rig.py;
 * the face (eyes, brows, mouth) is live SVG so each mood is a real expression.
 */
export type Mood = "idle" | "typing" | "error" | "loading" | "success" | "confused" | "sad" | "eyebrow";

export const MOODS: readonly Mood[] = ["idle", "typing", "error", "loading", "success", "confused", "sad", "eyebrow"];

/** Face expressions. Some are only used for one-shot reactions (bonk, dazed, happy). */
export type Eyes = "open" | "happy" | "bonk" | "dazed";
export type Mouth = "w" | "smile" | "worried" | "ticket" | "open" | "wavy" | "frown" | "smirk" | "o";
export type Fx = "sweat" | "question" | "tear" | "ticket" | "sparkles" | "speed";

export type Pose = {
  eyes: Eyes;
  /** Upper-lid coverage, 0 = wide open, 1 = closed. */
  lid: number;
  /** Brow offsets: dy (px, negative = up) and rotation (deg) for the left and right brow. */
  brows: { L: [number, number]; R: [number, number] };
  mouth: Mouth;
  fx: Fx[];
  /** Ears: lift in degrees (+ = lifted outward, - = droop) and a gentle sway. */
  ears: { L: number; R: number; sway: number; swayHz: number };
  /** Tail wag: resting angle, amplitude, frequency. */
  tail: { base: number; amp: number; hz: number };
  /** Whole-body motion. */
  body: {
    tilt: number;
    /** "bob" = breathing, "run" = fast bounce, "jump" = periodic hop, "still". */
    motion: "bob" | "run" | "jump" | "still";
    dy: number;
    squash: number;
  };
  /** Bias added to the pupils' look direction (unit-ish vector), e.g. confused looks up. */
  gaze: [number, number];
  /** Shake once when the mood starts. */
  shake?: boolean;
};

const BROWS_NEUTRAL: Pose["brows"] = { L: [0, 0], R: [0, 0] };

export const POSES: Record<Mood, Pose> = {
  idle: {
    eyes: "open", lid: 0, brows: BROWS_NEUTRAL, mouth: "w", fx: [],
    ears: { L: 0, R: 0, sway: 2.5, swayHz: 0.45 },
    tail: { base: 2, amp: 15, hz: 1.7 },
    body: { tilt: 0, motion: "bob", dy: 0, squash: 1 },
    gaze: [0, 0],
  },
  typing: {
    eyes: "open", lid: 0, brows: { L: [-4, -5], R: [-4, 5] }, mouth: "smile", fx: [],
    ears: { L: 9, R: 9, sway: 1.5, swayHz: 1 },
    tail: { base: 2, amp: 11, hz: 1.5 },
    body: { tilt: 3, motion: "bob", dy: 0, squash: 1 },
    gaze: [0, 0.25],
  },
  error: {
    eyes: "open", lid: 0.12, brows: { L: [-2, -14], R: [-2, 14] }, mouth: "worried", fx: ["sweat"],
    ears: { L: -7, R: 5, sway: 1, swayHz: 0.6 },
    tail: { base: -6, amp: 5, hz: 0.9 },
    body: { tilt: 9, motion: "still", dy: 0, squash: 1 },
    gaze: [0, 0],
    shake: true,
  },
  loading: {
    eyes: "open", lid: 0.1, brows: { L: [1, 12], R: [1, -12] }, mouth: "ticket", fx: ["ticket", "speed"],
    ears: { L: 10, R: 10, sway: 5, swayHz: 3 },
    tail: { base: 2, amp: 18, hz: 3.4 },
    body: { tilt: -4, motion: "run", dy: 0, squash: 1 },
    gaze: [0.6, 0],
  },
  success: {
    eyes: "happy", lid: 0, brows: { L: [-5, -6], R: [-5, 6] }, mouth: "open", fx: ["sparkles"],
    ears: { L: 12, R: 12, sway: 6, swayHz: 2.5 },
    tail: { base: 2, amp: 22, hz: 3.8 },
    body: { tilt: 0, motion: "jump", dy: 0, squash: 1 },
    gaze: [0, 0],
  },
  confused: {
    eyes: "open", lid: 0, brows: { L: [-6, -10], R: [2, -8] }, mouth: "wavy", fx: ["question"],
    ears: { L: 6, R: -4, sway: 1.5, swayHz: 0.5 },
    tail: { base: 0, amp: 7, hz: 0.9 },
    body: { tilt: -8, motion: "bob", dy: 0, squash: 1 },
    gaze: [0.35, -0.7],
  },
  sad: {
    eyes: "open", lid: 0.32, brows: { L: [0, -16], R: [0, 16] }, mouth: "frown", fx: ["tear"],
    ears: { L: -8, R: -8, sway: 0.8, swayHz: 0.3 },
    tail: { base: -12, amp: 3, hz: 0.45 },
    body: { tilt: 2, motion: "still", dy: 3, squash: 0.975 },
    gaze: [0, 0.5],
  },
  eyebrow: {
    eyes: "open", lid: 0.42, brows: { L: [2, 6], R: [-9, -6] }, mouth: "smirk", fx: [],
    ears: { L: 0, R: 7, sway: 1, swayHz: 0.5 },
    tail: { base: 2, amp: 9, hz: 1.2 },
    body: { tilt: 3, motion: "bob", dy: 0, squash: 1 },
    gaze: [0.7, 0],
  },
};

/** One-shot reactions layered on top of the page's mood. */
export type Reaction = "bonk" | "dazed" | "happy" | "giggle";

export const REACTION_POSES: Record<Reaction, Partial<Pose>> = {
  bonk: { eyes: "bonk", brows: { L: [-6, 14], R: [-6, -14] }, mouth: "o", fx: [] },
  dazed: { eyes: "dazed", brows: { L: [-3, -8], R: [-3, 8] }, mouth: "o", fx: [] },
  happy: { eyes: "happy", brows: { L: [-5, -6], R: [-5, 6] }, mouth: "open", fx: ["sparkles"] },
  giggle: { eyes: "happy", brows: { L: [-5, -6], R: [-5, 6] }, mouth: "open", fx: [] },
};
