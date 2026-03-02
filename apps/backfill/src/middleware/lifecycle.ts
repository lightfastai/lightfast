import { addBreadcrumb } from "@vendor/observability/sentry";
import { createMiddleware } from "hono/factory";
import { env } from "../env.js";
import { log } from "../logger.js";
import type { RequestIdVariables } from "./request-id.js";

const isDev = env.NODE_ENV !== "production";

export interface LifecycleVariables extends RequestIdVariables {
  /** Route handlers can enrich the lifecycle log with additional fields. */
  logFields: Record<string, unknown>;
}

/**
 * Derive request source from headers.
 *
 * Priority:
 * 1. Explicit X-Request-Source header (set by callers, like x-trpc-source)
 * 2. Fallback "service" — backfill only receives internal calls
 */
function resolveSource(c: {
  req: { header(name: string): string | undefined };
}): string {
  return c.req.header("X-Request-Source") ?? "service";
}

/**
 * Structured request lifecycle middleware — one JSON log per request.
 *
 * Replaces the separate logger + timing middleware with a single layer that
 * emits one structured log entry on completion (success or error).
 *
 * Captures: service, requestId, correlationId, method, path, status,
 * duration_ms, source, error.
 * Route handlers can enrich the log via c.set("logFields", { provider, ... }).
 *
 * - Production: single-line JSON (queryable by log aggregators)
 * - Development: human-readable prefix + artificial 100-500ms delay to surface
 *   unwanted waterfalls (mirrors tRPC timingMiddleware in @api/console)
 */
export const lifecycle = createMiddleware<{
  Variables: LifecycleVariables;
}>(async (c, next) => {
  c.set("logFields", {});
  const start = Date.now();

  // Dev-only artificial delay to simulate production network latency
  if (isDev) {
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  let error: string | null = null;

  try {
    await next();
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    const duration = Date.now() - start;
    const source = resolveSource(c);

    const entry: Record<string, unknown> = {
      service: "backfill",
      requestId: c.get("requestId"),
      correlationId: c.get("correlationId"),
      method: c.req.method,
      path: c.req.path,
      status: error ? 500 : c.res.status,
      duration_ms: duration,
      source,
      ...(error && { error }),
      ...c.get("logFields"),
    };

    if (isDev) {
      const prefix = (entry.status as number) >= 400 ? "!!!" : ">>>";
      let line = `${prefix} ${c.req.method} ${c.req.path} ${entry.status as number} ${duration}ms from ${source} [${c.get("requestId")}]`;
      if (error) {line += ` error="${error}"`;}
      console.log(line);
    }

    // Ship structured log to BetterStack (no-op in dev when token is absent)
    const level = error ? "error" : (entry.status as number) >= 400 ? "warn" : "info";
    log[level](`${c.req.method} ${c.req.path}`, entry);

    // Add breadcrumb for Sentry error correlation
    addBreadcrumb({
      category: "http",
      message: `${c.req.method} ${c.req.path} ${entry.status as number}`,
      level: error ? "error" : "info",
      data: {
        requestId: c.get("requestId"),
        duration_ms: duration,
        source,
      },
    });

    // Flush logs — non-blocking on Edge via waitUntil, blocking fallback on Node.js
    const flushPromise = log.flush();
    try {
      c.executionCtx.waitUntil(flushPromise);
    } catch {
      await flushPromise;
    }
  }
});
