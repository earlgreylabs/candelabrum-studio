import type { Context } from "hono";

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function badRequest(c: Context, message: string) {
  return c.json({ error: message }, 400);
}

export async function optionalJson(c: Context): Promise<unknown> {
  return c.req.header("content-type")?.includes("application/json") ? c.req.json() : {};
}
