"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notFound } from "next/navigation";
import type {
  InfiniteData,
  QueryFunction,
  QueryKey,
  UseInfiniteQueryResult,
} from "@tanstack/react-query";
import {
  useSuspenseInfiniteQuery,
  useQueryClient,
  useSuspenseQueries,
} from "@tanstack/react-query";
import { ChatInterface } from "../../_components/chat-interface";
import { useModelSelection } from "~/hooks/use-model-selection";
import { useTRPC } from "@repo/chat-trpc/react";
import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";
import { DataStreamProvider } from "~/hooks/use-data-stream";
import { getMessageType } from "~/lib/billing/message-utils";
import { MessageType } from "@repo/chat-billing";
import { produce } from "immer";
import { captureException, captureMessage } from "@sentry/nextjs";
import { Button } from "@repo/ui/components/ui/button";
import {
  getTRPCErrorMessage,
  isNotFound,
  isUnauthorized,
} from "~/lib/trpc-errors";
import {
  MESSAGE_BACKGROUND_CHAR_BUDGET,
  MESSAGE_FALLBACK_PAGE_SIZE,
  MESSAGE_HISTORY_HARD_CAP,
  MESSAGE_INITIAL_CHAR_BUDGET,
  MESSAGE_PAGE_GC_TIME,
  MESSAGE_PAGE_STALE_TIME,
} from "~/lib/messages/loading";
import type { MessageHistoryFetchState } from "~/lib/messages/loading";
import type { ChatRouterOutputs } from "@api/chat";
import { ChatLoadingSkeleton } from "./chat-loading-skeleton";
import { computeMessageCharCount } from "@repo/chat-ai-types";

interface ExistingSessionChatProps {
  sessionId: string;
  agentId: string;
}

type MessagePage = ChatRouterOutputs["message"]["listInfinite"];
type MessageCursor = NonNullable<MessagePage["nextCursor"]>;

type MessagesInfiniteData = InfiniteData<MessagePage, MessageCursor | null>;

/**
 * Client component that loads existing session data and renders the chat interface.
 * React Query handles fetching; cached conversations render instantly after the first load.
 */
