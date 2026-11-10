# Reggie: Implementation Plan

> Built from `reggie-project-brief.md`. The brief is the source of truth for scope and decisions; this document turns it into concrete files, contracts, and tasks.
> Items marked **(verify)** depend on third-party behavior that changes over time. Check the current docs before relying on them.

---

## 0. Guiding Principles

1. **Prove the risky parts first.** Run the QR-on-Workers test (section 9) and deploy it on day one, before building features.
2. **One deployment.** A single Cloudflare Worker serves the built React app as static assets and the Hono API under `/api/*`. Because they share an origin, there is no CORS setup.
3. **The server is the authority.** The home screen's "Registrant or Organizer" choice is only navigation. All authorization happens in Hono middleware; Supabase RLS is a second layer.
4. **Shared validation.** One set of Zod schemas is used by both the form and the API.
5. **Forgiving UX.** Every error state has a Reggie mood and a friendly Taglish line, never a raw error message.

---

## 1. Project Scaffolding

### 1.1 Prerequisites
- Node.js 20 LTS or later, and npm (or pnpm; pick one for the whole team).
- A Cloudflare account, a Supabase project, a Resend account, and a Testmail.app account.
- Git, with the repo already initialized.

### 1.2 Bootstrap commands
```bash
# 1. Vite + React + TS (in the repo root)
npm create vite@latest . -- --template react-ts

# 2. Worker / API
npm i hono @hono/zod-validator zod @supabase/supabase-js jose
npm i -D wrangler @cloudflare/vite-plugin @cloudflare/workers-types

# 3. Frontend
npm i react-router-dom framer-motion @yudiel/react-qr-scanner
npm i -D tailwindcss @tailwindcss/vite vite-plugin-pwa
npx shadcn@latest init           # then add components as needed

# 4. QR (try the first option; see section 9)
npm i qrcode                      # option A (needs nodejs_compat)
npm i uqr                         # option B (pure JS matrix)

# 5. Testing
npm i -D vitest @cloudflare/vitest-pool-workers @playwright/test
```

### 1.3 `vite.config.ts`
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),               // runs the Worker inside `vite dev`
    VitePWA({ /* see section 8 */ }),
  ],
  resolve: { alias: { "@": "/src", "@shared": "/shared" } },
});
```
The Cloudflare Vite plugin runs the Worker and the SPA together in `npm run dev`, so the dev setup matches production. **(verify the current plugin options)**

### 1.4 `wrangler.jsonc`
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "reggie",
  "main": "worker/index.ts",
  "compatibility_date": "2026-11-01",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "not_found_handling": "single-page-application", // SPA fallback to index.html
    "run_worker_first": ["/api/*"]                   // API is never served as a static asset
  },
  "vars": {
    "APP_URL": "https://reggie.example.app",
    "SUPABASE_URL": "https://<project>.supabase.co",
    "EMAIL_FROM": "Reggie <tickets@mail.example.app>"
  },
  "observability": { "enabled": true }
  // routes / custom_domain added in Phase 4
}
```

### 1.5 `package.json` scripts
```json
{
  "dev": "vite",
  "build": "tsc -b && vite build",
  "preview": "vite preview",
  "deploy": "npm run build && wrangler deploy",
  "test": "vitest",
  "test:e2e": "playwright test",
  "typecheck": "tsc -b --noEmit",
  "db:types": "supabase gen types typescript --project-id <id> > shared/db.types.ts"
}
```

---

## 2. Folder Structure

```
reggie/
  src/                          React app
    main.tsx                    router + providers
    App.tsx                     layout shell (top bar: logo -> Home, settings gear; no tab bar)
    pages/
      Home.tsx                  "Registrant or Organizer?"
      Events.tsx                published events list
      Register.tsx              registration form
      Ticket.tsx                confirmation + QR (SVG)
      admin/
        AdminHome.tsx           login gate + my events + "Add event"
        EventNew.tsx            create event form
        EventDetail.tsx         registrants, stats, publish toggle, resend, CSV
        Scan.tsx                camera scanner
      NotFound.tsx
    components/
      reggie/
        Reggie.tsx              <Reggie mood=... />
        moods.ts                mood -> pose/animation config
        ReggieBall.tsx          tappable basketball that bonks off Reggie
        ReggieBubble.tsx        speech bubble with Taglish copy
        useReggieMood.ts        hook: derive mood from form/scan state
      ui/                       shadcn components
      EventCard.tsx
      FormField.tsx             field wired to Reggie typing/error moods
      StatTiles.tsx
      ScanResultSheet.tsx
      SettingsToggle.tsx        dark mode, sound, reduced motion
    lib/
      api.ts                    typed fetch wrapper (adds Bearer token on admin calls)
      supabase.ts               browser client (anon key, auth only)
      auth.tsx                  AuthProvider + useAuth
      copy.ts                   all Taglish strings in one place
      sound.ts                  optional sound effects
  shared/                       imported by BOTH src/ and worker/
    schemas.ts                  Zod schemas + inferred types
    api-types.ts                response shapes
    db.types.ts                 generated Supabase types
  worker/
    index.ts                    Hono app entry, mounts routes
    env.ts                      Bindings type
    middleware/
      supabase.ts               per-request client -> c.var.db
      requireAdmin.ts           JWT verification -> c.var.userId
      rateLimit.ts              optional
    routes/
      public.ts                 /api/events, /api/tickets
      admin.ts                  /api/admin/*
      qrTest.ts                 /api/qr-test (removed before launch)
    services/
      qr.ts                     token generation, QR SVG + PNG
      png.ts                    tiny PNG encoder (fallback path)
      email.ts                  Resend send + HTML template
      registrations.ts          register/check-in logic
    errors.ts                   typed error codes -> HTTP + JSON
  public/
    icons/                      PWA icons (192, 512, maskable)
    reggie-email.png            static Reggie for emails
  supabase/
    migrations/
      0001_init.sql
      0002_rls.sql
      0003_functions.sql
  tests/
    worker/                     vitest-pool-workers tests
    e2e/                        Playwright specs
    scripts/testmail-check.ts   Task 3 automation
  wrangler.jsonc
  vite.config.ts
  .dev.vars                     local secrets (gitignored)
  .dev.vars.example             committed template
```

