# Reggie: ChatGPT Frontend Visualization Prompts

Reggie's look is **final**: `design/Reggie’s chibi puppy mascot turnaround sheet.png`. These prompts only produce the UI boards around him.

**Before you start:** attach the character sheet to Message 0. Send the messages **in order, in one chat**, so Reggie and the UI style stay consistent.

| # | Message | Output |
|---|---|---|
| 0 | Style Bible (+ character sheet) | ChatGPT confirms; no image yet |
| ~~1~~ | ~~Character sheet~~ | **Done**: the turnaround sheet in `design/` |
| 2 | Pages overview (all 8 screens) | 1 image: the full app map |
| 3 | Reactive states board | 1 image: form and scanner reactions |
| 4 | (optional) Desktop and dark mode | 1 image |

If text comes out garbled or the screens are cramped, split that prompt into smaller ones (one row of 4 screens, or one screen per prompt). Repeat: "Keep Reggie and the style exactly as in the previous image."

---

## Message 0: Style Bible

```
You are my UI/visual designer for "Reggie", a mobile-first seminar registration PWA. Before you generate anything, read this Style Bible. Every image I ask for in this chat must follow it exactly. Reply only "Style Bible locked" and a 3-line summary. Don't generate an image yet.

=== PRODUCT ===
Reggie (from "Registration Form") lets attendees register for seminars and get a QR ticket. Organizers create events and scan QR codes for check-in. The core idea is EMOTION DESIGN: a friendly dog mascot who reacts to everything the user does. The microcopy is warm Taglish (Filipino-English), and errors are forgiving, never cold. The app's colors come from the Polytechnic University of the Philippines (PUP) seal: maroon, gold and white.

=== REGGIE (FINAL DESIGN, DO NOT CHANGE) ===
The attached character sheet is the official Reggie. Copy him EXACTLY in every image: same shapes, same proportions, same colors, same art style. Do not redesign or recolor him.
Quick reminder of his look: a chibi chocolate-brown puppy (#96603F) with darker brown floppy ears, a cream muzzle, huge glossy eyes with two highlights each, floating dark eyebrows, pink blush, a maroon #800000 sleeveless basketball jersey with gold trim and a gold "27" ("REGGIE 27" on the back), and an orange basketball always near his feet. Flat vector, no outlines, two-tone shading, soft ground shadow.

Reggie's moods (as on the sheet): IDLE (waving, tail wag), TYPING (ears up, looking at the field), ERROR (head tilt, one ear down, sweat drop), LOADING (running with a gold ticket in his mouth), SUCCESS (slam-dunk jump, ^ ^ eyes, confetti), CONFUSED ("?" above his head), SAD (ears droop, one tear), EYEBROW (one brow raised, smirk).
Tap the ball: the ball bonks off his head ("> <" eyes, stars, "boing!"), bounces away, and he recovers with a grin.

=== UI COLOR PALETTE (PUP SEAL COLORS, use ONLY these) ===
- PUP Maroon #800000 (darker shade #5C0000)
- PUP Gold #FFDF00 (bright yellow-gold from the star)
- PUP Goldenrod #DAA520 (the star's darker gold)
- White #FFFFFF
Helper colors, only where stated: body text dark maroon #3B0A0A, cream #FFF8E7, dark-mode surfaces #140404 and #2E0B0B, error red #C62828 (dark mode #FF8A80), success green #18703F (dark mode #6EE7A0).
NO navy, NO blue buttons, NO orange UI, NO yellow page backgrounds.

=== PAGES ===
LIGHT MODE
- Page background: plain WHITE #FFFFFF (not yellow, not gold, not cream).
- Top bar on every screen: solid PUP Maroon #800000 bar, with a thin Gold #FFDF00 line under it. Small Reggie head logo plus "Reggie" wordmark in white on the left (tapping it goes to Home), a Gold #FFDF00 gear (settings) icon on the right. Every inner page has a white back arrow "<" in the top bar before its title.
- Cards, inputs and speech bubbles: white #FFFFFF, 2px Goldenrod #DAA520 border, and a hard SOLID Goldenrod #DAA520 "ledge" shadow directly below (0 4px 0, NO blur). Corner radius 18–22px. Everything looks like a thick physical tile you could press.
- Headings: PUP Maroon #800000. Body text: dark maroon #3B0A0A. Links: Maroon, underlined. Never use gold as text on white.

DARK MODE
- Page background: near-black maroon #140404.
- Top bar: the same Maroon #800000 bar with the gold line.
- Cards, inputs and speech bubbles: #2E0B0B with a 2px Maroon #800000 border and Maroon ledge.
- Body text and headings: cream #FFF8E7. Links and key words: Gold #FFDF00.
- Reggie keeps his exact colors. Behind him, a flat circle of Gold #FFDF00 at ~15% opacity, like a court spotlight, so he stands out.

=== BUTTONS (must follow the PUP palette exactly) ===
All buttons: radius 18px, height ~50px, full width on mobile, UPPERCASE Nunito 900, slightly letter-spaced, with a solid 0 4px 0 ledge in the darker color listed (no blur). Pressed state: the button moves down 4px and the ledge disappears.

LIGHT MODE buttons
- PRIMARY (main action, e.g. REGISTER, SAVE AS DRAFT, SCAN QR): PUP Maroon #800000 fill, WHITE text, #5C0000 ledge.
- SECONDARY (e.g. SAVE AS IMAGE, VIEW MY TICKET, RESEND): PUP Gold #FFDF00 fill, Maroon #800000 text, Goldenrod #DAA520 ledge.
- GHOST (e.g. BACK TO EVENTS, EXPORT CSV, Sign in with Google): white fill, 2px Maroon #800000 border, Maroon text, Maroon ledge.
- DANGER (rare, e.g. UNPUBLISH): red #C62828 fill, white text, #8E1B1B ledge.
- Disabled: 40% opacity, no ledge.

DARK MODE buttons (primary and secondary swap so the main action still pops)
- PRIMARY: Gold #FFDF00 fill, Maroon #800000 text, Goldenrod #DAA520 ledge.
- SECONDARY: Maroon #800000 fill, white text, #5C0000 ledge.
- GHOST: transparent fill, 2px Gold #FFDF00 border, Gold text.
- DANGER: red #C62828 fill, white text.

Floating "+" button: a round PRIMARY button (Maroon in light, Gold in dark).
Toggle switches: ON = Maroon #800000 track in light mode / Gold #FFDF00 track in dark mode, white knob. OFF = light grey track.

=== OTHER UI ELEMENTS ===
- Font: Nunito (rounded sans). Bold 700 body, 900 headings.
- Focused input: 2px Maroon #800000 border with a soft Gold #FFDF00 glow (light mode); Gold border and glow (dark mode).
- Errors: red #C62828 border, icon and message text, with a very light pink fill #FDECEC (light). Dark mode: #FF8A80 border and text on #3A0F14.
- Success / checked in: green #18703F border and text on a light green fill #E3F4EA (dark mode: #6EE7A0 on #0B2E22).
- Status pills (pill-shaped, 2px border, small uppercase 900 text): PUBLISHED = Maroon fill, white text. DRAFT = Gold fill, Maroon text. CHECKED IN = green. REGISTERED = Gold fill, Maroon text. EMAIL FAILED and PUNO NA = red #C62828 fill, white text.
- Speech bubble: Reggie always talks through a rounded card-style bubble (white with Goldenrod border and ledge in light mode, #2E0B0B in dark mode) with a small triangular tail pointing at Reggie. Key words in the bubble are bold Maroon (light) or bold Gold (dark).
- Progress bars: thick rounded pill, Goldenrod #DAA520 fill on a light grey track, with a thin white gloss line on top.
- Icons: rounded line icons, 2.5px stroke, round caps, in Maroon (light) or cream (dark).
- Navigation: NO bottom tab bar on any screen. The Home screen's two big cards (REGISTRANT / ORGANIZER) are the only place to choose a path.
- Overall mood: clean, bright and friendly, with PUP varsity colors. Lots of white space. No stock photos, no gradients, no glassmorphism, no dark outlines on the illustration.

=== IMAGE RULES ===
- Render all UI text exactly as I write it, spelled correctly. Keep text short.
- Phone screens are clean flat UI mockups (iPhone-style frame, thin dark bezel), shown straight-on, not in perspective.
- Reggie must look like the attached character sheet in every screen and every image.
```

