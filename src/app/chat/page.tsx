import { isAuthenticated } from "@/lib/auth"
import type { Metadata } from "next"
import { redirect } from "next/navigation"
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
export default async function ChatPage() {
  // Check authentication - redirect to signin if not authenticated
  const authenticated = await isAuthenticated()
  if (!authenticated) {
    redirect("/signin")
  }

  // Use the ChatInterface component directly
  return <ChatInterface />
}
