import { and, eq } from "drizzle-orm";
import type { UserConnectorProvider } from "@repo/connector-contract";
import type { Database } from "../client";
import {
  createUserConnectorToolCallId,
  type UserConnectorToolCall,
  type UserConnectorToolCallRedactedPayload,
  type UserConnectorToolCallSourceSurface,
  userConnectorToolCalls,
} from "../schema";
import { getRowsAffected } from "./drizzle-results";

export interface CreateUserConnectorToolCallInput {
  calledByUserId: string;
  clerkOrgId?: string | null;
  inputRedacted?: UserConnectorToolCallRedactedPayload;
  provider: UserConnectorProvider;
  providerConnectionId: number;
  providerToolName: string;
  routineId: string;
  sourceRef?: string | null;
  sourceSurface: UserConnectorToolCallSourceSurface;
  startedAt?: Date;
}

export async function createUserConnectorToolCall(
  db: Database,
  input: CreateUserConnectorToolCallInput
): Promise<UserConnectorToolCall> {
  const publicId = createUserConnectorToolCallId();
  const startedAt = input.startedAt ?? new Date();

  await db
    .insert(userConnectorToolCalls)
    .values({
      calledByUserId: input.calledByUserId,
      clerkOrgId: input.clerkOrgId ?? null,
      inputRedacted: input.inputRedacted ?? null,
      outputRedacted: null,
      provider: input.provider,
      providerAttempted: false,
      providerConnectionId: input.providerConnectionId,
      providerToolName: input.providerToolName,
      publicId,
      routineId: input.routineId,
      sourceRef: input.sourceRef ?? null,
      sourceSurface: input.sourceSurface,
      startedAt,
      status: "running",
    })
    .$returningId();

  const call = await getUserConnectorToolCallByPublicId(db, {
    calledByUserId: input.calledByUserId,
    publicId,
  });
  if (!call) {
    throw new Error(`Failed to create user connector tool call ${publicId}`);
  }
  return call;
}

export async function markUserConnectorToolCallProviderAttempted(
  db: Database,
  input: {
    calledByUserId: string;
    publicId: string;
  }
): Promise<boolean> {
  const result = await db
    .update(userConnectorToolCalls)
    .set({
      providerAttempted: true,
      updatedAt: new Date(),
    })
    .where(runningUserConnectorToolCallWhere(input));

  return getRowsAffected(result) > 0;
}

export async function markUserConnectorToolCallSucceeded(
  db: Database,
  input: {
    calledByUserId: string;
    finishedAt?: Date;
    outputRedacted?: UserConnectorToolCallRedactedPayload;
    publicId: string;
  }
): Promise<boolean> {
  const finishedAt = input.finishedAt ?? new Date();
  const result = await db
    .update(userConnectorToolCalls)
    .set({
      errorCode: null,
      errorMessage: null,
      finishedAt,
      outputRedacted: input.outputRedacted ?? null,
      status: "succeeded",
      updatedAt: finishedAt,
    })
    .where(runningUserConnectorToolCallWhere(input));

  return getRowsAffected(result) > 0;
}

export async function markUserConnectorToolCallFailed(
  db: Database,
  input: {
    calledByUserId: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    finishedAt?: Date;
    publicId: string;
  }
): Promise<boolean> {
  const finishedAt = input.finishedAt ?? new Date();
  const result = await db
    .update(userConnectorToolCalls)
    .set({
      errorCode: input.errorCode ?? null,
      errorMessage: input.errorMessage ?? null,
      finishedAt,
      status: "failed",
      updatedAt: finishedAt,
    })
    .where(runningUserConnectorToolCallWhere(input));

  return getRowsAffected(result) > 0;
}

async function getUserConnectorToolCallByPublicId(
  db: Database,
  input: { calledByUserId: string; publicId: string }
): Promise<UserConnectorToolCall | undefined> {
  const [row] = await db
    .select()
    .from(userConnectorToolCalls)
    .where(
      and(
        eq(userConnectorToolCalls.calledByUserId, input.calledByUserId),
        eq(userConnectorToolCalls.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

function runningUserConnectorToolCallWhere(input: {
  calledByUserId: string;
  publicId: string;
}) {
  return and(
    eq(userConnectorToolCalls.calledByUserId, input.calledByUserId),
    eq(userConnectorToolCalls.publicId, input.publicId),
    eq(userConnectorToolCalls.status, "running")
  );
}
