import { useState } from "react";
import { Reggie } from "@/components/reggie/Reggie";
import { ReggieBubble } from "@/components/reggie/ReggieBubble";
import { MOODS, type Mood } from "@/components/reggie/moods";
import { useReggieMood } from "@/components/reggie/useReggieMood";
import { Button, Card, Field, PageHeader, Pill } from "@/components/ui";
import { copy } from "@/lib/copy";
import { DateTimeField, todayKey } from "@/components/DateTimeField";

/** /dev/reggie: preview every mood, the full-body ball tap, and the form-driven mood hook. */
export default function DevReggie() {
  const [mood, setMood] = useState<Mood>("idle");
  const [size, setSize] = useState(220);

  return (
    <div className="space-y-8">
      <PageHeader title="Reggie preview" back="/" />

      <DateTimeDemo />

      <Card className="flex flex-col items-center gap-4">
        <Reggie mood={mood} size={size} />
        <ReggieBubble>
          mood: <strong className="text-link">{mood}</strong> · size {size}px
          {size >= 120 && mood === "idle" ? " · tap the ball!" : ""}
        </ReggieBubble>
        <div className="flex flex-wrap justify-center gap-2">
          {MOODS.map((m) => (
            <Button key={m} size="sm" variant={m === mood ? "primary" : "ghost"} onClick={() => setMood(m)}>
              {m}
            </Button>
          ))}
        </div>
        <label className="flex w-full max-w-xs flex-col gap-1 text-sm font-black uppercase text-heading">
          Size: {size}px
          <input type="range" min={48} max={320} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        </label>
      </Card>

      <section>
        <h2 className="mb-3 text-xl">All moods (portrait, 120px)</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {MOODS.map((m) => (
            <Card key={m} className="flex flex-col items-center gap-2">
              <Reggie mood={m} size={120} showBall={false} />
              <Pill tone={m === "error" ? "danger" : m === "success" ? "success" : "neutral"}>{m}</Pill>
            </Card>
          ))}
        </div>
      </section>

      <MoodHookDemo />

      <section>
        <h2 className="mb-3 text-xl">Sprites</h2>
        <div className="flex flex-wrap gap-3">
          {["hero-idle", "front", "three-quarter", "back", "tap1", "tap2", "tap3", "tap4"].map((s) => (
            <figure key={s} className="flex flex-col items-center gap-1 rounded-[16px] border-2 border-line bg-card p-2">
              <img src={`/reggie/${s}.png`} alt={s} className="h-28 w-auto" />
              <figcaption className="text-xs font-black text-fg/70">{s}</figcaption>
            </figure>
          ))}
        </div>
      </section>
    </div>
  );
}

function MoodHookDemo() {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | undefined>();
  const mood = useReggieMood({ isFocused: focused, hasFieldError: !!error, isSubmitting: submitting, serverError, errorKey: error });

  return (
    <Card className="space-y-4">
      <h2 className="text-xl">useReggieMood</h2>
      <div className="flex items-center gap-3">
        <Reggie mood={mood} size={96} showBall={false} />
        <ReggieBubble tail="left">{mood}</ReggieBubble>
      </div>
      <Field
        label={copy.register.labels.email}
        name="demo-email"
        value={value}
        error={error}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setError(value.includes("@") || !value ? undefined : copy.errors.email_format);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() => {
            setSubmitting(true);
            setTimeout(() => setSubmitting(false), 1500);
          }}
        >
          Submit 1.5s
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setServerError("duplicate_registration")}>
          duplicate
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setServerError("event_full")}>
          event_full
        </Button>
        <Button size="sm" variant="danger" onClick={() => setServerError("internal")}>
          internal
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setServerError(undefined)}>
          clear
        </Button>
      </div>
    </Card>
  );
}

function DateTimeDemo() {
  const [value, setValue] = useState("");
  return (
    <Card className="space-y-2">
      <h2 className="text-xl">DateTimeField</h2>
      <DateTimeField label="Date and Time" name="dev-dt" value={value} onChange={setValue} minDate={todayKey()} />
      <p className="text-xs font-bold text-fg/60">value: {value || "(empty)"}</p>
    </Card>
  );
}
