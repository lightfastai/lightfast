import { isAuthenticated } from "@/lib/auth"
import { redirect } from "next/navigation"
import { ChatInterface } from "../../components/chat/ChatInterface"
// Server component that handles chat routing logic
export default async function ChatPage() {
  // Check authentication - redirect to home if not authenticated
  const authenticated = await isAuthenticated()
  if (!authenticated) {
    redirect("/")
  }

  // Use the ChatInterface component directly
  return <ChatInterface />
}
