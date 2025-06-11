import { redirect } from "next/navigation"
import { isAuthenticated } from "@/lib/auth"
import { ChatRouter } from "@/components/chat/ChatRouter"

// Server component that handles chat routing logic
export default async function ChatPage() {
  // Check authentication - redirect to home if not authenticated
  const authenticated = await isAuthenticated()
  if (!authenticated) {
    redirect("/")
  }

  // Use the client component to handle the chat routing
  return <ChatRouter />
}
