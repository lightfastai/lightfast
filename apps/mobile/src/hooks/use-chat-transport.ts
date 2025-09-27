import { useMemo } from "react";
import type { ChatTransport } from "ai";
import { DefaultChatTransport } from "ai";
import { fetch as expoFetch } from "expo/fetch";

import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";

import { authClient } from "~/utils/auth";
import { getBaseUrl } from "~/utils/base-url";

interface UseChatTransportProps {
  sessionId: string;
  agentId: string;
  webSearchEnabled: boolean;
}

type ExpoFetchInput = Parameters<typeof expoFetch>[0];
type ExpoFetchInit = Parameters<typeof expoFetch>[1];

type HeaderTuple = readonly [string, string];

const isHeaderTupleArray = (value: unknown): value is HeaderTuple[] =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      Array.isArray(entry) &&
      entry.length === 2 &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "string",
  );

const isHeaderRecord = (value: unknown): value is Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((entry) => typeof entry === "string");
};

const headersToRecord = (input: unknown): Record<string, string> => {
  const result: Record<string, string> = {};

  if (!input) {
    return result;
  }

  if (typeof input === "object" && "forEach" in (input as Record<string, unknown>)) {
    const candidate = input as { forEach: (callback: (value: unknown, key: string) => void) => void };
    if (typeof candidate.forEach === "function") {
      candidate.forEach((value, key) => {
        if (typeof value === "string") {
          result[key] = value;
        }
      });
      return result;
    }
  }

  if (isHeaderTupleArray(input)) {
    input.forEach(([key, value]) => {
      result[key] = value;
    });
    return result;
  }

  if (isHeaderRecord(input)) {
    return { ...input };
  }

  return result;
};

const authorizedFetch: typeof globalThis.fetch = async (
  input,
  init?: ExpoFetchInit,
) => {
  const token = await authClient.getToken();
  const baseHeaders = headersToRecord(init?.headers);

  if (token) {
    baseHeaders.Authorization = `Bearer ${token}`;
  }

  const requestInit: ExpoFetchInit = {
    ...init,
    headers: baseHeaders,
  };

  return expoFetch(input as ExpoFetchInput, requestInit);
};

export function useChatTransport({
  sessionId,
  agentId,
  webSearchEnabled,
}: UseChatTransportProps): ChatTransport<LightfastAppChatUIMessage> {
  return useMemo(() => {
    const apiEndpoint = `${getBaseUrl()}/api/v/${agentId}/${sessionId}`;

    return new DefaultChatTransport<LightfastAppChatUIMessage>({
      api: apiEndpoint,
      headers: {
        "Content-Type": "application/json",
        "Accept": "text/plain, application/json, application/octet-stream",
      },
      fetch: authorizedFetch,
      prepareSendMessagesRequest: ({ body, headers, messages, api }) => ({
        api,
        headers,
        body: {
          messages: messages.length > 0 ? [messages[messages.length - 1]] : [],
          webSearchEnabled,
          ...body,
        },
      }),
      prepareReconnectToStreamRequest: ({ api, headers }) => ({
        api,
        headers,
      }),
    });
  }, [sessionId, agentId, webSearchEnabled]);
}
