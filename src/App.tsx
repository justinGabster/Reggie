import { Suspense, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useRegisterSW } from "virtual:pwa-register/react";
import { GearIcon, WifiOffIcon } from "@/components/icons";
import { SettingsSheet } from "@/components/SettingsSheet";
import { Button } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import { copy } from "@/lib/copy";
import { syncMusic } from "@/lib/music";
import { useReducedMotionSetting } from "@/lib/settings";
import { useOnline } from "@/lib/useOnline";

/**
 * Layout shell: maroon top bar (logo -> Home, settings gear), centered content, toasts. No tab bar.
 * The shell is exactly the viewport height (100dvh): the top bar stays put and <main> fills the rest.
 * Pages are flex columns that fit that space; long lists scroll inside their own box. <main> itself
 * only scrolls as a fallback (very small screens, on-screen keyboard, long forms).
 */
export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { reduced } = useReducedMotionSetting();
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  // Home uses a wider two-column hero; every other page keeps the 960px column.
  const shellWidth = pathname === "/" ? "max-w-[1120px]" : "max-w-[960px]";

  // Music: browsers block autoplay, so if it was left on, start it on the first tap/key press.
  // Also pause while the tab is hidden and resume when it comes back.
  useEffect(() => {
    syncMusic();
    const sync = () => syncMusic();
    window.addEventListener("pointerdown", sync);
    window.addEventListener("keydown", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      window.removeEventListener("pointerdown", sync);
      window.removeEventListener("keydown", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  // <main> is the scroller now, so start each page at its top.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [pathname]);

  return (
    <MotionConfig reducedMotion={reduced ? "always" : "user"}>
      <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
        <a
          href="#main"
          className="sr-only z-50 rounded-lg bg-gold px-3 py-2 font-black text-maroon focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to content
        </a>
        <header className="relative z-30 shrink-0 border-b-[3px] border-gold bg-topbar pt-[env(safe-area-inset-top)] text-topbar-fg">
          <div className={`mx-auto flex h-14 ${shellWidth} items-center justify-between pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] short:h-12`}>
            <Link to="/" className="flex items-center gap-2 rounded-full pr-2" aria-label="Reggie home">
              <span className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-gold bg-gold/90 short:h-8 short:w-8">
                <img
                  src="/reggie/idle.png"
                  alt=""
                  className="absolute left-1/2 top-[-6%] h-[170%] w-auto max-w-none -translate-x-1/2"
                  draggable={false}
                />
              </span>
              <span className="text-xl font-black tracking-tight">{copy.app.name}</span>
            </Link>
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              aria-label={copy.settings.open}
              aria-haspopup="dialog"
              className="-mr-1.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-gold transition-colors hover:bg-white/10"
            >
              <GearIcon size={26} />
            </button>
          </div>
        </header>

        <main
          ref={mainRef}
          id="main"
          tabIndex={-1}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain outline-none focus-visible:shadow-none"
        >
          <div className={`mx-auto flex min-h-0 w-full ${shellWidth} flex-1 flex-col pb-[max(1rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-4 short:pb-[max(0.75rem,env(safe-area-inset-bottom))] short:pt-2`}>
            <Suspense
              fallback={<LoadingScreen />}
            >
              <Outlet />
            </Suspense>
          </div>
        </main>

        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        <Toasts />
      </div>
    </MotionConfig>
  );
}

/** Offline / update toasts sit in the flow under <main> (not fixed), so pages shrink instead of being covered. */
function Toasts() {
  const online = useOnline();
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  return (
    <div
      aria-live="polite"
      className="relative z-40 flex shrink-0 flex-col items-center gap-2 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] empty:hidden"
    >
      <AnimatePresence>
        {!online && (
          <motion.div
            key="offline"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="status"
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[18px] border-2 border-line bg-card px-4 py-3 font-extrabold text-fg ledge"
          >
            <img src="/reggie/confused.png" alt="" className="h-10 w-auto" />
            <WifiOffIcon size={20} className="shrink-0 text-error" />
            <span>{copy.app.offline}</span>
          </motion.div>
        )}
        {needRefresh && (
          <motion.div
            key="update"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="status"
            className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-[18px] border-2 border-line bg-card px-4 py-3 text-fg ledge"
          >
            <img src="/reggie/success.png" alt="" className="h-10 w-auto" />
            <span className="flex-1 font-extrabold">{copy.app.updateAvailable}</span>
            <Button size="sm" variant="ghost" onClick={() => setNeedRefresh(false)}>
              {copy.app.later}
            </Button>
            <Button size="sm" onClick={() => void updateServiceWorker(true)}>
              {copy.app.reload}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
