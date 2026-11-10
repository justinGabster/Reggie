import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { fieldErrors, registrationInput } from "@shared/schemas";
import type { PublicEvent } from "@shared/api-types";
import { Reggie } from "@/components/reggie/Reggie";
import { ReggieBubble } from "@/components/reggie/ReggieBubble";
import { useReggieMood } from "@/components/reggie/useReggieMood";
import { CalendarIcon, PinIcon } from "@/components/icons";
import { TURNSTILE_SITE_KEY, Turnstile } from "@/components/Turnstile";
import { Button, Card, EmptyState, Field, LinkButton, PageHeader, Pill } from "@/components/ui";
import { useFitSize } from "@/lib/useFit";
import { ApiError, api } from "@/lib/api";
import { copy, errorCopy, fill } from "@/lib/copy";
import { formatDateTime } from "@/lib/format";
import { playSound } from "@/lib/sound";

type FieldName = "fullName" | "email" | "organization" | "contactNumber";
const FIELDS: FieldName[] = ["fullName", "email", "organization", "contactNumber"];
type Values = Record<FieldName, string>;
type Errors = Partial<Record<FieldName, string>>; // field -> error CODE

const EMPTY: Values = { fullName: "", email: "", organization: "", contactNumber: "" };

type Load = { status: "loading" } | { status: "error"; code: string } | { status: "ready"; event: PublicEvent };

/** Validates with the shared Zod schema and returns { field: code } for the given fields. */
function validate(values: Values, only?: FieldName[]): Errors {
  const result = registrationInput.safeParse(values);
  if (result.success) return {};
  const all = fieldErrors(result.error) as Errors;
  if (!only) return all;
  const out: Errors = {};
  for (const f of only) if (all[f]) out[f] = all[f];
  return out;
}

