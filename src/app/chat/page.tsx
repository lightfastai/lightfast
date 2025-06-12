import type { Metadata } from "next"
import { ChatInterface } from "../../components/chat/ChatInterface"

export const metadata: Metadata = {
  title: "Chat - Lightfast",
  description: "Start intelligent conversations with AI agents.",
  robots: {
    index: false,
    follow: false,
  },
}

// Server component that handles chat routing logic
export default function ChatPage() {
  // Authentication is now handled by middleware
  // This allows for instant client-side navigation
  return <ChatInterface />
}
