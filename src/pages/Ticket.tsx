import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { TicketResponse } from "@shared/api-types";
import { Confetti } from "@/components/Confetti";
import { Reggie } from "@/components/reggie/Reggie";
import { ReggieBubble } from "@/components/reggie/ReggieBubble";
import { CalendarIcon, CheckIcon, DownloadIcon, MailIcon, PinIcon } from "@/components/icons";
import { Button, EmptyState, LinkButton, PageHeader, Pill } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { copy, errorCopy, fill } from "@/lib/copy";
import { formatDateTime } from "@/lib/format";
import { useFitSize } from "@/lib/useFit";

type Load = { status: "loading" } | { status: "error"; code: string } | { status: "ready"; data: TicketResponse };

export default function Ticket() {
  const { token = "" } = useParams();
  const [params] = useSearchParams();
  const isNew = params.get("new") === "1";
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const reggieSize = useFitSize(0.11, 60, 112);

  useEffect(() => {
    let active = true;
    setLoad({ status: "loading" });
    api
      .ticket(token)
      .then((data) => active && setLoad({ status: "ready", data }))
      .catch((err: unknown) => active && setLoad({ status: "error", code: err instanceof ApiError ? err.code : "internal" }));
    return () => {
      active = false;
    };
  }, [token, attempt]);

  if (load.status === "loading") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={copy.ticket.title} back="/events" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-10">
          <Reggie mood="loading" size={110} />
          <ReggieBubble>{copy.register.bubble.loading}</ReggieBubble>
        </div>
      </div>
    );
  }

  if (load.status === "error") {
    const notFound = load.code === "not_found";
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={copy.ticket.title} back="/events" />
        <EmptyState mood="confused" title={notFound ? copy.ticket.notFound : errorCopy(load.code)}>
          {notFound ? <p>{copy.ticket.notFoundSub}</p> : <Button onClick={() => setAttempt((n) => n + 1)}>{copy.app.retry}</Button>}
          <LinkButton to="/events" variant="ghost">
            {copy.ticket.back}
          </LinkButton>
        </EmptyState>
      </div>
    );
  }

  const { ticket, qrSvg } = load.data;
  const { event } = ticket;
  const firstName = ticket.fullName.trim().split(/\s+/)[0] ?? ticket.fullName;
  const celebrate = isNew && !ticket.checkedInAt;

  const onSave = async () => {
    setSaving(true);
    try {
      await saveTicketImage(qrSvg, ticket.fullName, event.title, formatDateTime(event.dateTime), event.venue);
    } catch {
      /* canvas unsupported; the email still has the ticket */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col">
      {celebrate && <Confetti />}
      <PageHeader title={copy.ticket.title} back="/events" />

      <div className="mb-4 flex shrink-0 items-center gap-3 short:mb-2">
        <Reggie mood={celebrate ? "success" : "idle"} size={reggieSize} showBall={false} />
        <ReggieBubble tail="left" className="flex-1 short:px-3 short:py-2">
          <p className="text-lg font-black leading-snug text-heading short:text-base">
            {celebrate ? copy.ticket.successBubble : fill(copy.ticket.idleBubble, { name: firstName })}
          </p>
          <p className="text-sm font-semibold leading-snug text-fg/75 short:text-xs">{copy.ticket.showAtDoor}</p>
        </ReggieBubble>
      </div>

      {/* Ticket card with a perforated tear line. The QR shrinks to whatever height is left. */}
      <article
        className="group flex min-h-0 flex-col overflow-hidden rounded-[20px] border-2 border-line bg-card ledge"
        aria-label={copy.ticket.title}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 bg-maroon px-5 py-3 text-white short:px-4 short:py-2">
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-widest text-gold">Reggie Ticket</p>
            <h2 className="line-clamp-2 text-xl leading-snug text-white short:line-clamp-1 short:text-lg">{event.title}</h2>
          </div>
          {ticket.checkedInAt && (
            <Pill tone="success" className="mt-1 shrink-0">
              <CheckIcon size={14} strokeWidth={3.5} />
              {copy.ticket.checkedIn}
            </Pill>
          )}
        </header>

        <div className="flex min-h-[128px] shrink flex-col px-5 pb-3 pt-4 short:px-4 short:pb-2 short:pt-3" style={{ height: 300 }}>
          <div className="min-h-0 w-full flex-1 [container-type:size]">
            <div
              className="mx-auto size-[min(100cqw,100cqh)] rounded-[16px] bg-white p-2.5 shadow-[0_0_0_2px_#DAA520] [&_svg]:block [&_svg]:h-full [&_svg]:w-full"
              // Trusted SVG generated by our own Worker (worker/services/qr.ts).
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
          </div>
        </div>

        <div className="relative flex shrink-0 items-center" aria-hidden="true">
          <span className="absolute -left-3 h-6 w-6 rounded-full border-2 border-line bg-bg" />
          <span className="mx-5 h-0 flex-1 border-t-[3px] border-dashed border-line" />
          <span className="absolute -right-3 h-6 w-6 rounded-full border-2 border-line bg-bg" />
        </div>

        <dl className="grid shrink-0 grid-cols-2 gap-x-4 gap-y-2 px-5 pb-4 pt-3 short:gap-y-1 short:px-4 short:pb-3 short:pt-2">
          <div className="col-span-2 min-w-0">
            <dt className="text-xs font-black uppercase tracking-wide text-fg/60">{copy.ticket.attendee}</dt>
            <dd className="truncate text-lg font-black leading-snug text-heading">{ticket.fullName}</dd>
            <dd className="truncate text-sm font-semibold text-fg/80">{ticket.organization}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-black uppercase tracking-wide text-fg/60">{copy.ticket.when}</dt>
            <dd className="flex items-start gap-1.5 text-sm font-bold leading-snug">
              <CalendarIcon size={16} className="mt-0.5 shrink-0" />
              <time dateTime={event.dateTime}>{formatDateTime(event.dateTime)}</time>
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-black uppercase tracking-wide text-fg/60">{copy.ticket.where}</dt>
            <dd className="flex items-start gap-1.5 text-sm font-bold leading-snug">
              <PinIcon size={16} className="mt-0.5 shrink-0" />
              <span className="line-clamp-2 min-w-0">{event.venue}</span>
            </dd>
          </div>
        </dl>
      </article>

      <p className="group mt-3 flex shrink-0 items-center justify-center gap-2 text-center text-sm font-bold text-fg/80 short:mt-2 short:text-xs">
        <MailIcon size={18} className="shrink-0 text-link" />
        {ticket.checkedInAt ? copy.ticket.checkedInNote : copy.ticket.emailNote}
      </p>

      <div className="mt-3 grid shrink-0 grid-cols-2 gap-3 pb-1.5 short:mt-2">
        <Button variant="secondary" full loading={saving} onClick={onSave} className="px-3! text-sm! leading-tight">
          {!saving && <DownloadIcon size={20} strokeWidth={3} className="shrink-0" />}
          {saving ? copy.ticket.saving : copy.ticket.save}
        </Button>
        <LinkButton to="/events" variant="ghost" full className="px-3! text-sm! leading-tight">
          {copy.ticket.back}
        </LinkButton>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Save as image */

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Wraps text onto lines no wider than maxWidth; returns the y after the last line. */
function drawWrapped(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 3) {
  const words = text.split(/\s+/);
  let line = "";
  let lines = 0;
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i];
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      y += lineHeight;
      lines++;
      line = words[i];
      if (lines === maxLines - 1) {
        line = words.slice(i).join(" ");
        break;
      }
    } else {
      line = test;
    }
  }
  if (line) {
    let last = line;
    while (ctx.measureText(last).width > maxWidth && last.length > 1) last = last.slice(0, -2) + "…";
    ctx.fillText(last, x, y);
    y += lineHeight;
  }
  return y;
}

