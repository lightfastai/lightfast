"use client"

import { useEffect, useRef } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Zap } from "lucide-react"
import { MessageDisplay } from "./MessageDisplay"
import type { Doc } from "../../../convex/_generated/dataModel"

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

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

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
    </ScrollArea>
  )
}
