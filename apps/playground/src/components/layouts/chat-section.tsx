import { ReactNode } from "react";

interface ChatSectionProps {
  messages: ReactNode;
  input: ReactNode;
}

/**
 * ChatSection handles the layout of the chat area with messages and input.
 * It ensures proper scrolling for messages while keeping the input fixed at bottom.
 */
export function ChatSection({ messages, input }: ChatSectionProps) {
  return (
    <div className="h-full flex flex-col">
      {/* Messages Area - Scrollable, takes available space */}
      <div className="flex-1 min-h-0 flex flex-col">
        {messages}
      </div>
      
      {/* Input Area - Fixed at bottom */}
      <div className="flex-shrink-0 p-4">
        {input}
      </div>
    </div>
  );
}