/** Renders the QR SVG plus ticket details to a PNG and downloads it. */
async function saveTicketImage(qrSvg: string, name: string, title: string, when: string, venue: string) {
  // Firefox needs explicit width/height on the SVG root to rasterize it.
  let svg = qrSvg;
  if (!/<svg[^>]*\swidth=/.test(svg)) svg = svg.replace("<svg", '<svg width="1024" height="1024"');
  if (!svg.includes("xmlns=")) svg = svg.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const qr = await loadImage(url);
    const W = 720;
    const H = 1040;
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("no canvas");
    const font = (weight: number, size: number) => `${weight} ${size}px Nunito, system-ui, sans-serif`;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, W, H);
    // Maroon header with gold line
    ctx.fillStyle = "#800000";
    ctx.fillRect(0, 0, W, 170);
    ctx.fillStyle = "#FFDF00";
    ctx.fillRect(0, 170, W, 8);
    ctx.font = font(900, 24);
    ctx.fillText("REGGIE TICKET", 48, 56);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = font(900, 38);
    drawWrapped(ctx, title, 48, 104, W - 96, 44, 2);

    // QR
    const qrSize = 480;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, (W - qrSize) / 2, 210, qrSize, qrSize);

    // Perforation
    ctx.strokeStyle = "#DAA520";
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 10]);
    ctx.beginPath();
    ctx.moveTo(40, 730);
    ctx.lineTo(W - 40, 730);
    ctx.stroke();
    ctx.setLineDash([]);

    // Details
    ctx.fillStyle = "#800000";
    ctx.font = font(900, 40);
    let y = drawWrapped(ctx, name, 48, 800, W - 96, 46, 2);
    ctx.fillStyle = "#3B0A0A";
    ctx.font = font(700, 28);
    y = drawWrapped(ctx, when, 48, y + 14, W - 96, 36, 2);
    drawWrapped(ctx, venue, 48, y + 4, W - 96, 36, 2);

    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
    if (!blob) throw new Error("toBlob failed");
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = `reggie-ticket-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "event"}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  } finally {
    URL.revokeObjectURL(url);
  }
}
