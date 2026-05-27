import type { SignalClassification } from "@repo/api-contract";
import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "../client";
import { createSignalId, type Signal, signals } from "../schema";

export interface CreateSignalRecordInput {
  clerkOrgId: string;
  createdByApiKeyId: string;
  createdByUserId: string;
  input: string;
}

export async function createSignal(
  db: Database,
  input: CreateSignalRecordInput
): Promise<Signal> {
  const publicId = createSignalId();
  await db.insert(signals).values({
    publicId,
    clerkOrgId: input.clerkOrgId,
    createdByUserId: input.createdByUserId,
    createdByApiKeyId: input.createdByApiKeyId,
    input: input.input,
    status: "queued",
    classification: null,
  });

  const inserted = await getSignalByPublicId(db, {
    publicId,
    clerkOrgId: input.clerkOrgId,
  });
  if (!inserted) {
    throw new Error(`Failed to create signal ${publicId}`);
  }
  return inserted;
}

export interface GetSignalByPublicIdParams {
  clerkOrgId: string;
  publicId: string;
}

export async function getSignalByPublicId(
  db: Database,
  input: GetSignalByPublicIdParams
): Promise<Signal | undefined> {
  const [row] = await db
    .select()
    .from(signals)
    .where(
      and(
        eq(signals.publicId, input.publicId),
        eq(signals.clerkOrgId, input.clerkOrgId)
      )
    )
    .limit(1);
  return row;
}

export interface ClaimSignalForClassificationParams {
  clerkOrgId: string;
  publicId: string;
}

export async function claimSignalForClassification(
  db: Database,
  input: ClaimSignalForClassificationParams
): Promise<boolean> {
  const result = await db
    .update(signals)
    .set({
      status: "processing",
      errorCode: null,
      errorMessage: null,
      updatedAt: sql`CURRENT_TIMESTAMP(3)`,
    })
    .where(
      and(
        eq(signals.publicId, input.publicId),
        eq(signals.clerkOrgId, input.clerkOrgId),
        eq(signals.status, "queued")
      )
    );
  return getRowsAffected(result) > 0;
}

export interface MarkSignalClassifiedParams {
  classification: SignalClassification;
  clerkOrgId: string;
  publicId: string;
}

export async function markSignalClassified(
  db: Database,
  input: MarkSignalClassifiedParams
): Promise<boolean> {
  const result = await db
    .update(signals)
    .set({
      status: "classified",
      classification: input.classification,
      errorCode: null,
      errorMessage: null,
      updatedAt: sql`CURRENT_TIMESTAMP(3)`,
    })
    .where(
      and(
        eq(signals.publicId, input.publicId),
        eq(signals.clerkOrgId, input.clerkOrgId),
        eq(signals.status, "processing")
      )
    );
  return getRowsAffected(result) > 0;
}

export interface MarkSignalFailedParams {
  clerkOrgId: string;
  errorCode: string;
  errorMessage: string;
  publicId: string;
}

export async function markSignalFailed(
  db: Database,
  input: MarkSignalFailedParams
): Promise<boolean> {
  const result = await db
    .update(signals)
    .set({
      status: "failed",
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      updatedAt: sql`CURRENT_TIMESTAMP(3)`,
    })
    .where(
      and(
        eq(signals.publicId, input.publicId),
        eq(signals.clerkOrgId, input.clerkOrgId),
        inArray(signals.status, ["queued", "processing"])
      )
    );
  return getRowsAffected(result) > 0;
}

function getRowsAffected(result: unknown): number {
  if (result === null || typeof result !== "object") {
    return 0;
  }

  const { affectedRows, rowsAffected } = result as {
    affectedRows?: unknown;
    rowsAffected?: unknown;
  };

  if (typeof rowsAffected === "number") {
    return rowsAffected;
  }
  if (typeof affectedRows === "number") {
    return affectedRows;
  }
  return 0;
}
