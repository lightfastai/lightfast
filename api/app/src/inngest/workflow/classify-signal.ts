import {
  claimSignalForClassification,
  getSignalByPublicId,
  markSignalClassified,
  markSignalFailed,
} from "@db/app";
import { db } from "@db/app/client";
import {
  buildSignalClassificationRequest,
  classifySignalInput,
  getSignalClassificationFailure,
} from "@repo/ai/signal-classifier";
import type {
  SignalClassification,
  SignalVisibilityScope,
} from "@repo/api-contract";
import { log } from "@vendor/observability/log/next";

import { env } from "../../env";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

function getVisibilityScope(
  classification: SignalClassification
): SignalVisibilityScope {
  return classification.routing.visibility.scope;
}

function requiresSignalReview(classification: SignalClassification): boolean {
  return (
    classification.routing.visibility.scope === "needs_review" &&
    classification.routing.review.required === true
  );
}

function shouldClassifyPeople(
  classification: SignalClassification | null
): boolean {
  return (
    classification?.schemaVersion === "signal.classification.v2" &&
    classification.disposition === "actionable" &&
    classification.routing.visibility.scope === "team" &&
    classification.routing.routes.people.shouldRun === true
  );
}

function classifiedResult(
  classification: SignalClassification,
  routedPeople: boolean
) {
  return {
    status: "classified",
    visibilityScope: getVisibilityScope(classification),
    reviewRequired: requiresSignalReview(classification),
    routedPeople,
  };
}

export const classifySignal = inngest.createFunction(
  {
    id: "classify-signal",
    idempotency: 'event.data.clerkOrgId + "-" + event.data.signalId',
    retries: 3,
    timeouts: {
      finish: "10m",
      start: "10m",
    },
    triggers: appEvents["app/signal.created"],
    onFailure: async ({ event, error, step }) => {
      const { clerkOrgId, signalId } = event.data.event.data;
      const failure = getSignalClassificationFailure(error);

      await step.run("mark signal failed after retries", () =>
        markSignalFailed(db, {
          clerkOrgId,
          errorCode: failure.errorCode,
          errorMessage: failure.errorMessage,
          publicId: signalId,
        })
      );

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

    if (signal.status === "classified" && signal.classification) {
      if (shouldClassifyPeople(signal.classification)) {
        await step.run("queue people classification", () =>
          inngest.send({
            name: "app/people.classification.requested",
            data: {
              clerkOrgId,
              signalId,
            },
          })
        );
        return classifiedResult(signal.classification, true);
      }

      return classifiedResult(signal.classification, false);
    }

    const claimed = await step.run("claim signal", () =>
      claimSignalForClassification(db, {
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!claimed) {
      return { status: "skipped" };
    }

    const classificationRequest = buildSignalClassificationRequest({
      clerkOrgId,
      deploymentEnvironment: env.VERCEL_ENV,
      input: signal.input,
      signalId,
    });
    const classification = await step.ai.wrap(
      "classify signal",
      (request) => classifySignalInput(request, { logger: log }),
      classificationRequest
    );

    const persisted = await step.run("persist signal classification", () =>
      markSignalClassified(db, {
        classification,
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!persisted) {
      return { status: "skipped" };
    }

    if (shouldClassifyPeople(classification)) {
      await step.run("queue people classification", () =>
        inngest.send({
          name: "app/people.classification.requested",
          data: {
            clerkOrgId,
            signalId,
          },
        })
      );

      return classifiedResult(classification, true);
    }

    return classifiedResult(classification, false);
  }
);
