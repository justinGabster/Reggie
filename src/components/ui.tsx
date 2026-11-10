import {
  useEffect,
  useId,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import { Link } from "react-router-dom";
import { useAnimate } from "framer-motion";
import { Reggie } from "@/components/reggie/Reggie";
import { ReggieBubble } from "@/components/reggie/ReggieBubble";
import type { Mood } from "@/components/reggie/moods";
import { ChevronLeftIcon } from "@/components/icons";
import { useShouldReduceMotion } from "@/lib/settings";
import { copy } from "@/lib/copy";
import { useElementHeight } from "@/lib/useFit";

/** Joins class names, skipping falsy values. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Buttons */

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "md" | "sm";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-fg shadow-[0_4px_0_var(--color-primary-ledge)]",
  secondary: "bg-secondary text-secondary-fg shadow-[0_4px_0_var(--color-secondary-ledge)]",
  ghost: "bg-[var(--ghost-bg)] text-ghost-fg border-2 border-ghost-fg shadow-[0_4px_0_var(--color-ghost-fg)]",
  danger: "bg-danger text-white shadow-[0_4px_0_var(--color-danger-ledge)]",
};

const SIZE: Record<ButtonSize, string> = {
  md: "min-h-[50px] short:min-h-[46px] px-6 text-base rounded-[18px]",
  sm: "min-h-[38px] px-4 text-sm rounded-[14px]",
};

/** Shared chunky-button classes (also used by LinkButton and by any custom clickable). */
export function buttonClasses(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  full = false,
  className?: string,
): string {
  return cx(
    "inline-flex select-none items-center justify-center gap-2 font-black uppercase tracking-wide",
    "transition-[transform,box-shadow,opacity] duration-75 no-underline",
    "active:translate-y-1 active:shadow-none",
    "disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:active:translate-y-0",
    "aria-disabled:cursor-not-allowed aria-disabled:opacity-40 aria-disabled:shadow-none",
    VARIANT[variant],
    SIZE[size],
    full && "w-full",
    className,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  full?: boolean;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  full = false,
  className,
  disabled,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClasses(variant, size, full, className)}
      {...rest}
    >
      {loading && <Spinner size={size === "sm" ? 16 : 20} />}
      {children}
    </button>
  );
}

export type LinkButtonProps = {
  to: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  children: ReactNode;
  className?: string;
};

