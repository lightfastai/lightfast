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
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@repo/ui/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@repo/ui/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@repo/ui/components/ai-elements/reasoning";
import {
  Tool,
  ToolContent,
  ToolHeader,
  ToolInput,
  ToolOutput,
  type ToolPart,
} from "@repo/ui/components/ai-elements/tool";
import { Button } from "@repo/ui/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  type ChatStatus,
  DefaultChatTransport,
  type UIMessage,
} from "@vendor/ai";
import { Box, LinkIcon, MessageCircle, Plus } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";

type SkillsListResult = AppRouterOutputs["org"]["workspace"]["skills"]["list"];
type Skill = SkillsListResult["skills"][number];
type SkillTab = "recent" | "explore";
type WorkspaceAssistantConversationResult =
  AppRouterOutputs["org"]["workspace"]["assistant"]["getConversation"];
type CopyState = "copied" | "error" | "idle";

interface WorkspaceAssistantClientProps {
  initialConversation?: WorkspaceAssistantConversationResult;
}

export function WorkspaceAssistantClient({
  initialConversation,
}: WorkspaceAssistantClientProps) {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(
    trpc.org.workspace.skills.list.queryOptions(undefined, { staleTime: 0 })
  );
  const createConversation = useMutation(
    trpc.org.workspace.assistant.createConversation.mutationOptions()
  );
  const initialMessages = useMemo(
    () => initialConversation?.messages.map(toUIMessage) ?? [],
    [initialConversation]
  );
  const [text, setText] = useState("");
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const [skillTab, setSkillTab] = useState<SkillTab>("recent");
  const [conversationId, setConversationId] = useState(
    initialConversation?.conversation.publicId
  );
  const [creationError, setCreationError] = useState<Error | undefined>();
  const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const conversationIdRef = useRef(conversationId);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  useEffect(
    () => () => {
      if (copyResetTimeoutRef.current) {
        clearTimeout(copyResetTimeoutRef.current);
      }
    },
    []
  );

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
            conversationId: conversationIdRef.current,
          },
        }),
      }),
    []
  );

  const {
    clearError,
    error,
    messages,
    sendMessage,
    setMessages = () => undefined,
    status,
    stop,
  } = useChat({
    id: conversationId ?? undefined,
    dataPartSchemas: lightfastWorkspaceAssistantDataPartSchemas,
    messageMetadataSchema: lightfastWorkspaceAssistantMessageMetadataSchema,
    messages: initialMessages,
    resume: !!conversationId,
    transport,
  });

  const visibleSkills = useMemo(() => {
    const validSkills = data.skills.filter(
      (skill) => skill.validationStatus === "valid"
    );
    return (skillTab === "recent" ? validSkills.slice(0, 2) : validSkills).map(
      toSkillCard
    );
  }, [data.skills, skillTab]);

  const hasMessages = messages.length > 0;
  const displayError = creationError ?? error;
  const composerStatus: ChatStatus = createConversation.isPending
    ? "submitted"
    : status;
  const isGenerating = status === "submitted" || status === "streaming";

  const handleNewChat = useCallback(() => {
    if (isGenerating) {
      stop();
    }
    clearError();
    setCreationError(undefined);
    setCopyState("idle");
    setText("");
    setConversationId(undefined);
    setMessages([]);
    router.push(`/${params.slug}/chat` as Route);
  }, [clearError, isGenerating, params.slug, router, setMessages, stop]);

  const setTransientCopyState = useCallback((nextState: CopyState) => {
    setCopyState(nextState);
    if (copyResetTimeoutRef.current) {
      clearTimeout(copyResetTimeoutRef.current);
    }
    copyResetTimeoutRef.current = setTimeout(() => {
      setCopyState("idle");
      copyResetTimeoutRef.current = null;
    }, 2000);
  }, []);

  const handleCopyLink = useCallback(async () => {
    if (!(conversationId && typeof navigator !== "undefined")) {
      return;
    }
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard is not available.");
      }
      await navigator.clipboard.writeText(window.location.href);
      setTransientCopyState("copied");
    } catch {
      setTransientCopyState("error");
    }
  }, [setTransientCopyState, conversationId]);

  const handleSubmit = async (message: PromptInputMessage) => {
    const nextText = message.text.trim();

    if (!nextText) {
      return;
    }

    clearError();

    let activeConversationId = conversationIdRef.current;
    if (!activeConversationId) {
      activeConversationId = createWorkspaceAssistantConversationId();
      conversationIdRef.current = activeConversationId;
      setConversationId(activeConversationId);
      replaceBrowserChatUrl(params.slug, activeConversationId);
      setCreationError(undefined);

      try {
        await createConversation.mutateAsync({
          publicId: activeConversationId,
          title: nextText,
        });
      } catch (error) {
        conversationIdRef.current = undefined;
        setConversationId(undefined);
        replaceBrowserChatUrl(params.slug);
        setCreationError(
          error instanceof Error ? error : new Error("Unable to create conversation.")
        );
        return;
      }
    }

    await sendMessage(
      { text: nextText },
      {
        body: {
          idempotencyKey: createWorkspaceAssistantIdempotencyKey(),
          conversationId: activeConversationId,
        },
      }
    );
    setText("");
  };

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col bg-background text-foreground">
      <ChatHeader
        canCopyLink={!!conversationId && hasMessages}
        copyState={copyState}
        hasMessages={hasMessages}
        onCopyLink={handleCopyLink}
        onNewChat={handleNewChat}
        title={getConversationTitle(messages)}
      />

      <div className="relative min-h-0 flex-1">
        {hasMessages ? (
          <Conversation className="h-full">
            <ConversationContent className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 pt-10 pb-40 md:px-10">
              {messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent
                    className={cn(
                      message.role === "user" &&
                        "rounded-3xl bg-muted px-5 py-3 text-[15px] leading-6",
                      message.role === "assistant" &&
                        "w-full max-w-none bg-transparent px-0 py-0 text-[15px] leading-7"
                    )}
                  >
                    {message.parts.map((part, index) => (
                      <WorkspaceAssistantMessagePart
                        isStreaming={
                          message.role === "assistant" && status === "streaming"
                        }
                        key={`${message.id}-${index}`}
                        part={part}
                      />
                    ))}
                  </MessageContent>
                </Message>
              ))}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>
        ) : (
          <EmptyChatState
            onTabChange={setSkillTab}
            orgSlug={params.slug}
            skills={visibleSkills}
            tab={skillTab}
          />
        )}
      </div>

      <div className="shrink-0 px-4 pb-5 md:px-8">
        <ChatComposer
          disabled={composerStatus !== "ready"}
          error={displayError}
          onSubmit={handleSubmit}
          onTextChange={setText}
          status={composerStatus}
          stop={stop}
          text={text}
        />
      </div>
    </main>
  );
}

