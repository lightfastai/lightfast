import { Suspense } from "react"
import { Badge } from "@/components/ui/badge"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { ServerSidebar } from "./ServerSidebar"
import dynamic from "next/dynamic"

interface ServerChatLayoutProps {
  children: React.ReactNode
}

const DynamicChatTitle = dynamic(() =>
  import("./ChatTitleClient").then((mod) => mod.ChatTitleClient),
)

// Server component for chat header - can be static with PPR
async function ChatHeader() {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <div className="flex items-center gap-2 flex-1">
        <Suspense
          fallback={<div className="h-6 w-24 bg-muted animate-pulse rounded" />}
        >
          <DynamicChatTitle />
        </Suspense>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline">Streaming</Badge>
        <Badge variant="outline">GPT-4o-mini</Badge>
      </div>
    </header>
  )
}

// Main server layout component
export function ServerChatLayout({ children }: ServerChatLayoutProps) {
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
