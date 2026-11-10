import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodType } from "zod";
import { fieldErrors } from "@shared/schemas";
import type { ApiError, ErrorCode } from "@shared/api-types";

/** Thrown anywhere in a route; app.onError turns it into the §6.1 error shape. */
export class ApiErr extends Error {
  constructor(
    public status: ContentfulStatusCode,
    public code: ErrorCode,
    message: string,
    public fields?: Record<string, string>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new ApiErr(404, "not_found", what);

export function errorBody(code: ErrorCode, message: string, fields?: Record<string, string>): ApiError {
  return { error: { code, message, ...(fields ? { fields } : {}) } };
}

/** Parses the JSON body with a shared Zod schema, or throws a 400 validation_error with per-field codes. */
export async function parseJson<T extends ZodType>(c: Context, schema: T) {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new ApiErr(400, "validation_error", "Body must be JSON");
  }
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiErr(400, "validation_error", "Invalid input", fieldErrors(result.error));
  }
  return result.data as T["_output"];
}
