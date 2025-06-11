import { v } from "convex/values"
import { mutation, query } from "./_generated/server.js"

// Create a new thread
export const create = mutation({
  args: {
    title: v.string(),
    userId: v.string(),
  },
  returns: v.id("threads"),
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("threads", {
      title: args.title,
      userId: args.userId,
      createdAt: now,
      lastMessageAt: now,
    })
  },
})

// List threads for a user
export const list = query({
  args: {
    userId: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("threads"),
      _creationTime: v.number(),
      title: v.string(),
      userId: v.string(),
      createdAt: v.number(),
      lastMessageAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("threads")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect()
  },
})

// Get a specific thread
export const get = query({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.union(
    v.object({
      _id: v.id("threads"),
      _creationTime: v.number(),
      title: v.string(),
      userId: v.string(),
      createdAt: v.number(),
      lastMessageAt: v.number(),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.threadId)
  },
})

// Update thread's last message timestamp
export const updateLastMessage = mutation({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
    })
    return null
  },
})

// Update thread title
export const updateTitle = mutation({
  args: {
    threadId: v.id("threads"),
    title: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.threadId, {
      title: args.title,
    })
    return null
  },
})

// Delete a thread and all its messages
export const deleteThread = mutation({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // First delete all messages in the thread
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .collect()

    // Delete all messages
    for (const message of messages) {
      await ctx.db.delete(message._id)
    }

    // Finally delete the thread
    await ctx.db.delete(args.threadId)
    return null
  },
})
