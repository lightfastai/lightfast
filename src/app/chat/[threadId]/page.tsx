import { redirect, notFound } from "next/navigation"
import { isAuthenticated } from "@/lib/auth"
import type { Id } from "../../../../convex/_generated/dataModel"
import { ChatInterface } from "@/components/chat/ChatInterface"

interface ChatThreadPageProps {
  params: {
    threadId: string
  }
}

export default async function ChatThreadPage({ params }: ChatThreadPageProps) {
  // Check authentication - redirect to home if not authenticated
  const authenticated = await isAuthenticated()
  if (!authenticated) {
    redirect("/")
  }

  // Await params in Next.js 15
  const { threadId: threadIdString } = await params

  // Validate threadId format (basic check)
  const threadId = threadIdString as Id<"threads">
  if (!threadId) {
    notFound()
  }

  // Create minimal thread object for initial render
  const thread = {
    _id: threadId,
    _creationTime: Date.now(),
    title: "Loading...",
    userId: "temp" as Id<"users">,
    createdAt: Date.now(),
    lastMessageAt: Date.now(),
  }

  // Pass minimal data to client component - let client-side queries handle real data
  return (
    <ChatInterface currentThread={thread} threads={[]} initialMessages={[]} />
  )
}
