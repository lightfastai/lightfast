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

// Import shared types and utilities
import {
  ALL_MODEL_IDS,
  getProviderFromModelId,
  getActualModelName,
  isThinkingMode,
  type ModelId,
} from "../src/lib/ai/types.js"

// Create validators from the shared types
const modelIdValidator = v.union(...ALL_MODEL_IDS.map((id) => v.literal(id)))
const modelProviderValidator = v.union(
  v.literal("openai"),
  v.literal("anthropic"),
)

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
      model: v.optional(modelProviderValidator),
      modelId: v.optional(v.string()), // Keep as string for flexibility but validate in handler
      isStreaming: v.optional(v.boolean()),
      streamId: v.optional(v.string()),
      isComplete: v.optional(v.boolean()),
      thinkingStartedAt: v.optional(v.number()),
      thinkingCompletedAt: v.optional(v.number()),
      thinkingContent: v.optional(v.string()),
      isThinking: v.optional(v.boolean()),
      hasThinkingContent: v.optional(v.boolean()),
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
    modelId: v.optional(modelIdValidator), // Use the validated modelId
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

    // Use default model if none provided
    const modelId = args.modelId || "gpt-4o-mini"

    // Derive provider from modelId (type-safe)
    const provider = getProviderFromModelId(modelId as ModelId)

    // Insert user message
    await ctx.db.insert("messages", {
      threadId: args.threadId,
      body: args.body,
      timestamp: Date.now(),
      messageType: "user",
      model: provider,
      modelId: modelId,
    })

    // Update thread's last message timestamp
    await ctx.db.patch(args.threadId, {
      lastMessageAt: Date.now(),
    })

    // Schedule AI response using the modelId
    await ctx.scheduler.runAfter(0, internal.messages.generateAIResponse, {
      threadId: args.threadId,
      userMessage: args.body,
      modelId: modelId,
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
    modelId: modelIdValidator, // Use validated modelId
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    let messageId: Id<"messages"> | null = null
    try {
      // Derive provider and other settings from modelId
      const provider = getProviderFromModelId(args.modelId as ModelId)
      const actualModelName = getActualModelName(args.modelId as ModelId)
      const isThinking = isThinkingMode(args.modelId as ModelId)

      // Generate unique stream ID
      const streamId = `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

      // Create initial AI message placeholder
      messageId = await ctx.runMutation(
        internal.messages.createStreamingMessage,
        {
          threadId: args.threadId,
          streamId,
          provider,
          modelId: args.modelId,
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
        `Attempting to call ${provider} with model ID ${args.modelId} and ${messages.length} messages`,
      )

      // Choose the appropriate model using the actual model name
      const selectedModel =
        provider === "anthropic"
          ? anthropic(actualModelName)
          : openai(actualModelName)

      // Stream response using AI SDK v5 with full stream for reasoning support
      const streamOptions: Parameters<typeof streamText>[0] = {
        model: selectedModel,
        messages: messages,
        temperature: 0.7,
      }

      // For Claude 4.0 thinking mode, enable thinking/reasoning
      if (provider === "anthropic" && isThinking) {
        // Claude 4.0 has native thinking support
        streamOptions.system =
          "You are a helpful AI assistant. For complex questions, show your reasoning process step by step before providing the final answer."
        streamOptions.providerOptions = {
          anthropic: {
            thinking: {
              type: "enabled",
              budgetTokens: 12000, // Budget for thinking tokens
            },
          },
        }
      }

      const { fullStream } = await streamText(streamOptions)

      let fullContent = ""
      let thinkingContent = ""
      let isInThinkingPhase = false
      let hasThinking = false

      console.log("Starting to process v5 stream chunks...")

      // Process each chunk as it arrives from the stream
      for await (const chunk of fullStream) {
        console.log("Received v5 chunk type:", chunk.type)

        // Handle different types of chunks
        if (chunk.type === "text" && chunk.text) {
          // Regular text content
          fullContent += chunk.text

          // Update the message body progressively
          await ctx.runMutation(internal.messages.updateStreamingMessage, {
            messageId,
            content: fullContent,
          })
        } else if (chunk.type === "reasoning" && chunk.text) {
          // Claude 4.0 native reasoning tokens
          if (!hasThinking) {
            hasThinking = true
            isInThinkingPhase = true
            // Update message to indicate thinking phase
            await ctx.runMutation(internal.messages.updateThinkingState, {
              messageId,
              isThinking: true,
              hasThinkingContent: true,
            })
          }

          // Accumulate thinking content
          thinkingContent += chunk.text

          // Update thinking content progressively
          await ctx.runMutation(internal.messages.updateThinkingContent, {
            messageId,
            thinkingContent,
          })
        } else if (chunk.type === "finish-step" || chunk.type === "finish") {
          // End of reasoning phase or stream completion
          if (isInThinkingPhase && hasThinking) {
            isInThinkingPhase = false
            // Mark end of thinking phase
            await ctx.runMutation(internal.messages.updateThinkingState, {
              messageId,
              isThinking: false,
              hasThinkingContent: true,
            })
          }
        }
      }

      console.log(
        `V5 stream complete. Full content length: ${fullContent.length}`,
      )

      if (fullContent.trim() === "") {
        throw new Error(
          `${provider} returned empty response - check API key and quota`,
        )
      }

      // Mark message as complete
      await ctx.runMutation(internal.messages.completeStreamingMessage, {
        messageId,
      })
    } catch (error) {
      console.error("Error generating response:", error)

      // If we have a messageId, update it with error, otherwise create new error message
      if (messageId) {
        await ctx.runMutation(internal.messages.updateStreamingMessage, {
          messageId,
          content: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}. Please check your API keys.`,
        })
        await ctx.runMutation(internal.messages.completeStreamingMessage, {
          messageId,
        })
      } else {
        const provider = getProviderFromModelId(args.modelId as ModelId)
        const streamId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        await ctx.runMutation(internal.messages.createErrorMessage, {
          threadId: args.threadId,
          streamId,
          provider,
          modelId: args.modelId,
          errorMessage: `Error: ${error instanceof Error ? error.message : "Unknown error occurred"}. Please check your API keys.`,
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
    provider: modelProviderValidator,
    modelId: modelIdValidator,
  },
  returns: v.id("messages"),
  handler: async (ctx, args) => {
    const now = Date.now()
    return await ctx.db.insert("messages", {
      threadId: args.threadId,
      body: "", // Will be updated as chunks arrive
      timestamp: now,
      messageType: "assistant",
      model: args.provider,
      isStreaming: true,
      streamId: args.streamId,
      isComplete: false,
      thinkingStartedAt: now,
      modelId: args.modelId,
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

// Internal mutation to mark streaming as complete
export const completeStreamingMessage = internalMutation({
  args: {
    messageId: v.id("messages"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      isStreaming: false,
      isComplete: true,
      thinkingCompletedAt: Date.now(),
    })

    return null
  },
})

// Internal mutation to create error message
export const createErrorMessage = internalMutation({
  args: {
    threadId: v.id("threads"),
    streamId: v.string(),
    provider: modelProviderValidator,
    modelId: v.optional(modelIdValidator),
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
      model: args.provider,
      modelId: args.modelId,
      isStreaming: false,
      streamId: args.streamId,
      isComplete: true,
      thinkingStartedAt: now,
      thinkingCompletedAt: now,
    })

    return null
  },
})

// Internal mutation to update thinking state
export const updateThinkingState = internalMutation({
  args: {
    messageId: v.id("messages"),
    isThinking: v.boolean(),
    hasThinkingContent: v.boolean(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      isThinking: args.isThinking,
      hasThinkingContent: args.hasThinkingContent,
    })
    return null
  },
})

// Internal mutation to update thinking content
export const updateThinkingContent = internalMutation({
  args: {
    messageId: v.id("messages"),
    thinkingContent: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.messageId, {
      thinkingContent: args.thinkingContent,
    })
    return null
  },
})
