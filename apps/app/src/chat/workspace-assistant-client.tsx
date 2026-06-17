import { useChat } from "@ai-sdk/react";
import { createConversation } from "@api/app/tanstack/assistant";
import {
  lightfastWorkspaceAssistantDataPartSchemas,
  lightfastWorkspaceAssistantMessageMetadataSchema,
} from "@repo/ai/workspace-assistant";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/ui-v2/components/ai-elements/conversation";
import type { PromptInputMessage } from "@repo/ui-v2/components/ai-elements/prompt-input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter } from "@tanstack/react-router";
import {
  type ChatStatus,
  DefaultChatTransport,
  type UIMessage,
} from "@vendor/ai";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatMessage } from "./chat-message";
import {
  assistantConversationQueryOptions,
  assistantConversationsQueryKey,
  type WorkspaceAssistantConversationResult,
} from "./workspace-assistant-queries";

const isResumableStreamEnabled =
  (import.meta.env.VITE_VERCEL_ENV ?? "development") !== "development";

const messageRowRenderingHints = {
  containIntrinsicSize: "0 160px",
  contentVisibility: "auto",
} satisfies CSSProperties;

const conversationTitleMaxLength = 160;

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
  const queryClient = useQueryClient();
  const createConversationMutation = useMutation({
    mutationFn: (data: { publicId: string; title: string }) =>
      createConversation({ data }),
  });
  const getConversationQueryOptions = useMemo(
    () => assistantConversationQueryOptions({ conversationId }),
    [conversationId]
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
  const messagesRef = useRef(messages);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const displayMessages =
    optimisticFirstMessage && messages.length === 0
      ? [optimisticFirstMessage]
      : messages;
  const hasMessages = displayMessages.length > 0;
  const displayError = creationError ?? error;
  const isPreparingFirstMessage =
    Boolean(optimisticFirstMessage) && status === "ready";
  const composerStatus: ChatStatus =
    createConversationMutation.isPending || isPreparingFirstMessage
      ? "submitted"
      : status;

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const nextText = message.text.trim();

      if (!nextText) {
        return;
      }

      clearError();

      let createdConversationDuringSubmit = false;
      let createdConversation:
        | WorkspaceAssistantConversationResult["conversation"]
        | undefined;

      if (!conversationCreatedRef.current) {
        setCreationError(undefined);
        setOptimisticFirstMessage(createOptimisticUserMessage(nextText));
        if (orgSlug) {
          replaceBrowserHistoryPath(
            workspaceConversationPath(orgSlug, conversationId)
          );
        }
        try {
          createdConversation = await createConversationMutation.mutateAsync({
            publicId: conversationId,
            title: conversationTitleFromPrompt(nextText),
          });
          conversationCreatedRef.current = true;
          createdConversationDuringSubmit = true;
          void queryClient.invalidateQueries({
            queryKey: assistantConversationsQueryKey,
          });
        } catch (error) {
          if (orgSlug) {
            replaceBrowserHistoryPath(workspaceChatPath(orgSlug));
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
      if (createdConversationDuringSubmit && createdConversation) {
        queryClient.setQueryData(getConversationQueryOptions.queryKey, {
          conversation: createdConversation,
          messages: toSeededConversationMessages(
            messagesRef.current,
            createdConversation
          ),
        } satisfies WorkspaceAssistantConversationResult);

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
      createConversationMutation.mutateAsync,
      getConversationQueryOptions.queryKey,
      orgSlug,
      queryClient,
      router,
      sendMessage,
      clearError,
      providerRoutineWriteMode,
    ]
  );

  const renderComposer = () => (
    <ChatComposer
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
    <main className="flex h-[calc(100svh-3.5rem)] min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      {hasMessages ? (
        <>
          <div className="relative min-h-0 flex-1 overflow-hidden">
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
          <div className="shrink-0 px-4 pt-3 pb-5 md:px-8">
            {renderComposer()}
            <p className="mx-auto mt-2 max-w-3xl text-center text-muted-foreground text-xs">
              Lightfast can make mistakes. Check important info.
            </p>
          </div>
        </>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <EmptyChatState composer={renderComposer()} />
        </div>
      )}
    </main>
  );
}

function createWorkspaceAssistantIdempotencyKey() {
  return `idem_${createUuid()}`;
}

function conversationTitleFromPrompt(text: string) {
  return text.slice(0, conversationTitleMaxLength);
}

function replaceBrowserHistoryPath(pathname: string) {
  if (typeof window === "undefined") {
    return;
  }

  // TanStack Router patches window.history.replaceState and treats it as a
  // route transition. Call the native method so the active chat stream stays
  // mounted while the address bar reflects the preallocated conversation.
  History.prototype.replaceState.call(
    window.history,
    window.history.state,
    "",
    pathname
  );
}

function workspaceConversationPath(orgSlug: string, conversationId: string) {
  return `${workspaceChatPath(orgSlug)}/${encodeURIComponent(conversationId)}`;
}

function workspaceChatPath(orgSlug: string) {
  return `/${encodeURIComponent(orgSlug)}/chat`;
}

function createOptimisticUserMessage(text: string): UIMessage {
  return {
    id: `optimistic_${createUuid()}`,
    parts: [{ text, type: "text" }],
    role: "user",
  };
}

function toSeededConversationMessages(
  messages: UIMessage[],
  conversation: WorkspaceAssistantConversationResult["conversation"]
): WorkspaceAssistantConversationResult["messages"] {
  const now = new Date();

  return messages.map((message, index) => ({
    conversationId: conversation.id,
    conversationPublicId: conversation.publicId,
    clerkOrgId: conversation.clerkOrgId,
    createdAt: now,
    createdByUserId: conversation.createdByUserId,
    errorCode: null,
    errorMessage: null,
    id: -(index + 1),
    idempotencyKey: null,
    metadata:
      (message.metadata as
        | WorkspaceAssistantConversationResult["messages"][number]["metadata"]
        | undefined) ?? {},
    parts:
      message.parts as WorkspaceAssistantConversationResult["messages"][number]["parts"],
    publicId: message.id,
    role: message.role as WorkspaceAssistantConversationResult["messages"][number]["role"],
    sequence: index,
    status: "completed",
    updatedAt: now,
  }));
}

function createUuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function EmptyChatState({ composer }: { composer: React.ReactNode }) {
  return (
    <section className="flex min-h-[calc(100svh-3.5rem)] w-full flex-col justify-start px-4 pt-[clamp(8rem,26svh,18rem)] pb-10 md:px-8">
      <div className="mx-auto mb-6 w-full max-w-3xl text-center">
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
