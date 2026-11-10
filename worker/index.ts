import { Hono } from "hono";
import type { AppEnv } from "./env";
import { ApiErr, errorBody } from "./errors";
import { supabase } from "./middleware/supabase";
import { publicRoutes } from "./routes/public";
import { adminRoutes } from "./routes/admin";
import { qrTestRoutes } from "./routes/qrTest";

/**
 * One Worker: static assets (the built React app, with SPA fallback) are served by Cloudflare,
 * and wrangler.jsonc's run_worker_first sends /api/* here.
 */
const app = new Hono<AppEnv>().basePath("/api");

app.get("/health", (c) => c.json({ ok: true }));
app.route("/", qrTestRoutes);

app.use("/events/*", supabase);
app.use("/events", supabase);
app.use("/tickets/*", supabase);
app.use("/admin/*", supabase);

app.route("/", publicRoutes);
app.route("/admin", adminRoutes);

app.notFound((c) => c.json(errorBody("not_found", "No such API route"), 404));

app.onError((err, c) => {
  if (err instanceof ApiErr) return c.json(errorBody(err.code, err.message, err.fields), err.status);
  console.error("Unhandled error", err);
  return c.json(errorBody("internal", "Something went wrong"), 500);
});

export default app;
