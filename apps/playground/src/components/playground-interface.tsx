"use client";

import { useState } from "react";
import { ChatInput } from "./chat-input";
import { BrowserContainer } from "./browser-container";
import { EmptyState } from "./empty-state";

interface PlaygroundInterfaceProps {
	threadId: string;
	initialMessages: {
		id: string;
		content: string;
		role: "user" | "assistant";
	}[];
}

/**
 * PlaygroundInterface with optimized server/client boundaries
 * Server-renders static content and progressively enhances with client features
 */
export function PlaygroundInterface({
	threadId,
	initialMessages,
}: PlaygroundInterfaceProps) {
	const [messages, setMessages] = useState(initialMessages);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSendMessage = (message: string) => {
		if (!message.trim() || isSubmitting) return;

		setIsSubmitting(true);

		// Update URL to include thread ID - following experimental's pattern
		// In multi-zone setup, we need to preserve the /playground prefix
		// Note: There may be a race condition where navigation happens before
		// messages are persisted, causing empty initial state on refresh
		window.history.replaceState({}, "", `/playground/${threadId}`);

		try {
			// Add user message
			const userMessage = {
				id: crypto.randomUUID(),
				content: message,
				role: "user" as const,
			};

			setMessages((prev) => [...prev, userMessage]);

			// TODO: Add AI response handling with proper API integration
			console.log("Message sent:", message, "Thread:", threadId);
		} catch (error) {
			console.error("Failed to send message:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	// Always render the full interface if we have messages
	if (messages.length > 0) {
		return (
			<div className="flex-1 flex flex-col">
				<div className="flex-1 app-container">
					<div className="grid grid-cols-10 gap-0 h-full">
						{/* Chat section - 30% */}
						<div className="col-span-3 flex flex-col">
							{/* Messages area */}
							<div className="flex-1 overflow-auto py-4">
								{messages.map((message) => (
									<div
										key={message.id}
										className={`mb-4 ${
											message.role === "user" ? "text-right" : "text-left"
										}`}
									>
										<div
											className={`inline-block p-3 rounded-lg ${
												message.role === "user"
													? "bg-primary text-primary-foreground"
													: "bg-muted"
											}`}
										>
											{message.content}
										</div>
									</div>
								))}
							</div>

							{/* Input area */}
							<div className="flex-shrink-0 pb-4">
								<ChatInput
									onSendMessage={handleSendMessage}
									placeholder="Ask Lightfast"
									disabled={isSubmitting}
								/>
							</div>
						</div>

						{/* Right section - 70% */}
						<div className="col-span-7 border border-border/50 rounded-sm shadow-lg">
							<BrowserContainer />
						</div>
					</div>
				</div>
			</div>
		);
	}

	// For empty state, center the content in the middle of the page
	return (
		<div className="flex-1 flex items-center justify-center">
			<div className="w-full max-w-3xl px-4">
				<div className="px-4">
					<EmptyState />
				</div>
				<ChatInput
					onSendMessage={handleSendMessage}
					placeholder="Ask Lightfast"
					disabled={isSubmitting}
				/>
			</div>
		</div>
	);
}

