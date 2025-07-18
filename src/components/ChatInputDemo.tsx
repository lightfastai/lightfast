"use client";

import { useState } from "react";
import { ChatInput } from "./ChatInput";

export function ChatInputDemo() {
	const [messages, setMessages] = useState<string[]>([]);

	const handleSendMessage = async (message: string) => {
		// Add the message to the list
		setMessages((prev) => [...prev, message]);

		// Simulate async processing
		await new Promise((resolve) => setTimeout(resolve, 500));

		console.log("Message sent:", message);
	};

	return (
		<div className="flex flex-col h-screen bg-background">
			{/* Messages area */}
			<div className="flex-1 overflow-y-auto p-4">
				<div className="max-w-3xl mx-auto space-y-4">
					{messages.length === 0 ? (
						<p className="text-center text-muted-foreground mt-8">No messages yet. Start a conversation!</p>
					) : (
						messages.map((message, index) => (
							<div key={`msg-${index}-${message.slice(0, 10)}`} className="p-4 rounded-lg bg-card border border-border">
								<p className="whitespace-pre-wrap">{message}</p>
							</div>
						))
					)}
				</div>
			</div>

			{/* Chat input */}
			<ChatInput
				onSendMessage={handleSendMessage}
				placeholder="Type your message here..."
				className="border-t border-border"
			/>
		</div>
	);
}
