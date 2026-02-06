"use client";

import { DefaultChatTransport } from "ai";
import { useMemo } from "react";

export function useAnswerTransport({
  sessionId,
  workspaceId,
}: {
  sessionId: string;
  workspaceId: string;
}) {
  return useMemo(() => {
    return new DefaultChatTransport({
      api: `/v1/answer/answer-v1/${sessionId}`,
      headers: {
        "Content-Type": "application/json",
        "X-Workspace-ID": workspaceId,
      },
      prepareSendMessagesRequest: ({ body, headers, messages, api }) => ({
        api,
        headers,
        body: {
          messages: messages.length > 0 ? [messages[messages.length - 1]] : [],
          ...body,
        },
      }),
      prepareReconnectToStreamRequest: ({ api, headers }) => ({ api, headers }),
    });
  }, [sessionId, workspaceId]);
}
