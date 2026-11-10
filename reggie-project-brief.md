# Reggie: Seminar Registration PWA (Project Brief)

> Handoff document for Claude Code. Use this as the source of truth to generate a comprehensive `Implementation Plan.md`.

- **App name:** **Reggie** (from "Registration Form")
- **Mascot:** Reggie, a chocolate-brown puppy in a PUP maroon-and-gold "27" basketball jersey with a tappable orange basketball (inline SVG with animated mood states). Full spec: section 7, "Reggie's look"
- **Concept:** Registration with *emotion design*: a friendly mascot, warm Taglish micro-copy, and forgiving feedback instead of cold error states.
- **Reference for tone and feel:** https://4regab.github.io/vibereview/ (mascot "Ming" speaks in first person, Taglish copy such as "Mali? Try again", optional sounds, dark mode toggle, saved progress)

---

## 1. Assignment Requirements (from instructor)

1. **Registration form (frontend):** Attendees enter Full Name, Email Address, Organization, Contact Number. *Verify:* a test submission lands accurately in the database/spreadsheet.
2. **Database and QR script (backend/automation):** On each new entry, generate a unique QR code image from the participant's unique ID or email. *Verify:* a test submission produces a unique QR image for that entry.
3. **Automated email delivery (messaging):** Send a confirmation email with the QR ticket. *Verify:* the email arrives promptly and the QR displays correctly in the inbox.
4. **On-site check-in scanner (event day):** Scan the QR with a phone or tablet and mark the attendee "Checked In". *Verify:* scanning the test QR marks the attendee as checked in.

---

## 2. Product Flow

### Home
Reggie asks: **"Registrant or Organizer?"**

### Registrant path
1. Browse the list of **published** events (created by admins).
2. Pick an event.
3. Fill in: Full Name, Email Address, Organization, Contact Number.
4. Submit, then see a success screen with a ticket page (QR).
5. Receive a confirmation email with the QR ticket.

### Admin (Organizer) path
1. Sign in.
2. See a list of their own events, plus an **Add event** option.
3. Per event:
   - view registrants and stats
   - publish or unpublish the event
   - open **Scan QR** to check attendees in

### Check-in
- Camera scanner inside the PWA.
- Each scan returns one of: **valid** (marks checked in), **already checked in**, **wrong event**, **invalid**.

---

## 3. Decisions Made