export function LinkButton({ to, variant = "primary", size = "md", full = false, children, className }: LinkButtonProps) {
  return (
    <Link to={to} className={buttonClasses(variant, size, full, className)}>
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ Card */

export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-[20px] border-2 border-line bg-card p-4 ledge", className)} {...rest} />;
}

/* ------------------------------------------------------------------ Field */

export type FieldProps = {
  label: string;
  name: string;
  /** Already-translated message (e.g. errorCopy(code)). */
  error?: string;
  hint?: string;
  as?: "input" | "textarea";
} & InputHTMLAttributes<HTMLInputElement> &
  TextareaHTMLAttributes<HTMLTextAreaElement>;

export function Field({ label, name, error, hint, as = "input", id, className, ...rest }: FieldProps) {
  const autoId = useId();
  const fieldId = id ?? `field-${name}-${autoId.replace(/:/g, "")}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const reduce = useShouldReduceMotion();
  const [scope, animate] = useAnimate<HTMLDivElement>();

  useEffect(() => {
    if (error && !reduce && scope.current) {
      void animate(scope.current, { x: [0, -6, 6, -4, 4, 0] }, { duration: 0.35 });
    }
  }, [error, reduce, animate, scope]);

  const inputClass = cx(
    "w-full rounded-[14px] border-2 bg-card px-4 text-base font-bold text-fg",
    "placeholder:font-semibold placeholder:text-fg/45",
    "transition-[border-color,box-shadow,background-color] duration-150",
    "focus:outline-none focus-visible:outline-none focus:border-focus focus:shadow-[0_0_0_4px_var(--focus-glow)]",
    "disabled:opacity-50",
    error ? "border-error bg-error-fill" : "border-line",
    as === "textarea" ? "min-h-[120px] short:min-h-[88px] py-3 short:py-2 leading-snug" : "h-[50px] short:h-11",
  );

  const shared = {
    id: fieldId,
    name,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined,
    className: inputClass,
  };

  return (
    <div className={cx("flex flex-col gap-1.5 short:gap-1", className)}>
      <label htmlFor={fieldId} className="text-sm font-black uppercase tracking-wide text-heading short:text-xs">
        {label}
      </label>
      <div ref={scope}>
        {as === "textarea" ? <textarea {...rest} {...shared} /> : <input {...rest} {...shared} />}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm font-extrabold leading-snug text-error short:text-xs">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-sm font-semibold leading-snug text-fg/70 short:text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ Pill */

export type PillTone = "maroon" | "gold" | "success" | "danger" | "neutral";

const PILL: Record<PillTone, string> = {
  maroon: "bg-maroon text-white",
  gold: "bg-gold text-maroon",
  success: "bg-success-fill text-success border-2 border-success",
  danger: "bg-danger text-white",
  neutral: "bg-fg/10 text-fg",
};

export function Pill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-black uppercase tracking-wide",
        PILL[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ Toggle */

export type ToggleProps = {
  checked: boolean;
  /** Gets the new value and the click event (its currentTarget is the switch, e.g. for the dark-mode wipe origin). */
  onChange: (v: boolean, event: MouseEvent<HTMLButtonElement>) => void;
  label: string;
  disabled?: boolean;
  /** Optional helper line under the label. */
  hint?: string;
  className?: string;
};

export function Toggle({ checked, onChange, label, disabled, hint, className }: ToggleProps) {
  const id = useId();
  return (
    <div className={cx("flex items-center justify-between gap-4 py-2", className)}>
      <div className="min-w-0">
        <label htmlFor={id} className="block cursor-pointer font-extrabold text-fg">
          {label}
        </label>
        {hint && <p className="text-sm font-semibold leading-snug text-fg/70">{hint}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={(e) => onChange(!checked, e)}
        className={cx(
          "relative inline-flex h-[30px] w-[54px] shrink-0 items-center rounded-full border-2 transition-colors duration-150",
          "disabled:cursor-not-allowed disabled:opacity-40",
          checked ? "border-primary-ledge bg-primary" : "border-fg/25 bg-fg/15",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "absolute top-1/2 h-[22px] w-[22px] -translate-y-1/2 rounded-full shadow-[0_2px_0_rgb(0_0_0/0.2)] transition-[left] duration-150",
            checked ? "left-[26px] bg-primary-fg" : "left-[2px] bg-white",
          )}
        />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ PageHeader */

export function PageHeader({ title, back, right }: { title: string; back?: string; right?: ReactNode }) {
  return (
    <div className="mb-4 flex shrink-0 items-center gap-2 short:mb-2">
      {back && (
        <Link
          to={back}
          aria-label={copy.app.back}
          className="-ml-1 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-heading transition-colors hover:bg-fg/10 short:h-10 short:w-10"
        >
          <ChevronLeftIcon size={28} strokeWidth={3} />
        </Link>
      )}
      <h1 className="min-w-0 flex-1 truncate text-2xl leading-tight short:text-xl sm:text-3xl">{title}</h1>
      {right && <div className="shrink-0">{right}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ Feedback */

export function Spinner({ size = 24, className, label }: { size?: number; className?: string; label?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={cx("animate-spin", className)}
      role={label ? "status" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}

export function ProgressBar({ value, max, className, label }: { value: number; max: number; className?: string; label?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cx("h-2.5 w-full overflow-hidden rounded-full bg-fg/10", className)}
    >
      <div className="h-full rounded-full bg-progress transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * Reggie sized to the space he's given: the wrapper is a shrinkable slot (`max` px tall, flex-shrink 1,
 * never below `min`) inside a flex column, and Reggie's height follows the slot's measured height.
 * On short screens he shrinks instead of pushing the content below him off-screen; with room to spare
 * he stays at `max` so the surrounding group can center. Parents need `min-h-0` to let him shrink.
 * `children` render on top of him (e.g. a "tap me" hint).
 */
export function FitReggie({
  mood,
  min = 80,
  max = 160,
  showBall,
  className,
  children,
}: {
  mood: Mood;
  min?: number;
  max?: number;
  showBall?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const measured = useElementHeight(ref);
  const size = Math.max(min, Math.min(max, measured ?? max));
  return (
    <div
      ref={ref}
      className={cx("flex w-full shrink items-end justify-center", className)}
      style={{ height: max, minHeight: min }}
    >
      <div className="relative">
        <Reggie mood={mood} size={size} showBall={showBall} />
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ mood, title, children }: { mood: Mood; title: string; children?: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 py-4 text-center short:gap-3 short:py-2">
      <FitReggie mood={mood} min={88} max={150} />
      <ReggieBubble className="max-w-sm shrink-0">
        <p className="text-lg font-black text-heading">{title}</p>
      </ReggieBubble>
      {children && <div className="flex max-w-sm shrink-0 flex-col items-center gap-3 text-fg/80">{children}</div>}
    </div>
  );
}
