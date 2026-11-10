import { getSettings } from "./settings";

/**
 * Tiny WebAudio sound effects (no audio files). Off by default; enabled from Settings ("reggie.sound").
 */

export type SoundName = "boing" | "success" | "error" | "pop";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx) ctx = new Ctor();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(
  ac: AudioContext,
  opts: { from: number; to?: number; start?: number; duration: number; type?: OscillatorType; volume?: number },
) {
  const t0 = ac.currentTime + (opts.start ?? 0);
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = opts.type ?? "sine";
  osc.frequency.setValueAtTime(opts.from, t0);
  if (opts.to) osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.duration);
  const vol = opts.volume ?? 0.18;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.duration);
  osc.connect(gain).connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + opts.duration + 0.02);
}

/** Plays a sound if the user turned sounds on. Pass force=true to preview (e.g. right after enabling). */
export function playSound(name: SoundName, force = false) {
  if (!force && !getSettings().sound) return;
  const ac = audio();
  if (!ac) return;
  try {
    switch (name) {
      case "boing":
        tone(ac, { from: 180, to: 520, duration: 0.18, type: "triangle" });
        tone(ac, { from: 520, to: 260, start: 0.16, duration: 0.25, type: "sine", volume: 0.12 });
        break;
      case "success":
        tone(ac, { from: 523, duration: 0.12, type: "triangle" });
        tone(ac, { from: 659, start: 0.1, duration: 0.12, type: "triangle" });
        tone(ac, { from: 784, start: 0.2, duration: 0.25, type: "triangle" });
        break;
      case "error":
        tone(ac, { from: 300, to: 200, duration: 0.25, type: "square", volume: 0.07 });
        break;
      case "pop":
        tone(ac, { from: 600, to: 900, duration: 0.08, type: "sine", volume: 0.12 });
        break;
    }
  } catch {
    /* audio is decorative; never break the UI */
  }
}
