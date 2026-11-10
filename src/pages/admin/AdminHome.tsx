import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { AdminEvent } from "@shared/api-types";
import { Button, Card, EmptyState, FitReggie, LinkButton, Pill, ProgressBar } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, PinIcon, PlusIcon } from "@/components/icons";
import Reggie from "@/components/reggie/Reggie";
import ReggieBubble from "@/components/reggie/ReggieBubble";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { copy, errorCopy } from "@/lib/copy";
import { formatEventDate } from "@/components/admin/format";
import { useFitSize } from "@/lib/useFit";

const T = {
  notConfiguredTitle: copy.admin.notConfigured,
  notConfiguredBody: copy.admin.notConfiguredSub,
  signedOutBubble: copy.admin.signInBubble,
  signIn: copy.admin.signIn,
  signingIn: copy.admin.signingIn,
  signedInBubble: copy.admin.welcome,
  heading: copy.admin.myEvents,
  signOut: copy.admin.signOut,
  emptyTitle: copy.admin.noEvents,
  emptyBody: copy.admin.noEventsSub,
  addEvent: copy.admin.addEvent,
  retry: copy.app.retry,
  loadError: copy.admin.loadError,
  published: copy.admin.published,
  draft: copy.admin.draft,
  checkedIn: copy.admin.stats.checkedIn,
};

export default function AdminHome() {
  const { session, user, loading, configured, signIn, signOut } = useAuth();
  const [signingIn, setSigningIn] = useState(false);

  async function handleSignIn() {
    setSigningIn(true);
    try {
      await signIn(); // redirects to Google on success
    } catch {
      setSigningIn(false);
    }
  }

  if (!configured) {
    return (
      <div className="flex min-h-0 flex-1 flex-col justify-center py-2">
        <Card className="flex min-h-0 flex-col items-center gap-4 text-center short:gap-3">
          <FitReggie mood="confused" min={80} max={140} showBall={false} />
          <h1 className="text-xl font-black text-heading">{T.notConfiguredTitle}</h1>
          <p className="text-fg">{T.notConfiguredBody}</p>
          <pre className="w-full overflow-x-auto rounded-xl border-2 border-line bg-bg p-3 text-left text-sm text-fg">
            {"VITE_SUPABASE_URL=https://<project>.supabase.co\nVITE_SUPABASE_ANON_KEY=<anon key>"}
          </pre>
        </Card>
      </div>
    );
  }

  if (loading) return <LoadingScreen />;

  if (!session) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 py-2 short:gap-3">
        <FitReggie mood="idle" min={120} max={220} />
        <ReggieBubble className="shrink-0 text-center">{T.signedOutBubble}</ReggieBubble>
        <Card className="flex w-full max-w-sm shrink-0 flex-col items-center gap-3 text-center short:p-3">
          <Button variant="ghost" full loading={signingIn} onClick={() => void handleSignIn()}>
            {!signingIn && <GoogleMark />}
            {signingIn ? T.signingIn : T.signIn}
          </Button>
        </Card>
      </div>
    );
  }

  return <MyEvents email={user?.email ?? ""} onSignOut={() => void signOut()} />;
}

