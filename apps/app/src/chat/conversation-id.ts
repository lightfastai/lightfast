export const WORKSPACE_ASSISTANT_CONVERSATION_ID_PREFIX = "conv_";

export function createWorkspaceAssistantConversationId() {
  return `${WORKSPACE_ASSISTANT_CONVERSATION_ID_PREFIX}${crypto.randomUUID()}`;
}
