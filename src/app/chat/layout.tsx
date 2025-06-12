import { TooltipProvider } from "@/components/ui/tooltip"
import { ServerChatLayout } from "@/components/chat/ServerChatLayout"
import type React from "react"

interface ChatLayoutProps {
  children: React.ReactNode
}

// Server component layout - provides static shell and enables SSR with PPR
export default function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <TooltipProvider>
      <ServerChatLayout>{children}</ServerChatLayout>
    </TooltipProvider>
  )
}