---

## Message 2: Pages Overview (all 8 screens)

```
Using the Style Bible and the official Reggie from the attached sheet, generate a PAGES OVERVIEW board for the Reggie PWA in LIGHT MODE.

Canvas: wide landscape 16:9, background very light grey #F6F6F6 with a faint dotted grid (so the white phone screens stand out). Title at top-left: "Reggie · Pages Overview" (Nunito 900, Maroon #800000). Show 8 iPhone screens in 2 rows of 4. Each screen has a WHITE page background and the maroon top bar. Each screen has a small uppercase label above it, and thin Maroon arrows connect the screens in flow order.

Follow the Style Bible's LIGHT MODE BUTTONS exactly: PRIMARY = Maroon #800000 with white text, SECONDARY = Gold #FFDF00 with Maroon text, GHOST = white with Maroon border and Maroon text, all with solid ledges.

ROW 1, label on the left: "REGISTRANT FLOW"

1) HOME (/)
   Maroon top bar with logo. Large Reggie in the IDLE mood (waving, tail wagging) in the upper half, his orange basketball at his feet with a tiny hand-tap hint icon and a small label "tap me!". Speech bubble: "Woof! Sino ka ngayon?"
   Two big stacked choice cards with ledge shadows:
   - Maroon #800000 card (white text, #5C0000 ledge), ticket icon: "REGISTRANT", with the subline "Mag-register sa event"
   - Gold #FFDF00 card (Maroon text, Goldenrod ledge), clipboard icon: "ORGANIZER", with the subline "Manage your events"
   No bottom tab bar; Reggie and the cards use the full height.

2) EVENTS (/events)
   Back arrow "<" and the heading "Upcoming Events". Small Reggie peeking from the top-right corner (IDLE) with a mini bubble: "Pili ka na!"
   3 white event cards with Goldenrod borders. Each has a Maroon top strip, title, date chip (calendar icon), venue (pin icon), and a Goldenrod spots-left progress bar:
   - "Intro to UX Design" · Nov 28 · 2:00 PM · AVR Hall · "12 spots left"
   - "Cloud 101 Workshop" · Dec 2 · 9:00 AM · Room 304 · "40 spots left"
   - "Data Privacy Talk": greyed out with a red #C62828 pill badge "PUNO NA" (white text) and the progress bar full.

3) REGISTER (/events/:id/register)
   Back arrow plus the event title "Intro to UX Design". Reggie at the top in the TYPING mood. Bubble: "Sige, nakikinig ako."
   4 white input fields with labels, rounded with Goldenrod borders:
   Full Name, Email Address (this field is FOCUSED, with a Maroon border and soft gold glow), Organization, Contact Number (placeholder "09XX XXX XXXX").
   Full-width PRIMARY button (Maroon, white text): "REGISTER".

4) TICKET (/ticket/:token)
   Confetti (maroon, gold, goldenrod pieces) and sparkles at the top. Reggie in the SUCCESS mood. Bubble: "Rehistrado ka na!"
   A white ticket card with a Goldenrod border, a perforated tear line and notched sides: a large black-and-white QR code in the center, the attendee name "Juan Dela Cruz", and "Intro to UX Design · Nov 28 · AVR Hall".
   Below: a small note with an envelope icon, "Check your email, nandoon din ang ticket mo." Two buttons: "SAVE AS IMAGE" (SECONDARY, Gold) and "BACK TO EVENTS" (GHOST, white with Maroon border).

ROW 2, label on the left: "ORGANIZER FLOW"

5) ORGANIZER HOME (/admin)
   Reggie IDLE wearing a tiny lanyard ID badge. Bubble: "Hello, organizer! Ready na ba ang event?"
   Heading "My Events". 2 white event cards with status pills: one "PUBLISHED" (Maroon pill, white text) and one "DRAFT" (Gold pill, Maroon text), each showing "48 / 60 registered".
   A round PRIMARY floating "+" button (Maroon, white "+") at bottom-right with the label "ADD EVENT".
   (Small inset in the corner: the signed-out version, a white card with a GHOST "Sign in with Google" button and Reggie holding a key.)

6) NEW EVENT (/admin/events/new)
   Heading "Create Event". Reggie small at the top in TYPING mode. Bubble: "Anong event natin?"
   Fields: Event Title, Description (textarea), Date & Time (with a calendar icon), Venue, Capacity (number stepper).
   PRIMARY button (Maroon, white text) "SAVE AS DRAFT". Small helper text: "Pwede mo pang i-edit bago i-publish."

7) EVENT DETAIL (/admin/events/:id)
   Title "Intro to UX Design" with a Publish toggle switch (ON, Maroon track).
   3 white stat tiles in a row with colored borders: "48/60 Registered" (Maroon border), "21 Checked In" (green #18703F border), "1 Email Failed" (red #C62828 border).
   A search bar "Search registrant...".
   Registrant list cards: name, organization, a status pill ("CHECKED IN" green / "REGISTERED" Gold), and one row with a red "EMAIL FAILED" pill and a small SECONDARY (Gold) "RESEND" button.
   Bottom: a big PRIMARY button (Maroon, white text) "SCAN QR" with a camera icon, and a small GHOST button "EXPORT CSV".
   Reggie mini in the corner, IDLE, giving a thumbs-up paw.

8) SCAN (/admin/events/:id/scan)
   A full-screen dark camera view with a rounded Gold #FFDF00 scanning frame in the center (corner brackets) and a moving gold scan line.
   A white bottom sheet sliding up (rounded top corners) showing the SUCCESS result: a green #18703F check badge "CHECKED IN", "Juan Dela Cruz · UP Diliman", and Reggie in the SUCCESS mood on the left side of the sheet. Bubble: "Pasok! Welcome, Juan!"
   Small Maroon link at the very bottom: "Enter code manually".

Keep Reggie identical to the character sheet in every screen and only change his mood. Keep the UI consistent: white pages, maroon top bar, Nunito, chunky ledge shadows, 18–22px radius, PUP maroon and gold only.
```

