import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { eventInput, fieldErrors } from "@shared/schemas";
import { Button, Card, Field, PageHeader } from "@/components/ui";
import { DateTimeField, todayKey } from "@/components/DateTimeField";
import Reggie from "@/components/reggie/Reggie";
import ReggieBubble from "@/components/reggie/ReggieBubble";
import type { Mood } from "@/components/reggie/moods";
import { api, ApiError } from "@/lib/api";
import { copy, errorCopy } from "@/lib/copy";
import { localInputToIso } from "@/components/admin/format";
import { useFitSize } from "@/lib/useFit";

const L = copy.admin.labels;
const T = {
  title: copy.admin.newEvent,
  bubble: copy.admin.newEventBubble,
  bubbleError: copy.register.bubble.error,
  bubbleSaving: copy.app.loading,
  bubbleSaved: copy.admin.saved,
  save: copy.admin.saveDraft.toUpperCase(),
  saving: copy.admin.saving.toUpperCase(),
  // Not in copy.ts yet.
  helper: "Pwede mo pang i-edit bago i-publish.",
};

type Values = { title: string; description: string; dateTime: string; venue: string; capacity: string };
type Key = keyof Values;

const EMPTY: Values = { title: "", description: "", dateTime: "", venue: "", capacity: "" };

function toInput(v: Values) {
  return {
    title: v.title,
    description: v.description,
    dateTime: localInputToIso(v.dateTime),
    venue: v.venue,
    capacity: v.capacity.trim() === "" ? "" : v.capacity,
  };
}

function validate(v: Values): Record<string, string> {
  const r = eventInput.safeParse(toInput(v));
  return r.success ? {} : fieldErrors(r.error);
}

export default function EventNew() {
  const navigate = useNavigate();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Partial<Record<Key, boolean>>>({});
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [errorFlash, setErrorFlash] = useState(false);
  const flashTimer = useRef<number | undefined>(undefined);
  const reggieSize = useFitSize(0.1, 56, 110);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  function flashError() {
    setErrorFlash(true);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setErrorFlash(false), 2500);
  }

  const onChange = (key: Key) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(key, e.target.value);

  const setField = (key: Key, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    if (touched[key]) {
      const all = validate(next);
      setErrors((prev) => {
        const copy = { ...prev };
        if (all[key]) copy[key] = all[key];
        else delete copy[key];
        return copy;
      });
    }
  };

  const onBlur = (key: Key) => () => {
    setFocused(false);
    setTouched((t) => ({ ...t, [key]: true }));
    const all = validate(values);
    setErrors((prev) => {
      const copy = { ...prev };
      if (all[key]) {
        copy[key] = all[key];
        flashError();
      } else delete copy[key];
      return copy;
    });
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setFormError(null);
    setTouched({ title: true, description: true, dateTime: true, venue: true, capacity: true });
    const parsed = eventInput.safeParse(toInput(values));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      flashError();
      const first = parsed.error.issues[0]?.path[0];
      if (typeof first === "string") document.getElementById(`event-${first}`)?.focus();
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      const { event } = await api.admin.createEvent(parsed.data);
      setSaved(true);
      window.setTimeout(() => navigate(`/admin/events/${event.id}`, { replace: true }), 700);
    } catch (err) {
      setSubmitting(false);
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) {
        setErrors(err.fields);
      } else {
        setFormError(errorCopy(err instanceof ApiError ? err.code : "internal"));
      }
      flashError();
    }
  }

  const hasErrors = Object.keys(errors).length > 0 || formError !== null;
  const mood: Mood = saved
    ? "success"
    : submitting
      ? "loading"
      : errorFlash && hasErrors
        ? "error"
        : focused
          ? "typing"
          : "idle";
  const bubble = saved ? T.bubbleSaved : submitting ? T.bubbleSaving : hasErrors ? T.bubbleError : T.bubble;

  const err = (key: Key) => (errors[key] ? errorCopy(errors[key]) : undefined);
  const common = (key: Key) => ({
    id: `event-${key}`,
    name: key,
    value: values[key],
    onChange: onChange(key),
    onBlur: onBlur(key),
    onFocus: () => setFocused(true),
    error: err(key),
    disabled: submitting || saved,
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <PageHeader title={T.title} back="/admin" />
      <div className="mx-auto flex min-h-0 w-full max-w-xl flex-1 flex-col">
        <div className="mb-3 flex shrink-0 items-center gap-3 short:mb-2">
          <Reggie mood={mood} size={reggieSize} showBall={false} className="shrink-0" />
          <ReggieBubble tail="left" className="flex-1 short:px-3 short:py-2 sm:flex-none">
            {bubble}
          </ReggieBubble>
        </div>

        {/* On short screens the fields scroll inside the card; the SAVE footer always stays visible. */}
        <Card className="flex min-h-0 flex-col p-0!">
          <form noValidate onSubmit={onSubmit} className="flex min-h-0 flex-col">
            <div className="scroll-fade flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pb-6 pt-4 short:gap-3 short:pt-3">
              <Field label={L.title} autoComplete="off" maxLength={120} {...common("title")} />
              <Field label={L.description} as="textarea" rows={3} maxLength={2000} {...common("description")} />
              <DateTimeField
                {...common("dateTime")}
                label={L.dateTime}
                onChange={(v) => setField("dateTime", v)}
                minDate={todayKey()}
              />
              <Field label={L.venue} autoComplete="off" maxLength={200} {...common("venue")} />
              <Field label={L.capacity} type="number" inputMode="numeric" min={1} max={10000} step={1} {...common("capacity")} />

              {formError && (
                <p role="alert" className="rounded-xl border-2 border-error bg-error-fill px-3 py-2 text-sm font-bold text-error">
                  {formError}
                </p>
              )}
            </div>

            <div className="flex shrink-0 flex-col gap-1.5 rounded-b-[18px] border-t-2 border-line/40 bg-card px-4 pb-4 pt-3 short:pb-3 short:pt-2">
              <Button type="submit" variant="primary" full loading={submitting || saved}>
                {submitting || saved ? T.saving : T.save}
              </Button>
              <p className="text-center text-sm text-fg short:text-xs">{T.helper}</p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
