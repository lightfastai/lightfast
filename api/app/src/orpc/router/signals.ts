import { getSignalByPublicId } from "@db/app";
import { db } from "@db/app/client";
import { ORPCError } from "@orpc/server";
import {
  apiContract,
  type CreateSignalInput,
  type GetSignalInput,
} from "@repo/api-contract";

import {
  createAndQueueSignal,
  isSignalCreateQueueError,
} from "../../signals/create-signal";
import { boundOrg } from "../procedures";

export const signalsRouter = {
  create: boundOrg(apiContract.signals.create).handler(
    async ({ context, input }) => {
      const createInput = input as CreateSignalInput;

      try {
        return await createAndQueueSignal(db, {
          clerkOrgId: context.auth.identity.orgId,
          createdByApiKeyId: context.apiKeyId,
          createdByUserId: context.auth.identity.userId,
          input: createInput.input,
        });
      } catch (error) {
        if (isSignalCreateQueueError(error)) {
          throw new ORPCError("INTERNAL_SERVER_ERROR", {
            message: error.message,
          });
        }
        throw error;
      }
    }
  ),

  get: boundOrg(apiContract.signals.get).handler(async ({ context, input }) => {
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
      createdAt: signal.createdAt.toISOString(),
      updatedAt: signal.updatedAt.toISOString(),
    };
  }),
};
