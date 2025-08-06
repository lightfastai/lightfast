"use client";

import { useState } from "react";
import { ChatInput } from "./chat-input";

interface PlaygroundContentProps {
  threadId: string;
  children: React.ReactNode; // For the EmptyState
}

export function PlaygroundContent({ threadId, children }: PlaygroundContentProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendMessage = async (message: string) => {
    if (!message.trim() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    // Update URL to include thread ID
    // In multi-zone setup, we need to preserve the /playground prefix if it exists
    const currentPath = window.location.pathname;
    const hasPlaygroundPrefix = currentPath.startsWith('/playground');
    const newPath = hasPlaygroundPrefix ? `/playground/${threadId}` : `/${threadId}`;
    
    window.history.replaceState({}, "", newPath);
    
    // TODO: Actually send the message to the API
    console.log("Message sent:", message, "Thread:", threadId);
    
    // For now, just navigate to the new page
    // In a real app, you'd send the message first, then navigate
    window.location.href = newPath;
  };

  // Empty state - chat input centered in the middle
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-full max-w-3xl px-4">
        <div className="px-4">
          {children}
        </div>
        <ChatInput
          onSendMessage={handleSendMessage}
          placeholder="Ask Lightfast"
          disabled={isSubmitting}
        />
      </div>
    </div>
  );
}