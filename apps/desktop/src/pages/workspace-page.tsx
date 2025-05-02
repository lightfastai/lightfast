import { useCallback, useState } from "react";
import { RootLayout } from "@/components/root-layout";
import { registry } from "@/providers/ai-provider";
import { trpc } from "@/trpc";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Send, Sparkles } from "lucide-react";

import { generateText } from "@repo/ai";
import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function WorkspacePage() {
  const { workspaceId } = useParams({ from: "/workspace/$workspaceId" });
  const { data: workspace } = useQuery(
    trpc.tenant.workspace.get.queryOptions({ workspaceId }),
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim() || isLoading) return;

      const userMessage: Message = { role: "user", content: input };
      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const response = await generateText({
          model: registry.languageModel("openai:gpt-4o-mini"),
          messages: [...messages, userMessage].map((msg) => ({
            role: msg.role,
            content: msg.content,
          })),
          temperature: 0.7,
          maxTokens: 1000,
        });

        if (typeof response === "string") {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: response },
          ]);
        }
      } catch (error) {
        console.error("Failed to generate response:", error);
      } finally {
        setIsLoading(false);
      }
    },
    [input, isLoading, messages],
  );

  return (
    <RootLayout>
      <div className="flex min-h-screen flex-col items-center p-4">
        <div className="mb-8 text-center">
          <h1 className="flex items-center justify-center font-serif text-4xl text-gray-100">
            <Sparkles className="mr-3 size-5 text-orange-500" />
            {workspace?.name}
          </h1>
        </div>

        <div className="flex w-full max-w-3xl flex-1 flex-col gap-4">
          <div className="flex-1 space-y-4 overflow-y-auto rounded-lg bg-gray-900/50 p-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${
                  message.role === "assistant" ? "justify-start" : "justify-end"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-4 py-2 ${
                    message.role === "assistant"
                      ? "bg-gray-800 text-gray-100"
                      : "bg-orange-500 text-white"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading}>
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>
    </RootLayout>
  );
}
