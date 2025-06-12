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

// Server component for new chat - auth handled by layout
export default function ChatPage() {
  return <ChatInterface />
}
