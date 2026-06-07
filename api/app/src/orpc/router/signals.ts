import {
  getVisibleSignalByPublicId,
  listSignalEntityLinksForSignal,
} from "@db/app";
import { db } from "@db/app/client";
import { ORPCError } from "@orpc/server";
import {
  apiContract,
  type CreateSignalInput,
  type GetSignalInput,
} from "@repo/api-contract";

import { isSignalCreateQueueError } from "../../signals/create-signal";
import { createSignalForActor } from "../../signals/service";
import { boundOrg } from "../procedures";

export const signalsRouter = {
  create: boundOrg(apiContract.signals.create).handler(
    async ({ context, input }) => {
      const createInput = input as CreateSignalInput;
      try {
        return await createSignalForActor(db, {
          actor: {
            apiKeyId: context.apiKeyId,
            kind: "api_key",
            orgId: context.auth.identity.orgId,
            userId: context.auth.identity.userId,
          },
          input: createInput.input,
        });
      } catch (error) {
        if (!isSignalCreateQueueError(error)) {
          throw error;
        }
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: error.message,
          cause: error,
        });
      }
    }
  ),

  get: boundOrg(apiContract.signals.get).handler(async ({ context, input }) => {
    const getInput = input as GetSignalInput;
    const signal = await getVisibleSignalByPublicId(db, {
      publicId: getInput.id,
      clerkOrgId: context.auth.identity.orgId,
      createdByUserId: context.auth.identity.userId,
    });

    if (!signal) {
      throw new ORPCError("NOT_FOUND", {
        message: "Signal not found.",
      });
    }

    const entityLinks = await listSignalEntityLinksForSignal(db, {
      clerkOrgId: context.auth.identity.orgId,
      signalId: signal.publicId,
    });

    return {
      id: signal.publicId,
      input: signal.input,
      status: signal.status,
      classification: signal.classification,
      entityLinks,
      visibilityScope: signal.visibilityScope,
      createdAt: signal.createdAt.toISOString(),
      updatedAt: signal.updatedAt.toISOString(),
    };
  }),
};