`shared/` is used in place of `src/lib` for the Zod schemas so the Worker never imports from the React tree.

---

## 3. Environment Variables and Secrets

| Name | Where | Secret? | Used by |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `.env` (frontend build) | No | Browser auth client |
| `VITE_SUPABASE_ANON_KEY` | `.env` | No (public by design) | Browser auth client |
| `SUPABASE_URL` | `wrangler.jsonc` vars | No | Worker |
| `SUPABASE_SERVICE_ROLE_KEY` | `wrangler secret put` / `.dev.vars` | **Yes** | Worker DB access |
| `RESEND_API_KEY` | `wrangler secret put` / `.dev.vars` | **Yes** | Email |
| `EMAIL_FROM` | vars | No | Email sender |
| `APP_URL` | vars | No | Ticket links in emails |
| `TURNSTILE_SECRET` | secret (optional) | **Yes** | Abuse control |
| `TESTMAIL_API_KEY`, `TESTMAIL_NAMESPACE` | local `.env.test` / CI secret | **Yes** | Test scripts only |

Rules:
- The service-role key **never** carries a `VITE_` prefix, because Vite inlines `VITE_*` variables into the browser bundle.
- `.dev.vars` and `.env*` (except `.env.example`) are gitignored. Commit `.dev.vars.example` with blank values.
- Typed bindings in `worker/env.ts`:
```ts
export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  APP_URL: string;
  TURNSTILE_SECRET?: string;
};
export type Variables = { db: SupabaseClient<Database>; userId: string };
```

---

## 4. Database Schema and Migrations

### 4.1 `0001_init.sql`
```sql
create extension if not exists pgcrypto;

create type event_status as enum ('draft', 'published');
create type email_status as enum ('pending', 'sent', 'failed');

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(title) between 3 and 120),
  description text not null default '',
  date_time   timestamptz not null,
  venue       text not null check (char_length(venue) between 2 and 200),
  capacity    integer not null check (capacity > 0 and capacity <= 10000),
  status      event_status not null default 'draft',
  created_at  timestamptz not null default now()
);
create index events_admin_idx on public.events (admin_id);
create index events_published_idx on public.events (status, date_time);

create table public.registrations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events(id) on delete cascade,
  full_name      text not null check (char_length(full_name) between 2 and 100),
  email          text not null,
  organization   text not null check (char_length(organization) between 1 and 120),
  contact_number text not null,                       -- normalized +639XXXXXXXXX
  qr_token       text not null unique,                -- base64url, 128-bit random
  email_status   email_status not null default 'pending',
  checked_in_at  timestamptz,
  created_at     timestamptz not null default now(),
  constraint registrations_event_email_uq unique (event_id, email)
);
create index registrations_event_idx on public.registrations (event_id);
```
Emails are stored lowercased and trimmed (done in Zod), so the unique constraint is effectively case-insensitive.

### 4.2 `0002_rls.sql` (second layer of defense)
The Worker uses the service-role key, which bypasses RLS. RLS is there so a leaked anon key or a future direct-from-browser query cannot read registrant data.
```sql
alter table public.events        enable row level security;
alter table public.registrations enable row level security;

-- Anyone may read published events (harmless public info).
create policy "public reads published events" on public.events
  for select using (status = 'published');

-- Admins manage only their own events.
create policy "admin reads own events" on public.events
  for select to authenticated using (admin_id = auth.uid());
create policy "admin inserts own events" on public.events
  for insert to authenticated with check (admin_id = auth.uid());
create policy "admin updates own events" on public.events
  for update to authenticated using (admin_id = auth.uid()) with check (admin_id = auth.uid());

-- Registrations: no anon access at all; admins read their events' registrants.
create policy "admin reads own registrants" on public.registrations
  for select to authenticated
  using (exists (select 1 from public.events e
                 where e.id = event_id and e.admin_id = auth.uid()));
```
There are no insert or update policies on `registrations`, so all writes go through the Worker.

### 4.3 `0003_functions.sql` (atomic capacity check)
A plain "count then insert" can overbook when two people submit at once. This function locks the event row:
```sql
create or replace function public.register_for_event(
  p_event_id uuid, p_full_name text, p_email text,
  p_organization text, p_contact_number text, p_qr_token text
) returns public.registrations
language plpgsql security definer set search_path = public as $$
declare
  v_event public.events;
  v_count integer;
  v_row   public.registrations;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or v_event.status <> 'published' then
    raise exception 'EVENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select count(*) into v_count from public.registrations where event_id = p_event_id;
  if v_count >= v_event.capacity then
    raise exception 'EVENT_FULL' using errcode = 'P0001';
  end if;

  insert into public.registrations
    (event_id, full_name, email, organization, contact_number, qr_token)
  values
    (p_event_id, p_full_name, p_email, p_organization, p_contact_number, p_qr_token)
  returning * into v_row;           -- unique_violation (23505) => DUPLICATE
  return v_row;
end $$;

revoke execute on function public.register_for_event from public, anon, authenticated;
```
The Worker maps the errors: `EVENT_NOT_FOUND` to 404, `EVENT_FULL` to 409 `event_full`, and `23505` to 409 `duplicate_registration`.

### 4.4 Applying migrations
Use the Supabase CLI (`supabase link`, then `supabase db push`), or paste the files into the SQL editor in order. Then run `npm run db:types` to generate `shared/db.types.ts`.

### 4.5 Auth setup
- Supabase dashboard → Authentication → Providers → **Google**: create an OAuth client in Google Cloud Console and add the Supabase callback URL.
- Add the redirect URLs `http://localhost:5173/admin` and `https://<domain>/admin`.
- Any Google user can sign in and becomes an "admin" who only ever sees their own events. This matches the brief. If organizers should be restricted later, add an `admins` allowlist table.

---

## 5. Shared Validation (`shared/schemas.ts`)