---

## Message 3: Reactive States Board

This shows the "reactive behavior": how Reggie and the UI respond moment to moment.

```
Using the Style Bible and the official Reggie, generate a REACTIVE STATES board in LIGHT MODE. It shows how Reggie and the UI react to the user.

Canvas: wide landscape 16:9, background very light grey #F6F6F6. Title: "Reggie · Reactive States" (Maroon #800000). 2 rows. Every phone screen has a white page and the maroon top bar. Buttons follow the Style Bible's LIGHT MODE BUTTONS exactly.

ROW 1: "REGISTRATION FORM REACTIONS". 5 phone screens of the same Register page, each showing a different moment. Small step labels sit above, connected by Maroon arrows:
 a) FOCUS: user taps the Email field. Its border turns Maroon with a soft gold glow. Reggie TYPING, ears up, pupils looking at the email field. Bubble: "Sige, nakikinig ako."
 b) FIELD ERROR: the Email field has a red #C62828 border and light pink fill #FDECEC, with a small red message under it: "Oops, kulang pa ang email." The field gives a tiny shake (draw small motion marks). Reggie in the ERROR mood. Bubble: "Mali? Ayusin lang natin, kaya mo 'yan!"
 c) SUBMITTING: the Maroon PRIMARY button shows a spinner and reads "SENDING...", disabled (faded, no ledge). Reggie in the LOADING mood (running with a gold ticket in his mouth). Bubble: "Kukunin ko na ang ticket mo..."
 d) DUPLICATE: a white card with Reggie in the CONFUSED mood. Bubble: "Naka-register ka na yata!" SECONDARY button (Gold, Maroon text): "VIEW MY TICKET".
 e) EVENT FULL: Reggie SAD. A white card with a red "PUNO NA" pill. Bubble: "Puno na, pasensya na!" PRIMARY button (Maroon, white text): "SEE OTHER EVENTS".

ROW 2: "QR SCANNER RESULTS". 4 phone screens of the Scan page. Each has the same dark camera view with the Gold scan frame, and the white bottom sheet shows a different result with its own color:
 a) CHECKED IN: green #18703F check badge, "CHECKED IN", "Juan Dela Cruz". Reggie SUCCESS. Bubble: "Pasok! Welcome, Juan!"
 b) ALREADY CHECKED IN: Goldenrod #DAA520 clock badge, "ALREADY CHECKED IN · 9:14 AM". Reggie in the EYEBROW mood. Bubble: "Naka-check in na siya."
 c) WRONG EVENT: Maroon #800000 swap-arrows badge, "WRONG EVENT", "Registered for: Cloud 101 Workshop". Reggie CONFUSED. Bubble: "Hmm, ibang event 'to ah."
 d) INVALID: red #C62828 X badge, "INVALID QR". Reggie CONFUSED, squinting. Bubble: "Hindi ko kilala 'tong QR na 'to."

Bottom strip (small): 4 tiny UI details:
 - "TAP THE BALL" mini sequence on the Home screen, exactly like the sheet: a finger taps the orange basketball, it bonks off Reggie's head ("> <" eyes, stars, "boing!"), then bounces away while he grins.
 - A toast pill (Maroon #800000 fill, white bold text): "Offline ka yata, subukan ulit pag may signal." with Reggie sad mini-head.
 - The white Settings card with 3 toggle switches (ON = Maroon track): "Sounds", "Reduce motion", "Dark mode", and Reggie mini saying "Ikaw bahala!"
 - A "Camera blocked" card with Reggie SAD and the steps "1. Tap the lock icon 2. Allow camera 3. Reload".

Same Reggie as the sheet, same style, PUP maroon and gold UI on white.
```

