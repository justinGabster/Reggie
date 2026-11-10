import { useState, type ChangeEvent, type FormEvent } from "react";
import type { AdminEvent } from "@shared/api-types";
import { eventInput, fieldErrors } from "@shared/schemas";
import { Button, Card, Field } from "@/components/ui";
import { DateTimeField } from "@/components/DateTimeField";
import { api, ApiError } from "@/lib/api";
import { copy, errorCopy } from "@/lib/copy";
import { localInputToIso } from "./format";

const L = copy.admin.labels;

type Values = { title: string; description: string; dateTime: string; venue: string; capacity: string };
type Key = keyof Values;

/** ISO string -> `datetime-local` value in the browser's own time zone. */
function isoToLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Props = {
  event: AdminEvent;
  onSaved: (event: AdminEvent) => void;
  onCancel: () => void;
};

/** Inline editor for an event's details (PATCH /api/admin/events/:id). */
export default function EventEditForm({ event, onSaved, onCancel }: Props) {
  const [values, setValues] = useState<Values>({
    title: event.title,
    description: event.description,
    dateTime: isoToLocalInput(event.dateTime),
    venue: event.venue,
    capacity: String(event.capacity),
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const onChange = (key: Key) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setField(key, e.target.value);

  const setField = (key: Key, value: string) => {
    setValues((v) => ({ ...v, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
    const parsed = eventInput.safeParse({ ...values, dateTime: localInputToIso(values.dateTime) });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSaving(true);
    try {
      const { event: updated } = await api.admin.updateEvent(event.id, parsed.data);
      onSaved(updated);
    } catch (err) {
      if (err instanceof ApiError && err.fields && Object.keys(err.fields).length > 0) setErrors(err.fields);
      else setFormError(errorCopy(err instanceof ApiError ? err.code : "internal"));
    } finally {
      setSaving(false);
    }
  }

  const field = (key: Key) => ({
    id: `edit-${key}`,
    name: key,
    value: values[key],
    onChange: onChange(key),
    error: errors[key] ? errorCopy(errors[key]) : undefined,
    disabled: saving,
  });

  return (
    <Card>
      <form noValidate onSubmit={onSubmit} className="flex flex-col gap-4" aria-label="Edit event details">
        <h2 className="text-lg font-black text-heading">Edit details</h2>
        <Field label={L.title} maxLength={120} {...field("title")} />
        <Field label={L.description} as="textarea" rows={3} maxLength={2000} {...field("description")} />
        <div className="grid gap-4 sm:grid-cols-2">
          <DateTimeField {...field("dateTime")} label={L.dateTime} onChange={(v) => setField("dateTime", v)} />
          <Field label={L.capacity} type="number" inputMode="numeric" min={1} max={10000} step={1} {...field("capacity")} />
        </div>
        <Field label={L.venue} maxLength={200} {...field("venue")} />
        {formError && (
          <p role="alert" className="rounded-xl border-2 border-error bg-error-fill px-3 py-2 text-sm font-bold text-error">
            {formError}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm" loading={saving}>
            SAVE CHANGES
          </Button>
        </div>
      </form>
    </Card>
  );
}
