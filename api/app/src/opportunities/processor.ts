import {
  type Database,
  getOpportunityById,
  markOpportunityClassified,
  markOpportunityFailed,
  markOpportunityProcessing,
} from "@db/app";

import { classifyOpportunityInput } from "./classifier";

export interface ProcessOpportunityClassificationInput {
  clerkOrgId: string;
  db: Database;
  opportunityId: string;
}

export type ProcessOpportunityClassificationResult =
  | { status: "classified" }
  | { status: "failed" }
  | { status: "missing" };

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export async function processOpportunityClassification(
  input: ProcessOpportunityClassificationInput
): Promise<ProcessOpportunityClassificationResult> {
  const opportunity = await getOpportunityById(input.db, {
    id: input.opportunityId,
    clerkOrgId: input.clerkOrgId,
  });

  if (!opportunity) {
    return { status: "missing" };
  }

  await markOpportunityProcessing(input.db, {
    id: input.opportunityId,
    clerkOrgId: input.clerkOrgId,
  });

  try {
    const classification = await classifyOpportunityInput(opportunity.input);
    await markOpportunityClassified(input.db, {
      id: input.opportunityId,
      clerkOrgId: input.clerkOrgId,
      classification,
    });
    return { status: "classified" };
  } catch (error) {
    await markOpportunityFailed(input.db, {
      id: input.opportunityId,
      clerkOrgId: input.clerkOrgId,
      errorCode: "CLASSIFICATION_FAILED",
      errorMessage: getErrorMessage(error),
    });
    return { status: "failed" };
  }
}
