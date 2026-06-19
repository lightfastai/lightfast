import type {
  GetConversationResult,
  ListConversationsResult,
} from "@api/app/tanstack/assistant";

export type WorkspaceAssistantConversationResult = GetConversationResult;
export type WorkspaceAssistantConversationList = ListConversationsResult;
export type WorkspaceAssistantConversationListItem =
  WorkspaceAssistantConversationList["items"][number];

export const assistantConversationsQueryKey = [
  "workspace-assistant",
  "conversations",
] as const;

const assistantConversationQueryKeyPrefix = [
  "workspace-assistant",
  "conversation",
] as const;

export function assistantConversationQueryKey(conversationId: string) {
  return [...assistantConversationQueryKeyPrefix, conversationId] as const;
}
