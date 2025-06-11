"use client"

import { useState, useEffect } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { ChatLayout } from "./ChatLayout"
import { ChatMessages } from "./ChatMessages"
import { ChatInput } from "./ChatInput"
import { TooltipProvider } from "@/components/ui/tooltip"

type Message = Doc<"messages">
type Thread = Doc<"threads">

interface ChatInterfaceProps {
  currentThread: Thread
  threads: Thread[]
  initialMessages: Message[]
  isNewChat?: boolean
}

export function ChatInterface({
  currentThread,
  threads: initialThreads,
  initialMessages,
  isNewChat = false,
}: ChatInterfaceProps) {
  const [currentThreadId, setCurrentThreadId] = useState<Id<"threads">>(
    currentThread._id,
  )
  const [hasCreatedThread, setHasCreatedThread] = useState(false)

  // Determine if we should skip queries (only skip if we're in new chat mode AND haven't created thread yet)
  const shouldSkipQueries =
    isNewChat && !hasCreatedThread && currentThreadId === "new"

  // Get updated threads from Convex (with real-time updates)
  const threads = useQuery(api.threads.list) ?? initialThreads

  // Get the actual thread data (handles case where we got placeholder data)
  const actualThread = useQuery(
    api.threads.get,
    shouldSkipQueries ? "skip" : { threadId: currentThreadId },
  )

  // Use actual thread if available, otherwise use currentThread
  const displayThread = actualThread ?? currentThread

  // Get messages for current thread (with real-time updates)
  const messages =
    useQuery(
      api.messages.list,
      shouldSkipQueries ? "skip" : { threadId: currentThreadId },
    ) ?? initialMessages

  // Mutations
  const createThread = useMutation(api.threads.create)
  const sendMessage = useMutation(api.messages.send)

  // Handle case where thread doesn't exist or user doesn't have access
  useEffect(() => {
    if (actualThread === null && currentThread.title === "Loading...") {
      // Thread doesn't exist or user doesn't have access, redirect to chat
      window.location.href = "/chat"
    }
  }, [actualThread, currentThread.title])

  const handleNewChat = async () => {
    try {
      const newThreadId = await createThread({
        title: "New Chat",
      })
      // Navigate to new thread
      window.location.href = `/chat/${newThreadId}`
    } catch (error) {
      console.error("Error creating new thread:", error)
    }
  }

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return

    try {
      if (isNewChat && currentThreadId === "new") {
        // First message in new chat - create thread first with placeholder title
        const newThreadId = await createThread({
          title: "Generating title...",
        })

        // Send the message to the new thread
        await sendMessage({
          threadId: newThreadId,
          body: message,
        })

        // Replace the current URL with the new thread URL
        window.history.replaceState({}, "", `/chat/${newThreadId}`)

        // Update the current thread ID and mark that we've created a thread
        setCurrentThreadId(newThreadId)
        setHasCreatedThread(true)
      } else {
        // Normal message sending
        await sendMessage({
          threadId: currentThreadId,
          body: message,
        })
      }
    } catch (error) {
      console.error("Error sending message:", error)
    }
  }

  const handleThreadSelect = (threadId: Id<"threads">) => {
    // Navigate to selected thread
    window.location.href = `/chat/${threadId}`
  }

  return (
    <TooltipProvider>
      <ChatLayout
        threads={threads}
        currentThreadId={currentThreadId}
        onNewChat={handleNewChat}
        onThreadSelect={handleThreadSelect}
      >
        <div className="flex flex-col h-full">
          <ChatMessages
            messages={messages}
            emptyState={{
              title: displayThread?.title || "Welcome to AI Chat",
              description:
                "Start a conversation with our AI assistant. Messages stream in real-time!",
            }}
          />
          <ChatInput
            onSendMessage={handleSendMessage}
            placeholder="Message AI assistant..."
          />
        </div>
      </ChatLayout>
    </TooltipProvider>
  )
}