```ts
import { z } from "zod";

// Accepts 09XXXXXXXXX, +639XXXXXXXXX, 639XXXXXXXXX, with spaces/dashes; normalizes to +639XXXXXXXXX
export const phMobile = z.string().trim()
  .transform((s) => s.replace(/[\s-]/g, ""))
  .refine((s) => /^(\+?63|0)9\d{9}$/.test(s), { message: "contact_format" })
  .transform((s) => "+63" + s.slice(-10));

export const registrationInput = z.object({
  fullName:      z.string().trim().min(2, "name_short").max(100),
  email:         z.string().trim().toLowerCase().email("email_format").max(254),
  organization:  z.string().trim().min(1, "org_required").max(120),
  contactNumber: phMobile,
  turnstileToken: z.string().optional(),
});

export const eventInput = z.object({
  title:       z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).default(""),
  dateTime:    z.string().datetime({ offset: true }),
  venue:       z.string().trim().min(2).max(200),
  capacity:    z.coerce.number().int().min(1).max(10000),
});
export const eventPatch = eventInput.partial().extend({
  status: z.enum(["draft", "published"]).optional(),
});

export const checkinInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{22,64}$/) });

export type RegistrationInput = z.infer<typeof registrationInput>;
export type EventInput = z.infer<typeof eventInput>;
```
Error messages are **codes**, not text. The frontend maps each code to Taglish copy in `src/lib/copy.ts` (for example `email_format` becomes "Oops, kulang pa ang email."). That keeps the server language-neutral and puts Reggie's voice in one file.

---

## 6. API Contracts

### 6.1 Conventions
- Base path `/api`. JSON in and out.
- Error shape (every non-2xx response):
```ts
{ error: { code: ErrorCode; message: string; fields?: Record<string, string> } }
// ErrorCode: validation_error | not_found | duplicate_registration | event_full |
//            unauthorized | forbidden | rate_limited | internal
```
- Validation failures return 400 `validation_error`, with `fields` mapping each field name to an error code.
- Admin routes need `Authorization: Bearer <supabase access token>`.
- Never return `qr_token` from list endpoints. It appears only on the ticket endpoint (where the token is the URL) and in the register response.

### 6.2 Public routes

| Method & path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/events` | none | `200 { events: PublicEvent[] }` (published, upcoming first) | none |
| `GET /api/events/:id` | none | `200 { event: PublicEvent }` | 404 if missing or draft |
| `POST /api/events/:id/registrations` | `RegistrationInput` | `201 { registration: { id, fullName, eventId }, ticketUrl, token }` | 400, 404, 409 `duplicate_registration`, 409 `event_full`, 429 |
| `GET /api/tickets/:token` | none | `200 { ticket: { fullName, organization, checkedInAt, event: PublicEvent }, qrSvg }` | 404 |

```ts
type PublicEvent = {
  id: string; title: string; description: string;
  dateTime: string; venue: string; capacity: number;
  spotsLeft: number;           // capacity - registrations count
};
```

**Registration handler flow:**
1. `zValidator('json', registrationInput)`, plus optional Turnstile verification.
2. `token = base64url(crypto.getRandomValues(new Uint8Array(16)))` (128 bits).
3. `db.rpc('register_for_event', {...})`, mapping errors as described in 4.3.
4. `c.executionCtx.waitUntil(sendTicketEmail(...))`. The email worker updates `email_status` to `sent` or `failed`.
5. Return 201 immediately. The client navigates to `/ticket/:token`.

### 6.3 Admin routes (all behind `requireAdmin`)

| Method & path | Request | Success | Errors |
|---|---|---|---|
| `GET /api/admin/events` | none | `200 { events: AdminEvent[] }` (own only) | 401 |
| `POST /api/admin/events` | `EventInput` | `201 { event: AdminEvent }` (status `draft`) | 400, 401 |
| `PATCH /api/admin/events/:id` | `eventPatch` | `200 { event: AdminEvent }` | 400, 401, 404 |
| `GET /api/admin/events/:id/registrations` | `?format=csv` optional | `200 { registrations: AdminRegistration[], stats }` or CSV | 401, 404 |
| `POST /api/admin/events/:id/checkin` | `{ token }` | `200 { result, registration? }` | 400, 401, 404 |
| `POST /api/admin/registrations/:id/resend` | none | `202 { emailStatus: 'pending' }` | 401, 404 |

```ts
type AdminEvent = PublicEvent & { status: "draft" | "published"; registeredCount: number; checkedInCount: number; createdAt: string };
type AdminRegistration = { id; fullName; email; organization; contactNumber; emailStatus; checkedInAt: string | null; createdAt };
type Stats = { registered: number; checkedIn: number; capacity: number; emailFailed: number };

type CheckinResult =
  | { result: "checked_in";         registration: { fullName; organization; checkedInAt } }
  | { result: "already_checked_in"; registration: { fullName; organization; checkedInAt } }
  | { result: "wrong_event";        registration: { fullName; eventTitle } }
  | { result: "invalid" };
```
Check-in always returns **200** with a `result` field, because these four outcomes are normal scanner states rather than HTTP failures. That keeps the scanner UI simple.

### 6.4 Ownership rule (403 vs 404)
For any `:id` route, load the event with `.eq('id', id).eq('admin_id', userId)`. If no row comes back, return **404** whether the event doesn't exist or belongs to someone else. This doesn't leak that other admins' events exist, and it satisfies the checklist item "API returns 403/404". For `/registrations/:id/resend`, join through `events` to check ownership the same way.

### 6.5 Check-in logic (atomic, never double-counts)
```ts
// 1. find token
const reg = await db.from("registrations")
  .select("id, event_id, full_name, organization, checked_in_at, events(title)")
  .eq("qr_token", token).maybeSingle();
if (!reg) return { result: "invalid" };
if (reg.event_id !== eventId) return { result: "wrong_event", ... };

// 2. conditional update: only succeeds if not yet checked in
const { data: updated } = await db.from("registrations")
  .update({ checked_in_at: new Date().toISOString() })
  .eq("id", reg.id).is("checked_in_at", null)
  .select("checked_in_at").maybeSingle();

