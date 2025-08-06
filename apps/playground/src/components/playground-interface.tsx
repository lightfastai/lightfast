"use client";

import { useState } from "react";
import { ChatInput } from "./chat-input";

interface PlaygroundInterfaceProps {
  threadId: string;
  initialMessages: Array<{ id: string; content: string; role: "user" | "assistant" }>;
}

export function PlaygroundInterface({ threadId, initialMessages }: PlaygroundInterfaceProps) {
  const [messages, setMessages] = useState(initialMessages);

  const handleSendMessage = async (message: string) => {
    console.log("Message sent:", message, "Thread:", threadId);
    
    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      content: message,
      role: "user" as const,
    };
    
    setMessages(prev => [...prev, userMessage]);
    
    // TODO: Add AI response handling
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Add top padding on desktop to account for absolute header */}
      <div className="flex-1 app-container lg:pt-16">
        <div className="grid grid-cols-10 gap-0 h-full">
          {/* Chat section - 30% */}
          <div className="col-span-3 flex flex-col">
            {/* Messages area */}
            <div className="flex-1 overflow-auto py-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`mb-4 ${
                  message.role === "user" ? "text-right" : "text-left"
                }`}
              >
                <div
                  className={`inline-block p-3 rounded-lg ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
          </div>
          
          {/* Input area */}
          <div className="flex-shrink-0 pb-4">
            <ChatInput
              onSendMessage={handleSendMessage}
              placeholder="Ask Lightfast"
            />
          </div>
        </div>
        
          {/* Right section - 70% */}
          <div className="col-span-7 border">
            {/* Empty for now */}
          </div>
        </div>
      </div>
    </div>
  );
}