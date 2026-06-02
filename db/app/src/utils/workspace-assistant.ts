import { and, desc, eq, isNull, lt, ne, or, sql } from "drizzle-orm";

import type { Database } from "../client";
import {
  createWorkspaceAssistantConversationId,
  createWorkspaceAssistantGenerationId,
  createWorkspaceAssistantMessageId,
  type InsertWorkspaceAssistantGeneration,
  type InsertWorkspaceAssistantMessage,
  type WorkspaceAssistantConversation,
  type WorkspaceAssistantGeneration,
  type WorkspaceAssistantGenerationStatus,
  type WorkspaceAssistantGenerationUsage,
  type WorkspaceAssistantMessage,
  type WorkspaceAssistantMessagePart,
  type WorkspaceAssistantMessageRole,
  type WorkspaceAssistantMessageStatus,
  type WorkspaceAssistantRecordMetadata,
  workspaceAssistantConversations,
  workspaceAssistantGenerations,
  workspaceAssistantMessages,
} from "../schema";
import { getRowsAffected, isDuplicateKeyError } from "./drizzle-results";

const MAX_LIST_LIMIT = 100;
const DEFAULT_LIST_LIMIT = 50;
const TITLE_LENGTH = 160;
const MAX_APPEND_ATTEMPTS = 5;

export interface WorkspaceAssistantConversationCursor {
  id: number;
  updatedAt: Date;
}

export interface WorkspaceAssistantListResult<T, C> {
  items: T[];
  nextCursor: C | null;
}

function normalizeLimit(limit: number | undefined): number {
  if (typeof limit !== "number" || !Number.isFinite(limit)) {
    return DEFAULT_LIST_LIMIT;
  }
  return Math.max(1, Math.min(Math.trunc(limit), MAX_LIST_LIMIT));
}

function normalizeTitle(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed.slice(0, TITLE_LENGTH) : null;
}

function titleFromParts(parts: WorkspaceAssistantMessagePart[]): string | null {
  const text = parts.find((part) => part.type === "text")?.text;
  return typeof text === "string" ? normalizeTitle(text) : null;
}

export interface CreateWorkspaceAssistantConversationInput {
  clerkOrgId: string;
  createdByUserId: string;
  metadata?: WorkspaceAssistantRecordMetadata;
  publicId?: string;
  title?: string | null;
}

export async function createWorkspaceAssistantConversation(
  db: Database,
  input: CreateWorkspaceAssistantConversationInput
): Promise<WorkspaceAssistantConversation> {
  const publicId = input.publicId ?? createWorkspaceAssistantConversationId();

  await db.insert(workspaceAssistantConversations).values({
    clerkOrgId: input.clerkOrgId,
    createdByUserId: input.createdByUserId,
    metadata: input.metadata,
    publicId,
    title: normalizeTitle(input.title),
  });

  const inserted = await getWorkspaceAssistantConversationByPublicId(db, {
    clerkOrgId: input.clerkOrgId,
    createdByUserId: input.createdByUserId,
    publicId,
  });
  if (!inserted) {
    throw new Error(
      `Failed to create workspace assistant conversation ${publicId}`
    );
  }
  return inserted;
}

export interface GetWorkspaceAssistantConversationByPublicIdInput {
  clerkOrgId: string;
  createdByUserId: string;
  publicId: string;
}

export async function getWorkspaceAssistantConversationByPublicId(
  db: Database,
  input: GetWorkspaceAssistantConversationByPublicIdInput
): Promise<WorkspaceAssistantConversation | undefined> {
  const [row] = await db
    .select()
    .from(workspaceAssistantConversations)
    .where(
      and(
        eq(workspaceAssistantConversations.clerkOrgId, input.clerkOrgId),
        eq(
          workspaceAssistantConversations.createdByUserId,
          input.createdByUserId
        ),
        eq(workspaceAssistantConversations.publicId, input.publicId),
        ne(workspaceAssistantConversations.status, "deleted")
      )
    )
    .limit(1);
  return row;
}

export interface ListWorkspaceAssistantConversationsInput {
  clerkOrgId: string;
  createdByUserId: string;
  cursor?: WorkspaceAssistantConversationCursor | null;
  limit?: number;
}

export async function listWorkspaceAssistantConversations(
  db: Database,
  input: ListWorkspaceAssistantConversationsInput
): Promise<
  WorkspaceAssistantListResult<
    WorkspaceAssistantConversation,
    WorkspaceAssistantConversationCursor
  >
