import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "~/components/ui/buttons";
import { AppIcons } from "~/components/ui/app-icons";
import { trpc } from "~/utils/api";
import { randomUUID } from "~/utils/uuid";
import { LegendList } from "@legendapp/list";

function textFromParts(parts: unknown): string {
  try {
    if (Array.isArray(parts)) {
      const texts = parts
        .map((p) => (p && typeof p === "object" && (p as any).type === "text" ? (p as any).text : null))
        .filter((t): t is string => typeof t === "string");
      if (texts.length > 0) return texts.join(" ");
    }
    return JSON.stringify(parts);
  } catch {
    return "";
  }
}

export default function ChatDetailPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = id as string;
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);

  const sessionQuery = useQuery({
    ...trpc.session.getMetadata.queryOptions({ sessionId }),
  });

  const messagesQuery = useQuery({
    ...trpc.message.list.queryOptions({ sessionId }),
  });

  const setPinned = useMutation({
    ...trpc.session.setPinned.mutationOptions(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: trpc.session.getMetadata.queryOptions({ sessionId }).queryKey });
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
  const messages = messagesQuery.data ?? [];

  const loading = sessionQuery.fetchStatus === "fetching" && !session;

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Chat" }} />
      <View className="h-full bg-background">
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
                  setPinned.mutate({ sessionId, pinned: !session.pinned });
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

        {/* Body */}
        {loading ? (
          <View className="mt-8 items-center">
            <ActivityIndicator color="#808080" />
          </View>
        ) : (
          <View className="h-full px-4 pb-6">
            {messages.length === 0 ? (
              <View className="mt-6 rounded-lg border border-dashed border-muted/40 bg-muted/40 p-4">
                <Text className="text-lg font-semibold text-foreground">No messages</Text>
                <Text className="mt-2 text-muted-foreground">Start a new chat from the menu.</Text>
              </View>
            ) : (
              <LegendList
                data={messages}
                estimatedItemSize={64}
                ItemSeparatorComponent={() => <View className="h-2" />}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => {
                  const isUser = item.role === "user";
                  const content = textFromParts(item.parts);
                  return (
                    <View
                      className={
                        isUser
                          ? "self-end max-w-[85%] rounded-lg border border-border bg-secondary px-3 py-2"
                          : "self-start max-w-[85%] rounded-lg border border-border bg-card px-3 py-2"
                      }
                    >
                      <Text className="mb-1 text-[11px] text-muted-foreground">{isUser ? "You" : "Assistant"}</Text>
                      <Text className="text-foreground">{content}</Text>
                    </View>
                  );
                }}
              />
            )}
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
