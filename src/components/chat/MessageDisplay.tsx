"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useQuery } from "convex/react"
import { User } from "lucide-react"
import { useEffect, useState } from "react"
import { api } from "../../../convex/_generated/api"
import type { Doc } from "../../../convex/_generated/dataModel"

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

type Message = Doc<"messages">

interface MessageDisplayProps {
  message: Message
  userName: string
}

// Component to display individual messages with streaming support
export function MessageDisplay({ message, userName }: MessageDisplayProps) {
  const [displayText, setDisplayText] = useState(message.body)
  const [isTyping, setIsTyping] = useState(false)
  const [thinkingDuration, setThinkingDuration] = useState<number | null>(null)
  const [liveThinkingDuration, setLiveThinkingDuration] = useState<
    number | null
  >(null)

  // Get current user for avatar display
  const currentUser = useQuery(api.users.current)

  // Update display text when message body changes (via Convex reactivity)
  useEffect(() => {
    setDisplayText(message.body)
    setIsTyping(
      Boolean(
        message.isStreaming && !message.isComplete && message.body.length > 0,
      ),
    )

    // Calculate thinking duration
    if (message.thinkingStartedAt && message.thinkingCompletedAt) {
      // Message is complete, show final duration
      setThinkingDuration(
        message.thinkingCompletedAt - message.thinkingStartedAt,
      )
      setLiveThinkingDuration(null)
    } else if (message.thinkingStartedAt && message.isStreaming) {
      // Message is still streaming, don't show completed duration yet
      setThinkingDuration(null)
    } else {
      setThinkingDuration(null)
      setLiveThinkingDuration(null)
    }
  }, [
    message.body,
    message.isStreaming,
    message.isComplete,
    message.thinkingStartedAt,
    message.thinkingCompletedAt,
  ])

  // Live timer for ongoing thinking
  useEffect(() => {
    if (
      message.thinkingStartedAt &&
      message.isStreaming &&
      !message.thinkingCompletedAt
    ) {
      const interval = setInterval(() => {
        setLiveThinkingDuration(Date.now() - message.thinkingStartedAt!)
      }, 100) // Update every 100ms for smooth display

      return () => clearInterval(interval)
    }
  }, [
    message.thinkingStartedAt,
    message.isStreaming,
    message.thinkingCompletedAt,
  ])

  const isAI = message.messageType === "assistant"
  const isStreaming = message.isStreaming && !message.isComplete

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
        {/* Show final thinking duration for completed assistant messages */}
        {isAI && !isStreaming && thinkingDuration && (
          <div className="text-xs text-muted-foreground mb-3">
            <span className="font-mono">
              Thought for {formatDuration(thinkingDuration)}
            </span>
          </div>
        )}

        <div className="text-sm leading-relaxed">
          {isStreaming && !displayText ? (
            <span className="text-muted-foreground italic">
              thinking...
              {liveThinkingDuration && (
                <span className="ml-1 font-mono not-italic">
                  ({formatDuration(liveThinkingDuration)})
                </span>
              )}
            </span>
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
              <span>
                thinking...
                {liveThinkingDuration && (
                  <span className="ml-1 font-mono">
                    ({formatDuration(liveThinkingDuration)})
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
