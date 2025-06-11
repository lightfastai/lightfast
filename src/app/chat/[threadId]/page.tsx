import { isAuthenticated } from "@/lib/auth"
import { notFound, redirect } from "next/navigation"
import type { Id } from "../../../../convex/_generated/dataModel"
import { ChatInterface } from "../../../components/chat/ChatInterface"

interface ChatThreadPageProps {
  params: Promise<{
    threadId: string
  }>
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

  // Pass minimal data to client component - let client-side queries handle real data
  return <ChatInterface />
}
