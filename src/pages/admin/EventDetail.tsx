import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { AdminEvent, AdminRegistration, Stats } from "@shared/api-types";
import { Button, Card, EmptyState, LinkButton, PageHeader, Pill, Toggle } from "@/components/ui";
import { LoadingScreen } from "@/components/LoadingScreen";
import Reggie from "@/components/reggie/Reggie";
import ReggieBubble from "@/components/reggie/ReggieBubble";
import type { Mood } from "@/components/reggie/moods";
import { api, ApiError } from "@/lib/api";
import { copy, errorCopy } from "@/lib/copy";
import StatTiles from "@/components/admin/StatTiles";
import EventEditForm from "@/components/admin/EventEditForm";
import ConfirmDeleteDialog from "@/components/admin/ConfirmDeleteDialog";
import { csvFilename, formatEventDate } from "@/components/admin/format";
import { CalendarIcon, CameraIcon, DownloadIcon, MailIcon, PinIcon, RefreshIcon, SearchIcon } from "@/components/icons";
import { useFitSize } from "@/lib/useFit";

const A = copy.admin;
const T = {
  loading: copy.app.loading,
  notFoundTitle: "Hindi ko mahanap ang event na 'to.",
  notFoundBody: "Baka nabura na, o hindi ikaw ang may-ari.",
  back: "BACK TO MY EVENTS",
  retry: copy.app.retry.toUpperCase(),
  publish: A.published,
  published: A.published.toUpperCase(),
  draft: A.draft.toUpperCase(),
  refresh: "Refresh",
  edit: "Edit details",
  search: A.search,
  searchLabel: "Search registrants",
  registrants: A.registrants,
  scan: A.scanQr.toUpperCase(),
  export: A.downloadCsv.toUpperCase(),
  resend: A.resend.toUpperCase(),
  checkedIn: A.checkedInPill.toUpperCase(),
  registered: A.stats.registered.toUpperCase(),
  emailFailed: A.stats.emailFailed.toUpperCase(),
  emailSending: `EMAIL ${A.emailStatus.pending.toUpperCase()}`,
  noRegsTitle: A.noRegistrants,
  noRegsDraft: "I-publish mo muna ang event para makapag-register sila.",
  noRegsPublished: "Naka-publish na! Hintayin natin sila.",
  noMatches: A.noMatches,
  publishedOk: A.publishedNote,
  unpublishedOk: A.unpublishedNote,
  resendOk: A.resent,
  savedOk: "Na-save ang changes!",
};
const D = A.deleteEvent;

function reggieLine(stats: Stats, status: AdminEvent["status"]): string {
  if (stats.checkedIn > 0) return `${stats.checkedIn} na ang pumasok! Tuloy lang.`;
  if (stats.registered > 0) return `${stats.registered} na ang registered! Ready na sa check-in.`;
  return status === "draft" ? "Draft pa 'to. I-publish mo para makapag-register sila." : "Naka-publish na! Hintayin natin ang mga registrants.";
}

type Notice = { tone: "success" | "error"; text: string } | null;

