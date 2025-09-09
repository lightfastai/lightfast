"use client";

import { type CloudChatMessage, isTextPart, isReasoningPart } from "~/types/chat-messages";
import { cn } from "~/lib/utils";

interface ChatMessageProps {
  message: CloudChatMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const isAssistant = message.role === "assistant";
  
  return (
    <div className={cn(
      "flex gap-4 p-4 rounded-lg",
      isUser && "bg-blue-50 border-l-4 border-blue-400",
      isAssistant && "bg-green-50 border-l-4 border-green-400"
    )}>
      {/* Avatar */}
      <div className={cn(
        "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
        isUser && "bg-blue-500 text-white",
        isAssistant && "bg-green-500 text-white"
      )}>
        {isUser ? "U" : "A"}
      </div>
      
      {/* Message Content */}
      <div className="flex-1 space-y-2">
        {/* Message Parts */}
        {message.parts?.map((part, index) => {
          if (isTextPart(part)) {
            return (
              <div key={index} className="prose prose-sm max-w-none">
                <p className="text-gray-800 whitespace-pre-wrap">{part.text}</p>
              </div>
            );
          }
          
          if (isReasoningPart(part)) {
            return (
              <div key={index} className="bg-gray-100 p-3 rounded border-l-2 border-gray-300">
                <div className="text-xs font-medium text-gray-600 mb-1">Reasoning</div>
                <div className="text-sm text-gray-700 whitespace-pre-wrap">{part.text}</div>
              </div>
            );
          }
          
          // Handle other part types
          return (
            <div key={index} className="bg-yellow-100 p-3 rounded border-l-2 border-yellow-300">
              <div className="text-xs font-medium text-yellow-600 mb-1">
                {part.type}
              </div>
              <pre className="text-sm text-yellow-700 whitespace-pre-wrap">
                {JSON.stringify(part, null, 2)}
              </pre>
            </div>
          );
        })}
        
        {/* Metadata */}
        {message.metadata && (
          <div className="text-xs text-gray-500 mt-2">
            {message.metadata.createdAt && (
              <span>
                {new Date(message.metadata.createdAt).toLocaleTimeString()}
              </span>
            )}
            {message.metadata.status && (
              <span className="ml-2 px-2 py-1 bg-gray-200 rounded-full">
                {message.metadata.status}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}