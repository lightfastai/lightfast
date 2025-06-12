"use client"

import { useResumableStream } from "@/hooks/useResumableStream"
import type { Doc } from "../../../convex/_generated/dataModel"
import { cn } from "@/lib/utils"

type Message = Doc<"messages"> & { _streamId?: string | null }

interface StreamingMessageProps {
  message: Message
  className?: string
}

export function StreamingMessage({
  message,
  className,
}: StreamingMessageProps) {
  const { streamingText, isStreaming, isComplete } = useResumableStream({
    streamId: message._streamId || null,
    enabled: !!message._streamId && !!message.isStreaming,
  })

  // Determine what text to show
  const displayText =
    message.isStreaming && message._streamId
      ? streamingText || message.body
      : message.body

  // Show thinking indicator if streaming but no text yet
  const isThinking = message.isStreaming && !displayText && !isComplete

  return (
    <div className={cn("message", className)}>
      <div className="message-header">
        <span className="font-semibold">
          {message.messageType === "user" ? "You" : "Assistant"}
        </span>
        {message.isStreaming && !isComplete && (
          <span className="ml-2 text-xs text-muted-foreground animate-pulse">
            {isThinking ? "Thinking..." : "Streaming..."}
          </span>
        )}
      </div>
      <div className="message-body whitespace-pre-wrap">
        {displayText ||
          (isThinking && (
            <span className="text-muted-foreground animate-pulse">
              <span className="inline-flex gap-1">
                <span
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "0ms" }}
                />
                <span
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "150ms" }}
                />
                <span
                  className="w-2 h-2 bg-current rounded-full animate-bounce"
                  style={{ animationDelay: "300ms" }}
                />
              </span>
            </span>
          ))}
      </div>
    </div>
  )
}
