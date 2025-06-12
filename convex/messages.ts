import { anthropic } from "@ai-sdk/anthropic"
import { openai } from "@ai-sdk/openai"
import { getAuthUserId } from "@convex-dev/auth/server"
import { streamText } from "ai"
import { v } from "convex/values"
import { internal } from "./_generated/api.js"
import type { Doc, Id } from "./_generated/dataModel.js"
import {
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server.js"

export const list = query({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.array(
    v.object({
      _id: v.id("messages"),
      _creationTime: v.number(),
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
      usage: v.optional(
        v.object({
          inputTokens: v.optional(v.number()),
          outputTokens: v.optional(v.number()),
          totalTokens: v.optional(v.number()),
          reasoningTokens: v.optional(v.number()),
          cachedInputTokens: v.optional(v.number()),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return []
    }

    // Verify the user owns this thread
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.userId !== userId) {
      return []
    }

    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(50)
  },
})

export const send = mutation({
  args: {
    threadId: v.id("threads"),
    body: v.string(),
    model: v.optional(v.union(v.literal("openai"), v.literal("anthropic"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      throw new Error("User must be authenticated")
    }

    // Verify the user owns this thread
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.userId !== userId) {
      throw new Error("Thread not found or access denied")
    }

    // Insert user message
    await ctx.db.insert("messages", {
      threadId: args.threadId,
      body: args.body,
      timestamp: Date.now(),
      messageType: "user",
      model: args.model,
    })

    // Update thread's last message timestamp
    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
    })

    // Schedule AI response - default to anthropic (Claude Sonnet 4) for better performance
    await ctx.scheduler.runAfter(0, internal.messages.generateAIResponse, {
      threadId: args.threadId,
      userMessage: args.body,
      model: args.model || "anthropic", // Default to Claude Sonnet 4
    })

    // Check if this is the first user message in the thread (for title generation)
    const userMessages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .filter((q) => q.eq(q.field("messageType"), "user"))
      .collect()

    // If this is the first user message, schedule title generation
    if (userMessages.length === 1) {
      await ctx.scheduler.runAfter(100, internal.titles.generateTitle, {
        threadId: args.threadId,
        userMessage: args.body,
      })
    }

    return null
  },
})

// Internal action to generate AI response using AI SDK v5
export const generateAIResponse = internalAction({
  args: {
    threadId: v.id("threads"),
    userMessage: v.string(),
    model: v.union(v.literal("openai"), v.literal("anthropic")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let messageId: Id<"messages"> | null = null
    try {
      // Generate unique stream ID
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create initial AI message placeholder
      messageId = await ctx.runMutation(
        internal.messages.createStreamingMessage,
        {
          threadId: args.threadId,
          streamId,
          model: args.model,
        },
      )

      // Get recent conversation context
      const recentMessages = await ctx.runQuery(
        internal.messages.getRecentContext,
        { threadId: args.threadId },
      )

      // Prepare messages for AI SDK v5 - using standard format
      const messages = [
        {
          role: "system" as const,
          content:
            "You are a helpful AI assistant in a chat conversation. Be concise and friendly.",
        },
        ...recentMessages.map((msg) => ({
          role:
            msg.messageType === "user"
              ? ("user" as const)
              : ("assistant" as const),
          content: msg.body,
        })),
      ]

      console.log(
        `Attempting to call ${args.model} with ${messages.length} messages`,
      )

      // Choose the appropriate model using updated model IDs for v5
      const selectedModel =
        args.model === "anthropic"
          ? anthropic("claude-sonnet-4-20250514") // Latest Claude Sonnet 4
          : openai("gpt-4o-mini")

      // Stream response using AI SDK v5
      const { textStream, usage } = await streamText({
        model: selectedModel,
        messages: messages,
        temperature: 0.7,
      })

      let fullContent = ""

      console.log("Starting to process v5 stream chunks...")

      // Process each chunk as it arrives from the stream
      for await (const chunk of textStream) {
        console.log("Received v5 chunk:", chunk)
        fullContent += chunk

        // Update the message body progressively
        await ctx.runMutation(internal.messages.updateStreamingMessage, {
          messageId,
          content: fullContent,
        })
      }

      console.log(
        `V5 stream complete. Full content length: ${fullContent.length}`,
      )

      if (fullContent.trim() === "") {
        throw new Error(
          `${args.model} returned empty response - check API key and quota`,
        )
      }

      // Get final usage data
      const finalUsage = await usage
      console.log("Final usage data:", finalUsage)

      // Mark message as complete with usage data
      await ctx.runMutation(internal.messages.completeStreamingMessage, {
        messageId,
        usage: finalUsage,
      })
    } catch (error) {
      console.error(`Error generating ${args.model} response:`, error)

      // If we have a messageId, update it with error, otherwise create new error message
      if (messageId) {
        await ctx.runMutation(internal.messages.updateStreamingMessage, {
          messageId,
          content: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}. Please check your ${args.model} API key.`,
        })
        await ctx.runMutation(internal.messages.completeStreamingMessage, {
          messageId,
        })
      } else {
        const streamId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        await ctx.runMutation(internal.messages.createErrorMessage, {
          threadId: args.threadId,
          streamId,
          model: args.model,
          errorMessage: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}. Please check your ${args.model} API key.`,
        })
      }
    }

    return null
  },
})

// Internal function to get recent conversation context
export const getRecentContext = internalQuery({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.array(
    v.object({
      body: v.string(),
      messageType: v.union(v.literal("user"), v.literal("assistant")),
    }),
  ),
  handler: async (ctx, args) => {
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(10)

    return messages
      .reverse() // Get chronological order
      .filter((msg: Doc<"messages">) => msg.isComplete !== false) // Only include complete messages
      .map((msg: Doc<"messages">) => ({
        body: msg.body,
        messageType: msg.messageType,
      }))
  },
})

// Internal mutation to create initial streaming message
export const createStreamingMessage = internalMutation({
  args: {
    threadId: v.id("threads"),
    streamId: v.string(),
    model: v.union(v.literal("openai"), v.literal("anthropic")),
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("messages", {
      threadId: args.threadId,
      body: "", // Will be updated as chunks arrive
      timestamp: now,
      messageType: "assistant",
      model: args.model,
      isStreaming: true,
      streamId: args.streamId,
      isComplete: false,
      thinkingStartedAt: now,
    })
  },
})

// Internal mutation to update streaming message content
export const updateStreamingMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      body: args.content,
    })

    return null
  },
})

