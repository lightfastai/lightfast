import type { QuotaReservation } from "@repo/chat-api-services/quota-reservation";
import {
  reserveQuota as baseReserveQuota,
  cleanupExpiredReservations,
  confirmQuotaUsage,
  QuotaReleaseError,
  QuotaReservationError,
  releaseQuotaReservation,
} from "@repo/chat-api-services/quota-reservation";

import type { MessageType } from "~/lib/billing/types";
import { getMessageType } from "~/lib/billing/message-utils";

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
