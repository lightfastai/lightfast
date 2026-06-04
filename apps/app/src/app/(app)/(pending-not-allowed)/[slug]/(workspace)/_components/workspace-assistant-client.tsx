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
import { useMutation } from "@tanstack/react-query";
import {
  type ChatStatus,
  DefaultChatTransport,
  type UIMessage,
} from "@vendor/ai";
import { useParams } from "next/navigation";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { isResumableStreamEnabled } from "~/app/(chat)/api/chat/resumable-stream-config";
import { useTRPC } from "~/trpc/react";
import { ChatComposer } from "./chat-composer";
import { ChatMessage } from "./chat-message";

type WorkspaceAssistantConversationResult =
  AppRouterOutputs["org"]["workspace"]["assistant"]["getConversation"];

const messageRowRenderingHints = {
  containIntrinsicSize: "0 160px",
  contentVisibility: "auto",
} satisfies CSSProperties;

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
  const trpc = useTRPC();
  const createConversation = useMutation(
    trpc.org.workspace.assistant.createConversation.mutationOptions()
  );
  const initialMessages = useMemo(
    () => initialConversation?.messages.map(toUIMessage) ?? [],
    [initialConversation]
  );
  const [text, setText] = useState("");
  const [creationError, setCreationError] = useState<Error | undefined>();
  // Existing conversations are already persisted; new chats create lazily on the
  // first message. We never recreate, so a ref (not state) is enough.
  const conversationCreatedRef = useRef(Boolean(initialConversation));

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
  const displayError = creationError ?? error;
  const composerStatus: ChatStatus = createConversation.isPending
    ? "submitted"
    : status;

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const nextText = message.text.trim();

      if (!nextText) {
        return;
      }

      clearError();

      if (!conversationCreatedRef.current) {
        setCreationError(undefined);
        // Reflect the conversation in the URL right away — without a navigation,
        // so the stable Chat instance (and its live stream) stays mounted. The id
        // is known up-front, so this is safe to do before the create resolves.
        replaceBrowserChatUrl(params.slug, conversationId);
        try {
          await createConversation.mutateAsync({
            publicId: conversationId,
            title: nextText,
          });
          conversationCreatedRef.current = true;
        } catch (error) {
          replaceBrowserChatUrl(params.slug);
          setCreationError(
            error instanceof Error
              ? error
              : new Error("Unable to create conversation.")
          );
          return;
        }
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
      setText("");
    },
    [
      params.slug,
      conversationId,
      createConversation.mutateAsync,
      sendMessage,
      clearError,
    ]
  );

  const renderComposer = (compact: boolean) => (
    <ChatComposer
      compact={compact}
      error={displayError}
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
              <ConversationContent className="gap-0 p-0 pb-8">
                {messages.map((message, index) => (
                  <div
                    className="mx-auto w-full max-w-3xl px-5 pt-8 md:px-10"
                    key={message.id}
                    style={messageRowRenderingHints}
                  >
                    <ChatMessage
                      isStreaming={
                        status === "streaming" && index === messages.length - 1
                      }
                      message={message}
                    />
                  </div>
                ))}
              </ConversationContent>
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