return updated
  ? { result: "checked_in", ... }
  : { result: "already_checked_in", checkedInAt: reg.checked_in_at ?? (refetch) };
```
Two simultaneous scans of the same QR cannot both get `checked_in`, because only one conditional update can match.

### 6.6 Middleware
**`supabase.ts`** creates the client for each request (Workers rule), never as a global:
```ts
app.use("/api/*", async (c, next) => {
  c.set("db", createClient<Database>(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }));
  await next();
});
```
**`requireAdmin.ts`** verifies the Supabase JWT:
- Preferred: verify locally with `jose` against the project's JWKS (`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`), checking `iss`, `aud = "authenticated"` and `exp`. Set `userId = payload.sub`.
- Fallback (for legacy symmetric-key projects): call `db.auth.getUser(token)`.
- **(verify)** which signing-key mode the new Supabase project uses.

**Rate limiting (optional):** use Cloudflare's Workers Rate Limiting binding on `POST /api/events/:id/registrations` (for example 10 requests per minute per IP), or a Cloudflare WAF rate-limit rule.

---

## 7. Frontend Component Breakdown

### 7.1 Pages
| Page | Key behavior | Reggie mood(s) |
|---|---|---|
| `Home` | Two large buttons: Registrant to `/events`, Organizer to `/admin` | `idle` ("Woof! Sino ka ngayon?") |
| `Events` | Fetch the published list; cards show date, venue, spots left; full events are greyed out with a "Puno na" badge | `idle`; `confused` when empty ("Wala pang events...") |
| `Register` | Form with four fields, inline validation on blur and submit, disabled submit while pending | `typing` on focus, `error` on invalid field, `loading` on submit, `sad` on `event_full`, `confused` on duplicate ("Naka-register ka na yata!") |
| `Ticket` | Shows the QR as SVG, attendee name, event details, "Check your email" note, "Save as image" button | `success` with confetti on first visit (`?new=1`), `idle` after |
| `AdminHome` | If signed out, show the Google sign-in button. If signed in, show my events plus an "Add event" FAB | `idle` |
| `EventNew` | Event form; saves as draft and redirects to the detail page | `typing` / `error` / `success` |
| `EventDetail` | Stat tiles (registered/capacity, checked in, email failed), publish toggle, searchable registrant table, Resend button per row, CSV download, "Scan QR" button | moods follow actions |
| `Scan` | Full-screen camera with a result sheet that slides up per scan; 2-second cooldown on the same token | `success` / `eyebrow` (already) / `confused` (wrong or invalid) |

### 7.2 Reggie mood system
```ts
type Mood = "idle" | "typing" | "error" | "loading" | "success" | "confused" | "sad" | "eyebrow";
<Reggie mood={mood} size={160} lookAt={fieldIndex} />
```
- **Look:** a chocolate-brown puppy in a PUP maroon-and-gold "27" basketball jersey with an orange basketball, drawn flat with no outlines and two-tone shading. The full spec is in the brief (section 7, "Reggie's look") and `design/chatgpt-frontend-prompts.md`.
- **Art: a live rig built from the final character art (decided Nov 10).** `scripts/build-reggie-rig.py` splits the uncut front view (`design/mockups/sprites/front.png`) into layers in `public/reggie/rig/` (base, left/right ear, tail, ball) and writes their pivots and face coordinates to `src/components/reggie/rigData.ts`. The painted eyes, brows and mouth are erased from the base and redrawn as SVG, so `<Reggie>` can: follow the cursor (or the focused form field) with its pupils on every page, blink, sway and lift its ears, wag its tail, and show each mood as a real expression. Interactions: tap the ball (it flies up, bonks his head, he goes `> <`, dazed, then grins; three quick taps = a happy header) or tap Reggie to make him giggle. Everything runs in one `requestAnimationFrame` loop per Reggie that pauses off-screen, and reduced motion keeps only the eye tracking. Re-run the script if the art changes.
- **`moods.ts`** maps each mood to the variants for each part, for example:
  - `idle`: tail wag loop, slow head tilt
  - `typing`: ears up, pupils shift toward `lookAt`
  - `error`: head tilt 12°, one ear down
  - `loading`: a running bob with a ticket in the mouth
  - `success`: slam-dunk jump with the ball spinning on one paw, tail spin, firing the `Confetti` component
  - `confused`: question mark above the head, tilt
  - `sad`: ears droop, head lowered (used for "Puno na")
  - `eyebrow`: one raised brow (used for "already checked in")
- **`useReggieMood`** derives the mood from state (`isFocused`, `fieldErrors`, `isSubmitting`, `serverError`). Error moods revert to `typing` after 2.5 seconds so Reggie doesn't stay upset.
- **Tap the ball (`ReggieBall`):** the ball is a real `<button aria-label="Bounce the ball off Reggie">` placed beside his feet. Tapping it plays a one-shot reaction that sits *on top of* the current mood, then hands control back:
  1. The ball arcs up (Framer Motion keyframes on `x`/`y`, with a squash on launch).
  2. On contact, Reggie's head squashes and his eyes swap to `> <`, his ears flip up, and 3 impact stars pop out.
  3. The ball rebounds with two smaller ground bounces. Reggie looks dazed (spinning pupils) for about 400ms.
  4. He grins with his tongue out and does a fast tail wag, then returns to whatever mood the page set.
  - Every third tap in quick succession, he heads the ball back instead (a small combo easter egg). Taps during an animation are ignored.
  - Shown only when Reggie is drawn full-body (`size >= 120`); it's hidden in the small "peek" versions so it never crowds a form. Prop: `showBall` (default `true`).
  - Reduced motion: the ball does a small wiggle and Reggie blinks, with no arc. Sound (if enabled): a short "boing".
- **`ReggieBubble`** shows the matching line from `copy.ts`, with `aria-live="polite"` so screen readers hear Reggie.
- **Reduced motion:** `useReducedMotion()` from Framer Motion swaps the animations for static poses.
- **Sound (optional):** short sounds on `success` and `error`, off by default, toggled in Settings and stored in `localStorage`.

### 7.3 Copy (`src/lib/copy.ts`)
All strings live in one object (`copy.home.greeting`, `copy.errors.email_format`, ...), so the team can edit the tone without touching components. It covers every row of the brief's emotion table and every `ErrorCode`.

### 7.4 Theming and palette
Define tokens as CSS variables in Tailwind, with light and dark sets:

Palette: the PUP seal's maroon `#800000`, gold `#FFDF00`, goldenrod `#DAA520` and white, plus a few helper colors. The brief (section 7, "Palette", "Buttons", "Backgrounds") explains the roles.