function createWorkspaceAssistantConversationId() {
  return `conv_${createUuid()}`;
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

function ChatHeader({
  canCopyLink,
  copyState,
  hasMessages,
  onCopyLink,
  onNewChat,
  title,
}: {
  canCopyLink: boolean;
  copyState: CopyState;
  hasMessages: boolean;
  onCopyLink: () => void;
  onNewChat: () => void;
  title: string;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center px-5 md:px-7">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {hasMessages && <MessageCircle className="size-5 text-foreground" />}
        {hasMessages && (
          <h1 className="truncate font-medium text-foreground text-lg">
            {title}
          </h1>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span aria-live="polite" className="sr-only">
          {copyState === "copied" && "Chat link copied"}
          {copyState === "error" && "Could not copy chat link"}
        </span>
        <Button
          aria-label={
            copyState === "copied" ? "Chat link copied" : "Copy chat link"
          }
          className="size-11 text-muted-foreground sm:size-9"
          disabled={!canCopyLink}
          onClick={onCopyLink}
          size="icon"
          type="button"
          variant="ghost"
        >
          <LinkIcon className="size-4" />
        </Button>
        <Button
          className="h-11 gap-2 rounded-xl bg-muted px-3 font-normal text-foreground hover:bg-muted/80 sm:h-9"
          onClick={onNewChat}
          type="button"
          variant="secondary"
        >
          <Plus className="size-4" />
          New chat
        </Button>
      </div>
    </header>
  );
}

function EmptyChatState({
  onTabChange,
  orgSlug,
  skills,
  tab,
}: {
  onTabChange: (tab: SkillTab) => void;
  orgSlug: string;
  skills: SkillCard[];
  tab: SkillTab;
}) {
  return (
    <section className="mx-auto flex h-full w-full max-w-3xl flex-col justify-start overflow-y-auto px-5 pt-8 pb-40 sm:justify-center sm:overflow-visible sm:pt-0 md:px-10 md:pb-36">
      <div className="mb-8 text-center">
        <h1 className="font-medium text-2xl text-foreground tracking-normal md:text-3xl">
          Ready when you are.
        </h1>
      </div>

      <Tabs
        onValueChange={(value) => onTabChange(value as SkillTab)}
        value={tab}
      >
        <TabsList className="h-10 bg-transparent p-0">
          <TabsTrigger
            className="h-11 rounded-xl px-3 text-sm data-[state=active]:bg-muted sm:h-9"
            value="recent"
          >
            Recent skills
          </TabsTrigger>
          <TabsTrigger
            className="h-11 rounded-xl px-3 text-sm data-[state=active]:bg-muted sm:h-9"
            value="explore"
          >
            Explore skills
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-4 grid gap-3">
        {skills.length > 0 ? (
          skills.map((skill) => (
            <Link
              className="group flex min-h-20 min-w-0 items-center gap-4 rounded-2xl border border-border bg-background px-4 py-3 transition-colors hover:bg-muted/50 sm:min-h-24"
              href={`/${orgSlug}/skills/${skill.slug}` as Route}
              key={skill.slug}
            >
              <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground sm:size-14">
                <Box className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-base text-foreground">
                  {skill.name}
                </span>
                <span className="mt-1 block overflow-hidden text-ellipsis text-muted-foreground text-sm [-webkit-box-orient:vertical] [-webkit-line-clamp:2] [display:-webkit-box]">
                  {skill.description}
                </span>
              </span>
            </Link>
          ))
        ) : (
          <div className="rounded-2xl border border-border bg-background px-4 py-6 text-muted-foreground text-sm">
            No skills indexed yet.
          </div>
        )}
      </div>
    </section>
  );
}

function WorkspaceAssistantMessagePart({
  isStreaming,
  part,
}: {
  isStreaming: boolean;
  part: UIMessage["parts"][number];
}) {
  if (part.type === "text") {
    return <MessageResponse>{part.text}</MessageResponse>;
  }

  if (part.type === "reasoning") {
    return (
      <Reasoning defaultOpen={isStreaming} isStreaming={isStreaming}>
        <ReasoningTrigger />
        <ReasoningContent>{part.text}</ReasoningContent>
      </Reasoning>
    );
  }

  if (isToolPart(part)) {
    return (
      <Tool defaultOpen={part.state !== "output-available"}>
        {part.type === "dynamic-tool" ? (
          <ToolHeader
            state={part.state}
            toolName={part.toolName}
            type={part.type}
          />
        ) : (
          <ToolHeader state={part.state} type={part.type} />
        )}
        <ToolContent>
          <ToolInput input={part.input} />
          <ToolOutput errorText={part.errorText} output={part.output} />
        </ToolContent>
      </Tool>
    );
  }

  if (part.type === "source-url") {
    const source = part as { title?: string; url?: string };
    if (!source.url) {
      return null;
    }
    return (
      <a
        className="text-muted-foreground text-sm underline underline-offset-4"
        href={source.url}
        rel="noreferrer"
        target="_blank"
      >
        {source.title ?? source.url}
      </a>
    );
  }

  if (part.type === "source-document") {
    const source = part as { filename?: string; title?: string };
    return (
      <div className="text-muted-foreground text-sm">
        Source: {source.title ?? source.filename ?? "Document"}
      </div>
    );
  }

  if (part.type === "file") {
    const file = part as {
      filename?: string;
      mediaType?: string;
      url?: string;
    };
    const label = file.filename ?? file.mediaType ?? "File";
    if (file.url) {
      return (
        <a
          className="text-muted-foreground text-sm underline underline-offset-4"
          href={file.url}
          rel="noreferrer"
          target="_blank"
        >
          {label}
        </a>
      );
    }
    return <div className="text-muted-foreground text-sm">{label}</div>;
  }

  if (part.type === "step-start") {
    return null;
  }

  if (part.type.startsWith("data-")) {
    return (
      <div className="text-muted-foreground text-sm">
        {formatPartLabel(part.type.slice("data-".length))} data received
      </div>
    );
  }

  return (
    <div className="text-muted-foreground text-sm">
      {formatPartLabel(part.type)} received
    </div>
  );
}

function ChatComposer({
  disabled,
  error,
  onSubmit,
  onTextChange,
  status,
  stop,
  text,
}: {
  disabled: boolean;
  error: Error | undefined;
  onSubmit: (message: PromptInputMessage) => Promise<void>;
  onTextChange: (text: string) => void;
  status: ChatStatus;
  stop: () => void;
  text: string;
}) {
  const isGenerating = status === "submitted" || status === "streaming";
  const submitDisabled =
    !isGenerating && (disabled || text.trim().length === 0);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {error && (
        <p className="mb-2 px-3 text-destructive text-sm">{error.message}</p>
      )}
      <PromptInput
        className="rounded-[1.75rem] border border-border bg-background shadow-sm [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input-group]]:shadow-none dark:[&_[data-slot=input-group]]:bg-transparent"
        onSubmit={onSubmit}
      >
        <PromptInputBody>
          <PromptInputTextarea
            className="min-h-16 px-5 py-4 text-base"
            disabled={disabled}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Ask Lightfield"
            value={text}
          />
        </PromptInputBody>
        <PromptInputFooter className="px-3 pb-3">
          <PromptInputTools />
          <PromptInputSubmit
            aria-label={isGenerating ? "Stop generating" : "Send message"}
            className="size-11 rounded-2xl sm:size-8"
            disabled={submitDisabled}
            onStop={stop}
            status={status}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

interface SkillCard {
  description: string;
  name: string;
  slug: string;
}

function toSkillCard(skill: Skill): SkillCard {
  return {
    description: skill.description ?? "Open this skill.",
    name: skill.name ?? skill.slug,
    slug: skill.slug,
  };
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

function isToolPart(part: UIMessage["parts"][number]): part is ToolPart {
  return (
    "state" in part &&
    (part.type === "dynamic-tool" || part.type.startsWith("tool-"))
  );
}

function formatPartLabel(value: string) {
  return value.split(/[-_]/g).filter(Boolean).join(" ");
}

function getConversationTitle(
  messages: ReturnType<typeof useChat>["messages"]
) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  const firstText = firstUserMessage?.parts.find(
    (part) => part.type === "text"
  );

  if (!firstText?.text) {
    return "New chat";
  }

  return firstText.text;
}
