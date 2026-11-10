import { useCallback, useSyncExternalStore } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Per-device preferences, stored in localStorage:
 * - reggie.theme         "light" | "dark" (index.html applies it before first paint)
 * - reggie.sound         "on" | "off" (default off)
 * - reggie.music         "on" | "off" (default off; browsers need a tap before audio can start)
 * - reggie.musicVolume   0-100 (default 30)
 * - reggie.reduceMotion  "on" | "off" (default off; the OS setting is always respected too)
 */

export type Theme = "light" | "dark";

type Settings = { theme: Theme; sound: boolean; music: boolean; musicVolume: number; reduceMotion: boolean };

const KEYS = {
  theme: "reggie.theme",
  sound: "reggie.sound",
  music: "reggie.music",
  musicVolume: "reggie.musicVolume",
  reduceMotion: "reggie.reduceMotion",
} as const;

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode or blocked storage: the setting just won't persist */
  }
}

function readVolume(): number {
  const n = Number(read(KEYS.musicVolume));
  return read(KEYS.musicVolume) !== null && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 30;
}

function initial(): Settings {
  const isDom = typeof document !== "undefined";
  const theme: Theme = isDom && document.documentElement.classList.contains("dark") ? "dark" : "light";
  return { theme, sound: read(KEYS.sound) === "on", music: read(KEYS.music) === "on", musicVolume: readVolume(), reduceMotion: read(KEYS.reduceMotion) === "on" };
}

let state: Settings = initial();
const listeners = new Set<() => void>();

function applyToDocument(s: Settings) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.toggle("dark", s.theme === "dark");
  root.classList.toggle("reduce-motion", s.reduceMotion);
}
applyToDocument(state);

function set(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  if (patch.theme !== undefined) write(KEYS.theme, patch.theme);
  if (patch.sound !== undefined) write(KEYS.sound, patch.sound ? "on" : "off");
  if (patch.music !== undefined) write(KEYS.music, patch.music ? "on" : "off");
  if (patch.musicVolume !== undefined) write(KEYS.musicVolume, String(patch.musicVolume));
  if (patch.reduceMotion !== undefined) write(KEYS.reduceMotion, patch.reduceMotion ? "on" : "off");
  applyToDocument(state);
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Current settings without subscribing (for non-React code such as sound.ts). */
export function getSettings(): Readonly<Settings> {
  return state;
}

function useSetting<K extends keyof Settings>(key: K): Settings[K] {
  return useSyncExternalStore(
    subscribe,
    () => state[key],
    () => state[key],
  );
}

export function useTheme(): { theme: Theme; setTheme: (t: Theme) => void; toggleTheme: () => void } {
  const theme = useSetting("theme");
  const setTheme = useCallback((t: Theme) => set({ theme: t }), []);
  const toggleTheme = useCallback(() => set({ theme: state.theme === "dark" ? "light" : "dark" }), []);
  return { theme, setTheme, toggleTheme };
}

export function useSound(): { enabled: boolean; setEnabled: (v: boolean) => void } {
  const enabled = useSetting("sound");
  const setEnabled = useCallback((v: boolean) => set({ sound: v }), []);
  return { enabled, setEnabled };
}

export function useMusic(): { enabled: boolean; setEnabled: (v: boolean) => void } {
  const enabled = useSetting("music");
  const setEnabled = useCallback((v: boolean) => set({ music: v }), []);
  return { enabled, setEnabled };
}

export function useMusicVolume(): { volume: number; setVolume: (v: number) => void } {
  const volume = useSetting("musicVolume");
  const setVolume = useCallback((v: number) => set({ musicVolume: Math.min(100, Math.max(0, Math.round(v))) }), []);
  return { volume, setVolume };
}

/** The in-app "Reduce motion" toggle only (see useShouldReduceMotion for the combined value). */
export function useReducedMotionSetting(): { reduced: boolean; setReduced: (v: boolean) => void } {
  const reduced = useSetting("reduceMotion");
  const setReduced = useCallback((v: boolean) => set({ reduceMotion: v }), []);
  return { reduced, setReduced };
}

/** True when the OS asks for reduced motion OR the in-app toggle is on. */
export function useShouldReduceMotion(): boolean {
  const os = useReducedMotion();
  const app = useSetting("reduceMotion");
  return Boolean(os) || app;
}
