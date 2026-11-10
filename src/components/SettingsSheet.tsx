import { useEffect, useRef } from "react";
import { Reggie } from "@/components/reggie/Reggie";
import { ReggieBubble } from "@/components/reggie/ReggieBubble";
import { Button, Toggle } from "@/components/ui";
import { copy } from "@/lib/copy";
import { syncMusic } from "@/lib/music";
import { useMusic, useMusicVolume, useReducedMotionSetting, useSound, useTheme } from "@/lib/settings";
import { playSound } from "@/lib/sound";
import { switchTheme } from "@/lib/themeTransition";

/** Settings dialog (native <dialog>: focus trap, Esc to close). Bottom sheet on phones. */
export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { theme, setTheme } = useTheme();
  const sound = useSound();
  const music = useMusic();
  const volume = useMusicVolume();
  const motion = useReducedMotionSetting();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === "function") d.showModal();
      else d.setAttribute("open", "");
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby="settings-title"
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(); // backdrop click
      }}
    >
      <div className="max-h-[100dvh] overflow-y-auto overscroll-contain rounded-t-[24px] border-2 border-b-0 border-line bg-card p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-fg short:p-4 short:pb-[calc(1rem+env(safe-area-inset-bottom))] sm:rounded-[24px] sm:border-b-2 sm:ledge">
        <div className="mb-4 flex items-center justify-between short:mb-2">
          <h2 id="settings-title" className="text-2xl">
            {copy.settings.title}
          </h2>
        </div>
        <div className="mb-4 flex items-center gap-3 short:mb-2">
          <Reggie mood="idle" size={72} />
          <ReggieBubble tail="left" className="flex-1">
            {copy.settings.bubble}
          </ReggieBubble>
        </div>
        <div className="divide-y-2 divide-line/40">
          <Toggle
            label={copy.settings.sounds}
            hint={copy.settings.soundsHint}
            checked={sound.enabled}
            onChange={(v) => {
              sound.setEnabled(v);
              if (v) playSound("pop", true);
            }}
          />
          <Toggle
            label={copy.settings.music}
            hint={copy.settings.musicHint}
            checked={music.enabled}
            onChange={(v) => {
              music.setEnabled(v);
              syncMusic(); // runs inside the click, so the browser allows playback
            }}
          />
          <div className="py-2">
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="music-volume" className="font-extrabold text-fg">
                {copy.settings.volume}
              </label>
              <span className="text-sm font-black tabular-nums text-heading" aria-hidden="true">
                {volume.volume}%
              </span>
            </div>
            <input
              id="music-volume"
              type="range"
              min={0}
              max={100}
              step={5}
              value={volume.volume}
              disabled={!music.enabled}
              aria-valuetext={`${volume.volume} percent`}
              onChange={(e) => {
                volume.setVolume(Number(e.target.value));
                syncMusic();
              }}
              className="mt-1 h-6 w-full cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
            />
          </div>
          <Toggle
            label={copy.settings.reduceMotion}
            hint={copy.settings.reduceMotionHint}
            checked={motion.reduced}
            onChange={motion.setReduced}
          />
          <Toggle
            label={copy.settings.darkMode}
            hint={copy.settings.darkModeHint}
            checked={theme === "dark"}
            onChange={(v, e) => switchTheme(v ? "dark" : "light", setTheme, e.currentTarget)}
          />
        </div>
        <Button className="mt-5 short:mt-3" full variant="primary" onClick={onClose}>
          {copy.settings.done}
        </Button>
      </div>
    </dialog>
  );
}
