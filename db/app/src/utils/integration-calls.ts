import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../client";
import {
  createIntegrationCallId,
  type IntegrationCall,
  type IntegrationCallCalledByKind,
  type IntegrationCallProvider,
  type IntegrationCallRedactedPayload,
  integrationCalls,
} from "../schema";
import { getRowsAffected } from "./drizzle-results";

export interface CreateIntegrationCallInput {
  calledById: string;
  calledByKind: IntegrationCallCalledByKind;
  calledByUserId?: string | null;
  clerkOrgId: string;
  connectorConnectionId: number;
  inputRedacted?: IntegrationCallRedactedPayload;
  provider: IntegrationCallProvider;
  providerActorId?: string | null;
  providerToolName: string;
  providerWorkspaceId?: string | null;
  routineName: string;
  startedAt?: Date;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return 50;
  }
  return Math.max(1, Math.min(Math.trunc(limit), 100));
}

export async function listIntegrationCalls(
  db: Database,
  input: { clerkOrgId: string; limit?: number }
): Promise<IntegrationCall[]> {
  const limit = normalizeLimit(input.limit);

  return db
    .select()
    .from(integrationCalls)
    .where(eq(integrationCalls.clerkOrgId, input.clerkOrgId))
    .orderBy(desc(integrationCalls.createdAt), desc(integrationCalls.id))
    .limit(limit);
}

export async function createIntegrationCall(
  db: Database,
  input: CreateIntegrationCallInput
): Promise<IntegrationCall> {
  const publicId = createIntegrationCallId();
  const startedAt = input.startedAt ?? new Date();

  await db
    .insert(integrationCalls)
    .values({
      calledById: input.calledById,
      calledByKind: input.calledByKind,
      calledByUserId: input.calledByUserId ?? null,
      clerkOrgId: input.clerkOrgId,
      connectorConnectionId: input.connectorConnectionId,
      inputRedacted: input.inputRedacted ?? null,
      outputRedacted: null,
      provider: input.provider,
      providerActorId: input.providerActorId ?? null,
      providerToolName: input.providerToolName,
      providerWorkspaceId: input.providerWorkspaceId ?? null,
      publicId,
      routineName: input.routineName,
      startedAt,
      status: "running",
    })
    .$returningId();

  const call = await getIntegrationCallByPublicId(db, {
    clerkOrgId: input.clerkOrgId,
    publicId,
  });
  if (!call) {
    throw new Error(`Failed to create integration call ${publicId}`);
  }
  return call;
}

export async function markIntegrationCallSucceeded(
  db: Database,
  input: {
    clerkOrgId: string;
    finishedAt?: Date;
    outputRedacted?: IntegrationCallRedactedPayload;
    publicId: string;
  }
): Promise<boolean> {
  const finishedAt = input.finishedAt ?? new Date();
  const result = await db
    .update(integrationCalls)
    .set({
      errorCode: null,
      errorMessage: null,
      finishedAt,
      outputRedacted: input.outputRedacted ?? null,
      status: "succeeded",
      updatedAt: finishedAt,
    })
    .where(runningIntegrationCallWhere(input));

  return getRowsAffected(result) > 0;
}

export async function markIntegrationCallFailed(
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
    .update(integrationCalls)
    .set({
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      finishedAt,
      status: "failed",
      updatedAt: finishedAt,
    })
    .where(runningIntegrationCallWhere(input));

  return getRowsAffected(result) > 0;
}

async function getIntegrationCallByPublicId(
  db: Database,
  input: { clerkOrgId: string; publicId: string }
): Promise<IntegrationCall | undefined> {
  const [row] = await db
    .select()
    .from(integrationCalls)
    .where(
      and(
        eq(integrationCalls.clerkOrgId, input.clerkOrgId),
        eq(integrationCalls.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

function runningIntegrationCallWhere(input: {
  clerkOrgId: string;
  publicId: string;
}) {
  return and(
    eq(integrationCalls.clerkOrgId, input.clerkOrgId),
    eq(integrationCalls.publicId, input.publicId),
    eq(integrationCalls.status, "running")
  );
}
