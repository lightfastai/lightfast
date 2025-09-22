import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function PromptInput({ onSend, disabled }: { onSend: (text: string) => void; disabled?: boolean }) {
  const [input, setInput] = useState("");
  const [searchEnabled, setSearchEnabled] = useState(false);
  const insets = useSafeAreaInsets();

  const handleSend = () => {
    if (disabled) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setInput("");
  };

  return (
    <View className="w-full bg-card">
      {/* Text area */}
      <View className="px-4 pt-3 pb-2">
        <TextInput
          placeholder="Send a message"
          placeholderTextColor="#9CA3AF"
          multiline
          value={input}
          onChangeText={setInput}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit
          textAlignVertical="top"
          editable={!disabled}
          className="text-base leading-6 text-foreground"
          style={{ minHeight: 56, padding: 0 }}
        />
      </View>

      {/* Toolbar actions */}
      <View
        className="flex-row items-center gap-3 px-4"
        style={{ paddingBottom: (insets.bottom ?? 0) + 8, paddingTop: 4 }}
      >
        <Pressable
          accessibilityRole="button"
          onPress={() => setSearchEnabled((prev) => !prev)}
          className={
            searchEnabled
              ? "rounded-full bg-primary px-4 py-2"
              : "rounded-full border border-border/60 px-4 py-2"
          }
        >
          <Text
            className={
              searchEnabled ? "text-primary-foreground text-sm" : "text-muted-foreground text-sm"
            }
          >
            Search
          </Text>
        </Pressable>
        <View className="flex-1" />
      </View>
    </View>
  );
}
