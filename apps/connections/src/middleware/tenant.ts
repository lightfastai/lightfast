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
const ORG_ID_RE = /^[a-zA-Z0-9_-]{1,191}$/;

export const tenantMiddleware = createMiddleware<{
  Variables: TenantVariables;
}>(async (c, next) => {
  const orgId = c.req.header("X-Org-Id") ?? c.req.query("org_id");

  if (!orgId) {
    return c.json({ error: "missing_org_id" }, 400);
  }

  if (!ORG_ID_RE.test(orgId)) {
    return c.json({ error: "invalid_org_id" }, 400);
  }

  c.set("orgId", orgId);
  await next();
});
