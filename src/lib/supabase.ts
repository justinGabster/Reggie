import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, used ONLY for admin sign-in (anon key; data goes through the Worker API).
 * When the env vars are missing the app still runs: `supabase` is null and admin pages show a setup note.
 */
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const supabaseConfigured: boolean = Boolean(url && anonKey);

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" },
      })
    : null;
