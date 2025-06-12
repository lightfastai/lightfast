"use client"

import { useQuery } from "convex/react"
import { usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { api } from "../../../convex/_generated/api"
import { SimplifiedChatSidebar } from "./ChatSidebar"
import type { Id } from "../../../convex/_generated/dataModel"
import { useMemo } from "react"

interface SimplifiedChatLayoutProps {
  children: React.ReactNode
}

// Chat header component
function ChatHeader({ title = "AI Chat" }: { title?: string }) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex items-center gap-2 flex-1">
        <h1 className="text-lg font-semibold">{title}</h1>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">Streaming</Badge>
        <Badge variant="outline">GPT-4o-mini</Badge>
      </div>
    </header>
  )
}

export function SimplifiedChatLayout({ children }: SimplifiedChatLayoutProps) {
  const pathname = usePathname()

  // Just get the threads - no complex navigation logic needed
  const threads = useQuery(api.threads.list) ?? []

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

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <SimplifiedChatSidebar threads={threads} />
        <SidebarInset className="flex flex-col">
          <ChatHeader title={getTitle()} />
          <div className="flex-1 min-h-0">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
