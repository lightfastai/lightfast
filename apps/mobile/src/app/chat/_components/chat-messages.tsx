import { Text, View } from "react-native";
import { LegendList } from "@legendapp/list";
import type { LightfastAppChatUIMessage } from "@repo/chat-ai-types";
import { isTextPart } from "@repo/chat-ai-types";

function textFromParts(parts: LightfastAppChatUIMessage["parts"]): string {
  try {
    const texts = parts
      .filter(isTextPart)
      .map((p) => p.text)
      .filter((t): t is string => typeof t === "string");
    if (texts.length > 0) return texts.join(" ");
    return "";
  } catch {
    return "";
  }
}

export function ChatMessages({ messages }: { messages: LightfastAppChatUIMessage[] }) {
  if (!messages || messages.length === 0) {
    return (
      <View className="mt-6 rounded-lg border border-dashed border-muted/40 bg-muted/40 p-4">
        <Text className="text-lg font-semibold text-foreground">No messages</Text>
        <Text className="mt-2 text-muted-foreground">Start a new chat from the menu.</Text>
      </View>
    );
  }

  return (
    <LegendList
      data={messages}
      estimatedItemSize={64}
      ItemSeparatorComponent={() => <View className="h-4" />}
      keyExtractor={(item) => item.id}
      style={{ flex: 1, minHeight: 0 }}
      contentContainerStyle={{ paddingBottom: 16 }}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => {
        const isUser = item.role === "user";
        const content = textFromParts(item.parts);
        return (
          <View className={isUser ? "items-end" : "items-start"}>
            <View className={isUser ? "max-w-[85%] rounded-2xl px-3 py-2 bg-primary" : "max-w-[85%] rounded-2xl px-3 py-2"}>
              <Text className={isUser ? "text-primary-foreground" : "text-foreground"}>{content}</Text>
            </View>
          </View>
        );
      }}
    />
  );
}
