import {
  createSignal,
  getSignalByPublicId,
  markSignalFailed,
} from "@db/app";
import { db } from "@db/app/client";
import { ORPCError } from "@orpc/server";
import {
  apiContract,
  type CreateSignalInput,
  type GetSignalInput,
} from "@repo/api-contract";

import { boundOrg } from "../procedures";

const SIGNAL_ENQUEUE_FAILED_ERROR_CODE = "INNGEST_ENQUEUE_FAILED";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const signalsRouter = {
  create: boundOrg(apiContract.signals.create).handler(
    async ({ context, input }) => {
      const createInput = input as CreateSignalInput;
      const signal = await createSignal(db, {
        clerkOrgId: context.auth.identity.orgId,
        createdByApiKeyId: context.apiKeyId,
        createdByUserId: context.auth.identity.userId,
        input: createInput.input,
      });

      try {
        const { inngest } = await import("../../inngest/client");
        await inngest.send({
          name: "app/signal.created",
          data: {
            clerkOrgId: signal.clerkOrgId,
            signalId: signal.publicId,
          },
        });
      } catch (error) {
        await markSignalFailed(db, {
          publicId: signal.publicId,
          clerkOrgId: signal.clerkOrgId,
          errorCode: SIGNAL_ENQUEUE_FAILED_ERROR_CODE,
          errorMessage: getErrorMessage(error),
        });
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to queue signal for classification.",
        });
      }

      return {
        id: signal.publicId,
        status: "queued" as const,
      };
    }
  ),

  get: boundOrg(apiContract.signals.get).handler(
    async ({ context, input }) => {
      const getInput = input as GetSignalInput;
      const signal = await getSignalByPublicId(db, {
        publicId: getInput.id,
        clerkOrgId: context.auth.identity.orgId,
      });

      if (!signal) {
        throw new ORPCError("NOT_FOUND", {
          message: "Signal not found.",
        });
      }

      return {
        id: signal.publicId,
        input: signal.input,
        status: signal.status,
        classification: signal.classification,
        createdAt: signal.createdAt,
        updatedAt: signal.updatedAt,
      };
    }
  ),
};
