import { Hono } from "hono";
import type { AppEnv } from "../env";
import { qrPng } from "../services/qr";

/**
 * Day-one QR test (Implementation Plan §8.3): GET /api/qr-test?text=hello returns a PNG.
 * Scan it with a phone after deploying to workers.dev. REMOVE BEFORE LAUNCH (task 4.4).
 */
export const qrTestRoutes = new Hono<AppEnv>();

qrTestRoutes.get("/qr-test", async (c) => {
  const text = (c.req.query("text") ?? "hello from Reggie").slice(0, 200);
  const png = await qrPng(text, 8);
  return c.body(png as Uint8Array<ArrayBuffer>, 200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
});
