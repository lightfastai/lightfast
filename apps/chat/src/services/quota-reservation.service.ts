import {
  reserveQuota as baseReserveQuota,
  confirmQuotaUsage,
  releaseQuotaReservation,
  cleanupExpiredReservations,
  QuotaReservationError,
  QuotaReleaseError,
} from "@repo/chat-services/quota-reservation";
import type { QuotaReservation } from "@repo/chat-services/quota-reservation";
import { getMessageType } from "~/lib/billing/message-utils";
import type { MessageType } from "~/lib/billing/types";

function resolveMessageType(modelId: string): MessageType {
  return getMessageType(modelId);
}

export {
  confirmQuotaUsage,
  releaseQuotaReservation,
  cleanupExpiredReservations,
  QuotaReservationError,
  QuotaReleaseError,
};

export type { QuotaReservation };

export async function reserveQuota(
  userId: string,
  modelId: string,
  messageId: string,
  timezone?: string,
): Promise<QuotaReservation> {
  const messageType = resolveMessageType(modelId);
  return baseReserveQuota({
    userId,
    messageType,
    modelId,
    messageId,
    timezone,
  });
}
