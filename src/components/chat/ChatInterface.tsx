"use client"

import { useMutation, useQuery } from "convex/react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState, useMemo } from "react"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { ChatInput } from "./ChatInput"
import { ChatMessages } from "./ChatMessages"

type Message = Doc<"messages">

interface ChatInterfaceProps {
  initialMessages?: Message[]
}

export function ChatInterface({ initialMessages = [] }: ChatInterfaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [hasCreatedThread, setHasCreatedThread] = useState(false)

  // Extract current thread ID from pathname with better parsing
  const currentThreadId = useMemo(() => {
    if (pathname === "/chat") {
      return "new"
    }
    // More robust pathname parsing
    const match = pathname.match(/^\/chat\/(.+)$/)
    return match ? (match[1] as Id<"threads">) : "new"
  }, [pathname])

  const isNewChat = currentThreadId === "new"

  // Determine if we should skip queries (only skip if we're in new chat mode AND haven't created thread yet)
  const shouldSkipQueries = isNewChat && !hasCreatedThread

  // Get the actual thread data with better error handling
  const currentThread = useQuery(
    api.threads.get,
    shouldSkipQueries || currentThreadId === "new"
      ? "skip"
      : { threadId: currentThreadId as Id<"threads"> },
  )

  // Get messages for current thread (leverages prefetched cache for instant loading)
  const messages =
    useQuery(
      api.messages.list,
      shouldSkipQueries || currentThreadId === "new"
        ? "skip"
        : { threadId: currentThreadId as Id<"threads"> },
    ) ?? initialMessages

  // Mutations
  const createThread = useMutation(api.threads.create)
  const sendMessage = useMutation(api.messages.send)

  // Handle case where thread doesn't exist or user doesn't have access
  useEffect(() => {
    if (currentThread === null && !isNewChat && !shouldSkipQueries) {
      // Thread doesn't exist or user doesn't have access, redirect to chat
      router.replace("/chat")
    }
  }, [currentThread, isNewChat, shouldSkipQueries, router])

  // Reset hasCreatedThread when navigating to new chat
  useEffect(() => {
    if (isNewChat) {
      setHasCreatedThread(false)
    }
  }, [isNewChat])

  const handleSendMessage = async (message: string) => {
    if (!message.trim()) return

    try {
      if (isNewChat) {
        // First message in new chat - create thread first with placeholder title
        const newThreadId = await createThread({
          title: "Generating title...",
        })

        // Send the message to the new thread
        await sendMessage({
          threadId: newThreadId,
          body: message,
        })

        // Navigate to the new thread using replace for better UX
        router.replace(`/chat/${newThreadId}`)
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
      // Could add toast notification here for better UX
    }
  }

  const getEmptyStateTitle = () => {
    if (isNewChat) {
      return "Welcome to AI Chat"
    }
    return currentThread?.title || "Chat"
  }

  const getEmptyStateDescription = () => {
    if (isNewChat) {
      return "Start a conversation with our AI assistant. Messages stream in real-time!"
    }
    return "Continue your conversation with the AI assistant."
  }

  return (
    <div className="flex flex-col h-full">
      <ChatMessages
        messages={messages}
        emptyState={{
          title: getEmptyStateTitle(),
          description: getEmptyStateDescription(),
        }}
      />
      <ChatInput
        onSendMessage={handleSendMessage}
        placeholder="Message AI assistant..."
        disabled={currentThread === null && !isNewChat}
      />
    </div>
  )
}
