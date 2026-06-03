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
  MessageActions,
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
import { Tabs, TabsList, TabsTrigger } from "@repo/ui/components/ui/tabs";
import { cn } from "@repo/ui/lib/utils";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import {
  type ChatStatus,
  DefaultChatTransport,
  type UIMessage,
} from "@vendor/ai";
import { ArrowUp, Box } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useParams } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTRPC } from "~/trpc/react";
import { extractMessageText, MessageCopyButton } from "./message-copy-button";

type SkillsListResult = AppRouterOutputs["org"]["workspace"]["skills"]["list"];
type Skill = SkillsListResult["skills"][number];
type SkillTab = "recent" | "explore";
type WorkspaceAssistantConversationResult =
  AppRouterOutputs["org"]["workspace"]["assistant"]["getConversation"];

interface WorkspaceAssistantClientProps {
  initialConversation?: WorkspaceAssistantConversationResult;
}

export function WorkspaceAssistantClient({
  initialConversation,
}: WorkspaceAssistantClientProps) {
  const params = useParams<{ slug: string }>();
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
  const [skillTab, setSkillTab] = useState<SkillTab>("recent");
  const [conversationId, setConversationId] = useState(
    initialConversation?.conversation.publicId
  );
  const [creationError, setCreationError] = useState<Error | undefined>();
  const conversationIdRef = useRef(conversationId);

  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

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

  const { clearError, error, messages, sendMessage, status, stop } = useChat({
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

  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
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
            conversationId: activeConversationId,
          },
        }
      );
      setText("");
    },
    [params.slug, createConversation.mutateAsync, sendMessage, clearError]
  );

  const composer = (
    <ChatComposer
      disabled={composerStatus !== "ready"}
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
          <div className="shrink-0 px-4 pb-5 md:px-8">{composer}</div>
        </>
      ) : (
        <div className="relative min-h-0 flex-1 overflow-y-auto">
          <EmptyChatState
            composer={composer}
            onTabChange={setSkillTab}
            orgSlug={params.slug}
            skills={visibleSkills}
            tab={skillTab}
          />
        </div>
      )}
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

function EmptyChatState({
  composer,
  onTabChange,
  orgSlug,
  skills,
  tab,
}: {
  composer: React.ReactNode;
  onTabChange: (tab: SkillTab) => void;
  orgSlug: string;
  skills: SkillCard[];
  tab: SkillTab;
}) {
  return (
    <section className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center px-5 py-10 md:px-10">
      <div className="mb-6 text-center">
        <h1 className="font-medium text-2xl text-foreground tracking-normal md:text-3xl">
          Ready when you are.
        </h1>
      </div>

      {composer}

      <Tabs
        className="mt-6"
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

const WorkspaceAssistantMessagePart = memo(function WorkspaceAssistantMessagePart({
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
});

export const ChatMessage = memo(function ChatMessage({
  isStreaming,
  message,
}: {
  isStreaming: boolean;
  message: UIMessage;
}) {
  const copyText = extractMessageText(message);
  return (
    <Message className="relative" from={message.role}>
      <MessageContent
        className={cn(
          message.role === "user" &&
            "text-base leading-6 group-[.is-user]:rounded-3xl group-[.is-user]:px-5 group-[.is-user]:py-2",
          message.role === "assistant" &&
            "w-full max-w-none bg-transparent px-0 py-0 text-base leading-7"
        )}
      >
        {message.parts.map((part, index) => (
          <WorkspaceAssistantMessagePart
            isStreaming={isStreaming}
            key={`${message.id}-${index}`}
            part={part}
          />
        ))}
      </MessageContent>
      {copyText ? (
        <MessageActions
          className={cn(
            "absolute top-full mt-2 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100",
            message.role === "user" ? "right-0" : "left-0"
          )}
        >
          <MessageCopyButton text={copyText} />
        </MessageActions>
      ) : null}
    </Message>
  );
});

const ChatComposer = memo(function ChatComposer({
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
        className="rounded-[1.75rem] border border-border/50 bg-secondary shadow-lg [&_[data-slot=input-group]]:rounded-[1.75rem] [&_[data-slot=input-group]]:border-0 [&_[data-slot=input-group]]:bg-transparent [&_[data-slot=input-group]]:shadow-none dark:[&_[data-slot=input-group]]:bg-transparent"
        onSubmit={onSubmit}
      >
        <PromptInputBody>
          <PromptInputTextarea
            className="min-h-9 px-5 py-3 text-base"
            disabled={disabled}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="Ask Lightfield"
            value={text}
          />
        </PromptInputBody>
        <PromptInputFooter className="px-2.5 pb-2.5">
          <PromptInputTools />
          <PromptInputSubmit
            aria-label={isGenerating ? "Stop generating" : "Send message"}
            className="size-8 rounded-full"
            disabled={submitDisabled}
            onStop={stop}
            status={status}
          >
            {status === "ready" ? <ArrowUp className="size-4" /> : undefined}
          </PromptInputSubmit>
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
});

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
