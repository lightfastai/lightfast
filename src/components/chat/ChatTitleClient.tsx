"use client"

import { useQuery } from "convex/react"
import { usePathname } from "next/navigation"
import { useMemo } from "react"
import { api } from "../../../convex/_generated/api"
import type { Id } from "../../../convex/_generated/dataModel"

// Client component for dynamic chat title that updates based on current thread
export function ChatTitleClient() {
  const pathname = usePathname()

  // Extract current thread ID to show in header
  const currentThreadId = useMemo(() => {
    if (pathname === "/chat") {
      return "new"
    }
    const match = pathname.match(/^\/chat\/(.+)$/)
    return match ? (match[1] as Id<"threads">) : "new"
  }, [pathname])

  // Get current thread for title
  const currentThread = useQuery(
    api.threads.get,
    currentThreadId === "new"
      ? "skip"
      : { threadId: currentThreadId as Id<"threads"> },
  )

  const getTitle = () => {
    if (currentThreadId === "new") {
      return "New Chat"
    }
    return currentThread?.title || "AI Chat"
  }

  return <h1 className="text-lg font-semibold">{getTitle()}</h1>
}
