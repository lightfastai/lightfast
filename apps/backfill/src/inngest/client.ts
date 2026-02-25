import { EventSchemas, Inngest } from "inngest";
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
};

export const inngest = new Inngest({
  id: env.INNGEST_APP_NAME,
  eventKey: env.INNGEST_EVENT_KEY,
  signingKey: env.INNGEST_SIGNING_KEY,
  schemas: new EventSchemas().fromZod(eventsMap),
});