export default function EventDetail() {
  const { eventId = "" } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<AdminEvent | null>(null);
  const [regs, setRegs] = useState<AdminRegistration[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadError, setLoadError] = useState<{ notFound: boolean; message: string } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [toggling, setToggling] = useState(false);
  const [resending, setResending] = useState<ReadonlySet<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [notice, setNotice] = useState<Notice>(null);
  const reggieSize = useFitSize(0.09, 52, 96);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [{ event: ev }, data] = await Promise.all([api.admin.event(eventId), api.admin.registrations(eventId)]);
      setEvent(ev);
      setRegs(data.registrations);
      setStats(data.stats);
      setLoadError(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) setLoadError({ notFound: true, message: T.notFoundTitle });
      else setLoadError({ notFound: false, message: errorCopy(e instanceof ApiError ? e.code : "internal") });
    } finally {
      setRefreshing(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  const filtered = useMemo(() => {
    if (!regs) return [];
    const q = query.trim().toLowerCase();
    if (!q) return regs;
    return regs.filter((r) =>
      [r.fullName, r.email, r.organization, r.contactNumber].some((s) => s.toLowerCase().includes(q)),
    );
  }, [regs, query]);

  async function togglePublish(next: boolean) {
    if (!event || toggling) return;
    const prev = event.status;
    const status = next ? "published" : "draft";
    setEvent({ ...event, status }); // optimistic
    setToggling(true);
    try {
      const { event: updated } = await api.admin.updateEvent(event.id, { status });
      setEvent(updated);
      setNotice({ tone: "success", text: next ? T.publishedOk : T.unpublishedOk });
    } catch (e) {
      setEvent((cur) => (cur ? { ...cur, status: prev } : cur)); // rollback
      setNotice({ tone: "error", text: errorCopy(e instanceof ApiError ? e.code : "internal") });
    } finally {
      setToggling(false);
    }
  }

  async function resend(reg: AdminRegistration) {
    if (resending.has(reg.id)) return;
    setResending((s) => new Set(s).add(reg.id));
    try {
      await api.admin.resend(reg.id);
      setRegs((list) => list?.map((r) => (r.id === reg.id ? { ...r, emailStatus: "pending" } : r)) ?? list);
      setStats((s) => (s ? { ...s, emailFailed: Math.max(0, s.emailFailed - 1) } : s));
      setNotice({ tone: "success", text: T.resendOk });
    } catch (e) {
      setNotice({ tone: "error", text: errorCopy(e instanceof ApiError ? e.code : "internal") });
    } finally {
      setResending((s) => {
        const n = new Set(s);
        n.delete(reg.id);
        return n;
      });
    }
  }

  async function deleteEvent() {
    if (!event || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.admin.deleteEvent(event.id);
      navigate("/admin", { replace: true });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        navigate("/admin", { replace: true }); // already gone
        return;
      }
      setDeleteError(errorCopy(e instanceof ApiError ? e.code : "internal"));
      setDeleting(false);
    }
  }

  async function exportCsv() {
    if (!event || exporting) return;
    setExporting(true);
    try {
      await api.admin.downloadCsv(event.id, csvFilename(event.title));
    } catch (e) {
      setNotice({ tone: "error", text: errorCopy(e instanceof ApiError ? e.code : "internal") });
    } finally {
      setExporting(false);
    }
  }

  // ----- Loading / error states -----
  if (loadError && !event) {
    return (
      <>
        <div className="flex min-h-0 flex-1 flex-col">
          <PageHeader title="Event" back="/admin" />
          {loadError.notFound ? (
            <EmptyState mood="sad" title={T.notFoundTitle}>
              <p className="mb-3 text-fg">{T.notFoundBody}</p>
              <LinkButton to="/admin" variant="secondary">
                {T.back}
              </LinkButton>
            </EmptyState>
          ) : (
            <EmptyState mood="sad" title={loadError.message}>
              <Button variant="secondary" onClick={() => void load()} loading={refreshing}>
                {T.retry}
              </Button>
            </EmptyState>
          )}
        </div>
      </>
    );
  }

  if (!event || !regs || !stats) {
    return <LoadingScreen />;
  }

  const published = event.status === "published";
  const mood: Mood = notice?.tone === "error" ? "error" : notice?.tone === "success" ? "success" : "idle";

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader
          title={event.title}
          back="/admin"
          right={
            <Button variant="ghost" size="sm" onClick={() => void load()} loading={refreshing} aria-label="Refresh registrants">
              {!refreshing && <RefreshIcon size={18} strokeWidth={3} />}
              <span className="hidden sm:inline">{T.refresh}</span>
            </Button>
          }
        />
        {/* Header: Reggie line, details, publish toggle. Stays put while the registrant list scrolls. */}
        <div className="flex shrink-0 flex-col gap-2 md:flex-row-reverse md:items-start md:justify-between md:gap-6">
          <div className="flex items-center gap-3 md:max-w-[380px]">
            <Reggie mood={mood} size={reggieSize} showBall={false} className="shrink-0" />
            <ReggieBubble tail="left" className="flex-1 short:px-3 short:py-2 short:text-sm">
              {reggieLine(stats, event.status)}
            </ReggieBubble>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-x-4">
              <div className="flex items-center gap-2">
                <Pill tone={published ? "maroon" : "gold"}>{published ? T.published : T.draft}</Pill>
                <button
                  type="button"
                  onClick={() => setEditing((v) => !v)}
                  className="rounded-md text-sm font-extrabold text-link underline underline-offset-2 outline-none focus-visible:ring-4 focus-visible:ring-focus"
                  aria-expanded={editing}
                >
                  {T.edit}
                </button>
              </div>
              <Toggle
                checked={published}
                onChange={(v) => void togglePublish(v)}
                label={T.publish}
                disabled={toggling}
                className="py-1! gap-3!"
              />
            </div>
            <div className="group flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-fg">
              <p className="flex items-center gap-1.5 font-bold">
                <CalendarIcon size={15} className="shrink-0" />
                {formatEventDate(event.dateTime)}
              </p>
              <p className="flex min-w-0 items-center gap-1.5">
                <PinIcon size={15} className="shrink-0" />
                <span className="truncate">{event.venue}</span>
              </p>
            </div>
          </div>
        </div>

        {editing && (
          <div className="mt-4 shrink-0">
            <EventEditForm
              event={event}
              onCancel={() => setEditing(false)}
              onSaved={(ev) => {
                setEvent(ev);
                setStats((s) => (s ? { ...s, capacity: ev.capacity } : s));
                setEditing(false);
                setNotice({ tone: "success", text: T.savedOk });
              }}
            />
          </div>
        )}

        <div className="mt-4 shrink-0 short:mt-3">
          <StatTiles stats={stats} />
        </div>

        <div aria-live="polite" className="shrink-0">
          {notice && (
            <p
              role={notice.tone === "error" ? "alert" : "status"}
              className={`mt-3 rounded-xl border-2 px-3 py-2 text-sm font-bold ${
                notice.tone === "error" ? "border-error bg-error-fill text-error" : "border-success bg-success-fill text-success"
              }`}
            >
              {notice.text}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-4 flex shrink-0 items-center gap-3 short:mt-3">
          <LinkButton to={`/admin/events/${event.id}/scan`} variant="primary" full className="flex-1">
            <CameraIcon size={22} />
            {T.scan}
          </LinkButton>
          <Button
            variant="ghost"
            onClick={() => void exportCsv()}
            loading={exporting}
            disabled={regs.length === 0}
            aria-label={T.export}
            className="shrink-0 px-4!"
          >
            {!exporting && <DownloadIcon size={20} strokeWidth={3} />}
            <span className="sm:hidden">CSV</span>
            <span className="hidden sm:inline">{T.export}</span>
          </Button>
        </div>

        {/* Registrants: the list scrolls inside its own box so everything above stays put. */}
        <section className="mt-4 flex min-h-[200px] flex-1 flex-col short:mt-3" aria-labelledby="registrants-heading">
          <div className="flex shrink-0 items-center gap-3">
            <h2 id="registrants-heading" className="shrink-0 text-xl font-black leading-tight text-heading short:text-lg">
              {T.registrants} <span className="text-base font-bold text-fg">({regs.length})</span>
            </h2>
            {regs.length > 0 && (
              <div className="group relative min-w-0 flex-1">
                <label htmlFor="registrant-search" className="sr-only">
                  {T.searchLabel}
                </label>
                <SearchIcon
                  size={18}
                  strokeWidth={2.8}
                  className="pointer-events-none absolute left-3 top-1/2 -mt-[9px] text-heading opacity-70"
                />
                <input
                  id="registrant-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={T.search}
                  autoComplete="off"
                  className="h-11 w-full rounded-[14px] border-2 border-line bg-card pl-9 pr-3 text-sm font-semibold text-fg outline-none placeholder:text-fg placeholder:opacity-60 focus:border-focus focus:ring-4 focus:ring-gold/40 focus-visible:shadow-none"
                />
              </div>
            )}
          </div>

          {regs.length === 0 ? (
            <EmptyState mood="confused" title={T.noRegsTitle}>
              <p className="text-fg">{published ? T.noRegsPublished : T.noRegsDraft}</p>
            </EmptyState>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center font-bold text-fg" role="status">
              {T.noMatches}
            </p>
          ) : (
            <div className="scroll-fade -mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-6 pt-3" tabIndex={0} aria-label={T.registrants}>
              <RegistrantTable rows={filtered} resending={resending} onResend={resend} />
              <RegistrantCards rows={filtered} resending={resending} onResend={resend} />
            </div>
          )}
        </section>

        <div className="mt-2 flex shrink-0 justify-center pb-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDeleteError(null);
              setConfirmingDelete(true);
            }}
            className="text-error!"
          >
            {D.button}
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={confirmingDelete}
        title={D.title}
        body={regs.length > 0 ? D.bodySome.replace("{n}", String(regs.length)) : D.bodyNone}
        confirmLabel={D.confirm}
        cancelLabel={D.cancel}
        busy={deleting}
        error={deleteError}
        onConfirm={() => void deleteEvent()}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}

