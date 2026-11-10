import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Scanner, type IDetectedBarcode, type IScannerError } from "@yudiel/react-qr-scanner";
import { Button, Card, Field, PageHeader } from "@/components/ui";
import Reggie from "@/components/reggie/Reggie";
import ReggieBubble from "@/components/reggie/ReggieBubble";
import { api, ApiError } from "@/lib/api";
import { copy, errorCopy } from "@/lib/copy";
import { useShouldReduceMotion } from "@/lib/settings";
import ScanResultSheet, { type ScanOutcome, type ScanSheetItem } from "@/components/admin/ScanResultSheet";

const S = copy.scan;
const T = {
  // Not in copy.ts yet.
  steps: ["Tap the lock icon", "Allow camera", "Reload"],
  reload: "RELOAD",
  cameraError: "Hindi gumana ang camera.",
  cameraInUse: "Ginagamit ng ibang app ang camera. Isara mo muna 'yon, tapos i-reload.",
  manualTitle: "Enter code manually",
  manualPlaceholder: "Paste or type the ticket token",
};

/** Same rule as checkinInput in shared/schemas.ts. */
const TOKEN_RE = /^[A-Za-z0-9_-]{22,64}$/;
const COOLDOWN_MS = 2000;

/** The QR holds only the token (Plan §8.1), but accept a ticket URL too and take its last path segment. */
function extractToken(raw: string): string {
  const s = raw.trim();
  if (/^https?:\/\//i.test(s)) {
    try {
      const seg = new URL(s).pathname.split("/").filter(Boolean).pop();
      if (seg) return decodeURIComponent(seg);
    } catch {
      /* not a URL after all */
    }
  }
  return s;
}

function vibrate(outcome: ScanOutcome) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(outcome.result === "checked_in" ? 120 : [70, 60, 70]);
    }
  } catch {
    /* unsupported */
  }
}

type Camera = { state: "on" } | { state: "denied" } | { state: "unavailable" } | { state: "error"; message: string };

export default function Scan() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const reduce = useShouldReduceMotion();

  const [camera, setCamera] = useState<Camera>({ state: "on" });
  const [sheet, setSheet] = useState<ScanSheetItem | null>(null);
  const [checking, setChecking] = useState(false);
  const [manual, setManual] = useState("");
  const [manualError, setManualError] = useState<string | undefined>(undefined);

  const inFlight = useRef(false);
  const last = useRef<{ token: string; at: number } | null>(null);
  const nextId = useRef(1);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /** Runs one check-in. Returns false if it was skipped (busy or cooldown). */
  const check = useCallback(
    async (raw: string, fromCamera: boolean): Promise<boolean> => {
      const token = extractToken(raw);
      if (!token) return false;
      const now = Date.now();
      const prev = last.current;
      if (fromCamera && prev && prev.token === token && now - prev.at < COOLDOWN_MS) {
        // Same QR still in view: keep extending the cooldown so it isn't re-sent while held up.
        prev.at = now;
        return false;
      }
      if (inFlight.current) return false;
      last.current = { token, at: now };

      let outcome: ScanOutcome;
      if (!TOKEN_RE.test(token)) {
        outcome = { result: "invalid" };
      } else {
        inFlight.current = true;
        setChecking(true);
        try {
          outcome = await api.admin.checkin(eventId, token);
        } catch (e) {
          if (e instanceof ApiError && e.code === "validation_error") outcome = { result: "invalid" };
          else outcome = { result: "error", message: errorCopy(e instanceof ApiError ? e.code : "internal") };
        } finally {
          inFlight.current = false;
          if (mounted.current) setChecking(false);
        }
      }
      if (!mounted.current) return true;
      last.current = { token, at: Date.now() };
      setSheet({ id: nextId.current++, outcome });
      vibrate(outcome);
      return true;
    },
    [eventId],
  );

  const onScan = useCallback(
    (codes: IDetectedBarcode[]) => {
      const raw = codes.find((c) => c.rawValue)?.rawValue;
      if (raw) void check(raw, true);
    },
    [check],
  );

  const onError = useCallback((err: IScannerError) => {
    switch (err.kind) {
      case "permission-denied":
      case "security":
        setCamera({ state: "denied" });
        break;
      case "no-camera":
      case "unsupported":
      case "insecure-context":
      case "overconstrained":
        setCamera({ state: "unavailable" });
        break;
      case "in-use":
        setCamera({ state: "error", message: T.cameraInUse });
        break;
      case "aborted":
        break; // camera stopped on navigation; nothing to show
      default:
        setCamera({ state: "error", message: T.cameraError });
    }
  }, []);

  const dismiss = useCallback(() => setSheet(null), []);

  async function onManualSubmit(e: FormEvent) {
    e.preventDefault();
    const token = extractToken(manual);
    if (!TOKEN_RE.test(token)) {
      setManualError(errorCopy("token_invalid"));
      return;
    }
    setManualError(undefined);
    const ran = await check(token, false);
    if (ran && mounted.current) setManual("");
  }

  const status = checking ? S.checking : S.ready;

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={S.title} back={`/admin/events/${eventId}`} />
        <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col gap-3 short:gap-2">
          {camera.state === "on" ? (
            // The camera fills whatever height is left; the scan frame stays square (container units).
            <div
              className="relative min-h-[200px] w-full flex-1 overflow-hidden rounded-[24px] bg-black [container-type:size]"
              style={{ boxShadow: "0 4px 0 #000" }}
            >
              <Scanner
                onScan={onScan}
                onError={onError}
                constraints={{ facingMode: "environment" }}
                formats={["qr_code"]}
                allowMultiple
                scanDelay={400}
                sound={false}
                components={{ finder: false, torch: true }}
                styles={{
                  container: { width: "100%", height: "100%", position: "absolute", inset: 0 },
                  video: { width: "100%", height: "100%", objectFit: "cover" },
                }}
              />
              <ScanFrame reduce={reduce} busy={checking} />
            </div>
          ) : (
            <CameraBlocked camera={camera} />
          )}

          <p className="mt-1 shrink-0 text-center text-sm font-bold text-fg" aria-live="polite">
            {camera.state === "on" ? status : checking ? S.checking : ""}
          </p>

          <Card className="shrink-0 short:py-3">
            <form
              onSubmit={onManualSubmit}
              noValidate
              className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2"
              aria-label={T.manualTitle}
            >
              <Field
                label={S.manualLabel}
                name="token"
                id="manual-token"
                value={manual}
                onChange={(e) => {
                  setManual(e.target.value);
                  if (manualError) setManualError(undefined);
                }}
                placeholder={T.manualPlaceholder}
                autoComplete="off"
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
                hint={S.manualHint}
                error={manualError}
              />
              {/* Lines up with the input under the field label (label line + gap). */}
              <Button
                type="submit"
                variant="secondary"
                loading={checking}
                disabled={!manual.trim()}
                className="mt-[26px] h-[50px] min-h-0! px-4! short:mt-5 short:h-11"
              >
                {S.manualSubmit.toUpperCase()}
              </Button>
            </form>
          </Card>
        </div>
      </div>

      <ScanResultSheet item={sheet} onDismiss={dismiss} />
    </>
  );
}

