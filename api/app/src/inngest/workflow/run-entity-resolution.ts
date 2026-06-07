import {
  ingestEntityObservations,
  projectEntityGraphPeopleToOrgPeople,
  reconcileSignalEntityLinksForPeople,
} from "@db/app";
import { db } from "@db/app/client";
import type { EntityObservation } from "@repo/entity-resolution";

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

    let projectedPeople = 0;
    let entityLinksResolved = 0;
    if (event.data.source?.kind === "signal_entity_enrichment") {
      const projected = await step.run("project entity graph people", () =>
        projectEntityGraphPeopleToOrgPeople(db, {
          clerkOrgId: event.data.clerkOrgId,
          resolverVersion,
          source: event.data.source,
          sourceIdentityKeys: sourceIdentityKeysForObservations(
            event.data.observations
          ),
        })
      );
      projectedPeople = projected.length;

      const reconciled = await step.run("reconcile signal entity links", () =>
        reconcileSignalEntityLinksForPeople(db, {
          clerkOrgId: event.data.clerkOrgId,
          people: projected,
        })
      );
      entityLinksResolved = reconciled.resolved;
    }

    await step.sendEvent("emit entity graph persisted", {
      name: "app/entity.graph.persisted",
      data: {
        ...summary,
        clerkOrgId: event.data.clerkOrgId,
        entityLinksResolved,
        ingestionId: event.data.ingestionId,
        projectedPeople,
        resolverVersion,
      },
    });

    return {
      ...summary,
      entityLinksResolved,
      projectedPeople,
      status: "persisted" as const,
    };
  }
);

function sourceIdentityKeysForObservations(
  observations: EntityObservation[]
): string[] {
  return Array.from(
    new Set(
      observations
        .map((observation) => {
          if (observation.provider === "x") {
            return sourceIdentityKey("x", observation.profile.username);
          }
          return sourceIdentityKey("github", observation.profile.login);
        })
        .filter((key): key is string => Boolean(key))
    )
  );
}

function sourceIdentityKey(
  provider: "github" | "x",
  value: string
): string | null {
  const normalized = value.trim().toLowerCase();
  return normalized ? `${provider}:handle:${normalized}` : null;
}
