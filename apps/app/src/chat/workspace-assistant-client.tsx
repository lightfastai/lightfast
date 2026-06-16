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
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import {
  type ChatStatus,
  DefaultChatTransport,
  type UIMessage,
} from "@vendor/ai";
import type { CSSProperties } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";
import { ChatComposer } from "./chat-composer";
import { ChatMessage } from "./chat-message";
import { isResumableStreamEnabled } from "./resumable-stream-config";

type WorkspaceAssistantConversationResult =
  AppRouterOutputs["org"]["workspace"]["assistant"]["getConversation"];

const messageRowRenderingHints = {
  containIntrinsicSize: "0 160px",
  contentVisibility: "auto",
} satisfies CSSProperties;

interface WorkspaceAssistantClientProps {
  conversationId: string;
  initialConversation?: WorkspaceAssistantConversationResult;
}

export function WorkspaceAssistantClient({
  conversationId,
  initialConversation,
}: WorkspaceAssistantClientProps) {
  const params = useParams({ strict: false });
  const orgSlug = typeof params.slug === "string" ? params.slug : undefined;
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const createConversation = useMutation(
    trpc.org.workspace.assistant.createConversation.mutationOptions()
  );
  const listConversationsQueryFilter = useMemo(
    () => trpc.org.workspace.assistant.listConversations.queryFilter(),
    [trpc]
  );
  const initialMessages = useMemo(
    () => initialConversation?.messages.map(toUIMessage) ?? [],
    [initialConversation]
  );
  const [text, setText] = useState("");
  const [creationError, setCreationError] = useState<Error | undefined>();
  const [optimisticFirstMessage, setOptimisticFirstMessage] =
    useState<UIMessage | null>(null);
  const [providerRoutineWriteMode, setProviderRoutineWriteMode] =
    useState(false);
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

  const displayMessages =
    optimisticFirstMessage && messages.length === 0
      ? [optimisticFirstMessage]
      : messages;
  const hasMessages = displayMessages.length > 0;
  const displayError = creationError ?? error;
  const isPreparingFirstMessage =
    Boolean(optimisticFirstMessage) && status === "ready";
  const composerStatus: ChatStatus =
    createConversation.isPending || isPreparingFirstMessage
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
        setOptimisticFirstMessage(createOptimisticUserMessage(nextText));
        if (orgSlug) {
          void router.navigate({
            params: { conversationId, slug: orgSlug },
            replace: true,
            to: "/$slug/chat/$conversationId",
          });
        }
        try {
          await createConversation.mutateAsync({
            publicId: conversationId,
            title: nextText,
          });
          conversationCreatedRef.current = true;
          void queryClient.invalidateQueries(listConversationsQueryFilter);
        } catch (error) {
          if (orgSlug) {
            void router.navigate({
              params: { slug: orgSlug },
              replace: true,
              to: "/$slug/chat",
            });
          }
          setOptimisticFirstMessage(null);
          setCreationError(
            error instanceof Error
              ? error
              : new Error("Unable to create conversation.")
          );
          return;
        }
      }

      const writeModeForTurn = providerRoutineWriteMode;
      try {
        await sendMessage(
          { text: nextText },
          {
            body: {
              idempotencyKey: createWorkspaceAssistantIdempotencyKey(),
              conversationId,
              ...(writeModeForTurn ? { providerRoutineWriteMode: true } : {}),
            },
          }
        );
      } finally {
        setOptimisticFirstMessage(null);
        setProviderRoutineWriteMode(false);
      }
      setText("");
      if (!initialConversation) {
        if (orgSlug) {
          await router.navigate({
            params: { conversationId, slug: orgSlug },
            replace: true,
            to: "/$slug/chat/$conversationId",
          });
        } else {
          await router.invalidate();
        }
      }
    },
    [
      conversationId,
      createConversation.mutateAsync,
      initialConversation,
      listConversationsQueryFilter,
      orgSlug,
      queryClient,
      router,
      sendMessage,
      clearError,
      providerRoutineWriteMode,
    ]
  );

  const renderComposer = (compact: boolean) => (
    <ChatComposer
      compact={compact}
      error={displayError}
      onSubmit={handleSubmit}
      onTextChange={setText}
      onWriteModeChange={setProviderRoutineWriteMode}
      status={composerStatus}
      stop={stop}
      text={text}
      writeModeEnabled={providerRoutineWriteMode}
    />
  );

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      {hasMessages ? (
        <>
          <div className="relative min-h-0 flex-1">
            <Conversation className="h-full">
              <ConversationContent className="gap-0 p-0 pb-8">
                {displayMessages.map((message, index) => (
                  <div
                    className="mx-auto w-full max-w-3xl px-5 pt-8 md:px-10"
                    key={message.id}
                    style={messageRowRenderingHints}
                  >
                    <ChatMessage
                      isStreaming={
                        status === "streaming" &&
                        index === displayMessages.length - 1
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

function createOptimisticUserMessage(text: string): UIMessage {
  return {
    id: `optimistic_${createUuid()}`,
    parts: [{ text, type: "text" }],
    role: "user",
  };
}

function createUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
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