export function ExistingSessionChat({
  sessionId,
  agentId,
}: ExistingSessionChatProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Model selection (authenticated users only have model selection)
  const { selectedModelId } = useModelSelection(true);

  // Get query options for cache updates
  const messagesInfiniteOptions = trpc.message.listInfinite.infiniteQueryOptions({
    sessionId,
    limitChars: MESSAGE_INITIAL_CHAR_BUDGET,
    limitMessages: MESSAGE_FALLBACK_PAGE_SIZE,
  });
  const usageQueryOptions = trpc.usage.checkLimits.queryOptions({});
  const sessionQueryOptions = trpc.session.getMetadata.queryOptions({ sessionId });

  const messagesQueryKey = messagesInfiniteOptions.queryKey;

  const baseQueryFn = messagesInfiniteOptions.queryFn;

  if (!baseQueryFn) {
    throw new Error("Missing queryFn for message list infinite query");
  }

  const suspenseMessagesQuery = useSuspenseInfiniteQuery({
    queryKey: messagesQueryKey,
    queryFn: baseQueryFn as QueryFunction<
      MessagePage,
      QueryKey,
      MessageCursor | null
    >,
    meta: messagesInfiniteOptions.meta,
    initialPageParam: null as MessageCursor | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: MESSAGE_PAGE_STALE_TIME,
    gcTime: MESSAGE_PAGE_GC_TIME,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    retry: 2,
  });

  const messagesQuery = suspenseMessagesQuery as UseInfiniteQueryResult<
    MessagesInfiniteData,
    unknown
  >;

  // Batch lightweight queries together with suspense for instant hydration.
  const [{ data: user }, { data: session }, { data: usageLimits }] =
    useSuspenseQueries({
      queries: [
        {
          ...trpc.user.getUser.queryOptions(),
          staleTime: 5 * 60 * 1000, // Cache user data for 5 minutes
          refetchOnMount: false, // Prevent blocking navigation
          refetchOnWindowFocus: false, // Don't refetch on window focus
        },
        {
          ...sessionQueryOptions,
          staleTime: 30 * 1000, // Consider session metadata fresh for 30 seconds
          gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
          refetchOnWindowFocus: false, // Don't refetch on focus
          refetchOnMount: false, // Don't refetch on mount to prevent blocking navigation
        },
        {
          ...usageQueryOptions,
          staleTime: 60 * 1000, // Consider usage data fresh for 1 minute (we update optimistically)
          gcTime: 10 * 60 * 1000, // Keep in cache for 10 minutes
          refetchOnMount: false, // Don't refetch on mount to prevent blocking
          refetchOnWindowFocus: false, // Don't refetch on focus since we update optimistically
        },
      ],
    });

  if (messagesQuery.isError) {
    const error = messagesQuery.error;

    if (isNotFound(error)) {
      notFound();
    }

    if (isUnauthorized(error)) {
      return (
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-sm text-center text-sm text-muted-foreground">
            You no longer have access to this chat.
          </div>
        </div>
      );
    }

    captureException(error, {
      tags: { component: "ExistingSessionChat", query: "message.listInfinite" },
      extra: { sessionId },
    });

    const handleRetry = () => {
      void messagesQuery.refetch();
    };

    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="flex max-w-sm flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground">
            {getTRPCErrorMessage(error)}
          </p>
          <Button size="sm" variant="outline" onClick={handleRetry}>
            Retry loading chat
          </Button>
        </div>
      </div>
    );
  }

  if (!messagesQuery.data) {
    return <ChatLoadingSkeleton />;
  }

  const messagesData = messagesQuery.data;

  const backgroundFetchRef = useRef(false);

  const historyStats = useMemo(() => {
    let totalChars = 0;

    for (const page of messagesData.pages) {
      const pageCharCount =
        typeof page.pageCharCount === "number"
          ? page.pageCharCount
          : page.items.reduce((sum, item) => {
              const itemCharCount =
                typeof item.metadata.charCount === "number"
                  ? item.metadata.charCount
                  : 0;
              return sum + itemCharCount;
            }, 0);

      totalChars += pageCharCount;
    }

    return {
      totalChars,
    };
  }, [messagesData.pages]);
  const effectiveBackgroundBudget = MESSAGE_BACKGROUND_CHAR_BUDGET;
  const effectiveHardCap = MESSAGE_HISTORY_HARD_CAP;

  const hasHitBackgroundBudget = historyStats.totalChars >= effectiveBackgroundBudget;
  const hasHitHardCap = historyStats.totalChars >= effectiveHardCap;

  const [historyFetchState, setHistoryFetchState] =
    useState<MessageHistoryFetchState>("idle");

  const {
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = messagesQuery;

  useEffect(() => {
    if (!hasNextPage) {
      setHistoryFetchState("complete");
      return;
    }

    if (isFetchingNextPage || backgroundFetchRef.current) {
      setHistoryFetchState("prefetching");
      return;
    }

    if (hasHitHardCap) {
      if (historyFetchState !== "capped") {
        setHistoryFetchState("capped");
        captureMessage("chat.history.fetch.capped", {
          level: "info",
          extra: {
            sessionId,
            totalChars: historyStats.totalChars,
            hardCap: effectiveHardCap,
          },
        });
      }
      return;
    }

    if (hasHitBackgroundBudget) {
      if (historyFetchState !== "saturated") {
        setHistoryFetchState("saturated");
        captureMessage("chat.history.fetch.saturated", {
          level: "info",
          extra: {
            sessionId,
            totalChars: historyStats.totalChars,
            budget: effectiveBackgroundBudget,
          },
        });
      }
      return;
    }

    backgroundFetchRef.current = true;
    setHistoryFetchState("prefetching");

    void fetchNextPage()
      .catch((error) => {
        captureException(error, {
          tags: {
            component: "ExistingSessionChat",
            query: "message.listInfinite",
            phase: "background-fetch",
          },
          extra: {
            sessionId,
          },
        });
      })
      .finally(() => {
        backgroundFetchRef.current = false;
      });
  }, [
    effectiveBackgroundBudget,
    effectiveHardCap,
    hasHitBackgroundBudget,
    hasHitHardCap,
    historyFetchState,
    historyStats.totalChars,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    sessionId,
  ]);

  // Redirect to not-found for temporary sessions - they shouldn't be directly accessible
  useEffect(() => {
    if (session.isTemporary) {
      notFound();
    }
  }, [session.isTemporary]);

  if (session.isTemporary) {
    return null;
  }

  const messages = useMemo<LightfastAppChatUIMessage[]>(() => {
    return messagesData.pages
      .slice()
      .reverse()
      .flatMap((page) =>
        page.items.map<LightfastAppChatUIMessage>((msg) => {
          const metadataFromPage: LightfastAppChatUIMessage["metadata"] =
            msg.metadata;
          const baseMetadata = { ...metadataFromPage };
          const metadataModelId =
            msg.modelId ??
            (typeof baseMetadata.modelId === "string"
              ? baseMetadata.modelId
              : undefined);

          return {
            id: msg.id,
            role: msg.role,
            parts: msg.parts,
            metadata: {
              ...baseMetadata,
              sessionId,
              modelId: metadataModelId,
            },
          };
        }),
      );
  }, [messagesData.pages, sessionId]);

  const initialMessages = useMemo<LightfastAppChatUIMessage[]>(
    () => [...messages],
    [messages],
  );

  const updateMessagesCache = (
    updater: (draft: MessagesInfiniteData) => void,
  ) => {
    queryClient.setQueryData<MessagesInfiniteData>(messagesQueryKey, (oldData) => {
      if (!oldData) return oldData;
      return produce(oldData, updater);
    });
  };

  const incrementPageStats = useCallback(
    (page: MessagePage, charDelta: number, messageDelta: number) => {
      page.pageCharCount =
        typeof page.pageCharCount === "number"
          ? page.pageCharCount + charDelta
          : charDelta;
      page.pageMessageCount =
        typeof page.pageMessageCount === "number"
          ? page.pageMessageCount + messageDelta
          : messageDelta;
    },
    [],
  );

  const decrementPageStats = useCallback(
    (page: MessagePage, charDelta: number, messageDelta: number) => {
      const currentCharCount =
        typeof page.pageCharCount === "number" ? page.pageCharCount : 0;
      const currentMessageCount =
        typeof page.pageMessageCount === "number" ? page.pageMessageCount : 0;

      page.pageCharCount = Math.max(0, currentCharCount - charDelta);
      page.pageMessageCount = Math.max(0, currentMessageCount - messageDelta);
    },
    [],
  );

  const handleSessionCreation = (_firstMessage: string) => {
    // Existing sessions don't need creation
  };

  return (
    <DataStreamProvider>
      <ChatInterface
        key={`${agentId}-${sessionId}`}
        agentId={agentId}
        session={session}
        initialMessages={initialMessages}
        isNewSession={false}
        handleSessionCreation={handleSessionCreation}
        user={user}
        usageLimits={usageLimits}
        onNewUserMessage={(userMessage) => {
          const metrics = computeMessageCharCount(userMessage.parts);
          updateMessagesCache((draft) => {
            const lastIndex = draft.pages.length - 1;
            if (lastIndex < 0) {
              draft.pages.push({
                items: [
                  {
                    id: userMessage.id,
                    role: userMessage.role,
                    parts: userMessage.parts,
                    modelId: selectedModelId,
                    metadata: {
                      sessionId,
                      createdAt: new Date().toISOString(),
                      charCount: metrics.charCount,
                      tokenCount: metrics.tokenCount,
                      previewCharCount: undefined,
                      tooLarge: false,
                      hasFullContent: true,
                    },
                  },
                ],
                nextCursor: null,
                pageCharCount: metrics.charCount,
                pageMessageCount: 1,
                exhaustedCharBudget: false,
                exhaustedMessageBudget: false,
              });
              draft.pageParams.push(null);
              return;
            }

            const latestPage = draft.pages[lastIndex];
            if (!latestPage) {
              return;
            }
            if (
              latestPage.items.some((msg) => msg.id === userMessage.id)
            ) {
              return;
            }

            latestPage.items.push({
              id: userMessage.id,
              role: userMessage.role,
              parts: userMessage.parts,
              modelId: selectedModelId,
              metadata: {
                sessionId,
                createdAt: new Date().toISOString(),
                charCount: metrics.charCount,
                tokenCount: metrics.tokenCount,
                previewCharCount: undefined,
                tooLarge: false,
                hasFullContent: true,
              },
            });
            incrementPageStats(latestPage, metrics.charCount, 1);
          });

          // Optimistically update usage for immediate UI feedback (prevents spam clicking)
          // Server-side reservation system provides authoritative validation
          queryClient.setQueryData(
            usageQueryOptions.queryKey,
            (oldUsageData) => {
              if (!oldUsageData) return oldUsageData;

              const messageType = getMessageType(selectedModelId);
              const isPremium = messageType === MessageType.PREMIUM;

              // Optimistic decrement to prevent spam clicking and keep billing view in sync
              return produce(oldUsageData, (draft) => {
                if (isPremium) {
                  draft.remainingQuota.premiumMessages = Math.max(
                    0,
                    draft.remainingQuota.premiumMessages - 1,
                  );
                  draft.usage.premiumMessages += 1;
                  const premiumLimit = draft.limits.premiumMessages;
                  draft.exceeded.premiumMessages =
                    draft.usage.premiumMessages >= premiumLimit;
                } else {
                  draft.remainingQuota.nonPremiumMessages = Math.max(
                    0,
                    draft.remainingQuota.nonPremiumMessages - 1,
                  );
                  draft.usage.nonPremiumMessages += 1;
                  const standardLimit = draft.limits.nonPremiumMessages;
                  draft.exceeded.nonPremiumMessages =
                    draft.usage.nonPremiumMessages >= standardLimit;
                }
              });
            },
          );
        }}
        onNewAssistantMessage={(assistantMessage) => {
          const metrics = computeMessageCharCount(assistantMessage.parts);
          const assistantModelId = assistantMessage.metadata?.modelId ?? null;

          updateMessagesCache((draft) => {
            const lastIndex = draft.pages.length - 1;
            if (lastIndex < 0) {
              draft.pages.push({
                items: [
                  {
                    id: assistantMessage.id,
                    role: assistantMessage.role,
                    parts: assistantMessage.parts,
                    modelId: assistantModelId,
                    metadata: {
                      sessionId,
                      createdAt: new Date().toISOString(),
                      charCount: metrics.charCount,
                      tokenCount: metrics.tokenCount,
                      previewCharCount: undefined,
                      tooLarge: false,
                      hasFullContent: true,
                    },
                  },
                ],
                nextCursor: null,
                pageCharCount: metrics.charCount,
                pageMessageCount: 1,
                exhaustedCharBudget: false,
                exhaustedMessageBudget: false,
              });
              draft.pageParams.push(null);
              return;
            }

            const latestPage = draft.pages[lastIndex];
            if (!latestPage) {
              return;
            }
            if (
              latestPage.items.some((msg) => msg.id === assistantMessage.id)
            ) {
              return;
            }

            latestPage.items.push({
              id: assistantMessage.id,
              role: assistantMessage.role,
              parts: assistantMessage.parts,
              modelId: assistantModelId,
              metadata: {
                sessionId,
                createdAt: new Date().toISOString(),
                charCount: metrics.charCount,
                tokenCount: metrics.tokenCount,
                previewCharCount: undefined,
                tooLarge: false,
                hasFullContent: true,
              },
            });
            incrementPageStats(latestPage, metrics.charCount, 1);
          });

          // Trigger background refetch to sync with database
          // This ensures eventual consistency with the persisted data
          void queryClient.invalidateQueries({
            queryKey: messagesQueryKey,
          });

          // Also refetch usage data to sync with server-side tracking
          void queryClient.invalidateQueries({
            queryKey: usageQueryOptions.queryKey,
          });
        }}
        onAssistantStreamError={({ messageId }) => {
          if (!messageId) return;
          updateMessagesCache((draft) => {
            draft.pages.forEach((page) => {
              page.items = page.items.filter((msg) => {
                if (msg.id !== messageId) {
                  return true;
                }

                const messageMetadata: LightfastAppChatUIMessage["metadata"] =
                  msg.metadata;
                const metadataCharCount =
                  typeof messageMetadata.charCount === "number"
                    ? messageMetadata.charCount
                    : computeMessageCharCount(msg.parts).charCount;

                decrementPageStats(page, metadataCharCount, 1);
                return false;
              });
            });
          });
        }}
        onQuotaError={(modelId) => {
          // Rollback optimistic quota update when server rejects
          queryClient.setQueryData(
            usageQueryOptions.queryKey,
            (oldUsageData) => {
              if (!oldUsageData) return oldUsageData;

              const messageType = getMessageType(modelId);
              const isPremium = messageType === MessageType.PREMIUM;

              // Rollback: increment quota back
              return produce(oldUsageData, (draft) => {
                if (isPremium) {
                  draft.remainingQuota.premiumMessages += 1;
                  draft.usage.premiumMessages = Math.max(
                    0,
                    draft.usage.premiumMessages - 1,
                  );
                  const premiumLimit = draft.limits.premiumMessages;
                  draft.exceeded.premiumMessages =
                    draft.usage.premiumMessages >= premiumLimit;
                } else {
                  draft.remainingQuota.nonPremiumMessages += 1;
                  draft.usage.nonPremiumMessages = Math.max(
                    0,
                    draft.usage.nonPremiumMessages - 1,
                  );
                  const standardLimit = draft.limits.nonPremiumMessages;
                  draft.exceeded.nonPremiumMessages =
                    draft.usage.nonPremiumMessages >= standardLimit;
                }
              });
            },
          );
        }}
        onResumeStateChange={(active) => {
          if (active) {
            return;
          }
          queryClient.setQueryData(sessionQueryOptions.queryKey, (oldSession) => {
            if (!oldSession) return oldSession;
            if (oldSession.activeStreamId == null) return oldSession;
            return { ...oldSession, activeStreamId: null };
          });
        }}
      />
    </DataStreamProvider>
  );
}
