import { RootLayout } from "@/components/root-layout";
import { trpc } from "@/trpc";
import { useChat } from "@ai-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { Send } from "lucide-react";

import { Button } from "@repo/ui/components/ui/button";
import { Input } from "@repo/ui/components/ui/input";

export default function WorkspacePage() {
  const { workspaceId } = useParams({ from: "/workspace/$workspaceId" });
  const { data: workspace } = useQuery(
    trpc.tenant.workspace.get.queryOptions({ workspaceId }),
  );

  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: `${import.meta.env.VITE_PUBLIC_LIGHTFAST_API_URL}/api/chat`,
    });

  return (
    <RootLayout>
      <div className="bg-background flex h-screen flex-col">
        {/* Header */}
        <div className="border-border flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600" />
            <span className="text-foreground text-sm font-medium">
              {workspace?.name}
            </span>
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-6">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                    message.role === "user"
                      ? "text-primary-foreground bg-orange-500"
                      : "bg-muted text-foreground"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <div className="bg-muted-foreground h-2 w-2 animate-pulse rounded-full" />
                is thinking...
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-border border-t p-4">
          <div className="mx-auto max-w-2xl">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={handleInputChange}
                placeholder="Ask a follow up..."
                disabled={isLoading}
                className="bg-background border-border text-foreground placeholder:text-muted-foreground flex-1"
              />
              <Button
                type="submit"
                disabled={isLoading}
                variant="ghost"
                className="text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Send className="size-4" />
              </Button>
            </form>
            <div className="mt-2 text-center">
              <span className="text-muted-foreground text-xs">
                v0 may make mistakes. Please use with discretion.
              </span>
            </div>
          </div>
        </div>
      </div>
    </RootLayout>
  );
}
