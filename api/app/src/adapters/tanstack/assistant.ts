import {
  createWorkspaceAssistantConversation as createWorkspaceAssistantConversationInDb,
  getWorkspaceAssistantConversationByPublicId,
  listWorkspaceAssistantConversations,
  listWorkspaceAssistantMessages,
} from "@db/app";
import { db } from "@db/app/client";
import { safeValidateLightfastUIMessages } from "@repo/ai/workspace-assistant";
import { createServerFn } from "@tanstack/react-start";
import { getRequest, setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";

import { resolveAuthContextFromClerk } from "../../auth/identity";
import {
  actorFromAuthIdentity,
  isDomainError,
  NotFoundError,
} from "../../domain";
import { requireBoundClerkOrgActor } from "../../domain/gates";

const cursorUpdatedAtSchema = z.union([
  z.date(),
  z
    .string()
    .datetime()
    .transform((value) => new Date(value)),
]);

const conversationCursorInput = z
  .object({
    id: z.number().int().positive(),
    updatedAt: cursorUpdatedAtSchema,
  })
  .strict();

const listConversationsInput = z
  .object({
    cursor: conversationCursorInput.nullish(),
    limit: z.number().int().min(1).max(100).optional(),
  })
  .strict()
  .optional();

const createConversationInput = z
  .object({
    publicId: z
      .string()
      .trim()
      .min(1)
      .max(80)
      .regex(/^conv_[A-Za-z0-9_-]+$/)
      .optional(),
    title: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .optional();

const getConversationInput = z
  .object({
    id: z.string().trim().min(1),
  })
  .strict();

type ConversationList = Awaited<
  ReturnType<typeof listWorkspaceAssistantConversations>
>;
type ConversationListItem = ConversationList["items"][number];
type ConversationMessages = Awaited<
  ReturnType<typeof listWorkspaceAssistantMessages>
>;
type ConversationMessage = ConversationMessages[number];

type SerializableValue =
  | SerializableValue[]
  | boolean
  | null
  | number
  | string
  | { [key: string]: SerializableValue };

interface SerializableMetadata {
  [key: string]: SerializableValue;
}

export type ConversationListItemResult = Omit<
  ConversationListItem,
  "metadata"
> & {
  metadata: SerializableMetadata;
};
export type ConversationMessageResult = Omit<
  ConversationMessage,
  "metadata" | "parts"
> & {
  metadata: SerializableMetadata;
  parts: SerializableValue[];
};
export interface ListConversationsResult
  extends Omit<ConversationList, "items"> {
  items: ConversationListItemResult[];
}
export interface GetConversationResult {
  conversation: ConversationListItemResult;
  messages: ConversationMessageResult[];
}
export type CreateConversationResult = ConversationListItemResult;

interface TanStackDomainError extends Error {
  code: string;
  data: {
    code: string;
    kind: string;
  };
}

function requestId() {
  return crypto.randomUUID();
}

async function getBoundActor() {
  const request = getRequest();
  const auth = await resolveAuthContextFromClerk({
    db,
    headers: new Headers(request.headers),
  });
  return requireBoundClerkOrgActor({
    actor: actorFromAuthIdentity(auth.identity, "web"),
    request: { id: requestId(), source: "tanstack" },
  });
}

function mapTanStackError(error: unknown): never {
  if (isDomainError(error)) {
    const mappedError = new Error(error.message, {
      cause: error,
    }) as TanStackDomainError;
    mappedError.code = error.code;
    mappedError.data = {
      code: error.code,
      kind: error.kind,
    };
    throw mappedError;
  }
  throw error;
}

function noStore() {
  setResponseHeader("cache-control", "private, no-store");
  setResponseHeader("vary", "Cookie, Authorization");
}

function toSerializableValue(value: unknown): SerializableValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (Array.isArray(value)) {
    return value.map(toSerializableValue);
  }

  if (typeof value === "object") {
    if (value instanceof Date) {
      return value.toISOString();
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [
        key,
        toSerializableValue(child),
      ])
    );
  }

  return null;
}

function toSerializableMetadata(value: unknown): SerializableMetadata {
  const metadata = toSerializableValue(value);
  return metadata && !Array.isArray(metadata) && typeof metadata === "object"
    ? metadata
    : {};
}

function toSerializableArray(value: unknown): SerializableValue[] {
  const result = toSerializableValue(value);
  return Array.isArray(result) ? result : [];
}

function serializeConversation(
  conversation: ConversationListItem
): ConversationListItemResult {
  return {
    ...conversation,
    metadata: toSerializableMetadata(conversation.metadata),
  };
}

function serializeMessage(
  message: ConversationMessage
): ConversationMessageResult {
  return {
    ...message,
    metadata: toSerializableMetadata(message.metadata),
    parts: toSerializableArray(message.parts),
  };
}

function serializeConversationList(
  conversations: ConversationList
): ListConversationsResult {
  return {
    ...conversations,
    items: conversations.items.map(serializeConversation),
  };
}

export const createConversation = createServerFn({ method: "POST" })
  .inputValidator(createConversationInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      return serializeConversation(
        await createWorkspaceAssistantConversationInDb(db, {
          clerkOrgId: actor.orgId,
          createdByUserId: actor.userId,
          publicId: data?.publicId,
          title: data?.title,
        })
      );
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const getConversation = createServerFn({ method: "GET" })
  .inputValidator(getConversationInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      const conversation = await getWorkspaceAssistantConversationByPublicId(
        db,
        {
          clerkOrgId: actor.orgId,
          createdByUserId: actor.userId,
          publicId: data.id,
        }
      );
      if (!conversation) {
        throw new NotFoundError(
          "WORKSPACE_ASSISTANT_CONVERSATION_NOT_FOUND",
          "Workspace assistant conversation not found"
        );
      }

      const messages = await listWorkspaceAssistantMessages(db, {
        clerkOrgId: actor.orgId,
        createdByUserId: actor.userId,
        conversation,
      });
      const renderableMessages = messages.filter(
        (message) => message.parts.length > 0
      );
      const serializedConversation = serializeConversation(conversation);
      if (renderableMessages.length === 0) {
        return {
          messages: [],
          conversation: serializedConversation,
        } satisfies GetConversationResult;
      }

      const validated = await safeValidateLightfastUIMessages({
        messages: renderableMessages.map((message) => ({
          id: message.publicId,
          metadata: message.metadata,
          parts: message.parts,
          role: message.role,
        })),
      });
      if (!validated.success) {
        throw new Error(
          "Persisted workspace assistant messages failed validation",
          {
            cause: validated.error,
          }
        );
      }

      return {
        messages: renderableMessages.map(serializeMessage),
        conversation: serializedConversation,
      } satisfies GetConversationResult;
    } catch (error) {
      mapTanStackError(error);
    }
  });

export const listConversations = createServerFn({ method: "GET" })
  .inputValidator(listConversationsInput)
  .handler(async ({ data }) => {
    noStore();
    try {
      const actor = await getBoundActor();
      return serializeConversationList(
        await listWorkspaceAssistantConversations(db, {
          clerkOrgId: actor.orgId,
          createdByUserId: actor.userId,
          cursor: data?.cursor ?? undefined,
          limit: data?.limit,
        })
      );
    } catch (error) {
      mapTanStackError(error);
    }
  });
