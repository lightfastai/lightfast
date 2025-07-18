"use client";

import { useChat } from "@ai-sdk/react";
import { use, useEffect } from "react";
import { useAgentTasks } from "@/hooks/use-agent-tasks";
import { useChatTransport } from "@/hooks/use-chat-transport";
import { ChatInput } from "@/components/chat-input";
import { TaskAccordion } from "@/components/task-accordion";
import { VirtuosoChat } from "@/components/virtuoso-chat";
import type { LightfastUIMessage } from "@/types/lightfast-ui-messages";

interface ChatPageProps {
	params: Promise<{
		threadId: string;
	}>;
}

export default function ChatPage({ params }: ChatPageProps) {
	const { threadId } = use(params);

	// Fetch agent tasks
	const { tasks } = useAgentTasks({ threadId, pollingInterval: 3000 });
	console.log(`[UI] Tasks in component:`, tasks);
	console.log(`[UI] Tasks length in component:`, tasks.length);

	// Create transport for AI SDK v5
	const transport = useChatTransport({ threadId });

	// Use the chat hook with transport and LightfastUIMessage type
	const {
		messages = [],
		sendMessage: vercelSendMessage,
		status,
	} = useChat<LightfastUIMessage>({
		id: threadId,
		transport,
		onError: (error) => {
			console.error("Chat error:", error);
		},
	});

	const isLoading = status === "streaming" || status === "submitted";

	// Debug: Log messages to see their structure
	useEffect(() => {
		console.log(`[UI] Thread ID: ${threadId}`);
		console.log("Messages:", messages);
		messages.forEach((msg, index) => {
			console.log(`Message ${index}:`, {
				id: msg.id,
				role: msg.role,
				parts: msg.parts,
			});
		});
	}, [messages, threadId]);

	return (
		<main className="flex h-screen flex-col relative">
			{/* Header text positioned absolutely */}
			<div className="absolute top-4 left-6 z-20">
				<p className="text-xs text-muted-foreground">This is an experiment by Lightfast. Use with discretion.</p>
			</div>

			{messages.length === 0 ? (
				// Center the chat input when no messages
				<div className="flex-1 flex items-center p-6 overflow-hidden">
					<div className="w-full max-w-3xl mx-auto relative -top-12">
						<div className="mb-6">
							<h1 className="text-2xl font-medium mb-2">Hello.</h1>
							<p className="text-2xl text-muted-foreground">What can I do for you?</p>
						</div>
						{/* Task Accordion for empty messages state */}
						<div className="mb-6">
							{console.log(`[UI] About to render TaskAccordion in empty state with tasks:`, tasks)}
							<TaskAccordion tasks={tasks} />
						</div>
						<ChatInput
							onSendMessage={async (message) => {
								if (!message.trim() || isLoading) return;

								try {
									// Generate IDs for the messages
									const userMessageId = `user-${Date.now()}`;
									const assistantMessageId = `assistant-${Date.now()}`;

									console.log(`[UI] Sending message with threadId: ${threadId}`);
									console.log(`[UI] User message ID: ${userMessageId}`);
									console.log(`[UI] Assistant message ID: ${assistantMessageId}`);

									// Use vercelSendMessage with the correct AI SDK v5 format
									await vercelSendMessage(
										{
											role: "user",
											parts: [{ type: "text", text: message }],
											id: userMessageId,
										},
										{
											body: {
												id: assistantMessageId,
												userMessageId,
												threadClientId: threadId,
											},
										},
									);
								} catch (error) {
									console.error("Error sending message:", error);
									throw error; // Re-throw to let ChatInput handle error state
								}
							}}
							placeholder="Type your message..."
							disabled={isLoading}
						/>
					</div>
				</div>
			) : (
				// Normal layout with messages and bottom input
				<div className="flex-1 flex flex-col relative">
					{/* Message area with Virtuoso */}
					<div className="flex-1 relative min-h-0">
						<div className="absolute inset-0 pt-6">
							<VirtuosoChat messages={messages} isLoading={isLoading} />
						</div>
					</div>

					{/* Fixed bottom section with gradient, tasks, and input */}
					<div className="relative">
						{/* Gradient fade overlay */}
						<div className="absolute -top-24 left-0 right-0 h-24 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none" />

						{/* Task Accordion */}
						<div className="relative bg-background">
							{console.log(`[UI] About to render TaskAccordion with tasks:`, tasks)}
							<TaskAccordion tasks={tasks} />
						</div>

						{/* Chat Input */}
						<div className="relative bg-background pb-4">
							<ChatInput
								onSendMessage={async (message) => {
									if (!message.trim() || isLoading) return;

									try {
										// Generate IDs for the messages
										const userMessageId = `user-${Date.now()}`;
										const assistantMessageId = `assistant-${Date.now()}`;

										console.log(`[UI] Sending message with threadId: ${threadId}`);
										console.log(`[UI] User message ID: ${userMessageId}`);
										console.log(`[UI] Assistant message ID: ${assistantMessageId}`);

										// Use vercelSendMessage with the correct AI SDK v5 format
										await vercelSendMessage(
											{
												role: "user",
												parts: [{ type: "text", text: message }],
												id: userMessageId,
											},
											{
												body: {
													id: assistantMessageId,
													userMessageId,
													threadClientId: threadId,
												},
											},
										);
									} catch (error) {
										console.error("Error sending message:", error);
										throw error; // Re-throw to let ChatInput handle error state
									}
								}}
								placeholder="Type your message..."
								disabled={isLoading}
							/>
						</div>
					</div>
				</div>
			)}
		</main>
	);
}
