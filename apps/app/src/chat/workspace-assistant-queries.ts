import {
  type GetConversationResult,
  getConversation,
  type ListConversationsResult,
  listConversations,
} from "@api/app/tanstack/assistant";
import { queryOptions } from "@tanstack/react-query";

export type WorkspaceAssistantConversationResult = GetConversationResult;
export type WorkspaceAssistantConversationList = ListConversationsResult;
export type WorkspaceAssistantConversationListItem =
  WorkspaceAssistantConversationList["items"][number];

export const assistantConversationsQueryKey = [
  "workspace-assistant",
  "conversations",
] as const;

const assistantConversationQueryKey = [
  "workspace-assistant",
  "conversation",
] as const;

export function assistantConversationsQueryOptions(input: { limit: number }) {
  return queryOptions({
    enabled: typeof window !== "undefined",
    queryFn: () => listConversations({ data: input }),
    queryKey: [...assistantConversationsQueryKey, input] as const,
    staleTime: 0,
  });
}

export function assistantConversationQueryOptions(input: {
  conversationId: string;
}) {
  return queryOptions({
    enabled: typeof window !== "undefined",
    queryFn: () => getConversation({ data: { id: input.conversationId } }),
    queryKey: [...assistantConversationQueryKey, input.conversationId] as const,
    retry: false,
  });
}
