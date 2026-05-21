import type { OpportunityClassification } from "@repo/api-contract";
import { and, eq } from "drizzle-orm";

import type { Database } from "../client";
import {
  createOpportunityId,
  type Opportunity,
  opportunities,
} from "../schema";

export interface CreateOpportunityInput {
  clerkOrgId: string;
  createdByApiKeyId: string;
  createdByUserId: string;
  input: string;
}

export async function createOpportunity(
  db: Database,
  input: CreateOpportunityInput
): Promise<Opportunity> {
  const id = createOpportunityId();
  await db.insert(opportunities).values({
    id,
    clerkOrgId: input.clerkOrgId,
    createdByUserId: input.createdByUserId,
    createdByApiKeyId: input.createdByApiKeyId,
    input: input.input,
    status: "queued",
    classification: null,
  });

  const inserted = await getOpportunityById(db, {
    id,
    clerkOrgId: input.clerkOrgId,
  });
  if (!inserted) {
    throw new Error(`Failed to create opportunity ${id}`);
  }
  return inserted;
}

export interface GetOpportunityByIdInput {
  clerkOrgId: string;
  id: string;
}

export async function getOpportunityById(
  db: Database,
  input: GetOpportunityByIdInput
): Promise<Opportunity | undefined> {
  const [row] = await db
    .select()
    .from(opportunities)
    .where(
      and(
        eq(opportunities.id, input.id),
        eq(opportunities.clerkOrgId, input.clerkOrgId)
      )
    )
    .limit(1);
  return row;
}

export interface MarkOpportunityProcessingInput {
  clerkOrgId: string;
  id: string;
}

export async function markOpportunityProcessing(
  db: Database,
  input: MarkOpportunityProcessingInput
): Promise<void> {
  await db
    .update(opportunities)
    .set({
      status: "processing",
      errorCode: null,
      errorMessage: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(opportunities.id, input.id),
        eq(opportunities.clerkOrgId, input.clerkOrgId)
      )
    );
}

export interface MarkOpportunityClassifiedInput {
  classification: OpportunityClassification;
  clerkOrgId: string;
  id: string;
}

export async function markOpportunityClassified(
  db: Database,
  input: MarkOpportunityClassifiedInput
): Promise<void> {
  await db
    .update(opportunities)
    .set({
      status: "classified",
      classification: input.classification,
      errorCode: null,
      errorMessage: null,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(opportunities.id, input.id),
        eq(opportunities.clerkOrgId, input.clerkOrgId)
      )
    );
}

export interface MarkOpportunityFailedInput {
  clerkOrgId: string;
  errorCode: string;
  errorMessage: string;
  id: string;
}

export async function markOpportunityFailed(
  db: Database,
  input: MarkOpportunityFailedInput
): Promise<void> {
  await db
    .update(opportunities)
    .set({
      status: "failed",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      updatedAt: new Date().toISOString(),
    })
    .where(
      and(
        eq(opportunities.id, input.id),
        eq(opportunities.clerkOrgId, input.clerkOrgId)
      )
    );
}
