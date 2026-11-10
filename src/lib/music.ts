import { getSettings } from "./settings";

/** The file lives in public/music/ (see the README there). */
export const MUSIC_SRC = "/music/background.mp3";

let el: HTMLAudioElement | null = null;

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
 * Makes playback match the Music setting. Call it from a user gesture (a toggle click, the first tap)
 * because browsers block autoplay. Failures (blocked autoplay, missing file) are ignored on purpose.
 */
export function syncMusic() {
  const a = audioEl();
  if (!a) return;
  a.volume = getSettings().musicVolume / 100;
  if (getSettings().music && !document.hidden) {
    void a.play().catch(() => {});
  } else {
    a.pause();
  }
}
