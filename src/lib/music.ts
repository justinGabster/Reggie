import { getSettings } from "./settings";

/** The file lives in public/music/ (see the README there). */
export const MUSIC_SRC = "/music/background.mp3";

let el: HTMLAudioElement | null = null;
let ctx: AudioContext | null = null;
let gain: GainNode | null = null;

function audioEl(): HTMLAudioElement | null {
  if (typeof Audio === "undefined") return null;
  if (!el) {
    el = new Audio(MUSIC_SRC);
    el.loop = true;
    el.preload = "none"; // nothing downloads until the user turns music on
  }
  return el;
}

/**
 * iOS Safari ignores `audio.volume` (it is always 1 there), so the slider would do nothing.
 * Routing the element through a Web Audio GainNode makes the volume work on every browser.
 * The graph is built once, on first use (which happens inside a tap or click).
 */
function ensureGraph(a: HTMLAudioElement) {
  if (gain || ctx) return;
  const Ctor =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  try {
    ctx = new Ctor();
    const source = ctx.createMediaElementSource(a);
    gain = ctx.createGain();
    source.connect(gain);
    gain.connect(ctx.destination);
  } catch {
    ctx = null;
    gain = null; // fall back to plain audio.volume
  }
}

/**
 * Makes playback match the Music setting and volume. Call it from a user gesture (a toggle click,
 * the first tap) because browsers block autoplay. Failures (blocked autoplay, missing file) are
 * ignored on purpose.
 */
export function syncMusic() {
  const a = audioEl();
  if (!a) return;
  ensureGraph(a);

  const s = getSettings();
  const volume = Math.min(1, Math.max(0, s.musicVolume / 100));

  if (gain) {
    gain.gain.value = volume;
    a.volume = 1; // the gain node does the work
  } else {
    a.volume = volume;
  }
  a.muted = volume === 0; // belt and braces: zero is always silent

  if (s.music && !document.hidden && volume > 0) {
    if (ctx && ctx.state === "suspended") void ctx.resume().catch(() => {});
    void a.play().catch(() => {});
  } else {
    a.pause();
  }
}
