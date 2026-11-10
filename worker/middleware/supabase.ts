import { createMiddleware } from "hono/factory";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@shared/db.types";
import type { AppEnv } from "../env";
import { ApiErr } from "../errors";

/** Creates the Supabase client per request (Workers rule: never a global). Service-role key: server only. */
export const supabase = createMiddleware<AppEnv>(async (c, next) => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = c.env;
  if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR-PROJECT") || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiErr(500, "internal", "Server is not configured: set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  }
  c.set(
    "db",
    createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );
  await next();
});
