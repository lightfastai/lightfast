import React from "react";
import { Stack, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function PostPage() {
  const { id } = useLocalSearchParams<{ id: string }>();

  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Post Details" }} />
      <View className="flex h-full w-full p-4">
        <Text className="text-foreground text-2xl font-bold">Post #{id}</Text>
        <Text className="text-muted-foreground mt-4">
          This is a placeholder page. Chat functionality will be implemented
          here.
        </Text>
      </View>
    </SafeAreaView>
  );
}
