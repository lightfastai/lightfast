import { backfillDepthSchema } from "@repo/console-providers/client";
import { backfillTriggerPayload } from "@repo/console-providers/contracts";
import { z } from "zod";

export const backfillEvents = {
  "backfill/run.requested": backfillTriggerPayload,
  "backfill/run.cancelled": z.object({
    installationId: z.string(),
    correlationId: z.string().max(128).optional(),
  }),
  "backfill/connection.health.check.requested": z.object({
    /** Installation ID of the connection whose token was revoked */
    installationId: z.string(),
    /** Provider name (e.g. "github", "linear") */
    provider: z.string(),
    /** Why the health check is being requested */
    reason: z.enum(["401_unauthorized"]),
    /** Cross-service correlation ID for distributed tracing */
    correlationId: z.string().max(128).optional(),
  }),
  "backfill/entity.requested": z.object({
    installationId: z.string(),
    provider: z.string(),
    orgId: z.string(),
    entityType: z.string(),
    resource: z.object({
      providerResourceId: z.string(),
      resourceName: z.string(),
    }),
    since: z.string().datetime(),
    depth: backfillDepthSchema,
    holdForReplay: z.boolean().optional(),
    correlationId: z.string().max(128).optional(),
  }),
};
