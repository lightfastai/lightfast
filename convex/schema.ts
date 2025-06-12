import { authTables } from "@convex-dev/auth/server"
import { defineSchema, defineTable } from "convex/server"
import { v } from "convex/values"

export default defineSchema({
  ...authTables,

  threads: defineTable({
    title: v.string(),
    userId: v.id("users"),
    createdAt: v.number(),
    lastMessageAt: v.number(),
    isTitleGenerating: v.optional(v.boolean()),
    // Thread-level usage tracking (denormalized for performance)
    usage: v.optional(
      v.object({
        totalInputTokens: v.number(),
        totalOutputTokens: v.number(),
        totalTokens: v.number(),
        totalReasoningTokens: v.number(),
        totalCachedInputTokens: v.number(),
        messageCount: v.number(),
        // Dynamic model tracking - scales to any number of models/providers
        modelStats: v.record(
          v.string(),
          v.object({
            messageCount: v.number(),
            inputTokens: v.number(),
            outputTokens: v.number(),
            totalTokens: v.number(),
            reasoningTokens: v.number(),
            cachedInputTokens: v.number(),
          }),
        ),
      }),
    ),
  }).index("by_user", ["userId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    body: v.string(),
    timestamp: v.number(),
    messageType: v.union(v.literal("user"), v.literal("assistant")),
    model: v.optional(v.union(v.literal("openai"), v.literal("anthropic"))),
    isStreaming: v.optional(v.boolean()),
    streamId: v.optional(v.string()),
    isComplete: v.optional(v.boolean()),
    thinkingStartedAt: v.optional(v.number()),
    thinkingCompletedAt: v.optional(v.number()),
    // Token usage tracking per message
    usage: v.optional(
      v.object({
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
        reasoningTokens: v.optional(v.number()),
        cachedInputTokens: v.optional(v.number()),
      }),
    ),
  }).index("by_thread", ["threadId"]),
})
