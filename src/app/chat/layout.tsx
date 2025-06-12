import { TooltipProvider } from "@/components/ui/tooltip"
import { isAuthenticated } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ChatLayoutClient } from "../../components/chat/ChatLayoutClient"

interface ChatLayoutWrapperProps {
  children: React.ReactNode
}

// Server component that handles auth once for entire chat section
export default async function ChatLayoutWrapper({
  children,
}: ChatLayoutWrapperProps) {
  // Check authentication once for entire chat section
  const authenticated = await isAuthenticated()
  if (!authenticated) {
    redirect("/signin")
  }

  return (
    <TooltipProvider>
      <ChatLayoutClient>{children}</ChatLayoutClient>
    </TooltipProvider>
  )
}
