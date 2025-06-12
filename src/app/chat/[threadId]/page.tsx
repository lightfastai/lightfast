import type { Metadata } from "next"
import { notFound } from "next/navigation"
import type { Id } from "../../../../convex/_generated/dataModel"
import { ChatInterface } from "../../../components/chat/ChatInterface"

export const metadata: Metadata = {
  title: "Chat Thread - Lightfast",
  description: "Continue your AI conversation.",
  robots: {
    index: false,
    follow: false,
  },
}

interface ChatThreadPageProps {
  params: Promise<{
    threadId: string
  }>
}

// Server component for specific thread - auth handled by layout
export default async function ChatThreadPage({ params }: ChatThreadPageProps) {
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
