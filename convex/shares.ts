import { v } from "convex/values"
import { mutation, query } from "./_generated/server"
import { getAuthUserId } from "@convex-dev/auth/server"

// Helper function to generate unique share IDs
function generateShareId(): string {
  // Simple implementation - in production you might want something more robust
  return Math.random().toString(36).substring(2, 15)
}

// Create a new share
export const createShare = mutation({
  args: {
    threadId: v.id("threads"),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) throw new Error("Unauthorized")

    // Verify user owns the thread
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.userId !== userId) {
      throw new Error("Unauthorized: You don't own this thread")
    }

    // Check if active share already exists
    const existingShare = await ctx.db
      .query("shares")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first()

    if (existingShare) {
      return { shareId: existingShare.shareId }
    }

    // Generate unique share ID
    const shareId = generateShareId()

    // Create share record
    await ctx.db.insert("shares", {
      threadId: args.threadId,
      shareId,
      createdBy: userId,
      createdAt: Date.now(),
      isActive: true,
    })

    return { shareId }
  },
})

// Get share by ID (for public access - no auth required)
export const getShare = query({
  args: {
    shareId: v.string(),
  },
  handler: async (ctx, args) => {
    const share = await ctx.db
      .query("shares")
      .withIndex("by_shareId", (q) => q.eq("shareId", args.shareId))
      .first()

    if (!share || !share.isActive) {
      return null
    }

    // Get thread
    const thread = await ctx.db.get(share.threadId)
    if (!thread) {
      return null
    }

    // Get messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", share.threadId))
      .collect()

    return {
      thread: {
        title: thread.title,
        createdAt: thread.createdAt,
      },
      messages: messages.map((msg) => ({
        body: msg.body,
        timestamp: msg.timestamp,
        messageType: msg.messageType,
        modelId: msg.modelId,
      })),
    }
  },
})
