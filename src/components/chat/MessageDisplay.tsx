"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, Zap } from "lucide-react"
import { useEffect, useState } from "react"
import type { Doc } from "../../../convex/_generated/dataModel"

type Message = Doc<"messages">

interface MessageDisplayProps {
  message: Message
  userName: string
}

// Component to display individual messages with streaming support
export function MessageDisplay({ message, userName }: MessageDisplayProps) {
  const [displayText, setDisplayText] = useState(message.body)
  const [isTyping, setIsTyping] = useState(false)

  // Update display text when message body changes (via Convex reactivity)
  useEffect(() => {
    setDisplayText(message.body)
    setIsTyping(
      Boolean(
        message.isStreaming && !message.isComplete && message.body.length > 0,
      ),
    )
  }, [message.body, message.isStreaming, message.isComplete])

  const isAI = message.messageType === "assistant"
  const isStreaming = message.isStreaming && !message.isComplete

  return (
    <div
      className={`flex gap-3 animate-fade-in ${isAI ? "mt-6" : "mt-4"} ${!isAI ? "items-center" : ""}`}
    >
      <Avatar className="w-8 h-8 shrink-0 rounded-md">
        <AvatarFallback
          className={`rounded-md ${isAI ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
        >
          {isAI ? <Zap className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-1">
        <div className="text-sm leading-relaxed">
          {isStreaming && !displayText ? (
            <span className="text-muted-foreground italic">thinking...</span>
          ) : (
            <p className="whitespace-pre-wrap">
              {displayText}
              {isTyping && (
                <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1 opacity-70" />
              )}
            </p>
          )}

          {isStreaming && displayText && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <div className="flex space-x-1">
                <div className="w-1 h-1 bg-current rounded-full animate-bounce" />
                <div
                  className="w-1 h-1 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                />
                <div
                  className="w-1 h-1 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
              </div>
              <span>thinking...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
