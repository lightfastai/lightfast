import { createHash } from "node:crypto";
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
  classifySignalInputLocally,
  getSignalClassificationFailure,
} from "@repo/ai/signal-classifier";
import type {
  SignalClassification,
  SignalVisibilityScope,
} from "@repo/api-contract";
import { normalizePersistedSignalClassification } from "@repo/api-contract";
import {
  SIGNAL_IDENTITY_CONTEXT_MAX_CHARS,
  type SignalClassificationMetadata,
} from "@repo/identity-contract";
import { log } from "@vendor/observability/log/next";

import { env } from "../../env";
import {
  formatOrgIdentitySystemSection,
  getOrgIdentityContext,
} from "../../services/identity";
import { inngest } from "../client";
import { appEvents } from "../schemas/app";

interface ClassifiedSignalDownstreamEvent {
  data: {
    clerkOrgId: string;
    signalId: string;
  };
  name:
    | "app/people.classification.requested"
    | "app/signal.entity-index.requested";
}

function getVisibilityScope(
  classification: SignalClassification
): SignalVisibilityScope {
  return classification.routing.visibility.scope;
}

function requiresSignalReview(classification: SignalClassification): boolean {
  const normalized = normalizePersistedSignalClassification(classification);
  return normalized?.routing.visibility.scope === "needs_review"
    ? normalized.routing.review.required === true
    : false;
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

function shouldIndexSignalEntities(
  classification: SignalClassification | null
): boolean {
  return (
    classification?.schemaVersion === "signal.classification.v2" &&
    classification.routing.visibility.scope !== "needs_review"
  );
}

function getClassifiedSignalDownstreamEvents(input: {
  classification: SignalClassification;
  clerkOrgId: string;
  signalId: string;
}): {
  routedPeople: boolean;
  events: ClassifiedSignalDownstreamEvent[];
} {
  const routedPeople = shouldClassifyPeople(input.classification);
  const events: ClassifiedSignalDownstreamEvent[] = [];

  if (routedPeople) {
    events.push({
      name: "app/people.classification.requested",
      data: {
        clerkOrgId: input.clerkOrgId,
        signalId: input.signalId,
      },
    });
  }

  if (shouldIndexSignalEntities(input.classification)) {
    events.push({
      name: "app/signal.entity-index.requested",
      data: {
        clerkOrgId: input.clerkOrgId,
        signalId: input.signalId,
      },
    });
  }

  return { events, routedPeople };
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

function shouldUseLocalSignalClassification(): boolean {
  return env.VERCEL_ENV === "development" && !process.env.AI_GATEWAY_API_KEY;
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
      const { events, routedPeople } = getClassifiedSignalDownstreamEvents({
        classification: signal.classification,
        clerkOrgId,
        signalId,
      });

      if (events.length > 0) {
        await step.sendEvent(
          "queue classified signal downstream workflows",
          events
        );
      }

      return classifiedResult(signal.classification, routedPeople);
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

    const identityContext = await step.run(
      "load organization identity context",
      () =>
        getOrgIdentityContext({
          clerkOrgId,
          maxChars: SIGNAL_IDENTITY_CONTEXT_MAX_CHARS,
          surface: "signal",
        })
    );
    const organizationIdentitySystemSection =
      formatOrgIdentitySystemSection(identityContext);

    const classification = shouldUseLocalSignalClassification()
      ? await step.run("classify signal locally", () =>
          classifySignalInputLocally({
            input: signal.input,
            signalId,
          })
        )
      : await step.ai.wrap(
          "classify signal",
          (request) => classifySignalInput(request, { logger: log }),
          buildSignalClassificationRequest({
            clerkOrgId,
            deploymentEnvironment: env.VERCEL_ENV,
            input: signal.input,
            organizationIdentitySystemSection,
            signalId,
          })
        );

    const persisted = await step.run("persist signal classification", () =>
      markSignalClassified(db, {
        classification,
        classificationMetadata: buildClassificationMetadata({
          identityProvenance: identityContext.provenance,
          organizationIdentitySystemSection,
        }),
        clerkOrgId,
        publicId: signalId,
      })
    );

    if (!persisted) {
      return { status: "skipped" };
    }

    const { events, routedPeople } = getClassifiedSignalDownstreamEvents({
      classification,
      clerkOrgId,
      signalId,
    });

    if (events.length > 0) {
      await step.sendEvent(
        "queue classified signal downstream workflows",
        events
      );
    }

    return classifiedResult(classification, routedPeople);
  }
);

function buildClassificationMetadata(input: {
  identityProvenance: NonNullable<
    SignalClassificationMetadata["organizationIdentity"]
  >;
  organizationIdentitySystemSection: string | null;
}): SignalClassificationMetadata {
  return {
    organizationIdentity: {
      ...input.identityProvenance,
      systemSectionHash: input.organizationIdentitySystemSection
        ? `sha256:${createHash("sha256")
            .update(input.organizationIdentitySystemSection)
            .digest("hex")}`
        : null,
    },
  };
}
