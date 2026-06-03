import { and, desc, eq, inArray, lt, or, sql } from "drizzle-orm";
import type { Database } from "../client";
import {
  createProviderRoutineCallId,
  type ProviderRoutineCall,
  type ProviderRoutineCallCalledByKind,
  type ProviderRoutineCallProvider,
  type ProviderRoutineCallRedactedPayload,
  type ProviderRoutineCallSourceSurface,
  type ProviderRoutineCallStatus,
  orgProviderRoutineCalls as providerRoutineCalls,
} from "../schema";
import { getRowsAffected } from "./drizzle-results";

export interface CreateProviderRoutineCallInput {
  calledById: string;
  calledByKind: ProviderRoutineCallCalledByKind;
  calledByUserId?: string | null;
  clerkOrgId: string;
  inputRedacted?: ProviderRoutineCallRedactedPayload;
  provider: ProviderRoutineCallProvider;
  providerActorId?: string | null;
  providerAttempted?: boolean;
  providerConnectionId: number;
  providerToolName: string;
  providerWorkspaceId?: string | null;
  routineId: string;
  sourceClientId?: string | null;
  sourceRef?: string | null;
  sourceSurface: ProviderRoutineCallSourceSurface;
  startedAt?: Date;
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

function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

export interface ProviderRoutineCallCursor {
  createdAt: Date;
  id: number;
}

export interface ListProviderRoutineCallsResult {
  items: ProviderRoutineCall[];
  nextCursor: ProviderRoutineCallCursor | null;
}

export interface ListProviderRoutineCallsInput {
  clerkOrgId: string;
  cursor?: ProviderRoutineCallCursor | null;
  limit?: number;
  providers?: ProviderRoutineCallProvider[];
  search?: string;
  statuses?: ProviderRoutineCallStatus[];
}

export async function listProviderRoutineCalls(
  db: Database,
  input: ListProviderRoutineCallsInput
): Promise<ListProviderRoutineCallsResult> {
  const limit = normalizeLimit(input.limit);
  const search = input.search?.trim();
  const searchPattern = search ? `%${escapeLikePattern(search)}%` : undefined;
  const conditions = [
    eq(providerRoutineCalls.clerkOrgId, input.clerkOrgId),
    searchPattern
      ? or(
          sql`${providerRoutineCalls.routineId} like ${searchPattern} escape '\\\\'`,
          sql`${providerRoutineCalls.providerToolName} like ${searchPattern} escape '\\\\'`,
          sql`${providerRoutineCalls.calledById} like ${searchPattern} escape '\\\\'`
        )
      : undefined,
    input.providers?.length
      ? inArray(providerRoutineCalls.provider, input.providers)
      : undefined,
    input.statuses?.length
      ? inArray(providerRoutineCalls.status, input.statuses)
      : undefined,
    input.cursor
      ? or(
          lt(providerRoutineCalls.createdAt, input.cursor.createdAt),
          and(
            eq(providerRoutineCalls.createdAt, input.cursor.createdAt),
            lt(providerRoutineCalls.id, input.cursor.id)
          )
        )
      : undefined,
  ].filter(isDefined);

  const rows = await db
    .select()
    .from(providerRoutineCalls)
    .where(and(...conditions))
    .orderBy(
      desc(providerRoutineCalls.createdAt),
      desc(providerRoutineCalls.id)
    )
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

export async function createProviderRoutineCall(
  db: Database,
  input: CreateProviderRoutineCallInput
): Promise<ProviderRoutineCall> {
  const publicId = createProviderRoutineCallId();
  const startedAt = input.startedAt ?? new Date();

  await db
    .insert(providerRoutineCalls)
    .values({
      calledById: input.calledById,
      calledByKind: input.calledByKind,
      calledByUserId: input.calledByUserId ?? null,
      clerkOrgId: input.clerkOrgId,
      providerConnectionId: input.providerConnectionId,
      inputRedacted: input.inputRedacted ?? null,
      outputRedacted: null,
      provider: input.provider,
      providerActorId: input.providerActorId ?? null,
      providerAttempted: input.providerAttempted ?? false,
      providerToolName: input.providerToolName,
      providerWorkspaceId: input.providerWorkspaceId ?? null,
      publicId,
      routineId: input.routineId,
      sourceClientId: input.sourceClientId ?? null,
      sourceRef: input.sourceRef ?? null,
      sourceSurface: input.sourceSurface,
      startedAt,
      status: "running",
    })
    .$returningId();

  const call = await getProviderRoutineCallByPublicId(db, {
    clerkOrgId: input.clerkOrgId,
    publicId,
  });
  if (!call) {
    throw new Error(`Failed to create provider routine call ${publicId}`);
  }
  return call;
}

export async function markProviderRoutineCallProviderAttempted(
  db: Database,
  input: {
    clerkOrgId: string;
    publicId: string;
  }
): Promise<boolean> {
  const result = await db
    .update(providerRoutineCalls)
    .set({
      providerAttempted: true,
      updatedAt: new Date(),
    })
    .where(runningProviderRoutineCallWhere(input));

  return getRowsAffected(result) > 0;
}

export async function markProviderRoutineCallSucceeded(
  db: Database,
  input: {
    clerkOrgId: string;
    finishedAt?: Date;
    outputRedacted?: ProviderRoutineCallRedactedPayload;
    publicId: string;
  }
): Promise<boolean> {
  const finishedAt = input.finishedAt ?? new Date();
  const result = await db
    .update(providerRoutineCalls)
    .set({
      errorCode: null,
      errorMessage: null,
      finishedAt,
      outputRedacted: input.outputRedacted ?? null,
      status: "succeeded",
      updatedAt: finishedAt,
    })
    .where(runningProviderRoutineCallWhere(input));

  return getRowsAffected(result) > 0;
}

export async function markProviderRoutineCallFailed(
  db: Database,
  input: {
    clerkOrgId: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    finishedAt?: Date;
    publicId: string;
  }
): Promise<boolean> {
  const finishedAt = input.finishedAt ?? new Date();
  const result = await db
    .update(providerRoutineCalls)
    .set({
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      finishedAt,
      status: "failed",
      updatedAt: finishedAt,
    })
    .where(runningProviderRoutineCallWhere(input));

  return getRowsAffected(result) > 0;
}

async function getProviderRoutineCallByPublicId(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<ProviderRoutineCall | undefined> {
  const [row] = await db
    .select()
    .from(providerRoutineCalls)
    .where(
      and(
        eq(providerRoutineCalls.clerkOrgId, input.clerkOrgId),
        eq(providerRoutineCalls.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

function runningProviderRoutineCallWhere(input: {
  clerkOrgId: string;
  publicId: string;
}) {
  return and(
    eq(providerRoutineCalls.clerkOrgId, input.clerkOrgId),
    eq(providerRoutineCalls.publicId, input.publicId),
    eq(providerRoutineCalls.status, "running")
  );
}
