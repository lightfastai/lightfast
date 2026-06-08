import { listSignalEntityIndexBackfillCandidates } from "@db/app";
import { db } from "@db/app/client";

import { env } from "../../env";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

const SIGNAL_ENTITY_BACKFILL_PAGE_LIMIT = 100;

export const backfillSignalEntityLinks = inngest.createFunction(
  {
    id: "backfill-signal-entity-links",
    idempotency: "event.id",
    retries: 1,
    timeouts: {
      finish: "10m",
      start: "2m",
    },
    triggers: appEvents["app/signal.entity-index.backfill.requested"],
  },
  async ({ event, step }) => {
    if ((event.data as { confirm?: unknown }).confirm !== "prod") {
      return {
        status: "skipped_missing_prod_confirmation",
      };
    }

    if (env.VERCEL_ENV !== "production") {
      return {
        deploymentEnvironment: env.VERCEL_ENV,
        status: "skipped_non_production",
      };
    }

    const { clerkOrgId, cursor } = event.data;
    const page = await step.run("list signal entity backfill candidates", () =>
      listSignalEntityIndexBackfillCandidates(db, {
        clerkOrgId,
        cursor: cursor ?? null,
        limit: SIGNAL_ENTITY_BACKFILL_PAGE_LIMIT,
      })
    );

    if (page.items.length > 0) {
      await step.sendEvent(
        "queue signal entity indexes",
        page.items.map((signal) => ({
          name: "app/signal.entity-index.requested" as const,
          data: {
            clerkOrgId,
            signalId: signal.publicId,
          },
        }))
      );
    }

    if (page.nextCursor) {
      await step.sendEvent("continue signal entity backfill", {
        name: "app/signal.entity-index.backfill.requested",
        data: {
          clerkOrgId,
          confirm: "prod",
          cursor: page.nextCursor,
        },
      });
    }

    return {
      nextCursor: page.nextCursor,
      signalsQueued: page.items.length,
      status: "queued",
    };
  }
);