> {
  const limit = normalizeLimit(input.limit);
  const rows = await db
    .select()
    .from(workspaceAssistantConversations)
    .where(
      and(
        eq(workspaceAssistantConversations.clerkOrgId, input.clerkOrgId),
        eq(
          workspaceAssistantConversations.createdByUserId,
          input.createdByUserId
        ),
        ne(workspaceAssistantConversations.status, "deleted"),
        input.cursor
          ? or(
              lt(
                workspaceAssistantConversations.updatedAt,
                input.cursor.updatedAt
              ),
              and(
                eq(
                  workspaceAssistantConversations.updatedAt,
                  input.cursor.updatedAt
                ),
                lt(workspaceAssistantConversations.id, input.cursor.id)
              )
            )
          : undefined
      )
    )
    .orderBy(
      desc(workspaceAssistantConversations.updatedAt),
      desc(workspaceAssistantConversations.id)
    )
    .limit(limit + 1);

  const items = rows.slice(0, limit);
  const lastItem = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && lastItem
        ? { id: lastItem.id, updatedAt: lastItem.updatedAt }
        : null,
  };
}

export interface AppendWorkspaceAssistantMessageInput {
  conversation: WorkspaceAssistantConversation;
  createdByUserId: string;
  idempotencyKey?: string;
  metadata?: WorkspaceAssistantRecordMetadata;
  parts: WorkspaceAssistantMessagePart[];
  publicId?: string;
  role: WorkspaceAssistantMessageRole;
  status?: WorkspaceAssistantMessageStatus;
}

export async function appendWorkspaceAssistantMessage(
  db: Database,
  input: AppendWorkspaceAssistantMessageInput
): Promise<WorkspaceAssistantMessage> {
  if (input.createdByUserId !== input.conversation.createdByUserId) {
    throw new Error(
      "Cannot append workspace assistant message to a conversation owned by another user."
    );
  }

  const publicId = input.publicId ?? createWorkspaceAssistantMessageId();
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);

  if (idempotencyKey) {
    const existing = await getWorkspaceAssistantMessageByIdempotencyKey(db, {
      clerkOrgId: input.conversation.clerkOrgId,
      createdByUserId: input.createdByUserId,
      idempotencyKey,
      conversationId: input.conversation.id,
    });
    if (
      isRecoverableMessageDuplicate(existing, {
        idempotencyKey,
        publicId,
        conversationId: input.conversation.id,
      })
    ) {
      return existing;
    }
  }

  for (let attempt = 0; attempt < MAX_APPEND_ATTEMPTS; attempt++) {
    const sequence = await getNextMessageSequence(db, input.conversation.id);

    try {
      await db.insert(workspaceAssistantMessages).values({
        conversationId: input.conversation.id,
        conversationPublicId: input.conversation.publicId,
        clerkOrgId: input.conversation.clerkOrgId,
        createdByUserId: input.createdByUserId,
        idempotencyKey,
        metadata: input.metadata,
        parts: input.parts,
        publicId,
        role: input.role,
        sequence,
        status: input.status ?? "completed",
      } satisfies InsertWorkspaceAssistantMessage);
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }

      const existing =
        (idempotencyKey
          ? await getWorkspaceAssistantMessageByIdempotencyKey(db, {
              clerkOrgId: input.conversation.clerkOrgId,
              createdByUserId: input.createdByUserId,
              idempotencyKey,
              conversationId: input.conversation.id,
            })
          : undefined) ??
        (await getWorkspaceAssistantMessageByPublicId(db, {
          clerkOrgId: input.conversation.clerkOrgId,
          createdByUserId: input.createdByUserId,
          publicId,
        }));
      if (
        isRecoverableMessageDuplicate(existing, {
          idempotencyKey,
          publicId,
          conversationId: input.conversation.id,
        })
      ) {
        return existing;
      }

      if (attempt === MAX_APPEND_ATTEMPTS - 1) {
        throw error;
      }
      continue;
    }

    const inserted =
      (idempotencyKey
        ? await getWorkspaceAssistantMessageByIdempotencyKey(db, {
            clerkOrgId: input.conversation.clerkOrgId,
            createdByUserId: input.createdByUserId,
            idempotencyKey,
            conversationId: input.conversation.id,
          })
        : undefined) ??
      (await getWorkspaceAssistantMessageByPublicId(db, {
        clerkOrgId: input.conversation.clerkOrgId,
        createdByUserId: input.createdByUserId,
        publicId,
      }));
    if (!inserted) {
      throw new Error(
        `Failed to append workspace assistant message ${publicId}`
      );
    }

    await touchConversationAfterMessage(db, input.conversation, inserted);
    return inserted;
  }

  throw new Error(`Failed to append workspace assistant message ${publicId}`);
}

