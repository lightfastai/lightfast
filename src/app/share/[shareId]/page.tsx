"use client"

import { useQuery } from "convex/react"
import { api } from "../../../../convex/_generated/api"
import { Markdown } from "@/components/ui/markdown"

// Note: The 'shares' API will be available after running 'pnpm convex:dev'
// @ts-ignore - Ignoring until Convex types are regenerated
const getShare = api.shares?.getShare

// Temporary type until Convex regenerates
type SharedMessage = {
  body: string
  timestamp: number
  messageType: "user" | "assistant"
  modelId?: string
}

export default function SharedConversationPage({
  params,
}: {
  params: { shareId: string }
}) {
  // @ts-ignore - Ignoring until Convex types are regenerated
  const shareData = useQuery(getShare, {
    shareId: params.shareId,
  })

  if (!shareData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-2">Conversation not found</h1>
          <p className="text-muted-foreground">
            This share link may be invalid or has been removed.
          </p>
        </div>
      </div>
    )
  }

  const { thread, messages } = shareData

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">{thread.title}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Shared conversation · Read-only
          </p>
        </div>
      </div>

      {/* Messages */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {messages.map((message: SharedMessage, index: number) => (
            <div
              key={`${message.timestamp}-${index}`}
              className={`flex ${
                message.messageType === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] ${
                  message.messageType === "user"
                    ? "bg-primary text-primary-foreground rounded-lg p-4"
                    : ""
                }`}
              >
                {message.messageType === "assistant" && message.modelId && (
                  <div className="text-xs text-muted-foreground mb-1">
                    {message.modelId}
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <Markdown>{message.body}</Markdown>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
