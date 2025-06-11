"use client"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { User, Zap } from "lucide-react"
import { useState, useEffect } from "react"
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
    <div className={`flex gap-4 ${isAI ? "" : "justify-end"} animate-fade-in`}>
      {isAI && (
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="bg-primary text-primary-foreground">
            <Zap className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}

      <Card
        className={`max-w-2xl ${
          isAI ? "" : "bg-primary text-primary-foreground"
        }`}
      >
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium opacity-70">
              {message.messageType === "user" ? userName : "AI Assistant"}
            </p>
            {isStreaming && (
              <div className="flex items-center text-xs opacity-70">
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
                <span className="ml-2">typing...</span>
              </div>
            )}
          </div>

          <p className="text-sm leading-relaxed whitespace-pre-wrap">
            {displayText || (isStreaming ? "..." : "")}
            {isTyping && (
              <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1 opacity-70" />
            )}
          </p>

          <div className="flex items-center justify-between mt-2">
            <p className="text-xs opacity-70">
              {new Date(message.timestamp).toLocaleTimeString()}
            </p>
            {message.isComplete && isAI && (
              <Badge variant="secondary" className="text-xs">
                ✓ Complete
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!isAI && (
        <Avatar className="w-8 h-8 shrink-0">
          <AvatarFallback className="bg-secondary">
            <User className="w-4 h-4" />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  )
}
