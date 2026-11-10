# Reggie

Reggie is a seminar registration PWA with a friendly mascot: a chocolate-brown chibi puppy in a PUP maroon-and-gold "27" jersey who reacts to what you do, in Taglish.

- **Registrants** browse published events, register (Full Name, Email, Organization, Contact Number), get a ticket page with a unique QR code, and receive the same QR by email.
- **Organizers** sign in with Google, create and publish events, see registrants and stats, export CSV, resend failed emails, and scan QR codes on event day to mark attendees **Checked In**.

The design and plan live in [`reggie-project-brief.md`](reggie-project-brief.md) and [`Implementation Plan.md`](Implementation%20Plan.md).

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 19 + Vite + TypeScript, React Router, Tailwind CSS v4, Framer Motion, `vite-plugin-pwa` |
| API | Hono on a single Cloudflare Worker (serves the built SPA as static assets and `/api/*`) |
| Database / Auth | Supabase (Postgres + RLS, Google OAuth); the Worker uses the service-role key, the browser only the anon key for sign-in |
| Validation | Zod schemas in `shared/`, used by both the form and the API |
| QR | `uqr` (matrix) + a tiny built-in PNG encoder (`worker/services/png.ts`); SVG on the ticket page, PNG in the email |
| Scanner | `@yudiel/react-qr-scanner` |
| Email | Resend REST API, QR as an inline CID attachment |
| Tests | Vitest (+ `jsqr` to decode generated QR codes), Testmail.app for the email end-to-end check |

## Prerequisites

- Node.js 20 or later (the repo is tested on Node 24) and npm
- Accounts: Cloudflare, Supabase, Resend, Testmail.app (for the Task 3 check), Google Cloud (OAuth client)
- A domain on Cloudflare DNS for production (and for Resend domain verification)

## Setup

```bash
npm install
cp .dev.vars.example .dev.vars   # Worker secrets for local dev
cp .env.example .env             # Public browser values (VITE_*)
```

1. **Supabase project.** Create a project, then fill in:
   - `.dev.vars`: `SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API; server only, never prefix it with `VITE_`), `RESEND_API_KEY`, and optionally `TURNSTILE_SECRET`.
   - `.env`: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
   - `wrangler.jsonc` → `vars.SUPABASE_URL`: your `https://<ref>.supabase.co`. Until this placeholder is replaced, every DB-backed route returns `500 internal` ("Server is not configured").
2. **Migrations.** Run them in order: `supabase/migrations/0001_init.sql`, `0002_rls.sql`, `0003_functions.sql`. Either paste each into the Supabase SQL editor, or use the CLI: `supabase link --project-ref <ref>` then `supabase db push`. Afterwards you can regenerate `shared/db.types.ts` with `npm run db:types` (edit the `<id>` in `package.json` first).
3. **Google sign-in.** Supabase → Authentication → Providers → Google: create an OAuth client in Google Cloud Console and paste the client ID/secret; add Supabase's callback URL to the Google client's authorized redirect URIs. Then in Supabase → Authentication → URL Configuration add the redirect URLs `http://localhost:5173/admin` and `https://<your-domain>/admin`.
4. **Run it:** `npm run dev`, then open http://localhost:5173. `http://localhost:5173/api/health` should return `{"ok":true}`.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server with the Cloudflare plugin: SPA and Worker API on one origin (port 5173) |
| `npm run build` | Typecheck (`tsc -b`) and build the SPA + Worker into `dist/` |
| `npm run preview` | Build, then serve the production build locally |
| `npm run deploy` | Build, then `wrangler deploy` |
| `npm test` | Run the Vitest unit tests once (`tests/**/*.test.ts`) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | `tsc -b --noEmit` across the app, worker and node projects |
| `npm run cf-typegen` | Generate Worker binding types |
| `npm run db:types` | Generate `shared/db.types.ts` from the Supabase project |

## Testing

```bash
npm test
```

| File | Covers |
|---|---|
| `tests/schemas.test.ts` | PH mobile numbers (accept + normalize to `+639XXXXXXXXX`, reject with `contact_format` / `contact_required`), email/name/org rules, `eventInput`, `checkinInput`, `fieldErrors()` |
| `tests/qr.test.ts` | 22-char base64url tokens, 10,000 tokens with no duplicates, the PNG decodes back to the token with `jsqr`, SVG output, `toBase64` |
| `tests/format.test.ts` | `escapeHtml`, CSV quoting and formula-injection guard, `spotsLeft`, Manila time formatting, email HTML escaping and `cid:ticket-qr` |
| `tests/api.test.ts` | The Hono app in-process with `fetch` stubbed: health, 404 shape, config guard, 401 on every admin route without a token, 400 `validation_error` with field codes before any DB call, `/api/qr-test`, and the Resend payload (mocked) |

These tests never touch the network. Integration tests against a real Supabase test project (Plan §11.2) are not included yet.

### Task 3 email check (Testmail)

`tests/scripts/testmail-check.ts` registers a uniquely tagged Testmail address against a deployed instance, waits for the email via Testmail's live query, and checks the subject, arrival time (< 60 s), `cid:ticket-qr` in the HTML, a PNG attachment, and that the attached QR decodes to the ticket token. It is not run by `npm test` and sends one real email per run.

```bash
BASE_URL=https://<your-domain> EVENT_ID=<published-event-uuid> \
TESTMAIL_API_KEY=... TESTMAIL_NAMESPACE=... \
node --experimental-strip-types tests/scripts/testmail-check.ts
```

