import type { SignalClassification } from "@repo/api-contract";
import { and, desc, eq, inArray, like, lt, or } from "drizzle-orm";

import type { Database } from "../client";
import { createSignalId, type Signal, signals } from "../schema";
import { getRowsAffected } from "./mysql";

export interface ListCursor {
  createdAt: Date;
  id: number;
}

export interface ListResult<T> {
  items: T[];
  nextCursor: ListCursor | null;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 50;
  }
  return Math.max(1, Math.min(Math.trunc(limit), 100));
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

export interface ListSignalsParams {
  clerkOrgId: string;
  cursor?: ListCursor | null;
  limit?: number;
  search?: string;
  status?: Signal["status"];
}

export async function listSignals(
  db: Database,
  input: ListSignalsParams
): Promise<ListResult<Signal>> {
  const limit = normalizeLimit(input.limit);
  const search = input.search?.trim();
  const conditions = [
    eq(signals.clerkOrgId, input.clerkOrgId),
    input.status ? eq(signals.status, input.status) : undefined,
    search
      ? or(
          like(signals.publicId, `%${search}%`),
          like(signals.input, `%${search}%`)
        )
      : undefined,
    input.cursor
      ? or(
          lt(signals.createdAt, input.cursor.createdAt),
          and(
            eq(signals.createdAt, input.cursor.createdAt),
            lt(signals.id, input.cursor.id)
          )
        )
      : undefined,
  ].filter(isDefined);

  const rows = await db
    .select()
    .from(signals)
    .where(and(...conditions))
    .orderBy(desc(signals.createdAt), desc(signals.id))
    .limit(limit + 1);

  const items = rows.slice(0, limit);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && lastItem
        ? { createdAt: lastItem.createdAt, id: lastItem.id }
        : null,
  };
}

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
