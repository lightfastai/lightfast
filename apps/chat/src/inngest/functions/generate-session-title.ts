import { inngest } from "../client";
import { gateway } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { db, LightfastChatSession, LightfastChatMessage } from "@vendor/db";
import { eq, asc, and } from "drizzle-orm";

export type GenerateSessionTitleEvent = {
  name: "chat/session.title.generate";
  data: {
    sessionId: string;
    userId: string;
    firstMessages?: string; // Optional: Pass first few messages if already available
  };
};

export const generateSessionTitle = inngest.createFunction(
  {
    id: "generate-session-title",
    retries: 3,
    concurrency: {
      limit: 10, // Limit concurrent title generations
    },
  },
  { event: "chat/session.title.generate" },
  async ({ event, step }) => {
    const { sessionId, userId, firstMessages } = event.data;

    // Step 1: Fetch session and verify ownership
    const session = await step.run("fetch-session", async () => {
      const sessions = await db
        .select()
        .from(LightfastChatSession)
        .where(
          and(
            eq(LightfastChatSession.id, sessionId),
            eq(LightfastChatSession.clerkUserId, userId)
          )
        )
        .limit(1);

      if (!sessions[0]) {
        throw new Error(`Session ${sessionId} not found or unauthorized`);
      }

      return sessions[0];
    });

    // Skip if title is already customized (not the default)
    if (session.title !== "New Session") {
      return {
        skipped: true,
        reason: "Session already has a custom title",
        currentTitle: session.title,
      };
    }

    // Step 2: Get conversation messages (if not provided)
    const messages = await step.run("fetch-messages", async () => {
      if (firstMessages) {
        return firstMessages;
      }

      // Fetch first few messages to understand context
      const chatMessages = await db
        .select({
          role: LightfastChatMessage.role,
          parts: LightfastChatMessage.parts,
        })
        .from(LightfastChatMessage)
        .where(eq(LightfastChatMessage.sessionId, sessionId))
        .orderBy(asc(LightfastChatMessage.createdAt))
        .limit(10); // Get first 10 messages for context

      // Format messages for title generation
      return chatMessages
        .map((msg) => {
          const textParts = msg.parts
            .filter((part: any) => part.type === "text")
            .map((part: any) => part.text)
            .join(" ");
          return `${msg.role}: ${textParts}`;
        })
        .join("\n");
    });

    // Skip if no meaningful conversation yet
    if (!messages || messages.trim().length < 20) {
      return {
        skipped: true,
        reason: "Not enough conversation content for title generation",
      };
    }

    // Step 3: Generate title using AI via Vercel Gateway
    const generatedTitle = await step.run("generate-title", async () => {
      const { text } = await generateText({
        model: gateway("gpt-4o-mini"), // Using Vercel Gateway
        system: `You are a helpful assistant that creates concise, descriptive titles for chat conversations.
The title should:
- Be 2-6 words maximum
- Capture the main topic or question
- Be clear and specific
- Not include punctuation unless necessary
- Not be generic (avoid "Chat", "Conversation", "Discussion")`,
        prompt: `Based on the following conversation, generate a short, descriptive title:

${messages}

Title:`,
        maxRetries: 2,
        temperature: 0.7,
      });

      // Clean up the title
      const cleanTitle = text
        .trim()
        .replace(/^["']|["']$/g, "") // Remove quotes
        .replace(/^Title:\s*/i, "") // Remove "Title:" prefix if present
        .slice(0, 100); // Ensure it fits in database

      return cleanTitle || "New Session"; // Fallback to default if generation fails
    });

    // Step 4: Update session title in database
    const updateResult = await step.run("update-session-title", async () => {
      await db
        .update(LightfastChatSession)
        .set({ 
          title: generatedTitle,
        })
        .where(
          and(
            eq(LightfastChatSession.id, sessionId),
            eq(LightfastChatSession.clerkUserId, userId)
          )
        );

      return {
        sessionId,
        oldTitle: session.title,
        newTitle: generatedTitle,
      };
    });

    // Step 5: Log the title generation
    await step.run("log-title-generation", async () => {
      console.log(`[Inngest] Generated title for session ${sessionId}:`, {
        sessionId,
        userId,
        oldTitle: session.title,
        newTitle: generatedTitle,
        timestamp: new Date().toISOString(),
      });
    });

    return {
      success: true,
      ...updateResult,
    };
  }
);