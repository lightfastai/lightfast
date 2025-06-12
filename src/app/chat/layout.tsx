"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { useQuery } from "convex/react"
import { useOptimisticNavigation } from "@/hooks/useOptimisticNavigation"
import { api } from "../../../convex/_generated/api"
import { ChatLayout } from "../../components/chat/ChatLayout"
import type React from "react"

interface ChatLayoutWrapperProps {
  children: React.ReactNode
}

export default function ChatLayoutWrapper({
  children,
}: ChatLayoutWrapperProps) {
  const {
    navigateToThread,
    navigateToNewChat,
    prefetchThread,
    currentThreadId,
  } = useOptimisticNavigation()

  // Get threads list with real-time updates
  const threads = useQuery(api.threads.list) ?? []

  // Get current thread for title display
  const currentThread = useQuery(
    api.threads.get,
    currentThreadId === "new" || !currentThreadId
      ? "skip"
      : { threadId: currentThreadId },
  )

  const getTitle = () => {
    if (!currentThreadId || currentThreadId === "new") {
      return "New Chat"
    }
    return currentThread?.title || "Loading..."
  }

  return (
    <TooltipProvider>
      <ChatLayout
        threads={threads}
        currentThreadId={currentThreadId || "new"}
        title={getTitle()}
        onNewChat={navigateToNewChat}
        onThreadSelect={navigateToThread}
        onThreadHover={prefetchThread}
      >
        {children}
      </ChatLayout>
    </TooltipProvider>
  )
}
