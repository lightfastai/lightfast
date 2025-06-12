# Implementation Example: Public Link Sharing

This document provides a step-by-step implementation guide for adding public link sharing to the chat application.

## Step 1: Update Convex Schema

First, add the shares table to your schema:

```typescript
// convex/schema.ts
import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

// ... existing code ...

export default defineSchema({
  ...authTables,

  // ... existing tables ...

  // Add this new table for shares
  shares: defineTable({
    threadId: v.id("threads"),
    shareId: v.string(),
    createdBy: v.id("users"),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    accessCount: v.number(),
    isActive: v.boolean(),
    settings: v.object({
      requirePassword: v.boolean(),
      passwordHash: v.optional(v.string()),
    }),
  })
    .index("by_shareId", ["shareId"])
    .index("by_thread", ["threadId"])
    .index("by_creator", ["createdBy"]),
})
```

## Step 2: Create Convex Functions

Create a new file for share-related functions:

```typescript
// convex/shares.ts
import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { Doc } from "./_generated/dataModel"
import crypto from "crypto"

// Helper function to generate unique share IDs
function generateShareId(): string {
  return crypto.randomBytes(6).toString("hex")
}

// Create a new share
export const createShare = mutation({
  args: {
    threadId: v.id("threads"),
    expiresIn: v.optional(v.number()), // hours
    requirePassword: v.optional(v.boolean()),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first()

    if (!user) throw new Error("User not found")

    // Verify user owns the thread
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.userId !== user._id) {
      throw new Error("Unauthorized: You don't own this thread")
    }

    // Check if active share already exists
    const existingShare = await ctx.db
      .query("shares")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (existingShare) {
      return {
        shareId: existingShare.shareId,
        isNew: false
      }
    }

    // Generate unique share ID
    const shareId = generateShareId()

    // Hash password if provided
    let passwordHash: string | undefined
    if (args.requirePassword && args.password) {
      // In production, use bcrypt or similar
      passwordHash = crypto
        .createHash("sha256")
        .update(args.password)
        .digest("hex")
    }

    // Create share record
    await ctx.db.insert("shares", {
      threadId: args.threadId,
      shareId,
      createdBy: user._id,
      createdAt: Date.now(),
      expiresAt: args.expiresIn
        ? Date.now() + (args.expiresIn * 3600000)
        : undefined,
      accessCount: 0,
      isActive: true,
      settings: {
        requirePassword: args.requirePassword || false,
        passwordHash,
      },
    })

    return { shareId, isNew: true }
  },
})

// Get share by ID (for public access)
export const getShare = query({
  args: {
    shareId: v.string(),
    password: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first()

    if (!share || !share.isActive) {
      return { error: "Share not found" }
    }

    // Check if expired
    if (share.expiresAt && share.expiresAt < Date.now()) {
      return { error: "Share has expired" }
    }

    // Check password if required
    if (share.settings.requirePassword) {
      if (!args.password) {
        return { error: "Password required", requiresPassword: true }
      }

      const passwordHash = crypto
        .createHash("sha256")
        .update(args.password)
        .digest("hex")

      if (passwordHash !== share.settings.passwordHash) {
        return { error: "Invalid password" }
      }
    }

    // Get thread and messages
    const thread = await ctx.db.get(share.threadId)
    if (!thread) {
      return { error: "Thread not found" }
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", share.threadId))
      .collect()

    // Increment access count
    await ctx.db.patch(share._id, {
      accessCount: share.accessCount + 1,
    })

    return {
      thread: {
        title: thread.title,
        createdAt: thread.createdAt,
        lastMessageAt: thread.lastMessageAt,
      },
      messages: messages.map((msg) => ({
        body: msg.body,
        timestamp: msg.timestamp,
        messageType: msg.messageType,
        model: msg.model,
        modelId: msg.modelId,
      })),
      shareInfo: {
        createdAt: share.createdAt,
        expiresAt: share.expiresAt,
        accessCount: share.accessCount,
      },
    }
  },
})

// Revoke a share
export const revokeShare = mutation({
  args: { shareId: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) throw new Error("Unauthorized")

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first()

    if (!user) throw new Error("User not found")

    const share = await ctx.db
      .query("shares")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first()

    if (!share) throw new Error("Share not found")

    // Verify user owns the share
    if (share.createdBy !== user._id) {
      throw new Error("Unauthorized: You don't own this share")
    }

    // Mark as inactive instead of deleting (for audit trail)
    await ctx.db.patch(share._id, { isActive: false })

    return { success: true }
  },
})

// List user's shares
export const listMyShares = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) return []

    const user = await ctx.db
      .query("users")
      .withIndex("by_token", (q) =>
        q.eq("tokenIdentifier", identity.tokenIdentifier)
      )
      .first()

    if (!user) return []

    const shares = await ctx.db
      .query("shares")
      .withIndex("by_creator", (q) => q.eq("createdBy", user._id))
      .filter((q) => q.eq(q.field("isActive"), true))
      .collect()

    // Get thread titles
    const sharesWithThreads = await Promise.all(
      shares.map(async (share) => {
        const thread = await ctx.db.get(share.threadId)
        return {
          ...share,
          threadTitle: thread?.title || "Untitled",
        }
      })
    )

    return sharesWithThreads
  },
})
```

