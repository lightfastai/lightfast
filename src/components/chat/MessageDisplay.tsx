"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Markdown } from "@/components/ui/markdown"
import { useQuery } from "convex/react"
import { ChevronDown, ChevronRight, User, Brain } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "../../../convex/_generated/api"
import type { Doc } from "../../../convex/_generated/dataModel"
import { StreamingMessage } from "./StreamingMessage"
import { type ModelProvider, getModelDisplayName } from "@/lib/ai"

// Lightfast logo component
function LightfastLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="104"
      height="70"
      viewBox="0 0 104 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Lightfast"
      {...props}
    >
      <title>Lightfast</title>
      <path
        d="M15.3354 57.3195H47.1597V69.7863H0.543457V0.632019H15.3354V57.3195Z"
        fill="currentColor"
      />
      <path
        d="M79.6831 69.7863H65.2798L89.0532 0.658386H103.457L79.6831 69.7863Z"
        fill="currentColor"
      />
    </svg>
  )
}

type Message = Doc<"messages"> & { _streamId?: string | null }

interface MessageDisplayProps {
  message: Message
  userName: string
}

// Component to display individual messages with streaming support
export function MessageDisplay({ message, userName }: MessageDisplayProps) {
  const [displayText, setDisplayText] = useState(message.body)
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null)
  const [isThinkingExpanded, setIsThinkingExpanded] = useState(false)

  // Get current user for avatar display
  const currentUser = useQuery(api.users.current)

  // Check if this message should use resumable streaming
  const useResumableStream = message.isStreaming && message._streamId

  // Update display text when message body changes (via Convex reactivity)
  useEffect(() => {
    if (!useResumableStream) {
      setDisplayText(message.body)
      setIsTyping(
        Boolean(
          message.isStreaming && !message.isComplete && message.body.length > 0,
        ),
      )
    }

    // Calculate thinking duration
    if (message.thinkingStartedAt && message.thinkingCompletedAt) {
      // Message is complete, show final duration
      setThinkingDuration(
        message.thinkingCompletedAt - message.thinkingStartedAt,
      )
    } else {
      setThinkingDuration(null)
    }
  }, [
    message.body,
    message.isStreaming,
    message.isComplete,
    message.thinkingStartedAt,
    message.thinkingCompletedAt,
    useResumableStream,
  ])

  const isAI = message.messageType === "assistant"
  const isStreaming = message.isStreaming && !message.isComplete
  const hasThinking = Boolean(
    message.hasThinkingContent && message.thinkingContent,
  )

  // Helper function to format duration
  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`
    }
    if (ms < 60000) {
      return `${(ms / 1000).toFixed(1)}s`
    }
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}m ${seconds}s`
  }

  // If this message has a resumable stream, use the StreamingMessage component
  if (useResumableStream) {
    return (
      <div
        className={`flex gap-3 ${isAI ? "mt-6" : "mt-4"} ${!isAI ? "items-center" : ""}`}
      >
        <Avatar className="w-8 h-8 shrink-0 rounded-md">
          {!isAI && currentUser?.image && (
            <AvatarImage
              src={currentUser.image}
              alt={currentUser.name || userName}
              className="object-cover"
            />
          )}
          <AvatarFallback
            className={`rounded-md ${isAI ? "bg-background text-primary" : "bg-secondary"}`}
          >
            {isAI ? (
              <LightfastLogo className="w-4 h-4" />
            ) : (
              <User className="w-4 h-4" />
            )}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1">
          {/* Show thinking indicators at the top for assistant messages */}
          {isAI && (
            <>
              {/* Show final thinking duration for completed assistant messages */}
              {!isStreaming && thinkingDuration && (
                <div className="text-xs text-muted-foreground mb-2">
                  <span className="font-mono">
                    Thought for {formatDuration(thinkingDuration)}
                  </span>
                </div>
              )}
            </>
          )}

          <StreamingMessage
            message={message}
            className="text-sm leading-relaxed"
          />
        </div>
      </div>
    )
  }

  // Original display logic for non-resumable messages
  // Get model display name safely
  const getModelName = (
    modelId: string | undefined,
    provider: ModelProvider | undefined,
  ): string => {
    if (modelId) {
      return getModelDisplayName(modelId)
    }
    // Fallback to provider name for backward compatibility
    if (!provider) return "AI Assistant"
    return getModelDisplayName(provider)
  }

  return (
    <div
      className={`flex gap-3  ${isAI ? "mt-6" : "mt-4"} ${!isAI ? "items-center" : ""}`}
    >
      <Avatar className="w-8 h-8 shrink-0 rounded-md">
        {!isAI && currentUser?.image && (
          <AvatarImage
            src={currentUser.image}
            alt={currentUser.name || userName}
            className="object-cover"
          />
        )}
        <AvatarFallback
          className={`rounded-md ${isAI ? "bg-background text-primary" : "bg-secondary"}`}
        >
          {isAI ? (
            <LightfastLogo className="w-4 h-4" />
          ) : (
            <User className="w-4 h-4" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-1">
        {/* Show thinking indicators at the top for assistant messages */}
        {isAI && (
          <>
            {/* Show model name and thinking duration for completed assistant messages */}
            {!isStreaming && (
              <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                <span>{getModelName(message.modelId, message.model)}</span>
                {thinkingDuration && (
                  <>
                    <span>•</span>
                    <span className="font-mono">
                      Thought for {formatDuration(thinkingDuration)}
                    </span>
                  </>
                )}
              </div>
            )}

            {/* Show thinking indicator while streaming */}
            {isStreaming && (
              <div className="mb-2 text-xs text-muted-foreground flex items-center gap-2">
                <span>{getModelName(message.modelId, message.model)}</span>
                <span>•</span>
                <span>{message.isThinking ? "Thinking" : "Responding"}</span>
              </div>
            )}

            {/* Show collapsible thinking content for Claude */}
            {hasThinking && (
              <div className="mb-4 rounded-lg border border-muted bg-muted/20 p-3">
                <button
                  type="button"
                  onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                  className="flex w-full items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  {isThinkingExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                  <Brain className="h-3 w-3" />
                  <span>View reasoning process</span>
                  {thinkingDuration && (
                    <span className="ml-auto font-mono text-[10px]">
                      {formatDuration(thinkingDuration)}
                    </span>
                  )}
                </button>
                {isThinkingExpanded && message.thinkingContent && (
                  <div className="mt-3 text-xs text-muted-foreground space-y-2">
                    <p className="whitespace-pre-wrap font-mono leading-relaxed">
                      {message.thinkingContent}
                    </p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="text-sm leading-relaxed">
          {isStreaming && !displayText && !isAI ? (
            <span className="text-muted-foreground italic">Thinking</span>
          ) : displayText ? (
            <>
              <Markdown className="text-sm">{displayText}</Markdown>
              {isTyping && (
                <span className="inline-block w-2 h-4 bg-current animate-pulse ml-1 opacity-70" />
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
