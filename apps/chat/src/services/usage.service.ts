import type { CanSendMessageResult } from "@repo/chat-api-services/usage";
import {
  canSendMessage as baseCanSendMessage,
  requireMessageAccess as baseRequireMessageAccess,
  trackMessageSent as baseTrackMessageSent,
  getCurrentPeriod,
  UsageLimitExceededError,
} from "@repo/chat-api-services/usage";

import type { MessageType } from "~/lib/billing/types";
import { getMessageType } from "~/lib/billing/message-utils";

export { getCurrentPeriod, UsageLimitExceededError };

function resolveMessageType(modelId: string): MessageType {
  return getMessageType(modelId);
}

export async function canSendMessage(
  modelId: string,
  timezone?: string,
): Promise<CanSendMessageResult> {
  const messageType = resolveMessageType(modelId);
  return baseCanSendMessage({ messageType, timezone });
}

export async function trackMessageSent(
  userId: string,
  modelId: string,
  timezone?: string,
): Promise<void> {
  const messageType = resolveMessageType(modelId);
  await baseTrackMessageSent({ userId, messageType, timezone });
}

export async function requireMessageAccess(
  modelId: string,
  timezone?: string,
): Promise<void> {
  const messageType = resolveMessageType(modelId);
  await baseRequireMessageAccess({ messageType, timezone });
}
