import { useMemo, useState } from "react";
import { Pressable, Text, View, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";

import type { AgentId, LightfastAppChatUIMessage } from "@repo/chat-ai-types";

import { AppIcons } from "~/components/ui/app-icons";
import { trpc } from "~/utils/api";
import { randomUUID } from "~/utils/uuid";
import { useChatTransport } from "~/hooks/use-chat-transport";
import { ChatMessages } from "./_components/chat-messages";
import { PromptInput } from "./_components/prompt-input";

const DEFAULT_AGENT_ID: AgentId = "c010";
const DEFAULT_MODEL_ID = "google/gemini-2.5-flash";

export default function ChatDetailPage() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const sessionIdStr = sessionId as string;
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const sessionQuery = useQuery({
    ...trpc.session.getMetadata.queryOptions({ sessionId: sessionIdStr }),
  });

  const messagesQuery = useQuery({
    ...trpc.message.list.queryOptions({ sessionId: sessionIdStr }),
  });

  const setPinned = useMutation({
    ...trpc.session.setPinned.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.session.getMetadata.queryOptions({ sessionId: sessionIdStr }).queryKey });
      void queryClient.invalidateQueries({ queryKey: trpc.session.list.queryOptions({ limit: 20 }).queryKey });
    },
  });

  const createSession = useMutation({
    ...trpc.session.create.mutationOptions(),
    onSuccess: (res) => {
      setMenuOpen(false);
      router.replace(`/chat/${res.id}`);
    },
  });

  const session = sessionQuery.data;
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const initialMessages = useMemo<LightfastAppChatUIMessage[]>(
    () =>
      (messagesQuery.data ?? []).map((message) => ({
        id: message.id,
        role: message.role,
        parts: message.parts as LightfastAppChatUIMessage["parts"],
        metadata: {
          modelId: message.modelId ?? undefined,
          sessionId: sessionIdStr,
        },
      })),
    [messagesQuery.data, sessionIdStr],
  );

  const transport = useChatTransport({
    sessionId: sessionIdStr,
    agentId: DEFAULT_AGENT_ID,
    webSearchEnabled,
  });

  const {
    messages,
    sendMessage,
    status,
    error: chatError,
  } = useChat<LightfastAppChatUIMessage>({
    id: `${DEFAULT_AGENT_ID}-${sessionIdStr}`,
    messages: initialMessages,
    transport,
    onError: (err) => {
      console.error("[ChatDetail] sendMessage failed", err);
    },
    onFinish: () => {
      void queryClient.invalidateQueries({
        queryKey: trpc.message.list.queryOptions({ sessionId: sessionIdStr }).queryKey,
      });
    },
  });

  const handleSend = async (input: string) => {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessageId = randomUUID();
    const userMessage: LightfastAppChatUIMessage = {
      id: userMessageId,
      role: "user",
      parts: [{ type: "text", text: trimmed }],
      metadata: {
        sessionId: sessionIdStr,
        modelId: DEFAULT_MODEL_ID,
      },
    };

    await sendMessage(userMessage, {
      body: {
        userMessageId,
        modelId: DEFAULT_MODEL_ID,
        webSearchEnabled,
      },
    });
  };


  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
      <Stack.Screen options={{ title: "Chat" }} />
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="relative flex-row items-center justify-between px-4 py-2">
          <Pressable accessibilityRole="button" onPress={() => router.back()} className="p-1">
            <AppIcons.ChevronLeft color="#fff" />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => setMenuOpen((v) => !v)} className="p-1">
            <AppIcons.EllipsisVertical color="#fff" />
          </Pressable>

          {menuOpen ? (
            <View className="absolute right-4 top-14 z-10 w-40 rounded-md border border-border bg-card p-1">
              <Pressable
                className="rounded-md px-3 py-2"
                onPress={() => {
                  setMenuOpen(false);
                  if (!session) return;
                  setPinned.mutate({ sessionId: sessionIdStr, pinned: !session.pinned });
                }}
              >
                <Text className="text-foreground">Pin</Text>
              </Pressable>
              <Pressable
                className="rounded-md px-3 py-2"
                onPress={() => {
                  const newId = randomUUID();
                  createSession.mutate({ id: newId });
                }}
              >
                <Text className="text-foreground">New Chat</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
        {/* Body + Input with keyboard avoidance */}
        <KeyboardAvoidingView
          behavior={Platform.select({ ios: "padding", android: undefined })}
          className="flex-1"
        >
          <View className="flex-1">
            <View className="flex-1 px-4 pt-3 pb-0">
              <ChatMessages messages={messages} />
              {chatError ? (
                <View className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2">
                  <Text className="text-sm text-destructive">{chatError.message}</Text>
                </View>
              ) : null}
            </View>
            <PromptInput
              onSend={handleSend}
              disabled={status === "streaming" || status === "submitted"}
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={() => setWebSearchEnabled((prev) => !prev)}
            />
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
