import { z } from "zod";

export const platformEvents = {
  // ── Health check signal ──
  "platform/health.check.requested": z.object({
    /** Installation ID of the connection whose token was revoked */
    installationId: z.string(),
    /** Provider name (e.g. "github", "linear") */
    provider: z.string(),
    /** Why the health check is being requested */
    reason: z.enum(["401_unauthorized"]),
    /** Cross-service correlation ID for distributed tracing */
    correlationId: z.string().max(128).optional(),
  }),
  // ── Connection lifecycle (teardown) ──
  "platform/connection.lifecycle": z.object({
    installationId: z.string(),
    orgId: z.string(),
    provider: z.string(),
    reason: z.string(),
    triggeredBy: z.enum(["health_check", "user", "system"]),
    correlationId: z.string().optional(),
  }),
};