| Token | Light | Dark | Notes |
|---|---|---|---|
| `--bg` | `#FFFFFF` | `#140404` | **White** page background / near-black maroon |
| `--topbar` / `--topbar-fg` | `#800000` / `#FFFFFF` | `#800000` / `#FFFFFF` | Maroon top bar in both modes; gear icon and the thin line under the bar are gold `#FFDF00` |
| `--card` | `#FFFFFF` | `#2E0B0B` | Cards, inputs, speech bubbles |
| `--line` | `#DAA520` | `#800000` | 2px card and input borders |
| `--ledge` | `#DAA520` | `#800000` | Solid "ledge" shadow under cards (0 4px 0, no blur) |
| `--text` | `#3B0A0A` | `#FFF8E7` | Body text |
| `--heading` | `#800000` | `#FFF8E7` | Headings |
| `--link` | `#800000` | `#FFDF00` | Links and bold key words in Reggie's bubble |
| `--focus` | `#800000` + `#FFDF00` glow | `#FFDF00` | Focused field border (and glow) |
| `--primary` / `--primary-fg` / `--primary-ledge` | `#800000` / `#FFFFFF` / `#5C0000` | `#FFDF00` / `#800000` / `#DAA520` | Primary buttons, FAB, toggles ON. Primary and secondary **swap** in dark mode |
| `--secondary` / `--secondary-fg` / `--secondary-ledge` | `#FFDF00` / `#800000` / `#DAA520` | `#800000` / `#FFFFFF` / `#5C0000` | Secondary buttons, DRAFT and REGISTERED pills |
| `--ghost-fg` | `#800000` | `#FFDF00` | Ghost button border and text (white fill in light, transparent in dark) |
| `--danger` / `--danger-ledge` | `#C62828` / `#8E1B1B` | `#C62828` / `#8E1B1B` | Danger buttons, "Puno na" and "Email failed" pills (white text) |
| `--error` | `#C62828` | `#FF8A80` | Error borders, icons and message text |
| `--error-fill` | `#FDECEC` | `#3A0F14` | Errored input fill |
| `--success` | `#18703F` | `#6EE7A0` | "Checked in" border, icon and text |
| `--success-fill` | `#E3F4EA` | `#0B2E22` | "Checked in" fill |
| `--progress` | `#DAA520` | `#FFDF00` | Progress bar fill |

Scan results: **valid** = success green, **already checked in** = goldenrod `#DAA520`, **wrong event** = maroon `#800000`, **invalid** = red `#C62828`. The scanner frame is gold `#FFDF00`.

Reggie's look is final (the character sheet in `design/`). His SVG colors (fur `#96603F`, shade `#7A4A2E`, ears `#6B4226` / `#55331D`, cream `#F6E7D2`, pupils and brows `#000814`, nose `#2B1A12`, tongue `#F0606E`, jersey `#800000` / `#5C0000` with gold trim and "27", basketball `#F26B1D` with shade `#C9531A` and seams `#3A2418`) are hard-coded in the component and **stay the same in dark mode**. In dark mode `<Reggie>` draws a flat gold circle at 15% opacity behind him (a "court spotlight") so his maroon jersey and brown ears don't sink into the dark background.

Contrast check (WCAG 2.x, computed): white on maroon 11.0:1, maroon on white 11.0:1, body `#3B0A0A` on white 17.0:1, maroon on gold `#FFDF00` 8.2:1, gold on the maroon top bar 8.2:1, red `#C62828` on white 5.6:1 and on `#FDECEC` 4.9:1, green `#18703F` on `#E3F4EA` 5.4:1, cream on `#140404` 18.4:1, cream on `#2E0B0B` 17.0:1, gold on `#2E0B0B` 13.5:1, `#FF8A80` on `#2E0B0B` 7.9:1. Every text pair passes 4.5:1. Never use gold or goldenrod as text on white. Goldenrod borders on white are only 2.2:1, so cards also rely on the solid ledge and spacing to stand out. In dark mode the maroon card border is subtle (1.6:1 against the card), so the cards' lighter fill does most of the work.

Re-check any shade you change with a WCAG checker during Phase 1.

### 7.5 Layout
- **No bottom tab bar.** Each audience follows a straight-line flow (registrant: Events → Register → Ticket; organizer: stays in `/admin`), so tabs would only repeat the Home screen's "Registrant or Organizer" choice and take space from the forms and the scanner.
- **Top bar on every page and screen size:** the Reggie logo and wordmark on the left (links to `/`) and the settings gear on the right.
- **Back arrow on every inner page** (Events, Register, Ticket, EventNew, EventDetail, Scan), placed next to the page title. This is required because an installed PWA on iOS has no browser back button. Each page's back arrow goes to its parent route (for example Register → `/events`, Scan → `/admin/events/:id`), not `history.back()`, so it still works when the page was opened from a direct link.
- The Ticket page also has a "Back to Events" button. Organizers can bookmark `/admin`.
- Phones (< 768px): content is a single column.
- Desktop: content max-width about 960px, registrants shown as a table instead of cards.

### 7.6 Admin auth (frontend)
- `supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: APP_URL + "/admin" } })`.
- `AuthProvider` listens to `onAuthStateChange`. `api.ts` attaches `session.access_token` to admin calls and, on a 401, signs out and redirects to `/admin`.
- `<RequireAuth>` wraps the admin routes in the router. It only affects the UX; the real protection is the server.

