"use client";

import type { ChatTransport } from "ai";
import { DefaultChatTransport } from "ai";
import { useMemo } from "react";
import type { PlaygroundUIMessage } from "~/types/playground-ui-messages";

interface UseChatTransportProps {
  threadId: string;
  agentId: string;
}

/**
 * Hook that creates and configures a DefaultChatTransport for AI integration
 */
export function useChatTransport({ threadId, agentId }: UseChatTransportProps): ChatTransport<PlaygroundUIMessage> {
  const transport = useMemo(() => {
    // Use the agents API endpoint with agentId and threadId in the path
    // Note: playground app has basePath: '/playground' in next.config.ts
    const apiEndpoint = `/playground/api/agents/${agentId}/${threadId}`;
    return new DefaultChatTransport<PlaygroundUIMessage>({
      api: apiEndpoint,
      headers: {
        "Content-Type": "application/json",
      },
      prepareSendMessagesRequest: ({ body, headers, messages, api }) => {
        return {
          api,
          headers,
          body: {
            // Send only the latest user message
            // Server will validate and return 400 if no messages
            messages: messages.length > 0 ? [messages[messages.length - 1]] : [],
            // Include any additional metadata from the body
            ...body,
          },
        };
      },
      prepareReconnectToStreamRequest: ({ api, headers }) => {
        // For GET requests (resume), use the same path
        return {
          api,
          headers,
        };
      },
    });
  }, [threadId, agentId]);

  return transport;
}