## Step 3: Create Share Button Component

**Note**: This example uses a Switch component from shadcn/ui. If you don't have it, you can either:
1. Add it using: `npx shadcn@latest add switch`
2. Or replace it with a simple checkbox input (see alternative below)

```tsx
// src/components/chat/ShareButton.tsx
"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
// If you don't have Switch, comment out the line above and use the checkbox alternative below
import { Switch } from "@/components/ui/switch"
import { Share2, Copy, Check } from "lucide-react"
import { useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { env } from "@/env"

interface ShareButtonProps {
  threadId: Id<"threads">
}

export function ShareButton({ threadId }: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [requirePassword, setRequirePassword] = useState(false)
  const [password, setPassword] = useState("")
  const [expiresIn, setExpiresIn] = useState("0") // 0 means never
  const [shareUrl, setShareUrl] = useState("")
  const [copied, setCopied] = useState(false)

  const createShare = useMutation(api.shares.createShare)

  const handleCreateShare = async () => {
    try {
      const result = await createShare({
        threadId,
        expiresIn: expiresIn === "0" ? undefined : parseInt(expiresIn),
        requirePassword,
        password: requirePassword ? password : undefined,
      })

      const url = `${env.NEXT_PUBLIC_APP_URL}/share/${result.shareId}`
      setShareUrl(url)
    } catch (error) {
      console.error("Failed to create share:", error)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Share2 className="h-4 w-4 mr-2" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Share Conversation</DialogTitle>
          <DialogDescription>
            Create a shareable link for this conversation. Anyone with the link
            can view the conversation.
          </DialogDescription>
        </DialogHeader>

        {!shareUrl ? (
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="password-protection">
                Password Protection
              </Label>
              <Switch
                id="password-protection"
                checked={requirePassword}
                onCheckedChange={setRequirePassword}
              />
            </div>

            {/* Alternative without Switch component:
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="password-protection"
                checked={requirePassword}
                onChange={(e) => setRequirePassword(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="password-protection">
                Password Protection
              </Label>
            </div>
            */}

            {requirePassword && (
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a password"
                />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="expires">Expires In</Label>
              <select
                id="expires"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
              >
                <option value="0">Never</option>
                <option value="1">1 hour</option>
                <option value="24">24 hours</option>
                <option value="168">7 days</option>
                <option value="720">30 days</option>
              </select>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Share Link</Label>
              <div className="flex gap-2">
                <Input
                  value={shareUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Anyone with this link can view your conversation.
              {requirePassword && " They'll need the password to access it."}
            </p>
          </div>
        )}

        <DialogFooter>
          {!shareUrl ? (
            <Button
              onClick={handleCreateShare}
              disabled={requirePassword && !password}
            >
              Create Share Link
            </Button>
          ) : (
            <Button
              variant="outline"
              onClick={() => {
                setShareUrl("")
                setPassword("")
                setRequirePassword(false)
                setExpiresIn("0")
                setIsOpen(false)
              }}
            >
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

## Step 4: Create Public Share View Page

```tsx
// src/app/share/[shareId]/page.tsx
"use client"