// Internal mutation to mark streaming as complete and update thread usage
export const completeStreamingMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
    usage: v.optional(
      v.object({
        inputTokens: v.optional(v.number()),
        outputTokens: v.optional(v.number()),
        totalTokens: v.optional(v.number()),
        reasoningTokens: v.optional(v.number()),
        cachedInputTokens: v.optional(v.number()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get the message to find thread and model
    const message = await ctx.db.get(args.messageId)
    if (!message) {
      throw new Error("Message not found")
    }

    // Update the message with completion status and usage
    await ctx.db.patch(args.messageId, {
      isStreaming: false,
      isComplete: true,
      thinkingCompletedAt: Date.now(),
      usage: args.usage,
    })

    // Update thread usage totals atomically if we have usage data
    if (args.usage && message.threadId) {
      await updateThreadUsage(
        ctx,
        message.threadId,
        message.model || "unknown",
        args.usage,
      )
    }

    return null
  },
})

// Helper function to update thread usage totals
async function updateThreadUsage(
  ctx: {
    db: {
      get: (id: Id<"threads">) => Promise<Doc<"threads"> | null>
      patch: (
        id: Id<"threads">,
        fields: Partial<Doc<"threads">>,
      ) => Promise<void>
    }
  },
  threadId: Id<"threads">,
  model: string,
  messageUsage: {
    inputTokens?: number
    outputTokens?: number
    totalTokens?: number
    reasoningTokens?: number
    cachedInputTokens?: number
  },
) {
  const thread = await ctx.db.get(threadId)
  if (!thread) return

  const inputTokens = messageUsage.inputTokens || 0
  const outputTokens = messageUsage.outputTokens || 0
  const totalTokens = messageUsage.totalTokens || 0
  const reasoningTokens = messageUsage.reasoningTokens || 0
  const cachedInputTokens = messageUsage.cachedInputTokens || 0

  // Get existing usage or initialize
  const currentUsage = thread.usage || {
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalTokens: 0,
    totalReasoningTokens: 0,
    totalCachedInputTokens: 0,
    messageCount: 0,
    modelStats: {},
  }

  // Get model-specific ID (e.g., "claude-sonnet-4-20250514" instead of just "anthropic")
  const modelId = getFullModelId(model)

  // Update totals
  const newUsage = {
    totalInputTokens: currentUsage.totalInputTokens + inputTokens,
    totalOutputTokens: currentUsage.totalOutputTokens + outputTokens,
    totalTokens: currentUsage.totalTokens + totalTokens,
    totalReasoningTokens: currentUsage.totalReasoningTokens + reasoningTokens,
    totalCachedInputTokens:
      currentUsage.totalCachedInputTokens + cachedInputTokens,
    messageCount: currentUsage.messageCount + 1,
    modelStats: {
      ...currentUsage.modelStats,
      [modelId]: {
        messageCount: (currentUsage.modelStats[modelId]?.messageCount || 0) + 1,
        inputTokens:
          (currentUsage.modelStats[modelId]?.inputTokens || 0) + inputTokens,
        outputTokens:
          (currentUsage.modelStats[modelId]?.outputTokens || 0) + outputTokens,
        totalTokens:
          (currentUsage.modelStats[modelId]?.totalTokens || 0) + totalTokens,
        reasoningTokens:
          (currentUsage.modelStats[modelId]?.reasoningTokens || 0) +
          reasoningTokens,
        cachedInputTokens:
          (currentUsage.modelStats[modelId]?.cachedInputTokens || 0) +
          cachedInputTokens,
      },
    },
  }

  // Update thread with new usage
  await ctx.db.patch(threadId, { usage: newUsage })
}

// Helper to get full model ID for consistent tracking across providers
function getFullModelId(model: string): string {
  switch (model) {
    case "anthropic":
      return "claude-sonnet-4-20250514"
    case "openai":
      return "gpt-4o-mini"
    default:
      return model
  }
}

// Internal mutation to create error message
export const createErrorMessage = internalMutation({
  args: {
    threadId: v.id("threads"),
    streamId: v.string(),
    model: v.union(v.literal("openai"), v.literal("anthropic")),
    errorMessage: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now()
    await ctx.db.insert("messages", {
      threadId: args.threadId,
      body: args.errorMessage,
      timestamp: now,
      messageType: "assistant",
      model: args.model,
      isStreaming: false,
      streamId: args.streamId,
      isComplete: true,
      thinkingStartedAt: now,
      thinkingCompletedAt: now, // Error occurred immediately
    })

    return null
  },
})

// Query to get thread-level token usage statistics (fast lookup from thread table)
export const getThreadUsage = query({
  args: {
    threadId: v.id("threads"),
  },
  returns: v.object({
    totalInputTokens: v.number(),
    totalOutputTokens: v.number(),
    totalTokens: v.number(),
    totalReasoningTokens: v.number(),
    totalCachedInputTokens: v.number(),
    messageCount: v.number(),
    modelStats: v.array(
      v.object({
        model: v.string(),
        inputTokens: v.number(),
        outputTokens: v.number(),
        totalTokens: v.number(),
        reasoningTokens: v.number(),
        cachedInputTokens: v.number(),
        messageCount: v.number(),
      }),
    ),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx)
    if (!userId) {
      return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalReasoningTokens: 0,
        totalCachedInputTokens: 0,
        messageCount: 0,
        modelStats: [],
      }
    }

    // Verify the user owns this thread
    const thread = await ctx.db.get(args.threadId)
    if (!thread || thread.userId !== userId) {
      return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalReasoningTokens: 0,
        totalCachedInputTokens: 0,
        messageCount: 0,
        modelStats: [],
      }
    }

    // Return usage from thread table (fast O(1) lookup!)
    const usage = thread.usage
    if (!usage) {
      return {
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalTokens: 0,
        totalReasoningTokens: 0,
        totalCachedInputTokens: 0,
        messageCount: 0,
        modelStats: [],
      }
    }

    // Convert modelStats record to array format
    const modelStats = Object.entries(usage.modelStats).map(
      ([model, stats]) => ({
        model,
        inputTokens: stats.inputTokens,
        outputTokens: stats.outputTokens,
        totalTokens: stats.totalTokens,
        reasoningTokens: stats.reasoningTokens,
        cachedInputTokens: stats.cachedInputTokens,
        messageCount: stats.messageCount,
      }),
    )

    return {
      totalInputTokens: usage.totalInputTokens,
      totalOutputTokens: usage.totalOutputTokens,
      totalTokens: usage.totalTokens,
      totalReasoningTokens: usage.totalReasoningTokens,
      totalCachedInputTokens: usage.totalCachedInputTokens,
      messageCount: usage.messageCount,
      modelStats,
    }
  },
})