---

## 8. QR Pipeline

### 8.1 Token
- 16 random bytes from `crypto.getRandomValues`, base64url-encoded (22 characters), guarded by the DB `unique` constraint.
- The QR encodes **only the token** (not a URL and not the email). The scanner sends it to `/checkin`.
  - Alternative: encode `https://<domain>/ticket/<token>` so that a phone camera opens the ticket page. The scanner would then extract the last path segment. **Decision: token only** (simpler and smaller QR); revisit if attendees want it.

### 8.2 Rendering
| Output | Where | How |
|---|---|---|
| SVG | `GET /api/tickets/:token` (`qrSvg`), ticket page | Option A `qrcode.toString(token, {type:"svg"})`; option B build `<rect>`s from the `uqr` matrix |
| PNG | Email attachment | Option A `qrcode.toBuffer` if it works on Workers; option B `uqr` matrix + `worker/services/png.ts` |

**Fallback PNG encoder (`png.ts`, about 60 lines):** scale the matrix (for example 8px per module with a 4-module quiet zone), write grayscale rows, compress them with the built-in `CompressionStream("deflate")` (zlib format, which is what PNG IDAT expects), and add CRC32 chunks. There are no dependencies, and CPU time is low enough for the free plan.

### 8.3 Day-one test (from brief section 9)
1. Add `GET /api/qr-test?text=hello` that returns `image/png`.
2. Try option A with `nodejs_compat`. Run `npm run dev`, open it, and scan the result with a phone camera.
3. If it fails to bundle or run, switch to option B.
4. Run `wrangler deploy` and test on the `*.workers.dev` URL from a real phone.
5. Record the result and the bundle size (`wrangler deploy` prints it) in the README. Delete the route before launch.

---

## 9. Email Pipeline (Resend)

### 9.1 Send flow
```
POST register -> rpc insert (email_status = pending) -> 201 response
                         \-> waitUntil(sendTicketEmail)
                                 build PNG -> Resend API -> update email_status sent|failed
```
- Call the Resend REST API with `fetch` (`POST https://api.resend.com/emails`) to keep the bundle small. The `resend` SDK is also fine if it runs on Workers.
- Payload:
```ts
{
  from: env.EMAIL_FROM,
  to: [registration.email],
  subject: `Ito na ang ticket mo, ${firstName}!`,
  html: ticketEmailHtml({...}),          // <img src="cid:ticket-qr">
  text: ticketEmailText({...}),          // plain-text fallback
  attachments: [
    { filename: "reggie-ticket.png", content: base64Png, content_id: "ticket-qr" },
  ],
}
```
**(verify)** the exact inline-attachment field name (`content_id` / `contentId`) in the current Resend docs.
- Use an `Idempotency-Key` header (`ticket-${registration.id}-${attempt}`) so retries don't send duplicates.

### 9.2 Template (`email.ts`)
- Table-based HTML with inline styles (for email client compatibility), max width 600px.
- Colors: a maroon `#800000` header band with a thin gold `#FFDF00` line under it, a white body with `#3B0A0A` text and the Reggie PNG, and a maroon button with white text (a padded `<a>` inside a table cell, so it renders in Outlook). Always light, since email dark-mode handling varies by client.
- Contents: Reggie PNG (absolute URL `APP_URL/reggie-email.png`), a greeting in Reggie's voice, event title, date and time formatted in `Asia/Manila`, venue, the QR (`cid:ticket-qr`, 240×240), the button "Buksan ang ticket online" linking to `APP_URL/ticket/:token`, and a footer.
- Escape all user-provided values before inserting them into the HTML.

### 9.3 Failure handling
- If Resend returns non-2xx or the fetch throws, set `email_status = failed` and log it with `console.error` (visible in Workers observability).
- The admin registrants table shows a red "Email failed" badge and a **Resend ticket** button, which calls `POST /api/admin/registrations/:id/resend`, sets the status to `pending`, and runs `waitUntil(send)` again.
- The registrant always has the `/ticket/:token` page as a backup.

### 9.4 Domain verification
Resend → Domains → add `mail.<domain>`, then copy the SPF (TXT/MX) and DKIM (TXT) records into Cloudflare DNS with the proxy **off** (records set to DNS only). Optionally add DMARC (`_dmarc` TXT `v=DMARC1; p=none;`). Until the domain is verified, `onboarding@resend.dev` can only send to the account owner's address. **(verify the current free-tier limits: daily and monthly caps)**

---

## 10. PWA Setup

```ts
VitePWA({
  registerType: "autoUpdate",
  includeAssets: ["icons/*.png", "reggie-email.png"],
  manifest: {
    name: "Reggie: Seminar Registration",
    short_name: "Reggie",
    start_url: "/",
    display: "standalone",
    background_color: "#FFFFFF",   // light-mode white, shown on the splash screen
    theme_color: "#800000",        // status bar matches the maroon top bar in both modes,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    navigateFallback: "/index.html",
    navigateFallbackDenylist: [/^\/api\//],   // never serve the shell for API calls
    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
    runtimeCaching: [],                       // no API caching at all
  },
})
```
- **Online-only rule:** registration and check-in use plain `fetch` with no caching. When `navigator.onLine` is false, Reggie shows `confused` with "Offline ka yata, subukan ulit pag may signal."
- **Update prompt:** a small toast saying "May bagong version si Reggie" with a Reload button (using `useRegisterSW`).
- **iOS:** add `apple-touch-icon` and `apple-mobile-web-app-capable` meta tags, plus an "Add to Home Screen" hint on Safari.
- **Scanner:** use `@yudiel/react-qr-scanner` with `constraints={{ facingMode: "environment" }}`. If permission is denied, show a Reggie `sad` card with steps to re-enable the camera, plus a **manual token entry** field as a fallback (it calls the same `/checkin` endpoint).

---

## 11. Testing Strategy

