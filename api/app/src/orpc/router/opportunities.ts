import {
  createOpportunity,
  getOpportunityById,
  markOpportunityFailed,
} from "@db/app";
import { db } from "@db/app/client";
import { ORPCError } from "@orpc/server";
import {
  apiContract,
  type CreateOpportunityInput,
  type GetOpportunityInput,
} from "@repo/api-contract";

import { boundOrg } from "../procedures";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const opportunitiesRouter = {
  create: boundOrg(apiContract.opportunities.create).handler(
    async ({ context, input }) => {
      const createInput = input as CreateOpportunityInput;
      const opportunity = await createOpportunity(db, {
        clerkOrgId: context.auth.identity.orgId,
        createdByApiKeyId: context.apiKeyId,
        createdByUserId: context.auth.identity.userId,
        input: createInput.input,
      });

      try {
        const { inngest } = await import("../../inngest/client");
        await inngest.send({
          name: "app/opportunity.created",
          data: {
            clerkOrgId: opportunity.clerkOrgId,
            opportunityId: opportunity.id,
          },
        });
      } catch (error) {
        await markOpportunityFailed(db, {
          id: opportunity.id,
          clerkOrgId: opportunity.clerkOrgId,
          errorCode: "INNGEST_ENQUEUE_FAILED",
          errorMessage: getErrorMessage(error),
        });
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "Failed to queue opportunity for classification.",
        });
      }

      return {
        id: opportunity.id,
        status: "queued" as const,
      };
    }
  ),

  get: boundOrg(apiContract.opportunities.get).handler(
    async ({ context, input }) => {
      const getInput = input as GetOpportunityInput;
      const opportunity = await getOpportunityById(db, {
        id: getInput.id,
        clerkOrgId: context.auth.identity.orgId,
      });

      if (!opportunity) {
        throw new ORPCError("NOT_FOUND", {
          message: "Opportunity not found.",
        });
      }

      return {
        id: opportunity.id,
        input: opportunity.input,
        status: opportunity.status,
        classification: opportunity.classification,
        createdAt: opportunity.createdAt,
        updatedAt: opportunity.updatedAt,
      };
    }
  ),
};
