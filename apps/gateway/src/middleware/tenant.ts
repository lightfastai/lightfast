import type { MiddlewareHandler } from "hono";
import { createMiddleware } from "hono/factory";

export interface TenantVariables {
  orgId: string;
}

/**
 * Tenant middleware — extracts org_id from request headers or query params.
 *
 * Looks for org_id in:
 * 1. X-Org-Id header (for Console → Gateway API calls)
 * 2. Query param ?org_id (for OAuth callbacks)
 */
export const tenantMiddleware: MiddlewareHandler = createMiddleware<{
  Variables: TenantVariables;
}>(async (c, next) => {
  const orgId = c.req.header("X-Org-Id") ?? c.req.query("org_id");

  if (orgId) {
    c.set("orgId", orgId);
  }

  await next();
});