export default function Register() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const [load, setLoad] = useState<Load>({ status: "loading" });
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const [attempt, setAttempt] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const reggieSize = useFitSize(0.1, 56, 104);

  useEffect(() => {
    let active = true;
    setLoad({ status: "loading" });
    api
      .event(eventId)
      .then(({ event }) => active && setLoad({ status: "ready", event }))
      .catch((err: unknown) => active && setLoad({ status: "error", code: err instanceof ApiError ? err.code : "internal" }));
    return () => {
      active = false;
    };
  }, [eventId, attempt]);

  const errorCodes = FIELDS.map((f) => errors[f]).filter(Boolean) as string[];
  const mood = useReggieMood({
    isFocused: focused,
    hasFieldError: errorCodes.length > 0,
    isSubmitting: submitting,
    serverError,
    errorKey: errorCodes.join(","),
  });

  if (load.status === "loading") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={copy.register.title} back="/events" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 pb-10">
          <Reggie mood="loading" size={110} />
          <ReggieBubble>{copy.app.loading}</ReggieBubble>
        </div>
      </div>
    );
  }

  if (load.status === "error") {
    const notFound = load.code === "not_found";
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <PageHeader title={copy.register.title} back="/events" />
        <EmptyState mood="confused" title={notFound ? copy.register.notFound : errorCopy(load.code)}>
          {notFound && <p>{copy.register.notFoundSub}</p>}
          {!notFound && <Button onClick={() => setAttempt((n) => n + 1)}>{copy.app.retry}</Button>}
          <LinkButton to="/events" variant="ghost">
            {copy.register.backToEvents}
          </LinkButton>
        </EmptyState>
      </div>
    );
  }

  const event = load.event;
  const isFull = event.spotsLeft <= 0 || serverError === "event_full";

  const firstErrorCode = errorCodes[0];
  let bubble: string;
  let bubbleHint: string | undefined;
  if (submitting) bubble = copy.register.bubble.loading;
  else if (serverError === "duplicate_registration") {
    bubble = copy.register.bubble.duplicate;
    bubbleHint = copy.register.bubble.duplicateHint;
  } else if (serverError === "event_full" || isFull) {
    bubble = copy.register.bubble.full;
    bubbleHint = copy.register.bubble.fullHint;
  } else if (serverError) bubble = errorCopy(serverError);
  else if (mood === "error" && firstErrorCode) bubble = errorCopy(firstErrorCode);
  else if (mood === "typing") bubble = copy.register.bubble.typing;
  else bubble = copy.register.bubble.idle;

  const setValue = (name: FieldName, value: string) => {
    setValues((v) => ({ ...v, [name]: value }));
    if (serverError) setServerError(undefined);
    // Clear a field's error as soon as it becomes valid.
    if (errors[name]) {
      const next = validate({ ...values, [name]: value }, [name]);
      if (!next[name]) setErrors((e) => ({ ...e, [name]: undefined }));
    }
  };

  const onBlur = (name: FieldName) => {
    setFocused(false);
    if (!values[name].trim()) return; // don't scold an untouched empty field on blur
    const next = validate(values, [name]);
    setErrors((e) => ({ ...e, [name]: next[name] }));
  };

  const focusFirstError = (errs: Errors) => {
    const first = FIELDS.find((f) => errs[f]);
    if (first) formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setServerError(undefined);
    const parsed = registrationInput.safeParse(values);
    if (!parsed.success) {
      const errs = fieldErrors(parsed.error) as Errors;
      setErrors(errs);
      playSound("error");
      focusFirstError(errs);
      return;
    }
    setErrors({});
    // Captcha is on (site key set) but the check hasn't finished yet: ask them to wait a moment.
    if (TURNSTILE_SITE_KEY && !captchaToken) {
      setServerError("captcha_required");
      playSound("error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api.register(event.id, {
        ...parsed.data,
        ...(captchaToken ? { turnstileToken: captchaToken } : {}),
      });
      playSound("success");
      navigate(`/ticket/${encodeURIComponent(res.token)}?new=1`);
    } catch (err) {
      setSubmitting(false);
      playSound("error");
      // Turnstile tokens are single-use: always ask for a fresh one after a failed attempt.
      setCaptchaToken(null);
      setCaptchaReset((k) => k + 1);
      if (err instanceof ApiError) {
        const captchaCode = err.fields?.turnstileToken;
        if (captchaCode) {
          setServerError(captchaCode);
        } else if (err.code === "validation_error" && err.fields) {
          const errs: Errors = {};
          for (const f of FIELDS) if (err.fields[f]) errs[f] = err.fields[f];
          setErrors(errs);
          focusFirstError(errs);
          if (Object.keys(errs).length === 0) setServerError(err.code);
        } else {
          setServerError(err.code);
        }
      } else {
        setServerError("internal");
      }
    }
  };

  const fieldProps = (name: FieldName) => ({
    name,
    label: copy.register.labels[name],
    placeholder: copy.register.placeholders[name],
    value: values[name],
    error: errors[name] ? errorCopy(errors[name]) : undefined,
    disabled: submitting,
    onChange: (e: { target: { value: string } }) => setValue(name, e.target.value),
    onFocus: () => setFocused(true),
    onBlur: () => onBlur(name),
  });

  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col pb-8 short:pb-5">
      <PageHeader title={copy.register.title} back="/events" />

      <div className="mb-4 flex shrink-0 items-center gap-3 short:mb-2">
        <Reggie mood={mood} size={reggieSize} showBall={false} />
        <ReggieBubble tail="left" className="flex-1 short:px-3 short:py-2 short:text-sm">
          <p>{bubble}</p>
          {bubbleHint && <p className="mt-1 text-sm font-semibold text-fg/75 short:mt-0 short:text-xs">{bubbleHint}</p>}
        </ReggieBubble>
      </div>

      <Card className="group mb-5 shrink-0 overflow-hidden p-0! short:mb-2">
        <div className="h-2.5 bg-maroon short:h-1.5" aria-hidden="true" />
        <div className="p-4 short:px-3 short:py-2">
          <div className="flex items-start justify-between gap-2">
            <h2 className="min-w-0 text-xl leading-snug short:truncate short:text-base">{event.title}</h2>
            {isFull ? (
              <Pill tone="danger">{copy.events.full}</Pill>
            ) : (
              <span className="mt-1 shrink-0 whitespace-nowrap text-xs font-extrabold uppercase tracking-wide text-fg/70">
                {event.spotsLeft === 1 ? copy.events.oneSpotLeft : fill(copy.events.spotsLeft, { n: event.spotsLeft })}
              </span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-sm font-bold text-fg/80 short:mt-0.5">
            <p className="flex min-w-0 items-center gap-1.5">
              <CalendarIcon size={16} className="shrink-0" />
              <time dateTime={event.dateTime}>{formatDateTime(event.dateTime)}</time>
            </p>
            <p className="flex min-w-0 items-center gap-1.5 font-semibold">
              <PinIcon size={16} className="shrink-0" />
              <span className="truncate">{event.venue}</span>
            </p>
          </div>
        </div>
      </Card>

      {isFull ? (
        <div className="flex justify-center">
          <LinkButton to="/events" variant="ghost">
            {copy.register.backToEvents}
          </LinkButton>
        </div>
      ) : (
        <form
          ref={formRef}
          noValidate
          onSubmit={onSubmit}
          className="flex flex-col gap-4 short:gap-2"
          aria-busy={submitting}
        >
          <Field {...fieldProps("fullName")} autoComplete="name" autoCapitalize="words" />
          <Field
            {...fieldProps("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
          <Field {...fieldProps("organization")} autoComplete="organization" />
          <Field
            {...fieldProps("contactNumber")}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            hint={copy.register.hints.contactNumber}
          />
          <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} className="shrink-0" />
          <Button type="submit" full loading={submitting} className="mt-2 shrink-0 short:mt-1 xshort:mt-0">
            {submitting ? copy.register.submitting : copy.register.submit}
          </Button>
          {serverError === "duplicate_registration" && (
            <LinkButton to="/events" variant="ghost" full>
              {copy.register.backToEvents}
            </LinkButton>
          )}
        </form>
      )}
    </div>
  );
}
