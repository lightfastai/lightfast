export function isPreallocatedConversationId(conversationId: string) {
  return /^conv_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    conversationId
  );
}
