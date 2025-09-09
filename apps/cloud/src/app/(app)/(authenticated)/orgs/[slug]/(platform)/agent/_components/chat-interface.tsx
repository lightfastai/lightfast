"use client";

import { useState } from "react";
import { AlertCircle, X } from "lucide-react";
import { useCloudChat } from "~/hooks/use-cloud-chat";
import { type CloudChatMessage } from "~/types/chat-messages";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "@repo/ui/components/chat";
import { cn } from "~/lib/utils";
import { Card, CardContent, CardHeader } from "@repo/ui/components/ui/card";
import { Alert, AlertDescription } from "@repo/ui/components/ui/alert";
import { Button } from "@repo/ui/components/ui/button";

interface ChatInterfaceProps {
  agentId: string;
  sessionId: string;
  initialMessages?: CloudChatMessage[];
  className?: string;
  onError?: (error: Error) => void;
  customHeader?: React.ReactNode;
}

export function ChatInterface({ 
  agentId, 
  sessionId, 
  initialMessages = [], 
  className,
  onError,
  customHeader
}: ChatInterfaceProps) {
  const [error, setError] = useState<string | null>(null);

  const { messages, sendMessage, status, isLoading } = useCloudChat({
    agentId,
    sessionId,
    initialMessages,
    onError: (err) => {
      console.error("[ChatInterface] Error:", err);
      setError(err.message || "An error occurred");
      onError?.(err);
    },
  });

  const handleSendMessage = async (message: string) => {
    setError(null); // Clear any previous errors
    try {
      await sendMessage(message);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to send message";
      setError(errorMessage);
      throw err; // Let ChatInput handle the error too
    }
  };

  const clearError = () => setError(null);

  return (
    <div className={cn("flex flex-col h-full bg-background", className)}>
      {/* Header */}
      {customHeader || (
        <CardHeader className="flex-shrink-0 border-b">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">
                Agent: {agentId}
              </h2>
              <p className="text-sm text-muted-foreground">
                Session: {sessionId.slice(0, 8)}...
              </p>
            </div>
            
            {/* Status indicator */}
            <div className="flex items-center gap-2">
              <div className={cn(
                "w-2 h-2 rounded-full",
                status === "streaming" && "bg-green-500 animate-pulse",
                status === "submitted" && "bg-yellow-500 animate-pulse",
                status === "error" && "bg-destructive",
                // Default/idle state
                !["streaming", "submitted", "error"].includes(status) && "bg-muted-foreground"
              )} />
              <span className="text-xs text-muted-foreground capitalize">
                {status}
              </span>
            </div>
          </div>
        </CardHeader>
      )}

      {/* Error Banner */}
      {error && (
        <div className="flex-shrink-0 p-3">
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between w-full">
              <span>{error}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={clearError}
                className="h-auto w-auto p-0 text-destructive hover:text-destructive/80"
              >
                <X className="h-4 w-4" />
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      )}

      {/* Messages */}
      <ChatMessages messages={messages} isLoading={isLoading} />

      {/* Input */}
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isLoading}
        placeholder={`Chat with ${agentId}...`}
      />
    </div>
  );
}