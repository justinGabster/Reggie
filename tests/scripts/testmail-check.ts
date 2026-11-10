/**
 * Task 3 end-to-end check (Implementation Plan §11.3): register with a unique Testmail address,
 * wait for the ticket email, and assert it arrived promptly with the inline QR.
 *
 * Run (Node 24 strips TypeScript types natively; the flag is accepted but optional there):
 *   BASE_URL=https://reggie.example EVENT_ID=<published-event-uuid> \
 *   TESTMAIL_API_KEY=... TESTMAIL_NAMESPACE=... \
 *   node --experimental-strip-types tests/scripts/testmail-check.ts
 *
 * PowerShell:
 *   $env:BASE_URL="..."; $env:EVENT_ID="..."; $env:TESTMAIL_API_KEY="..."; $env:TESTMAIL_NAMESPACE="..."
 *   node --experimental-strip-types tests/scripts/testmail-check.ts
 *
 * Not part of `npm test` (vitest only picks up *.test.ts). Each run sends one real email through Resend,
 * so mind the free-tier quota. Exit code 0 = all checks passed.
 *
 * Testmail response field names below are marked (verify): check https://testmail.app/docs before relying on them.
 */
import { inflateSync } from "node:zlib";
import jsQR from "jsqr";

const MAX_ARRIVAL_MS = 60_000;
const OVERALL_TIMEOUT_MS = 120_000;

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`Missing env ${name}. Required: BASE_URL, EVENT_ID, TESTMAIL_API_KEY, TESTMAIL_NAMESPACE`);
    process.exit(2);
  }
  return v;
}

const BASE = requireEnv("BASE_URL").replace(/\/$/, "");
const EVENT_ID = requireEnv("EVENT_ID");
const KEY = requireEnv("TESTMAIL_API_KEY");
const NAMESPACE = requireEnv("TESTMAIL_NAMESPACE");

// (verify) Testmail email/attachment shapes.
type TestmailAttachment = { filename?: string; contentType?: string; downloadUrl?: string; cid?: string; size?: number };
type TestmailEmail = { subject: string; html?: string; text?: string; timestamp?: number; attachments?: TestmailAttachment[] };
type TestmailResponse = { result: string; message?: string | null; count: number; emails: TestmailEmail[] };

let failures = 0;
function check(ok: boolean, label: string, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? `  (${detail})` : ""}`);
  if (!ok) failures++;
}

/** Decodes the 8-bit grayscale PNG that worker/services/png.ts writes, then reads it with jsQR. */
function scanPng(png: Uint8Array): string | undefined {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let off = 8;
  let width = 0;
  let height = 0;
  const idat: Uint8Array[] = [];
  while (off < png.length) {
    const len = view.getUint32(off);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    if (type === "IHDR") {
      width = view.getUint32(off + 8);
      height = view.getUint32(off + 12);
      if (png[off + 16] !== 8 || png[off + 17] !== 0) return undefined; // only 8-bit grayscale
    } else if (type === "IDAT") idat.push(png.subarray(off + 8, off + 8 + len));
    else if (type === "IEND") break;
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    if (raw[y * (width + 1)] !== 0) return undefined; // only filter type 0
    for (let x = 0; x < width; x++) {
      const g = raw[y * (width + 1) + 1 + x];
      rgba.set([g, g, g, 255], (y * width + x) * 4);
    }
  }
  return jsQR(rgba, width, height)?.data;
}

async function waitForEmail(tag: string, since: number): Promise<TestmailEmail> {
  const deadline = Date.now() + OVERALL_TIMEOUT_MS;
  const url =
    `https://api.testmail.app/api/json?apikey=${encodeURIComponent(KEY)}` +
    `&namespace=${encodeURIComponent(NAMESPACE)}&tag=${encodeURIComponent(tag)}` +
    `&timestamp_from=${since}&livequery=true`;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(Math.max(1000, deadline - Date.now())) });
      const body = (await res.json()) as TestmailResponse;
      if (body.result !== "success") throw new Error(`Testmail: ${body.message ?? res.status}`);
      if (body.emails?.length) return body.emails[0];
    } catch (err) {
      if ((err as Error).name === "TimeoutError") break;
      // A live query can end without a match (server-side timeout); log and ask again.
      console.log(`  (testmail) ${(err as Error).message}; retrying`);
    }
  }
  throw new Error(`No email for tag ${tag} within ${OVERALL_TIMEOUT_MS / 1000}s`);
}

async function main() {
  const tag = `reggie-${Date.now()}`;
  const email = `${NAMESPACE}.${tag}@inbox.testmail.app`;
  console.log(`Registering ${email} for event ${EVENT_ID} at ${BASE}`);

  const t0 = Date.now();
  const reg = await fetch(`${BASE}/api/events/${EVENT_ID}/registrations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fullName: "Testmail Check",
      email,
      organization: "Reggie QA",
      contactNumber: "09171234567",
    }),
  });
  const regMs = Date.now() - t0;
  const regBody = (await reg.json()) as { token?: string; ticketUrl?: string; error?: { code: string } };
  check(reg.status === 201, "registration returns 201", `status ${reg.status}, ${regMs} ms${regBody.error ? `, ${regBody.error.code}` : ""}`);
  if (reg.status !== 201 || !regBody.token) process.exit(1);
  const token = regBody.token;

  const msg = await waitForEmail(tag, t0 - 5_000);
  const seenMs = Date.now() - t0;
  const serverMs = msg.timestamp ? msg.timestamp - t0 : undefined; // (verify) timestamp is epoch ms

  check(msg.subject.startsWith("Ito na ang ticket mo"), "subject starts with \"Ito na ang ticket mo\"", msg.subject);
  check(seenMs < MAX_ARRIVAL_MS, `arrived in under ${MAX_ARRIVAL_MS / 1000}s`, `${(seenMs / 1000).toFixed(1)} s`);
  check(Boolean(msg.html?.includes("cid:ticket-qr")), "html references cid:ticket-qr");
  check(Boolean(msg.html?.includes(`/ticket/${token}`)), "html links the ticket page");

  const png = msg.attachments?.find((a) => a.contentType === "image/png"); // (verify) contentType field name
  check(Boolean(png), "a PNG attachment exists", png?.filename ?? "none");

  if (png?.downloadUrl) {
    // (verify) downloadUrl field name
    const bytes = new Uint8Array(await (await fetch(png.downloadUrl)).arrayBuffer());
    const decoded = scanPng(bytes);
    check(decoded === token, "attached QR decodes to the registration token", decoded ?? "unreadable");
  } else {
    console.log("SKIP  QR decode (no downloadUrl on the attachment)");
  }

  console.log("");
  console.log("Timing");
  console.log(`  POST /registrations response: ${regMs} ms`);
  console.log(`  email visible via Testmail:   ${(seenMs / 1000).toFixed(1)} s after submit`);
  if (serverMs !== undefined) console.log(`  Testmail receive timestamp:   ${(serverMs / 1000).toFixed(1)} s after submit`);
  console.log(`  ticket: ${BASE}${regBody.ticketUrl ?? ""}`);
  console.log("");
  console.log(failures ? `${failures} check(s) FAILED` : "All checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error("ERROR", err instanceof Error ? err.message : err);
  process.exit(1);
});
