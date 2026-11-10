import { describe, expect, it } from "vitest";
import {
  csvCell,
  escapeHtml,
  formatManila,
  registeredCount,
  toAdminRegistration,
  toPublicEvent,
  type EventWithCount,
  type RegistrationRow,
} from "../worker/services/format";
import { ticketEmailHtml, ticketEmailText, type TicketEmail } from "../worker/services/email";

function eventRow(overrides: Partial<EventWithCount> = {}): EventWithCount {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    admin_id: "22222222-2222-4222-8222-222222222222",
    title: "Seminar",
    description: "",
    date_time: "2026-12-01T01:00:00+00:00",
    venue: "Room 301",
    capacity: 10,
    status: "published",
    created_at: "2026-11-10T00:00:00+00:00",
    ...overrides,
  };
}

describe("escapeHtml", () => {
  it("escapes the five HTML-special characters", () => {
    expect(escapeHtml(`<a href="x" title='y'>&</a>`)).toBe(
      "&lt;a href=&quot;x&quot; title=&#39;y&#39;&gt;&amp;&lt;/a&gt;",
    );
  });

  it("leaves ordinary text (including non-ASCII) alone", () => {
    expect(escapeHtml("Juan Dela Cruz – Ñiño")).toBe("Juan Dela Cruz – Ñiño");
  });

  it("does not double-escape in a single pass", () => {
    expect(escapeHtml("&amp;")).toBe("&amp;amp;");
  });
});

describe("csvCell", () => {
  it("always quotes", () => {
    expect(csvCell("Juan")).toBe('"Juan"');
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell("line1\nline2")).toBe('"line1\nline2"');
  });

  it("doubles embedded quotes", () => {
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
  });

  it("handles null, undefined and numbers", () => {
    expect(csvCell(null)).toBe('""');
    expect(csvCell(undefined)).toBe('""');
    expect(csvCell(42)).toBe('"42"');
  });

  it.each(["=SUM(A1:A2)", "+1", "-1", "@cmd", "\t=1", "\r=1"])("neutralizes formula prefix in %j", (v) => {
    expect(csvCell(v)).toBe(`"'${v}"`);
  });

  it("neutralizes and still doubles quotes", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
  });

  it("does not touch a formula character in the middle", () => {
    expect(csvCell("a=b")).toBe('"a=b"');
  });
});

describe("toPublicEvent / registeredCount", () => {
  it("computes spotsLeft from the embedded count", () => {
    const e = toPublicEvent(eventRow({ capacity: 10, registrations: [{ count: 3 }] }));
    expect(e).toEqual({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Seminar",
      description: "",
      dateTime: "2026-12-01T01:00:00+00:00",
      venue: "Room 301",
      capacity: 10,
      spotsLeft: 7,
    });
  });

  it("treats a missing count as 0 registrations", () => {
    expect(toPublicEvent(eventRow({ capacity: 5 })).spotsLeft).toBe(5);
    expect(toPublicEvent(eventRow({ capacity: 5, registrations: [] })).spotsLeft).toBe(5);
    expect(registeredCount(eventRow())).toBe(0);
  });

  it("never returns a negative spotsLeft (e.g. capacity lowered after registrations)", () => {
    expect(toPublicEvent(eventRow({ capacity: 10, registrations: [{ count: 10 }] })).spotsLeft).toBe(0);
    expect(toPublicEvent(eventRow({ capacity: 10, registrations: [{ count: 12 }] })).spotsLeft).toBe(0);
  });

  it("does not leak admin_id or status", () => {
    const e = toPublicEvent(eventRow()) as Record<string, unknown>;
    expect(e.admin_id).toBeUndefined();
    expect(e.status).toBeUndefined();
  });
});

describe("toAdminRegistration", () => {
  it("maps snake_case to camelCase and drops qr_token / event_id", () => {
    const row: RegistrationRow = {
      id: "r1",
      event_id: "e1",
      full_name: "Juan",
      email: "juan@example.com",
      organization: "PUP",
      contact_number: "+639171234567",
      qr_token: "secret-token-should-not-appear",
      email_status: "sent",
      checked_in_at: null,
      created_at: "2026-11-10T00:00:00Z",
    };
    const out = toAdminRegistration(row);
    expect(out).toEqual({
      id: "r1",
      fullName: "Juan",
      email: "juan@example.com",
      organization: "PUP",
      contactNumber: "+639171234567",
      emailStatus: "sent",
      checkedInAt: null,
      createdAt: "2026-11-10T00:00:00Z",
    });
    expect(JSON.stringify(out)).not.toContain("secret-token");
  });
});

describe("formatManila", () => {
  it("shows Manila local time (UTC+8) for a known UTC instant", () => {
    const s = formatManila("2026-12-01T01:00:00Z"); // 09:00 in Manila
    expect(typeof s).toBe("string");
    expect(s).toMatch(/\b9:00\b/);
    expect(s).toMatch(/AM/i);
    expect(s).toContain("Dec");
    expect(s).toContain("2026");
  });

  it("rolls over to the next Manila day", () => {
    const s = formatManila("2026-12-01T20:30:00Z"); // 04:30 on Dec 2 in Manila
    expect(s).toMatch(/\b4:30\b/);
    expect(s).toMatch(/\b2\b/);
    expect(s).toMatch(/Wed/);
  });

  it("gives the same result for the same instant written with an offset", () => {
    expect(formatManila("2026-12-01T09:00:00+08:00")).toBe(formatManila("2026-12-01T01:00:00Z"));
  });
});

describe("ticket email", () => {
  const base: TicketEmail = {
    firstName: "Juan",
    eventTitle: "Intro to Workers",
    when: "Tue, Dec 1, 2026, 9:00 AM",
    venue: "Room 301",
    ticketUrl: "https://reggie.example/ticket/AbCdEfGhIjKlMnOpQrStUv",
    reggieUrl: "https://reggie.example/reggie-email.png",
  };

  it("references the inline QR by cid and links the ticket URL", () => {
    const html = ticketEmailHtml(base);
    expect(html).toContain('src="cid:ticket-qr"');
    expect(html).toContain('href="https://reggie.example/ticket/AbCdEfGhIjKlMnOpQrStUv"');
    expect(html).toContain('src="https://reggie.example/reggie-email.png"');
    expect(html).toContain("Ito na ang ticket mo, Juan!");
  });

  it("escapes user-provided values", () => {
    const html = ticketEmailHtml({
      ...base,
      firstName: "<script>alert(1)</script>",
      eventTitle: 'Talk "A" & <b>B</b>',
      venue: "<img src=x onerror=alert(1)>",
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>B</b>");
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).toContain("Talk &quot;A&quot; &amp; &lt;b&gt;B&lt;/b&gt;");
  });

  it("escapes a URL so it cannot break out of the href attribute", () => {
    const html = ticketEmailHtml({ ...base, ticketUrl: 'https://x/ticket/a" onclick="evil' });
    expect(html).not.toContain('" onclick="evil');
    expect(html).toContain("&quot; onclick=&quot;evil");
  });

  it("has a plain-text version with the ticket URL", () => {
    const text = ticketEmailText(base);
    expect(text.startsWith("Ito na ang ticket mo, Juan!")).toBe(true);
    expect(text).toContain(base.ticketUrl);
    expect(text).toContain(base.venue);
  });
});
