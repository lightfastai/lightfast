import { backfillDepthSchema } from "@repo/console-providers/client";
import { backfillTriggerPayload } from "@repo/console-providers/contracts";
import { EventSchemas, Inngest } from "@vendor/inngest";
import { z } from "zod";

import { env } from "../env.js";

const eventsMap = {
  "apps-backfill/run.requested": backfillTriggerPayload,
  "apps-backfill/run.cancelled": z.object({
    /** Installation ID (matched by cancelOn) */
    installationId: z.string(),
    /** Cross-service correlation ID for distributed tracing */
    correlationId: z.string().max(128).optional(),
  }),
  "apps-backfill/entity.requested": z.object({
    installationId: z.string(),
    /** Provider name */
    provider: z.string(),
    /** Clerk organization ID */
    orgId: z.string(),
    /** Single entity type for this work unit */
    entityType: z.string(),
    /** Single resource for this work unit */
    resource: z.object({
      providerResourceId: z.string(),
      resourceName: z.string(),
    }),
    /** ISO timestamp — computed once by orchestrator */
    since: z.string().datetime(),
    /** Depth in days — for logging/context */
    depth: backfillDepthSchema,
    /** When true, dispatch webhooks with X-Backfill-Hold header (held for batch replay) */
    holdForReplay: z.boolean().optional(),
    /** Cross-service correlation ID for distributed tracing */
    correlationId: z.string().max(128).optional(),
  }),
};

export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromSchema(eventsMap),
});
