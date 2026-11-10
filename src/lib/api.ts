import type {
  AdminEvent,
  AdminRegistration,
  CheckinResult,
  ErrorCode,
  PublicEvent,
  RegisterResponse,
  Stats,
  TicketResponse,
} from "@shared/api-types";
import type { EventInput, RegistrationInput } from "@shared/schemas";
import { supabase } from "./supabase";

/** Every failed API call throws this. `code` is a shared ErrorCode, or "network" when offline. */
export class ApiError extends Error {
  status: number;
  code: ErrorCode | "network";
  fields?: Record<string, string>;

  constructor(status: number, code: ErrorCode | "network", message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    if (fields) this.fields = fields;
  }
}

type RequestOpts = { method?: string; body?: unknown; admin?: boolean };

function networkError() {
  return new ApiError(0, "network", "Network unavailable");
}

async function authHeader(): Promise<Record<string, string>> {
  if (!supabase) throw new ApiError(401, "unauthorized", "Sign-in is not configured");
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    await handleUnauthorized();
    throw new ApiError(401, "unauthorized", "Not signed in");
  }
  return { Authorization: `Bearer ${token}` };
}

async function handleUnauthorized() {
  try {
    await supabase?.auth.signOut();
  } catch {
    /* already signed out */
  }
  if (typeof window !== "undefined" && window.location.pathname !== "/admin") {
    window.location.assign("/admin");
  }
}

async function send(path: string, opts: RequestOpts = {}): Promise<Response> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw networkError();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.admin) Object.assign(headers, await authHeader());

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof TypeError) throw networkError();
    throw err;
  }

  if (res.ok) return res;

  let code: ErrorCode = "internal";
  let message = res.statusText || "Request failed";
  let fields: Record<string, string> | undefined;
  try {
    const data = (await res.json()) as { error?: { code?: ErrorCode; message?: string; fields?: Record<string, string> } };
    if (data.error?.code) code = data.error.code;
    if (data.error?.message) message = data.error.message;
    fields = data.error?.fields;
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 401 && opts.admin) await handleUnauthorized();
  throw new ApiError(res.status, code, message, fields);
}

async function json<T>(path: string, opts?: RequestOpts): Promise<T> {
  const res = await send(path, opts);
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError(res.status, "internal", "Invalid JSON response");
  }
}

const enc = encodeURIComponent;

export const api = {
  events: () => json<{ events: PublicEvent[] }>("/events"),
  event: (id: string) => json<{ event: PublicEvent }>(`/events/${enc(id)}`),
  register: (eventId: string, input: RegistrationInput) =>
    json<RegisterResponse>(`/events/${enc(eventId)}/registrations`, { method: "POST", body: input }),
  ticket: (token: string) => json<TicketResponse>(`/tickets/${enc(token)}`),

  admin: {
    events: () => json<{ events: AdminEvent[] }>("/admin/events", { admin: true }),
    event: (id: string) => json<{ event: AdminEvent }>(`/admin/events/${enc(id)}`, { admin: true }),
    createEvent: (input: EventInput) =>
      json<{ event: AdminEvent }>("/admin/events", { method: "POST", body: input, admin: true }),
    updateEvent: (id: string, patch: Partial<EventInput> & { status?: "draft" | "published" }) =>
      json<{ event: AdminEvent }>(`/admin/events/${enc(id)}`, { method: "PATCH", body: patch, admin: true }),
    deleteEvent: (id: string) =>
      json<{ ok: true }>(`/admin/events/${enc(id)}`, { method: "DELETE", admin: true }),
    registrations: (id: string) =>
      json<{ registrations: AdminRegistration[]; stats: Stats }>(`/admin/events/${enc(id)}/registrations`, {
        admin: true,
      }),
    /** Fetches the CSV with the auth header and saves it via a temporary <a download>. */
    downloadCsv: async (id: string, filename: string): Promise<void> => {
      const res = await send(`/admin/events/${enc(id)}/registrations?format=csv`, { admin: true });
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href;
      a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(href), 1000);
    },
    checkin: (id: string, token: string) =>
      json<CheckinResult>(`/admin/events/${enc(id)}/checkin`, { method: "POST", body: { token }, admin: true }),
    resend: (registrationId: string) =>
      json<{ emailStatus: "pending" }>(`/admin/registrations/${enc(registrationId)}/resend`, {
        method: "POST",
        admin: true,
      }),
  },
};
