import { ingestEntityObservations } from "@db/app";
import { db } from "@db/app/client";

import { inngest } from "../client";
import { appEvents } from "../schemas/app";

const DEFAULT_RESOLVER_VERSION = "entity-resolution-v1";

export const runEntityResolution = inngest.createFunction(
  {
    id: "run-entity-resolution",
    idempotency: 'event.data.clerkOrgId + "-" + event.data.ingestionId',
    retries: 3,
    timeouts: {
      finish: "10m",
      start: "10m",
    },
    triggers: appEvents["app/connector.profile.observed"],
  },
  async ({ event, step }) => {
    const resolverVersion =
      event.data.resolverVersion ?? DEFAULT_RESOLVER_VERSION;

    const summary = await step.run("ingest entity observations", () =>
      ingestEntityObservations(db, {
        clerkOrgId: event.data.clerkOrgId,
        observations: event.data.observations,
        resolverVersion,
      })
    );

    await step.sendEvent("emit entity graph persisted", {
      name: "app/entity.graph.persisted",
      data: {
        ...summary,
        clerkOrgId: event.data.clerkOrgId,
        ingestionId: event.data.ingestionId,
        resolverVersion,
      },
    });

    return {
      ...summary,
      status: "persisted" as const,
    };
  }
);
