import { listSignalEntityEnrichmentTargets } from "@db/app";
import { db } from "@db/app/client";

import {
  fetchSignalEntityProfiles,
  githubUserPayloadToObservation,
  signalProfileObservationIds,
  xUserPayloadToObservation,
} from "../../services/entity-enrichment";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

export const enrichSignalEntities = inngest.createFunction(
  {
    id: "enrich-signal-entities",
    idempotency:
      'event.data.clerkOrgId + "-" + event.data.signalId + "-" + event.data.reason',
    retries: 3,
    timeouts: {
      finish: "10m",
      start: "10m",
    },
    triggers: appEvents["app/signal.entity-enrichment.requested"],
  },
  async ({ event, step }) => {
    const targets = await step.run("load enrichment targets", () =>
      listSignalEntityEnrichmentTargets(db, event.data)
    );

    if (targets.x.length === 0 && targets.github.length === 0) {
      return {
        reason: "no_targets" as const,
        status: "skipped" as const,
        targets,
      };
    }

    const fetched = await step.run("fetch provider profiles", () =>
      fetchSignalEntityProfiles({
        clerkOrgId: event.data.clerkOrgId,
        targets,
      })
    );
    const observations = await step.run("convert observations", () => {
      const observedAt = new Date();
      return [
        ...fetched.xPayloads.map((payload) =>
          xUserPayloadToObservation(payload, observedAt)
        ),
        ...fetched.githubPayloads.map((payload) =>
          githubUserPayloadToObservation(payload, observedAt)
        ),
      ].filter(isNonNullish);
    });

    if (observations.length === 0) {
      return {
        diagnostics: fetched.diagnostics,
        observations: 0,
        status: "skipped" as const,
        targets,
      };
    }

    const ids = signalProfileObservationIds({
      clerkOrgId: event.data.clerkOrgId,
      observations,
      signalId: event.data.signalId,
    });

    await step.sendEvent("emit profile observations", {
      id: ids.eventId,
      name: "app/connector.profile.observed",
      data: {
        clerkOrgId: event.data.clerkOrgId,
        ingestionId: ids.ingestionId,
        observations,
        resolverVersion: "signal-entity-enrichment-v1",
        source: {
          kind: "signal_entity_enrichment" as const,
          reason: event.data.reason,
          signalId: event.data.signalId,
        },
      },
    });

    return {
      diagnostics: fetched.diagnostics,
      observations: observations.length,
      status: "queued" as const,
    };
  }
);

function isNonNullish<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
