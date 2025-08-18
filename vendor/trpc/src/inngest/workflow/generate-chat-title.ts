import { inngest } from "../client/client";
import {
	db,
	LightfastChatSession,
	LightfastChatMessage,
	DEFAULT_SESSION_TITLE,
} from "@vendor/db";
import { eq } from "drizzle-orm";
import { gateway } from "@ai-sdk/gateway";
import { generateText } from "ai";

export const generateChatTitle = inngest.createFunction(
	{
		id: "apps-chat.generate-title",
		name: "Generate Chat Title",
		retries: 3,
	},
	{ event: "apps-chat/generate-title" },
	async ({ event, step }) => {
		const { sessionId, userId, firstMessage } = event.data;

		// Step 1: Verify session exists and belongs to user
		const session = await step.run("verify-session", async () => {
			const result = await db
				.select({
					id: LightfastChatSession.id,
					title: LightfastChatSession.title,
					clerkUserId: LightfastChatSession.clerkUserId,
				})
				.from(LightfastChatSession)
				.where(eq(LightfastChatSession.id, sessionId))
				.limit(1);

			if (!result[0]) {
				throw new Error(`Session ${sessionId} not found`);
			}

			if (result[0].clerkUserId !== userId) {
				throw new Error(
					`Session ${sessionId} does not belong to user ${userId}`,
				);
			}

			return result[0];
		});

		// Step 2: Check if title already exists and is not default
		if (session.title && session.title !== DEFAULT_SESSION_TITLE) {
			return {
				success: true,
				message: "Title already exists",
				title: session.title,
			};
		}

		// Step 3: Get first few messages for context
		// This will fetch any existing messages from the database
		// When called from session.create, this will likely be empty
		// When called from generateTitle mutation, this will have messages
		const messages = await step.run("get-messages", async () => {
			const msgs = await db
				.select({
					role: LightfastChatMessage.role,
					parts: LightfastChatMessage.parts,
				})
				.from(LightfastChatMessage)
				.where(eq(LightfastChatMessage.sessionId, sessionId))
				.orderBy(LightfastChatMessage.createdAt)
				.limit(4); // Get first 2 exchanges if available

			return msgs;
		});

		// Step 4: Generate title using AI
		const generatedTitle = await step.run("generate-title", async () => {
			// Build context from messages
			let context = firstMessage;
			if (messages.length > 1) {
				context = messages
					.slice(0, 4)
					.map((msg) => {
						// Safely extract text from the first part
						const firstPart = msg.parts[0];
						const text = firstPart && "text" in firstPart ? firstPart.text : "";
						return `${msg.role}: ${typeof text === "string" ? text.slice(0, 200) : ""}`;
					})
					.join("\n");
			}

			try {
				const { text } = await generateText({
					model: gateway("openai/gpt-5-nano"),
					system: `You are a title generator for chat conversations. 
Generate a concise, descriptive title (2-4 words) that captures the main topic or intent of the conversation.
The title should be clear and specific, not generic.
Do not use quotes or special characters.
Examples of good titles:
- Debug React Hook Error
- Python Data Analysis Help
- Travel Planning for Japan
- Understanding Machine Learning Basics`,
					prompt: `Generate a title for this conversation:\n\n${context}`,
					temperature: 0.5,
				});

				// Clean up the title (remove quotes, trim, etc.)
				const cleanTitle = text
					.replace(/^["']|["']$/g, "") // Remove surrounding quotes
					.replace(/\.$/, "") // Remove trailing period
					.trim()
					.slice(0, 100); // Ensure max length

				return cleanTitle || DEFAULT_SESSION_TITLE;
			} catch (error) {
				console.error("Failed to generate title with AI:", error);
				// Fallback: Extract first few words from the message
				const words = firstMessage.split(/\s+/).slice(0, 5).join(" ");
				const fallbackTitle =
					words.length > 50 ? words.slice(0, 47) + "..." : words;
				return fallbackTitle || DEFAULT_SESSION_TITLE;
			}
		});

		// Step 5: Update session with new title
		await step.run("update-title", async () => {
			await db
				.update(LightfastChatSession)
				.set({ title: generatedTitle })
				.where(eq(LightfastChatSession.id, sessionId));
		});

		return {
			success: true,
			sessionId,
			title: generatedTitle,
		};
	},
);

