import { z } from "zod";

/**
 * Validation shared by the registration form and the Worker API.
 * Messages are CODES, not text. The frontend maps each code to Taglish copy in src/lib/copy.ts.
 */

// Accepts 09XXXXXXXXX, +639XXXXXXXXX or 639XXXXXXXXX, with spaces/dashes. Normalizes to +639XXXXXXXXX.
export const phMobile = z
  .string()
  .trim()
  .min(1, "contact_required")
  .transform((s) => s.replace(/[\s-]/g, ""))
  .refine((s) => /^(\+?63|0)9\d{9}$/.test(s), { message: "contact_format" })
  .transform((s) => "+63" + s.slice(-10));

export const registrationInput = z.object({
  fullName: z.string().trim().min(2, "name_short").max(100, "name_long"),
  email: z.string().trim().toLowerCase().min(1, "email_required").email("email_format").max(254, "email_format"),
  organization: z.string().trim().min(1, "org_required").max(120, "org_long"),
  contactNumber: phMobile,
  turnstileToken: z.string().optional(),
});

export const eventInput = z.object({
  title: z.string().trim().min(3, "title_short").max(120, "title_long"),
  description: z.string().trim().max(2000, "description_long").default(""),
  dateTime: z.iso.datetime({ offset: true, message: "date_invalid" }),
  venue: z.string().trim().min(2, "venue_short").max(200, "venue_long"),
  capacity: z.coerce.number({ error: "capacity_invalid" }).int("capacity_invalid").min(1, "capacity_invalid").max(10000, "capacity_invalid"),
});

export const eventPatch = eventInput.partial().extend({
  status: z.enum(["draft", "published"]).optional(),
});

export const checkinInput = z.object({
  token: z.string().trim().regex(/^[A-Za-z0-9_-]{22,64}$/, "token_invalid"),
});

export type RegistrationInput = z.input<typeof registrationInput>;
export type RegistrationData = z.output<typeof registrationInput>;
export type EventInput = z.input<typeof eventInput>;
export type EventData = z.output<typeof eventInput>;
export type EventPatch = z.output<typeof eventPatch>;

/** Every field-level code the schemas can produce (copy.ts must cover all of them). */
export const FIELD_CODES = [
  "name_short", "name_long", "email_required", "email_format", "org_required", "org_long",
  "contact_required", "contact_format", "title_short", "title_long", "description_long",
  "date_invalid", "venue_short", "venue_long", "capacity_invalid", "token_invalid",
] as const;
export type FieldCode = (typeof FIELD_CODES)[number];

/** Turns a Zod error into { fieldName: code }, keeping the first code per field. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = (FIELD_CODES as readonly string[]).includes(issue.message) ? issue.message : "invalid";
  }
  return out;
}