### 11.1 Unit (Vitest)
- `shared/schemas.ts`: valid and invalid PH numbers (`09171234567`, `+639171234567`, `0917 123 4567` pass; `0817...` and 10-digit numbers fail), email normalization, name trimming.
- `worker/services/qr.ts`: tokens are 22 characters of base64url; 10,000 generated tokens contain no duplicates; the PNG starts with the PNG signature and decodes back to the token (decode with `jsqr` in the test).
- `copy.ts`: every `ErrorCode` and every schema message code has a string, so no code renders as a raw key.

### 11.2 Worker integration (`@cloudflare/vitest-pool-workers`)
Run against a **separate Supabase test project**, or a local Supabase from `supabase start` (needs Docker; skip it if the team can't run Docker).
- Register, then confirm the row exists with all four fields exactly as submitted (normalized phone). **Task 1**
- Registering twice with the same email returns 409 `duplicate_registration`.
- Filling a capacity-1 event with a second registrant returns 409 `event_full`.
- Two registrations get different `qr_token` values. **Task 2**
- Check-in returns `checked_in`, a second check-in returns `already_checked_in` with the same timestamp, a token for another event returns `wrong_event`, and garbage returns `invalid`. **Task 4**
- Admin B calling `GET/PATCH /admin/events/{A's id}`, `/registrations`, `/checkin` and `/resend` gets 404. Calls with no token get 401. **Ownership checklist**
- Resend is mocked with `fetchMock` here; real sends happen in 11.3.

### 11.3 Email E2E with Testmail (`tests/scripts/testmail-check.ts`) for Task 3
```ts
const tag = `reggie-${Date.now()}`;
const email = `${NAMESPACE}.${tag}@inbox.testmail.app`;
const t0 = Date.now();
await fetch(`${BASE}/api/events/${EVENT_ID}/registrations`, { method: "POST", body: JSON.stringify({...}) });

// Live query waits until the email arrives (or times out)
const res = await fetch(
  `https://api.testmail.app/api/json?apikey=${KEY}&namespace=${NAMESPACE}&tag=${tag}&livequery=true`
).then(r => r.json());

const msg = res.emails[0];
assert(msg.subject.startsWith("Ito na ang ticket mo"));
assert(Date.now() - t0 < 60_000);                                     // "arrives promptly"
assert(msg.html.includes("cid:ticket-qr"));
assert(msg.attachments.some(a => a.contentType === "image/png"));     // QR attached
// Optional: download the attachment, decode with jsqr, compare to the token
```
**(verify)** the Testmail response field names. This needs the verified Resend domain (Phase 2). Also check by hand in a real Gmail inbox, both web and mobile app, that the QR image displays inline, and take screenshots for the report.

### 11.4 Browser E2E (Playwright, optional but useful for the report)
- The happy path: Home → Events → Register → Ticket shows a QR.
- Validation: submitting an empty form shows Reggie in the `error` state and the field messages.
- Run it with mobile (Pixel 7, iPhone 14) and desktop viewports and save screenshots.

### 11.5 Manual device matrix (Phase 4)
| Device | Install PWA | Register | Ticket QR | Scan (as admin) |
|---|---|---|---|---|
| Android Chrome | ☐ | ☐ | ☐ | ☐ |
| iOS Safari (home screen) | ☐ | ☐ | ☐ | ☐ |
| Desktop Chrome/Edge | ☐ | ☐ | ☐ | ☐ (webcam) |

---

## 12. Deployment, Domain, and DNS

1. **Domain:** claim the `.app` (or `.dev`) domain through the Name.com student offer. Note the renewal date and price in the README.
2. **Cloudflare:** add the site (free plan), then switch the Name.com nameservers to the two Cloudflare nameservers and wait until the zone shows Active.
3. **First deploy:** run `npm run deploy` to get `reggie.<account>.workers.dev` working, and check the size `wrangler` prints for the Worker (it must be under 3 MiB gzip).
4. **Custom domain:** add `"routes": [{ "pattern": "<domain>", "custom_domain": true }]` to `wrangler.jsonc`, or use Dashboard → Worker → Domains. Cloudflare issues the SSL certificate automatically.
5. **Secrets:** run `wrangler secret put SUPABASE_SERVICE_ROLE_KEY` and `wrangler secret put RESEND_API_KEY`, plus the Turnstile secret if used.
6. **Supabase:** add `https://<domain>/admin` to the Auth redirect URLs and to the Google OAuth authorized origins/redirects.
7. **Resend:** verify `mail.<domain>` (section 9.4) and set `EMAIL_FROM` to `Reggie <tickets@mail.<domain>>`.
8. **CI (optional):** a GitHub Action on push to `main` that runs typecheck, tests, build, and then `cloudflare/wrangler-action` with a `CLOUDFLARE_API_TOKEN` secret.
9. **Smoke test** after each deploy: `GET /api/events` returns 200, `/ticket/x` serves the SPA (not a 404), and `/manifest.webmanifest` loads.

---

## 13. Phase-by-Phase Task List

### Phase 1: Foundation and Task 1 (Nov 9–15)
| # | Task | Acceptance criteria |
|---|---|---|
| 1.1 | Scaffold Vite + React + TS, Hono Worker, Cloudflare Vite plugin, Tailwind, shadcn | `npm run dev` serves the SPA, and `/api/health` returns `{ok:true}` from the same origin |
| 1.2 | `.gitignore`, `.dev.vars.example`, README with setup steps | A fresh clone plus filled-in `.dev.vars` runs locally |
| 1.3 | **QR day-one test** (8.3) deployed to workers.dev | A phone scans the PNG from the deployed URL. Chosen: **option B** (`uqr` + `worker/services/png.ts`), which has no Node dependencies |
| 1.4 | Supabase project, migrations 0001–0003, type generation | Tables, RLS and the function exist; `shared/db.types.ts` is generated |
| 1.5 | Shared Zod schemas and unit tests | 11.1 schema tests pass |
| 1.6 | Supabase middleware (per request) and error helper | Errors follow the 6.1 shape |
| 1.7 | `GET /api/events`, `GET /api/events/:id` | Only published events are returned; drafts return 404 |
| 1.8 | `POST /api/events/:id/registrations` (without email yet) | Duplicate returns 409, full returns 409, and the row stores all four fields |
| 1.9 | Reggie SVG (brown, PUP maroon-and-gold "27" jersey) with all eight moods, `ReggieBall` tap reaction, `copy.ts`, palette tokens, dark mode | Every mood and the ball tap are visible on a `/dev/reggie` preview page; reduced motion is respected; contrast is checked |
| 1.10 | Pages: Home, Events, Register | A full registration from the UI lands in the DB. **✅ Task 1** |

