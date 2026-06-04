"use client";

import { useChat } from "@ai-sdk/react";
import type { AppRouterOutputs } from "@api/app";
import {
  lightfastWorkspaceAssistantDataPartSchemas,
  lightfastWorkspaceAssistantMessageMetadataSchema,
} from "@repo/ai/workspace-assistant";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/ui/components/ai-elements/conversation";
import type { PromptInputMessage } from "@repo/ui/components/ai-elements/prompt-input";
import {
  type ChatStatus,
  DefaultChatTransport,
  type UIMessage,
} from "@vendor/ai";
import { useParams } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
import { isResumableStreamEnabled } from "~/app/(chat)/api/chat/resumable-stream-config";
import { ChatComposer } from "./chat-composer";
import { ChatMessage } from "./chat-message";

type WorkspaceAssistantConversationResult =
  AppRouterOutputs["org"]["workspace"]["assistant"]["getConversation"];

interface WorkspaceAssistantClientProps {
  // Stable conversation identity, generated up-front by the route. Feeding this
  // straight into `useChat` (never via local state that mutates mid-send) keeps
  // the same Chat instance — and its in-flight stream — alive across the first
  // message of a new chat. Switching threads remounts via a `key` on the route.
  conversationId: string;
  initialConversation?: WorkspaceAssistantConversationResult;
}

export function WorkspaceAssistantClient({
  conversationId,
  initialConversation,
}: WorkspaceAssistantClientProps) {
  const params = useParams<{ slug: string }>();
  const initialMessages = useMemo(
    () => initialConversation?.messages.map(toUIMessage) ?? [],
    [initialConversation]
  );
  const [text, setText] = useState("");
  // Existing conversations are already persisted; new chats create lazily on the
  // first message through /api/chat. We only need to reflect the generated id
  // in the URL once.
  const conversationAddressedRef = useRef(Boolean(initialConversation));

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareReconnectToStreamRequest: ({ id }) => ({
          api: `/api/chat/${id}/stream`,
          credentials: "include",
        }),
        prepareSendMessagesRequest: ({ body, messages }) => ({
          body: {
            ...body,
            messages,
            conversationId,
          },
        }),
      }),
    [conversationId]
  );

  const { clearError, error, messages, sendMessage, status, stop } = useChat({
    id: conversationId,
    dataPartSchemas: lightfastWorkspaceAssistantDataPartSchemas,
    messageMetadataSchema: lightfastWorkspaceAssistantMessageMetadataSchema,
    messages: initialMessages,
    resume: isResumableStreamEnabled && Boolean(initialConversation),
    transport,
  });

  const hasMessages = messages.length > 0;
  const composerStatus: ChatStatus = status;

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const nextText = message.text.trim();

      if (!nextText) {
        return;
      }

      clearError();
      setText("");

      if (!conversationAddressedRef.current) {
        // Reflect the conversation in the URL right away without a navigation,
        // so the stable Chat instance (and its live stream) stays mounted.
        replaceBrowserChatUrl(params.slug, conversationId);
        conversationAddressedRef.current = true;
      }

      await sendMessage(
        { text: nextText },
        {
          body: {
            idempotencyKey: createWorkspaceAssistantIdempotencyKey(),
            conversationId,
          },
        }
      );
    },
    [params.slug, conversationId, sendMessage, clearError]
  );

  const renderComposer = (compact: boolean) => (
    <ChatComposer
      compact={compact}
      error={error}
      onSubmit={handleSubmit}
      onTextChange={setText}
      status={composerStatus}
      stop={stop}
      text={text}
    />
  );

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      {hasMessages ? (
        <>
          <div className="relative min-h-0 flex-1">
            <Conversation className="h-full">
              <ConversationContent
                getItemKey={(message) => message.id}
                items={messages}
                renderItem={(message, index) => (
                  <div className="mx-auto w-full max-w-3xl px-5 pt-8 md:px-10">
                    <ChatMessage
                      isStreaming={
                        status === "streaming" && index === messages.length - 1
                      }
                      message={message}
                    />
                  </div>
                )}
              />
              <ConversationScrollButton />
            </Conversation>
          </div>
          <div className="shrink-0 px-4 pb-5 md:px-8">
            {renderComposer(false)}
          </div>
        </>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <EmptyChatState composer={renderComposer(true)} />
        </div>
      )}
    </main>
  );
}

function createWorkspaceAssistantIdempotencyKey() {
  return `idem_${createUuid()}`;
}

function createUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function replaceBrowserChatUrl(orgSlug: string, conversationId?: string) {
  if (typeof window === "undefined") {
    return;
  }
  const nextPath = conversationId
    ? `/${orgSlug}/chat/${conversationId}`
    : `/${orgSlug}/chat`;
  window.history.replaceState(null, "", nextPath);
}

function EmptyChatState({ composer }: { composer: React.ReactNode }) {
  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-10 md:px-10">
      <div className="mb-6 text-center">
        <h1 className="font-medium text-2xl text-foreground tracking-normal md:text-3xl">
          Ready when you are.
        </h1>
      </div>

      {composer}
    </section>
  );
}

function toUIMessage(
  message: WorkspaceAssistantConversationResult["messages"][number]
): UIMessage {
  return {
    id: message.publicId,
    metadata: message.metadata,
    parts: message.parts as UIMessage["parts"],
    role: message.role as UIMessage["role"],
  };
}