function MyEvents({ email, onSignOut }: { email: string; onSignOut: () => void }) {
  const [events, setEvents] = useState<AdminEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reggieSize = useFitSize(0.1, 56, 96);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { events: list } = await api.admin.events();
      setEvents(list);
    } catch (e) {
      setError(e instanceof ApiError ? errorCopy(e.code) : T.loadError);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center gap-3 sm:gap-5">
        <Reggie mood="idle" size={reggieSize} showBall={false} />
        <ReggieBubble tail="left" className="flex-1 short:px-3 short:py-2 sm:flex-none">
          {T.signedInBubble}
        </ReggieBubble>
      </div>

      <div className="mt-4 flex shrink-0 items-end justify-between gap-3 short:mt-3">
        <div className="flex min-w-0 items-center gap-1">
          <Link
            to="/"
            aria-label={copy.app.back}
            className="-ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-heading transition-colors hover:bg-fg/10 short:h-10 short:w-10"
          >
            <ChevronLeftIcon size={28} strokeWidth={3} />
          </Link>
          <div className="min-w-0">
            <h1 className="text-2xl font-black leading-tight text-heading short:text-xl">{T.heading}</h1>
            {email && <p className="truncate text-sm font-semibold text-fg">{email}</p>}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onSignOut} className="shrink-0">
          {T.signOut}
        </Button>
      </div>

      <section className="mt-1 flex min-h-0 flex-1 flex-col" aria-live="polite" aria-busy={events === null && !error}>
        {error ? (
          <Card className="mt-3 flex flex-col items-center gap-3 text-center">
            <Reggie mood="sad" size={reggieSize} showBall={false} />
            <p className="font-bold text-error" role="alert">
              {error}
            </p>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              {T.retry}
            </Button>
          </Card>
        ) : events === null ? (
          <LoadingScreen />
        ) : events.length === 0 ? (
          <EmptyState mood="confused" title={T.emptyTitle}>
            <p className="mb-3 text-fg">{T.emptyBody}</p>
            <LinkButton to="/admin/events/new">{T.addEvent.toUpperCase()}</LinkButton>
          </EmptyState>
        ) : (
          <ul
            className="scroll-fade -mx-2 grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-2 pb-28 pt-4 md:grid-cols-2"
            aria-label={T.heading}
          >
            {events.map((ev) => (
              <li key={ev.id}>
                <EventCard event={ev} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <Link
        to="/admin/events/new"
        className="group fixed bottom-6 right-4 z-30 flex flex-col items-center gap-1 rounded-full outline-none focus-visible:shadow-none short:bottom-4 sm:right-8"
        style={{ marginBottom: "env(safe-area-inset-bottom)" }}
        aria-label="Add event"
      >
        <span
          className="flex h-16 w-16 items-center justify-center rounded-full border-b-4 border-primary-ledge bg-primary text-primary-fg transition-transform group-hover:-translate-y-0.5 group-focus-visible:ring-4 group-focus-visible:ring-focus group-active:translate-y-1 group-active:border-b-0 short:h-14 short:w-14"
          aria-hidden="true"
        >
          <PlusIcon size={30} strokeWidth={3.4} />
        </span>
        <span className="rounded-full border-2 border-line bg-card px-2 py-0.5 text-[11px] font-black uppercase tracking-wide text-heading">
          {T.addEvent.toUpperCase()}
        </span>
      </Link>
    </div>
  );
}

function EventCard({ event }: { event: AdminEvent }) {
  const published = event.status === "published";
  return (
    <Link
      to={`/admin/events/${event.id}`}
      className="group block rounded-[20px] outline-none transition-transform hover:-translate-y-0.5 focus-visible:shadow-none focus-visible:ring-4 focus-visible:ring-focus"
    >
      <Card className="h-full">
        <div className="flex items-start justify-between gap-3">
          <h2 className="min-w-0 break-words text-lg font-black text-heading">{event.title}</h2>
          <span className="flex shrink-0 items-center gap-1">
            <Pill tone={published ? "maroon" : "gold"}>{(published ? T.published : T.draft).toUpperCase()}</Pill>
            <ChevronRightIcon size={20} strokeWidth={3} className="text-heading" />
          </span>
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-fg">
          <CalendarIcon size={15} className="shrink-0" />
          {formatEventDate(event.dateTime)}
        </p>
        <p className="flex min-w-0 items-center gap-1.5 text-sm text-fg">
          <PinIcon size={15} className="shrink-0" />
          <span className="truncate">{event.venue}</span>
        </p>
        <div className="mt-3">
          <ProgressBar value={event.registeredCount} max={event.capacity} />
        </div>
        <div className="mt-2 flex flex-wrap justify-between gap-2 text-sm font-bold">
          <span className="text-fg">
            {event.registeredCount} / {event.capacity} registered
          </span>
          <span className="text-success">
            {event.checkedInCount} {T.checkedIn.toLowerCase()}
          </span>
        </div>
      </Card>
    </Link>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="20" height="20" aria-hidden="true" className="inline-block shrink-0">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
