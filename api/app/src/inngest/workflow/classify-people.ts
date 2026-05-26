import { getSignalByPublicId, upsertPeopleFromCandidates } from "@db/app";
import { db } from "@db/app/client";
import {
  buildPeopleClassificationRequest,
  classifyPeopleFromSignal,
  getPeopleClassificationFailure,
} from "@repo/ai/people-classifier";
import { log } from "@vendor/observability/log/next";

import { env } from "../../env";
import { inngest } from "../client";

export const classifyPeople = inngest.createFunction(
  {
    id: "classify-people",
    idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
    retries: 3,
    timeouts: {
      finish: "10m",
      start: "10m",
    },
    onFailure: async ({ event, error }) => {
      const { clerkOrgId, signalId } = event.data.event.data;
      const failure = getPeopleClassificationFailure(error);

      log.warn("[people] classification exhausted retries", {
        clerkOrgId,
        errorCode: failure.errorCode,
        errorMessage: failure.errorMessage,
        signalId,
      });

      return { status: "failed" };
    },
  },
  { event: "app/people.classification.requested" },
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

    if (signal.status !== "classified" || !signal.classification) {
      return { status: "skipped" };
    }

    const classificationRequest = buildPeopleClassificationRequest({
      classification: signal.classification,
      clerkOrgId,
      deploymentEnvironment: env.VERCEL_ENV,
      input: signal.input,
      signalId,
    });
    const classification = await step.ai.wrap(
      "classify people",
      (request) => classifyPeopleFromSignal(request, { logger: log }),
      classificationRequest
    );

    const people = await step.run("upsert people", () =>
      upsertPeopleFromCandidates(db, {
        clerkOrgId,
        candidates: classification.candidates.map((candidate) => ({
          displayName: candidate.displayName,
          identityProvider: candidate.identityProvider,
          identityType: candidate.identityType,
          identityValue: candidate.identityValue,
          metadata: {
            confidence: candidate.confidence,
            rationale: candidate.rationale,
            source: classification.schemaVersion,
          },
        })),
        sourceSignalId: signalId,
      })
    );

    return { people: people.length, status: "classified" };
  }
);