type ListProps = {
  rows: AdminRegistration[];
  resending: ReadonlySet<string>;
  onResend: (r: AdminRegistration) => void;
};

function StatusPill({ reg }: { reg: AdminRegistration }) {
  return reg.checkedInAt ? <Pill tone="success">{T.checkedIn}</Pill> : <Pill tone="gold">{T.registered}</Pill>;
}

function EmailAction({ reg, pending, onResend }: { reg: AdminRegistration; pending: boolean; onResend: () => void }) {
  if (reg.emailStatus === "failed") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="danger">{T.emailFailed}</Pill>
        <Button variant="secondary" size="sm" loading={pending} onClick={onResend} aria-label={`Resend ticket to ${reg.fullName}`}>
          {!pending && <MailIcon size={16} strokeWidth={2.8} />}
          {T.resend}
        </Button>
      </div>
    );
  }
  if (reg.emailStatus === "pending") return <Pill tone="neutral">{T.emailSending}</Pill>;
  return null;
}

function RegistrantTable({ rows, resending, onResend }: ListProps) {
  return (
    <div className="ledge hidden overflow-x-auto rounded-[18px] border-2 border-line bg-card md:block">
      <table className="w-full text-left text-sm text-fg">
        <thead>
          <tr className="border-b-2 border-line text-xs font-black uppercase tracking-wide text-heading">
            <th scope="col" className="px-4 py-3">Name</th>
            <th scope="col" className="px-4 py-3">Email</th>
            <th scope="col" className="px-4 py-3">Organization</th>
            <th scope="col" className="px-4 py-3">Contact</th>
            <th scope="col" className="px-4 py-3">Status</th>
            <th scope="col" className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line last:border-b-0">
              <th scope="row" className="px-4 py-3 font-extrabold text-heading">{r.fullName}</th>
              <td className="max-w-[220px] truncate px-4 py-3" title={r.email}>{r.email}</td>
              <td className="px-4 py-3">{r.organization}</td>
              <td className="whitespace-nowrap px-4 py-3 tabular-nums">{r.contactNumber}</td>
              <td className="px-4 py-3"><StatusPill reg={r} /></td>
              <td className="px-4 py-3">
                <EmailAction reg={r} pending={resending.has(r.id)} onResend={() => onResend(r)} />
                {r.emailStatus === "sent" && <span className="text-fg opacity-60" aria-label="No action needed">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RegistrantCards({ rows, resending, onResend }: ListProps) {
  return (
    <ul className="flex flex-col gap-3 md:hidden">
      {rows.map((r) => (
        <li key={r.id}>
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="break-words font-black text-heading">{r.fullName}</p>
                <p className="break-words text-sm font-semibold text-fg">{r.organization}</p>
              </div>
              <StatusPill reg={r} />
            </div>
            <p className="mt-2 break-all text-sm text-fg">{r.email}</p>
            <p className="text-sm tabular-nums text-fg">{r.contactNumber}</p>
            {r.emailStatus !== "sent" && (
              <div className="mt-3">
                <EmailAction reg={r} pending={resending.has(r.id)} onResend={() => onResend(r)} />
              </div>
            )}
          </Card>
        </li>
      ))}
    </ul>
  );
}
