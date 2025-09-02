"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useCallback, useMemo, useState } from "react";
import { ChatEmptyState } from "./chat-empty-state";
import { ChatMessages } from "./chat-messages";
import { ChatInput } from "./chat-input";
import { PromptSuggestions } from "./prompt-suggestions";
import type { DevServerUIMessage } from "../../types/chat";

interface ChatInterfaceProps {
  agentId: string;
  agentName?: string;
}

export function ChatInterface({ agentId, agentName }: ChatInterfaceProps) {
  // Generate a stable session ID for this chat session
  const sessionId = useMemo(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, []);
  
  // State for managing input
  const [input, setInput] = useState('');
  
  // Create transport for the chat
  const transport = useMemo(() => {
    return new DefaultChatTransport<DevServerUIMessage>({
      api: "/api/stream",
      headers: {
        "Content-Type": "application/json",
      },
      prepareSendMessagesRequest: ({ body, headers, messages, api }) => {
        return {
          api,
          headers,
          body: {
            agentId,
            sessionId,
            messages,
            ...body,
          },
        };
      },
    });
  }, [agentId, sessionId]);
  
  const {
    messages,
    sendMessage: vercelSendMessage,
    error,
    status,
  } = useChat<DevServerUIMessage>({
    id: `${agentId}-${sessionId}`,
    transport,
    experimental_throttle: 45,
    messages: [],
    onError: (err) => {
      console.error("Chat error:", err);
    },
  });


  // Handle sending message - matching apps/chat pattern exactly
  const handleSendMessage = useCallback(async (message: string) => {
    if (!message.trim() || status === "streaming") {
      return;
    }
    
    try {
      // Generate UUID for the user message
      const userMessageId = crypto.randomUUID();
      
      // Create the user message object in the UI format expected by useChat
      const userMessage: DevServerUIMessage = {
        role: "user",
        parts: [{ type: "text", text: message }],
        id: userMessageId,
      };
      
      // Send message using sendMessage from useChat (renamed to vercelSendMessage like apps/chat)
      await vercelSendMessage(userMessage, {
        body: {
          userMessageId,
        },
      });
      
      // Clear the input after successful send
      setInput('');
    } catch (error) {
      console.error("Failed to send message:", error);
    }
  }, [vercelSendMessage, status]);

  // Handle input change for controlled component
  const handleInputValueChange = useCallback((value: string) => {
    setInput(value);
  }, []);

  // For new chats (no messages yet), show centered layout
  if (messages.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-background">
        <div className="w-full max-w-3xl px-4">
          <div className="px-4 mb-8">
            <ChatEmptyState
              prompt={`Welcome! Ask ${agentName || "the agent"} anything`}
            />
          </div>
          <ChatInput
            value={input}
            onChange={handleInputValueChange}
            onSendMessage={handleSendMessage}
            placeholder="Ask anything..."
            disabled={status === "streaming"}
          />
          {/* Prompt suggestions - only visible on iPad and above (md breakpoint) */}
          <div className="hidden md:block relative mt-4 h-12">
            <div className="absolute top-0 left-0 right-0 px-4">
              <PromptSuggestions onSelectPrompt={handleSendMessage} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Thread view or chat with existing messages
  return (
    <div className="flex flex-col h-full bg-background">
      <ChatMessages messages={messages} status={status} />
      <div className="relative">
        <div className="max-w-3xl mx-auto p-4">
          <ChatInput
            value={input}
            onChange={handleInputValueChange}
            onSendMessage={handleSendMessage}
            placeholder="Continue the conversation..."
            disabled={status === "streaming"}
          />
        </div>
      </div>
    </div>
  );
}