### Phase 2: QR and Email, Tasks 2 and 3 (Nov 16–20)
| # | Task | Acceptance criteria |
|---|---|---|
| 2.1 | `services/qr.ts`: token, SVG, PNG | Unit tests pass, including the 10k uniqueness check and decode |
| 2.2 | `GET /api/tickets/:token` and the Ticket page with confetti | A new registration redirects to the ticket page with a scannable QR. **✅ Task 2** |
| 2.3 | Domain live on Cloudflare; Resend domain verified | Resend dashboard shows Verified |
| 2.4 | `services/email.ts`: template, CID attachment, `waitUntil`, `email_status` | The test email shows the QR inline in Gmail web and app |
| 2.5 | Testmail automation script (11.3) | The script passes, with delivery in under 60 seconds and a PNG attached. **✅ Task 3** |

### Phase 3: Admin and Check-in, Task 4 (Nov 21–25)
| # | Task | Acceptance criteria |
|---|---|---|
| 3.1 | Google OAuth, `AuthProvider`, `requireAdmin` (JWKS) | Signing in works locally and on the domain; requests with no or bad tokens get 401 |
| 3.2 | Admin events CRUD and publish toggle | A new event is a draft (hidden publicly), and publishing makes it appear in `/events` |
| 3.3 | Registrants list, stats, CSV export, Resend button | Stats match the DB; the CSV opens correctly in Excel/Sheets; Resend changes a failed status to sent |
| 3.4 | `POST /checkin` with atomic update | All four results are covered by integration tests |
| 3.5 | Scan page: camera, result sheet, cooldown, manual fallback | Scanning the test QR on a phone shows "Checked In", and a second scan shows "Naka-check in na siya." **✅ Task 4** |
| 3.6 | Ownership tests (admin A vs B) | Every cross-admin call returns 404. **✅ checklist item** |
| 3.7 | PWA manifest, icons, service worker, update toast, offline copy | Lighthouse marks the app installable; `/api/*` is never served from cache |

### Phase 4: Hardening and Report (Nov 26–30)
| # | Task | Acceptance criteria |
|---|---|---|
| 4.1 | Optional Turnstile and rate limit on register | Rapid repeated posts return 429 |
| 4.2 | Accessibility pass: labels, focus order, `aria-live`, reduced motion | Lighthouse accessibility score ≥ 95 |
| 4.3 | Device matrix (11.5) | All boxes checked; installed on a phone. **✅ PWA checklist item** |
| 4.4 | Production deploy to the custom domain, `/api/qr-test` removed | Live over HTTPS on the custom domain. **✅ deploy checklist item** |
| 4.5 | Full rehearsal: create event, publish, register 3 Testmail addresses plus 1 real Gmail, scan all | Every verification item has screenshot evidence |
| 4.6 | Report: screenshots for each task, architecture diagram, test output | Matches whatever format the instructor requires (open question) |

---

## 14. Verification Checklist Mapping

| Checklist item (brief §10) | Proven by | Evidence for report |
|---|---|---|
| Task 1: fields land in DB | 1.10 + integration test 11.2 | Form screenshot plus the Supabase table row |
| Task 2: unique QR | 2.1, 2.2 + uniqueness test | Two tickets side by side with different QRs, plus test output |
| Task 3: email arrives, QR displays | 2.4, 2.5 + Testmail script | Gmail screenshot (web and mobile) and script output with timing |
| Task 4: scan marks Checked In; rescan shows already checked in | 3.4, 3.5 | Phone screen recording, plus `checked_in_at` in the DB |
| Admin isolation | 3.6 | Test output showing 404s |
| Installed PWA, phone and desktop | 3.7, 4.3 | Home-screen icon screenshot and Lighthouse report |
| Custom domain over HTTPS | 4.4 | Browser address bar screenshot |

---

## 15. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| The `qrcode` package fails on Workers | Day-one test; pure-JS `uqr` + `png.ts` fallback is already planned |
| The Resend domain is not verified in time | Start DNS in Phase 2, day one. Until then, test with the owner's email; the `/ticket` page is always a backup |
| Resend free-tier cap reached during rehearsal | Use Testmail sparingly; check limits **(verify)**; failed sends can be resent |
| Camera blocked on iOS or permission denied | HTTPS everywhere, clear permission UI, manual token entry fallback |
| Venue Wi-Fi is weak on event day | The scanner app shell is cached; check-in calls are tiny. Phones can use mobile data |
| Race conditions (overbooking, double check-in) | Row-locked RPC for register; conditional update for check-in |
| Supabase free project pauses after inactivity | Open the dashboard or hit the API during the week before the event **(verify the current pause policy)** |
| Leaked service-role key | It exists only as a Worker secret, `.dev.vars` is gitignored, RLS is enabled, and the key can be rotated if exposed |

---

## 16. Open Questions (with working defaults)

| Question | Default until decided |
|---|---|
| Exact domain name | Placeholder `reggie.example.app` in config |
| Single Worker or Pages + Worker | **Single Worker** (as in the brief) |
| `qrcode` or the pure-JS fallback | Decided by task 1.3 |
| Team split | Suggested: A = Task 1 + Reggie UI, B = Task 2 QR, C = Task 3 email + Testmail, D = Task 4 admin + scanner; everyone does Phase 4 |
| CSV export | **Yes**, included in 3.3 (cheap and useful for the report) |
| Report format | Ask the instructor; section 14 lists the evidence to collect either way |
| QR payload: token or ticket URL | **Token only** (8.1) |
| Admin allowlist | Any Google account can be an organizer of its own events |
