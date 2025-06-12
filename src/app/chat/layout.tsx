"use client"

import { TooltipProvider } from "@/components/ui/tooltip"
import { useQuery } from "convex/react"
import { usePathname, useRouter } from "next/navigation"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"
import { ChatLayout } from "../../components/chat/ChatLayout"

interface ChatLayoutWrapperProps {
  children: React.ReactNode
}

export default function ChatLayoutWrapper({
  children,
}: ChatLayoutWrapperProps) {
  const router = useRouter()
  const pathname = usePathname()

  // Get threads list with real-time updates
  const threads = useQuery(api.threads.list) ?? []

  // Extract current thread ID from pathname
  const getCurrentThreadId = (): Id<"threads"> | "new" => {
    if (pathname === "/chat") {
      return "new"
    }
    const threadId = pathname.split("/chat/")[1]
    return threadId as Id<"threads">
  }

  const currentThreadId = getCurrentThreadId()

  // Get current thread for title display
  const currentThread = useQuery(
    api.threads.get,
    currentThreadId === "new" ? "skip" : { threadId: currentThreadId },
  )

  const getTitle = () => {
    if (currentThreadId === "new") {
      return "New Chat"
    }
    return currentThread?.title || "Loading..."
  }

  const handleNewChat = () => {
    // Use client-side navigation to avoid page reload
    router.push("/chat")
  }

  const handleThreadSelect = (threadId: Id<"threads">) => {
    // Use client-side navigation to avoid page reload
    router.push(`/chat/${threadId}`)
  }

  return (
    <TooltipProvider>
      <ChatLayout
        threads={threads}
        currentThreadId={currentThreadId}
        title={getTitle()}
        onNewChat={handleNewChat}
        onThreadSelect={handleThreadSelect}
      >
        {children}
      </ChatLayout>
    </TooltipProvider>
  )
}
