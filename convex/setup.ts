import { internalMutation } from "./_generated/server"

/**
 * Setup function for preview deployments
 * This runs automatically when creating preview deployments
 * to populate them with initial test data
 */
export const setupInitialData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if we already have data to avoid duplicates
    const existingMessages = await ctx.db.query("messages").first()
    if (existingMessages) {
      console.log("Preview deployment already has data, skipping setup")
      return
    }

    console.log("Setting up initial data for preview deployment...")

    // Add welcome message
    await ctx.db.insert("messages", {
      body: "Welcome to Lightfast Chat! 🚀\n\nThis is a preview deployment with fresh test data. You can:\n- Send messages and see real-time updates\n- Test AI integrations\n- Explore the chat interface\n\nEnjoy testing! 💬",
      author: "System",
      timestamp: Date.now(),
      messageType: "ai",
      isComplete: true,
    })

    // Add a few sample messages to demonstrate the chat
    const sampleMessages = [
      {
        body: "Hello! This is a sample message in the preview environment.",
        author: "Test User",
        timestamp: Date.now() + 1000,
        messageType: "user" as const,
        isComplete: true,
      },
      {
        body: "Preview deployments are great for testing features before production!",
        author: "Developer",
        timestamp: Date.now() + 2000,
        messageType: "user" as const,
        isComplete: true,
      },
      {
        body: "Each preview deployment gets its own fresh Convex backend.",
        author: "System",
        timestamp: Date.now() + 3000,
        messageType: "ai" as const,
        isComplete: true,
      },
    ]

    for (const message of sampleMessages) {
      await ctx.db.insert("messages", message)
    }

    console.log("✅ Preview deployment setup complete!")
    console.log(`Added ${sampleMessages.length + 1} initial messages`)
  },
})
