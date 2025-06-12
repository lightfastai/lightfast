import { TooltipProvider } from "@/components/ui/tooltip"
import { SimplifiedChatLayout } from "@/components/chat/ChatLayout"
import type React from "react"

interface ChatLayoutProps {
  children: React.ReactNode
}

// Server component layout - provides static shell and enables SSR
export default function ChatLayout({ children }: ChatLayoutProps) {
  return (
    <TooltipProvider>
      <SimplifiedChatLayout>{children}</SimplifiedChatLayout>
    </TooltipProvider>
  )
}
