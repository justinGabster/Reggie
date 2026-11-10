import { describe, expect, it } from "vitest";
import { checkinInput, eventInput, fieldErrors, registrationInput } from "../shared/schemas";

/** A registration that passes; tests override one field at a time. */
const valid = {
  fullName: "Juan Dela Cruz",
  email: "juan@example.com",
  organization: "PUP",
  contactNumber: "09171234567",
};

/** Parses a registration and returns the field-error map ({} when valid). */
function errorsFor(overrides: Record<string, unknown>) {
  const r = registrationInput.safeParse({ ...valid, ...overrides });
  return r.success ? {} : fieldErrors(r.error);
}

describe("registrationInput.contactNumber (PH mobile)", () => {
  it.each(["09171234567", "+639171234567", "0917 123 4567", "639171234567", "0917-123-4567", "  09171234567  "])(
    "accepts %j and normalizes to +639171234567",
    (contactNumber) => {
      const r = registrationInput.safeParse({ ...valid, contactNumber });
      expect(r.success).toBe(true);
      expect(r.data?.contactNumber).toBe("+639171234567");
    },
  );

  it.each([
    ["08171234567", "contact_format"], // not a 09 mobile prefix
    ["0917123456", "contact_format"], // 10 digits
    ["9171234567", "contact_format"], // 10 digits, no prefix
    ["091712345678", "contact_format"], // 12 digits
    ["0917abc4567", "contact_format"], // letters
    ["abcdefghijk", "contact_format"],
    ["", "contact_required"],
    ["   ", "contact_required"],
  ])("rejects %j with %s", (contactNumber, code) => {
    expect(errorsFor({ contactNumber })).toEqual({ contactNumber: code });
  });
});

describe("registrationInput other fields", () => {
  it("lowercases and trims email", () => {
    const r = registrationInput.parse({ ...valid, email: "  Juan.Dela@Example.COM  " });
    expect(r.email).toBe("juan.dela@example.com");
  });

  it("rejects a malformed email with email_format", () => {
    expect(errorsFor({ email: "not-an-email" })).toEqual({ email: "email_format" });
    expect(errorsFor({ email: "juan@" })).toEqual({ email: "email_format" });
  });

  it("rejects an empty email with email_required", () => {
    expect(errorsFor({ email: "   " })).toEqual({ email: "email_required" });
  });

  it("trims the name", () => {
    expect(registrationInput.parse({ ...valid, fullName: "  Juan Dela Cruz  " }).fullName).toBe("Juan Dela Cruz");
  });

  it("rejects a 1-character name (after trimming) with name_short", () => {
    expect(errorsFor({ fullName: "J" })).toEqual({ fullName: "name_short" });
    expect(errorsFor({ fullName: "  J  " })).toEqual({ fullName: "name_short" });
  });

  it("rejects a 101-character name with name_long", () => {
    expect(errorsFor({ fullName: "a".repeat(101) })).toEqual({ fullName: "name_long" });
  });

  it("rejects an empty organization with org_required", () => {
    expect(errorsFor({ organization: "" })).toEqual({ organization: "org_required" });
    expect(errorsFor({ organization: "   " })).toEqual({ organization: "org_required" });
  });

  it("keeps an optional turnstileToken", () => {
    expect(registrationInput.parse({ ...valid, turnstileToken: "abc" }).turnstileToken).toBe("abc");
  });
});

describe("eventInput", () => {
  const event = {
    title: "Intro to Cloudflare Workers",
    dateTime: "2026-12-01T09:00:00+08:00",
    venue: "PUP Main, Room 301",
    capacity: 50,
  };

  it("accepts a valid ISO datetime with an offset and defaults description", () => {
    const r = eventInput.parse(event);
    expect(r.dateTime).toBe("2026-12-01T09:00:00+08:00");
    expect(r.description).toBe("");
  });

  it("accepts a UTC (Z) datetime", () => {
    expect(eventInput.safeParse({ ...event, dateTime: "2026-12-01T01:00:00Z" }).success).toBe(true);
  });

  it.each(["2026-12-01T09:00:00", "2026-12-01", "next tuesday", ""])("rejects %j with date_invalid", (dateTime) => {
    const r = eventInput.safeParse({ ...event, dateTime });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!)).toEqual({ dateTime: "date_invalid" });
  });

  it('coerces capacity "50" to 50', () => {
    expect(eventInput.parse({ ...event, capacity: "50" }).capacity).toBe(50);
  });

  it.each([0, -1, 1.5, 10001, "", null])("rejects capacity %j with capacity_invalid", (capacity) => {
    const r = eventInput.safeParse({ ...event, capacity });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!)).toEqual({ capacity: "capacity_invalid" });
  });

  it('rejects non-numeric capacity "abc" with capacity_invalid', () => {
    const r = eventInput.safeParse({ ...event, capacity: "abc" });
    expect(r.success).toBe(false);
    expect(fieldErrors(r.error!)).toEqual({ capacity: "capacity_invalid" });
  });

  it("rejects short titles and venues", () => {
    const r = eventInput.safeParse({ ...event, title: "ab", venue: "x" });
    expect(fieldErrors(r.error!)).toEqual({ title: "title_short", venue: "venue_short" });
  });
});

describe("checkinInput", () => {
  it.each(["AAAAAAAAAAAAAAAAAAAAAA", "abc_DEF-123456789012345", "a".repeat(64), "  Zm9vYmFyYmF6cXV4cXV1eA  "])(
    "accepts %j",
    (token) => {
      expect(checkinInput.safeParse({ token }).success).toBe(true);
    },
  );

  it.each(["a".repeat(21), "a".repeat(65), "abc+def/ghi=jklmnopqrstu", "https://reggie.app/ticket/x", ""])(
    "rejects %j with token_invalid",
    (token) => {
      const r = checkinInput.safeParse({ token });
      expect(r.success).toBe(false);
      expect(fieldErrors(r.error!)).toEqual({ token: "token_invalid" });
    },
  );
});

describe("fieldErrors", () => {
  it("maps every failing field to its code", () => {
    const r = registrationInput.safeParse({ fullName: "J", email: "bad", organization: "", contactNumber: "0817" });
    expect(fieldErrors(r.error!)).toEqual({
      fullName: "name_short",
      email: "email_format",
      organization: "org_required",
      contactNumber: "contact_format",
    });
  });

  it('uses "invalid" for issues that are not one of our codes (e.g. a missing field)', () => {
    const r = registrationInput.safeParse({ ...valid, fullName: undefined });
    expect(fieldErrors(r.error!)).toEqual({ fullName: "invalid" });
  });

  it("keeps only the first code per field", () => {
    const r = registrationInput.safeParse({ ...valid, email: "" });
    expect(r.error!.issues.filter((i) => i.path[0] === "email").length).toBeGreaterThanOrEqual(1);
    expect(fieldErrors(r.error!).email).toBe("email_required");
  });

  it('puts root-level issues under "_"', () => {
    const r = registrationInput.safeParse("not an object");
    expect(fieldErrors(r.error!)).toEqual({ _: "invalid" });
  });
});
