import { getSignalByPublicId, replaceSignalEntityLinks } from "@db/app";
import { db } from "@db/app/client";
import {
  buildSignalEntityLinkingRequest,
  classifySignalEntityLinks,
  extractDeterministicSignalEntityLinks,
  getSignalEntityLinkingFailure,
  mergeSignalEntityLinkCandidates,
} from "@repo/ai/signal-entity-linker";
import type { SignalClassification } from "@repo/api-contract";
import { log } from "@vendor/observability/log/next";

import { env } from "../../env";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

function shouldIndexSignalEntities(signal: {
  classification: SignalClassification | null;
  status: string;
  visibilityScope: string;
}): boolean {
  if (signal.status !== "classified" || !signal.classification) {
    return false;
  }

  return (
    signal.classification.schemaVersion === "signal.classification.v2" &&
    signal.classification.routing.visibility.scope === "team" &&
    signal.visibilityScope === "team"
  );
}

function shouldUseDeterministicOnlyEntityLinking(): boolean {
  return env.VERCEL_ENV === "development" && !process.env.AI_GATEWAY_API_KEY;
}

export const indexSignalEntities = inngest.createFunction(
  {
    id: "index-signal-entities",
    idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
    retries: 3,
    timeouts: {
      finish: "10m",
      start: "10m",
    },
    triggers: appEvents["app/signal.entity-index.requested"],
    onFailure: async ({ event, error }) => {
      const { clerkOrgId, signalId } = event.data.event.data;
      const failure = getSignalEntityLinkingFailure(error);

      log.warn("[entity-links] indexing exhausted retries", {
        clerkOrgId,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        signalId,
      });

      return { status: "failed" };
    },
  },
  async ({ event, step }) => {
    const { clerkOrgId, signalId } = event.data;

    const signal = await step.run("load signal", () =>
      getSignalByPublicId(db, {
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!signal) {
      return { status: "missing" };
    }

    if (!shouldIndexSignalEntities(signal)) {
      return { status: "skipped" };
    }

    const deterministicCandidates = await step.run(
      "extract deterministic entity links",
      () => extractDeterministicSignalEntityLinks({ input: signal.input })
    );

    const aiCandidates = shouldUseDeterministicOnlyEntityLinking()
      ? []
      : (
          await step.ai.wrap(
            "link signal entities",
            (linkingRequest) =>
              classifySignalEntityLinks(linkingRequest, { logger: log }),
            buildSignalEntityLinkingRequest({
              classification: signal.classification,
              clerkOrgId,
              deploymentEnvironment: env.VERCEL_ENV,
              deterministicCandidates,
              input: signal.input,
              signalId,
            })
          )
        ).candidates;

    const candidates = await step.run("merge entity link candidates", () =>
      mergeSignalEntityLinkCandidates({
        aiCandidates,
        deterministicCandidates,
        input: signal.input,
      })
    );

    const persisted = await step.run("persist entity links", () =>
      replaceSignalEntityLinks(db, {
        candidates,
        clerkOrgId,
        signalId,
      })
    );

    await step.sendEvent("queue signal entity enrichment", {
      name: "app/signal.entity-enrichment.requested",
      data: {
        clerkOrgId,
        reason: "signal_indexed" as const,
        signalId,
      },
    });

    return {
      status: "indexed",
      deterministicCandidates: deterministicCandidates.length,
      aiCandidates: aiCandidates.length,
      candidates: candidates.length,
      persistedLinks: persisted.links,
      resolvedLinks: persisted.resolved,
    };
  }
);
