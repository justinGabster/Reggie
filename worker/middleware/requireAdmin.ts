import { createMiddleware } from "hono/factory";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { AppEnv } from "../env";
import { ApiErr } from "../errors";

// The JWKS fetcher caches keys per isolate. It holds no request state, so a module-level cache is safe.
const jwksByUrl = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function jwks(supabaseUrl: string) {
  let set = jwksByUrl.get(supabaseUrl);
  if (!set) {
    set = createRemoteJWKSet(new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`));
    jwksByUrl.set(supabaseUrl, set);
  }
  return set;
}

/**
 * Verifies the Supabase access token and sets c.var.userId.
 * Preferred: local verification against the project's JWKS (asymmetric signing keys).
 * Fallback: ask Supabase Auth (works for legacy symmetric-key projects).
 */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const header = c.req.header("Authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) throw new ApiErr(401, "unauthorized", "Sign in first");

  let userId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, jwks(c.env.SUPABASE_URL), {
      issuer: `${c.env.SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
    });
    userId = payload.sub;
  } catch {
    const { data, error } = await c.var.db.auth.getUser(token);
    if (!error) userId = data.user?.id;
  }
  if (!userId) throw new ApiErr(401, "unauthorized", "Session expired, sign in again");

  c.set("userId", userId);
  await next();
});