Node 24 runs TypeScript directly (the flag is optional there); on Node 20/22 use `npx tsx tests/scripts/testmail-check.ts`. Keep the Testmail key in a gitignored `.env.test` or your shell, never in the repo. The Testmail response field names are marked `(verify)` in the script.

## Day-one QR test

`GET /api/qr-test?text=hello` returns a PNG QR code generated on the Worker (`uqr` + `worker/services/png.ts`, no Node APIs). After `npm run dev` or a deploy, open it on a laptop and scan it with a phone camera; it should read `hello`. Record the result and the Worker bundle size that `wrangler deploy` prints.

> **Remove `/api/qr-test` before launch** (Plan task 4.4): delete `worker/routes/qrTest.ts` and its `app.route` line in `worker/index.ts`.

## Email (Resend) domain verification

Until a domain is verified, `onboarding@resend.dev` can only send to your own Resend account address.

1. Resend → Domains → add `mail.<your-domain>`.
2. Copy the SPF (MX + TXT) and DKIM (TXT) records into Cloudflare DNS with the proxy **off** (DNS only). Optionally add DMARC: `_dmarc` TXT `v=DMARC1; p=none;`.
3. Wait for Resend to show **Verified**, then set `EMAIL_FROM` in `wrangler.jsonc` to `Reggie <tickets@mail.<your-domain>>`.
4. Check the current free-tier daily/monthly limits before a rehearsal.

If a send fails, the registration is still saved with `email_status = failed`; the organizer can press **Resend ticket**, and the registrant always has the `/ticket/<token>` page.

## Deploy

```bash
npx wrangler login
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put RESEND_API_KEY
# optional: npx wrangler secret put TURNSTILE_SECRET
npm run deploy
```

1. Before deploying, set `APP_URL` in `wrangler.jsonc` to `https://<your-domain>` (it builds the ticket links in emails) and `SUPABASE_URL` to your project.
2. The first deploy gives you `reggie.<account>.workers.dev`; check that the size `wrangler` prints is under 3 MiB gzip.
3. **Custom domain:** add `"routes": [{ "pattern": "<your-domain>", "custom_domain": true }]` to `wrangler.jsonc` (or Dashboard → Worker → Domains) and redeploy. Cloudflare issues the certificate.
4. Add `https://<your-domain>/admin` to Supabase redirect URLs and the Google OAuth client.
5. **Smoke test:** `/api/health` returns `{"ok":true}`, `/api/events` returns 200, `/ticket/x` serves the app (not a 404), `/manifest.webmanifest` loads.

## Verification checklist (assignment Tasks 1–4)

| Item | How to verify | Evidence to collect |
|---|---|---|
| **Task 1**: form fields land in the DB | Register through the UI for a published event | Form screenshot + the matching row in Supabase → Table Editor → `registrations` (phone stored as `+639…`) |
| **Task 2**: unique QR per entry | Register twice; open both ticket pages. `npm test` (10,000-token uniqueness + decode tests) | Two tickets side by side with different QRs; `npm test` output |
| **Task 3**: email arrives promptly, QR displays | Run the Testmail script; also register a real Gmail address | Script output with timing; screenshots of the email in Gmail web and the Gmail mobile app with the QR visible |
| **Task 4**: scan marks Checked In; rescan shows already checked in | As the organizer, open the event → Scan QR and scan a ticket twice | Phone screen recording; `checked_in_at` set in Supabase |
| Admin isolation | Sign in as a second Google account and open the first admin's event URL | 404 screenshot / API response |
| Installed PWA | Install on Android Chrome, iOS Safari (Add to Home Screen), desktop Chrome/Edge | Home-screen icon screenshots; Lighthouse installability report |
| Custom domain over HTTPS | Open `https://<your-domain>` | Address-bar screenshot |

## Project structure

```
worker/                 Hono API (Cloudflare Worker entry: worker/index.ts)
  middleware/           supabase.ts (per-request client), requireAdmin.ts (Supabase JWT via JWKS)
  routes/               public.ts (/api/events, /api/tickets), admin.ts (/api/admin/*), qrTest.ts (remove before launch)
  services/             qr.ts, png.ts, email.ts, registrations.ts, format.ts
  errors.ts, env.ts     error shape { error: { code, message, fields? } }, bindings
shared/                 imported by both worker/ and src/
  schemas.ts            Zod schemas; messages are codes mapped to Taglish in src/lib/copy.ts
  api-types.ts          response shapes
  db.types.ts           Supabase types (regenerate with npm run db:types)
src/                    React app (pages/, components/, lib/)
supabase/migrations/    0001_init.sql, 0002_rls.sql, 0003_functions.sql
public/
  reggie/               Reggie PNG sprites (front, idle, typing, success, error, sad, confused, loading, tap1–4, ...)
  reggie-email.png      static Reggie used in the ticket email
  icons/                PWA icons
design/                 mascot sheets, mockups, sprite sources
tests/                  Vitest unit tests, helpers/, scripts/testmail-check.ts
wrangler.jsonc          Worker config (vars, SPA asset fallback, /api/* runs the Worker first)
```

The Reggie art is a set of PNG sprites cut from `design/Reggie’s chibi puppy mascot turnaround sheet.png` and placed in `public/reggie/`.

## Security notes

- `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` and `TURNSTILE_SECRET` are Worker secrets only. `.dev.vars` and `.env*` (except the examples) are gitignored.
- Every `/api/admin/*` route requires a valid Supabase access token and only ever returns the caller's own events (404 otherwise). RLS is a second layer.
- The QR encodes only a random 128-bit token, never the email.
