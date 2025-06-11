import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  threads: defineTable({
    title: v.string(),
    userId: v.string(),
    createdAt: v.number(),
    lastMessageAt: v.number(),
  }).index("by_user", ["userId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    body: v.string(),
    timestamp: v.number(),
    messageType: v.union(v.literal("user"), v.literal("assistant")),
    isStreaming: v.optional(v.boolean()),
    streamId: v.optional(v.string()),
    chunkIndex: v.optional(v.number()),
    isComplete: v.optional(v.boolean()),
  }).index("by_thread", ["threadId"]),

  messageChunks: defineTable({
    messageId: v.id("messages"),
    streamId: v.string(),
    chunkIndex: v.number(),
    content: v.string(),
    timestamp: v.number(),
  })
    .index("by_message", ["messageId"])
    .index("by_stream", ["streamId", "chunkIndex"]),
})
