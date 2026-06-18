import { useChat } from "@ai-sdk/react";
import { createConversation } from "@api/app/tanstack/assistant";
import {
  CHAT_SETTINGS_STORAGE_KEYS,
  type ChatCapabilityMode,
  type ChatConversationSettingsV2,
  type ChatModelProfile,
  getDefaultChatSettings,
  lightfastWorkspaceAssistantDataPartSchemas,
  lightfastWorkspaceAssistantMessageMetadataSchema,
  parseChatSettings,
} from "@repo/ai/workspace-assistant";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@repo/ui-v2/components/ai-elements/conversation";
import type { PromptInputMessage } from "@repo/ui-v2/components/ai-elements/prompt-input";
import { SidebarTrigger } from "@repo/ui-v2/components/ui/sidebar";
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
    mutationFn: (data: {
      chatSettings?: ChatConversationSettingsV2;
      publicId: string;
      title: string;
    }) =>
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
  const persistedChatSettings = useMemo(
    () => parseChatSettings(initialConversation?.conversation.metadata ?? {}),
    [initialConversation]
  );
  const [capabilityMode, setCapabilityMode] = useState<ChatCapabilityMode>(() =>
    readStoredCapabilityMode()
  );
  const [modelProfile, setModelProfile] = useState<ChatModelProfile>(() =>
    readStoredModelProfile()
  );
  const [lockedChatSettings, setLockedChatSettings] =
    useState<ChatConversationSettingsV2 | null>(() =>
      persistedChatSettings.version === "2.0.0" ? persistedChatSettings : null
    );
  const [text, setText] = useState("");
  const [creationError, setCreationError] = useState<Error | undefined>();
  const [optimisticFirstMessage, setOptimisticFirstMessage] =
    useState<UIMessage | null>(null);
  const conversationCreatedRef = useRef(Boolean(initialConversation));

  useEffect(() => {
    setLockedChatSettings(
      persistedChatSettings.version === "2.0.0" ? persistedChatSettings : null
    );
  }, [persistedChatSettings]);

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

      const selectedChatSettings =
        lockedChatSettings ??
        (!conversationCreatedRef.current
          ? ({
              capabilityMode,
              modelProfile,
              version: "2.0.0",
            } satisfies ChatConversationSettingsV2)
          : persistedChatSettings.version === "2.0.0"
            ? persistedChatSettings
            : undefined);
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
            chatSettings: selectedChatSettings ?? getDefaultChatSettings(),
            publicId: conversationId,
            title: conversationTitleFromPrompt(nextText),
          });
          conversationCreatedRef.current = true;
          setLockedChatSettings(selectedChatSettings ?? getDefaultChatSettings());
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

      try {
        await sendMessage(
          { text: nextText },
          {
            body: {
              ...(selectedChatSettings
                ? { chatSettings: selectedChatSettings }
                : {}),
              idempotencyKey: createWorkspaceAssistantIdempotencyKey(),
              conversationId,
            },
          }
        );
      } finally {
        setOptimisticFirstMessage(null);
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
      capabilityMode,
      lockedChatSettings,
      modelProfile,
      persistedChatSettings,
    ]
  );

  const settingsLocked = lockedChatSettings !== null;
  const displayedCapabilityMode =
    lockedChatSettings?.capabilityMode ?? capabilityMode;
  const displayedModelProfile = lockedChatSettings?.modelProfile ?? modelProfile;

  const renderComposer = () => (
    <ChatComposer
      capabilityMode={displayedCapabilityMode}
      error={displayError}
      modelProfile={displayedModelProfile}
      onCapabilityModeChange={(mode) => {
        if (settingsLocked) {
          return;
        }
        setCapabilityMode(mode);
        writeStoredCapabilityMode(mode);
      }}
      onModelProfileChange={(profile) => {
        if (settingsLocked) {
          return;
        }
        setModelProfile(profile);
        writeStoredModelProfile(profile);
      }}
      onSubmit={handleSubmit}
      onTextChange={setText}
      settingsLocked={settingsLocked}
      status={composerStatus}
      stop={stop}
      text={text}
    />
  );

  return (
    <main className="relative flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <SidebarTrigger className="absolute top-3 left-3 z-20 size-8 rounded-lg border border-border/70 bg-background/85 p-0 text-muted-foreground shadow-sm backdrop-blur hover:bg-muted/60 hover:text-foreground md:hidden" />
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

function readStoredCapabilityMode(): ChatCapabilityMode {
  if (typeof window === "undefined") {
    return getDefaultChatSettings().capabilityMode;
  }
  const value = window.localStorage.getItem(
    CHAT_SETTINGS_STORAGE_KEYS.capabilityMode
  );
  return value === "read" || value === "write"
    ? value
    : getDefaultChatSettings().capabilityMode;
}

function readStoredModelProfile(): ChatModelProfile {
  if (typeof window === "undefined") {
    return getDefaultChatSettings().modelProfile;
  }
  const value = window.localStorage.getItem(
    CHAT_SETTINGS_STORAGE_KEYS.modelProfile
  );
  return value === "fast" || value === "thinking"
    ? value
    : getDefaultChatSettings().modelProfile;
}

function writeStoredCapabilityMode(mode: ChatCapabilityMode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(CHAT_SETTINGS_STORAGE_KEYS.capabilityMode, mode);
  }
}

function writeStoredModelProfile(profile: ChatModelProfile) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      CHAT_SETTINGS_STORAGE_KEYS.modelProfile,
      profile
    );
  }
}

function EmptyChatState({ composer }: { composer: React.ReactNode }) {
  return (
    <section className="flex min-h-full w-full flex-col justify-start px-4 pt-[clamp(8rem,26svh,18rem)] pb-10 md:px-8">
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
