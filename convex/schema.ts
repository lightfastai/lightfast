import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  messages: defineTable({
    author: v.string(),
    body: v.string(),
    timestamp: v.number(),
    messageType: v.union(v.literal("user"), v.literal("ai")),
    isStreaming: v.optional(v.boolean()),
    streamId: v.optional(v.string()),
    chunkIndex: v.optional(v.number()),
    isComplete: v.optional(v.boolean()),
  }),

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
