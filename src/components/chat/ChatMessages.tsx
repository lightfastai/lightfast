"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Zap } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import type { Doc } from "../../../convex/_generated/dataModel"
import { MessageDisplay } from "./MessageDisplay"

type Message = Doc<"messages">

interface ChatMessagesProps {
  messages: Message[]
  isLoading?: boolean
  emptyState?: {
    icon?: React.ReactNode
    title?: string
    description?: string
  }
}

export function ChatMessages({
  messages,
  isLoading = false,
  emptyState = {
    icon: <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />,
    title: "Welcome to AI Chat",
    description:
      "Start a conversation with our AI assistant. Messages stream in real-time!",
  },
}: ChatMessagesProps) {
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const [isNearBottom, setIsNearBottom] = useState(true)
  const lastMessageCountRef = useRef(messages.length)

  // Check if user is near bottom of scroll area
  const checkIfNearBottom = useCallback(() => {
    if (!viewportRef.current) return true

    const { scrollTop, scrollHeight, clientHeight } = viewportRef.current
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight
    // Consider "near bottom" if within 100px of the bottom
    return distanceFromBottom < 100
  }, [])

  // Smooth scroll to bottom
  const scrollToBottom = useCallback((smooth = true) => {
    if (!viewportRef.current) return

    viewportRef.current.scrollTo({
      top: viewportRef.current.scrollHeight,
      behavior: smooth ? "smooth" : "auto",
    })
  }, [])

  // Set up viewport ref when component mounts
  useEffect(() => {
    if (scrollAreaRef.current) {
      // Find the viewport element within the ScrollArea
      const viewport = scrollAreaRef.current.querySelector(
        '[data-slot="scroll-area-viewport"]',
      )
      if (viewport instanceof HTMLDivElement) {
        viewportRef.current = viewport

        // Set up scroll listener to track if user is near bottom
        const handleScroll = () => {
          setIsNearBottom(checkIfNearBottom())
        }

        viewport.addEventListener("scroll", handleScroll)
        return () => viewport.removeEventListener("scroll", handleScroll)
      }
    }
  }, [checkIfNearBottom])

  // Auto-scroll when new messages arrive
  useEffect(() => {
    if (!messages.length) return

    const hasNewMessage = messages.length > lastMessageCountRef.current
    lastMessageCountRef.current = messages.length

    // Check if any message is currently streaming
    const hasStreamingMessage = messages.some(
      (msg) => msg.isStreaming && !msg.isComplete,
    )

    // Auto-scroll if:
    // 1. User is near bottom AND there's a new message
    // 2. User is near bottom AND there's a streaming message
    if (isNearBottom && (hasNewMessage || hasStreamingMessage)) {
      // Use instant scroll for new messages, smooth for streaming updates
      scrollToBottom(!hasNewMessage)
    }
  }, [messages, isNearBottom, scrollToBottom])

  // Scroll to bottom on initial load
  useEffect(() => {
    scrollToBottom(false)
  }, [scrollToBottom])

  return (
    <ScrollArea className="flex-1 min-h-0" ref={scrollAreaRef}>
      <div className="p-4">
        <div className="space-y-6 max-w-3xl mx-auto">
          {!messages?.length && !isLoading && (
            <div className="text-center text-muted-foreground py-12">
              {emptyState.icon}
              <h3 className="text-lg font-medium mb-2">{emptyState.title}</h3>
              <p>{emptyState.description}</p>
            </div>
          )}

          {messages
            ?.slice()
            .reverse()
            .map((msg) => (
              <MessageDisplay key={msg._id} message={msg} userName="User" />
            ))}

          {isLoading && (
            <div className="text-center text-muted-foreground py-4">
              <div className="animate-pulse">Generating response...</div>
            </div>
          )}
        </div>
      </div>

      {/* Scroll to bottom button when user has scrolled up */}
      {!isNearBottom && messages.length > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-20 right-4 p-2 bg-primary text-primary-foreground rounded-full shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
          aria-label="Scroll to bottom"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      )}
    </ScrollArea>
  )
}
