"use client"

import { useMutation, useQuery } from "convex/react"
import { usePathname, useRouter } from "next/navigation"
import { useMemo } from "react"
import { nanoid, isClientId } from "@/lib/nanoid"
import { api } from "../../convex/_generated/api"
import type { Id } from "../../convex/_generated/dataModel"
import type { ModelId } from "@/lib/ai/types"

export function useChat() {
  const router = useRouter()
  const pathname = usePathname()

  // Extract current thread info from pathname with clientId support
  const pathInfo = useMemo(() => {
    if (pathname === "/chat") {
      return { type: "new", id: "new" }
    }

    const match = pathname.match(/^\/chat\/(.+)$/)
    if (!match) {
      return { type: "new", id: "new" }
    }

    const id = match[1]

    // Check if it's a client-generated ID (nanoid)
    if (isClientId(id)) {
      return { type: "clientId", id }
    }

    // Otherwise it's a real Convex thread ID
    return { type: "threadId", id: id as Id<"threads"> }
  }, [pathname])

  const currentThreadId = pathInfo.type === "threadId" ? pathInfo.id : "new"
  const currentClientId = pathInfo.type === "clientId" ? pathInfo.id : null
  const isNewChat = currentThreadId === "new" && !currentClientId

  // Get thread by clientId if we have one
  const threadByClientId = useQuery(
    api.threads.getByClientId,
    currentClientId ? { clientId: currentClientId } : "skip",
  )

  // Get thread by ID for regular threads
  const threadById = useQuery(
    api.threads.get,
    currentThreadId !== "new"
      ? { threadId: currentThreadId as Id<"threads"> }
      : "skip",
  )

  // Determine the actual thread to use
  const currentThread = threadByClientId || threadById

  // Get messages for current thread
  const messages =
    useQuery(
      api.messages.list,
      currentThread ? { threadId: currentThread._id } : "skip",
    ) ?? []

  // Mutations - using built-in Convex optimistic updates
  const createThread = useMutation(api.threads.create)
  const sendMessage = useMutation(api.messages.send)

  // Use messages directly - Convex handles optimistic updates automatically
  const allMessages = messages

  const handleSendMessage = async (message: string, modelId: string) => {
    if (!message.trim()) return

    try {
      if (isNewChat) {
        // 🚀 Generate client ID instantly and navigate
        const clientId = nanoid()
        router.replace(`/chat/${clientId}`)

        // Create thread with client ID in background
        setTimeout(async () => {
          try {
            const newThreadId = await createThread({
              title: "Generating title...",
              clientId: clientId,
            })

            // Send message with built-in optimistic update
            await sendMessage({
              threadId: newThreadId,
              body: message,
              modelId: modelId as ModelId,
            })
          } catch (error) {
            console.error("Background thread creation failed:", error)
          }
        }, 0)

        return
      }

      if (currentClientId && !currentThread) {
        // We have a clientId but thread doesn't exist yet, create it
        const newThreadId = await createThread({
          title: "Generating title...",
          clientId: currentClientId,
        })

        // Send message with built-in optimistic update
        await sendMessage({
          threadId: newThreadId,
          body: message,
          modelId: modelId as ModelId,
        })
      } else if (currentThread) {
        // Normal message sending with built-in optimistic update
        await sendMessage({
          threadId: currentThread._id,
          body: message,
          modelId: modelId as ModelId,
        })
      }
    } catch (error) {
      console.error("Error sending message:", error)
      throw error
    }
  }

  const getEmptyStateTitle = () => {
    if (isNewChat) {
      return "Welcome to AI Chat"
    }
    if (currentClientId && !currentThread) {
      return "Starting conversation..."
    }
    return currentThread?.title || ""
  }

  const getEmptyStateDescription = () => {
    if (isNewChat) {
      return "Start a conversation with our AI assistant. Messages stream in real-time!"
    }
    if (currentClientId && !currentThread) {
      return "Creating your conversation..."
    }
    return ""
  }

  return {
    messages: allMessages,
    currentThread,
    isNewChat,
    handleSendMessage,
    emptyState: {
      title: getEmptyStateTitle(),
      description: getEmptyStateDescription(),
    },
    isDisabled: currentThread === null && !isNewChat && !currentClientId,
  }
}
