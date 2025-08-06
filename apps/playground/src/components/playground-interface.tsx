"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChatInput } from "./chat-input";
import { BrowserContainer } from "./browser-container";
import { EmptyState } from "./empty-state";
import { ChatMessages } from "./chat-messages";
import { useChat } from "~/hooks/use-chat";
import { useScreenshotManager } from "~/hooks/use-screenshot-manager";
import { AgentId } from "~/app/(agents)/types";
import type { PlaygroundUIMessage } from "~/types/playground-ui-messages";
import { BrowserProvider } from "~/contexts/browser-context";

interface PlaygroundInterfaceProps {
	threadId: string;
	initialMessages: PlaygroundUIMessage[];
}

/**
 * Inner component that uses browser context
 */
function PlaygroundInterfaceInner({
	threadId,
	initialMessages,
}: PlaygroundInterfaceProps) {
	const router = useRouter();

	// Use the chat hook with the browser agent
	const { messages, sendMessage, status, isLoading } = useChat({
		agentId: AgentId.BROWSER_010,
		threadId,
		initialMessages,
		onError: (error) => {
			console.error("Chat error:", error);
			// TODO: Add toast notification for user feedback
		},
	});
	
	// Manage screenshots from messages
	useScreenshotManager({ messages, threadId });

	// Update URL to include thread ID when first message is sent
	useEffect(() => {
		if (messages.length > 0 && window.location.pathname === "/playground") {
			// Use history.replaceState to update URL without adding to history
			window.history.replaceState(null, "", `/playground/${threadId}`);
		}
	}, [messages.length, threadId]);

	const handleSendMessage = async (message: string) => {
		try {
			await sendMessage(message);
		} catch (error) {
			console.error("Failed to send message:", error);
			// Error is already handled by onError callback
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
							<ChatMessages messages={messages} status={status} />

							{/* Input area */}
							<div className="flex-shrink-0 pb-4">
								<ChatInput
									onSendMessage={handleSendMessage}
									placeholder="Ask the browser agent to navigate, interact, or extract data..."
									disabled={isLoading}
								/>
							</div>
						</div>

						{/* Right section - 70% */}
						<div className="col-span-7 border rounded-sm shadow-lg">
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
					placeholder="Ask the browser agent to navigate, interact, or extract data..."
					disabled={isLoading}
				/>
			</div>
		</div>
	);
}

/**
 * PlaygroundInterface with optimized server/client boundaries
 * Server-renders static content and progressively enhances with client features
 */
export function PlaygroundInterface(props: PlaygroundInterfaceProps) {
	return (
		<BrowserProvider>
			<PlaygroundInterfaceInner {...props} />
		</BrowserProvider>
	);
}