import { useState } from "react"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, Calendar, Eye } from "lucide-react"
import { MessageDisplay } from "@/components/chat/MessageDisplay"
import { formatDistanceToNow } from "date-fns"

export default function SharedConversationPage({
  params,
}: {
  params: { shareId: string }
}) {
  const [password, setPassword] = useState("")
  const [submittedPassword, setSubmittedPassword] = useState<string>()

  const shareData = useQuery(api.shares.getShare, {
    shareId: params.shareId,
    password: submittedPassword,
  })

  if (!shareData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  if (shareData.error === "Password required" && !submittedPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Password Required
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSubmittedPassword(password)
              }}
              className="space-y-4"
            >
              <Input
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" className="w-full">
                Access Conversation
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (shareData.error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{shareData.error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { thread, messages, shareInfo } = shareData

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-bold">{thread.title}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Shared {formatDistanceToNow(shareInfo.createdAt)} ago
              </span>
              <span className="flex items-center gap-1">
                <Eye className="h-4 w-4" />
                {shareInfo.accessCount} views
              </span>
              {shareInfo.expiresAt && (
                <span>
                  Expires {formatDistanceToNow(shareInfo.expiresAt)}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="space-y-6">
          {messages.map((message, index) => (
            <div
              key={index}
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
                <MessageDisplay content={message.body} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t mt-8">
        <div className="container mx-auto px-4 py-4 text-center">
          <p className="text-sm text-muted-foreground">
            This conversation was shared via{" "}
            <a href="/" className="underline">
              Your Chat App
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
```

## Step 5: Add Share Button to Chat Interface

Update your chat interface to include the share button:

```tsx
// src/components/chat/ChatInterface.tsx
import { ShareButton } from "./ShareButton"

// In your chat header or toolbar
<div className="flex items-center gap-2">
  {/* Other buttons */}
  <ShareButton threadId={threadId} />
</div>
```

## Step 6: Add Share Management Page

```tsx
// src/app/settings/shares/page.tsx
"use client"

import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { formatDistanceToNow } from "date-fns"
import { Trash2, Copy, ExternalLink } from "lucide-react"
import { env } from "@/env"

export default function SharesPage() {
  const shares = useQuery(api.shares.listMyShares)
  const revokeShare = useMutation(api.shares.revokeShare)

  const handleCopy = (shareId: string) => {
    const url = `${env.NEXT_PUBLIC_APP_URL}/share/${shareId}`
    navigator.clipboard.writeText(url)
  }

  const handleRevoke = async (shareId: string) => {
    if (confirm("Are you sure you want to revoke this share?")) {
      await revokeShare({ shareId })
    }
  }

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6">Shared Conversations</h1>

      {shares?.length === 0 ? (
        <Card className="p-6 text-center text-muted-foreground">
          You haven't shared any conversations yet.
        </Card>
      ) : (
        <div className="space-y-4">
          {shares?.map((share) => (
            <Card key={share._id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">{share.threadTitle}</h3>
                  <div className="text-sm text-muted-foreground space-y-1 mt-2">
                    <p>
                      Created {formatDistanceToNow(share.createdAt)} ago
                    </p>
                    <p>{share.accessCount} views</p>
                    {share.expiresAt && (
                      <p>
                        Expires {formatDistanceToNow(share.expiresAt)}
                      </p>
                    )}
                    {share.settings.requirePassword && (
                      <p>🔒 Password protected</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(share.shareId)}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                  >
                    <a
                      href={`/share/${share.shareId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRevoke(share.shareId)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Security Considerations

1. **Rate Limiting**: Add rate limiting to prevent share spam
2. **Access Logs**: Track who accesses shared conversations
3. **Data Retention**: Implement automatic cleanup of old shares
4. **Encryption**: Consider encrypting message content for sensitive data
5. **CORS**: Configure CORS properly for embed functionality

## Next Steps

1. Add more sharing methods (user-to-user, export formats)
2. Implement share analytics dashboard
3. Add social media preview cards
4. Create embed widget functionality
5. Build notification system for shares
6. Add collaborative features

This implementation provides a solid foundation for conversation sharing that you can expand upon based on your specific needs.