---

## Message 4 (optional): Desktop and Dark Mode

```
Using the Style Bible and the official Reggie, generate a board with 2 large mockups side by side (16:9):

LEFT, "DESKTOP · LIGHT": the Organizer Event Detail page at desktop width on a WHITE page. The maroon top bar (logo and white wordmark on the left, gold gear icon on the right, no nav links) with the thin gold line under it, a back arrow before the event title, content max-width ~960px, the 3 white stat tiles in a row (Maroon, green and red borders), and the registrants shown as a white TABLE with a Goldenrod border (columns: Name, Email, Organization, Contact, Status, Actions) with status pills and a Gold SECONDARY "RESEND" button on the failed row. A Maroon PRIMARY "SCAN QR" button at the top-right of the table. Reggie sits at the top-right of the content area next to a speech bubble: "21 na ang pumasok! Tuloy lang."

RIGHT, "MOBILE · DARK MODE": the Home screen in dark mode. Background #140404, the same maroon top bar, cards #2E0B0B with a 2px Maroon border and Maroon ledge, text cream #FFF8E7. Use the DARK MODE BUTTONS: the REGISTRANT card is Gold #FFDF00 with Maroon text (primary), the ORGANIZER card is Maroon #800000 with white text (secondary). Reggie keeps his exact colors and stands on a flat gold spotlight circle (#FFDF00 at ~15% opacity). Bubble (#2E0B0B card, key words in Gold): "Woof! Sino ka ngayon?"
```

---

## Tips for iterating in ChatGPT

- **Fix one thing per message:** "Same image, but make the page background pure white."
- **If Reggie drifts** (changes color, gets outlines, looks different from the sheet): re-attach the character sheet and say "Match this Reggie exactly. Do not redesign him."
- **If the colors drift** (navy, blue, orange or yellow backgrounds appear): say "Redo it with the Style Bible's PUP palette only: white pages, maroon #800000 top bar and primary buttons, gold #FFDF00 secondary buttons, goldenrod #DAA520 card borders."
- **If text is garbled:** ask for that single screen alone, or say "use fewer words, render text exactly as quoted."
- **For handoff to code:** when you're happy, ask ChatGPT: "List every component, color and spacing value you used on screen N." That maps straight onto `src/components/` in the Implementation Plan (section 7).
