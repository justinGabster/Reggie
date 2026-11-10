import type { Bindings, Db } from "../env";
import { qrPng } from "./qr";
import { toBase64 } from "./png";
import { escapeHtml, formatManila, type EventRow, type RegistrationRow } from "./format";

export type TicketEmail = {
  firstName: string;
  eventTitle: string;
  when: string;
  venue: string;
  ticketUrl: string;
  reggieUrl: string;
};

/** Table layout + inline styles for email clients. Always light, since dark-mode handling varies by client. */
export function ticketEmailHtml(t: TicketEmail): string {
  const e = {
    firstName: escapeHtml(t.firstName),
    eventTitle: escapeHtml(t.eventTitle),
    when: escapeHtml(t.when),
    venue: escapeHtml(t.venue),
    ticketUrl: escapeHtml(t.ticketUrl),
    reggieUrl: escapeHtml(t.reggieUrl),
  };
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#ffffff;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;border:2px solid #DAA520;border-radius:18px;overflow:hidden;font-family:Nunito,Arial,Helvetica,sans-serif;color:#3B0A0A;">
  <tr><td style="background:#800000;padding:18px 24px;border-bottom:4px solid #FFDF00;">
    <span style="color:#ffffff;font-size:22px;font-weight:900;letter-spacing:0.5px;">Reggie</span>
    <span style="color:#FFDF00;font-size:13px;font-weight:700;">&nbsp;&nbsp;Your registration buddy</span>
  </td></tr>
  <tr><td align="center" style="padding:24px 24px 0;">
    <img src="${e.reggieUrl}" width="140" alt="Reggie the puppy" style="display:block;border:0;width:140px;height:auto;">
    <h1 style="margin:16px 0 4px;font-size:24px;color:#800000;">Ito na ang ticket mo, ${e.firstName}!</h1>
    <p style="margin:0;font-size:15px;">Woof! Rehistrado ka na. Ipakita mo lang ang QR na ito sa entrance.</p>
  </td></tr>
  <tr><td style="padding:20px 24px 0;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFDF2;border:2px solid #DAA520;border-radius:14px;">
      <tr><td style="padding:14px 18px;font-size:15px;line-height:1.6;">
        <strong style="color:#800000;font-size:17px;">${e.eventTitle}</strong><br>
        &#128197; ${e.when}<br>
        &#128205; ${e.venue}
      </td></tr>
    </table>
  </td></tr>
  <tr><td align="center" style="padding:20px 24px 8px;">
    <img src="cid:ticket-qr" width="240" height="240" alt="Your QR ticket" style="display:block;border:0;width:240px;height:240px;">
  </td></tr>
  <tr><td align="center" style="padding:8px 24px 24px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#800000;border-radius:14px;border-bottom:4px solid #5C0000;">
        <a href="${e.ticketUrl}" style="display:inline-block;padding:14px 26px;color:#ffffff;font-weight:900;font-size:15px;text-decoration:none;letter-spacing:0.5px;">BUKSAN ANG TICKET ONLINE</a>
      </td>
    </tr></table>
    <p style="margin:14px 0 0;font-size:12px;color:#6b4a4a;">Hindi lumalabas ang QR? Buksan ang link sa itaas.</p>
  </td></tr>
  <tr><td style="background:#FFF8E1;padding:12px 24px;font-size:12px;color:#6b4a4a;text-align:center;">
    Sent by Reggie &middot; Seminar Registration
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function ticketEmailText(t: TicketEmail): string {
  return [
    `Ito na ang ticket mo, ${t.firstName}!`,
    "",
    t.eventTitle,
    t.when,
    t.venue,
    "",
    `Open your ticket: ${t.ticketUrl}`,
    "",
    "- Reggie",
  ].join("\n");
}

/**
 * Builds the QR PNG, sends the ticket through Resend, and records email_status.
 * Runs inside waitUntil, so it never throws: any failure becomes email_status = failed.
 */
export async function sendTicketEmail(env: Bindings, db: Db, reg: RegistrationRow, event: EventRow, attempt = 1) {
  let status: "sent" | "failed" = "failed";
  try {
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is not set");
    const appUrl = env.APP_URL.replace(/\/$/, "");
    const t: TicketEmail = {
      firstName: reg.full_name.split(/\s+/)[0] || reg.full_name,
      eventTitle: event.title,
      when: formatManila(event.date_time),
      venue: event.venue,
      ticketUrl: `${appUrl}/ticket/${reg.qr_token}`,
      reggieUrl: `${appUrl}/reggie-email.png`,
    };
    const png = await qrPng(reg.qr_token, 8);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `ticket-${reg.id}-${attempt}`,
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        to: [reg.email],
        subject: `Ito na ang ticket mo, ${t.firstName}!`,
        html: ticketEmailHtml(t),
        text: ticketEmailText(t),
        // (verify) the inline-attachment field name in the current Resend docs.
        attachments: [
          { filename: "reggie-ticket.png", content: toBase64(png), content_id: "ticket-qr", content_type: "image/png" },
        ],
      }),
    });
    if (res.ok) status = "sent";
    else console.error("Resend error", res.status, await res.text());
  } catch (err) {
    console.error("sendTicketEmail failed", err);
  }
  const { error } = await db.from("registrations").update({ email_status: status }).eq("id", reg.id);
  if (error) console.error("email_status update failed", error);
  return status;
}
