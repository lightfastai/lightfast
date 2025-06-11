"use client"

import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Plus } from "lucide-react"
import Link from "next/link"
import type { Doc, Id } from "../../../convex/_generated/dataModel"
import { UserDropdown } from "../auth/UserDropdown"
import { PrefetchThread } from "./PrefetchThread"

type Thread = Doc<"threads">

interface ChatLayoutProps {
  children: React.ReactNode
  threads?: Thread[]
  currentThreadId?: Id<"threads"> | "new"
  title?: string
  onNewChat?: () => void
  onThreadSelect?: (threadId: Id<"threads">) => void
}

// Lightfast logo component
function LightfastLogo(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="104"
      height="70"
      viewBox="0 0 104 70"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Lightfast"
      {...props}
    >
      <title>Lightfast</title>
      <path
        d="M15.3354 57.3195H47.1597V69.7863H0.543457V0.632019H15.3354V57.3195Z"
        fill="currentColor"
      />
      <path
        d="M79.6831 69.7863H65.2798L89.0532 0.658386H103.457L79.6831 69.7863Z"
        fill="currentColor"
      />
    </svg>
  )
}

// Helper function to categorize dates
function getDateCategory(date: Date): string {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000)
  const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
  const lastMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)

  if (date >= today) {
    return "Today"
  }
  if (date >= yesterday) {
    return "Yesterday"
  }
  if (date >= lastWeek) {
    return "This Week"
  }
  if (date >= lastMonth) {
    return "This Month"
  }
  return "Older"
}

// Helper function to group threads by date category
function groupThreadsByDate(threads: Thread[]): Record<string, Thread[]> {
  const groups: Record<string, Thread[]> = {}

  for (const thread of threads) {
    const category = getDateCategory(new Date(thread.lastMessageAt))
    if (!groups[category]) {
      groups[category] = []
    }
    groups[category].push(thread)
  }

  return groups
}

// Chat sidebar component
function ChatSidebar({
  threads = [],
  currentThreadId,
  onNewChat,
  onThreadSelect,
}: {
  threads: Thread[]
  currentThreadId?: Id<"threads"> | "new"
  onNewChat?: () => void
  onThreadSelect?: (threadId: Id<"threads">) => void
}) {
  const groupedThreads = groupThreadsByDate(threads)
  const categoryOrder = [
    "Today",
    "Yesterday",
    "This Week",
    "This Month",
    "Older",
  ]

  return (
    <Sidebar variant="inset" className="w-64">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-3">
            <LightfastLogo className="w-6 h-6 text-foreground" />
          </Link>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onNewChat}
                  size="default"
                  className="h-10 w-full"
                >
                  <Plus className="w-4 h-4" />
                  <span>New Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <ScrollArea className="h-[calc(100vh-280px)]">
          {threads.length === 0 ? (
            <div className="px-3 py-8 text-center text-muted-foreground">
              <p className="text-sm">No conversations yet</p>
              <p className="text-xs mt-1">Start a new chat to begin</p>
            </div>
          ) : (
            categoryOrder.map((category) => {
              const categoryThreads = groupedThreads[category]
              if (!categoryThreads || categoryThreads.length === 0) {
                return null
              }

              return (
                <SidebarGroup key={category}>
                  <SidebarGroupLabel className="text-xs font-medium text-muted-foreground">
                    {category}
                  </SidebarGroupLabel>
                  <SidebarGroupContent>
                    <SidebarMenu className="space-y-0.5">
                      {categoryThreads.map((thread) => (
                        <SidebarMenuItem key={thread._id}>
                          <SidebarMenuButton
                            isActive={currentThreadId === thread._id}
                            onClick={() => onThreadSelect?.(thread._id)}
                            className="w-full h-auto p-2.5 text-left"
                            size="default"
                          >
                            <span
                              className={`truncate text-sm font-medium ${
                                thread.isTitleGenerating
                                  ? "animate-pulse blur-[0.5px] opacity-70"
                                  : ""
                              }`}
                            >
                              {thread.title}
                            </span>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </SidebarGroup>
              )
            })
          )}
        </ScrollArea>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <UserDropdown className="w-full justify-start" />
      </SidebarFooter>
    </Sidebar>
  )
}

// Chat header component
function ChatHeader({
  title = "AI Chat",
  showTrigger = true,
}: {
  title?: string
  showTrigger?: boolean
}) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      {showTrigger && <SidebarTrigger className="-ml-1" />}
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

export function ChatLayout({
  children,
  threads = [],
  currentThreadId,
  title,
  onNewChat,
  onThreadSelect,
}: ChatLayoutProps) {
  // Get the latest 10 threads for prefetching
  const latestThreads = threads.slice(0, 10)

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <ChatSidebar
          threads={threads}
          currentThreadId={currentThreadId}
          onNewChat={onNewChat}
          onThreadSelect={onThreadSelect}
        />
        <SidebarInset className="flex flex-col">
          <ChatHeader title={title} />
          <div className="flex-1 min-h-0">{children}</div>
        </SidebarInset>
      </div>

      {/* Prefetch messages for the latest 10 threads for instant navigation */}
      {latestThreads.map((thread) => (
        <PrefetchThread key={`prefetch-${thread._id}`} threadId={thread._id} />
      ))}
    </SidebarProvider>
  )
}
