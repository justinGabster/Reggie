/** Response shapes shared by the Worker and the React app (Implementation Plan §6). */

export const ERROR_CODES = [
  "validation_error", "not_found", "duplicate_registration", "event_full",
  "unauthorized", "forbidden", "rate_limited", "internal",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export type ApiError = {
  error: { code: ErrorCode; message: string; fields?: Record<string, string> };
};

export type PublicEvent = {
  id: string;
  title: string;
  description: string;
  dateTime: string;
  venue: string;
  capacity: number;
  spotsLeft: number;
};

export type EventStatus = "draft" | "published";
export type EmailStatus = "pending" | "sent" | "failed";

export type AdminEvent = PublicEvent & {
  status: EventStatus;
  registeredCount: number;
  checkedInCount: number;
  createdAt: string;
};

export type AdminRegistration = {
  id: string;
  fullName: string;
  email: string;
  organization: string;
  contactNumber: string;
  emailStatus: EmailStatus;
  checkedInAt: string | null;
  createdAt: string;
};

export type Stats = { registered: number; checkedIn: number; capacity: number; emailFailed: number };

export type RegisterResponse = {
  registration: { id: string; fullName: string; eventId: string };
  ticketUrl: string;
  token: string;
};

export type TicketResponse = {
  ticket: {
    fullName: string;
    organization: string;
    checkedInAt: string | null;
    event: PublicEvent;
  };
  qrSvg: string;
};

export type CheckinResult =
  | { result: "checked_in"; registration: { fullName: string; organization: string; checkedInAt: string } }
  | { result: "already_checked_in"; registration: { fullName: string; organization: string; checkedInAt: string } }
  | { result: "wrong_event"; registration: { fullName: string; eventTitle: string } }
  | { result: "invalid" };
