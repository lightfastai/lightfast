"use client"

import { useMutation, useQuery } from "convex/react"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useMemo } from "react"
import { nanoid, isClientId } from "@/lib/nanoid"
import { api } from "../../../convex/_generated/api"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import type { ModelId } from "@/lib/ai/types"
import { ChatInput } from "./ChatInput"
import { ChatMessages } from "./ChatMessages"
import { useResumableChat } from "@/hooks/useResumableStream"

type Message = Doc<"messages">

interface ChatInterfaceProps {
  initialMessages?: Message[]
}

export function ChatInterface({ initialMessages = [] }: ChatInterfaceProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Manage resumable streams
  const { activeStreams, startStream, endStream } = useResumableChat()

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
    ) ?? initialMessages

  // Track streaming messages
  const streamingMessages = useMemo(() => {
    return messages.filter((msg: Message) => msg.isStreaming && msg.streamId)
  }, [messages])

  // Set up streams for streaming messages
  useEffect(() => {
    for (const msg of streamingMessages) {
      if (msg.streamId && !activeStreams.has(msg._id)) {
        startStream(msg._id, msg.streamId)
      }
    }

    // Clean up completed streams
    for (const msg of messages) {
      if (!msg.isStreaming && activeStreams.has(msg._id)) {
        endStream(msg._id)
      }
    }
  }, [streamingMessages, messages, activeStreams, startStream, endStream])

  // Mutations
  const createThread = useMutation(api.threads.create)
  const sendMessage = useMutation(api.messages.send)

  // Handle case where thread doesn't exist or user doesn't have access
  useEffect(() => {
    if (currentThread === null && !isNewChat && currentClientId === null) {
      // Thread doesn't exist or user doesn't have access, redirect to chat
      router.replace("/chat")
    }
  }, [currentThread, isNewChat, currentClientId, router])

  const handleSendMessage = async (message: string, modelId: string) => {
    if (!message.trim()) return

    try {
      if (isNewChat) {
        // 🚀 Generate client ID instantly (2M ops/sec with nanoid)
        const clientId = nanoid() // 21 chars default = "V1StGXR8_Z5jdHi6B-myT"

        // 🚀 Navigate instantly (0ms delay!)
        router.push(`/chat/${clientId}`)

        // 🚀 Return immediately to allow UI to update
        // Continue processing in background without blocking
        setTimeout(async () => {
          try {
            // Create thread with client ID in background
            const newThreadId = await createThread({
              title: "Generating title...",
              clientId: clientId,
            })

            // Send the message to the new thread
            await sendMessage({
              threadId: newThreadId,
              body: message,
              modelId: modelId as ModelId,
            })
          } catch (error) {
            console.error("Background thread creation failed:", error)
            // Could add toast notification here if needed
          }
        }, 0)

        // Return immediately for instant UI feedback
        return
      }

      if (currentClientId && !currentThread) {
        // We have a clientId but thread doesn't exist yet, create it
        const newThreadId = await createThread({
          title: "Generating title...",
          clientId: currentClientId,
        })

        await sendMessage({
          threadId: newThreadId,
          body: message,
          modelId: modelId as ModelId,
        })
      } else if (currentThread) {
        // Normal message sending to existing thread
        await sendMessage({
          threadId: currentThread._id,
          body: message,
          modelId: modelId as ModelId,
        })
      }
    } catch (error) {
      console.error("Error sending message:", error)
      // Re-throw the error so ChatInput can handle the toast notifications
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

  // Check if AI is currently generating (any message is streaming)
  const isAIGenerating = useMemo(() => {
    return (
      messages.some((msg) => msg.isStreaming && !msg.isComplete) ||
      activeStreams.size > 0
    )
  }, [messages, activeStreams])

  // Enhance messages with streaming text
  const enhancedMessages = useMemo(() => {
    return messages.map((msg: Message) => {
      const streamId = activeStreams.get(msg._id)
      return {
        ...msg,
        _streamId: streamId || null,
      }
    })
  }, [messages, activeStreams])

  return (
    <div className="flex flex-col h-full">
      <ChatMessages
        messages={enhancedMessages}
        emptyState={{
          title: getEmptyStateTitle(),
          description: getEmptyStateDescription(),
        }}
      />
      <ChatInput
        onSendMessage={handleSendMessage}
        placeholder="Message AI assistant..."
        disabled={currentThread === null && !isNewChat && !currentClientId}
        isLoading={isAIGenerating}
      />
    </div>
  )
}