/** Gold rounded scan frame with corner brackets and a moving scan line. Camera area only, so fixed colors are fine. */
function ScanFrame({ reduce, busy }: { reduce: boolean; busy: boolean }) {
  const corner = "absolute h-10 w-10 border-gold";
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
      <div className="relative size-[min(68cqw,68cqh)]">
        <span className={`${corner} left-0 top-0 rounded-tl-[22px] border-l-[6px] border-t-[6px]`} />
        <span className={`${corner} right-0 top-0 rounded-tr-[22px] border-r-[6px] border-t-[6px]`} />
        <span className={`${corner} bottom-0 left-0 rounded-bl-[22px] border-b-[6px] border-l-[6px]`} />
        <span className={`${corner} bottom-0 right-0 rounded-br-[22px] border-b-[6px] border-r-[6px]`} />
        {reduce ? (
          <span className="absolute inset-x-3 top-1/2 h-[3px] rounded-full bg-gold opacity-80" />
        ) : (
          <motion.span
            className="absolute inset-x-3 h-[3px] rounded-full bg-gold"
            style={{ boxShadow: "0 0 12px 2px rgb(255 223 0 / 0.7)" }}
            initial={{ top: "6%" }}
            animate={{ top: ["6%", "94%", "6%"] }}
            transition={{ duration: busy ? 0.9 : 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </div>
    </div>
  );
}

function CameraBlocked({ camera }: { camera: Exclude<Camera, { state: "on" }> }) {
  const title =
    camera.state === "denied" ? S.cameraDenied : camera.state === "unavailable" ? S.cameraUnsupported : camera.message;
  return (
    <Card className="flex min-h-0 flex-1 flex-col items-center gap-3 overflow-y-auto text-center" role="alert">
      <Reggie mood="sad" size={96} showBall={false} />
      <ReggieBubble>{title}</ReggieBubble>
      {camera.state === "denied" && (
        <ol className="mt-1 flex w-full flex-col gap-2 text-left">
          {T.steps.map((step, i) => (
            <li key={step} className="flex items-center gap-3 rounded-xl border-2 border-line bg-bg px-3 py-2 font-bold text-fg">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-fg">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      )}
      {camera.state === "denied" && <p className="text-sm text-fg">{S.cameraSteps}</p>}
      {camera.state !== "unavailable" && (
        <Button variant="primary" size="sm" onClick={() => window.location.reload()}>
          {T.reload}
        </Button>
      )}
    </Card>
  );
}
