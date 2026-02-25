import { EventSchemas, Inngest } from "@vendor/inngest";
import { z } from "zod";

import { env } from "../env";

const eventsMap = {
  "apps-backfill/run.requested": {
    data: z.object({
      /** Gateway installation ID (gw_installations.id) */
      installationId: z.string(),
      /** Provider name */
      provider: z.string(),
      /** Clerk organization ID */
      orgId: z.string(),
      /** Number of days to backfill */
      depth: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30),
      /** Entity types to backfill (defaults to connector's defaultEntityTypes) */
      entityTypes: z.array(z.string()).optional(),
    }),
  },
  "apps-backfill/run.cancelled": {
    data: z.object({
      /** Gateway installation ID (matched by cancelOn) */
      installationId: z.string(),
    }),
  },
  "apps-backfill/entity.requested": {
    data: z.object({
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
      depth: z.union([z.literal(7), z.literal(30), z.literal(90)]),
    }),
  },
  "apps-backfill/entity.completed": {
    data: z.object({
      installationId: z.string(),
      provider: z.string(),
      entityType: z.string(),
      resourceId: z.string(),
      success: z.boolean(),
      eventsProduced: z.number(),
      eventsDispatched: z.number(),
      pagesProcessed: z.number(),
      error: z.string().optional(),
    }),
  },
};

export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromZod(eventsMap),
});
