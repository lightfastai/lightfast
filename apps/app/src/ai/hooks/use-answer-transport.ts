"use client";

import { DefaultChatTransport } from "ai";

export function useAnswerTransport({
  sessionId,
  clerkOrgId,
}: {
  sessionId: string;
  clerkOrgId: string;
}) {
  return new DefaultChatTransport({
    api: `/v1/answer/answer-v1/${sessionId}`,
    headers: {
      "Content-Type": "application/json",
      "X-Org-ID": clerkOrgId,
    },
    prepareSendMessagesRequest: ({ body, headers, messages, api }) => ({
      api,
      headers,
      body: {
        messages: messages.length > 0 ? [messages.at(-1)] : [],
        ...body,
      },
    }),
    prepareReconnectToStreamRequest: ({ api, headers }) => ({ api, headers }),
  });
}
