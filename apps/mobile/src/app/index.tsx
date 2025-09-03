import React from "react";
import { Stack } from "expo-router";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomePage() {
  return (
    <SafeAreaView className="bg-background">
      <Stack.Screen options={{ title: "Chat App" }} />
      <View className="bg-background h-full w-full">
        <View className="flex h-full w-full items-center justify-center p-4">
          <Text className="text-foreground pb-2 text-5xl font-bold">
            Lightfast
          </Text>
          <Text className="text-muted-foreground text-xl">Chat Mobile App</Text>
          <Text className="text-muted-foreground mt-4 text-center text-base">
            Mobile app for Lightfast Chat - Coming Soon!
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
