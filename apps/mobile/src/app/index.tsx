import { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Pressable,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useAuth, useUser } from "@clerk/clerk-expo";
import { LegendList } from "@legendapp/list";
import { useQuery } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { SignOutButton } from "~/components/sign-out-button";
import { trpc } from "~/utils/api";

const LIMIT = 20;

function formatUpdatedAt(updatedAt: Date | string) {
  try {
    const value =
      typeof updatedAt === "string" ? new Date(updatedAt) : updatedAt;
    if (Number.isNaN(value.getTime())) return "";
    return value.toLocaleString();
  } catch (error) {
    console.warn("Failed to format updatedAt", error);
    return "";
  }
}

function SessionsList() {
  const { isSignedIn } = useAuth();

  const query = useQuery({
    ...trpc.session.list.queryOptions({
      limit: LIMIT,
    }),
    enabled: isSignedIn,
  });

  const { data: sessions = [] } = query;

  const handleRefetch = useCallback(() => {
    void query.refetch();
  }, [query]);

  if (query.fetchStatus === "fetching" && sessions.length === 0) {
    return (
      <View className="mt-8 flex flex-row items-center justify-center">
        <ActivityIndicator color="#808080" />
        <Text className="ml-2 text-muted-foreground">Loading sessions...</Text>
      </View>
    );
  }

  if (query.error) {
    return (
      <View className="mt-6 rounded-lg border border-destructive/20 bg-destructive/10 p-4">
        <Text className="text-lg font-semibold text-destructive">
          Unable to load sessions
        </Text>
        <Text className="mt-2 text-muted-foreground">
          {query.error.message}
        </Text>
        <TouchableOpacity
          className="mt-4 items-center rounded-md bg-primary px-3 py-2"
          onPress={handleRefetch}
        >
          <Text className="text-foreground">Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (sessions.length === 0) {
    return (
      <View className="mt-6 rounded-lg border border-dashed border-muted/40 bg-muted/40 p-4">
        <Text className="text-lg font-semibold text-foreground">
          No conversations yet
        </Text>
        <Text className="mt-2 text-muted-foreground">
          Start a chat on desktop and it will appear here automatically.
        </Text>
      </View>
    );
  }

  return (
    <LegendList
      data={sessions}
      estimatedItemSize={72}
      ItemSeparatorComponent={() => <View className="h-2" />}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => {
        const sessionTitle =
          item.title && item.title.trim().length > 0
            ? item.title
            : "Untitled conversation";

        return (
          <Pressable className="rounded-lg border border-border bg-card p-4">
            <Text className="text-lg font-semibold text-foreground">
              {sessionTitle}
            </Text>
            <Text className="mt-1 text-sm text-muted-foreground">
              Updated {formatUpdatedAt(item.updatedAt)}
            </Text>
          </Pressable>
        );
      }}
    />
  );
}

export default function HomePage() {
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      void router.replace("/(auth)/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <SafeAreaView className="bg-background">
        <Stack.Screen options={{ title: "Chat" }} />
        <View className="h-full w-full items-center justify-center bg-background">
          <ActivityIndicator color="#808080" />
        </View>
      </SafeAreaView>
    );
  }

  if (!isSignedIn) {
    return null;
  }

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Chat" }} />
      <View className="gap-6 bg-background p-4">
        <View className="items-center gap-2">
          <Text className="text-5xl font-bold text-foreground">
            Lightfast <Text className="text-primary">Chat</Text>
          </Text>
          <Text className="text-center text-sm text-muted-foreground">
            {user?.emailAddresses[0]?.emailAddress ?? ""}
          </Text>
          <SignOutButton className="mt-2 w-full rounded-md bg-accent px-4 py-3" />
        </View>
        <SessionsList />
      </View>
    </SafeAreaView>
  );
}
