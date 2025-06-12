"use client"

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import dynamic from "next/dynamic"
import { Suspense, useMemo } from "react"
import { usePathname } from "next/navigation"
import type { Id } from "../../../convex/_generated/dataModel"
import { ServerSidebar } from "./sidebar/ServerSidebar"

const DynamicChatTitle = dynamic(
  () => import("./ChatTitleClient").then((mod) => mod.ChatTitleClient),
  {
    ssr: true,
  },
)

const DynamicTokenUsageHeader = dynamic(
  () =>
    import("./TokenUsageHeaderWrapper").then(
      (mod) => mod.TokenUsageHeaderWrapper,
    ),
  {
    ssr: true,
  },
)

const DynamicShareButton = dynamic(
  () => import("./ShareButton").then((mod) => mod.ShareButton),
  {
    ssr: false,
  },
)

// Client component for chat header to access pathname
function ChatHeader() {
  const pathname = usePathname()

  // Extract thread ID from pathname
  const currentThreadId = useMemo(() => {
    if (pathname === "/chat") {
      return null
    }
    const match = pathname.match(/^\/chat\/(.+)$/)
    return match ? (match[1] as Id<"threads">) : null
  }, [pathname])

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex items-center gap-2 flex-1">
        <Suspense
          fallback={<div className="h-6 w-24 bg-muted animate-pulse rounded" />}
        >
          <DynamicChatTitle />
        </Suspense>
      </div>
      {currentThreadId && (
        <Suspense fallback={null}>
          <DynamicShareButton threadId={currentThreadId} />
        </Suspense>
      )}
      <Suspense
        fallback={
          <div className="flex items-center gap-2">
            <div className="h-6 w-16 bg-muted animate-pulse rounded" />
            <div className="h-6 w-20 bg-muted animate-pulse rounded" />
          </div>
        }
      >
        <DynamicTokenUsageHeader />
      </Suspense>
    </header>
  )
}

interface ChatLayoutProps {
  children: React.ReactNode
}

// Main layout component
export function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full">
        <ServerSidebar />
        <SidebarInset className="flex flex-col">
          <ChatHeader />
          <div className="flex-1 min-h-0">{children}</div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}