| Area | Decision |
|---|---|
| Frontend | **React + Vite (TypeScript)**, single-page PWA, React Router |
| Backend | **Hono** (TypeScript) API running on **Cloudflare Workers** |
| App type | **PWA**, mobile-first, fully usable on desktop (`vite-plugin-pwa`) |
| Hosting and DNS | **Cloudflare** (free DNS and SSL; one Worker serves the built frontend as static assets and the API under `/api/*`) |
| Domain | **Name.com** student offer, preferably a **.app** (alt: .dev) domain, with DNS managed in Cloudflare |
| Database | Postgres via **Supabase** (free tier); alternative: MongoDB Atlas (student credits) |
| Auth (admin) | Supabase Auth (Google sign-in); Hono verifies the Supabase JWT on admin routes |
| Email API | **Resend** (sending) |
| Email testing | **Testmail.app** (receiving test inbox), see section 5 |
| Validation | **Zod** schemas shared by frontend and backend (`@hono/zod-validator`) |
| QR generation | Pure-JS QR approach that runs on Workers (see section 9 for the test-first plan) |
| QR scanning | `html5-qrcode` or `@yudiel/react-qr-scanner` (browser camera, needs HTTPS) |
| UI | Tailwind CSS + shadcn/ui |
| Animation | Framer Motion (and/or CSS) for Reggie states |
| Mascot | Reggie, a dog, inline SVG component with a `mood` prop |
| Dev environment | Windows-friendly: Vite and Wrangler run natively (verify on the team's machines; fall back to WSL if needed) |

**Why not Next.js:** OpenNext on Workers had limited Windows support and a 3 MiB gzip Worker size limit on the free plan. React + Vite + Hono is lighter and avoids both problems.

**Note:** Testmail is receive-only (`{namespace}.{tag}@inbox.testmail.app`); it cannot deliver email to real registrants. That is why Resend handles production sending.

---

## 4. Architecture

```
Phone / Desktop (React + Vite PWA)
   | pages, Reggie SVG states, camera scanner
   v
Cloudflare Worker (one deployment)
   |- static assets: built React app (SPA fallback to index.html)
   |- Hono API under /api/*
   |     |- GET  /api/events                       public: published events
   |     |- GET  /api/events/:id                   public: one published event
   |     |- POST /api/events/:id/registrations     public: register -> save -> QR -> email
   |     |- GET  /api/tickets/:token               public: ticket data for QR page
   |     |- GET  /api/admin/events                 admin: my events
   |     |- POST /api/admin/events                 admin: create event
   |     |- PATCH /api/admin/events/:id            admin: edit, publish/unpublish
   |     |- GET  /api/admin/events/:id/registrations   admin: list + stats
   |     |- POST /api/admin/events/:id/checkin     admin: scan token -> check in
   |     |- POST /api/admin/registrations/:id/resend   admin: resend ticket email
   v
Supabase Postgres      Resend (send)      Testmail (test inbox)
```

Same origin for the frontend and API, so no CORS setup is needed.

### Suggested folder structure
```
reggie/
  src/                 React app (pages, components, Reggie, hooks)
    pages/
    components/reggie/
    lib/               api client, supabase client, zod schemas (shared)
  worker/              Hono app (routes, middleware, email, qr, db)
  public/              icons, manifest assets
  supabase/            SQL migrations
  wrangler.jsonc
  vite.config.ts
  .dev.vars            local secrets (never commit)
```
If the shared Zod schemas cause friction, a `shared/` folder imported by both `src/` and `worker/` is fine.

### Routes (frontend, React Router)
```
/                          Reggie home: Registrant or Organizer
/events                    published events
/events/:eventId/register  registration form
/ticket/:token             confirmation + QR (backup to email)
/admin                     login, then my events + "Add event"
/admin/events/new          create event
/admin/events/:eventId     registrants list, stats, publish toggle
/admin/events/:eventId/scan   camera scanner
```

### Data model
**events**
- id (uuid), admin_id (Supabase user id), title, description, date_time, venue, capacity, status (`draft` | `published`), created_at

**registrations**
- id (uuid), event_id, full_name, email, organization, contact_number, qr_token (random, at least 128 bits, unique), email_status, checked_in_at (nullable), created_at
- Unique constraint on (event_id, email)

### Key rules
- **Roles:** the home choice is navigation only. Enforce admin access **server-side** in Hono middleware (verify JWT, then check `events.admin_id` equals the user); admins can only manage their own events. Enable Supabase RLS as a second layer.
- **Secrets:** use the Supabase service-role key only inside the Worker (Worker secret), never in the browser.
- **QR payload:** encode the random `qr_token`, not the email. The scan endpoint looks it up, verifies it belongs to the event being scanned, and sets `checked_in_at`.
- **Duplicate scans:** return "already checked in" (with the timestamp), never double-count.
- **Validation:** same Zod schema on client and server (name required, email format, PH mobile format for contact number, org required). Reject duplicates per event.
- **Capacity:** if full, Reggie shows a friendly "Puno na" state.
- **Abuse control (optional):** Cloudflare Turnstile on the registration form and rate limiting on public POST routes.
- **Workers rule:** create the Supabase client **per request**, not as a global.

---

## 5. Email (Resend)

- Send from the Hono registration route after the record is saved; use `waitUntil` so the user gets a fast response, and record `email_status` (`sent` | `failed`).
- Attach the QR PNG with a **CID inline image** (Gmail blocks base64 data URIs in the body). Also include a link to `/ticket/:token` as a fallback.
- Subject idea: "Ito na ang ticket mo, {firstName}!"
- Body: event title, date, venue, QR image, short Reggie-voice note. Use a static PNG of Reggie (email clients strip SVG and animation).
- **Resend caveats (verify current terms):**
  - Without a verified domain, the test sender (`onboarding@resend.dev`) can only send to the account owner's own email. To email real registrants, verify the Name.com domain (preferably a subdomain such as `mail.<domain>`) by adding the DNS records in Cloudflare.
  - Check current free-tier limits before event day.
- Handle send failures with a **Resend ticket** button on the admin registrants list.

### Testing with Testmail
- Use addresses like `reggie.test1@<namespace>.inbox.testmail.app` as test registrants (needs a verified Resend domain to deliver there).
- Read the received email through the Testmail API to automate the Task 3 verification (arrives promptly, QR image present).

---

## 6. PWA and Responsive Design

- `vite-plugin-pwa`: web manifest (name, icons, theme color, `display: standalone`) and a service worker.
- Cache the app shell; keep registration and check-in **online-only** for correctness.
- Make sure the service worker never caches `/api/*` responses and that the Worker serves `index.html` for unknown frontend routes (SPA fallback).
- Mobile-first layout with **no bottom tab bar**: a simple top bar (logo → Home, settings gear) on all screen sizes, and a back arrow on every inner page (needed because an installed iOS PWA has no back button). The Home screen's "Registrant or Organizer" cards are the only path chooser.
- Camera scanner requires HTTPS (Cloudflare provides it) and a user permission prompt; provide a clear fallback if permission is denied.
- Test on Android Chrome, iOS Safari (install to home screen), and desktop.

---

## 7. Emotion Design: Reggie

Reggie is one inline SVG component: `<Reggie mood="idle|typing|error|loading|success|confused" />`.

| State | Reggie | Copy idea |
|---|---|---|
| Home | Tail wag, head tilt | "Woof! Sino ka ngayon?" |
| Typing | Ears perk up, eyes follow the field | "Sige, nakikinig ako." |
| Field error | Tilted head | "Oops, kulang pa ang email." |
| Submitting | Fetching a ticket | "Kukunin ko na ang ticket mo..." |
| Success | Jumps, confetti | "Rehistrado ka na!" |
| Duplicate scan | Raised eyebrow | "Naka-check in na siya." |
| Event full | Sad droop | "Puno na, pasensya na!" |

Extras (optional): sound reactions and a settings toggle like the reference, dark mode, respect `prefers-reduced-motion`.

### Reggie's look
Reggie is a flat vector character: **no outlines**, depth from a darker same-hue layer under each shape (no gradients), chibi proportions (the head is about 55–60% of his height), and everything rounded. His expressiveness comes from oversized eyes, floating eyebrows and big floppy ears.

| Part | Design |
|---|---|
| Body | Chocolate-brown puppy (`#96603F`, shade `#7A4A2E`), cream muzzle, chest, paws and tail tip (`#F6E7D2`) |
| Ears | Big floppy ears in dark brown (`#6B4226`, shade `#55331D`); they carry the emotion (perk up, flop, droop) |
| Eyes | Very large white ovals with big ink pupils (`#000814`) and two white highlights; the pupils follow the cursor and the focused field |
| Eyebrows | Thick, rounded, floating ink strokes (`#000814`); most of the emotion lives here |
| Face | Pink blush ovals (`#FF8FA6`), a rounded dark-brown dog nose (`#2B1A12`), a "w" mouth; a pink-red tongue (`#F0606E`) when happy |
| Outfit | **PUP-colored basketball jersey**: PUP maroon (`#800000`, shade `#5C0000`), sleeveless, gold `#FFC300` trim, a gold "27" on the front and "REGGIE" in gold on the back. Colors come from the Polytechnic University of the Philippines seal (maroon and gold) |
| Prop | **Orange basketball** (`#F26B1D`, shade `#C9531A`, dark-brown seams `#3A2418`) beside his feet; brighter than his brown fur so they don't merge |

**Tap the ball:** tapping the basketball launches it in an arc. It bonks off Reggie's head (his head squashes, his eyes go `> <`, his ears fly up, stars appear) and bounces back to its spot. He looks dazed for a moment, then grins and wags his tail. Repeated taps make him head the ball back, getting more excited each time. This is a playful easter egg and never blocks the form.

Reggie's final look is the character sheet `design/Reggie’s chibi puppy mascot turnaround sheet.png`. Remaining mockups use the prompts in `design/chatgpt-frontend-prompts.md`.

### Palette (PUP seal colors)
The UI uses the colors of the Polytechnic University of the Philippines seal (hex sampled from the seal):

| Name | Hex | Use |
|---|---|---|
| PUP Maroon | `#800000` (shade `#5C0000`) | **Primary buttons**, top bar, headings, links, light-mode focus border, Reggie's jersey |
| PUP Gold | `#FFDF00` (bright star facet) | **Secondary buttons**, dark-mode primary buttons, dark-mode links, focus glow, scanner frame |
| PUP Goldenrod | `#DAA520` (shaded star facet) | Card borders and ledges (light mode), gold-button ledge, progress bars, "already checked in" |
| White | `#FFFFFF` | **Light-mode page background**, cards, text on maroon |

Helper colors (not in the seal, used only for these jobs): body text `#3B0A0A` (dark maroon), cream text `#FFF8E7` (dark mode), dark-mode surfaces `#140404` / `#2E0B0B`, error red `#C62828` (dark mode `#FF8A80`), success green `#18703F` (dark mode `#6EE7A0`).

Errors use red rather than maroon, because maroon is now the primary-button color and an error must not look like an action.

### Buttons
All buttons are chunky and pressable: 18px radius, ~50px tall, uppercase Nunito 900, and a solid 4px "ledge" in a darker shade (no blur).

| Button | Light mode | Dark mode |
|---|---|---|
| Primary | Maroon `#800000` fill, white text, `#5C0000` ledge | Gold `#FFDF00` fill, maroon `#800000` text, Goldenrod `#DAA520` ledge |
| Secondary | Gold `#FFDF00` fill, maroon `#800000` text, Goldenrod `#DAA520` ledge | Maroon `#800000` fill, white text, `#5C0000` ledge |
| Ghost | White fill, 2px maroon border, maroon text | Transparent, 2px gold border, gold text |
| Danger | Red `#C62828` fill, white text, `#8E1B1B` ledge | Same |

Primary and secondary swap in dark mode so the main action stays the brightest thing on the screen.

### Backgrounds
| Mode | Page background | Top bar | Cards | Text |
|---|---|---|---|---|
| Light | **White `#FFFFFF`** | Maroon `#800000`, white wordmark, gold gear icon, thin gold line underneath | White with 2px Goldenrod `#DAA520` border and ledge | Body `#3B0A0A`, headings maroon `#800000` |
| Dark | **`#140404`** (near-black maroon) | Same maroon top bar | `#2E0B0B` with 2px maroon `#800000` border and ledge | Cream `#FFF8E7`, headings and links gold `#FFDF00` |

Reggie keeps the same colors in both modes. In dark mode a flat gold circle at ~15% opacity sits behind him (a "court spotlight") so his maroon jersey and brown ears don't sink into the dark background. All text pairs pass WCAG AA (see the contrast table in Implementation Plan §7.4).

---

## 8. Domain, DNS and Deployment (Cloudflare)

**Domain:** claim the Name.com student offer (free domain on a select extension, e.g. `.app` or `.dev`). Make sure the Name.com account has a unique address, otherwise the request may be flagged as a duplicate. The Namecheap SSL offer is not needed because Cloudflare provides free SSL. `.app` and `.dev` are HTTPS-only, which suits a PWA.

**Setup steps:**
1. Add the domain to Cloudflare (free plan) and change the nameservers at Name.com to Cloudflare's.
2. Scaffold the project with Vite (React + TypeScript), add Hono for the Worker, and configure Wrangler (current Cloudflare docs: Workers static assets with SPA fallback, optionally via `@cloudflare/vite-plugin`; verify the current recommended setup).
3. Deploy with `wrangler deploy`; attach the custom domain to the Worker.
4. In Resend, verify the domain/subdomain by adding the SPF, DKIM and related records in Cloudflare DNS.
5. Store secrets (Resend key, Supabase keys, any signing secret) with `wrangler secret put`; use `.dev.vars` locally and never commit it.
6. Optional: set up GitHub Actions to deploy on push to `main`.

**Cloudflare caveats:**
- Free Workers plan limits a Worker to **3 MiB gzip-compressed**. A Vite SPA served as static assets plus a small Hono API should fit easily, but check the size `wrangler` prints after build.
- Static assets are served separately from the Worker script, so the 3 MiB limit applies to the API code only.
- Free plan CPU time per request is short; keep QR/PNG generation lean and send email via `waitUntil`.
- Windows: Vite and Wrangler are expected to work natively; if anything breaks, use WSL.

---

## 9. QR Library: Test First (day one)

Workers is a restricted runtime, so some Node packages fail there.
1. Build a tiny `/api/qr-test` route that returns one QR PNG.
2. Try the `qrcode` package with `nodejs_compat` enabled in `wrangler.jsonc`.
3. If it fails, fall back to a pure-JS option: generate the QR matrix with a small library (e.g. `uqr` or `qrcode-generator`) and encode a PNG with a pure-JS PNG encoder. Use SVG for the web ticket page and PNG only for the email attachment.
4. Deploy the test to Cloudflare (not just local) before building the rest.

---

## 10. Verification Checklist (maps to assignment)

- [ ] Task 1: Submit a test registration; all four fields land correctly in the database.
- [ ] Task 2: The test submission produces a unique QR (unique token per registration).
- [ ] Task 3: The confirmation email arrives promptly and the QR displays correctly (check via Testmail inbox).
- [ ] Task 4: Scanning the QR on a phone marks the attendee **Checked In**; a second scan shows "already checked in".
- [ ] Admin cannot see or scan other admins' events (API returns 403/404).
- [ ] Works as an installed PWA on phone and in a desktop browser.
- [ ] Production build deployed to the custom domain over HTTPS.

---

## 11. Timeline (suggested)

1. **Nov 9-15:** project setup, Cloudflare/Supabase wiring, QR library test, form, event list, Reggie SVG (Task 1)
2. **Nov 16-20:** QR generation and Resend email pipeline (Tasks 2 and 3)
3. **Nov 21-25:** admin dashboard, scanner, PWA polish (Task 4)
4. **Nov 26-30:** end-to-end test run, report screenshots, deployment

---

## 12. Open Questions

- Exact domain name to claim at Name.com (e.g. a `.app` name); confirm how long the free period lasts and the renewal price.
- Single Worker (static assets + Hono) or two deployments (Pages + Worker)? Default: single Worker.
- Does `qrcode` work on Workers, or do we need the pure-JS fallback?
- Final team split across the four tasks?
- Should the admin be able to export registrants to CSV (nice for the report)?
- Any required report format for screenshots and verification evidence?

---

## 13. Request for Claude Code

Using this brief, produce a comprehensive **Implementation Plan.md** covering: project scaffolding (Vite + React + Hono + Wrangler), folder structure, environment variables and secrets, database schema and migrations (with RLS), API contracts (request/response shapes and auth rules), component breakdown (including the Reggie mood system), email and QR pipelines, PWA setup, testing strategy (including Testmail automation), Cloudflare deployment and DNS/Resend verification, and a phase-by-phase task list with acceptance criteria tied to the verification checklist.
