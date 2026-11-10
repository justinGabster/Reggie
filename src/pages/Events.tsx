import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PublicEvent } from "@shared/api-types";
import { Reggie } from "@/components/reggie/Reggie";
import { ReggieBubble } from "@/components/reggie/ReggieBubble";
import { ChevronRightIcon, PinIcon } from "@/components/icons";
import { Button, EmptyState, PageHeader, Pill, ProgressBar, cx } from "@/components/ui";
import { ApiError, api } from "@/lib/api";
import { copy, errorCopy, fill } from "@/lib/copy";
import { dateChip, formatDateTime } from "@/lib/format";
import { useFitSize } from "@/lib/useFit";

type State =
  | { status: "loading" }
  | { status: "error"; code: string }
  | { status: "ready"; events: PublicEvent[] };

export default function Events() {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(() => {
    setState({ status: "loading" });
    api
      .events()
      .then(({ events }) => setState({ status: "ready", events }))
      .catch((err: unknown) => setState({ status: "error", code: err instanceof ApiError ? err.code : "internal" }));
  }, []);

  useEffect(load, [load]);
  const reggieSize = useFitSize(0.085, 52, 72);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={copy.events.title} back="/" />

      {state.status === "loading" && <EventsSkeleton />}

      {state.status === "error" && (
        <EmptyState mood={state.code === "network" ? "confused" : "error"} title={errorCopy(state.code)}>
          {state.code !== "network" && <p>{copy.events.loadError}</p>}
          <Button onClick={load}>{copy.app.retry}</Button>
        </EmptyState>
      )}

      {state.status === "ready" && state.events.length === 0 && (
        <EmptyState mood="confused" title={copy.events.empty}>
          <p>{copy.events.emptySub}</p>
        </EmptyState>
      )}

      {state.status === "ready" && state.events.length > 0 && (
        <>
          <div className="mb-1 flex shrink-0 items-center gap-3">
            <Reggie mood="idle" size={reggieSize} />
            <ReggieBubble tail="left" className="flex-1 short:py-2 sm:flex-none">
              {copy.events.bubble}
            </ReggieBubble>
          </div>
          {/* The list scrolls inside its own box so the header and Reggie stay put. */}
          <ul
            className="scroll-fade -mx-2 grid min-h-0 flex-1 content-start gap-5 overflow-y-auto px-2 pb-6 pt-4 short:gap-4 sm:grid-cols-2"
            aria-label={copy.events.title}
          >
            {state.events.map((e) => (
              <li key={e.id}>
                <EventCard event={e} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function EventCard({ event }: { event: PublicEvent }) {
  const full = event.spotsLeft <= 0;
  const chip = dateChip(event.dateTime);
  const taken = Math.max(0, event.capacity - event.spotsLeft);
  const spotsText = event.spotsLeft === 1 ? copy.events.oneSpotLeft : fill(copy.events.spotsLeft, { n: event.spotsLeft });

  const body = (
    <>
      <div className="h-2.5 bg-maroon" aria-hidden="true" />
      <div className="flex gap-4 p-4">
        <div
          className="flex h-[68px] w-[60px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-secondary text-secondary-fg shadow-[0_3px_0_var(--color-secondary-ledge)]"
          aria-hidden="true"
        >
          <span className="text-[11px] font-black leading-none">{chip.month}</span>
          <span className="text-2xl font-black leading-tight">{chip.day}</span>
          <span className="text-[10px] font-extrabold leading-none opacity-80">{chip.weekday}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-lg leading-snug">{event.title}</h2>
            {full ? (
              <Pill tone="danger" className="mt-0.5">
                {copy.events.full}
              </Pill>
            ) : (
              <ChevronRightIcon size={22} strokeWidth={3} className="mt-0.5 shrink-0 text-heading" />
            )}
          </div>
          <p className="mt-0.5 text-sm font-bold text-fg/80">
            <time dateTime={event.dateTime}>{formatDateTime(event.dateTime)}</time>
          </p>
          <p className="mt-0.5 flex items-center gap-1 text-sm font-semibold text-fg/80">
            <PinIcon size={15} className="shrink-0" />
            <span className="truncate">{event.venue}</span>
          </p>
          {event.description && <p className="mt-2 line-clamp-2 text-sm text-fg/80">{event.description}</p>}
          <div className="mt-3">
            <ProgressBar value={taken} max={event.capacity} label={`${taken} of ${event.capacity} spots taken`} />
            <p className="mt-1 text-xs font-extrabold uppercase tracking-wide text-fg/70">
              {full ? copy.events.full : spotsText}
            </p>
          </div>
        </div>
      </div>
    </>
  );

  const shell = "block overflow-hidden rounded-[20px] border-2 border-line bg-card ledge";

  if (full) {
    return (
      <div className={cx(shell, "opacity-60 grayscale")} aria-disabled="true">
        {body}
      </div>
    );
  }
  return (
    <Link
      to={`/events/${event.id}/register`}
      className={cx(shell, "group transition-transform duration-100 hover:-translate-y-0.5 active:translate-y-1 active:shadow-none")}
    >
      {body}
    </Link>
  );
}

function EventsSkeleton() {
  return (
    <div
      className="-mx-2 grid min-h-0 flex-1 content-start gap-5 overflow-hidden px-2 pt-2 short:gap-4 sm:grid-cols-2"
      aria-busy="true"
      aria-label={copy.app.loading}
    >
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="overflow-hidden rounded-[20px] border-2 border-line bg-card ledge">
          <div className="h-2.5 bg-maroon/40" />
          <div className="flex gap-4 p-4">
            <div className="skeleton h-[68px] w-[60px] shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-1/2" />
              <div className="skeleton h-4 w-2/3" />
              <div className="skeleton mt-3 h-2.5 w-full" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