async function touchConversationAfterMessage(
  db: Database,
  conversation: WorkspaceAssistantConversation,
  message: WorkspaceAssistantMessage
) {
  await db
    .update(workspaceAssistantConversations)
    .set({
      lastMessageAt: message.createdAt,
      lastMessageId: message.id,
      title:
        conversation.title ??
        (message.role === "user" ? titleFromParts(message.parts) : undefined),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceAssistantConversations.id, conversation.id),
        eq(workspaceAssistantConversations.clerkOrgId, conversation.clerkOrgId),
        eq(
          workspaceAssistantConversations.createdByUserId,
          conversation.createdByUserId
        )
      )
    );
}

async function getNextMessageSequence(
  db: Database,
  conversationId: number
): Promise<number> {
  const [row] = await db
    .select({
      sequence: sql<number>`coalesce(max(${workspaceAssistantMessages.sequence}), -1)`,
    })
    .from(workspaceAssistantMessages)
    .where(eq(workspaceAssistantMessages.conversationId, conversationId))
    .limit(1);

  const current = Number(row?.sequence ?? -1);
  return current + 1;
}

export interface GetWorkspaceAssistantMessageByPublicIdInput {
  clerkOrgId: string;
  createdByUserId: string;
  publicId: string;
}

export async function getWorkspaceAssistantMessageByPublicId(
  db: Database,
  input: GetWorkspaceAssistantMessageByPublicIdInput
): Promise<WorkspaceAssistantMessage | undefined> {
  const [row] = await db
    .select()
    .from(workspaceAssistantMessages)
    .where(
      and(
        eq(workspaceAssistantMessages.clerkOrgId, input.clerkOrgId),
        eq(workspaceAssistantMessages.createdByUserId, input.createdByUserId),
        eq(workspaceAssistantMessages.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

export interface GetWorkspaceAssistantMessageByIdempotencyKeyInput {
  clerkOrgId: string;
  conversationId: number;
  createdByUserId: string;
  idempotencyKey: string;
}

export async function getWorkspaceAssistantMessageByIdempotencyKey(
  db: Database,
  input: GetWorkspaceAssistantMessageByIdempotencyKeyInput
): Promise<WorkspaceAssistantMessage | undefined> {
  const [row] = await db
    .select()
    .from(workspaceAssistantMessages)
    .where(
      and(
        eq(workspaceAssistantMessages.clerkOrgId, input.clerkOrgId),
        eq(workspaceAssistantMessages.createdByUserId, input.createdByUserId),
        eq(workspaceAssistantMessages.conversationId, input.conversationId),
        eq(workspaceAssistantMessages.idempotencyKey, input.idempotencyKey)
      )
    )
    .limit(1);
  return row;
}

export interface ListWorkspaceAssistantMessagesInput {
  clerkOrgId: string;
  conversation: WorkspaceAssistantConversation;
  createdByUserId: string;
}

export async function listWorkspaceAssistantMessages(
  db: Database,
  input: ListWorkspaceAssistantMessagesInput
): Promise<WorkspaceAssistantMessage[]> {
  return db
    .select()
    .from(workspaceAssistantMessages)
    .where(
      and(
        eq(workspaceAssistantMessages.clerkOrgId, input.clerkOrgId),
        eq(workspaceAssistantMessages.createdByUserId, input.createdByUserId),
        eq(workspaceAssistantMessages.conversationId, input.conversation.id)
      )
    )
    .orderBy(
      workspaceAssistantMessages.sequence,
      workspaceAssistantMessages.id
    );
}

export interface MarkWorkspaceAssistantMessageCompletedInput {
  clerkOrgId: string;
  createdByUserId: string;
  parts: WorkspaceAssistantMessagePart[];
  publicId: string;
}

export async function markWorkspaceAssistantMessageCompleted(
  db: Database,
  input: MarkWorkspaceAssistantMessageCompletedInput
): Promise<WorkspaceAssistantMessage | undefined> {
  await db
    .update(workspaceAssistantMessages)
    .set({
      errorCode: null,
      errorMessage: null,
      parts: input.parts,
      status: "completed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceAssistantMessages.clerkOrgId, input.clerkOrgId),
        eq(workspaceAssistantMessages.createdByUserId, input.createdByUserId),
        eq(workspaceAssistantMessages.publicId, input.publicId)
      )
    );
  return getWorkspaceAssistantMessageByPublicId(db, input);
}

export interface MarkWorkspaceAssistantMessageFailedInput {
  clerkOrgId: string;
  createdByUserId: string;
  errorCode: string;
  errorMessage: string;
  publicId: string;
}

export async function markWorkspaceAssistantMessageFailed(
  db: Database,
  input: MarkWorkspaceAssistantMessageFailedInput
): Promise<WorkspaceAssistantMessage | undefined> {
  await db
    .update(workspaceAssistantMessages)
    .set({
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      status: "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceAssistantMessages.clerkOrgId, input.clerkOrgId),
        eq(workspaceAssistantMessages.createdByUserId, input.createdByUserId),
        eq(workspaceAssistantMessages.publicId, input.publicId)
      )
    );
  return getWorkspaceAssistantMessageByPublicId(db, input);
}

export interface CreateWorkspaceAssistantGenerationInput {
  assistantMessage: WorkspaceAssistantMessage;
  conversation: WorkspaceAssistantConversation;
  model: string;
  publicId?: string;
  requestedByUserId: string;
  requestMetadata?: WorkspaceAssistantRecordMetadata;
  status?: WorkspaceAssistantGenerationStatus;
}

export async function createWorkspaceAssistantGeneration(
  db: Database,
  input: CreateWorkspaceAssistantGenerationInput
): Promise<WorkspaceAssistantGeneration> {
  if (input.requestedByUserId !== input.conversation.createdByUserId) {
    throw new Error(
      "Cannot create generation for a conversation owned by another user."
    );
  }
  if (input.assistantMessage.createdByUserId !== input.requestedByUserId) {
    throw new Error(
      "Cannot create generation for a message owned by another user."
    );
  }
  if (input.assistantMessage.clerkOrgId !== input.conversation.clerkOrgId) {
    throw new Error(
      "Cannot create generation for an assistant message from another organization."
    );
  }
  if (
    input.assistantMessage.conversationId !== input.conversation.id ||
    input.assistantMessage.conversationPublicId !== input.conversation.publicId
  ) {
    throw new Error(
      "Cannot create generation for an assistant message from another workspace assistant conversation."
    );
  }
  if (input.assistantMessage.role !== "assistant") {
    throw new Error(
      "Cannot create generation for a message that is not an assistant message."
    );
  }

  const publicId = input.publicId ?? createWorkspaceAssistantGenerationId();
  const now = new Date();

  await db
    .insert(workspaceAssistantGenerations)
    .values({
      assistantMessageId: input.assistantMessage.id,
      assistantMessagePublicId: input.assistantMessage.publicId,
      conversationId: input.conversation.id,
      clerkOrgId: input.conversation.clerkOrgId,
      model: input.model,
      publicId,
      requestedByUserId: input.requestedByUserId,
      requestMetadata: input.requestMetadata,
      startedAt: now,
      status: input.status ?? "streaming",
    } satisfies InsertWorkspaceAssistantGeneration)
    .catch((error: unknown) => {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
    });

  const inserted = await getWorkspaceAssistantGenerationByAssistantMessageId(
    db,
    {
      assistantMessageId: input.assistantMessage.id,
      clerkOrgId: input.conversation.clerkOrgId,
      requestedByUserId: input.requestedByUserId,
    }
  );
  if (!inserted) {
    throw new Error(
      `Failed to create workspace assistant generation ${publicId}`
    );
  }
  return inserted;
}

export interface GetWorkspaceAssistantGenerationByPublicIdInput {
  clerkOrgId: string;
  publicId: string;
  requestedByUserId: string;
}

export interface GetWorkspaceAssistantGenerationByAssistantMessageIdInput {
  assistantMessageId: number;
  clerkOrgId: string;
  requestedByUserId: string;
}

export async function getWorkspaceAssistantGenerationByAssistantMessageId(
  db: Database,
  input: GetWorkspaceAssistantGenerationByAssistantMessageIdInput
): Promise<WorkspaceAssistantGeneration | undefined> {
  const [row] = await db
    .select()
    .from(workspaceAssistantGenerations)
    .where(
      and(
        eq(
          workspaceAssistantGenerations.assistantMessageId,
          input.assistantMessageId
        ),
        eq(workspaceAssistantGenerations.clerkOrgId, input.clerkOrgId),
        eq(
          workspaceAssistantGenerations.requestedByUserId,
          input.requestedByUserId
        )
      )
    )
    .limit(1);
  return row;
}

export async function getWorkspaceAssistantGenerationByPublicId(
  db: Database,
  input: GetWorkspaceAssistantGenerationByPublicIdInput
): Promise<WorkspaceAssistantGeneration | undefined> {
  const [row] = await db
    .select()
    .from(workspaceAssistantGenerations)
    .where(
      and(
        eq(workspaceAssistantGenerations.clerkOrgId, input.clerkOrgId),
        eq(
          workspaceAssistantGenerations.requestedByUserId,
          input.requestedByUserId
        ),
        eq(workspaceAssistantGenerations.publicId, input.publicId)
      )
    )
    .limit(1);
  return row;
}

export interface MarkWorkspaceAssistantGenerationCompletedInput {
  clerkOrgId: string;
  finishReason: string | null | undefined;
  providerMetadata?: WorkspaceAssistantRecordMetadata;
  publicId: string;
  requestedByUserId: string;
  usage?: WorkspaceAssistantGenerationUsage | null;
}

export async function markWorkspaceAssistantGenerationCompleted(
  db: Database,
  input: MarkWorkspaceAssistantGenerationCompletedInput
): Promise<WorkspaceAssistantGeneration | undefined> {
  await db
    .update(workspaceAssistantGenerations)
    .set({
      finishReason: input.finishReason ?? null,
      finishedAt: new Date(),
      providerMetadata: input.providerMetadata,
      status: "completed",
      updatedAt: new Date(),
      usage: input.usage ?? null,
    })
    .where(
      and(
        eq(workspaceAssistantGenerations.clerkOrgId, input.clerkOrgId),
        eq(
          workspaceAssistantGenerations.requestedByUserId,
          input.requestedByUserId
        ),
        eq(workspaceAssistantGenerations.publicId, input.publicId)
      )
    );
  return getWorkspaceAssistantGenerationByPublicId(db, input);
}

export interface MarkWorkspaceAssistantGenerationFailedInput {
  clerkOrgId: string;
  errorCode: string;
  errorMessage: string;
  publicId: string;
  requestedByUserId: string;
}

export async function markWorkspaceAssistantGenerationFailed(
  db: Database,
  input: MarkWorkspaceAssistantGenerationFailedInput
): Promise<WorkspaceAssistantGeneration | undefined> {
  await db
    .update(workspaceAssistantGenerations)
    .set({
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      finishedAt: new Date(),
      status: "failed",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceAssistantGenerations.clerkOrgId, input.clerkOrgId),
        eq(
          workspaceAssistantGenerations.requestedByUserId,
          input.requestedByUserId
        ),
        eq(workspaceAssistantGenerations.publicId, input.publicId)
      )
    );
  return getWorkspaceAssistantGenerationByPublicId(db, input);
}

export interface SetWorkspaceAssistantConversationActiveStreamInput {
  clerkOrgId: string;
  createdByUserId: string;
  expectedStreamId?: string | null;
  publicId: string;
  streamId: string | null;
}

export async function setWorkspaceAssistantConversationActiveStream(
  db: Database,
  input: SetWorkspaceAssistantConversationActiveStreamInput
): Promise<WorkspaceAssistantConversation | undefined> {
  const result = await db
    .update(workspaceAssistantConversations)
    .set({
      activeStreamId: input.streamId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(workspaceAssistantConversations.clerkOrgId, input.clerkOrgId),
        eq(
          workspaceAssistantConversations.createdByUserId,
          input.createdByUserId
        ),
        eq(workspaceAssistantConversations.publicId, input.publicId),
        input.expectedStreamId === undefined
          ? undefined
          : input.expectedStreamId === null
            ? isNull(workspaceAssistantConversations.activeStreamId)
            : eq(
                workspaceAssistantConversations.activeStreamId,
                input.expectedStreamId
              ),
        ne(workspaceAssistantConversations.status, "deleted")
      )
    );
  if (getRowsAffected(result) === 0) {
    return;
  }
  return getWorkspaceAssistantConversationByPublicId(db, input);
}

function normalizeIdempotencyKey(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed || null;
}

function isRecoverableMessageDuplicate(
  message: WorkspaceAssistantMessage | undefined,
  input: {
    idempotencyKey: string | null;
    publicId: string;
    conversationId: number;
  }
): message is WorkspaceAssistantMessage {
  if (!message || message.conversationId !== input.conversationId) {
    return false;
  }
  return input.idempotencyKey
    ? message.idempotencyKey === input.idempotencyKey
    : message.publicId === input.publicId;
}
