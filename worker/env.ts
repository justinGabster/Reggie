import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@shared/db.types";

export type Bindings = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  RESEND_API_KEY: string;
  EMAIL_FROM: string;
  APP_URL: string;
  TURNSTILE_SECRET?: string;
};

export type Db = SupabaseClient<Database>;
export type Variables = { db: Db; userId: string };
export type AppEnv = { Bindings: Bindings; Variables: Variables };
