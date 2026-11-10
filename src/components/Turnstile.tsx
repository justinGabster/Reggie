import { useEffect, useRef } from "react";
import { useTheme } from "@/lib/settings";

/**
 * Cloudflare Turnstile widget (bot check for the registration form).
 *
 * Enabled only when VITE_TURNSTILE_SITE_KEY is set; otherwise it renders nothing and the form
 * works without a captcha. The Worker enforces the check only when TURNSTILE_SECRET is set, so
 * set the site key and the secret together (see .env.example / .dev.vars.example).
 */

export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? "";

type RenderOptions = {
  sitekey: string;
  theme?: "light" | "dark" | "auto";
  size?: "normal" | "flexible" | "compact";
  callback: (token: string) => void;
  "expired-callback": () => void;
  "error-callback": () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: RenderOptions) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise<void>((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null; // allow a retry on the next mount
        reject(new Error("Turnstile failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export function Turnstile({
  onToken,
  resetKey = 0,
  className,
}: {
  /** Gets a fresh token, or null when it expires / errors / is reset. */
  onToken: (token: string | null) => void;
  /** Bump this to get a new challenge (tokens are single-use, so do it after every submit attempt). */
  resetKey?: number;
  className?: string;
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const latest = useRef(onToken);
  const { theme } = useTheme();

  useEffect(() => {
    latest.current = onToken;
  });

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return;
    let cancelled = false;
    latest.current(null);
    loadScript()
      .then(() => {
        if (cancelled || !boxRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(boxRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          size: "flexible",
          callback: (token) => latest.current(token),
          "expired-callback": () => latest.current(null),
          "error-callback": () => latest.current(null),
        });
      })
      .catch(() => latest.current(null));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [theme]);

  useEffect(() => {
    if (resetKey > 0 && widgetId.current && window.turnstile) {
      latest.current(null);
      window.turnstile.reset(widgetId.current);
    }
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;
  return <div ref={boxRef} className={className} />;
}

export default Turnstile;
