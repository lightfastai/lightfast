import { backfillTriggerPayload } from "@repo/console-validation";
import { EventSchemas, Inngest } from "@vendor/inngest";
import { z } from "zod";

// Inline Zod v3-compatible depth schema (console-validation uses Zod v4)
const backfillDepthSchemaV3 = z.union([
  z.literal(7),
  z.literal(30),
  z.literal(90),
]);

import { env } from "../env.js";

const eventsMap = {
  "apps-backfill/run.requested": backfillTriggerPayload.extend({
    /** Cross-service correlation ID for distributed tracing */
    correlationId: z.string().optional(),
  }) as any,
  "apps-backfill/run.cancelled": z.object({
    /** Installation ID (matched by cancelOn) */
    installationId: z.string(),
    /** Cross-service correlation ID for distributed tracing */
    correlationId: z.string().optional(),
  }),
  "apps-backfill/entity.requested": z.object({
    /** Correlation ID — matches the orchestrator's trigger event */
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
      resourceName: z.string().nullable(),
    }),
    /** ISO timestamp — computed once by orchestrator */
    since: z.string().datetime(),
    /** Depth in days — for logging/context */
    depth: backfillDepthSchemaV3,
    /** When true, dispatch webhooks with X-Backfill-Hold header (held for batch replay) */
    holdForReplay: z.boolean().optional(),
    /** Cross-service correlation ID for distributed tracing */
    correlationId: z.string().optional(),
  }),
};

export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromSchema(eventsMap),
});
