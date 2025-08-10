"use client";

import { useState } from "react";
import { AppHeader } from "~/components/app-header";
import { ChatInput } from "~/components/chat-input";
import { AppEmptyState } from "@repo/ui/components/app-empty-state";

export default function HomePage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleSendMessage = async (message: string) => {
    // TODO: Implement actual message sending logic
    console.log("Message sent:", message);
    setIsLoading(true);
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setIsLoading(false);
  };

  return (
    <div className="h-screen flex flex-col relative">
      <AppHeader />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ paddingTop: "56px" }}>
        <div className="w-full max-w-3xl px-4 pointer-events-auto">
          <div className="px-4">
            <AppEmptyState 
              title="Chat" 
              description="Experience the power of Lightfast AI. Chat with advanced models and explore cutting-edge AI capabilities."
            />
          </div>
          <ChatInput
            onSendMessage={handleSendMessage}
            placeholder="Message Lightfast..."
            disabled={isLoading}
          />
        </div>
      </div>
    </div>
  );
}