"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useQuery, useMutation } from "convex/react"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { ChatMessages } from "./ChatMessages"
import { ChatInput } from "./ChatInput"

type Message = Doc<"messages">

interface ChatInterfaceProps {
  initialMessages?: Message[]
}

export function ChatInterface({ initialMessages = [] }: ChatInterfaceProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [hasCreatedThread, setHasCreatedThread] = useState(false)

  // Extract current thread ID from pathname
  const getCurrentThreadId = (): Id<"threads"> | "new" => {
    if (pathname === "/chat") {
      return "new"
    }
    const threadId = pathname.split("/chat/")[1]
    return threadId as Id<"threads">
  }

  const currentThreadId = getCurrentThreadId()
  const isNewChat = currentThreadId === "new"

  // Determine if we should skip queries (only skip if we're in new chat mode AND haven't created thread yet)
  const shouldSkipQueries = isNewChat && !hasCreatedThread

  // Get the actual thread data
  const currentThread = useQuery(
    api.threads.get,
    shouldSkipQueries || currentThreadId === "new"
      ? "skip"
      : { threadId: currentThreadId as Id<"threads"> },
  )

  // Get messages for current thread (with real-time updates)
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
    if (currentThread === null && !isNewChat) {
      // Thread doesn't exist or user doesn't have access, redirect to chat
      router.push("/chat")
    }
  }, [currentThread, isNewChat, router])

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

        // Navigate to the new thread
        router.push(`/chat/${newThreadId}`)
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

  const getEmptyStateTitle = () => {
    if (isNewChat) {
      return "Welcome to AI Chat"
    }
    return currentThread?.title || "Chat"
  }

  return (
    <div className="flex flex-col h-full">
      <ChatMessages
        messages={messages}
        emptyState={{
          title: getEmptyStateTitle(),
          description:
            "Start a conversation with our AI assistant. Messages stream in real-time!",
        }}
      />
      <ChatInput
        onSendMessage={handleSendMessage}
        placeholder="Message AI assistant..."
      />
    </div>
  )
}
