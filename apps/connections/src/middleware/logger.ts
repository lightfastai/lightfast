import { createMiddleware } from "hono/factory";

/**
 * Derive request source from headers/context.
 *
 * Priority:
 * 1. Explicit X-Request-Source header (set by callers, like x-trpc-source)
 * 2. X-API-Key present → internal service call
 * 3. Fallback "browser" — only browsers hit the service without headers
 */
function resolveSource(c: { req: { header(name: string): string | undefined } }): string {
  const explicit = c.req.header("X-Request-Source");
  if (explicit) { return explicit; }

  if (c.req.header("X-API-Key")) { return "service"; }

  return "browser";
}

/**
 * Request logger middleware — logs incoming requests with source context.
 *
 * Mirrors the console.info logging in @api/console context creators:
 *   ">>> tRPC Request from ${source} by ${userId}"
 */
export const logger = createMiddleware(async (c, next) => {
  const source = resolveSource(c);
  const id = (c.get("requestId" as never) as string | undefined) ?? "-";
  console.info(`>>> ${c.req.method} ${c.req.path} from ${source} [${id}]`);
  await next();
});
